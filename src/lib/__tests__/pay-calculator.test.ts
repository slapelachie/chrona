/**
 * Blackbox PayCalculator Tests
 * 
 * These tests verify the PayCalculator from a user perspective without knowledge
 * of internal implementation. Tests focus on inputs, outputs, and expected Australian
 * pay calculation behavior for various scenarios.
 */

import { describe, it, expect } from 'vitest'
import { Decimal } from 'decimal.js'
import { PayCalculator, formatAustralianCurrency, calculateTotalHours } from '@/lib/calculations/pay-calculator'
import { PayGuide, PenaltyTimeFrame } from '@/types'

// Test data - Australian Retail Award 2020 rates
const retailPayGuide: PayGuide = {
  id: 'retail-award-2020',
  name: 'General Retail Industry Award 2020',
  baseRate: new Decimal('25.41'),
  casualLoading: new Decimal('0.25'),
  overtimeRules: {
    daily: {
      regularHours: 8,
      firstOvertimeRate: 1.5,
      firstOvertimeHours: 12,
      secondOvertimeRate: 2.0
    },
    weekly: {
      regularHours: 38,
      overtimeRate: 1.5
    }
  },
  description: 'Adult casual employee minimum rates',
  effectiveFrom: new Date('2024-07-01'),
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
}

const retailPenaltyTimeFrames: PenaltyTimeFrame[] = [
  {
    id: 'saturday-penalty',
    payGuideId: 'retail-award-2020',
    name: 'Saturday Penalty',
    multiplier: new Decimal('1.5'),
    dayOfWeek: 6, // Saturday
    isPublicHoliday: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'sunday-penalty',
    payGuideId: 'retail-award-2020',
    name: 'Sunday Penalty',
    multiplier: new Decimal('2.0'),
    dayOfWeek: 0, // Sunday
    isPublicHoliday: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'evening-penalty',
    payGuideId: 'retail-award-2020',
    name: 'Evening Penalty',
    multiplier: new Decimal('1.25'),
    startTime: '18:00',
    endTime: '23:59',
    isPublicHoliday: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'night-penalty',
    payGuideId: 'retail-award-2020',
    name: 'Night Penalty',
    multiplier: new Decimal('1.3'),
    startTime: '00:00',
    endTime: '06:00',
    isPublicHoliday: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'public-holiday-penalty',
    payGuideId: 'retail-award-2020',
    name: 'Public Holiday Penalty',
    multiplier: new Decimal('2.5'),
    isPublicHoliday: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
]

describe('PayCalculator - Blackbox Tests', () => {
  describe('Basic Shift Calculations', () => {
    it('should calculate pay for standard 8-hour weekday shift', () => {
      const calculator = new PayCalculator(retailPayGuide, retailPenaltyTimeFrames)
      
      const result = calculator.calculate(
        new Date('2024-01-15T09:00:00Z'), // Monday 9am
        new Date('2024-01-15T17:30:00Z'), // Monday 5:30pm
        30 // 30 minute break
      )

      expect(result.shift.totalHours.toString()).toBe('8.00')
      expect(result.breakdown.baseHours.toString()).toBe('8.00')
      expect(result.breakdown.basePay.toString()).toBe('203.28') // 8 * 25.41
      expect(result.breakdown.overtimeHours.toString()).toBe('0.00')
      expect(result.breakdown.overtimePay.toString()).toBe('0.00')
      expect(result.breakdown.penaltyHours.toString()).toBe('0.00')
      expect(result.breakdown.penaltyPay.toString()).toBe('0.00')
      expect(result.breakdown.casualPay.toString()).toBe('50.82') // 25% of base pay
      expect(result.breakdown.totalPay.toString()).toBe('254.10')
      expect(result.penalties).toHaveLength(0)
    })

    it('should calculate pay for shift with no break', () => {
      const calculator = new PayCalculator(retailPayGuide, retailPenaltyTimeFrames)
      
      const result = calculator.calculate(
        new Date('2024-01-15T09:00:00Z'), // Monday 9am
        new Date('2024-01-15T13:00:00Z'), // Monday 1pm
        0 // No break
      )

      expect(result.shift.totalHours.toString()).toBe('4.00')
      expect(result.breakdown.basePay.toString()).toBe('101.64') // 4 * 25.41
      expect(result.breakdown.casualPay.toString()).toBe('25.41') // 25% of base pay
      expect(result.breakdown.totalPay.toString()).toBe('127.05')
    })

    it('should calculate pay for very short shift', () => {
      const calculator = new PayCalculator(retailPayGuide, retailPenaltyTimeFrames)
      
      const result = calculator.calculate(
        new Date('2024-01-15T10:00:00Z'), // Monday 10am
        new Date('2024-01-15T11:30:00Z'), // Monday 11:30am
        15 // 15 minute break
      )

      expect(result.shift.totalHours.toString()).toBe('1.25') // 1.5 hours - 0.25 break
      expect(result.breakdown.basePay.toString()).toBe('31.76') // 1.25 * 25.41
      expect(result.breakdown.casualPay.toString()).toBe('7.94') // 25% of base pay
      expect(result.breakdown.totalPay.toString()).toBe('39.70')
    })
  })

  describe('Weekend Penalty Calculations', () => {
    it('should calculate Saturday penalty for full day shift', () => {
      const calculator = new PayCalculator(retailPayGuide, retailPenaltyTimeFrames)
      
      const result = calculator.calculate(
        new Date('2024-01-13T10:00:00Z'), // Saturday 10am
        new Date('2024-01-13T18:00:00Z'), // Saturday 6pm
        30 // 30 minute break
      )

      expect(result.shift.totalHours.toString()).toBe('7.50')
      expect(result.breakdown.baseHours.toString()).toBe('0.00') // All hours are penalty hours
      expect(result.breakdown.basePay.toString()).toBe('0.00')
      expect(result.breakdown.penaltyHours.toString()).toBe('7.50')
      expect(result.breakdown.penaltyPay.toString()).toBe('285.98') // 7.5 * 25.41 * 1.5
      expect(result.breakdown.casualPay.toString()).toBe('0.00') // Casual loading only on base pay
      expect(result.breakdown.totalPay.toString()).toBe('285.98')
      expect(result.penalties).toHaveLength(1)
      expect(result.penalties[0].name).toBe('Saturday Penalty')
      expect(result.penalties[0].multiplier.toString()).toBe('1.5')
    })

    it('should calculate Sunday penalty with higher rate', () => {
      const calculator = new PayCalculator(retailPayGuide, retailPenaltyTimeFrames)
      
      const result = calculator.calculate(
        new Date('2024-01-14T09:00:00Z'), // Sunday 9am
        new Date('2024-01-14T17:00:00Z'), // Sunday 5pm
        60 // 1 hour break
      )

      expect(result.shift.totalHours.toString()).toBe('7.00')
      expect(result.breakdown.penaltyHours.toString()).toBe('7.00')
      expect(result.breakdown.penaltyPay.toString()).toBe('355.74') // 7 * 25.41 * 2.0
      expect(result.breakdown.totalPay.toString()).toBe('355.74')
      expect(result.penalties[0].name).toBe('Sunday Penalty')
      expect(result.penalties[0].multiplier.toString()).toBe('2.0')
    })

    it('should handle shift spanning from Friday to Saturday', () => {
      const calculator = new PayCalculator(retailPayGuide, retailPenaltyTimeFrames)
      
      const result = calculator.calculate(
        new Date('2024-01-12T22:00:00Z'), // Friday 10pm
        new Date('2024-01-13T06:00:00Z'), // Saturday 6am
        30 // 30 minute break
      )

      expect(result.shift.totalHours.toString()).toBe('7.50')
      
      // Should have both regular hours (Friday) and penalty hours (Saturday)
      expect(result.breakdown.baseHours.toString()).toBe('1.50') // 2 hours on Friday - 0.5 break
      expect(result.breakdown.penaltyHours.toString()).toBe('6.00') // 6 hours on Saturday
      
      // Check penalties
      expect(result.penalties.some(p => p.name === 'Saturday Penalty')).toBe(true)
    })
  })

  describe('Time-Based Penalty Calculations', () => {
    it('should calculate evening penalty for weekday evening shift', () => {
      const calculator = new PayCalculator(retailPayGuide, retailPenaltyTimeFrames)
      
      const result = calculator.calculate(
        new Date('2024-01-15T16:00:00Z'), // Monday 4pm
        new Date('2024-01-15T22:00:00Z'), // Monday 10pm
        30 // 30 minute break
      )

      expect(result.shift.totalHours.toString()).toBe('5.50')
      
      // 2 hours regular (4pm-6pm), 3.5 hours evening penalty (6pm-10pm), minus 0.5 break
      expect(result.breakdown.baseHours.toString()).toBe('2.00')
      expect(result.breakdown.penaltyHours.toString()).toBe('3.50')
      expect(result.breakdown.penaltyPay.toString()).toBe('111.09') // 3.5 * 25.41 * 1.25
      
      expect(result.penalties).toHaveLength(1)
      expect(result.penalties[0].name).toBe('Evening Penalty')
    })

    it('should calculate night penalty for overnight shift', () => {
      const calculator = new PayCalculator(retailPayGuide, retailPenaltyTimeFrames)
      
      const result = calculator.calculate(
        new Date('2024-01-15T23:00:00Z'), // Monday 11pm
        new Date('2024-01-16T07:00:00Z'), // Tuesday 7am
        60 // 1 hour break
      )

      expect(result.shift.totalHours.toString()).toBe('7.00')
      
      // Should have night penalty for midnight to 6am
      const nightPenalty = result.penalties.find(p => p.name === 'Night Penalty')
      expect(nightPenalty).toBeTruthy()
      expect(nightPenalty!.hours.toString()).toBe('6.00') // 12am-6am
      expect(nightPenalty!.multiplier.toString()).toBe('1.3')
    })

    it('should handle shift crossing multiple time-based penalties', () => {
      const calculator = new PayCalculator(retailPayGuide, retailPenaltyTimeFrames)
      
      const result = calculator.calculate(
        new Date('2024-01-15T17:00:00Z'), // Monday 5pm
        new Date('2024-01-16T02:00:00Z'), // Tuesday 2am
        30 // 30 minute break
      )

      expect(result.shift.totalHours.toString()).toBe('8.50')
      
      // Should have both evening penalty (6pm-12am) and night penalty (12am-2am)
      const eveningPenalty = result.penalties.find(p => p.name === 'Evening Penalty')
      const nightPenalty = result.penalties.find(p => p.name === 'Night Penalty')
      
      expect(eveningPenalty).toBeTruthy()
      expect(nightPenalty).toBeTruthy()
      expect(eveningPenalty!.hours.toString()).toBe('6.00') // 6pm-12am
      expect(nightPenalty!.hours.toString()).toBe('2.00') // 12am-2am
    })
  })

  describe('Overtime Calculations', () => {
    it('should calculate first overtime rate for 9-hour shift', () => {
      const calculator = new PayCalculator(retailPayGuide, retailPenaltyTimeFrames)
      
      const result = calculator.calculate(
        new Date('2024-01-15T08:00:00Z'), // Monday 8am
        new Date('2024-01-15T17:30:00Z'), // Monday 5:30pm
        30 // 30 minute break
      )

      expect(result.shift.totalHours.toString()).toBe('9.00')
      expect(result.breakdown.baseHours.toString()).toBe('8.00') // Regular hours
      expect(result.breakdown.overtimeHours.toString()).toBe('1.00') // 1 hour overtime
      expect(result.breakdown.overtimePay.toString()).toBe('38.12') // 1 * 25.41 * 1.5
      expect(result.breakdown.casualPay.toString()).toBe('50.82') // 25% of base pay only
      
      const totalExpected = new Decimal('203.28') // base
        .plus('38.12') // overtime
        .plus('50.82') // casual loading
      expect(result.breakdown.totalPay.toString()).toBe(totalExpected.toString())
    })

    it('should calculate second overtime rate for 13-hour shift', () => {
      const calculator = new PayCalculator(retailPayGuide, retailPenaltyTimeFrames)
      
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
      const calculator = new PayCalculator(retailPayGuide, retailPenaltyTimeFrames)
      
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
      expect(parseFloat(result.breakdown.penaltyPay.toString())).toBeGreaterThan(0)
      expect(parseFloat(result.breakdown.overtimePay.toString())).toBeGreaterThan(0)
    })
  })

  describe('Public Holiday Calculations', () => {
    it('should calculate public holiday penalty for Christmas Day', () => {
      const calculator = new PayCalculator(retailPayGuide, retailPenaltyTimeFrames)
      
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
      const calculator = new PayCalculator(retailPayGuide, retailPenaltyTimeFrames)
      
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
      const calculator = new PayCalculator(retailPayGuide, retailPenaltyTimeFrames)
      
      const result = calculator.calculate(
        new Date('2024-01-13T16:00:00Z'), // Saturday 4pm
        new Date('2024-01-14T02:00:00Z'), // Sunday 2am
        30 // 30 minute break
      )

      expect(result.shift.totalHours.toString()).toBe('9.50')
      
      // Should have multiple penalties: Saturday, Sunday, Evening, Night
      expect(result.penalties.length).toBeGreaterThan(1)
      
      const penaltyNames = result.penalties.map(p => p.name)
      expect(penaltyNames).toContain('Saturday Penalty')
      expect(penaltyNames).toContain('Sunday Penalty')
    })

    it('should handle very long shift with multiple penalty types and overtime', () => {
      const calculator = new PayCalculator(retailPayGuide, retailPenaltyTimeFrames)
      
      const result = calculator.calculate(
        new Date('2024-01-13T14:00:00Z'), // Saturday 2pm
        new Date('2024-01-14T08:00:00Z'), // Sunday 8am
        90 // 1.5 hour break
      )

      expect(result.shift.totalHours.toString()).toBe('16.50')
      
      // Should have overtime (beyond 8 hours)
      expect(parseFloat(result.breakdown.overtimeHours.toString())).toBeGreaterThan(0)
      
      // Should have multiple penalty types
      expect(result.penalties.length).toBeGreaterThan(1)
      
      // Total pay should be substantial
      expect(parseFloat(result.breakdown.totalPay.toString())).toBeGreaterThan(500)
    })
  })

  describe('Edge Cases and Validation', () => {
    it('should throw error for end time before start time', () => {
      const calculator = new PayCalculator(retailPayGuide, retailPenaltyTimeFrames)
      
      expect(() => {
        calculator.calculate(
          new Date('2024-01-15T17:00:00Z'), // 5pm
          new Date('2024-01-15T09:00:00Z'), // 9am (before start)
          30
        )
      }).toThrow('End time must be after start time')
    })

    it('should throw error for negative break minutes', () => {
      const calculator = new PayCalculator(retailPayGuide, retailPenaltyTimeFrames)
      
      expect(() => {
        calculator.calculate(
          new Date('2024-01-15T09:00:00Z'),
          new Date('2024-01-15T17:00:00Z'),
          -30 // Negative break
        )
      }).toThrow('Break minutes cannot be negative')
    })

    it('should throw error for break minutes exceeding shift duration', () => {
      const calculator = new PayCalculator(retailPayGuide, retailPenaltyTimeFrames)
      
      expect(() => {
        calculator.calculate(
          new Date('2024-01-15T09:00:00Z'),
          new Date('2024-01-15T11:00:00Z'), // 2 hour shift
          150 // 2.5 hour break
        )
      }).toThrow('Break minutes cannot exceed shift duration')
    })

    it('should throw error for excessively long shift', () => {
      const calculator = new PayCalculator(retailPayGuide, retailPenaltyTimeFrames)
      
      expect(() => {
        calculator.calculate(
          new Date('2024-01-15T09:00:00Z'),
          new Date('2024-01-16T10:00:00Z'), // 25 hour shift
          0
        )
      }).toThrow('Shift duration cannot exceed 24 hours')
    })

    it('should handle zero break minutes correctly', () => {
      const calculator = new PayCalculator(retailPayGuide, retailPenaltyTimeFrames)
      
      const result = calculator.calculate(
        new Date('2024-01-15T09:00:00Z'),
        new Date('2024-01-15T17:00:00Z'), // 8 hours
        0 // No break
      )

      expect(result.shift.totalHours.toString()).toBe('8.00')
      expect(result.shift.breakMinutes).toBe(0)
    })

    it('should round all monetary amounts to cents', () => {
      const calculator = new PayCalculator(retailPayGuide, retailPenaltyTimeFrames)
      
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
      const calculator = new PayCalculator(retailPayGuide, retailPenaltyTimeFrames)
      
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
      const calculator = new PayCalculator(retailPayGuide, retailPenaltyTimeFrames)
      
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