import { ValidationError } from '@/types'
import { Decimal } from 'decimal.js'

export class ValidationResult {
  private errors: ValidationError[] = []

  addError(field: string, message: string) {
    this.errors.push({ field, message })
    return this
  }

  isValid() {
    return this.errors.length === 0
  }

  getErrors() {
    return this.errors
  }

  static create() {
    return new ValidationResult()
  }
}

export const validateRequired = (value: any, field: string, validator: ValidationResult) => {
  if (value === undefined || value === null || value === '') {
    validator.addError(field, `${field} is required`)
    return false
  }
  return true
}

export const validateBoolean = (value: any, field: string, validator: ValidationResult) => {
  if (typeof value !== 'boolean') {
    validator.addError(field, `${field} must be a boolean`)
    return false
  }
  return true
}

export const validateString = (
  value: any,
  field: string,
  validator: ValidationResult,
  options?: {
    minLength?: number
    maxLength?: number
    pattern?: RegExp
    required?: boolean
  }
) => {
  const isRequired = options?.required ?? true
  const isEmpty = value === undefined || value === null || value === ''

  if (!isRequired && isEmpty) {
    return true
  }

  if (!validateRequired(value, field, validator)) return false

  if (typeof value !== 'string') {
    validator.addError(field, `${field} must be a string`)
    return false
  }

  if (options?.minLength && value.length < options.minLength) {
    validator.addError(field, `${field} must be at least ${options.minLength} characters`)
    return false
  }

  if (options?.maxLength && value.length > options.maxLength) {
    validator.addError(field, `${field} must be at most ${options.maxLength} characters`)
    return false
  }

  if (options?.pattern && !options.pattern.test(value)) {
    validator.addError(field, `${field} format is invalid`)
    return false
  }

  return true
}

export const validateNumber = (
  value: any,
  field: string,
  validator: ValidationResult,
  options?: {
    min?: number
    max?: number
    integer?: boolean
    required?: boolean
  }
) => {
  const isRequired = options?.required ?? true
  const isEmpty = value === undefined || value === null || value === ''

  if (!isRequired && isEmpty) {
    return true
  }

  if (!validateRequired(value, field, validator)) return false

  const num = Number(value)
  if (isNaN(num)) {
    validator.addError(field, `${field} must be a valid number`)
    return false
  }

  if (options?.integer && !Number.isInteger(num)) {
    validator.addError(field, `${field} must be an integer`)
    return false
  }

  if (options?.min !== undefined && num < options.min) {
    validator.addError(field, `${field} must be at least ${options.min}`)
    return false
  }

  if (options?.max !== undefined && num > options.max) {
    validator.addError(field, `${field} must be at most ${options.max}`)
    return false
  }

  return true
}

export const validateDecimal = (
  value: any,
  field: string,
  validator: ValidationResult,
  options?: {
    min?: Decimal.Value
    max?: Decimal.Value
    required?: boolean
  }
) => {
  const isRequired = options?.required ?? true
  const isEmpty = value === undefined || value === null || value === ''

  if (!isRequired && isEmpty) {
    return true
  }

  if (!validateRequired(value, field, validator)) return false

  let decimal: Decimal
  try {
    decimal = new Decimal(value)
  } catch (error) {
    validator.addError(field, `${field} must be a valid decimal number`)
    return false
  }

  if (options?.min !== undefined) {
    const min = options.min instanceof Decimal ? options.min : new Decimal(options.min)
    if (decimal.lessThan(min)) {
      validator.addError(field, `${field} must be at least ${min.toString()}`)
      return false
    }
  }

  if (options?.max !== undefined) {
    const max = options.max instanceof Decimal ? options.max : new Decimal(options.max)
    if (decimal.greaterThan(max)) {
      validator.addError(field, `${field} must be at most ${max.toString()}`)
      return false
    }
  }

  return true
}

export const validateDate = (value: any, field: string, validator: ValidationResult) => {
  if (!validateRequired(value, field, validator)) return false
  
  const date = new Date(value)
  if (isNaN(date.getTime())) {
    validator.addError(field, `${field} must be a valid date`)
    return false
  }

  return true
}

export const validateDateRange = (
  startDate: any, 
  endDate: any, 
  validator: ValidationResult,
  options?: { maxDurationHours?: number }
) => {
  if (!validateDate(startDate, 'startTime', validator)) return false
  if (!validateDate(endDate, 'endTime', validator)) return false

  const start = new Date(startDate)
  const end = new Date(endDate)

  if (end <= start) {
    validator.addError('endTime', 'End time must be after start time')
    return false
  }

  if (options?.maxDurationHours) {
    const durationMs = end.getTime() - start.getTime()
    const durationHours = durationMs / (1000 * 60 * 60)
    
    if (durationHours > options.maxDurationHours) {
      validator.addError('endTime', `Shift duration cannot exceed ${options.maxDurationHours} hours`)
      return false
    }
  }

  return true
}

export const validateUUID = (value: any, field: string, validator: ValidationResult) => {
  if (!validateRequired(value, field, validator)) return false
  
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  
  if (typeof value !== 'string' || !uuidPattern.test(value)) {
    validator.addError(field, `${field} must be a valid UUID`)
    return false
  }

  return true
}

export const validateCuid = (value: any, field: string, validator: ValidationResult) => {
  if (!validateRequired(value, field, validator)) return false
  
  // CUID format: c + timestamp (base36) + counter + machine fingerprint + random (base36)
  // Example: clp0h701x00009mp7yamopejd
  const cuidPattern = /^c[a-z0-9]{24}$/i
  
  if (typeof value !== 'string' || !cuidPattern.test(value)) {
    validator.addError(field, `${field} must be a valid ID`)
    return false
  }

  return true
}
