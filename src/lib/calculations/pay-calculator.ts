import { Decimal } from 'decimal.js'
import { 
  PayCalculationResult, 
  PayGuide, 
  PenaltyTimeFrame, 
  AppliedPenalty,
  OvertimeRules 
} from '@/types'
import { format, parseISO, differenceInMinutes, startOfDay, addHours } from 'date-fns'

/**
 * Pay Calculator - Single Source of Truth for Australian Pay Calculations
 * 
 * This calculator handles all pay calculations using Decimal.js for financial precision.
 * It supports Australian award conditions including overtime, penalties, and casual loading.
 */
export class PayCalculator {
  private payGuide: PayGuide
  private penaltyTimeFrames: PenaltyTimeFrame[]
  
  constructor(payGuide: PayGuide, penaltyTimeFrames: PenaltyTimeFrame[] = []) {
    this.payGuide = payGuide
    this.penaltyTimeFrames = penaltyTimeFrames.filter(ptf => ptf.isActive)
  }

  /**
   * Calculate complete pay breakdown for a shift
   */
  calculate(
    startTime: Date,
    endTime: Date,
    breakMinutes: number = 0
  ): PayCalculationResult {
    // Validate inputs
    this.validateShiftTimes(startTime, endTime, breakMinutes)

    // Calculate total worked time
    const totalMinutes = differenceInMinutes(endTime, startTime)
    const workedMinutes = Math.max(0, totalMinutes - breakMinutes)
    const totalHours = new Decimal(workedMinutes).dividedBy(60)

    // Apply penalty time frames
    const appliedPenalties = this.calculatePenalties(startTime, endTime, breakMinutes)
    
    // Calculate base hours (hours not covered by penalties)
    const penaltyHours = appliedPenalties.reduce(
      (sum, penalty) => sum.plus(penalty.hours), 
      new Decimal(0)
    )
    const baseHours = totalHours.minus(penaltyHours)
    
    // Calculate overtime
    const overtimeBreakdown = this.calculateOvertime(totalHours, baseHours, penaltyHours)
    
    // Calculate pay components
    const basePay = overtimeBreakdown.baseHours.times(this.payGuide.baseRate)
    const overtimePay = overtimeBreakdown.overtimeHours.times(this.payGuide.baseRate).times(overtimeBreakdown.overtimeRate)
    const penaltyPay = appliedPenalties.reduce(
      (sum, penalty) => sum.plus(penalty.pay),
      new Decimal(0)
    )
    
    // Calculate casual loading on base pay only (not on penalties or overtime)
    const casualPay = basePay.times(this.payGuide.casualLoading)
    
    // Total pay
    const totalPay = basePay.plus(overtimePay).plus(penaltyPay).plus(casualPay)

    return {
      shift: {
        startTime,
        endTime,
        breakMinutes,
        totalHours
      },
      breakdown: {
        baseHours: overtimeBreakdown.baseHours,
        basePay: this.roundToCents(basePay),
        overtimeHours: overtimeBreakdown.overtimeHours,
        overtimePay: this.roundToCents(overtimePay),
        penaltyHours,
        penaltyPay: this.roundToCents(penaltyPay),
        casualPay: this.roundToCents(casualPay),
        totalPay: this.roundToCents(totalPay)
      },
      penalties: appliedPenalties,
      payGuide: {
        name: this.payGuide.name,
        baseRate: this.payGuide.baseRate,
        casualLoading: this.payGuide.casualLoading
      }
    }
  }

  /**
   * Calculate penalties that apply to the shift
   */
  private calculatePenalties(
    startTime: Date,
    endTime: Date,
    breakMinutes: number
  ): AppliedPenalty[] {
    const appliedPenalties: AppliedPenalty[] = []
    
    for (const timeFrame of this.penaltyTimeFrames) {
      const penaltyPeriods = this.findPenaltyPeriods(startTime, endTime, timeFrame)
      
      for (const period of penaltyPeriods) {
        const penaltyMinutes = differenceInMinutes(period.endTime, period.startTime)
        const penaltyHours = new Decimal(penaltyMinutes).dividedBy(60)
        
        if (penaltyHours.greaterThan(0)) {
          const penaltyRate = this.payGuide.baseRate.times(timeFrame.multiplier)
          const penaltyPay = penaltyHours.times(penaltyRate)
          
          appliedPenalties.push({
            timeFrameId: timeFrame.id,
            name: timeFrame.name,
            multiplier: timeFrame.multiplier,
            hours: penaltyHours,
            pay: this.roundToCents(penaltyPay),
            startTime: period.startTime,
            endTime: period.endTime
          })
        }
      }
    }

    return appliedPenalties
  }

  /**
   * Find periods where penalty time frame applies to the shift
   */
  private findPenaltyPeriods(
    shiftStart: Date,
    shiftEnd: Date,
    timeFrame: PenaltyTimeFrame
  ): Array<{ startTime: Date; endTime: Date }> {
    const periods: Array<{ startTime: Date; endTime: Date }> = []
    
    // Public holiday penalty applies to entire shift
    if (timeFrame.isPublicHoliday && this.isPublicHoliday(shiftStart)) {
      periods.push({ startTime: shiftStart, endTime: shiftEnd })
      return periods
    }
    
    // Day-of-week penalty (Saturday, Sunday, etc.)
    if (timeFrame.dayOfWeek !== null && timeFrame.dayOfWeek !== undefined) {
      const penaltyPeriods = this.findDayOfWeekPeriods(shiftStart, shiftEnd, timeFrame.dayOfWeek)
      periods.push(...penaltyPeriods)
    }
    
    // Time-based penalty (evening, night, etc.)
    if (timeFrame.startTime && timeFrame.endTime) {
      const timePeriods = this.findTimePeriods(shiftStart, shiftEnd, timeFrame.startTime, timeFrame.endTime)
      periods.push(...timePeriods)
    }
    
    return periods
  }

  /**
   * Find periods where day-of-week penalty applies
   */
  private findDayOfWeekPeriods(
    shiftStart: Date,
    shiftEnd: Date,
    dayOfWeek: number
  ): Array<{ startTime: Date; endTime: Date }> {
    const periods: Array<{ startTime: Date; endTime: Date }> = []
    let current = new Date(shiftStart)
    
    while (current < shiftEnd) {
      if (current.getDay() === dayOfWeek) {
        const dayStart = startOfDay(current)
        const dayEnd = addHours(dayStart, 24)
        
        const periodStart = current > dayStart ? current : dayStart
        const periodEnd = shiftEnd < dayEnd ? shiftEnd : dayEnd
        
        if (periodStart < periodEnd) {
          periods.push({ startTime: periodStart, endTime: periodEnd })
        }
      }
      
      // Move to next day
      current = addHours(startOfDay(current), 24)
    }
    
    return periods
  }

  /**
   * Find periods where time-based penalty applies
   */
  private findTimePeriods(
    shiftStart: Date,
    shiftEnd: Date,
    startTime: string, // "18:00"
    endTime: string    // "06:00"
  ): Array<{ startTime: Date; endTime: Date }> {
    const periods: Array<{ startTime: Date; endTime: Date }> = []
    
    const [startHour, startMinute] = startTime.split(':').map(Number)
    const [endHour, endMinute] = endTime.split(':').map(Number)
    
    let current = new Date(shiftStart)
    
    while (current < shiftEnd) {
      const dayStart = startOfDay(current)
      
      // Create penalty period for current day
      const penaltyStart = new Date(dayStart)
      penaltyStart.setHours(startHour, startMinute, 0, 0)
      
      let penaltyEnd: Date
      
      if (endHour < startHour || (endHour === startHour && endMinute < startMinute)) {
        // Penalty crosses midnight (e.g., 18:00-06:00)
        penaltyEnd = new Date(dayStart)
        penaltyEnd.setDate(penaltyEnd.getDate() + 1)
        penaltyEnd.setHours(endHour, endMinute, 0, 0)
      } else {
        // Penalty within same day
        penaltyEnd = new Date(dayStart)
        penaltyEnd.setHours(endHour, endMinute, 0, 0)
      }
      
      // Find intersection with shift
      const intersectionStart = current > penaltyStart ? current : penaltyStart
      const intersectionEnd = shiftEnd < penaltyEnd ? shiftEnd : penaltyEnd
      
      if (intersectionStart < intersectionEnd) {
        periods.push({ 
          startTime: intersectionStart, 
          endTime: intersectionEnd 
        })
      }
      
      // Move to next day
      current = addHours(startOfDay(current), 24)
    }
    
    return periods
  }

  /**
   * Calculate overtime based on shift hours and pay guide rules
   */
  private calculateOvertime(
    totalHours: Decimal,
    baseHours: Decimal,
    penaltyHours: Decimal
  ): {
    baseHours: Decimal
    overtimeHours: Decimal
    overtimeRate: Decimal
  } {
    const rules = this.payGuide.overtimeRules as OvertimeRules
    
    if (!rules.daily) {
      return {
        baseHours,
        overtimeHours: new Decimal(0),
        overtimeRate: new Decimal(1)
      }
    }
    
    const regularHours = new Decimal(rules.daily.regularHours)
    const firstOvertimeRate = new Decimal(rules.daily.firstOvertimeRate)
    const firstOvertimeHours = new Decimal(rules.daily.firstOvertimeHours)
    const secondOvertimeRate = new Decimal(rules.daily.secondOvertimeRate)
    
    if (totalHours.lessThanOrEqualTo(regularHours)) {
      // No overtime
      return {
        baseHours,
        overtimeHours: new Decimal(0),
        overtimeRate: new Decimal(1)
      }
    } else if (totalHours.lessThanOrEqualTo(firstOvertimeHours)) {
      // First overtime rate
      const overtimeHours = totalHours.minus(regularHours)
      const adjustedBaseHours = baseHours.minus(overtimeHours.greaterThan(baseHours) ? baseHours : overtimeHours)
      
      return {
        baseHours: adjustedBaseHours,
        overtimeHours,
        overtimeRate: firstOvertimeRate
      }
    } else {
      // Second overtime rate
      const firstOvertimeDuration = firstOvertimeHours.minus(regularHours)
      const secondOvertimeDuration = totalHours.minus(firstOvertimeHours)
      const totalOvertimeDuration = firstOvertimeDuration.plus(secondOvertimeDuration)
      
      const adjustedBaseHours = baseHours.minus(
        totalOvertimeDuration.greaterThan(baseHours) ? baseHours : totalOvertimeDuration
      )
      
      return {
        baseHours: adjustedBaseHours,
        overtimeHours: totalOvertimeDuration,
        overtimeRate: secondOvertimeRate // Using highest rate for simplicity
      }
    }
  }

  /**
   * Check if a date is a public holiday (simplified implementation)
   */
  private isPublicHoliday(date: Date): boolean {
    // This is a simplified implementation
    // In a real application, you would check against a comprehensive public holiday database
    const month = date.getMonth() + 1
    const day = date.getDate()
    
    // Common Australian public holidays (simplified)
    const holidays = [
      { month: 1, day: 1 },   // New Year's Day
      { month: 1, day: 26 },  // Australia Day
      { month: 4, day: 25 },  // ANZAC Day
      { month: 12, day: 25 }, // Christmas Day
      { month: 12, day: 26 }  // Boxing Day
    ]
    
    return holidays.some(holiday => holiday.month === month && holiday.day === day)
  }

  /**
   * Validate shift time inputs
   */
  private validateShiftTimes(startTime: Date, endTime: Date, breakMinutes: number): void {
    if (endTime <= startTime) {
      throw new Error('End time must be after start time')
    }
    
    if (breakMinutes < 0) {
      throw new Error('Break minutes cannot be negative')
    }
    
    const totalMinutes = differenceInMinutes(endTime, startTime)
    if (breakMinutes >= totalMinutes) {
      throw new Error('Break minutes cannot exceed shift duration')
    }
    
    const maxShiftHours = 24
    const shiftHours = totalMinutes / 60
    if (shiftHours > maxShiftHours) {
      throw new Error(`Shift duration cannot exceed ${maxShiftHours} hours`)
    }
  }

  /**
   * Round amount to Australian cents (2 decimal places)
   */
  private roundToCents(amount: Decimal): Decimal {
    return amount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
  }
}

/**
 * Utility function to format currency for display
 */
export function formatAustralianCurrency(amount: Decimal): string {
  return `$${amount.toFixed(2)}`
}

/**
 * Utility function to calculate total hours between two dates
 */
export function calculateTotalHours(startTime: Date, endTime: Date, breakMinutes: number = 0): Decimal {
  const totalMinutes = differenceInMinutes(endTime, startTime)
  const workedMinutes = Math.max(0, totalMinutes - breakMinutes)
  return new Decimal(workedMinutes).dividedBy(60)
}