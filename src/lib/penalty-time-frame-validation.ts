import { Decimal } from 'decimal.js'
import {
  ValidationResult,
  validateString,
  validateDecimal,
  validateTimeString,
  validateDayOfWeek,
} from '@/lib/validation'
import { CreatePenaltyTimeFrameRequest, UpdatePenaltyTimeFrameRequest } from '@/types'

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
    // Allow overnight shifts (end time can be less than start time)
    // This is valid for things like "night shift" from 22:00 to 06:00
  }

  // Description validation (optional for both)
  if (data.description !== undefined && data.description !== null) {
    validateString(data.description, 'description', validator, {
      maxLength: 500,
    })
  }
}
