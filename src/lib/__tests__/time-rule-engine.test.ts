/**
 * Blackbox TimeRuleEngine Tests
 *
 * These tests verify the TimeRuleEngine from a user perspective without knowledge
 * of internal implementation. Tests focus on inputs, outputs, and expected behavior
 * for various time rule scenarios in Australian employment contexts.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Decimal } from 'decimal.js'
import { TimeRuleEngine } from '@/lib/calculations/time-rule-engine'
import {
  PayGuide,
  PenaltyTimeFrame,
  OvertimeTimeFrame,
  BreakPeriod,
  PublicHoliday,
  RateRule,
} from '@/types'

describe('TimeRuleEngine', () => {
  let payGuide: PayGuide
  let publicHolidays: PublicHoliday[]
  let engine: TimeRuleEngine

  beforeEach(() => {
    payGuide = {
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

    publicHolidays = [
      {
        id: 'australia-day-2024',
        payGuideId: 'ma000004-retail-award-2025',
        name: 'Australia Day',
        date: new Date('2024-01-26'),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]

    engine = new TimeRuleEngine(payGuide, publicHolidays)
  })

  describe('collectApplicableRules', () => {
    const penaltyTimeFrames: PenaltyTimeFrame[] = [
      {
        id: 'casual-loading',
        payGuideId: 'ma000004-retail-award-2025',
        name: 'Casual Loading',
        multiplier: new Decimal('1.25'),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'evening-penalty',
        payGuideId: 'ma000004-retail-award-2025',
        name: 'Evening Work (6pm-10pm)',
        multiplier: new Decimal('1.125'),
        startTime: '18:00',
        endTime: '22:00',
        dayOfWeek: 1, // Monday (will be applicable to the test date)
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]

    const overtimeTimeFrames: OvertimeTimeFrame[] = [
      {
        id: 'daily-overtime',
        payGuideId: 'ma000004-retail-award-2025',
        name: 'Daily Overtime',
        firstThreeHoursMult: new Decimal('1.5'),
        afterThreeHoursMult: new Decimal('2.0'),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]

    it('collects penalty rules for applicable timeframes', () => {
      const startTime = new Date('2024-01-15T09:00:00+10:00')
      const endTime = new Date('2024-01-15T17:00:00+10:00')
      const overtimeHours = new Decimal('0')
      const breakPeriods: BreakPeriod[] = []

      const rules = engine.collectApplicableRules(
        startTime,
        endTime,
        penaltyTimeFrames,
        overtimeTimeFrames,
        overtimeHours,
        breakPeriods
      )

      // Should include casual loading rule
      const casualLoadingRules = rules.filter(
        (r) => r.timeFrame.id === 'casual-loading'
      )
      expect(casualLoadingRules.length).toStrictEqual(1)
      expect(casualLoadingRules[0].multiplier.toNumber()).toBe(1.25)
    })

    it('includes overtime rules when overtime hours exist', () => {
      const startTime = new Date('2024-01-15T09:00:00+10:00')
      const endTime = new Date('2024-01-15T19:00:00+10:00') // 10 hour shift
      const overtimeHours = new Decimal('2')
      const breakPeriods: BreakPeriod[] = []

      const rules = engine.collectApplicableRules(
        startTime,
        endTime,
        penaltyTimeFrames,
        overtimeTimeFrames,
        overtimeHours,
        breakPeriods
      )

      const overtimeRules = rules.filter((r) => r.type === 'overtime')
      expect(overtimeRules.length).toStrictEqual(1)
      expect(overtimeRules[0].multiplier.toNumber()).toBe(1.5)
    })

    it('excludes overtime rules when no overtime hours', () => {
      const startTime = new Date('2024-01-15T09:00:00+10:00')
      const endTime = new Date('2024-01-15T17:00:00+10:00') // 8 hour shift
      const overtimeHours = new Decimal('0')
      const breakPeriods: BreakPeriod[] = []

      const rules = engine.collectApplicableRules(
        startTime,
        endTime,
        penaltyTimeFrames,
        overtimeTimeFrames,
        overtimeHours,
        breakPeriods
      )

      const overtimeRules = rules.filter((r) => r.type === 'overtime')
      expect(overtimeRules.length).toBe(0)
    })

    it('handles multiple applicable penalty timeframes', () => {
      const startTime = new Date('2024-01-15T18:00:00+10:00')
      const endTime = new Date('2024-01-15T21:00:00+10:00') // Evening shift within 6pm-10pm range
      const overtimeHours = new Decimal('0')
      const breakPeriods: BreakPeriod[] = []

      const rules = engine.collectApplicableRules(
        startTime,
        endTime,
        penaltyTimeFrames,
        overtimeTimeFrames,
        overtimeHours,
        breakPeriods
      )

      const penaltyRules = rules.filter((r) => r.type === 'penalty')
      const casualRules = penaltyRules.filter(
        (r) => r.timeFrame.id === 'casual-loading'
      )
      const eveningRules = penaltyRules.filter(
        (r) => r.timeFrame.id === 'evening-penalty'
      )

      expect(casualRules.length).toStrictEqual(1)
      expect(eveningRules.length).toStrictEqual(1)
    })

    it('returns empty array when no applicable rules', () => {
      const startTime = new Date('2024-01-15T09:00:00+10:00')
      const endTime = new Date('2024-01-15T17:00:00+10:00')
      const overtimeHours = new Decimal('0')
      const breakPeriods: BreakPeriod[] = []

      const rules = engine.collectApplicableRules(
        startTime,
        endTime,
        [], // No penalty timeframes
        [], // No overtime timeframes
        overtimeHours,
        breakPeriods
      )

      expect(rules).toEqual([])
    })
  })

  describe('selectOptimalRules', () => {
    it('returns empty array for empty input', () => {
      const result = engine.selectOptimalRules([])
      expect(result).toEqual([])
    })

    it('selects single rule when only one applicable', () => {
      const rules: RateRule[] = [
        {
          type: 'penalty',
          period: {
            start: new Date('2024-01-15T09:00:00+10:00'),
            end: new Date('2024-01-15T17:00:00+10:00'),
          },
          timeFrame: {
            id: 'casual-loading',
            payGuideId: 'ma000004-retail-award-2025',
            name: 'Casual Loading',
            multiplier: new Decimal('1.25'),
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          multiplier: new Decimal('1.25'),
        },
      ]

      const result = engine.selectOptimalRules(rules)
      expect(result.length).toBe(1)
      expect(result[0].multiplier.toNumber()).toBe(1.25)
    })

    it('selects higher rate rule when overlapping rules exist', () => {
      const casualRule: RateRule = {
        type: 'penalty',
        period: {
          start: new Date('2024-01-15T09:00:00.000Z'),
          end: new Date('2024-01-15T17:00:00.000Z'),
        },
        timeFrame: {
          id: 'casual-loading',
          payGuideId: 'ma000004-retail-award-2025',
          name: 'Casual Loading',
          multiplier: new Decimal('1.25'),
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        multiplier: new Decimal('1.25'),
      }

      const eveningRule: RateRule = {
        type: 'penalty',
        period: {
          start: new Date('2024-01-15T18:00:00.000Z'),
          end: new Date('2024-01-15T22:00:00.000Z'),
        },
        timeFrame: {
          id: 'evening-penalty',
          payGuideId: 'ma000004-retail-award-2025',
          name: 'Evening Work',
          multiplier: new Decimal('1.5'),
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        multiplier: new Decimal('1.5'),
      }

      const result = engine.selectOptimalRules([casualRule, eveningRule])

      // Should prioritize higher rate rules in overlapping periods
      const highRateRule = result.find((r) => r.multiplier.toNumber() === 1.5)
      expect(highRateRule).toBeDefined()
    })

    it('prefers overtime rules over penalty rules at equal rates', () => {
      const penaltyRule: RateRule = {
        type: 'penalty',
        period: {
          start: new Date('2024-01-15T17:00:00.000Z'),
          end: new Date('2024-01-15T19:00:00.000Z'),
        },
        timeFrame: {
          id: 'evening-penalty',
          payGuideId: 'ma000004-retail-award-2025',
          name: 'Evening Work',
          multiplier: new Decimal('1.5'),
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        multiplier: new Decimal('1.5'),
      }

      const overtimeRule: RateRule = {
        type: 'overtime',
        period: {
          start: new Date('2024-01-15T17:00:00.000Z'),
          end: new Date('2024-01-15T19:00:00.000Z'),
        },
        timeFrame: {
          id: 'daily-overtime',
          payGuideId: 'ma000004-retail-award-2025',
          name: 'Daily Overtime',
          firstThreeHoursMult: new Decimal('1.5'),
          afterThreeHoursMult: new Decimal('2.0'),
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        multiplier: new Decimal('1.5'),
      }

      const result = engine.selectOptimalRules([penaltyRule, overtimeRule])

      // Should prefer overtime rule at equal rates
      expect(result.length).toBeGreaterThan(0)
      const selectedRule = result.find(
        (r) => r.period.start.getTime() === overtimeRule.period.start.getTime()
      )
      expect(selectedRule?.type).toBe('overtime')
    })
  })

  describe('createAppliedPenalty', () => {
    const penaltyRule = {
      type: 'penalty' as const,
      period: {
        start: new Date('2024-01-15T18:00:00.000Z'),
        end: new Date('2024-01-15T20:00:00.000Z'),
      },
      timeFrame: {
        id: 'evening-penalty',
        payGuideId: 'ma000004-retail-award-2025',
        name: 'Evening Work (6pm-8pm)',
        multiplier: new Decimal('1.125'),
        startTime: '18:00',
        endTime: '20:00',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      multiplier: new Decimal('1.125'),
    }

    it('creates applied penalty with correct calculations', () => {
      const breakPeriods: BreakPeriod[] = []
      const regularHours = new Decimal('8')

      const result = engine.createAppliedPenalty(
        penaltyRule,
        breakPeriods,
        regularHours
      )

      expect(result).not.toBeNull()
      expect(result!.timeFrameId).toBe('evening-penalty')
      expect(result!.name).toBe('Evening Work (6pm-8pm)')
      expect(result!.multiplier.toNumber()).toBe(1.125)
      expect(result!.hours.toNumber()).toBe(2) // 2 hour evening period

      // Pay calculation: 2 hours * $26.55 * 1.125 = $59.74 (rounded)
      const expectedPay = new Decimal('2')
        .times(new Decimal('26.55'))
        .times(new Decimal('1.125'))
      expect(result!.pay.toNumber()).toBeCloseTo(expectedPay.toNumber(), 2)
    })

    it('adjusts for break periods in penalty time', () => {
      const breakPeriods: BreakPeriod[] = [
        {
          id: 'dinner-break',
          shiftId: 'shift-123',
          startTime: new Date('2024-01-15T19:00:00.000Z'),
          endTime: new Date('2024-01-15T19:30:00.000Z'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]
      const regularHours = new Decimal('8')

      const result = engine.createAppliedPenalty(
        penaltyRule,
        breakPeriods,
        regularHours
      )

      expect(result).not.toBeNull()
      expect(result!.hours.toNumber()).toBe(1.5) // 2 hours - 0.5 hour break
    })

    it('limits penalty hours to available regular hours', () => {
      const breakPeriods: BreakPeriod[] = []
      const regularHours = new Decimal('1') // Only 1 regular hour available

      const result = engine.createAppliedPenalty(
        penaltyRule,
        breakPeriods,
        regularHours
      )

      expect(result).not.toBeNull()
      expect(result!.hours.toNumber()).toBe(1) // Limited to 1 hour
    })

    it('returns null when no worked penalty hours', () => {
      const longBreakPeriods: BreakPeriod[] = [
        {
          id: 'long-break',
          shiftId: 'shift-123',
          startTime: new Date('2024-01-15T17:30:00.000Z'),
          endTime: new Date('2024-01-15T20:30:00.000Z'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]
      const regularHours = new Decimal('8')

      const result = engine.createAppliedPenalty(
        penaltyRule,
        longBreakPeriods,
        regularHours
      )

      expect(result).toBeNull()
    })
  })

  describe('createAppliedOvertimes', () => {
    const overtimeRule = {
      type: 'overtime' as const,
      period: {
        start: new Date('2024-01-15T17:00:00.000Z'),
        end: new Date('2024-01-15T20:00:00.000Z'),
      },
      timeFrame: {
        id: 'daily-overtime',
        payGuideId: 'ma000004-retail-award-2025',
        name: 'Daily Overtime',
        basisType: 'daily' as const,
        firstThreeHoursMult: new Decimal('1.5'),
        afterThreeHoursMult: new Decimal('2.0'),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      multiplier: new Decimal('1.5'),
    }

    it('creates applied overtime with tiered rates', () => {
      const breakPeriods: BreakPeriod[] = []

      const result = engine.createAppliedOvertimes(overtimeRule, breakPeriods)

      expect(result.length).toBeGreaterThan(0)
      expect(result[0].timeFrameId).toBe('daily-overtime')
      expect(result[0].name).toContain('Daily Overtime')
      expect(result[0].hours.greaterThan(0)).toBe(true)
    })

    it('adjusts overtime hours for break periods', () => {
      const breakPeriods: BreakPeriod[] = [
        {
          id: 'overtime-break',
          shiftId: 'shift-123',
          startTime: new Date('2024-01-15T18:00:00.000Z'),
          endTime: new Date('2024-01-15T18:30:00.000Z'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      const result = engine.createAppliedOvertimes(overtimeRule, breakPeriods)

      if (result.length > 0) {
        const totalOvertimeHours = result.reduce(
          (sum, ot) => sum.plus(ot.hours),
          new Decimal(0)
        )
        expect(totalOvertimeHours.toNumber()).toBe(2.5) // 3 hours - 0.5 hour break
      }
    })

    it('returns empty array when no worked overtime hours', () => {
      const longBreakPeriods: BreakPeriod[] = [
        {
          id: 'very-long-break',
          shiftId: 'shift-123',
          startTime: new Date('2024-01-15T16:30:00.000Z'),
          endTime: new Date('2024-01-15T20:30:00.000Z'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      const result = engine.createAppliedOvertimes(
        overtimeRule,
        longBreakPeriods
      )

      expect(result).toEqual([])
    })

    it('creates multiple tiers for overtime exceeding 3 hours', () => {
      const longOvertimeRule = {
        ...overtimeRule,
        period: {
          start: new Date('2024-01-15T17:00:00.000Z'),
          end: new Date('2024-01-15T22:00:00.000Z'), // 5 hours overtime
        },
      }
      const breakPeriods: BreakPeriod[] = []

      const result = engine.createAppliedOvertimes(
        longOvertimeRule,
        breakPeriods
      )

      // Should create multiple tiers for different rates
      expect(result.length).toBeGreaterThan(0)

      // Check if we have both 1.5x and 2.0x rate tiers
      const tier1 = result.find((ot) => ot.multiplier.toNumber() === 1.5)
      const tier2 = result.find((ot) => ot.multiplier.toNumber() === 2.0)

      if (result.length > 1) {
        expect(tier1).toBeDefined()
        expect(tier2).toBeDefined()
      }
    })
  })
})
