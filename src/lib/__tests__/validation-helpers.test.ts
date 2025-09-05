/**
 * Blackbox ValidationHelpers Tests
 *
 * These tests verify the ValidationHelpers from a user perspective without knowledge
 * of internal implementation. Tests focus on inputs, outputs, and expected behavior
 * for various validation scenarios in Australian employment contexts.
 */

import { describe, it, expect } from 'vitest'
import { Decimal } from 'decimal.js'
import { ValidationHelpers } from '@/lib/calculations/validation-helpers'
import { PayGuide, BreakPeriod } from '@/types'

describe('ValidationHelpers', () => {
  describe('validatePositiveValue', () => {
    it('passes validation for positive numbers', () => {
      expect(() => {
        ValidationHelpers.validatePositiveValue(5, 'Test field')
      }).not.toThrow()

      expect(() => {
        ValidationHelpers.validatePositiveValue(0.5, 'Test field')
      }).not.toThrow()
    })

    it('passes validation for zero', () => {
      expect(() => {
        ValidationHelpers.validatePositiveValue(0, 'Test field')
      }).not.toThrow()
    })

    it('passes validation for undefined values', () => {
      expect(() => {
        ValidationHelpers.validatePositiveValue(undefined, 'Test field')
      }).not.toThrow()
    })

    it('throws error for negative numbers', () => {
      expect(() => {
        ValidationHelpers.validatePositiveValue(-1, 'Test field')
      }).toThrow('Test field cannot be negative')

      expect(() => {
        ValidationHelpers.validatePositiveValue(-0.1, 'Hours worked')
      }).toThrow('Hours worked cannot be negative')
    })

    it('uses field name in error message', () => {
      expect(() => {
        ValidationHelpers.validatePositiveValue(-5, 'Overtime hours')
      }).toThrow('Overtime hours cannot be negative')
    })
  })

  describe('validatePositiveDecimal', () => {
    it('passes validation for positive decimals', () => {
      expect(() => {
        ValidationHelpers.validatePositiveDecimal(new Decimal('10.50'), 'Pay rate')
      }).not.toThrow()

      expect(() => {
        ValidationHelpers.validatePositiveDecimal(new Decimal('0.01'), 'Minimum amount')
      }).not.toThrow()
    })

    it('throws error for zero', () => {
      expect(() => {
        ValidationHelpers.validatePositiveDecimal(new Decimal('0'), 'Base rate')
      }).toThrow('Base rate must be greater than zero')
    })

    it('throws error for negative decimals', () => {
      expect(() => {
        ValidationHelpers.validatePositiveDecimal(new Decimal('-10.50'), 'Pay amount')
      }).toThrow('Pay amount must be greater than zero')
    })

    it('uses field name in error message', () => {
      expect(() => {
        ValidationHelpers.validatePositiveDecimal(new Decimal('-1'), 'Hourly rate')
      }).toThrow('Hourly rate must be greater than zero')
    })

    it('handles very small positive decimals', () => {
      expect(() => {
        ValidationHelpers.validatePositiveDecimal(new Decimal('0.001'), 'Small amount')
      }).not.toThrow()
    })
  })

  describe('validateRange', () => {
    it('passes validation when min is less than max', () => {
      expect(() => {
        ValidationHelpers.validateRange(3, 8, 'Minimum hours', 'maximum hours')
      }).not.toThrow()
    })

    it('passes validation when min equals max', () => {
      expect(() => {
        ValidationHelpers.validateRange(5, 5, 'Minimum hours', 'maximum hours')
      }).not.toThrow()
    })

    it('passes validation when min is undefined', () => {
      expect(() => {
        ValidationHelpers.validateRange(undefined, 8, 'Minimum hours', 'maximum hours')
      }).not.toThrow()
    })

    it('passes validation when max is undefined', () => {
      expect(() => {
        ValidationHelpers.validateRange(3, undefined, 'Minimum hours', 'maximum hours')
      }).not.toThrow()
    })

    it('passes validation when both are undefined', () => {
      expect(() => {
        ValidationHelpers.validateRange(undefined, undefined, 'Minimum hours', 'maximum hours')
      }).not.toThrow()
    })

    it('throws error when min exceeds max', () => {
      expect(() => {
        ValidationHelpers.validateRange(10, 5, 'Minimum hours', 'maximum hours')
      }).toThrow('Minimum hours cannot exceed maximum hours')
    })

    it('uses field names in error message', () => {
      expect(() => {
        ValidationHelpers.validateRange(15, 10, 'Minimum shift length', 'maximum shift length')
      }).toThrow('Minimum shift length cannot exceed maximum shift length')
    })

    it('handles decimal comparisons', () => {
      expect(() => {
        ValidationHelpers.validateRange(5.5, 5.4, 'Min rate', 'max rate')
      }).toThrow('Min rate cannot exceed max rate')
    })
  })

  describe('validatePayGuide', () => {
    const validPayGuide: PayGuide = {
      id: 'ma000004-retail-award-2025',
      name: 'General Retail Industry Award 2020',
      baseRate: new Decimal('26.55'),
      minimumShiftHours: 3,
      maximumShiftHours: 8,
      description: 'Level 1 adult rates under MA000004',
      effectiveFrom: new Date('2025-07-01'),
      timezone: 'Australia/Brisbane',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    it('passes validation for valid pay guide', () => {
      expect(() => {
        ValidationHelpers.validatePayGuide(validPayGuide)
      }).not.toThrow()
    })

    it('throws error for zero base rate', () => {
      const invalidPayGuide = {
        ...validPayGuide,
        baseRate: new Decimal('0')
      }

      expect(() => {
        ValidationHelpers.validatePayGuide(invalidPayGuide)
      }).toThrow('Base rate must be greater than zero')
    })

    it('throws error for negative base rate', () => {
      const invalidPayGuide = {
        ...validPayGuide,
        baseRate: new Decimal('-10.50')
      }

      expect(() => {
        ValidationHelpers.validatePayGuide(invalidPayGuide)
      }).toThrow('Base rate must be greater than zero')
    })

    it('throws error for negative minimum shift hours', () => {
      const invalidPayGuide = {
        ...validPayGuide,
        minimumShiftHours: -2
      }

      expect(() => {
        ValidationHelpers.validatePayGuide(invalidPayGuide)
      }).toThrow('Minimum shift hours cannot be negative')
    })

    it('throws error for negative maximum shift hours', () => {
      const invalidPayGuide = {
        ...validPayGuide,
        maximumShiftHours: -5
      }

      expect(() => {
        ValidationHelpers.validatePayGuide(invalidPayGuide)
      }).toThrow('Maximum shift hours cannot be negative')
    })

    it('throws error when minimum exceeds maximum shift hours', () => {
      const invalidPayGuide = {
        ...validPayGuide,
        minimumShiftHours: 10,
        maximumShiftHours: 5
      }

      expect(() => {
        ValidationHelpers.validatePayGuide(invalidPayGuide)
      }).toThrow('Minimum shift hours cannot exceed maximum shift hours')
    })

    it('allows undefined minimum and maximum shift hours', () => {
      const payGuideWithUndefined = {
        ...validPayGuide,
        minimumShiftHours: undefined,
        maximumShiftHours: undefined
      }

      expect(() => {
        ValidationHelpers.validatePayGuide(payGuideWithUndefined)
      }).not.toThrow()
    })

    it('allows equal minimum and maximum shift hours', () => {
      const payGuideEqual = {
        ...validPayGuide,
        minimumShiftHours: 8,
        maximumShiftHours: 8
      }

      expect(() => {
        ValidationHelpers.validatePayGuide(payGuideEqual)
      }).not.toThrow()
    })
  })

  describe('validateShiftTimes', () => {
    const startTime = new Date('2024-01-15T09:00:00.000Z')
    const endTime = new Date('2024-01-15T17:00:00.000Z')

    it('passes validation for valid shift without breaks', () => {
      expect(() => {
        ValidationHelpers.validateShiftTimes(startTime, endTime, [])
      }).not.toThrow()
    })

    it('passes validation for valid shift with breaks', () => {
      const breakPeriods: BreakPeriod[] = [
        {
          id: 'lunch-break',
          shiftId: 'shift-123',
          startTime: new Date('2024-01-15T12:00:00.000Z'),
          endTime: new Date('2024-01-15T13:00:00.000Z'),
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'afternoon-break',
          shiftId: 'shift-123',
          startTime: new Date('2024-01-15T15:00:00.000Z'),
          endTime: new Date('2024-01-15T15:15:00.000Z'),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      expect(() => {
        ValidationHelpers.validateShiftTimes(startTime, endTime, breakPeriods)
      }).not.toThrow()
    })

    it('throws error when start and end times are equal', () => {
      const sameTime = new Date('2024-01-15T09:00:00.000Z')
      
      expect(() => {
        ValidationHelpers.validateShiftTimes(sameTime, sameTime, [])
      }).toThrow('Shift must be at least 1 minute long')
    })

    it('throws error when end time is before start time', () => {
      const laterStart = new Date('2024-01-15T18:00:00.000Z')
      const earlierEnd = new Date('2024-01-15T09:00:00.000Z')

      expect(() => {
        ValidationHelpers.validateShiftTimes(laterStart, earlierEnd, [])
      }).toThrow('End time must be after start time')
    })

    it('throws error when break end time is before or equal to break start time', () => {
      const invalidBreaks: BreakPeriod[] = [{
        id: 'invalid-break',
        shiftId: 'shift-123',
        startTime: new Date('2024-01-15T13:00:00.000Z'),
        endTime: new Date('2024-01-15T12:00:00.000Z'), // End before start
        isUnpaid: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }]

      expect(() => {
        ValidationHelpers.validateShiftTimes(startTime, endTime, invalidBreaks)
      }).toThrow('Break end time must be after break start time')
    })

    it('throws error when break starts before shift start', () => {
      const invalidBreaks: BreakPeriod[] = [{
        id: 'early-break',
        shiftId: 'shift-123',
        startTime: new Date('2024-01-15T08:00:00.000Z'), // Before shift start
        endTime: new Date('2024-01-15T08:15:00.000Z'),
        isUnpaid: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }]

      expect(() => {
        ValidationHelpers.validateShiftTimes(startTime, endTime, invalidBreaks)
      }).toThrow('Break periods must be within shift duration')
    })

    it('throws error when break ends after shift end', () => {
      const invalidBreaks: BreakPeriod[] = [{
        id: 'late-break',
        shiftId: 'shift-123',
        startTime: new Date('2024-01-15T16:45:00.000Z'),
        endTime: new Date('2024-01-15T18:00:00.000Z'), // After shift end
        isUnpaid: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }]

      expect(() => {
        ValidationHelpers.validateShiftTimes(startTime, endTime, invalidBreaks)
      }).toThrow('Break periods must be within shift duration')
    })

    it('throws error when total break time equals shift duration', () => {
      const entireShiftBreak: BreakPeriod[] = [{
        id: 'full-shift-break',
        shiftId: 'shift-123',
        startTime: startTime,
        endTime: endTime,
        isUnpaid: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }]

      expect(() => {
        ValidationHelpers.validateShiftTimes(startTime, endTime, entireShiftBreak)
      }).toThrow('Total break time cannot exceed shift duration')
    })

    it('throws error when total break time exceeds shift duration', () => {
      const excessiveBreaks: BreakPeriod[] = [
        {
          id: 'break-1',
          shiftId: 'shift-123',
          startTime: new Date('2024-01-15T09:00:00.000Z'),
          endTime: new Date('2024-01-15T14:00:00.000Z'), // 5 hours
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'break-2',
          shiftId: 'shift-123',
          startTime: new Date('2024-01-15T14:00:00.000Z'),
          endTime: new Date('2024-01-15T17:00:00.000Z'), // 3 hours (total 8 hours breaks equals 8 hour shift)
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      expect(() => {
        ValidationHelpers.validateShiftTimes(startTime, endTime, excessiveBreaks)
      }).toThrow('Total break time cannot exceed shift duration')
    })

    it('validates multiple break periods within acceptable limits', () => {
      const reasonableBreaks: BreakPeriod[] = [
        {
          id: 'morning-break',
          shiftId: 'shift-123',
          startTime: new Date('2024-01-15T10:30:00.000Z'),
          endTime: new Date('2024-01-15T10:45:00.000Z'), // 15 minutes
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'lunch-break',
          shiftId: 'shift-123',
          startTime: new Date('2024-01-15T12:30:00.000Z'),
          endTime: new Date('2024-01-15T13:30:00.000Z'), // 60 minutes
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'afternoon-break',
          shiftId: 'shift-123',
          startTime: new Date('2024-01-15T15:00:00.000Z'),
          endTime: new Date('2024-01-15T15:10:00.000Z'), // 10 minutes
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      // Total breaks: 85 minutes in 480 minute shift (acceptable)
      expect(() => {
        ValidationHelpers.validateShiftTimes(startTime, endTime, reasonableBreaks)
      }).not.toThrow()
    })

    it('allows breaks that exactly touch shift boundaries', () => {
      const boundaryBreaks: BreakPeriod[] = [
        {
          id: 'start-break',
          shiftId: 'shift-123',
          startTime: startTime, // Exactly at shift start
          endTime: new Date('2024-01-15T09:15:00.000Z'),
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'end-break',
          shiftId: 'shift-123',
          startTime: new Date('2024-01-15T16:45:00.000Z'),
          endTime: endTime, // Exactly at shift end
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      expect(() => {
        ValidationHelpers.validateShiftTimes(startTime, endTime, boundaryBreaks)
      }).not.toThrow()
    })
  })
})