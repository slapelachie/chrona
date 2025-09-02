import { Decimal } from 'decimal.js'
import {
  PayCalculationResult,
  PayGuide,
  PenaltyTimeFrame,
  OvertimeTimeFrame,
  AppliedPenalty,
  AppliedOvertime,
  Period,
  RuleTimeFrame,
  BreakPeriod,
} from '@/types'
import {
  format,
  parseISO,
  differenceInMinutes,
  startOfDay,
  addHours,
  addDays,
  isBefore,
} from 'date-fns'
import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz'

/**
 * Pay Calculator - Single Source of Truth for Australian Pay Calculations
 *
 * This calculator handles all pay calculations using Decimal.js for financial precision.
 * It supports Australian award conditions including overtime, penalties, and casual loading.
 */
export class PayCalculator {
  private payGuide: PayGuide
  private penaltyTimeFrames: PenaltyTimeFrame[]
  private overtimeTimeFrames: OvertimeTimeFrame[]

  constructor(
    payGuide: PayGuide,
    penaltyTimeFrames: PenaltyTimeFrame[] = [],
    overtimeTimeFrames: OvertimeTimeFrame[] = []
  ) {
    this.payGuide = payGuide
    this.penaltyTimeFrames = penaltyTimeFrames.filter((ptf) => ptf.isActive)
    this.overtimeTimeFrames = overtimeTimeFrames.filter((otf) => otf.isActive)
  }

  /**
   * Calculate complete pay breakdown for a shift
   */
  calculate(
    startTime: Date,
    endTime: Date,
    breakPeriods: BreakPeriod[] = []
  ): PayCalculationResult {
    // Validate inputs
    this.validateShiftTimes(startTime, endTime, breakPeriods)

    // FIXME: I'm not sure if I want this yet
    // Change end time to match minimum shift length if needed
    if (this.payGuide.minimumShiftHours) {
      const minShiftEnd = addHours(startTime, this.payGuide.minimumShiftHours)
      if (isBefore(endTime, minShiftEnd)) {
        endTime = minShiftEnd
      }
    }

    // Calculate total worked time
    const totalMinutes = differenceInMinutes(endTime, startTime)
    const breakMinutes = breakPeriods.reduce(
      (total, bp) => total + differenceInMinutes(bp.endTime, bp.startTime),
      0
    )
    const workedMinutes = Math.max(0, totalMinutes - breakMinutes)
    const totalHours = new Decimal(workedMinutes).dividedBy(60)

    // Apply unified rate rules (penalties + overtime)
    const { appliedPenalties, appliedOvertimePeriods } =
      this.calculateUnifiedRateRules(startTime, endTime, breakPeriods)

    // Calculate hours covered by penalties and overtime periods
    const penaltyHours = appliedPenalties.reduce(
      (sum, penalty) => sum.plus(penalty.hours),
      new Decimal(0)
    )
    const overtimePeriodHours = appliedOvertimePeriods.reduce(
      (sum, overtime) => sum.plus(overtime.hours),
      new Decimal(0)
    )

    // Base hours are hours not covered by penalties or overtime periods (minimum 0)
    const baseHours = Decimal.max(
      0,
      totalHours.minus(penaltyHours).minus(overtimePeriodHours)
    )

    // Calculate pay components
    const basePay = baseHours.times(this.payGuide.baseRate)
    const overtimePay = appliedOvertimePeriods.reduce(
      (sum, overtime) => sum.plus(overtime.pay),
      new Decimal(0)
    )
    const penaltyPay = appliedPenalties.reduce(
      (sum, penalty) => sum.plus(penalty.pay),
      new Decimal(0)
    )

    // Total pay
    const totalPay = basePay.plus(overtimePay).plus(penaltyPay)

    return {
      shift: {
        startTime,
        endTime,
        breakPeriods,
        totalHours,
      },
      breakdown: {
        baseHours,
        basePay: this.roundToCents(basePay),
        overtimeHours: overtimePeriodHours,
        overtimePay: this.roundToCents(overtimePay),
        penaltyHours,
        penaltyPay: this.roundToCents(penaltyPay),
        totalPay: this.roundToCents(totalPay),
      },
      penalties: appliedPenalties,
      overtimes: appliedOvertimePeriods,
      payGuide: {
        name: this.payGuide.name,
        baseRate: this.payGuide.baseRate,
      },
    }
  }

  /**
   * Calculate unified rate rules (penalties + overtime)
   * Overtime is calculated as excess worked hours beyond maximumShiftHours
   * Breaks are only distributed across regular hours, not overtime hours
   */
  private calculateUnifiedRateRules(
    startTime: Date,
    endTime: Date,
    breakPeriods: BreakPeriod[]
  ): {
    appliedPenalties: AppliedPenalty[]
    appliedOvertimePeriods: AppliedOvertime[]
  } {
    const totalShiftMinutes = differenceInMinutes(endTime, startTime)
    const breakMinutes = breakPeriods.reduce(
      (total, bp) => total + differenceInMinutes(bp.endTime, bp.startTime),
      0
    )
    const totalWorkedHours = new Decimal(
      totalShiftMinutes - breakMinutes
    ).dividedBy(60)
    const maximumHours = this.payGuide.maximumShiftHours || 11

    // Calculate overtime hours as excess worked hours beyond maximum
    const overtimeHours = Decimal.max(0, totalWorkedHours.minus(maximumHours))
    const regularHours = totalWorkedHours.minus(overtimeHours)

    // Calculate penalties for regular hours only (breaks are distributed across these)
    const appliedPenalties: AppliedPenalty[] = []

    for (const timeFrame of this.penaltyTimeFrames) {
      const periods = this.findRulePeriods(startTime, endTime, timeFrame)
      for (const period of periods) {
        const penaltyResult = this.createPenaltyFromRule(
          {
            period,
            type: 'penalty',
            timeFrame,
            multiplier: timeFrame.multiplier,
          },
          breakPeriods,
          regularHours
        )
        if (penaltyResult) appliedPenalties.push(penaltyResult)
      }
    }

    // Calculate overtime periods if there are overtime hours
    const appliedOvertimePeriods: AppliedOvertime[] = []

    if (overtimeHours.greaterThan(0)) {
      // Find the best overtime timeframe for this shift
      const applicableOvertimeFrame = this.findApplicableOvertimeTimeFrame(
        startTime,
        endTime
      )

      if (applicableOvertimeFrame) {
        const overtimeResults = this.createOvertimeFromHours(
          applicableOvertimeFrame,
          overtimeHours,
          startTime,
          endTime
        )
        appliedOvertimePeriods.push(...overtimeResults)
      }
    }

    return { appliedPenalties, appliedOvertimePeriods }
  }

  /**
   * Find applicable overtime timeframe for a shift
   */
  private findApplicableOvertimeTimeFrame(
    startTime: Date,
    endTime: Date
  ): OvertimeTimeFrame | null {
    for (const timeFrame of this.overtimeTimeFrames) {
      // Validate timeframe multipliers
      if (
        timeFrame.firstThreeHoursMult.lessThanOrEqualTo(0) ||
        timeFrame.afterThreeHoursMult.lessThanOrEqualTo(0)
      ) {
        continue // Skip invalid timeframes
      }

      if (this.doesOvertimeTimeFrameApply(startTime, endTime, timeFrame)) {
        return timeFrame
      }
    }
    return null
  }

  /**
   * Check if overtime timeframe applies to the shift
   */
  private doesOvertimeTimeFrameApply(
    startTime: Date,
    endTime: Date,
    timeFrame: OvertimeTimeFrame
  ): boolean {
    // Public holiday overtime
    if (timeFrame.isPublicHoliday) {
      return this.isPublicHoliday(startTime)
    }

    // Day-specific overtime
    if (timeFrame.dayOfWeek !== null && timeFrame.dayOfWeek !== undefined) {
      const shiftDay = startTime.getDay()
      return shiftDay === timeFrame.dayOfWeek
    }

    // Time-based overtime
    if (timeFrame.startTime && timeFrame.endTime) {
      const periods = this.findLocalRulePeriods(startTime, endTime, {
        startTime: timeFrame.startTime,
        endTime: timeFrame.endTime,
      })
      return periods.length > 0
    }

    // Default overtime timeframe (applies to all shifts)
    return true
  }

  /**
   * Create overtime periods from total overtime hours
   */
  private createOvertimeFromHours(
    timeFrame: OvertimeTimeFrame,
    overtimeHours: Decimal,
    startTime: Date,
    endTime: Date
  ): AppliedOvertime[] {
    if (overtimeHours.lessThanOrEqualTo(0)) {
      return []
    }

    const results: AppliedOvertime[] = []

    if (overtimeHours.lessThanOrEqualTo(3)) {
      // All overtime hours at first rate
      const overtimeRate = this.payGuide.baseRate.times(
        timeFrame.firstThreeHoursMult
      )
      const overtimePay = overtimeHours.times(overtimeRate)

      results.push({
        timeFrameId: timeFrame.id,
        name: timeFrame.name,
        multiplier: timeFrame.firstThreeHoursMult,
        hours: overtimeHours,
        pay: this.roundToCents(overtimePay),
        startTime,
        endTime,
      })
    } else {
      // Split into first 3 hours and remaining hours
      const firstThreeHours = new Decimal(3)
      const remainingHours = overtimeHours.minus(firstThreeHours)

      // First 3 hours at first rate
      const firstRate = this.payGuide.baseRate.times(
        timeFrame.firstThreeHoursMult
      )
      const firstPay = firstThreeHours.times(firstRate)

      results.push({
        timeFrameId: timeFrame.id,
        name: `${timeFrame.name} (first 3 hours)`,
        multiplier: timeFrame.firstThreeHoursMult,
        hours: firstThreeHours,
        pay: this.roundToCents(firstPay),
        startTime,
        endTime,
      })

      // Remaining hours at higher rate
      const afterRate = this.payGuide.baseRate.times(
        timeFrame.afterThreeHoursMult
      )
      const afterPay = remainingHours.times(afterRate)

      results.push({
        timeFrameId: timeFrame.id,
        name: `${timeFrame.name} (after 3 hours)`,
        multiplier: timeFrame.afterThreeHoursMult,
        hours: remainingHours,
        pay: this.roundToCents(afterPay),
        startTime,
        endTime,
      })
    }

    return results
  }

  /**
   * Select highest rate rules for overlapping time periods
   */
  private selectHighestRateRules(
    allRateRules: Array<{
      period: Period
      type: 'penalty' | 'overtime'
      timeFrame: PenaltyTimeFrame | OvertimeTimeFrame
      multiplier: Decimal
    }>
  ): Array<{
    period: Period
    type: 'penalty' | 'overtime'
    timeFrame: PenaltyTimeFrame | OvertimeTimeFrame
    multiplier: Decimal
  }> {
    if (allRateRules.length === 0) return []

    // Create all time points where rates might change
    const timePoints = new Set<number>()
    for (const rule of allRateRules) {
      timePoints.add(rule.period.start.getTime())
      timePoints.add(rule.period.end.getTime())
    }
    const sortedTimePoints = Array.from(timePoints).sort((a, b) => a - b)

    const selectedRules: Array<{
      period: Period
      type: 'penalty' | 'overtime'
      timeFrame: PenaltyTimeFrame | OvertimeTimeFrame
      multiplier: Decimal
    }> = []

    // For each time segment, find the highest rate rule
    for (let i = 0; i < sortedTimePoints.length - 1; i++) {
      const segmentStart = new Date(sortedTimePoints[i])
      const segmentEnd = new Date(sortedTimePoints[i + 1])

      // Find highest rate rule that applies to this segment
      let highestRule: (typeof allRateRules)[0] | null = null

      for (const rule of allRateRules) {
        // Check if this rule applies to this segment
        if (
          rule.period.start <= segmentStart &&
          rule.period.end >= segmentEnd
        ) {
          if (
            !highestRule ||
            rule.multiplier.greaterThan(highestRule.multiplier)
          ) {
            highestRule = rule
          }
        }
      }

      if (highestRule) {
        // Check if we already have a rule for this timeframe in this segment
        const existingRule = selectedRules.find(
          (r) =>
            r.timeFrame.id === highestRule!.timeFrame.id &&
            r.period.end.getTime() === segmentStart.getTime()
        )

        if (existingRule) {
          // Extend existing rule
          existingRule.period.end = segmentEnd
        } else {
          // Add new rule
          selectedRules.push({
            period: { start: segmentStart, end: segmentEnd },
            type: highestRule.type,
            timeFrame: highestRule.timeFrame,
            multiplier: highestRule.multiplier,
          })
        }
      }
    }

    return selectedRules
  }

  /**
   * Calculate how many minutes of break periods overlap with a given time period
   */
  private calculateBreakOverlap(
    period: Period,
    breakPeriods: BreakPeriod[]
  ): number {
    let totalOverlapMinutes = 0

    for (const breakPeriod of breakPeriods) {
      // Find intersection between penalty period and break period
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

  /**
   * Create penalty result from selected rule
   */
  private createPenaltyFromRule(
    rule: {
      period: Period
      type: 'penalty' | 'overtime'
      timeFrame: PenaltyTimeFrame | OvertimeTimeFrame
      multiplier: Decimal
    },
    breakPeriods: BreakPeriod[],
    regularHours: Decimal
  ): AppliedPenalty | null {
    const timeFrame = rule.timeFrame as PenaltyTimeFrame
    const penaltyMinutes = differenceInMinutes(
      rule.period.end,
      rule.period.start
    )

    // Calculate break time that overlaps with this penalty period
    const breakOverlapMinutes = this.calculateBreakOverlap(
      rule.period,
      breakPeriods
    )
    const workedPenaltyMinutes = Math.max(
      0,
      penaltyMinutes - breakOverlapMinutes
    )
    let penaltyHours = new Decimal(workedPenaltyMinutes).dividedBy(60)

    // Cap penalty hours to only cover regular hours (not overtime hours)
    penaltyHours = Decimal.min(penaltyHours, regularHours)

    if (penaltyHours.greaterThan(0)) {
      const penaltyRate = this.payGuide.baseRate.times(timeFrame.multiplier)
      const penaltyPay = penaltyHours.times(penaltyRate)

      return {
        timeFrameId: timeFrame.id,
        name: timeFrame.name,
        multiplier: timeFrame.multiplier,
        hours: penaltyHours,
        pay: this.roundToCents(penaltyPay),
        startTime: rule.period.start,
        endTime: rule.period.end,
      }
    }

    return null
  }

  /**
   * Calculate penalties that apply to the shift
   * Uses highest penalty rate for overlapping time periods
   */
  findRulePeriods(
    shiftStart: Date,
    shiftEnd: Date,
    timeFrame: RuleTimeFrame
  ): Period[] {
    const periods: Period[] = []

    // Public holiday penalty applies to entire shift
    if (timeFrame.isPublicHoliday) {
      if (this.isPublicHoliday(shiftStart)) {
        periods.push({ start: shiftStart, end: shiftEnd })
        return periods
      } else {
        // Not a public holiday, so this timeframe doesn't apply
        return periods
      }
    }

    // Combined day-of-week and time-based penalty
    if (
      timeFrame.dayOfWeek !== null &&
      timeFrame.dayOfWeek !== undefined &&
      timeFrame.startTime &&
      timeFrame.endTime
    ) {
      const combinedPeriods = this.findLocalRulePeriods(shiftStart, shiftEnd, {
        dayOfWeek: timeFrame.dayOfWeek,
        startTime: timeFrame.startTime,
        endTime: timeFrame.endTime,
      })
      periods.push(...combinedPeriods)
    } else if (
      timeFrame.dayOfWeek !== null &&
      timeFrame.dayOfWeek !== undefined
    ) {
      // Day-of-week penalty only (Saturday, Sunday, etc.)
      const penaltyPeriods = this.findLocalRulePeriods(shiftStart, shiftEnd, {
        dayOfWeek: timeFrame.dayOfWeek,
      })
      periods.push(...penaltyPeriods)
    } else if (timeFrame.startTime && timeFrame.endTime) {
      // Time-based penalty only (evening, night, etc.)
      const timePeriods = this.findLocalRulePeriods(shiftStart, shiftEnd, {
        startTime: timeFrame.startTime,
        endTime: timeFrame.endTime,
      })
      periods.push(...timePeriods)
    } else {
      // No specific time frame - applies to entire shift
      periods.push({ start: shiftStart, end: shiftEnd })
    }

    return periods
  }

  /**
   * Find periods where a local-time rule applies within a UTC shift.
   * - dayOfWeek: 0=Sun..6=Sat (in the given timeZone). Omit to apply every day.
   * - startTime/endTime: "HH:mm" local. Use "24:00" as exclusive end-of-day.
   * - Handles windows that wrap past midnight (e.g. "21:00" → "07:00").
   * - Returns UTC periods [start, end)
   */
  findLocalRulePeriods(
    shiftStartUtc: Date,
    shiftEndUtc: Date,
    opts: { dayOfWeek?: number; startTime?: string; endTime?: string }
  ): Period[] {
    const startTime = opts.startTime ?? '00:00'
    const endTime = opts.endTime ?? '24:00'
    const timeZone = this.payGuide.timezone

    const out: Period[] = []
    if (
      !(shiftStartUtc instanceof Date) ||
      !(shiftEndUtc instanceof Date) ||
      shiftEndUtc <= shiftStartUtc
    ) {
      return out
    }

    // Local dates (yyyy-MM-dd) for the shift endpoints
    const startYmd = formatInTimeZone(shiftStartUtc, timeZone, 'yyyy-MM-dd')
    const endYmd = formatInTimeZone(shiftEndUtc, timeZone, 'yyyy-MM-dd')

    // UTC instants that correspond to local midnights of start/end days
    let dayCursorUtc = fromZonedTime(`${startYmd}T00:00:00`, timeZone)
    const lastDayUtc = fromZonedTime(`${endYmd}T00:00:00`, timeZone)

    // Does the window wrap to next day (or is "24:00")?
    const wraps =
      endTime === '24:00' ||
      (() => {
        const [sH, sM] = startTime.split(':').map(Number)
        const [eH, eM] = endTime.split(':').map(Number)
        return eH < sH || (eH === sH && eM <= sM) // <= so "21:00"→"21:00" is treated as wrap/empty
      })()

    while (dayCursorUtc <= lastDayUtc) {
      // Local DOW for this cursor (ISO 1..7; map 7→0 for Sunday)
      const isoDow = Number(formatInTimeZone(dayCursorUtc, timeZone, 'i')) // 1=Mon..7=Sun
      const localDow = isoDow % 7 // 0=Sun..6=Sat

      if (opts.dayOfWeek == null || opts.dayOfWeek === localDow) {
        const ymd = formatInTimeZone(dayCursorUtc, timeZone, 'yyyy-MM-dd')

        // Build UTC bounds for this local-day rule window
        const startUtc = fromZonedTime(`${ymd}T${startTime}:00`, timeZone)

        const endUtc = wraps
          ? (() => {
              // next local day’s ymd
              const nextLocal = addDays(toZonedTime(dayCursorUtc, timeZone), 1)
              const nextYmd = formatInTimeZone(
                nextLocal,
                timeZone,
                'yyyy-MM-dd'
              )
              const endHHmm = endTime === '24:00' ? '00:00' : endTime
              return fromZonedTime(`${nextYmd}T${endHHmm}:00`, timeZone)
            })()
          : fromZonedTime(`${ymd}T${endTime}:00`, timeZone)

        // Intersect with the shift [shiftStartUtc, shiftEndUtc)
        const a = startUtc > shiftStartUtc ? startUtc : shiftStartUtc
        const b = endUtc < shiftEndUtc ? endUtc : shiftEndUtc
        if (b > a) out.push({ start: a, end: b })
      }

      // Advance to next local day: convert cursor to local, add 1 day, back to UTC at its midnight
      const nextLocalMidnight = addDays(toZonedTime(dayCursorUtc, timeZone), 1)
      const nextYmd = formatInTimeZone(
        nextLocalMidnight,
        timeZone,
        'yyyy-MM-dd'
      )
      dayCursorUtc = fromZonedTime(`${nextYmd}T00:00:00`, timeZone)
    }

    return out
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
      { month: 1, day: 1 }, // New Year's Day
      { month: 1, day: 26 }, // Australia Day
      { month: 4, day: 25 }, // ANZAC Day
      { month: 12, day: 25 }, // Christmas Day
      { month: 12, day: 26 }, // Boxing Day
    ]

    return holidays.some(
      (holiday) => holiday.month === month && holiday.day === day
    )
  }

  /**
   * Validate shift time inputs
   */
  private validateShiftTimes(
    startTime: Date,
    endTime: Date,
    breakPeriods: BreakPeriod[]
  ): void {
    if (endTime.getTime() === startTime.getTime()) {
      throw new Error('Shift must be at least 1 minute long')
    }
    if (endTime < startTime) {
      throw new Error('End time must be after start time')
    }

    const totalMinutes = differenceInMinutes(endTime, startTime)
    let totalBreakMinutes = 0

    for (const breakPeriod of breakPeriods) {
      // Validate break period times
      if (breakPeriod.endTime <= breakPeriod.startTime) {
        throw new Error('Break end time must be after break start time')
      }

      // Validate break period is within shift
      if (breakPeriod.startTime < startTime || breakPeriod.endTime > endTime) {
        throw new Error('Break periods must be within shift duration')
      }

      const breakDurationMinutes = differenceInMinutes(
        breakPeriod.endTime,
        breakPeriod.startTime
      )
      totalBreakMinutes += breakDurationMinutes
    }

    if (totalBreakMinutes >= totalMinutes) {
      throw new Error('Total break time cannot exceed shift duration')
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
export function calculateTotalHours(
  startTime: Date,
  endTime: Date,
  breakMinutes: number = 0
): Decimal {
  const totalMinutes = differenceInMinutes(endTime, startTime)
  const workedMinutes = Math.max(0, totalMinutes - breakMinutes)
  return new Decimal(workedMinutes).dividedBy(60)
}
