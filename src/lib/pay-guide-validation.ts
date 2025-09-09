import { Decimal } from 'decimal.js'
import {
  ValidationResult,
  validateString,
  validateDecimal,
  validateDate,
  validateNumber,
} from '@/lib/validation'
import { CreatePayGuideRequest, UpdatePayGuideRequest, PayGuideResponse } from '@/types'

export const validateTimezone = (timezone: string, field: string, validator: ValidationResult): boolean => {
  if (!validateString(timezone, field, validator)) return false
  
  try {
    // Test if timezone is valid by trying to create a DateTimeFormat
    new Intl.DateTimeFormat('en-US', { timeZone: timezone })
    return true
  } catch {
    validator.addError(field, `${field} must be a valid IANA timezone identifier`)
    return false
  }
}

export const validatePayGuideFields = (
  data: CreatePayGuideRequest | UpdatePayGuideRequest,
  validator: ValidationResult,
  isUpdate: boolean = false
): void => {
  // Name validation (required for create, optional for update)
  if (!isUpdate) {
    // For CREATE: always validate (required)
    const name = (data as CreatePayGuideRequest).name
    validateString(name, 'name', validator, {
      minLength: 3,
      maxLength: 200,
    })
  } else if (data.name !== undefined) {
    // For UPDATE: only validate if present
    validateString(data.name, 'name', validator, {
      minLength: 3,
      maxLength: 200,
    })
  }

  // Base rate validation (required for create, optional for update)
  if (!isUpdate) {
    // For CREATE: always validate (required)
    const baseRate = (data as CreatePayGuideRequest).baseRate
    validateDecimal(baseRate, 'baseRate', validator, {
      min: new Decimal('0.01'),
      max: new Decimal('1000.00'),
    })
  } else if (data.baseRate !== undefined) {
    // For UPDATE: only validate if present
    validateDecimal(data.baseRate, 'baseRate', validator, {
      min: new Decimal('0.01'),
      max: new Decimal('1000.00'),
    })
  }

  // Effective from validation (required for create, optional for update)
  if (!isUpdate) {
    // For CREATE: always validate (required)
    const effectiveFrom = (data as CreatePayGuideRequest).effectiveFrom
    validateDate(effectiveFrom, 'effectiveFrom', validator)
  } else if (data.effectiveFrom !== undefined) {
    // For UPDATE: only validate if present
    validateDate(data.effectiveFrom, 'effectiveFrom', validator)
  }

  // Effective to validation (optional for both)
  if (data.effectiveTo !== undefined) {
    validateDate(data.effectiveTo, 'effectiveTo', validator)
  }

  // Description validation (optional for both)
  if (data.description !== undefined) {
    validateString(data.description, 'description', validator, {
      maxLength: 500,
    })
  }

  // Timezone validation (required for create, optional for update)
  if (!isUpdate) {
    // For CREATE: always validate (required)
    const timezone = (data as CreatePayGuideRequest).timezone
    validateTimezone(timezone, 'timezone', validator)
  } else if (data.timezone !== undefined) {
    // For UPDATE: only validate if present
    validateTimezone(data.timezone, 'timezone', validator)
  }

  // Minimum shift hours validation (optional for both)
  if (data.minimumShiftHours !== undefined) {
    validateNumber(data.minimumShiftHours, 'minimumShiftHours', validator, {
      min: 0.5,
      max: 24,
    })
  }

  // Maximum shift hours validation (optional for both)
  if (data.maximumShiftHours !== undefined) {
    validateNumber(data.maximumShiftHours, 'maximumShiftHours', validator, {
      min: 1,
      max: 24,
    })
  }

  // Cross-field validation for shift hours
  if (data.minimumShiftHours !== undefined && data.maximumShiftHours !== undefined) {
    if (data.minimumShiftHours >= data.maximumShiftHours) {
      validator.addError('maximumShiftHours', 'Maximum shift hours must be greater than minimum shift hours')
    }
  }
}

export const validateDateRange = (
  effectiveFrom: string | Date,
  effectiveTo: string | Date | null | undefined,
  validator: ValidationResult
): void => {
  if (effectiveTo !== undefined && effectiveTo !== null) {
    const fromDate = new Date(effectiveFrom)
    const toDate = new Date(effectiveTo)
    
    if (toDate <= fromDate) {
      validator.addError('effectiveTo', 'Effective end date must be after effective start date')
    }
  }
}

export const transformPayGuideToResponse = (payGuide: any): PayGuideResponse => {
  return {
    id: payGuide.id,
    name: payGuide.name,
    baseRate: payGuide.baseRate.toString(),
    minimumShiftHours: payGuide.minimumShiftHours,
    maximumShiftHours: payGuide.maximumShiftHours,
    description: payGuide.description,
    effectiveFrom: payGuide.effectiveFrom,
    effectiveTo: payGuide.effectiveTo,
    timezone: payGuide.timezone,
    isActive: payGuide.isActive,
    createdAt: payGuide.createdAt,
    updatedAt: payGuide.updatedAt,
  }
}