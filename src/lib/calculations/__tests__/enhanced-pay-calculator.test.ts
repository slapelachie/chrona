import { describe, it, expect, beforeAll } from 'vitest'
import Decimal from 'decimal.js'
import { EnhancedPayCalculator } from '../enhanced-pay-calculator'

// Mock PayGuide with Australian retail award settings from example.json
const mockPayGuide = {
  id: 'test-payguide',
  name: 'MA000004 - General Retail Industry Award 2020',
  effectiveFrom: new Date('2025-07-01'),
  effectiveTo: null,
  isActive: true,
  userId: 'test-user',
  createdAt: new Date(),
  updatedAt: new Date(),
  
  // Rates from example.json
  baseHourlyRate: new Decimal(26.55), // Level 1 casual (includes 25% loading)
  casualLoading: new Decimal(0.0), // No additional loading
  
  // Overtime rates
  overtimeRate1_5x: new Decimal(1.75), // 175% for Mon-Sat first 3 hours
  overtimeRate2x: new Decimal(2.25), // 225% for Mon-Sat after 3 hours, all Sunday
  
  // Penalty rates
  eveningPenalty: new Decimal(1.5), // 150% Mon-Fri after 6pm
  nightPenalty: new Decimal(1.0), // No night penalty for retail
  saturdayPenalty: new Decimal(1.5), // 150% Saturday
  sundayPenalty: new Decimal(1.75), // 175% Sunday
  publicHolidayPenalty: new Decimal(2.5), // 250% public holidays
  
  // Time boundaries
  eveningStart: '18:00',
  eveningEnd: '23:59',
  nightStart: '00:00',
  nightEnd: '06:00',
  
  // Span of ordinary hours
  mondayStart: '07:00',
  mondayEnd: '21:00',
  tuesdayStart: '07:00',
  tuesdayEnd: '21:00',
  wednesdayStart: '07:00',
  wednesdayEnd: '21:00',
  thursdayStart: '07:00',
  thursdayEnd: '21:00',
  fridayStart: '07:00',
  fridayEnd: '21:00',
  saturdayStart: '07:00',
  saturdayEnd: '18:00',
  sundayStart: '09:00',
  sundayEnd: '18:00',
  
  // Overtime thresholds
  dailyOvertimeHours: new Decimal(9.0), // OT after 9 hours (non-Monday)
  specialDayOvertimeHours: new Decimal(11.0), // Monday can work 11 hours
  weeklyOvertimeHours: new Decimal(38.0),
  
  // Overtime triggers
  overtimeOnSpanBoundary: true,
  overtimeOnDailyLimit: true,
  overtimeOnWeeklyLimit: true,
  
  allowPenaltyCombination: false,
  penaltyCombinationRules: null,
  
  shifts: []
}

describe('EnhancedPayCalculator - Australian Retail Award Tests', () => {
  let calculator: EnhancedPayCalculator
  
  beforeAll(() => {
    calculator = new EnhancedPayCalculator(mockPayGuide, [])
  })

  describe('Example C1: Weeknight 5pm-10pm', () => {
    it('should calculate pay correctly for Monday 17:00-22:00 shift', () => {
      // Monday 17:00–22:00 (5 hours total)
      const startTime = new Date('2025-07-07T17:00:00') // Monday
      const endTime = new Date('2025-07-07T22:00:00')
      
      const result = calculator.calculateShift(startTime, endTime, 0)
      
      // Expected from example.json:
      // - 1h ordinary (17:00-18:00): 1.25x base = 33.19
      // - 3h evening penalty (18:00-21:00): 1.5x base = 119.48
      // - 1h overtime (21:00-22:00): 1.75x base = 46.46
      // Total: 199.13
      
      expect(result.grossPay.toNumber()).toBeCloseTo(199.13, 2)
      expect(result.regularHours.toNumber()).toBe(1.0)
      expect(result.overtimeHours.toNumber()).toBe(1.0)
    })
  })

  describe('Example C2: Saturday 8 hours', () => {
    it('should calculate pay correctly for Saturday 08:00-16:00 shift', () => {
      // Saturday 08:00–16:00 (8 hours within Saturday span)
      const startTime = new Date('2025-07-05T08:00:00') // Saturday
      const endTime = new Date('2025-07-05T16:00:00')
      
      const result = calculator.calculateShift(startTime, endTime, 0)
      
      // Expected from example.json:
      // - 8h Saturday penalty: 1.5x base = 318.60
      // Total: 318.60
      
      expect(result.grossPay.toNumber()).toBeCloseTo(318.60, 2)
      expect(result.penaltyHours.toNumber()).toBe(8.0)
    })
  })

  describe('Example C3: Sunday 8 hours', () => {
    it('should calculate pay correctly for Sunday 10:00-18:00 shift', () => {
      // Sunday 10:00–18:00 (8 hours within Sunday span)
      const startTime = new Date('2025-07-06T10:00:00') // Sunday
      const endTime = new Date('2025-07-06T18:00:00')
      
      const result = calculator.calculateShift(startTime, endTime, 0)
      
      // Expected from example.json:
      // - 8h Sunday penalty: 1.75x base = 371.70
      // Total: 371.70
      
      expect(result.grossPay.toNumber()).toBeCloseTo(371.70, 2)
      expect(result.penaltyHours.toNumber()).toBe(8.0)
    })
  })

  describe('Example C4: Sunday with overtime', () => {
    it('should calculate pay correctly for Sunday 11:00-19:30 shift', () => {
      // Sunday 11:00–19:30 (8.5 hours, 1.5h outside span)
      const startTime = new Date('2025-07-06T11:00:00') // Sunday
      const endTime = new Date('2025-07-06T19:30:00')
      
      const result = calculator.calculateShift(startTime, endTime, 0)
      
      // Expected from example.json:
      // - 7h Sunday penalty (11:00-18:00): 1.75x base = 325.24
      // - 1.5h Sunday overtime (18:00-19:30): 2.25x base = 89.61
      // Total: 414.85
      
      expect(result.grossPay.toNumber()).toBeCloseTo(414.85, 2)
      expect(result.penaltyHours.toNumber()).toBe(7.0)
      expect(result.overtimeHours.toNumber()).toBe(1.5)
    })
  })

  describe('Example C5: Weekday long day within limits', () => {
    it('should calculate pay correctly for Tuesday 08:00-19:00 shift (11h allowed)', () => {
      // Tuesday 08:00–19:00 (11 hours - this is the one permitted 11-hour day)
      const startTime = new Date('2025-07-08T08:00:00') // Tuesday
      const endTime = new Date('2025-07-08T19:00:00')
      
      const result = calculator.calculateShift(startTime, endTime, 0)
      
      // Expected from example.json:
      // - 10h ordinary (08:00-18:00): 1.25x base = 331.88
      // - 1h evening penalty (18:00-19:00): 1.5x base = 39.83
      // Total: 371.70
      
      expect(result.grossPay.toNumber()).toBeCloseTo(371.70, 2)
      expect(result.regularHours.toNumber()).toBe(10.0)
    })
  })

  describe('Example C6: Weekday exceeding 9h triggering OT', () => {
    it('should calculate pay correctly for Friday 09:00-19:30 shift (10.5h with OT)', () => {
      // Friday 09:00–19:30 (10.5 hours, OT after 9 hours)
      const startTime = new Date('2025-07-11T09:00:00') // Friday
      const endTime = new Date('2025-07-11T19:30:00')
      
      const result = calculator.calculateShift(startTime, endTime, 0)
      
      // Expected from example.json:
      // - 9h ordinary (09:00-18:00): 1.25x base = 298.69
      // - 1.5h overtime (18:00-19:30): 1.75x base = 69.69
      // Total: 368.38
      
      expect(result.grossPay.toNumber()).toBeCloseTo(368.38, 2)
      expect(result.regularHours.toNumber()).toBe(9.0)
      expect(result.overtimeHours.toNumber()).toBe(1.5)
    })
  })

  describe('Example C7: Public holiday', () => {
    it('should calculate pay correctly for public holiday Monday 09:00-17:00', () => {
      // Public holiday Monday 09:00–17:00 (8 hours)
      const startTime = new Date('2025-01-27T09:00:00') // Australia Day
      const endTime = new Date('2025-01-27T17:00:00')
      
      // Add Australia Day as public holiday
      const publicHolidays = [
        { 
          id: 'australia-day',
          name: 'Australia Day',
          date: new Date('2025-01-27'),
          state: 'NATIONAL',
          createdAt: new Date()
        }
      ]
      
      const calculatorWithHoliday = new EnhancedPayCalculator(mockPayGuide, publicHolidays)
      const result = calculatorWithHoliday.calculateShift(startTime, endTime, 0)
      
      // Expected from example.json:
      // - 8h public holiday: 2.5x base = 531.00
      // Total: 531.00
      
      expect(result.grossPay.toNumber()).toBeCloseTo(531.00, 2)
      expect(result.penaltyHours.toNumber()).toBe(8.0)
    })
  })

  describe('Example C8: Sunday Level 2 rate', () => {
    it('should calculate pay correctly for Level 2 Sunday 10:00-16:00', () => {
      // Create Level 2 pay guide
      const level2PayGuide = {
        ...mockPayGuide,
        baseHourlyRate: new Decimal(27.16) // Level 2 casual rate
      }
      
      const level2Calculator = new EnhancedPayCalculator(level2PayGuide, [])
      
      // Sunday 10:00–16:00 (6 hours)
      const startTime = new Date('2025-07-06T10:00:00') // Sunday
      const endTime = new Date('2025-07-06T16:00:00')
      
      const result = level2Calculator.calculateShift(startTime, endTime, 0)
      
      // Expected from example.json:
      // - 6h Sunday penalty: 1.75x 27.16 = 285.18
      // Total: 285.18
      
      expect(result.grossPay.toNumber()).toBeCloseTo(285.18, 2)
      expect(result.penaltyHours.toNumber()).toBe(6.0)
    })
  })

  describe('Base rate validation', () => {
    it('should use base rate that includes casual loading', () => {
      // The base rate should be 26.55 which includes 25% casual loading
      // (21.24 * 1.25 = 26.55)
      expect(mockPayGuide.baseHourlyRate.toNumber()).toBe(26.55)
      expect(mockPayGuide.casualLoading.toNumber()).toBe(0.0)
    })
  })

  describe('Penalty rate validation', () => {
    it('should have correct penalty multipliers', () => {
      expect(mockPayGuide.eveningPenalty.toNumber()).toBe(1.5) // 150%
      expect(mockPayGuide.saturdayPenalty.toNumber()).toBe(1.5) // 150%
      expect(mockPayGuide.sundayPenalty.toNumber()).toBe(1.75) // 175%
      expect(mockPayGuide.publicHolidayPenalty.toNumber()).toBe(2.5) // 250%
    })
  })

  describe('Overtime rate validation', () => {
    it('should have correct overtime multipliers', () => {
      expect(mockPayGuide.overtimeRate1_5x.toNumber()).toBe(1.75) // 175%
      expect(mockPayGuide.overtimeRate2x.toNumber()).toBe(2.25) // 225%
    })
  })
})