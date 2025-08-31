import { describe, it, expect, beforeAll } from 'vitest'
import Decimal from 'decimal.js'
import { RetailPayCalculator } from '../retail-pay-calculator'

// Mock PayGuide with Australian retail award settings from example.json
const mockPayGuide = {
  id: 'test-payguide',
  name: 'MA000004 - General Retail Industry Award 2020 - Level 1',
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
  dailyOvertimeHours: new Decimal(9.0),
  specialDayOvertimeHours: new Decimal(11.0),
  weeklyOvertimeHours: new Decimal(38.0),
  
  // Overtime triggers
  overtimeOnSpanBoundary: true,
  overtimeOnDailyLimit: true,
  overtimeOnWeeklyLimit: true,
  
  allowPenaltyCombination: false,
  penaltyCombinationRules: null,
  
  shifts: []
}

describe('RetailPayCalculator - Exact Example.json Validation', () => {
  let calculator: RetailPayCalculator
  
  beforeAll(() => {
    calculator = new RetailPayCalculator(mockPayGuide, [])
  })

  describe('C1: Weeknight 5pm-10pm', () => {
    it('should match example.json calculation exactly', () => {
      // Monday 17:00–22:00 (5 hours total)
      const startTime = new Date('2025-07-07T17:00:00') // Monday
      const endTime = new Date('2025-07-07T22:00:00')
      
      const result = calculator.calculateShift(startTime, endTime, 0)
      
      // Expected components from example.json:
      // 1h ordinary (17:00-18:00): 1.25x base = 33.19
      // 3h evening penalty (18:00-21:00): 1.5x base = 119.48  
      // 1h overtime (21:00-22:00): 1.75x base = 46.46
      // Total: 199.13
      
      expect(result.components).toHaveLength(3)
      
      // Check ordinary hours
      const ordinaryComp = result.components.find(c => c.type === 'ordinary')
      expect(ordinaryComp).toBeDefined()
      expect(ordinaryComp!.hours.toNumber()).toBe(1.0)
      expect(ordinaryComp!.amount.toNumber()).toBeCloseTo(33.19, 2) // 1h * 26.55 * 1.25
      
      // Check evening penalty
      const eveningComp = result.components.find(c => c.type === 'penalty' && c.when.includes('after 6pm'))
      expect(eveningComp).toBeDefined()
      expect(eveningComp!.hours.toNumber()).toBe(3.0)
      expect(eveningComp!.amount.toNumber()).toBeCloseTo(119.48, 2) // 3h * 26.55 * 1.5
      
      // Check overtime
      const overtimeComp = result.components.find(c => c.type === 'overtime')
      expect(overtimeComp).toBeDefined()
      expect(overtimeComp!.hours.toNumber()).toBe(1.0)
      expect(overtimeComp!.amount.toNumber()).toBeCloseTo(46.46, 2) // 1h * 26.55 * 1.75
      
      // Check total
      expect(result.total_pay.toNumber()).toBeCloseTo(199.13, 2)
    })
  })

  describe('C2: Saturday 8 hours', () => {
    it('should match example.json calculation exactly', () => {
      // Saturday 08:00–16:00 (8 hours within Saturday span)
      const startTime = new Date('2025-07-05T08:00:00') // Saturday
      const endTime = new Date('2025-07-05T16:00:00')
      
      const result = calculator.calculateShift(startTime, endTime, 0)
      
      // Expected: 8h Saturday penalty at 1.5x = 318.60
      expect(result.components).toHaveLength(1)
      
      const saturdayComp = result.components[0]
      expect(saturdayComp.type).toBe('penalty')
      expect(saturdayComp.when).toBe('Saturday ordinary')
      expect(saturdayComp.hours.toNumber()).toBe(8.0)
      expect(saturdayComp.multiplier.toNumber()).toBe(1.5)
      expect(saturdayComp.amount.toNumber()).toBeCloseTo(318.60, 2) // 8h * 26.55 * 1.5
      
      expect(result.total_pay.toNumber()).toBeCloseTo(318.60, 2)
    })
  })

  describe('C3: Sunday 8 hours', () => {
    it('should match example.json calculation exactly', () => {
      // Sunday 10:00–18:00 (8 hours within Sunday span)
      const startTime = new Date('2025-07-06T10:00:00') // Sunday
      const endTime = new Date('2025-07-06T18:00:00')
      
      const result = calculator.calculateShift(startTime, endTime, 0)
      
      // Expected: 8h Sunday penalty at 1.75x = 371.70
      expect(result.components).toHaveLength(1)
      
      const sundayComp = result.components[0]
      expect(sundayComp.type).toBe('penalty')
      expect(sundayComp.when).toBe('Sunday ordinary')
      expect(sundayComp.hours.toNumber()).toBe(8.0)
      expect(sundayComp.multiplier.toNumber()).toBe(1.75)
      expect(sundayComp.amount.toNumber()).toBeCloseTo(371.70, 2) // 8h * 26.55 * 1.75
      
      expect(result.total_pay.toNumber()).toBeCloseTo(371.70, 2)
    })
  })

  describe('C4: Sunday with overtime', () => {
    it('should match example.json calculation exactly', () => {
      // Sunday 11:00–19:30 (8.5 hours, 1.5h outside span)
      const startTime = new Date('2025-07-06T11:00:00') // Sunday
      const endTime = new Date('2025-07-06T19:30:00')
      
      const result = calculator.calculateShift(startTime, endTime, 0)
      
      // Expected components:
      // 7h Sunday penalty (11:00-18:00): 1.75x = 325.24
      // 1.5h Sunday overtime (18:00-19:30): 2.25x = 89.61
      // Total: 414.85
      
      expect(result.components).toHaveLength(2)
      
      const sundayComp = result.components.find(c => c.when === 'Sunday ordinary')
      expect(sundayComp).toBeDefined()
      expect(sundayComp!.hours.toNumber()).toBe(7.0)
      expect(sundayComp!.amount.toNumber()).toBeCloseTo(325.24, 2) // 7h * 26.55 * 1.75
      
      const overtimeComp = result.components.find(c => c.type === 'overtime')
      expect(overtimeComp).toBeDefined()
      expect(overtimeComp!.hours.toNumber()).toBe(1.5)
      expect(overtimeComp!.multiplier.toNumber()).toBe(2.25)
      expect(overtimeComp!.amount.toNumber()).toBeCloseTo(89.61, 2) // 1.5h * 26.55 * 2.25
      
      expect(result.total_pay.toNumber()).toBeCloseTo(414.85, 2)
    })
  })

  describe('C7: Public holiday', () => {
    it('should match example.json calculation exactly', () => {
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
      
      const calculatorWithHoliday = new RetailPayCalculator(mockPayGuide, publicHolidays)
      const result = calculatorWithHoliday.calculateShift(startTime, endTime, 0)
      
      // Expected: 8h public holiday at 2.5x = 531.00
      expect(result.components).toHaveLength(1)
      
      const holidayComp = result.components[0]
      expect(holidayComp.type).toBe('penalty')
      expect(holidayComp.when).toBe('Public holiday ordinary')
      expect(holidayComp.hours.toNumber()).toBe(8.0)
      expect(holidayComp.multiplier.toNumber()).toBe(2.5)
      expect(holidayComp.amount.toNumber()).toBeCloseTo(531.00, 2) // 8h * 26.55 * 2.5
      
      expect(result.total_pay.toNumber()).toBeCloseTo(531.00, 2)
    })
  })

  describe('C8: Level 2 Sunday', () => {
    it('should match example.json calculation exactly', () => {
      // Create Level 2 pay guide
      const level2PayGuide = {
        ...mockPayGuide,
        baseHourlyRate: new Decimal(27.16), // Level 2 casual rate
        name: 'MA000004 - General Retail Industry Award 2020 - Level 2'
      }
      
      const level2Calculator = new RetailPayCalculator(level2PayGuide, [])
      
      // Sunday 10:00–16:00 (6 hours)
      const startTime = new Date('2025-07-06T10:00:00') // Sunday
      const endTime = new Date('2025-07-06T16:00:00')
      
      const result = level2Calculator.calculateShift(startTime, endTime, 0)
      
      // Expected: 6h Sunday penalty at 1.75x 27.16 = 285.18
      expect(result.components).toHaveLength(1)
      
      const sundayComp = result.components[0]
      expect(sundayComp.type).toBe('penalty')
      expect(sundayComp.when).toBe('Sunday ordinary')
      expect(sundayComp.hours.toNumber()).toBe(6.0)
      expect(sundayComp.multiplier.toNumber()).toBe(1.75)
      expect(sundayComp.amount.toNumber()).toBeCloseTo(285.18, 2) // 6h * 27.16 * 1.75
      
      expect(result.total_pay.toNumber()).toBeCloseTo(285.18, 2)
    })
  })

  describe('Rate validation', () => {
    it('should have correct base rates', () => {
      expect(mockPayGuide.baseHourlyRate.toNumber()).toBe(26.55)
      expect(mockPayGuide.casualLoading.toNumber()).toBe(0.0)
    })
    
    it('should have correct penalty rates', () => {
      expect(mockPayGuide.eveningPenalty.toNumber()).toBe(1.5)
      expect(mockPayGuide.saturdayPenalty.toNumber()).toBe(1.5)
      expect(mockPayGuide.sundayPenalty.toNumber()).toBe(1.75)
      expect(mockPayGuide.publicHolidayPenalty.toNumber()).toBe(2.5)
    })
    
    it('should have correct overtime rates', () => {
      expect(mockPayGuide.overtimeRate1_5x.toNumber()).toBe(1.75)
      expect(mockPayGuide.overtimeRate2x.toNumber()).toBe(2.25)
    })
  })
})