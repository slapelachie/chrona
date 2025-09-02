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
  describe('Period Calculation Utilties', () => {
    describe('findLocalRulePeriods', () => {
      it('should calculate period correctly', () => {
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

      it('should calculate overnight period correctly', () => {
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
      it('should calculate Saturday penalty period correctly', () => {
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

      it('should calculate Saturday morning penalty period correctly', () => {
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

      it('should calculate overtime periods for Sunday overtime', () => {
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

  describe('Basic Shift Calculations', () => {
    it('should calculate pay for standard 8-hour weekday shift', () => {
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

    it('should calculate pay for shift with no break', () => {
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

    it('should calculate pay for very short shift', () => {
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

  describe.only('Weekend Penalty Calculations', () => {
    it('should calculate Saturday penalty for full day shift', () => {
      const calculator = new PayCalculator(
        retailPayGuide,
        retailPenaltyTimeFrames,
        retailOvertimeTimeFrames
      )

      // 30 minute break
      const breakPeriods: BreakPeriod[] = [
        {
          startTime: new Date('2025-07-05T13:00:00'),
          endTime: new Date('2025-07-05T13:30:00'),
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

    it('should calculate Sunday penalty for full day shift', () => {
      const calculator = new PayCalculator(
        retailPayGuide,
        retailPenaltyTimeFrames,
        retailOvertimeTimeFrames
      )

      const result = calculator.calculate(
        new Date('2025-07-06T09:00:00+10:00'), // Sunday 9am
        new Date('2025-07-06T18:00:00+10:00'), // Sunday 6pm
        30
      )

      expect(result.shift.totalHours.toString()).toBe('8.5')
      expect(result.breakdown.penaltyHours.toString()).toBe('8.5')
      expect(result.breakdown.penaltyPay.toString()).toBe('394.93') // 8.5 * 26.55 * 1.75
      expect(result.breakdown.totalPay.toString()).toBe('394.93')
      expect(result.penalties[0].name).toBe('Sunday Penalty')
      expect(result.penalties[0].multiplier.toString()).toBe('1.75')
    })

    it('should handle shift spanning from Friday to Saturday', () => {
      const calculator = new PayCalculator(
        retailPayGuide,
        retailPenaltyTimeFrames,
        retailOvertimeTimeFrames
      )

      const result = calculator.calculate(
        new Date('2025-07-04T22:00:00'), // Friday 10pm
        new Date('2025-07-05T06:00:00'), // Saturday 6am
        30 // 30 minute break
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
      expect(nightPenalty!.hours.toString()).toBe('1.875') // Friday 10pm-12am (2h - proportional break)
      expect(nightPenalty!.multiplier.toString()).toBe('1.75')

      expect(satMorningPenalty).toBeTruthy()
      expect(satMorningPenalty!.hours.toString()).toBe('5.625') // Saturday 12am-6am minus proportional break
      expect(satMorningPenalty!.multiplier.toString()).toBe('1.75')
    })
  })

  describe('Time-Based Penalty Calculations', () => {
    it('should calculate evening penalty for weekday evening shift', () => {
      const calculator = new PayCalculator(
        retailPayGuide,
        retailPenaltyTimeFrames,
        retailOvertimeTimeFrames
      )

      const result = calculator.calculate(
        new Date('2025-07-07T16:00:00'), // Monday 4pm
        new Date('2025-07-07T22:00:00'), // Monday 10pm
        30 // 30 minute break
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
      expect(casualLoading!.hours.toString()).toBe('1.8333333333333333333') // 4pm-6pm (2h - proportional break)
      expect(casualLoading!.multiplier.toString()).toBe('1.25')
      expect(casualLoading!.pay.toString()).toBe('60.84')

      expect(eveningPenalty).toBeTruthy()
      expect(eveningPenalty!.hours.toString()).toBe('2.75') // 6pm-9pm (3h - proportional break)
      expect(eveningPenalty!.multiplier.toString()).toBe('1.5')
      expect(eveningPenalty!.pay.toString()).toBe('109.52')

      expect(nightPenalty).toBeTruthy()
      expect(nightPenalty!.hours.toString()).toBe('0.91666666666666666667') // Saturday 12am-6am minus proportional break
      expect(nightPenalty!.multiplier.toString()).toBe('1.75')
      expect(nightPenalty!.pay.toString()).toBe('42.59')

      expect(result.breakdown.penaltyHours.toString()).toBe('5.5')
      expect(result.breakdown.penaltyPay.toString()).toBe('212.95')

      expect(result.breakdown.totalPay.toString()).toBe('212.95')

      expect(result.penalties).toHaveLength(3)
    })

    it('should calculate night penalty for overnight shift', () => {
      const calculator = new PayCalculator(
        retailPayGuide,
        retailPenaltyTimeFrames,
        retailOvertimeTimeFrames
      )

      const result = calculator.calculate(
        new Date('2025-07-07T23:00:00'), // Monday 11pm
        new Date('2025-07-08T07:00:00'), // Tuesday 7am
        30 // 1 hour break
      )

      expect(result.shift.totalHours.toString()).toBe('7.5')

      const nightPenalty = result.penalties.find(
        (p) => p.name === 'Night Penalty'
      )
      const earlyMorningPenalty = result.penalties.find(
        (p) => p.name === 'Early Morning Penalty'
      )

      expect(nightPenalty).toBeTruthy()
      expect(nightPenalty!.hours.toString()).toBe('0.9375') // Monday 11pm - Tuesday 12am minus proportional break
      expect(nightPenalty!.multiplier.toString()).toBe('1.75')
      expect(nightPenalty!.pay.toString()).toBe('43.56')

      expect(earlyMorningPenalty).toBeTruthy()
      expect(earlyMorningPenalty!.hours.toString()).toBe('6.5625') // Saturday 12am-6am minus proportional break
      expect(earlyMorningPenalty!.multiplier.toString()).toBe('1.75')
      expect(earlyMorningPenalty!.pay.toString()).toBe('304.91')

      expect(result.breakdown.penaltyHours.toString()).toBe('7.5')
      expect(result.breakdown.penaltyPay.toString()).toBe('348.47')

      expect(result.breakdown.totalPay.toString()).toBe('348.47')

      expect(result.penalties).toHaveLength(2)
    })
  })

  describe('Overtime Calculations', () => {
    it('should calculate first overtime rate for 12-hour shift', () => {
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

      console.log(result)

      expect(result.shift.totalHours.toString()).toBe('12')
      expect(result.breakdown.baseHours.toString()).toBe('0')
      expect(result.breakdown.penaltyHours.toString()).toBe('10')
      expect(result.breakdown.penaltyPay.toString()).toBe('331.88')
      expect(result.breakdown.overtimeHours.toString()).toBe('1') // 1 hour overtime
      expect(result.breakdown.overtimePay.toString()).toBe('46.46') // 1 * 26.55 * 1.75

      const totalExpected = new Decimal('0') // base
        .plus('') // overtime
        .plus('50.82') // casual loading
      expect(result.breakdown.totalPay.toString()).toBe(
        totalExpected.toString()
      )
    })

    it('should calculate second overtime rate for 13-hour shift', () => {
      const calculator = new PayCalculator(
        retailPayGuide,
        retailPenaltyTimeFrames
      )

      const result = calculator.calculate(
        new Date('2024-01-15T06:00:00Z'), // Monday 6am
        new Date('2024-01-15T19:30:00Z'), // Monday 7:30pm
        30 // 30 minute break
      )

      expect(result.shift.totalHours.toString()).toBe('13.00')
      expect(result.breakdown.baseHours.toString()).toBe('8.00') // Regular hours
      expect(result.breakdown.overtimeHours.toString()).toBe('5.00') // 5 hours overtime

      // Overtime should be calculated at second overtime rate (2.0x)
      expect(result.breakdown.overtimePay.toString()).toBe('254.10') // 5 * 25.41 * 2.0
    })

    it('should handle overtime combined with weekend penalty', () => {
      const calculator = new PayCalculator(
        retailPayGuide,
        retailPenaltyTimeFrames
      )

      const result = calculator.calculate(
        new Date('2024-01-13T08:00:00Z'), // Saturday 8am
        new Date('2024-01-13T19:00:00Z'), // Saturday 7pm
        60 // 1 hour break
      )

      expect(result.shift.totalHours.toString()).toBe('10.00')

      // All hours should be penalty hours (Saturday), with overtime rates applied
      expect(result.breakdown.penaltyHours.toString()).toBe('10.00')
      expect(result.breakdown.baseHours.toString()).toBe('0.00')
      expect(result.breakdown.overtimeHours.toString()).toBe('2.00') // Hours beyond 8

      // Should have both penalty pay and overtime pay
      expect(
        parseFloat(result.breakdown.penaltyPay.toString())
      ).toBeGreaterThan(0)
      expect(
        parseFloat(result.breakdown.overtimePay.toString())
      ).toBeGreaterThan(0)
    })

    it('should calculate Sunday overtime periods correctly', () => {
      const calculator = new PayCalculator(
        retailPayGuide,
        retailPenaltyTimeFrames,
        retailOvertimeTimeFrames
      )

      const result = calculator.calculate(
        new Date('2025-07-06T09:00:00+10:00'), // Sunday 9am
        new Date('2025-07-06T17:00:00+10:00'), // Sunday 5pm
        60 // 1 hour break
      )

      expect(result.shift.totalHours.toString()).toBe('7.00')

      // Should have overtime periods applied for Sunday work
      expect(result.overtimes).toHaveLength(1)
      expect(result.overtimes[0].name).toBe('Overtime (Sun)')
      expect(result.overtimes[0].hours.toString()).toBe('7.00')
      expect(result.overtimes[0].multiplier.toString()).toBe('2.0')

      // Should also have Sunday penalty
      expect(result.penalties).toHaveLength(1)
      expect(result.penalties[0].name).toBe('Sunday Penalty')
    })

    it('should calculate overtime period exactly 3 hours correctly', () => {
      const calculator = new PayCalculator(
        retailPayGuide,
        retailPenaltyTimeFrames,
        retailOvertimeTimeFrames
      )

      const result = calculator.calculate(
        new Date('2025-07-06T09:00:00+10:00'), // Sunday 9am
        new Date('2025-07-06T12:00:00+10:00'), // Sunday 12pm (exactly 3 hours)
        0 // No break
      )

      expect(result.shift.totalHours.toString()).toBe('3.00')

      // Should have single overtime entry for exactly 3 hours
      expect(result.overtimes).toHaveLength(1)
      expect(result.overtimes[0].name).toBe('Overtime (Sun)')
      expect(result.overtimes[0].hours.toString()).toBe('3.00')
      expect(result.overtimes[0].multiplier.toString()).toBe('2.0')

      // Pay should be 3 * $26.55 * 2.0 = $159.30
      expect(result.overtimes[0].pay.toString()).toBe('159.30')
    })

    it('should split overtime periods longer than 3 hours correctly', () => {
      const calculator = new PayCalculator(
        retailPayGuide,
        retailPenaltyTimeFrames,
        retailOvertimeTimeFrames
      )

      const result = calculator.calculate(
        new Date('2025-07-06T09:00:00+10:00'), // Sunday 9am
        new Date('2025-07-06T14:00:00+10:00'), // Sunday 2pm (5 hours)
        0 // No break
      )

      expect(result.shift.totalHours.toString()).toBe('5.00')

      // Should have two overtime entries: first 3 hours and remaining 2 hours
      expect(result.overtimes).toHaveLength(2)

      // First 3 hours at 2.0x rate
      const firstPeriod = result.overtimes.find((ot) =>
        ot.name.includes('first 3 hours')
      )
      expect(firstPeriod).toBeTruthy()
      expect(firstPeriod!.hours.toString()).toBe('3.00')
      expect(firstPeriod!.multiplier.toString()).toBe('2.0')
      expect(firstPeriod!.pay.toString()).toBe('159.30') // 3 * $26.55 * 2.0

      // Remaining 2 hours at 2.0x rate (same for Sunday)
      const afterPeriod = result.overtimes.find((ot) =>
        ot.name.includes('after 3 hours')
      )
      expect(afterPeriod).toBeTruthy()
      expect(afterPeriod!.hours.toString()).toBe('2.00')
      expect(afterPeriod!.multiplier.toString()).toBe('2.0')
      expect(afterPeriod!.pay.toString()).toBe('106.20') // 2 * $26.55 * 2.0
    })

    it('should handle Monday-Saturday overtime periods longer than 3 hours', () => {
      const calculator = new PayCalculator(
        retailPayGuide,
        [],
        retailOvertimeTimeFrames
      )

      // Create a Mon-Sat overtime timeframe for testing
      const mondaySatOvertimeFrame: OvertimeTimeFrame = {
        id: 'test-mon-sat-ot',
        payGuideId: 'ma000004-retail-award-2025',
        name: 'Test Mon-Sat Overtime',
        firstThreeHoursMult: new Decimal('1.5'),
        afterThreeHoursMult: new Decimal('2.0'),
        dayOfWeek: 1, // Monday
        startTime: '08:00',
        endTime: '18:00',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const testCalculator = new PayCalculator(
        retailPayGuide,
        [],
        [mondaySatOvertimeFrame]
      )

      const result = testCalculator.calculate(
        new Date('2025-07-07T08:00:00+10:00'), // Monday 8am
        new Date('2025-07-07T13:00:00+10:00'), // Monday 1pm (5 hours)
        0 // No break
      )

      expect(result.shift.totalHours.toString()).toBe('5.00')

      // Should have two overtime entries with different rates
      expect(result.overtimes).toHaveLength(2)

      // First 3 hours at 1.5x rate
      const firstPeriod = result.overtimes.find((ot) =>
        ot.name.includes('first 3 hours')
      )
      expect(firstPeriod!.hours.toString()).toBe('3.00')
      expect(firstPeriod!.multiplier.toString()).toBe('1.5')
      expect(firstPeriod!.pay.toString()).toBe('119.48') // 3 * $26.55 * 1.5

      // Remaining 2 hours at 2.0x rate
      const afterPeriod = result.overtimes.find((ot) =>
        ot.name.includes('after 3 hours')
      )
      expect(afterPeriod!.hours.toString()).toBe('2.00')
      expect(afterPeriod!.multiplier.toString()).toBe('2.0')
      expect(afterPeriod!.pay.toString()).toBe('106.20') // 2 * $26.55 * 2.0
    })

    it('should ignore overtime timeframes with invalid multipliers', () => {
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
        0
      )

      // Should have no overtime periods due to invalid multiplier
      expect(result.overtimes).toHaveLength(0)
    })
  })

  describe('Public Holiday Calculations', () => {
    it('should calculate public holiday penalty for Christmas Day', () => {
      const calculator = new PayCalculator(
        retailPayGuide,
        retailPenaltyTimeFrames
      )

      const result = calculator.calculate(
        new Date('2024-12-25T10:00:00Z'), // Christmas Day 10am
        new Date('2024-12-25T18:00:00Z'), // Christmas Day 6pm
        30 // 30 minute break
      )

      expect(result.shift.totalHours.toString()).toBe('7.50')
      expect(result.breakdown.penaltyHours.toString()).toBe('7.50')
      expect(result.breakdown.penaltyPay.toString()).toBe('476.64') // 7.5 * 25.41 * 2.5

      expect(result.penalties).toHaveLength(1)
      expect(result.penalties[0].name).toBe('Public Holiday Penalty')
      expect(result.penalties[0].multiplier.toString()).toBe('2.5')
    })

    it('should calculate public holiday penalty for ANZAC Day', () => {
      const calculator = new PayCalculator(
        retailPayGuide,
        retailPenaltyTimeFrames
      )

      const result = calculator.calculate(
        new Date('2024-04-25T09:00:00Z'), // ANZAC Day 9am
        new Date('2024-04-25T17:00:00Z'), // ANZAC Day 5pm
        60 // 1 hour break
      )

      expect(result.shift.totalHours.toString()).toBe('7.00')
      expect(result.breakdown.penaltyPay.toString()).toBe('444.64') // 7 * 25.41 * 2.5
      expect(result.penalties[0].name).toBe('Public Holiday Penalty')
    })
  })

  describe('Complex Scenario Calculations', () => {
    it('should handle Saturday shift with evening and night penalties', () => {
      const calculator = new PayCalculator(
        retailPayGuide,
        retailPenaltyTimeFrames
      )

      const result = calculator.calculate(
        new Date('2024-01-13T16:00:00Z'), // Saturday 4pm
        new Date('2024-01-14T02:00:00Z'), // Sunday 2am
        30 // 30 minute break
      )

      expect(result.shift.totalHours.toString()).toBe('9.50')

      // Should have multiple penalties: Saturday, Sunday, Evening, Night
      expect(result.penalties.length).toBeGreaterThan(1)

      const penaltyNames = result.penalties.map((p) => p.name)
      expect(penaltyNames).toContain('Saturday Penalty')
      expect(penaltyNames).toContain('Sunday Penalty')
    })

    it('should handle very long shift with multiple penalty types and overtime', () => {
      const calculator = new PayCalculator(
        retailPayGuide,
        retailPenaltyTimeFrames
      )

      const result = calculator.calculate(
        new Date('2024-01-13T14:00:00Z'), // Saturday 2pm
        new Date('2024-01-14T08:00:00Z'), // Sunday 8am
        90 // 1.5 hour break
      )

      expect(result.shift.totalHours.toString()).toBe('16.50')

      // Should have overtime (beyond 8 hours)
      expect(
        parseFloat(result.breakdown.overtimeHours.toString())
      ).toBeGreaterThan(0)

      // Should have multiple penalty types
      expect(result.penalties.length).toBeGreaterThan(1)

      // Total pay should be substantial
      expect(parseFloat(result.breakdown.totalPay.toString())).toBeGreaterThan(
        500
      )
    })
  })

  describe('Edge Cases and Validation', () => {
    it('should throw error for end time before start time', () => {
      const calculator = new PayCalculator(
        retailPayGuide,
        retailPenaltyTimeFrames
      )

      expect(() => {
        calculator.calculate(
          new Date('2024-01-15T17:00:00Z'), // 5pm
          new Date('2024-01-15T09:00:00Z'), // 9am (before start)
          30
        )
      }).toThrow('End time must be after start time')
    })

    it('should throw error for negative break minutes', () => {
      const calculator = new PayCalculator(
        retailPayGuide,
        retailPenaltyTimeFrames
      )

      expect(() => {
        calculator.calculate(
          new Date('2024-01-15T09:00:00Z'),
          new Date('2024-01-15T17:00:00Z'),
          -30 // Negative break
        )
      }).toThrow('Break minutes cannot be negative')
    })

    it('should throw error for break minutes exceeding shift duration', () => {
      const calculator = new PayCalculator(
        retailPayGuide,
        retailPenaltyTimeFrames
      )

      expect(() => {
        calculator.calculate(
          new Date('2024-01-15T09:00:00Z'),
          new Date('2024-01-15T11:00:00Z'), // 2 hour shift
          150 // 2.5 hour break
        )
      }).toThrow('Break minutes cannot exceed shift duration')
    })

    it('should throw error for excessively long shift', () => {
      const calculator = new PayCalculator(
        retailPayGuide,
        retailPenaltyTimeFrames
      )

      expect(() => {
        calculator.calculate(
          new Date('2024-01-15T09:00:00Z'),
          new Date('2024-01-16T10:00:00Z'), // 25 hour shift
          0
        )
      }).toThrow('Shift duration cannot exceed 24 hours')
    })

    it('should handle zero break minutes correctly', () => {
      const calculator = new PayCalculator(
        retailPayGuide,
        retailPenaltyTimeFrames
      )

      const result = calculator.calculate(
        new Date('2024-01-15T09:00:00Z'),
        new Date('2024-01-15T17:00:00Z'), // 8 hours
        0 // No break
      )

      expect(result.shift.totalHours.toString()).toBe('8.00')
      expect(result.shift.breakMinutes).toBe(0)
    })

    it('should round all monetary amounts to cents', () => {
      const calculator = new PayCalculator(
        retailPayGuide,
        retailPenaltyTimeFrames
      )

      const result = calculator.calculate(
        new Date('2024-01-15T09:00:00Z'),
        new Date('2024-01-15T12:20:00Z'), // 3 hours 20 minutes
        0
      )

      // All monetary amounts should have exactly 2 decimal places
      expect(result.breakdown.basePay.decimalPlaces()).toBe(2)
      expect(result.breakdown.casualPay.decimalPlaces()).toBe(2)
      expect(result.breakdown.totalPay.decimalPlaces()).toBe(2)
    })
  })

  describe('Utility Functions', () => {
    it('should format Australian currency correctly', () => {
      expect(formatAustralianCurrency(new Decimal('25.41'))).toBe('$25.41')
      expect(formatAustralianCurrency(new Decimal('1234.56'))).toBe('$1234.56')
      expect(formatAustralianCurrency(new Decimal('0.99'))).toBe('$0.99')
      expect(formatAustralianCurrency(new Decimal('1000.00'))).toBe('$1000.00')
    })

    it('should calculate total hours correctly', () => {
      const hours1 = calculateTotalHours(
        new Date('2024-01-15T09:00:00Z'),
        new Date('2024-01-15T17:00:00Z'),
        30
      )
      expect(hours1.toString()).toBe('7.50')

      const hours2 = calculateTotalHours(
        new Date('2024-01-15T09:00:00Z'),
        new Date('2024-01-15T17:30:00Z'),
        0
      )
      expect(hours2.toString()).toBe('8.50')

      const hours3 = calculateTotalHours(
        new Date('2024-01-15T09:15:00Z'),
        new Date('2024-01-15T17:45:00Z'),
        15
      )
      expect(hours3.toString()).toBe('8.25')
    })
  })

  describe('Accuracy Against Real Australian Payslips', () => {
    it('should match expected pay for typical retail casual shift', () => {
      // Based on real Australian retail award rates
      const calculator = new PayCalculator(
        retailPayGuide,
        retailPenaltyTimeFrames
      )

      const result = calculator.calculate(
        new Date('2024-01-15T09:00:00Z'), // Monday 9am
        new Date('2024-01-15T17:00:00Z'), // Monday 5pm
        30 // 30 minute break
      )

      // 7.5 hours at $25.41 = $190.58 base
      // + 25% casual loading = $47.65
      // Total = $238.23
      expect(result.breakdown.basePay.toString()).toBe('190.58')
      expect(result.breakdown.casualPay.toString()).toBe('47.65')
      expect(result.breakdown.totalPay.toString()).toBe('238.23')
    })

    it('should match expected pay for weekend shift with penalty', () => {
      const calculator = new PayCalculator(
        retailPayGuide,
        retailPenaltyTimeFrames
      )

      const result = calculator.calculate(
        new Date('2024-01-13T10:00:00Z'), // Saturday 10am
        new Date('2024-01-13T16:00:00Z'), // Saturday 4pm
        30 // 30 minute break
      )

      // 5.5 hours at Saturday penalty rate (150% of $25.41 = $38.12)
      // = 5.5 * $38.12 = $209.66
      expect(result.breakdown.penaltyPay.toString()).toBe('209.66')
      expect(result.breakdown.totalPay.toString()).toBe('209.66')
    })
  })
})
