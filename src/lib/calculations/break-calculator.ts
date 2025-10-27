import { differenceInMinutes } from 'date-fns'
import { Period, BreakPeriod } from '@/types'

export class BreakCalculator {
  static calculateBreakOverlap(
    period: Period,
    breakPeriods: BreakPeriod[]
  ): number {
    let totalOverlapMinutes = 0

    for (const breakPeriod of breakPeriods) {
      const overlapStart = new Date(
        Math.max(period.start.getTime(), breakPeriod.startTime.getTime())
      )
      const overlapEnd = new Date(
        Math.min(period.end.getTime(), breakPeriod.endTime.getTime())
      )

      if (overlapStart < overlapEnd) {
        const overlapMinutes = differenceInMinutes(overlapEnd, overlapStart)
        totalOverlapMinutes += overlapMinutes
      }
    }

    return totalOverlapMinutes
  }

  static calculateTotalBreakMinutes(breakPeriods: BreakPeriod[]): number {
    return breakPeriods.reduce(
      (total, bp) => total + differenceInMinutes(bp.endTime, bp.startTime),
      0
    )
  }

  static validateBreakPeriods(
    breakPeriods: BreakPeriod[],
    shiftStart: Date,
    shiftEnd: Date
  ): void {
    for (const breakPeriod of breakPeriods) {
      if (breakPeriod.endTime <= breakPeriod.startTime) {
        throw new Error('Break end time must be after break start time')
      }

      if (breakPeriod.startTime < shiftStart || breakPeriod.endTime > shiftEnd) {
        throw new Error('Break periods must be within shift duration')
      }
    }
  }

  static isBreakTime(currentTime: Date, breakPeriods: BreakPeriod[]): boolean {
    return breakPeriods.some(
      (bp) => currentTime >= bp.startTime && currentTime < bp.endTime
    )
  }
}