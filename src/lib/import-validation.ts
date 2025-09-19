import { Decimal } from 'decimal.js'
import { prisma } from '@/lib/db'
import {
  ImportValidationError,
  ImportShiftsRequest,
  ImportPayGuidesRequest,
  ImportTaxDataRequest
} from '@/types'
import { ValidationResult, validateString, validateDecimal, validateDateRange } from '@/lib/validation'

export class ImportValidator {
  private errors: ImportValidationError[] = []
  private warnings: ImportValidationError[] = []

  addError(type: ImportValidationError['type'], field: string, message: string, index?: number, conflictWith?: string) {
    this.errors.push({ type, field, message, index, conflictWith })
  }

  addWarning(type: ImportValidationError['type'], field: string, message: string, index?: number, conflictWith?: string) {
    this.warnings.push({ type, field, message, index, conflictWith })
  }

  getErrors(): ImportValidationError[] {
    return this.errors
  }

  getWarnings(): ImportValidationError[] {
    return this.warnings
  }

  hasErrors(): boolean {
    return this.errors.length > 0
  }

  clear() {
    this.errors = []
    this.warnings = []
  }
}

export async function validateShiftsImport(request: ImportShiftsRequest): Promise<ImportValidator> {
  const validator = new ImportValidator()
  
  if (!Array.isArray(request.shifts)) {
    validator.addError('validation', 'shifts', 'Shifts must be an array')
    return validator
  }

  if (request.shifts.length === 0) {
    validator.addError('validation', 'shifts', 'No shifts provided for import')
    return validator
  }

  // Get all existing pay guides for validation
  const existingPayGuides = await prisma.payGuide.findMany({
    select: { name: true, isActive: true }
  })
  const payGuideNames = new Set(existingPayGuides.map(pg => pg.name))

  // Validate each shift
  for (let i = 0; i < request.shifts.length; i++) {
    const shift = request.shifts[i]
    const fieldValidator = ValidationResult.create()

    validateString(shift.payGuideName, 'payGuideName', fieldValidator)
    validateString(shift.startTime, 'startTime', fieldValidator)
    validateString(shift.endTime, 'endTime', fieldValidator)

    if (shift.notes && typeof shift.notes !== 'string') {
      fieldValidator.addError('notes', 'Notes must be a string')
    }

    if (fieldValidator.isValid()) {
      validateDateRange(shift.startTime, shift.endTime, fieldValidator, {
        maxDurationHours: 24
      })
    }

    if (!fieldValidator.isValid()) {
      fieldValidator.getErrors().forEach(error => {
        validator.addError('validation', error.field, error.message, i)
      })
    }

    // Check if pay guide exists
    if (request.options.validatePayGuides && !payGuideNames.has(shift.payGuideName)) {
      const activePayGuide = existingPayGuides.find(pg => pg.name === shift.payGuideName && pg.isActive)
      if (!activePayGuide) {
        validator.addError('dependency', 'payGuideName', `Pay guide "${shift.payGuideName}" not found or inactive`, i)
      }
    }

    // Validate break periods if provided
    if (shift.breakPeriods) {
      if (!Array.isArray(shift.breakPeriods)) {
        validator.addError('validation', 'breakPeriods', 'Break periods must be an array', i)
      } else {
        shift.breakPeriods.forEach((breakPeriod, breakIndex) => {
          const breakValidator = ValidationResult.create()
          validateString(breakPeriod.startTime, 'startTime', breakValidator)
          validateString(breakPeriod.endTime, 'endTime', breakValidator)

          if (breakValidator.isValid()) {
            validateDateRange(breakPeriod.startTime, breakPeriod.endTime, breakValidator)
          }

          if (!breakValidator.isValid()) {
            breakValidator.getErrors().forEach(error => {
              validator.addError('validation', `breakPeriods[${breakIndex}].${error.field}`, error.message, i)
            })
          }
        })
      }
    }
  }

  // Check for potential conflicts (overlapping shifts)
  if (request.options.conflictResolution !== 'overwrite') {
    await checkShiftConflicts(request.shifts, validator)
  }

  return validator
}

export async function validatePayGuidesImport(request: ImportPayGuidesRequest): Promise<ImportValidator> {
  const validator = new ImportValidator()
  
  if (!Array.isArray(request.payGuides)) {
    validator.addError('validation', 'payGuides', 'Pay guides must be an array')
    return validator
  }

  if (request.payGuides.length === 0) {
    validator.addError('validation', 'payGuides', 'No pay guides provided for import')
    return validator
  }

  // Get existing pay guide names
  const existingPayGuides = await prisma.payGuide.findMany({
    select: { name: true, isActive: true }
  })
  const existingNames = new Set(existingPayGuides.map(pg => pg.name))

  // Track names within the import to detect duplicates
  const importNames = new Set<string>()

  // Validate each pay guide
  for (let i = 0; i < request.payGuides.length; i++) {
    const guide = request.payGuides[i]
    const fieldValidator = ValidationResult.create()

    validateString(guide.name, 'name', fieldValidator)
    validateDecimal(guide.baseRate, 'baseRate', fieldValidator, { min: 0 })
    validateString(guide.effectiveFrom, 'effectiveFrom', fieldValidator)

    if (guide.effectiveTo) {
      validateString(guide.effectiveTo, 'effectiveTo', fieldValidator)
      if (fieldValidator.isValid()) {
        validateDateRange(guide.effectiveFrom, guide.effectiveTo, fieldValidator)
      }
    }

    if (guide.minimumShiftHours !== undefined && guide.minimumShiftHours !== null) {
      if (typeof guide.minimumShiftHours !== 'number' || guide.minimumShiftHours < 0) {
        fieldValidator.addError('minimumShiftHours', 'Minimum shift hours must be a non-negative number')
      }
    }

    if (guide.maximumShiftHours !== undefined && guide.maximumShiftHours !== null) {
      if (typeof guide.maximumShiftHours !== 'number' || guide.maximumShiftHours < 0) {
        fieldValidator.addError('maximumShiftHours', 'Maximum shift hours must be a non-negative number')
      }
    }

    if (!fieldValidator.isValid()) {
      fieldValidator.getErrors().forEach(error => {
        validator.addError('validation', error.field, error.message, i)
      })
    }

    // Check for duplicates within import
    if (importNames.has(guide.name)) {
      validator.addError('conflict', 'name', `Duplicate pay guide name "${guide.name}" in import`, i)
    } else {
      importNames.add(guide.name)
    }

    // Check for conflicts with existing pay guides
    if (existingNames.has(guide.name)) {
      if (request.options.conflictResolution === 'skip') {
        validator.addWarning('conflict', 'name', `Pay guide "${guide.name}" already exists and will be skipped`, i, guide.name)
      } else if (request.options.conflictResolution === 'overwrite') {
        validator.addWarning('conflict', 'name', `Pay guide "${guide.name}" already exists and will be overwritten`, i, guide.name)
      }
    }

    // Validate penalty time frames
    if (guide.penaltyTimeFrames) {
      guide.penaltyTimeFrames.forEach((ptf, ptfIndex) => {
        const multiplierValidator = ValidationResult.create()
      validateDecimal(ptf.multiplier, 'multiplier', multiplierValidator, { min: 0 })
      if (!multiplierValidator.isValid()) {
        multiplierValidator.getErrors().forEach(error => {
          validator.addError('validation', `penaltyTimeFrames[${ptfIndex}].${error.field}`, error.message, i)
        })
      }
        if (ptf.dayOfWeek !== undefined && (ptf.dayOfWeek < 0 || ptf.dayOfWeek > 6)) {
          validator.addError('validation', `penaltyTimeFrames[${ptfIndex}].dayOfWeek`, 'Day of week must be between 0 and 6', i)
        }
      })
    }

    // Validate overtime time frames
    if (guide.overtimeTimeFrames) {
      guide.overtimeTimeFrames.forEach((otf, otfIndex) => {
        const overtimeValidator = ValidationResult.create()
        validateDecimal(otf.firstThreeHoursMult, 'firstThreeHoursMult', overtimeValidator, { min: 0 })
        validateDecimal(otf.afterThreeHoursMult, 'afterThreeHoursMult', overtimeValidator, { min: 0 })
        if (!overtimeValidator.isValid()) {
          overtimeValidator.getErrors().forEach(error => {
            validator.addError('validation', `overtimeTimeFrames[${otfIndex}].${error.field}`, error.message, i)
          })
        }
        if (otf.dayOfWeek !== undefined && (otf.dayOfWeek < 0 || otf.dayOfWeek > 6)) {
          validator.addError('validation', `overtimeTimeFrames[${otfIndex}].dayOfWeek`, 'Day of week must be between 0 and 6', i)
        }
      })
    }
  }

  return validator
}

export async function validateTaxDataImport(request: ImportTaxDataRequest): Promise<ImportValidator> {
  const validator = new ImportValidator()

  // Validate tax settings
  if (request.taxSettings) {
    const settings = request.taxSettings
    
    if (settings.medicareExemption && !['none', 'half', 'full'].includes(settings.medicareExemption)) {
      validator.addError('validation', 'taxSettings.medicareExemption', 'Medicare exemption must be none, half, or full')
    }

    // hecsHelpRate removed – no validation
  }

  // Validate tax coefficients
  if (request.taxCoefficients) {
    request.taxCoefficients.forEach((coeff, index) => {
      const coeffValidator = ValidationResult.create()
      validateString(coeff.taxYear, 'taxYear', coeffValidator)
      validateString(coeff.scale, 'scale', coeffValidator)
      validateDecimal(coeff.earningsFrom, 'earningsFrom', coeffValidator, { min: 0 })
      validateDecimal(coeff.coefficientA, 'coefficientA', coeffValidator, { min: 0 })
      validateDecimal(coeff.coefficientB, 'coefficientB', coeffValidator, { min: 0 })

      if (coeff.earningsTo) {
        validateDecimal(coeff.earningsTo, 'earningsTo', coeffValidator, { min: 0 })
      }

      if (!coeffValidator.isValid()) {
        coeffValidator.getErrors().forEach(error => {
          validator.addError('validation', `taxCoefficients[${index}].${error.field}`, error.message)
        })
      }
    })
  }

  // HECS thresholds removed – no validation

  // Validate STSL rates
  if (request.stslRates) {
    request.stslRates.forEach((rate, index) => {
      const rateValidator = ValidationResult.create()
      validateString(rate.taxYear, 'taxYear', rateValidator)
      validateString(rate.scale, 'scale', rateValidator)
      validateDecimal(rate.earningsFrom, 'earningsFrom', rateValidator, { min: 0 })
      validateDecimal(rate.coefficientA, 'coefficientA', rateValidator, { min: 0 })
      validateDecimal(rate.coefficientB, 'coefficientB', rateValidator, { min: 0 })

      if (rate.earningsTo) {
        validateDecimal(rate.earningsTo, 'earningsTo', rateValidator, { min: 0 })
      }

      if (!rateValidator.isValid()) {
        rateValidator.getErrors().forEach(error => {
          validator.addError('validation', `stslRates[${index}].${error.field}`, error.message)
        })
      }
    })
  }

  // Validate tax rate configs
  if (request.taxRateConfigs) {
    request.taxRateConfigs.forEach((config, index) => {
      const configValidator = ValidationResult.create()
      validateString(config.taxYear, 'taxYear', configValidator)
      if (!configValidator.isValid()) {
        configValidator.getErrors().forEach(error => {
          validator.addError('validation', `taxRateConfigs[${index}].${error.field}`, error.message)
        })
      }
    })
  }

  return validator
}

async function checkShiftConflicts(shifts: ImportShiftsRequest['shifts'], validator: ImportValidator) {
  // Check for conflicts with existing shifts
  for (let i = 0; i < shifts.length; i++) {
    const shift = shifts[i]
    const startTime = new Date(shift.startTime)
    const endTime = new Date(shift.endTime)

    const overlappingShifts = await prisma.shift.findMany({
      where: {
        OR: [
          {
            startTime: { lte: startTime },
            endTime: { gte: startTime }
          },
          {
            startTime: { lte: endTime },
            endTime: { gte: endTime }
          },
          {
            startTime: { gte: startTime },
            endTime: { lte: endTime }
          }
        ]
      },
      select: { id: true, startTime: true, endTime: true }
    })

    if (overlappingShifts.length > 0) {
      overlappingShifts.forEach(existing => {
        validator.addWarning(
          'conflict',
          'timeRange',
          `Shift overlaps with existing shift from ${existing.startTime.toISOString()} to ${existing.endTime.toISOString()}`,
          i,
          existing.id
        )
      })
    }
  }
}

export function generateRenameSuggestion(baseName: string, existingNames: Set<string>): string {
  let counter = 1
  let suggestion = `${baseName} (imported)`
  
  while (existingNames.has(suggestion)) {
    counter++
    suggestion = `${baseName} (imported ${counter})`
  }
  
  return suggestion
}
