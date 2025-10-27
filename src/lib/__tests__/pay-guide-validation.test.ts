import { describe, it, expect } from 'vitest'
import { ValidationResult } from '@/lib/validation'
import {
  validatePayGuideFields,
  validateDateRange,
} from '@/lib/pay-guide-validation'
import { CreatePayGuideRequest, UpdatePayGuideRequest } from '@/types'

const createValidator = () => ValidationResult.create()

describe('pay-guide-validation', () => {
  it('passes validation for a fully populated create payload', () => {
    const validator = createValidator()
    const payload: CreatePayGuideRequest = {
      name: 'Retail Guide',
      baseRate: '29.95',
      description: 'Standard level 1 rates',
      effectiveFrom: '2024-01-01T00:00:00Z',
      effectiveTo: '2024-12-31T00:00:00Z',
      timezone: 'Australia/Sydney',
      minimumShiftHours: 3,
      maximumShiftHours: 9,
      isActive: true,
    }

    validatePayGuideFields(payload, validator, false)

    expect(validator.isValid()).toBe(true)
  })

  it('validates only provided fields during updates', () => {
    const validator = createValidator()
    const payload: UpdatePayGuideRequest = {
      timezone: 'Invalid/Timezone',
      minimumShiftHours: 6,
      maximumShiftHours: 4,
    }

    validatePayGuideFields(payload, validator, true)

    const errors = validator.getErrors()
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'timezone' }),
        expect.objectContaining({ field: 'maximumShiftHours' }),
      ])
    )
    expect(errors.find((err) => err.field === 'timezone')?.message).toContain('valid IANA timezone')
    expect(errors.find((err) => err.field === 'maximumShiftHours')?.message).toContain('greater than minimum shift hours')
  })

  it('validateDateRange flags end dates that are before the start', () => {
    const validator = createValidator()

    validateDateRange('2024-01-10T00:00:00Z', '2024-01-01T00:00:00Z', validator)

    expect(validator.isValid()).toBe(false)
    const error = validator.getErrors()[0]
    expect(error.field).toBe('effectiveTo')
    expect(error.message).toContain('after effective start date')
  })

  it('validateDateRange permits open-ended ranges', () => {
    const validator = createValidator()

    validateDateRange('2024-01-10T00:00:00Z', undefined, validator)

    expect(validator.isValid()).toBe(true)
  })
})

