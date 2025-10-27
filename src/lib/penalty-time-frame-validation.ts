import { Decimal } from 'decimal.js'
import {
  ValidationResult,
  validateString,
  validateDecimal,
  validateNumber,
} from '@/lib/validation'
import { CreatePenaltyTimeFrameRequest, UpdatePenaltyTimeFrameRequest } from '@/types'

export const validateTimeString = (time: string, field: string, validator: ValidationResult): boolean => {
  if (!validateString(time, field, validator)) return false
  
  // Validate HH:MM format
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
  if (!timeRegex.test(time)) {
    validator.addError(field, `${field} must be in HH:MM format (24-hour)`)
    return false
  }
  
  return true
}

export const validateDayOfWeek = (dayOfWeek: number, field: string, validator: ValidationResult): boolean => {
  if (!validateNumber(dayOfWeek, field, validator, { min: 0, max: 6 })) return false
  
  if (!Number.isInteger(dayOfWeek)) {
    validator.addError(field, `${field} must be an integer between 0 (Sunday) and 6 (Saturday)`)
    return false
  }
  
  return true
}

export const validatePenaltyTimeFrameFields = (
  data: CreatePenaltyTimeFrameRequest | UpdatePenaltyTimeFrameRequest,
  validator: ValidationResult,
  isUpdate: boolean = false
): void => {
  // Name validation (required for create, optional for update)
  if (!isUpdate) {
    const name = (data as CreatePenaltyTimeFrameRequest).name
    validateString(name, 'name', validator, {
      minLength: 2,
      maxLength: 100,
    })
  } else if (data.name !== undefined) {
    validateString(data.name, 'name', validator, {
      minLength: 2,
      maxLength: 100,
    })
  }

  // Multiplier validation (required for create, optional for update)
  if (!isUpdate) {
    const multiplier = (data as CreatePenaltyTimeFrameRequest).multiplier
    validateDecimal(multiplier, 'multiplier', validator, {
      min: new Decimal('1.0'),
      max: new Decimal('5.0'),
    })
  } else if (data.multiplier !== undefined) {
    validateDecimal(data.multiplier, 'multiplier', validator, {
      min: new Decimal('1.0'),
      max: new Decimal('5.0'),
    })
  }

  // Day of week validation (optional for both)
  if (data.dayOfWeek !== undefined) {
    validateDayOfWeek(data.dayOfWeek, 'dayOfWeek', validator)
  }

  // Start time validation (optional for both)
  if (data.startTime !== undefined && data.startTime !== null) {
    validateTimeString(data.startTime, 'startTime', validator)
  }

  // End time validation (optional for both)
  if (data.endTime !== undefined && data.endTime !== null) {
    validateTimeString(data.endTime, 'endTime', validator)
  }

  // Cross-field validation for start/end time
  if (data.startTime && data.endTime) {
    const startTime = data.startTime.split(':').map(Number)
    const endTime = data.endTime.split(':').map(Number)
    const startMinutes = startTime[0] * 60 + startTime[1]
    const endMinutes = endTime[0] * 60 + endTime[1]
    
    // Allow overnight shifts (end time can be less than start time)
    // This is valid for things like "night shift" from 22:00 to 06:00
    // No validation error in this case
  }

  // Description validation (optional for both)
  if (data.description !== undefined && data.description !== null) {
    validateString(data.description, 'description', validator, {
      maxLength: 500,
    })
  }
}