/**
 * Blackbox TimeCalculations Tests
 *
 * These tests verify the TimeCalculations from a user perspective without knowledge
 * of internal implementation. Tests focus on inputs, outputs, and expected behavior
 * for various time calculation scenarios in Australian employment contexts.
 */

import { describe, it, expect } from 'vitest'
import { Decimal } from 'decimal.js'
import { addHours } from 'date-fns'
import { TimeCalculations } from '@/lib/calculations/time-calculations'
import { BreakPeriod, PayGuide } from '@/types'

describe('TimeCalculations', () => {
  describe('calculateWorkedHours', () => {
    it('calculates worked hours without breaks', () => {
      const startTime = new Date('2024-01-15T09:00:00.000Z')
      const endTime = new Date('2024-01-15T17:00:00.000Z')
      const breakPeriods: BreakPeriod[] = []

      const result = TimeCalculations.calculateWorkedHours(
        startTime,
        endTime,
        breakPeriods
      )

      expect(result.totalHours.toNumber()).toBe(8)
      expect(result.workedMinutes).toBe(480)
      expect(result.breakMinutes).toBe(0)
    })

    it('calculates worked hours with unpaid lunch break', () => {
      const startTime = new Date('2024-01-15T09:00:00.000Z')
      const endTime = new Date('2024-01-15T17:00:00.000Z')
      const breakPeriods: BreakPeriod[] = [
        {
          id: 'lunch-break',
          shiftId: 'shift-123',
          startTime: new Date('2024-01-15T12:00:00.000Z'),
          endTime: new Date('2024-01-15T13:00:00.000Z'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      const result = TimeCalculations.calculateWorkedHours(
        startTime,
        endTime,
        breakPeriods
      )

      expect(result.totalHours.toNumber()).toBe(7)
      expect(result.workedMinutes).toBe(420)
      expect(result.breakMinutes).toBe(60)
    })

    it('calculates worked hours with multiple breaks', () => {
      const startTime = new Date('2024-01-15T09:00:00.000Z')
      const endTime = new Date('2024-01-15T17:00:00.000Z')
      const breakPeriods: BreakPeriod[] = [
        {
          id: 'morning-break',
          shiftId: 'shift-123',
          startTime: new Date('2024-01-15T10:30:00.000Z'),
          endTime: new Date('2024-01-15T10:45:00.000Z'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'lunch-break',
          shiftId: 'shift-123',
          startTime: new Date('2024-01-15T12:30:00.000Z'),
          endTime: new Date('2024-01-15T13:30:00.000Z'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'afternoon-break',
          shiftId: 'shift-123',
          startTime: new Date('2024-01-15T15:00:00.000Z'),
          endTime: new Date('2024-01-15T15:10:00.000Z'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      const result = TimeCalculations.calculateWorkedHours(
        startTime,
        endTime,
        breakPeriods
      )

      expect(result.totalHours.toFixed(2)).toStrictEqual('6.58') // 8 hours - 1.42 hours breaks (85 minutes)
      expect(result.workedMinutes).toBe(395)
      expect(result.breakMinutes).toBe(85)
    })

    it('handles fractional hours correctly', () => {
      const startTime = new Date('2024-01-15T09:15:00.000Z')
      const endTime = new Date('2024-01-15T16:45:00.000Z')
      const breakPeriods: BreakPeriod[] = [
        {
          id: 'lunch-break',
          shiftId: 'shift-123',
          startTime: new Date('2024-01-15T12:00:00.000Z'),
          endTime: new Date('2024-01-15T12:30:00.000Z'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      const result = TimeCalculations.calculateWorkedHours(
        startTime,
        endTime,
        breakPeriods
      )

      expect(result.totalHours.toNumber()).toBe(7) // 7.5 hours - 0.5 hours break
      expect(result.workedMinutes).toBe(420)
      expect(result.breakMinutes).toBe(30)
    })

    it('ensures minimum 0 worked minutes when breaks exceed total time', () => {
      const startTime = new Date('2024-01-15T09:00:00.000Z')
      const endTime = new Date('2024-01-15T10:00:00.000Z')
      const breakPeriods: BreakPeriod[] = [
        {
          id: 'long-break',
          shiftId: 'shift-123',
          startTime: new Date('2024-01-15T08:30:00.000Z'),
          endTime: new Date('2024-01-15T10:30:00.000Z'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      const result = TimeCalculations.calculateWorkedHours(
        startTime,
        endTime,
        breakPeriods
      )

      expect(result.totalHours.toNumber()).toBe(0)
      expect(result.workedMinutes).toBe(0)
      expect(result.breakMinutes).toBe(120) // Full break duration regardless of overlap
    })
  })

  describe('calculateOvertimeHours', () => {
    it('calculates overtime when worked hours exceed maximum', () => {
      const totalWorkedHours = new Decimal(10)
      const maximumHours = 8

      const result = TimeCalculations.calculateOvertimeHours(
        totalWorkedHours,
        maximumHours
      )

      expect(result.overtimeHours.toNumber()).toBe(2)
      expect(result.regularHours.toNumber()).toBe(8)
    })

    it('returns zero overtime when worked hours equal maximum', () => {
      const totalWorkedHours = new Decimal(8)
      const maximumHours = 8

      const result = TimeCalculations.calculateOvertimeHours(
        totalWorkedHours,
        maximumHours
      )

      expect(result.overtimeHours.toNumber()).toBe(0)
      expect(result.regularHours.toNumber()).toBe(8)
    })

    it('returns zero overtime when worked hours are less than maximum', () => {
      const totalWorkedHours = new Decimal(6.5)
      const maximumHours = 8

      const result = TimeCalculations.calculateOvertimeHours(
        totalWorkedHours,
        maximumHours
      )

      expect(result.overtimeHours.toNumber()).toBe(0)
      expect(result.regularHours.toNumber()).toBe(6.5)
    })

    it('handles fractional overtime hours', () => {
      const totalWorkedHours = new Decimal(8.75)
      const maximumHours = 8

      const result = TimeCalculations.calculateOvertimeHours(
        totalWorkedHours,
        maximumHours
      )

      expect(result.overtimeHours.toNumber()).toBe(0.75)
      expect(result.regularHours.toNumber()).toBe(8)
    })

    it('handles decimal precision correctly', () => {
      const totalWorkedHours = new Decimal('10.33')
      const maximumHours = 8

      const result = TimeCalculations.calculateOvertimeHours(
        totalWorkedHours,
        maximumHours
      )

      expect(result.overtimeHours.toString()).toBe('2.33')
      expect(result.regularHours.toString()).toBe('8')
    })
  })

  describe('adjustEndTimeForMinimumShift', () => {
    const payGuide: PayGuide = {
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
      updatedAt: new Date(),
    }

    it('extends end time when shift is shorter than minimum', () => {
      const startTime = new Date('2024-01-15T09:00:00.000Z')
      const endTime = new Date('2024-01-15T10:30:00.000Z') // 1.5 hours

      const result = TimeCalculations.adjustEndTimeForMinimumShift(
        startTime,
        endTime,
        payGuide
      )
      const expectedEndTime = addHours(startTime, 3)

      expect(result).toEqual(expectedEndTime)
    })

    it('keeps original end time when shift meets minimum', () => {
      const startTime = new Date('2024-01-15T09:00:00.000Z')
      const endTime = new Date('2024-01-15T12:00:00.000Z') // 3 hours

      const result = TimeCalculations.adjustEndTimeForMinimumShift(
        startTime,
        endTime,
        payGuide
      )

      expect(result).toEqual(endTime)
    })

    it('keeps original end time when shift exceeds minimum', () => {
      const startTime = new Date('2024-01-15T09:00:00.000Z')
      const endTime = new Date('2024-01-15T17:00:00.000Z') // 8 hours

      const result = TimeCalculations.adjustEndTimeForMinimumShift(
        startTime,
        endTime,
        payGuide
      )

      expect(result).toEqual(endTime)
    })

    it('returns original end time when no minimum shift hours specified', () => {
      const payGuideNoMin = { ...payGuide, minimumShiftHours: undefined }
      const startTime = new Date('2024-01-15T09:00:00.000Z')
      const endTime = new Date('2024-01-15T10:00:00.000Z')

      const result = TimeCalculations.adjustEndTimeForMinimumShift(
        startTime,
        endTime,
        payGuideNoMin
      )

      expect(result).toEqual(endTime)
    })
  })

  describe('roundToCents', () => {
    it('rounds to two decimal places', () => {
      const amount = new Decimal('123.456')
      const result = TimeCalculations.roundToCents(amount)
      expect(result.toString()).toBe('123.46')
    })

    it('rounds up at 0.5 cents', () => {
      const amount = new Decimal('123.125')
      const result = TimeCalculations.roundToCents(amount)
      expect(result.toString()).toBe('123.13')
    })

    it('preserves amounts already at two decimal places', () => {
      const amount = new Decimal('123.45')
      const result = TimeCalculations.roundToCents(amount)
      expect(result.toString()).toBe('123.45')
    })

    it('handles whole numbers', () => {
      const amount = new Decimal('123')
      const result = TimeCalculations.roundToCents(amount)
      expect(result.toString()).toBe('123')
    })

    it('handles zero', () => {
      const amount = new Decimal('0')
      const result = TimeCalculations.roundToCents(amount)
      expect(result.toString()).toBe('0')
    })
  })

  describe('sumHours', () => {
    it('sums hours from multiple items', () => {
      const items = [
        { hours: new Decimal('2.5') },
        { hours: new Decimal('3.25') },
        { hours: new Decimal('1.75') },
      ]

      const result = TimeCalculations.sumHours(items)
      expect(result.toString()).toBe('7.5')
    })

    it('returns zero for empty array', () => {
      const result = TimeCalculations.sumHours([])
      expect(result.toString()).toBe('0')
    })

    it('handles single item', () => {
      const items = [{ hours: new Decimal('5.25') }]
      const result = TimeCalculations.sumHours(items)
      expect(result.toString()).toBe('5.25')
    })

    it('handles zero values', () => {
      const items = [
        { hours: new Decimal('2.5') },
        { hours: new Decimal('0') },
        { hours: new Decimal('1.5') },
      ]

      const result = TimeCalculations.sumHours(items)
      expect(result.toString()).toBe('4')
    })
  })

  describe('sumPay', () => {
    it('sums pay from multiple items', () => {
      const items = [
        { pay: new Decimal('125.50') },
        { pay: new Decimal('200.75') },
        { pay: new Decimal('87.25') },
      ]

      const result = TimeCalculations.sumPay(items)
      expect(result.toString()).toBe('413.5')
    })

    it('returns zero for empty array', () => {
      const result = TimeCalculations.sumPay([])
      expect(result.toString()).toBe('0')
    })

    it('handles single item', () => {
      const items = [{ pay: new Decimal('99.99') }]
      const result = TimeCalculations.sumPay(items)
      expect(result.toString()).toBe('99.99')
    })

    it('handles zero values', () => {
      const items = [
        { pay: new Decimal('50') },
        { pay: new Decimal('0') },
        { pay: new Decimal('25.50') },
      ]

      const result = TimeCalculations.sumPay(items)
      expect(result.toString()).toBe('75.5')
    })

    it('maintains decimal precision for currency calculations', () => {
      const items = [
        { pay: new Decimal('33.33') },
        { pay: new Decimal('33.33') },
        { pay: new Decimal('33.34') },
      ]

      const result = TimeCalculations.sumPay(items)
      expect(result.toString()).toBe('100')
    })
  })
})
