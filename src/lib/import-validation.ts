import { prisma } from '@/lib/db'
import {
  ImportValidationError,
  ImportShiftsRequest,
  ImportPayGuidesRequest,
  ImportPayPeriodsRequest,
  ImportPreferencesRequest,
  ImportTaxDataRequest
} from '@/types'
import {
  ValidationResult,
  validateString,
  validateDecimal,
  validateDateRange,
  validateBoolean,
  validateDate,
  validateNumber
} from '@/lib/validation'

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

export async function validateShiftsImport(
  request: ImportShiftsRequest,
  context: { userId?: string } = {}
): Promise<ImportValidator> {
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

  const parsedShiftWindows: Array<{ index: number; start: Date; end: Date }> = []

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

    const isValid = fieldValidator.isValid()

    if (!isValid) {
      fieldValidator.getErrors().forEach(error => {
        validator.addError('validation', error.field, error.message, i)
      })
    } else {
      const start = new Date(shift.startTime)
      const end = new Date(shift.endTime)

      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
        parsedShiftWindows.push({ index: i, start, end })
      }
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
    await checkShiftConflicts(parsedShiftWindows, validator, context.userId)
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

export async function validatePayPeriodsImport(
  request: ImportPayPeriodsRequest,
  context: { userId?: string } = {}
): Promise<ImportValidator> {
  const validator = new ImportValidator()

  if (!Array.isArray(request.payPeriods)) {
    validator.addError('validation', 'payPeriods', 'Pay periods must be an array')
    return validator
  }

  if (request.payPeriods.length === 0) {
    validator.addError('validation', 'payPeriods', 'No pay periods provided for import')
    return validator
  }

  const candidateStartDates = new Set<string>()
  request.payPeriods.forEach(period => {
    if (typeof period.startDate !== 'string') return
    const parsed = new Date(period.startDate)
    if (!Number.isNaN(parsed.getTime())) {
      candidateStartDates.add(parsed.toISOString())
    }
  })

  let existingStartDates = new Set<string>()
  if (context.userId && candidateStartDates.size > 0) {
    const scopedExisting = await prisma.payPeriod.findMany({
      where: {
        userId: context.userId,
        startDate: {
          in: Array.from(candidateStartDates).map(dateIso => new Date(dateIso)),
        },
      },
      select: { startDate: true },
    })
    existingStartDates = new Set(
      scopedExisting.map(period => period.startDate.toISOString())
    )
  }
  const importStartDates = new Set<string>()

  for (let i = 0; i < request.payPeriods.length; i++) {
    const payPeriod = request.payPeriods[i]
    const fieldValidator = ValidationResult.create()

    const hasStart = validateString(payPeriod.startDate, 'startDate', fieldValidator)
    const hasEnd = validateString(payPeriod.endDate, 'endDate', fieldValidator)

    let normalizedStart: string | null = null

    if (hasStart) {
      if (!validateDate(payPeriod.startDate, 'startDate', fieldValidator)) {
        normalizedStart = null
      } else {
        normalizedStart = new Date(payPeriod.startDate).toISOString()
      }
    }

    if (hasEnd) {
      validateDate(payPeriod.endDate, 'endDate', fieldValidator)
    }

    if (hasStart && hasEnd && !fieldValidator.getErrors().some(error => error.field === 'startDate' || error.field === 'endDate')) {
      const start = new Date(payPeriod.startDate)
      const end = new Date(payPeriod.endDate)
      if (end <= start) {
        fieldValidator.addError('endDate', 'End date must be after start date')
      }
    }

    if (payPeriod.status !== 'pending' && payPeriod.status !== 'verified') {
      fieldValidator.addError('status', 'Status must be either "pending" or "verified"')
    }

    const decimalFields: Array<[keyof typeof payPeriod, string | undefined]> = [
      ['totalHours', payPeriod.totalHours],
      ['totalPay', payPeriod.totalPay],
      ['paygWithholding', payPeriod.paygWithholding],
      ['stslAmount', payPeriod.stslAmount],
      ['totalWithholdings', payPeriod.totalWithholdings],
      ['netPay', payPeriod.netPay],
      ['actualPay', payPeriod.actualPay]
    ]

    decimalFields.forEach(([field, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        validateDecimal(value, field as string, fieldValidator)
      }
    })

    if (!fieldValidator.isValid()) {
      fieldValidator.getErrors().forEach(error => {
        validator.addError('validation', `${error.field}`, error.message, i)
      })
    }

    if (normalizedStart) {
      if (importStartDates.has(normalizedStart)) {
        validator.addError('conflict', 'startDate', `Duplicate pay period starting on ${payPeriod.startDate} in import`, i, normalizedStart)
      } else {
        importStartDates.add(normalizedStart)
      }

      if (existingStartDates.has(normalizedStart)) {
        if (request.options.conflictResolution === 'skip' || request.options.conflictResolution === 'rename') {
          validator.addWarning('conflict', 'startDate', `Pay period starting on ${payPeriod.startDate} already exists and will be skipped`, i, normalizedStart)
        } else if (request.options.conflictResolution === 'overwrite') {
          validator.addWarning('conflict', 'startDate', `Pay period starting on ${payPeriod.startDate} already exists and will be overwritten`, i, normalizedStart)
        }
      }
    }
  }

  if (request.extras) {
    request.extras.forEach((extra, index) => {
      const extraValidator = ValidationResult.create()

      const hasPeriodStart = validateString(extra.periodStartDate, 'periodStartDate', extraValidator)
      if (hasPeriodStart) {
        validateDate(extra.periodStartDate, 'periodStartDate', extraValidator)
      }

      if (extra.periodEndDate) {
        validateDate(extra.periodEndDate, 'periodEndDate', extraValidator)
      }

      validateString(extra.type, 'type', extraValidator)

      if (extra.description && typeof extra.description !== 'string') {
        extraValidator.addError('description', 'Description must be a string')
      }

      validateDecimal(extra.amount, 'amount', extraValidator)
      validateBoolean(extra.taxable, 'taxable', extraValidator)

      if (!extraValidator.isValid()) {
        extraValidator.getErrors().forEach(error => {
          validator.addError('validation', `extras.${error.field}`, error.message, index)
        })
      }

      if (hasPeriodStart && !extraValidator.getErrors().some(error => error.field === 'periodStartDate')) {
        const normalizedStart = new Date(extra.periodStartDate).toISOString()
        if (!importStartDates.has(normalizedStart) && !existingStartDates.has(normalizedStart)) {
          validator.addWarning('dependency', 'extras', `No matching pay period found for extra on ${extra.periodStartDate}`, index, normalizedStart)
        }
      }
    })
  }

  return validator
}

export async function validatePreferencesImport(request: ImportPreferencesRequest): Promise<ImportValidator> {
  const validator = new ImportValidator()

  if (request.user) {
    const fieldValidator = ValidationResult.create()

    if (request.user.name !== undefined) {
      validateString(request.user.name, 'name', fieldValidator, { minLength: 2, maxLength: 200 })
    }

    if (request.user.email !== undefined) {
      validateString(request.user.email, 'email', fieldValidator, { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ })
    }

    if (request.user.timezone !== undefined && typeof request.user.timezone !== 'string') {
      fieldValidator.addError('timezone', 'Timezone must be a string')
    }

    if (request.user.payPeriodType !== undefined) {
      const ok = ['WEEKLY', 'FORTNIGHTLY', 'MONTHLY'].includes(request.user.payPeriodType)
      if (!ok) fieldValidator.addError('payPeriodType', 'Must be WEEKLY, FORTNIGHTLY, or MONTHLY')
    }

    if (request.user.defaultShiftLengthMinutes !== undefined) {
      validateNumber(request.user.defaultShiftLengthMinutes, 'defaultShiftLengthMinutes', fieldValidator, {
        min: 15,
        max: 24 * 60,
        integer: true
      })

      if (request.user.defaultShiftLengthMinutes % 15 !== 0) {
        fieldValidator.addError('defaultShiftLengthMinutes', 'Must be in 15 minute increments')
      }
    }

    if (!fieldValidator.isValid()) {
      fieldValidator.getErrors().forEach(error => {
        validator.addError('validation', error.field, error.message)
      })
    }
  }

  if (request.defaultExtras) {
    request.defaultExtras.forEach((extra, index) => {
      const extraValidator = ValidationResult.create()

      validateString(extra.label, 'label', extraValidator, { minLength: 1, maxLength: 200 })

      if (extra.description !== undefined && extra.description !== null && typeof extra.description !== 'string') {
        extraValidator.addError('description', 'Description must be a string')
      }

      validateDecimal(extra.amount, 'amount', extraValidator)
      validateBoolean(extra.taxable, 'taxable', extraValidator)

      if (extra.active !== undefined) {
        validateBoolean(extra.active, 'active', extraValidator)
      }

      if (extra.sortOrder !== undefined) {
        validateNumber(extra.sortOrder, 'sortOrder', extraValidator, { integer: true })
      }

      if (!extraValidator.isValid()) {
        extraValidator.getErrors().forEach(error => {
          validator.addError('validation', `defaultExtras.${error.field}`, error.message, index)
        })
      }
    })
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

async function checkShiftConflicts(
  parsedShifts: Array<{ index: number; start: Date; end: Date }>,
  validator: ImportValidator,
  userId?: string
) {
  if (!userId || parsedShifts.length === 0) {
    return
  }

  const minStart = new Date(Math.min(...parsedShifts.map(s => s.start.getTime())))
  const maxEnd = new Date(Math.max(...parsedShifts.map(s => s.end.getTime())))

  const existingShifts = await prisma.shift.findMany({
    where: {
      userId,
      startTime: { lt: maxEnd },
      endTime: { gt: minStart },
    },
    select: { id: true, startTime: true, endTime: true },
  })

  if (existingShifts.length === 0) {
    return
  }

  for (const parsed of parsedShifts) {
    for (const existing of existingShifts) {
      const overlaps = parsed.start < existing.endTime && parsed.end > existing.startTime
      if (!overlaps) continue

      validator.addWarning(
        'conflict',
        'timeRange',
        `Shift overlaps with existing shift from ${existing.startTime.toISOString()} to ${existing.endTime.toISOString()}`,
        parsed.index,
        existing.id
      )
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
