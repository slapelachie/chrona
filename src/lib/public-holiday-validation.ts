import {
  ValidationResult,
  validateString,
  validateDate,
} from '@/lib/validation'
import { CreatePublicHolidayRequest, UpdatePublicHolidayRequest } from '@/types'

export const validatePublicHolidayFields = (
  data: CreatePublicHolidayRequest | UpdatePublicHolidayRequest,
  validator: ValidationResult,
  isUpdate: boolean = false
): void => {
  // Name validation (required for create, optional for update)
  if (!isUpdate) {
    const name = (data as CreatePublicHolidayRequest).name
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

  // Date validation (required for create, optional for update)
  if (!isUpdate) {
    const date = (data as CreatePublicHolidayRequest).date
    validateDate(date, 'date', validator)
    
    // Additional validation - ensure date is not in the past (optional business rule)
    // Commented out as it might be valid to add historical holidays
    /*
    const holidayDate = new Date(date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    if (holidayDate < today) {
      validator.addError('date', 'Public holiday date cannot be in the past')
    }
    */
  } else if (data.date !== undefined) {
    validateDate(data.date, 'date', validator)
  }
}