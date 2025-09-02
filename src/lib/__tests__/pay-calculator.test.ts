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
  describe('Internal Period Calculation Functions', () => {
    describe('findLocalRulePeriods', () => {
      it('should find time periods within shift boundaries for evening penalty rules', () => {
        const calculator = new PayCalculator(
          retailPayGuide,
          retailPenaltyTimeFrames,
          retailOvertimeTimeFrames
        )

        const result = calculator.findLocalRulePeriods(
          new Date('2025-07-07T16:00:00+10:00'), // Monday 9am
          new Date('2025-07-07T21:00:00+10:00'), // Monday 5:30pm
          { startTime: '18:00', endTime: '21:00' }
        )

        expect(result).toStrictEqual([
          {
            start: new Date('2025-07-07T18:00:00+10:00'),
            end: new Date('2025-07-07T21:00:00+10:00'),
          },
        ])
      })

      it('should handle overnight time periods that span across midnight', () => {
        const calculator = new PayCalculator(
          retailPayGuide,
          retailPenaltyTimeFrames,
          retailOvertimeTimeFrames
        )

        const result = calculator.findLocalRulePeriods(
          new Date('2025-07-07T16:00:00+10:00'), // Monday 9am
          new Date('2025-07-08T04:00:00+10:00'), // Monday 5:30pm
          { startTime: '18:00', endTime: '06:00' }
        )

        expect(result).toStrictEqual([
          {
            start: new Date('2025-07-07T18:00:00+10:00'),
            end: new Date('2025-07-08T04:00:00+10:00'),
          },
        ])
      })
    })

    describe('findRulePeriods', () => {
      it('should apply Saturday penalty rules to weekend shift hours', () => {
        const calculator = new PayCalculator(
          retailPayGuide,
          retailPenaltyTimeFrames,
          retailOvertimeTimeFrames
        )

        const result = calculator.findRulePeriods(
          new Date('2025-07-05T10:00:00+10:00'), // Saturday 10am
          new Date('2025-07-06T04:00:00+10:00'), // Saturday 6pm
          retailPenaltyTimeFrames[2] // Saturday Penalty
        )

        expect(result).toStrictEqual([
          {
            start: new Date('2025-07-05T10:00:00+10:00'),
            end: new Date('2025-07-06T00:00:00+10:00'),
          },
        ])
      })

      it('should apply Saturday morning penalty rules during early hours', () => {
        const calculator = new PayCalculator(
          retailPayGuide,
          retailPenaltyTimeFrames,
          retailOvertimeTimeFrames
        )

        const result = calculator.findRulePeriods(
          new Date('2025-07-05T04:00:00+10:00'), // Saturday 4am
          new Date('2025-07-05T10:00:00+10:00'), // Saturday 10am
          retailPenaltyTimeFrames[1] // Saturday Morning Penalty
        )

        expect(result).toStrictEqual([
          {
            start: new Date('2025-07-05T04:00:00+10:00'),
            end: new Date('2025-07-05T07:00:00+10:00'),
          },
        ])
      })

      it('should apply Sunday overtime rules to weekend shift hours', () => {
        const calculator = new PayCalculator(
          retailPayGuide,
          retailPenaltyTimeFrames,
          retailOvertimeTimeFrames
        )

        const result = calculator.findRulePeriods(
          new Date('2025-07-06T09:00:00+10:00'), // Sunday 9am
          new Date('2025-07-06T17:00:00+10:00'), // Sunday 5pm
          retailOvertimeTimeFrames[1] // Sunday Overtime
        )

        expect(result).toStrictEqual([
          {
            start: new Date('2025-07-06T09:00:00+10:00'),
            end: new Date('2025-07-06T17:00:00+10:00'),
          },
        ])
      })
    })
  })

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
  })

  describe('Weekend Premium Rate Calculations', () => {
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
  })

  describe('Time-of-Day Premium Rate Calculations', () => {
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
  })

  describe.skip('Public Holiday Premium Rate Calculations', () => {
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
  })

  describe('Utility Function Validation', () => {
    it('should format decimal amounts as Australian currency strings', () => {
      expect(formatAustralianCurrency(new Decimal('25.41'))).toBe('$25.41')
      expect(formatAustralianCurrency(new Decimal('1234.56'))).toBe('$1234.56')
      expect(formatAustralianCurrency(new Decimal('0.99'))).toBe('$0.99')
      expect(formatAustralianCurrency(new Decimal('1000.00'))).toBe('$1000.00')
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
  })
})
