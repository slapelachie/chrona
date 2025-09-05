/**
 * Blackbox BreakCalculator Tests
 *
 * These tests verify the BreakCalculator from a user perspective without knowledge
 * of internal implementation. Tests focus on inputs, outputs, and expected behavior
 * for various break calculation scenarios in Australian employment contexts.
 */

import { describe, it, expect } from 'vitest'
import { BreakCalculator } from '@/lib/calculations/break-calculator'
import { Period, BreakPeriod } from '@/types'

describe('BreakCalculator', () => {
  describe('calculateBreakOverlap', () => {
    it('calculates overlap when break period fully overlaps with period', () => {
      const period: Period = {
        start: new Date('2024-01-15T09:00:00.000Z'),
        end: new Date('2024-01-15T17:00:00.000Z')
      }
      
      const breakPeriods: BreakPeriod[] = [{
        id: 'lunch-break',
        shiftId: 'shift-123',
        startTime: new Date('2024-01-15T12:00:00.000Z'),
        endTime: new Date('2024-01-15T13:00:00.000Z'),
        createdAt: new Date(),
        updatedAt: new Date()
      }]

      const result = BreakCalculator.calculateBreakOverlap(period, breakPeriods)
      expect(result).toBe(60) // 1 hour lunch break
    })

    it('calculates partial overlap when break period partially overlaps', () => {
      const period: Period = {
        start: new Date('2024-01-15T12:30:00.000Z'),
        end: new Date('2024-01-15T17:00:00.000Z')
      }
      
      const breakPeriods: BreakPeriod[] = [{
        id: 'lunch-break',
        shiftId: 'shift-123',
        startTime: new Date('2024-01-15T12:00:00.000Z'),
        endTime: new Date('2024-01-15T13:00:00.000Z'),
        createdAt: new Date(),
        updatedAt: new Date()
      }]

      const result = BreakCalculator.calculateBreakOverlap(period, breakPeriods)
      expect(result).toBe(30) // 30 minutes overlap
    })

    it('returns 0 when no overlap exists', () => {
      const period: Period = {
        start: new Date('2024-01-15T14:00:00.000Z'),
        end: new Date('2024-01-15T17:00:00.000Z')
      }
      
      const breakPeriods: BreakPeriod[] = [{
        id: 'lunch-break',
        shiftId: 'shift-123',
        startTime: new Date('2024-01-15T12:00:00.000Z'),
        endTime: new Date('2024-01-15T13:00:00.000Z'),
        createdAt: new Date(),
        updatedAt: new Date()
      }]

      const result = BreakCalculator.calculateBreakOverlap(period, breakPeriods)
      expect(result).toBe(0)
    })

    it('handles multiple break periods with overlaps', () => {
      const period: Period = {
        start: new Date('2024-01-15T09:00:00.000Z'),
        end: new Date('2024-01-15T17:00:00.000Z')
      }
      
      const breakPeriods: BreakPeriod[] = [
        {
          id: 'morning-break',
          shiftId: 'shift-123',
          startTime: new Date('2024-01-15T10:30:00.000Z'),
          endTime: new Date('2024-01-15T10:45:00.000Z'),
            createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'lunch-break',
          shiftId: 'shift-123',
          startTime: new Date('2024-01-15T12:30:00.000Z'),
          endTime: new Date('2024-01-15T13:30:00.000Z'),
            createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      const result = BreakCalculator.calculateBreakOverlap(period, breakPeriods)
      expect(result).toBe(75) // 15 minutes + 60 minutes
    })

    it('handles empty break periods array', () => {
      const period: Period = {
        start: new Date('2024-01-15T09:00:00.000Z'),
        end: new Date('2024-01-15T17:00:00.000Z')
      }
      
      const result = BreakCalculator.calculateBreakOverlap(period, [])
      expect(result).toBe(0)
    })
  })

  describe('calculateTotalBreakMinutes', () => {
    it('calculates total minutes for single break', () => {
      const breakPeriods: BreakPeriod[] = [{
        id: 'lunch-break',
        shiftId: 'shift-123',
        startTime: new Date('2024-01-15T12:00:00.000Z'),
        endTime: new Date('2024-01-15T13:00:00.000Z'),
        createdAt: new Date(),
        updatedAt: new Date()
      }]

      const result = BreakCalculator.calculateTotalBreakMinutes(breakPeriods)
      expect(result).toBe(60)
    })

    it('calculates total minutes for multiple breaks', () => {
      const breakPeriods: BreakPeriod[] = [
        {
          id: 'morning-break',
          shiftId: 'shift-123',
          startTime: new Date('2024-01-15T10:30:00.000Z'),
          endTime: new Date('2024-01-15T10:45:00.000Z'),
            createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'lunch-break',
          shiftId: 'shift-123',
          startTime: new Date('2024-01-15T12:30:00.000Z'),
          endTime: new Date('2024-01-15T13:30:00.000Z'),
            createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'afternoon-break',
          shiftId: 'shift-123',
          startTime: new Date('2024-01-15T15:00:00.000Z'),
          endTime: new Date('2024-01-15T15:10:00.000Z'),
            createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      const result = BreakCalculator.calculateTotalBreakMinutes(breakPeriods)
      expect(result).toBe(85) // 15 + 60 + 10 minutes
    })

    it('returns 0 for empty break periods array', () => {
      const result = BreakCalculator.calculateTotalBreakMinutes([])
      expect(result).toBe(0)
    })
  })

  describe('validateBreakPeriods', () => {
    const shiftStart = new Date('2024-01-15T09:00:00.000Z')
    const shiftEnd = new Date('2024-01-15T17:00:00.000Z')

    it('passes validation for valid break periods', () => {
      const breakPeriods: BreakPeriod[] = [{
        id: 'lunch-break',
        shiftId: 'shift-123',
        startTime: new Date('2024-01-15T12:00:00.000Z'),
        endTime: new Date('2024-01-15T13:00:00.000Z'),
        createdAt: new Date(),
        updatedAt: new Date()
      }]

      expect(() => {
        BreakCalculator.validateBreakPeriods(breakPeriods, shiftStart, shiftEnd)
      }).not.toThrow()
    })

    it('throws error when break end time is before or equal to start time', () => {
      const breakPeriods: BreakPeriod[] = [{
        id: 'invalid-break',
        shiftId: 'shift-123',
        startTime: new Date('2024-01-15T13:00:00.000Z'),
        endTime: new Date('2024-01-15T12:00:00.000Z'), // End before start
        createdAt: new Date(),
        updatedAt: new Date()
      }]

      expect(() => {
        BreakCalculator.validateBreakPeriods(breakPeriods, shiftStart, shiftEnd)
      }).toThrow('Break end time must be after break start time')
    })

    it('throws error when break starts before shift start', () => {
      const breakPeriods: BreakPeriod[] = [{
        id: 'early-break',
        shiftId: 'shift-123',
        startTime: new Date('2024-01-15T08:00:00.000Z'), // Before shift start
        endTime: new Date('2024-01-15T08:15:00.000Z'),
        createdAt: new Date(),
        updatedAt: new Date()
      }]

      expect(() => {
        BreakCalculator.validateBreakPeriods(breakPeriods, shiftStart, shiftEnd)
      }).toThrow('Break periods must be within shift duration')
    })

    it('throws error when break ends after shift end', () => {
      const breakPeriods: BreakPeriod[] = [{
        id: 'late-break',
        shiftId: 'shift-123',
        startTime: new Date('2024-01-15T16:45:00.000Z'),
        endTime: new Date('2024-01-15T18:00:00.000Z'), // After shift end
        createdAt: new Date(),
        updatedAt: new Date()
      }]

      expect(() => {
        BreakCalculator.validateBreakPeriods(breakPeriods, shiftStart, shiftEnd)
      }).toThrow('Break periods must be within shift duration')
    })

    it('validates empty break periods array without error', () => {
      expect(() => {
        BreakCalculator.validateBreakPeriods([], shiftStart, shiftEnd)
      }).not.toThrow()
    })
  })

  describe('isBreakTime', () => {
    const breakPeriods: BreakPeriod[] = [
      {
        id: 'morning-break',
        shiftId: 'shift-123',
        startTime: new Date('2024-01-15T10:30:00.000Z'),
        endTime: new Date('2024-01-15T10:45:00.000Z'),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'lunch-break',
        shiftId: 'shift-123',
        startTime: new Date('2024-01-15T12:30:00.000Z'),
        endTime: new Date('2024-01-15T13:30:00.000Z'),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]

    it('returns true when time is within a break period', () => {
      const duringMorningBreak = new Date('2024-01-15T10:35:00.000Z')
      const duringLunchBreak = new Date('2024-01-15T13:00:00.000Z')

      expect(BreakCalculator.isBreakTime(duringMorningBreak, breakPeriods)).toBe(true)
      expect(BreakCalculator.isBreakTime(duringLunchBreak, breakPeriods)).toBe(true)
    })

    it('returns false when time is outside break periods', () => {
      const beforeAnyBreak = new Date('2024-01-15T09:00:00.000Z')
      const betweenBreaks = new Date('2024-01-15T11:30:00.000Z')
      const afterAllBreaks = new Date('2024-01-15T15:00:00.000Z')

      expect(BreakCalculator.isBreakTime(beforeAnyBreak, breakPeriods)).toBe(false)
      expect(BreakCalculator.isBreakTime(betweenBreaks, breakPeriods)).toBe(false)
      expect(BreakCalculator.isBreakTime(afterAllBreaks, breakPeriods)).toBe(false)
    })

    it('returns true at break start time', () => {
      const breakStartTime = new Date('2024-01-15T10:30:00.000Z')
      expect(BreakCalculator.isBreakTime(breakStartTime, breakPeriods)).toBe(true)
    })

    it('returns false at break end time (exclusive)', () => {
      const breakEndTime = new Date('2024-01-15T10:45:00.000Z')
      expect(BreakCalculator.isBreakTime(breakEndTime, breakPeriods)).toBe(false)
    })

    it('returns false for empty break periods array', () => {
      const anyTime = new Date('2024-01-15T12:00:00.000Z')
      expect(BreakCalculator.isBreakTime(anyTime, [])).toBe(false)
    })
  })
})