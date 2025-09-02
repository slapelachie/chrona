/**
 * Blackbox PayCalculator Tests
 *
 * These tests verify the PayCalculator from a user perspective without knowledge
 * of internal implementation. Tests focus on inputs, outputs, and expected Australian
 * pay calculation behavior for various scenarios.
 */

import { describe, it, expect } from 'vitest'
import { Decimal } from 'decimal.js'
import {
  PayCalculator,
  formatAustralianCurrency,
  calculateTotalHours,
} from '@/lib/calculations/pay-calculator'
import {
  PayGuide,
  PenaltyTimeFrame,
  OvertimeTimeFrame,
  BreakPeriod,
} from '@/types'

const retailPayGuide: PayGuide = {
  id: 'ma000004-retail-award-2025',
  name: 'General Retail Industry Award 2020 (MA000004)',
  // Level 1 adult ordinary hourly rate (full/part-time)
  baseRate: new Decimal('26.55'), // per Pay Guide, eff. 01-07-2025
  minimumShiftHours: 3,
  maximumShiftHours: 11,
  description:
    'Level 1 adult rates under MA000004 (casual loading 25%). Overtime per Award (daily basis).',
  effectiveFrom: new Date('2025-07-01'),
  timezone: 'Australia/Brisbane',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const retailPenaltyTimeFrames: PenaltyTimeFrame[] = [
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
    id: 'saturday-morning-penalty',
    payGuideId: 'ma000004-retail-award-2025',
    name: 'Saturday Morning Penalty',
    multiplier: new Decimal('1.75'),
    dayOfWeek: 6, // Saturday
    startTime: '00:00',
    endTime: '07:00',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'saturday-penalty',
    payGuideId: 'ma000004-retail-award-2025',
    name: 'Saturday Penalty',
    // Ordinary hours on Saturday are paid at 125% (part-time/full-time),
    // Casuals: 125% + 25% casual loading = effectively 150%.
    multiplier: new Decimal('1.5'),
    dayOfWeek: 6, // Saturday
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'saturday-night-penalty',
    payGuideId: 'ma000004-retail-award-2025',
    name: 'Saturday Night Penalty',
    multiplier: new Decimal('1.75'),
    dayOfWeek: 6, // Saturday
    startTime: '18:00',
    endTime: '00:00',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'sunday-morning-penalty',
    payGuideId: 'ma000004-retail-award-2025',
    name: 'Sunday Morning Penalty',
    multiplier: new Decimal('2.25'),
    dayOfWeek: 0, // Saturday
    startTime: '00:00',
    endTime: '09:00',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'sunday-penalty',
    payGuideId: 'ma000004-retail-award-2025',
    name: 'Sunday Penalty',
    // Ordinary hours on Sunday are paid at 150% (permanent),
    // Casuals: 150% + 25% casual loading = effectively 175%.
    multiplier: new Decimal('1.75'),
    dayOfWeek: 0, // Sunday
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'sunday-night-penalty',
    payGuideId: 'ma000004-retail-award-2025',
    name: 'Sunday Night Penalty',
    multiplier: new Decimal('2.25'),
    dayOfWeek: 0, // Saturday
    startTime: '18:00',
    endTime: '00:00',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'evening-penalty',
    payGuideId: 'ma000004-retail-award-2025',
    name: 'Evening Penalty',
    // Work after 6pm Mon–Fri attracts 125%.
    multiplier: new Decimal('1.5'),
    startTime: '18:00',
    endTime: '21:00',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'night-penalty',
    payGuideId: 'ma000004-retail-award-2025',
    name: 'Night Penalty',
    multiplier: new Decimal('1.75'),
    startTime: '21:00',
    endTime: '00:00',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'early-morning-penalty',
    payGuideId: 'ma000004-retail-award-2025',
    name: 'Early Morning Penalty',
    multiplier: new Decimal('1.75'),
    startTime: '00:00',
    endTime: '07:00',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

const retailOvertimeTimeFrames: OvertimeTimeFrame[] = [
  {
    id: 'ot-mon-sat',
    payGuideId: 'ma000004-retail-award-2025',
    name: 'Overtime (Mon - Sat)',
    firstThreeHoursMult: new Decimal('1.75'),
    afterThreeHoursMult: new Decimal('2.25'),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'ot-sun',
    payGuideId: 'ma000004-retail-award-2025',
    name: 'Overtime (Sun)',
    firstThreeHoursMult: new Decimal('2.25'),
    afterThreeHoursMult: new Decimal('2.25'),
    dayOfWeek: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'ot-public-holiday',
    payGuideId: 'ma000004-retail-award-2025',
    name: 'Overtime (Public Holiday)',
    firstThreeHoursMult: new Decimal('2.75'),
    afterThreeHoursMult: new Decimal('2.75'),
    isPublicHoliday: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

describe('PayCalculator - Blackbox Tests', () => {
  describe('Standard Weekday Shift Scenarios', () => {
    it('should calculate casual loading for standard 8-hour weekday shift with break', () => {
      const calculator = new PayCalculator(
        retailPayGuide,
        retailPenaltyTimeFrames,
        retailOvertimeTimeFrames
      )

      // 30 minute break
      const breakPeriods: BreakPeriod[] = [
        {
          startTime: new Date('2025-07-07T13:00:00'),
          endTime: new Date('2025-07-07T13:30:00'),
        },
      ]

      const result = calculator.calculate(
        new Date('2025-07-07T09:00:00'), // Monday 9am
        new Date('2025-07-07T17:30:00'), // Monday 5:30pm
        breakPeriods
      )

      expect(result.shift.totalHours.toString()).toBe('8')
      expect(result.breakdown.baseHours.toString()).toBe('0')
      expect(result.breakdown.basePay.toString()).toBe('0')
      expect(result.breakdown.overtimeHours.toString()).toBe('0')
      expect(result.breakdown.overtimePay.toString()).toBe('0')
      expect(result.breakdown.penaltyHours.toString()).toBe('8')
      expect(result.breakdown.penaltyPay.toString()).toBe('265.5') // 8 * 26.55 * 1.25
      expect(result.breakdown.totalPay.toString()).toBe('265.5')
      expect(result.penalties).toHaveLength(1)
      expect(result.overtimes).toHaveLength(0)
    })

    it('should calculate casual loading for 4-hour weekday shift without break', () => {
      const calculator = new PayCalculator(
        retailPayGuide,
        retailPenaltyTimeFrames,
        retailOvertimeTimeFrames
      )

      const result = calculator.calculate(
        new Date('2025-07-07T09:00:00'), // Monday 9am
        new Date('2025-07-07T13:00:00'), // Monday 1pm
        []
      )

      expect(result.shift.totalHours.toString()).toBe('4')
      expect(result.breakdown.baseHours.toString()).toBe('0')
      expect(result.breakdown.basePay.toString()).toBe('0')
      expect(result.breakdown.penaltyHours.toString()).toBe('4')
      expect(result.breakdown.penaltyPay.toString()).toBe('132.75') // 4 * 26.55 * 1.25
      expect(result.breakdown.totalPay.toString()).toBe('132.75')
      expect(result.penalties).toHaveLength(1)
    })

    it('should enforce minimum 3-hour payment for shifts under minimum duration', () => {
      const calculator = new PayCalculator(
        retailPayGuide,
        retailPenaltyTimeFrames,
        retailOvertimeTimeFrames
      )

      const result = calculator.calculate(
        new Date('2025-07-07T09:00:00'), // Monday 9am
        new Date('2025-07-07T09:30:00'), // Monday 9.30am
        []
      )

      expect(result.shift.totalHours.toString()).toBe('3')
      expect(result.breakdown.baseHours.toString()).toBe('0')
      expect(result.breakdown.basePay.toString()).toBe('0')
      expect(result.breakdown.penaltyHours.toString()).toBe('3') // Min shift hours
      expect(result.breakdown.penaltyPay.toString()).toBe('99.56') // 3 * 26.55 * 1.25
      expect(result.breakdown.totalPay.toString()).toBe('99.56')
      expect(result.penalties).toHaveLength(1)
    })

    it.skip('should calculate base pay for shifts with no applicable penalties', () => {
      // TODO: Create PayCalculator with no penalty timeframes
      // Test shift that would only receive base rate pay
      // Should have basePay > 0, penaltyPay = 0
    })

    it.skip('should calculate pay for shift exactly at minimum hours boundary', () => {
      // TODO: Test shift of exactly 3 hours (minimum)
      // Should not trigger minimum hour enforcement
    })

    it.skip('should handle shift transitioning from regular to evening penalty hours', () => {
      // TODO: Test shift like 4pm-7pm that crosses into evening penalty
      // Should split into casual loading + evening penalty periods
    })
  })

  describe('Premium Rate Calculations', () => {
    it('should apply Saturday 1.5x premium rate for full-day weekend shift', () => {
      const calculator = new PayCalculator(
        retailPayGuide,
        retailPenaltyTimeFrames,
        retailOvertimeTimeFrames
      )

      // 30 minute break
      const breakPeriods: BreakPeriod[] = [
        {
          startTime: new Date('2025-07-05T13:00:00+10:00'),
          endTime: new Date('2025-07-05T13:30:00+10:00'),
        },
      ]

      const result = calculator.calculate(
        new Date('2025-07-05T07:00:00+10:00'), // Saturday 10am
        new Date('2025-07-05T18:00:00+10:00'), // Saturday 6pm
        breakPeriods
      )

      expect(result.shift.totalHours.toString()).toBe('10.5')
      expect(result.breakdown.baseHours.toString()).toBe('0') // All hours are penalty hours
      expect(result.breakdown.basePay.toString()).toBe('0')
      expect(result.breakdown.penaltyHours.toString()).toBe('10.5')
      expect(result.breakdown.penaltyPay.toString()).toBe('418.16') // 10.5 * 26.55 * 1.5
      expect(result.breakdown.totalPay.toString()).toBe('418.16')
      expect(result.penalties).toHaveLength(1)
      expect(result.penalties[0].name).toBe('Saturday Penalty')
      expect(result.penalties[0].multiplier.toString()).toBe('1.5')
    })

    it('should apply Sunday 1.75x premium rate for full-day weekend shift', () => {
      const calculator = new PayCalculator(
        retailPayGuide,
        retailPenaltyTimeFrames,
        retailOvertimeTimeFrames
      )

      // 30 minute break
      const breakPeriods: BreakPeriod[] = [
        {
          startTime: new Date('2025-07-06T13:00:00+10:00'),
          endTime: new Date('2025-07-06T13:30:00+10:00'),
        },
      ]

      const result = calculator.calculate(
        new Date('2025-07-06T09:00:00+10:00'), // Sunday 9am
        new Date('2025-07-06T18:00:00+10:00'), // Sunday 6pm
        breakPeriods
      )

      expect(result.shift.totalHours.toString()).toBe('8.5')
      expect(result.breakdown.penaltyHours.toString()).toBe('8.5')
      expect(result.breakdown.penaltyPay.toString()).toBe('394.93') // 8.5 * 26.55 * 1.75
      expect(result.breakdown.totalPay.toString()).toBe('394.93')
      expect(result.penalties[0].name).toBe('Sunday Penalty')
      expect(result.penalties[0].multiplier.toString()).toBe('1.75')
    })

    it('should apply different premium rates when shift crosses Friday-Saturday boundary', () => {
      const calculator = new PayCalculator(
        retailPayGuide,
        retailPenaltyTimeFrames,
        retailOvertimeTimeFrames
      )

      // 30 minute break
      const breakPeriods: BreakPeriod[] = [
        {
          startTime: new Date('2025-07-05T04:00:00'),
          endTime: new Date('2025-07-05T04:30:00'),
        },
      ]

      const result = calculator.calculate(
        new Date('2025-07-04T22:00:00'), // Friday 10pm
        new Date('2025-07-05T06:00:00'), // Saturday 6am
        breakPeriods
      )

      // Ignore the rest below, Friday should have the night penalty and Satuday should have the
      // Saturday morning penalty

      expect(result.shift.totalHours.toString()).toBe('7.5')

      // All hours should be penalty hours (Friday night penalty + Saturday morning penalty)
      expect(result.breakdown.baseHours.toString()).toBe('0') // No base hours - all penalty
      expect(result.breakdown.penaltyHours.toString()).toBe('7.5') // All 7.5 hours are penalty

      // Check penalties - should have Night Penalty and Saturday Morning Penalty
      const nightPenalty = result.penalties.find(
        (p) => p.name === 'Night Penalty'
      )
      const satMorningPenalty = result.penalties.find(
        (p) => p.name === 'Saturday Morning Penalty'
      )

      expect(nightPenalty).toBeTruthy()
      expect(nightPenalty!.hours.toString()).toBe('2') // Friday 10pm-12am
      expect(nightPenalty!.multiplier.toString()).toBe('1.75')

      expect(satMorningPenalty).toBeTruthy()
      expect(satMorningPenalty!.hours.toString()).toBe('5.5') // Saturday 12am-6am minus break
      expect(satMorningPenalty!.multiplier.toString()).toBe('1.75')
    })

    it.skip('should apply Saturday night penalty for evening weekend shifts', () => {
      // TODO: Test Saturday 18:00-00:00 shift
      // Should apply Saturday night penalty (1.75x multiplier)
    })

    it.skip('should apply Sunday morning penalty for early weekend shifts', () => {
      // TODO: Test Sunday 00:00-09:00 shift
      // Should apply Sunday morning penalty (2.25x multiplier)
    })

    it.skip('should apply Sunday night penalty for evening weekend shifts', () => {
      // TODO: Test Sunday 18:00-00:00 shift
      // Should apply Sunday night penalty (2.25x multiplier)
    })

    describe('Time-of-Day Premium Rates', () => {
      it('should apply escalating premium rates for evening and night hours on weekdays', () => {
        const calculator = new PayCalculator(
          retailPayGuide,
          retailPenaltyTimeFrames,
          retailOvertimeTimeFrames
        )

        // 30 minute break
        const breakPeriods: BreakPeriod[] = [
          {
            startTime: new Date('2025-07-07T20:00:00'),
            endTime: new Date('2025-07-07T20:30:00'),
          },
        ]

        const result = calculator.calculate(
          new Date('2025-07-07T16:00:00'), // Monday 4pm
          new Date('2025-07-07T22:00:00'), // Monday 10pm
          breakPeriods
        )

        expect(result.shift.totalHours.toString()).toBe('5.5')

        const casualLoading = result.penalties.find(
          (p) => p.name === 'Casual Loading'
        )
        const eveningPenalty = result.penalties.find(
          (p) => p.name === 'Evening Penalty'
        )
        const nightPenalty = result.penalties.find(
          (p) => p.name === 'Night Penalty'
        )

        expect(casualLoading).toBeTruthy()
        expect(casualLoading!.hours.toString()).toBe('2') // 4pm-6pm
        expect(casualLoading!.multiplier.toString()).toBe('1.25')
        expect(casualLoading!.pay.toString()).toBe('66.38')

        expect(eveningPenalty).toBeTruthy()
        expect(eveningPenalty!.hours.toString()).toBe('2.5') // 6pm-9pm (with break)
        expect(eveningPenalty!.multiplier.toString()).toBe('1.5')
        expect(eveningPenalty!.pay.toString()).toBe('99.56')

        expect(nightPenalty).toBeTruthy()
        expect(nightPenalty!.hours.toString()).toBe('1') // 9pm-10pm
        expect(nightPenalty!.multiplier.toString()).toBe('1.75')
        expect(nightPenalty!.pay.toString()).toBe('46.46')

        expect(result.breakdown.penaltyHours.toString()).toBe('5.5')
        expect(result.breakdown.penaltyPay.toString()).toBe('212.4')

        expect(result.breakdown.totalPay.toString()).toBe('212.4')

        expect(result.penalties).toHaveLength(3)
      })

      it('should apply night and early morning premium rates for overnight shifts', () => {
        const calculator = new PayCalculator(
          retailPayGuide,
          retailPenaltyTimeFrames,
          retailOvertimeTimeFrames
        )

        // 30 minute break
        const breakPeriods: BreakPeriod[] = [
          {
            startTime: new Date('2025-07-08T04:00:00'),
            endTime: new Date('2025-07-08T04:30:00'),
          },
        ]

        const result = calculator.calculate(
          new Date('2025-07-07T23:00:00'), // Monday 11pm
          new Date('2025-07-08T07:00:00'), // Tuesday 7am
          breakPeriods
        )

        expect(result.shift.totalHours.toString()).toBe('7.5')

        const nightPenalty = result.penalties.find(
          (p) => p.name === 'Night Penalty'
        )
        const earlyMorningPenalty = result.penalties.find(
          (p) => p.name === 'Early Morning Penalty'
        )

        expect(nightPenalty).toBeTruthy()
        expect(nightPenalty!.hours.toString()).toBe('1') // Monday 11pm - Tuesday 12am
        expect(nightPenalty!.multiplier.toString()).toBe('1.75')
        expect(nightPenalty!.pay.toString()).toBe('46.46')

        expect(earlyMorningPenalty).toBeTruthy()
        expect(earlyMorningPenalty!.hours.toString()).toBe('6.5') // Saturday 12am-6am minus break
        expect(earlyMorningPenalty!.multiplier.toString()).toBe('1.75')
        expect(earlyMorningPenalty!.pay.toString()).toBe('302.01')

        expect(result.breakdown.penaltyHours.toString()).toBe('7.5')
        expect(result.breakdown.penaltyPay.toString()).toBe('348.47')

        expect(result.breakdown.totalPay.toString()).toBe('348.47')

        expect(result.penalties).toHaveLength(2)
      })

      it.skip('should apply evening penalty for isolated weekday evening hours', () => {
        // TODO: Test shift during only evening penalty hours (18:00-21:00)
        // Should apply evening penalty multiplier without other penalties
      })

      it.skip('should apply early morning penalty for isolated early morning hours', () => {
        // TODO: Test shift during only early morning penalty hours (00:00-07:00)
        // Should apply early morning penalty multiplier
      })

      describe.skip('Public Holiday Premium Rates', () => {
        it('should apply public holiday premium rates for Christmas Day shifts', () => {
          const calculator = new PayCalculator(
            retailPayGuide,
            retailPenaltyTimeFrames,
            retailOvertimeTimeFrames
          )

          const result = calculator.calculate(
            new Date('2024-12-25T10:00:00Z'), // Christmas Day 10am
            new Date('2024-12-25T18:00:00Z'), // Christmas Day 6pm
            [] // FIXME 30 minute break
          )

          expect(result.shift.totalHours.toString()).toBe('7.50')
          expect(result.breakdown.penaltyHours.toString()).toBe('7.50')
          expect(result.breakdown.penaltyPay.toString()).toBe('476.64') // 7.5 * 25.41 * 2.5

          expect(result.penalties).toHaveLength(1)
          expect(result.penalties[0].name).toBe('Public Holiday Penalty')
          expect(result.penalties[0].multiplier.toString()).toBe('2.5')
        })

        it('should apply public holiday premium rates for ANZAC Day shifts', () => {
          const calculator = new PayCalculator(
            retailPayGuide,
            retailPenaltyTimeFrames,
            retailOvertimeTimeFrames
          )

          const result = calculator.calculate(
            new Date('2024-04-25T09:00:00Z'), // ANZAC Day 9am
            new Date('2024-04-25T17:00:00Z'), // ANZAC Day 5pm
            [] // FIXME 1 hour break
          )

          expect(result.shift.totalHours.toString()).toBe('7.00')
          expect(result.breakdown.penaltyPay.toString()).toBe('444.64') // 7 * 25.41 * 2.5
          expect(result.penalties[0].name).toBe('Public Holiday Penalty')
        })

        it.skip('should apply public holiday rates over weekend rates', () => {
          // TODO: Test Christmas Day on Saturday/Sunday
          // Should use public holiday rate, not weekend rate
        })

        it.skip('should handle public holiday that falls on different days of week', () => {
          // TODO: Test same public holiday on weekday vs weekend
          // Should apply appropriate rates based on day context
        })

        it.skip('should handle state-specific public holidays', () => {
          // TODO: Test state-specific holidays like Melbourne Cup Day
          // Should only apply when configured for specific states
        })

        it.skip('should handle public holiday shifts with overtime', () => {
          // TODO: Test extended public holiday shifts requiring overtime
          // Should combine public holiday rates with overtime multipliers
        })
      })
    })

    describe('Overtime Rate Calculations', () => {
      it('should apply first-tier overtime rate (1.75x) for shifts exceeding 11 hours', () => {
        const calculator = new PayCalculator(
          retailPayGuide,
          retailPenaltyTimeFrames,
          retailOvertimeTimeFrames
        )

        // Create break period in middle of shift (1pm-2pm)
        const breakPeriods: BreakPeriod[] = [
          {
            startTime: new Date('2025-07-07T13:00:00'), // 1pm
            endTime: new Date('2025-07-07T14:00:00'), // 2pm
          },
        ]

        const result = calculator.calculate(
          new Date('2025-07-07T07:00:00'), // Monday 7am
          new Date('2025-07-07T20:00:00'), // Monday 8pm
          breakPeriods
        )

        expect(result.shift.totalHours.toString()).toBe('12')

        const casualLoading = result.penalties.find(
          (p) => p.name === 'Casual Loading'
        )
        const eveningPenalty = result.penalties.find(
          (p) => p.name === 'Evening Penalty'
        )

        expect(casualLoading).toBeTruthy()
        expect(casualLoading!.hours.toString()).toBe('10') // 7am - 6pm (with break)
        expect(casualLoading!.multiplier.toString()).toBe('1.25')
        expect(casualLoading!.pay.toString()).toBe('331.88')

        expect(eveningPenalty).toBeTruthy()
        expect(eveningPenalty!.hours.toString()).toBe('1') // 6pm - 7 pm
        expect(eveningPenalty!.multiplier.toString()).toBe('1.5')
        expect(eveningPenalty!.pay.toString()).toBe('39.83')

        expect(result.breakdown.penaltyHours.toString()).toBe('11')
        expect(result.breakdown.penaltyPay.toString()).toBe('371.71')

        expect(result.breakdown.overtimeHours.toString()).toBe('1') // 1 hour overtime
        expect(result.breakdown.overtimePay.toString()).toBe('46.46') // 1 * 26.55 * 1.75

        const totalExpected = new Decimal('0') // base
          .plus('371.71')
          .plus('46.46') // overtime

        expect(result.breakdown.totalPay.toString()).toBe(
          totalExpected.toString()
        )
      })

      it('should apply tiered overtime rates (1.75x first 3 hours, 2.25x after) for extended shifts', () => {
        const calculator = new PayCalculator(
          retailPayGuide,
          retailPenaltyTimeFrames,
          retailOvertimeTimeFrames
        )

        const result = calculator.calculate(
          new Date('2025-07-07T06:00:00'), // Monday 6am
          new Date('2025-07-07T21:00:00'), // Monday 9pm
          [] // no break
        )

        expect(result.shift.totalHours.toString()).toBe('15')
        expect(result.breakdown.baseHours.toString()).toBe('0')
        expect(result.breakdown.basePay.toString()).toBe('0')
        expect(result.breakdown.penaltyHours.toString()).toBe('11')
        expect(result.breakdown.penaltyPay.toString()).toBe('378.34')
        expect(result.breakdown.overtimeHours.toString()).toBe('4') // 4 hours overtime (3 1.75 + 1 2.25)

        const overtimeFirstThreeHours = result.overtimes.find(
          (o) =>
            o.name === 'Overtime (Mon - Sat)' &&
            o.multiplier.toString() === '1.75'
        )
        const overtimeAfterThreeHours = result.overtimes.find(
          (o) =>
            o.name === 'Overtime (Mon - Sat)' &&
            o.multiplier.toString() === '2.25'
        )

        expect(overtimeFirstThreeHours).toBeTruthy()
        expect(overtimeFirstThreeHours!.hours.toString()).toBe('3') // 5pm - 8pm
        expect(overtimeFirstThreeHours!.pay.toString()).toBe('139.39') // 3 * 26.55 * 1.75

        expect(overtimeAfterThreeHours).toBeTruthy()
        expect(overtimeAfterThreeHours!.hours.toString()).toBe('1') // 8pm - 9pm
        expect(overtimeAfterThreeHours!.pay.toString()).toBe('59.74') // 1 * 26.55 * 2.25

        const totalOvertime = new Decimal('0')
          .plus('139.39') // overtime 1.75
          .plus('59.74') // overtime 2.25

        expect(result.breakdown.overtimePay.toString()).toBe(
          totalOvertime.toString()
        )

        const totalExpected = new Decimal('0') // base
          .plus('378.34') //penalty
          .plus('199.13') // overtime

        expect(result.breakdown.totalPay.toString()).toBe(
          totalExpected.toString()
        )
      })

      it('should correctly combine overtime rates with weekend premium rates', () => {
        const calculator = new PayCalculator(
          retailPayGuide,
          retailPenaltyTimeFrames,
          retailOvertimeTimeFrames
        )

        const result = calculator.calculate(
          new Date('2025-07-05T07:00:00'), // Saturday 7am
          new Date('2025-07-05T19:00:00'), // Saturday 7pm
          []
        )

        expect(result.shift.totalHours.toString()).toBe('12')

        // All hours should be penalty hours (Saturday), with overtime rates applied
        expect(result.breakdown.penaltyHours.toString()).toBe('11')
        expect(result.breakdown.baseHours.toString()).toBe('0')
        expect(result.breakdown.overtimeHours.toString()).toBe('1') // Hours beyond 8

        // Should have both penalty pay and overtime pay
        expect(
          parseFloat(result.breakdown.penaltyPay.toString())
        ).toBeGreaterThan(0)
        expect(
          parseFloat(result.breakdown.overtimePay.toString())
        ).toBeGreaterThan(0)
      })

      it('should apply Sunday-specific overtime rates (2.25x) for extended Sunday shifts', () => {
        const calculator = new PayCalculator(
          retailPayGuide,
          retailPenaltyTimeFrames,
          retailOvertimeTimeFrames
        )

        const result = calculator.calculate(
          new Date('2025-07-06T07:00:00'), // Sunday 7am
          new Date('2025-07-06T19:00:00'), // Sunday 8pm
          []
        )

        expect(result.shift.totalHours.toString()).toBe('12')

        // Should have two penalties (Sunday morning and Sunday)
        expect(result.penalties).toHaveLength(2)

        // Should have overtime periods applied for Sunday work
        expect(result.overtimes).toHaveLength(1)
        expect(result.overtimes[0].name).toBe('Overtime (Sun)')
        expect(result.overtimes[0].hours.toString()).toBe('1')
        expect(result.overtimes[0].multiplier.toString()).toBe('2.25')
      })

      it('should skip overtime rules with invalid multipliers (zero or negative)', () => {
        // Create timeframe with zero/negative multipliers
        const invalidOvertimeFrame: OvertimeTimeFrame = {
          id: 'invalid-ot',
          payGuideId: 'ma000004-retail-award-2025',
          name: 'Invalid Overtime',
          firstThreeHoursMult: new Decimal('0'), // Invalid
          afterThreeHoursMult: new Decimal('1.5'),
          dayOfWeek: 1,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        const calculator = new PayCalculator(
          retailPayGuide,
          [],
          [invalidOvertimeFrame]
        )

        const result = calculator.calculate(
          new Date('2025-07-07T08:00:00+10:00'), // Monday 8am
          new Date('2025-07-07T13:00:00+10:00'), // Monday 1pm
          []
        )

        // Should have no overtime periods due to invalid multiplier
        expect(result.overtimes).toHaveLength(0)
      })

      it.skip('should apply overtime exactly at 3-hour tier boundary', () => {
        // TODO: Test shift with exactly 3 hours overtime
        // Should apply first tier rate only, not second tier
      })

      it.skip('should calculate overtime with base rate only (no penalties)', () => {
        // TODO: Test overtime shift with PayCalculator that has no penalty timeframes
        // Should have base pay + overtime pay, no penalty pay
      })
    })
  })

  describe('Input Validation and Utility Functions', () => {
    describe.skip('Invalid Shift Times', () => {
      it('should reject shifts where end time is before start time', () => {
        // TODO: Test PayCalculator.calculate() with endTime < startTime
        // Should throw descriptive error
      })

      it('should reject shifts with zero duration', () => {
        // TODO: Test PayCalculator.calculate() with startTime === endTime
        // Should throw descriptive error
      })

      it('should handle shifts with invalid date objects', () => {
        // TODO: Test PayCalculator.calculate() with invalid Date objects
        // Should throw descriptive error
      })
    })

    describe.skip('Invalid Break Periods', () => {
      it('should reject break periods outside shift boundaries', () => {
        // TODO: Test break periods that start before shift or end after shift
        // Should throw descriptive error
      })

      it('should reject break periods with negative duration', () => {
        // TODO: Test break periods where endTime <= startTime
        // Should throw descriptive error
      })

      it('should reject break periods that exceed total shift duration', () => {
        // TODO: Test when sum of all break periods >= shift duration
        // Should throw descriptive error
      })
    })

    describe.skip('Invalid PayGuide Configuration', () => {
      it('should handle missing or invalid base rates', () => {
        // TODO: Test PayCalculator with zero or negative base rates
        // Should throw descriptive error or handle gracefully
      })

      it('should handle invalid minimum/maximum shift hours', () => {
        // TODO: Test PayGuide with negative or conflicting min/max hours
        // Should throw descriptive error or handle gracefully
      })
    })

    describe('Utility Function Tests', () => {
      it('should format decimal amounts as Australian currency strings', () => {
        expect(formatAustralianCurrency(new Decimal('25.41'))).toBe('$25.41')
        expect(formatAustralianCurrency(new Decimal('1234.56'))).toBe(
          '$1234.56'
        )
        expect(formatAustralianCurrency(new Decimal('0.99'))).toBe('$0.99')
        expect(formatAustralianCurrency(new Decimal('1000.00'))).toBe(
          '$1000.00'
        )
      })

      it('should calculate total worked hours accounting for break periods', () => {
        const hours1 = calculateTotalHours(
          new Date('2024-01-15T09:00:00Z'),
          new Date('2024-01-15T17:00:00Z'),
          30
        )
        expect(hours1.toString()).toBe('7.5')

        const hours2 = calculateTotalHours(
          new Date('2024-01-15T09:00:00Z'),
          new Date('2024-01-15T17:30:00Z'),
          0
        )
        expect(hours2.toString()).toBe('8.5')

        const hours3 = calculateTotalHours(
          new Date('2024-01-15T09:15:00Z'),
          new Date('2024-01-15T17:45:00Z'),
          15
        )
        expect(hours3.toString()).toBe('8.25')
      })

      it.skip('should format currency for edge case amounts', () => {
        // TODO: Test formatAustralianCurrency with $0.00, very large amounts
        // Should handle edge cases consistently
      })

      it.skip('should calculate hours with zero break time', () => {
        // TODO: Test calculateTotalHours with breakMinutes = 0
        // Should return exact time difference in hours
      })

      it.skip('should handle very long shift hour calculations', () => {
        // TODO: Test calculateTotalHours for 20+ hour shifts
        // Should maintain precision for extended shifts
      })
    })
  })

  describe('Edge Case and Boundary Condition Handling', () => {
    describe.skip('Midnight Boundary Conditions', () => {
      it('should handle shifts starting exactly at midnight', () => {
        // TODO: Test shift starting at 00:00:00 local time
        // Should apply correct penalty rules based on day of week
      })

      it('should handle shifts ending exactly at midnight', () => {
        // TODO: Test shift ending at 00:00:00 local time (next day)
        // Should apply correct penalty rules and not double-count
      })

      it('should handle penalty rules that span midnight boundaries', () => {
        // TODO: Test penalty rules like "22:00-06:00" across midnight
        // Should correctly split and apply rates
      })
    })

    describe.skip('Maximum Shift Duration Boundaries', () => {
      it('should enforce maximum shift hours before overtime', () => {
        // TODO: Test shifts at exactly maximumShiftHours (11 hours)
        // Should not trigger overtime at exactly the limit
      })

      it('should trigger overtime at maximumShiftHours + 1 minute', () => {
        // TODO: Test shifts just over maximumShiftHours limit
        // Should correctly trigger overtime calculations
      })

      it('should handle extremely long shifts (24+ hours)', () => {
        // TODO: Test shifts spanning multiple days
        // Should correctly apply all penalty and overtime rules
      })
    })

    describe.skip('Fractional Time Calculations', () => {
      it('should handle shifts with fractional minutes (15-minute increments)', () => {
        // TODO: Test shifts ending at 15, 30, 45 minute marks
        // Should calculate exact fractional hours
      })

      it('should handle penalty periods with fractional overlaps', () => {
        // TODO: Test penalty periods that partially overlap with shifts
        // Should calculate exact fractional penalty hours
      })
    })

    describe.skip('Multiple Sequential Breaks', () => {
      it('should handle two separate break periods in one shift', () => {
        // TODO: Test shift with lunch break (30 min) + afternoon break (15 min)
        // Should correctly subtract both breaks from penalty calculations
      })

      it('should handle three or more break periods in extended shifts', () => {
        // TODO: Test 12+ hour shifts with multiple breaks
        // Should correctly distribute breaks across penalty/overtime periods
      })
    })

    describe.skip('Breaks Spanning Penalty Boundaries', () => {
      it('should handle breaks that span across penalty time boundaries', () => {
        // TODO: Test break period that starts in regular time, ends in penalty time
        // Should correctly apply penalty rates only to worked portions
      })

      it('should handle breaks during overtime periods', () => {
        // TODO: Test break periods that occur during overtime hours
        // Should reduce overtime hours by break time
      })
    })

    describe.skip('Break Period Edge Cases', () => {
      it('should handle break periods at exact penalty transition times', () => {
        // TODO: Test break starting/ending exactly at 6pm (evening penalty start)
        // Should correctly handle boundary conditions
      })

      it('should handle overlapping break periods', () => {
        // TODO: Test overlapping break periods (error condition)
        // Should throw descriptive error or merge periods
      })
    })

    describe.skip('Multiple Simultaneous Penalties', () => {
      it('should apply highest rate when multiple penalties overlap', () => {
        // TODO: Test Saturday night shift (Saturday + evening + night penalties)
        // Should apply highest penalty rate, not stack them
      })

      it('should handle weekend penalties combined with time-based penalties', () => {
        // TODO: Test Sunday evening shift (Sunday + evening penalties)
        // Should correctly determine which rate takes precedence
      })
    })

    describe.skip('Overtime with Complex Penalty Combinations', () => {
      it('should combine tiered overtime with weekend penalties', () => {
        // TODO: Test 14-hour Saturday shift (weekend + first overtime + second overtime)
        // Should correctly calculate each tier with appropriate base rates
      })

      it('should handle public holiday overtime with time penalties', () => {
        // TODO: Test public holiday night shift with overtime
        // Should apply highest applicable rates correctly
      })
    })

    describe.skip('Rate Priority Resolution', () => {
      it('should prioritize overtime rates over penalty rates when overlapping', () => {
        // TODO: Test scenarios where overtime and penalty periods overlap
        // Should clearly document which rate takes precedence
      })

      it('should handle rate transitions within single continuous periods', () => {
        // TODO: Test smooth transitions between different penalty rates
        // Should avoid gaps or double-counting at boundaries
      })
    })

    describe.skip('Australian Timezone Calculations', () => {
      it('should correctly apply penalty rules in Sydney timezone', () => {
        // TODO: Test shift in Australia/Sydney with penalty rule times
        // Should correctly convert UTC to local for rule application
      })

      it('should correctly apply penalty rules in Brisbane timezone', () => {
        // TODO: Test same shift times in Australia/Brisbane (no DST)
        // Should produce different results due to timezone differences
      })

      it('should correctly apply penalty rules in Perth timezone', () => {
        // TODO: Test shift in Australia/Perth (3 hour difference)
        // Should correctly handle significant timezone offset
      })
    })

    describe.skip('Daylight Saving Time Transitions', () => {
      it('should handle shifts during DST transition (spring forward)', () => {
        // TODO: Test shift during DST start (2am becomes 3am)
        // Should correctly handle "missing" hour
      })

      it('should handle shifts during DST transition (fall back)', () => {
        // TODO: Test shift during DST end (3am becomes 2am)
        // Should correctly handle "extra" hour
      })
    })

    describe.skip('Cross-Timezone Consistency', () => {
      it('should produce consistent results across timezone configurations', () => {
        // TODO: Test same absolute times in different timezone configurations
        // Should ensure business logic consistency
      })
    })
  })
})
