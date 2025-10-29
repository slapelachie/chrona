import { Decimal } from 'decimal.js'
import { differenceInMinutes, addHours, isBefore } from 'date-fns'
import { BreakPeriod, PayGuide } from '@/types'

export class TimeCalculations {
  static calculateWorkedHours(
    startTime: Date,
    endTime: Date,
    breakPeriods: BreakPeriod[]
  ): {
    totalHours: Decimal
    workedMinutes: number
    breakMinutes: number
  } {
    const totalMinutes = differenceInMinutes(endTime, startTime)
    const breakMinutes = breakPeriods.reduce(
      (total, bp) => total + differenceInMinutes(bp.endTime, bp.startTime),
      0
    )
    const workedMinutes = Math.max(0, totalMinutes - breakMinutes)
    const totalHours = new Decimal(workedMinutes).dividedBy(60)

    return { totalHours, workedMinutes, breakMinutes }
  }

  static calculateOvertimeHours(
    totalWorkedHours: Decimal,
    maximumHours: number
  ): { overtimeHours: Decimal; regularHours: Decimal } {
    const overtimeHours = Decimal.max(0, totalWorkedHours.minus(maximumHours))
    const regularHours = totalWorkedHours.minus(overtimeHours)
    return { overtimeHours, regularHours }
  }

  static adjustEndTimeForMinimumShift(
    startTime: Date,
    endTime: Date,
    payGuide: PayGuide
  ): Date {
    if (!payGuide.minimumShiftHours) return endTime
    
    const minShiftEnd = addHours(startTime, payGuide.minimumShiftHours)
    return isBefore(endTime, minShiftEnd) ? minShiftEnd : endTime
  }

  static roundToCents(amount: Decimal): Decimal {
    return amount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
  }

  // Round to the nearest whole dollar (half up)
  static roundToNearestDollar(amount: Decimal): Decimal {
    return amount.toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
  }

  static roundToHours(hours: Decimal): Decimal {
    return hours.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
  }

  static sumHours(items: { hours: Decimal }[]): Decimal {
    return items.reduce((sum, item) => sum.plus(item.hours), new Decimal(0))
  }

  static sumPay(items: { pay: Decimal }[]): Decimal {
    return items.reduce((sum, item) => sum.plus(item.pay), new Decimal(0))
  }
}
