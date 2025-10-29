import { Decimal } from 'decimal.js'
import {
  ValidationResult,
  validateString,
  validateDecimal,
  validateTimeString,
  validateDayOfWeek,
} from '@/lib/validation'
import { CreateOvertimeTimeFrameRequest, UpdateOvertimeTimeFrameRequest } from '@/types'

export const validateOvertimeTimeFrameFields = (
  data: CreateOvertimeTimeFrameRequest | UpdateOvertimeTimeFrameRequest,
  validator: ValidationResult,
  isUpdate: boolean = false
): void => {
  // Name validation (required for create, optional for update)
  if (!isUpdate) {
    const name = (data as CreateOvertimeTimeFrameRequest).name
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

  // First three hours multiplier validation (required for create, optional for update)
  if (!isUpdate) {
    const firstThreeHoursMult = (data as CreateOvertimeTimeFrameRequest).firstThreeHoursMult
    validateDecimal(firstThreeHoursMult, 'firstThreeHoursMult', validator, {
      min: new Decimal('1.0'),
      max: new Decimal('5.0'),
    })
  } else if (data.firstThreeHoursMult !== undefined) {
    validateDecimal(data.firstThreeHoursMult, 'firstThreeHoursMult', validator, {
      min: new Decimal('1.0'),
      max: new Decimal('5.0'),
    })
  }

  // After three hours multiplier validation (required for create, optional for update)
  if (!isUpdate) {
    const afterThreeHoursMult = (data as CreateOvertimeTimeFrameRequest).afterThreeHoursMult
    validateDecimal(afterThreeHoursMult, 'afterThreeHoursMult', validator, {
      min: new Decimal('1.0'),
      max: new Decimal('5.0'),
    })
  } else if (data.afterThreeHoursMult !== undefined) {
    validateDecimal(data.afterThreeHoursMult, 'afterThreeHoursMult', validator, {
      min: new Decimal('1.0'),
      max: new Decimal('5.0'),
    })
  }

  // Cross-field validation for multipliers
  if (data.firstThreeHoursMult !== undefined && data.afterThreeHoursMult !== undefined) {
    const first = new Decimal(data.firstThreeHoursMult)
    const after = new Decimal(data.afterThreeHoursMult)
    
    if (after.lessThan(first)) {
      validator.addError('afterThreeHoursMult', 'After three hours multiplier should typically be greater than or equal to first three hours multiplier')
    }
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
    // This is valid for overnight overtime rules
  }

  // Description validation (optional for both)
  if (data.description !== undefined && data.description !== null) {
    validateString(data.description, 'description', validator, {
      maxLength: 500,
    })
  }
}
