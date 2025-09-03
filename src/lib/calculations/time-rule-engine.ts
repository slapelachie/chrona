import { Decimal } from 'decimal.js'
import { differenceInMinutes, addDays } from 'date-fns'
import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz'
import {
  Period,
  PenaltyTimeFrame,
  OvertimeTimeFrame,
  AppliedPenalty,
  AppliedOvertime,
  BreakPeriod,
  RuleTimeFrame,
  PayGuide,
  PublicHoliday,
  RateRule,
  PenaltyRateRule,
  OvertimeRateRule,
} from '@/types'
import { BreakCalculator } from './break-calculator'
import { TimeZoneHelper } from './timezone-helper'
import { TimeCalculations } from './time-calculations'


export class TimeRuleEngine {
  private tzHelper: TimeZoneHelper

  constructor(
    private payGuide: PayGuide,
    private publicHolidays: PublicHoliday[]
  ) {
    this.tzHelper = new TimeZoneHelper(payGuide.timezone)
  }

  collectApplicableRules(
    startTime: Date,
    endTime: Date,
    penaltyTimeFrames: PenaltyTimeFrame[],
    overtimeTimeFrames: OvertimeTimeFrame[],
    overtimeHours: Decimal,
    breakPeriods: BreakPeriod[]
  ): RateRule[] {
    const allRateRules: RateRule[] = []

    // Add penalty timeframes
    for (const timeFrame of penaltyTimeFrames) {
      const periods = this.findRulePeriods(startTime, endTime, timeFrame)
      for (const period of periods) {
        allRateRules.push({
          type: 'penalty',
          period,
          timeFrame,
          multiplier: timeFrame.multiplier,
        } as PenaltyRateRule)
      }
    }

    // Add overtime timeframes (only if we have overtime hours)
    if (overtimeHours.greaterThan(0)) {
      for (const timeFrame of overtimeTimeFrames) {
        if (this.doesOvertimeTimeFrameApply(startTime, endTime, timeFrame)) {
          const overtimeStart = this.calculateOvertimeStart(
            startTime,
            endTime,
            breakPeriods,
            this.payGuide.maximumShiftHours || 11
          )

          allRateRules.push({
            type: 'overtime',
            period: { start: overtimeStart, end: endTime },
            timeFrame,
            multiplier: timeFrame.firstThreeHoursMult,
          } as OvertimeRateRule)
        }
      }
    }

    return allRateRules
  }

  selectOptimalRules(allRateRules: RateRule[]): RateRule[] {
    if (allRateRules.length === 0) return []

    const timePoints = this.createTimeSegments(allRateRules)
    const selectedRules: RateRule[] = []

    for (let i = 0; i < timePoints.length - 1; i++) {
      const segmentStart = new Date(timePoints[i])
      const segmentEnd = new Date(timePoints[i + 1])

      const highestRule = this.findHighestRateRule(
        allRateRules,
        segmentStart,
        segmentEnd
      )

      if (highestRule) {
        this.addOrExtendRule(selectedRules, highestRule, segmentStart, segmentEnd)
      }
    }

    return selectedRules
  }

  private createTimeSegments(rules: RateRule[]): number[] {
    const timePoints = new Set<number>()
    for (const rule of rules) {
      timePoints.add(rule.period.start.getTime())
      timePoints.add(rule.period.end.getTime())
    }
    return Array.from(timePoints).sort((a, b) => a - b)
  }

  private findHighestRateRule(
    allRateRules: RateRule[],
    segmentStart: Date,
    segmentEnd: Date
  ): RateRule | null {
    let highestRule: RateRule | null = null

    for (const rule of allRateRules) {
      if (
        rule.period.start <= segmentStart &&
        rule.period.end >= segmentEnd
      ) {
        if (
          !highestRule ||
          rule.multiplier.greaterThan(highestRule.multiplier) ||
          (rule.multiplier.equals(highestRule.multiplier) &&
            rule.type === 'overtime' &&
            highestRule.type === 'penalty')
        ) {
          highestRule = rule
        }
      }
    }

    return highestRule
  }

  private addOrExtendRule(
    selectedRules: RateRule[],
    rule: RateRule,
    segmentStart: Date,
    segmentEnd: Date
  ): void {
    const existingRule = selectedRules.find(
      (r) =>
        r.timeFrame.id === rule.timeFrame.id &&
        r.multiplier.equals(rule.multiplier) &&
        r.period.end.getTime() === segmentStart.getTime()
    )

    if (existingRule) {
      existingRule.period.end = segmentEnd
    } else {
      selectedRules.push({
        period: { start: segmentStart, end: segmentEnd },
        type: rule.type,
        timeFrame: rule.timeFrame,
        multiplier: rule.multiplier,
      })
    }
  }

  createAppliedPenalty(
    rule: PenaltyRateRule,
    breakPeriods: BreakPeriod[],
    regularHours: Decimal
  ): AppliedPenalty | null {
    const timeFrame = rule.timeFrame
    const penaltyMinutes = differenceInMinutes(rule.period.end, rule.period.start)
    
    const breakOverlapMinutes = BreakCalculator.calculateBreakOverlap(
      rule.period,
      breakPeriods
    )
    const workedPenaltyMinutes = Math.max(0, penaltyMinutes - breakOverlapMinutes)
    let penaltyHours = new Decimal(workedPenaltyMinutes).dividedBy(60)

    penaltyHours = Decimal.min(penaltyHours, regularHours)

    if (penaltyHours.greaterThan(0)) {
      const penaltyRate = this.payGuide.baseRate.times(timeFrame.multiplier)
      const penaltyPay = penaltyHours.times(penaltyRate)

      return {
        timeFrameId: timeFrame.id,
        name: timeFrame.name,
        multiplier: timeFrame.multiplier,
        hours: penaltyHours,
        pay: TimeCalculations.roundToCents(penaltyPay),
        startTime: rule.period.start,
        endTime: rule.period.end,
      }
    }

    return null
  }

  createAppliedOvertimes(
    rule: OvertimeRateRule,
    breakPeriods: BreakPeriod[]
  ): AppliedOvertime[] {
    const timeFrame = rule.timeFrame
    const overtimeMinutes = differenceInMinutes(rule.period.end, rule.period.start)

    const breakOverlapMinutes = BreakCalculator.calculateBreakOverlap(
      rule.period,
      breakPeriods
    )
    const workedOvertimeMinutes = Math.max(0, overtimeMinutes - breakOverlapMinutes)
    const overtimeHours = new Decimal(workedOvertimeMinutes).dividedBy(60)

    if (overtimeHours.lessThanOrEqualTo(0)) {
      return []
    }

    return this.createOvertimeTiers(timeFrame, overtimeHours, rule.period)
  }

  private createOvertimeTiers(
    timeFrame: OvertimeTimeFrame,
    overtimeHours: Decimal,
    period: Period
  ): AppliedOvertime[] {
    const results: AppliedOvertime[] = []

    if (overtimeHours.greaterThan(3)) {
      // First 3 hours
      const firstTierHours = new Decimal(3)
      const firstTierPay = firstTierHours
        .times(this.payGuide.baseRate)
        .times(timeFrame.firstThreeHoursMult)
      
      results.push({
        timeFrameId: timeFrame.id,
        name: timeFrame.name,
        multiplier: timeFrame.firstThreeHoursMult,
        hours: firstTierHours,
        pay: TimeCalculations.roundToCents(firstTierPay),
        startTime: period.start,
        endTime: period.end,
      })

      // Remaining hours
      const secondTierHours = overtimeHours.minus(3)
      const secondTierPay = secondTierHours
        .times(this.payGuide.baseRate)
        .times(timeFrame.afterThreeHoursMult)

      results.push({
        timeFrameId: timeFrame.id,
        name: timeFrame.name,
        multiplier: timeFrame.afterThreeHoursMult,
        hours: secondTierHours,
        pay: TimeCalculations.roundToCents(secondTierPay),
        startTime: period.start,
        endTime: period.end,
      })
    } else {
      // All hours at first rate
      const overtimePay = overtimeHours
        .times(this.payGuide.baseRate)
        .times(timeFrame.firstThreeHoursMult)

      results.push({
        timeFrameId: timeFrame.id,
        name: timeFrame.name,
        multiplier: timeFrame.firstThreeHoursMult,
        hours: overtimeHours,
        pay: TimeCalculations.roundToCents(overtimePay),
        startTime: period.start,
        endTime: period.end,
      })
    }

    return results
  }

  private doesOvertimeTimeFrameApply(
    startTime: Date,
    endTime: Date,
    timeFrame: OvertimeTimeFrame
  ): boolean {
    if (timeFrame.isPublicHoliday) {
      return this.isPublicHoliday(startTime)
    }

    if (timeFrame.dayOfWeek !== null && timeFrame.dayOfWeek !== undefined) {
      return startTime.getDay() === timeFrame.dayOfWeek
    }

    if (timeFrame.startTime && timeFrame.endTime) {
      const periods = this.findLocalRulePeriods(startTime, endTime, {
        startTime: timeFrame.startTime,
        endTime: timeFrame.endTime,
      })
      return periods.length > 0
    }

    return true
  }

  findRulePeriods(
    shiftStart: Date,
    shiftEnd: Date,
    timeFrame: RuleTimeFrame
  ): Period[] {
    if (timeFrame.isPublicHoliday) {
      return this.findLocalRulePeriods(shiftStart, shiftEnd, { isPublicHoliday: true })
    }
    
    if (timeFrame.dayOfWeek !== null && timeFrame.dayOfWeek !== undefined) {
      const opts: {
        dayOfWeek?: number
        startTime?: string
        endTime?: string
        isPublicHoliday?: boolean
      } = { dayOfWeek: timeFrame.dayOfWeek }
      if (timeFrame.startTime && timeFrame.endTime) {
        opts.startTime = timeFrame.startTime
        opts.endTime = timeFrame.endTime
      }
      return this.findLocalRulePeriods(shiftStart, shiftEnd, opts)
    }
    
    if (timeFrame.startTime && timeFrame.endTime) {
      return this.findLocalRulePeriods(shiftStart, shiftEnd, {
        startTime: timeFrame.startTime,
        endTime: timeFrame.endTime,
      })
    }

    return [{ start: shiftStart, end: shiftEnd }]
  }

  findLocalRulePeriods(
    shiftStartUtc: Date,
    shiftEndUtc: Date,
    opts: {
      dayOfWeek?: number
      startTime?: string
      endTime?: string
      isPublicHoliday?: boolean
    }
  ): Period[] {
    const startTime = opts.startTime ?? '00:00'
    const endTime = opts.endTime ?? '24:00'

    if (shiftEndUtc <= shiftStartUtc) return []

    const out: Period[] = []
    const startYmd = formatInTimeZone(shiftStartUtc, this.payGuide.timezone, 'yyyy-MM-dd')
    const endYmd = formatInTimeZone(shiftEndUtc, this.payGuide.timezone, 'yyyy-MM-dd')

    let dayCursorUtc = this.tzHelper.createLocalMidnight(
      fromZonedTime(`${startYmd}T00:00:00`, this.payGuide.timezone)
    )
    const lastDayUtc = this.tzHelper.createLocalMidnight(
      fromZonedTime(`${endYmd}T00:00:00`, this.payGuide.timezone)
    )

    const wraps = this.tzHelper.doesTimeWrap(startTime, endTime)

    while (dayCursorUtc <= lastDayUtc) {
      const localMidnight = toZonedTime(dayCursorUtc, this.payGuide.timezone)
      const localDow = this.tzHelper.getLocalDayOfWeek(dayCursorUtc)

      const dowOk = opts.dayOfWeek == null || opts.dayOfWeek === localDow
      const holidayOk = opts.isPublicHoliday == null || 
        (opts.isPublicHoliday && this.isPublicHoliday(localMidnight))

      if (dowOk && holidayOk) {
        const ymd = formatInTimeZone(dayCursorUtc, this.payGuide.timezone, 'yyyy-MM-dd')
        const startUtc = fromZonedTime(`${ymd}T${startTime}:00`, this.payGuide.timezone)
        const endUtc = wraps
          ? (() => {
              const nextLocal = addDays(localMidnight, 1)
              const nextYmd = formatInTimeZone(nextLocal, this.payGuide.timezone, 'yyyy-MM-dd')
              const endHHmm = endTime === '24:00' ? '00:00' : endTime
              return fromZonedTime(`${nextYmd}T${endHHmm}:00`, this.payGuide.timezone)
            })()
          : fromZonedTime(`${ymd}T${endTime}:00`, this.payGuide.timezone)

        const intersection = this.tzHelper.intersectWithShift(
          startUtc,
          endUtc,
          shiftStartUtc,
          shiftEndUtc
        )
        
        if (intersection) {
          out.push(intersection)
        }
      }

      dayCursorUtc = this.tzHelper.advanceToNextLocalDay(dayCursorUtc)
    }

    return out
  }

  private calculateOvertimeStart(
    startTime: Date,
    endTime: Date,
    breakPeriods: BreakPeriod[],
    maximumHours: number
  ): Date {
    const maximumMinutes = maximumHours * 60
    const totalShiftMinutes = differenceInMinutes(endTime, startTime)
    
    if (totalShiftMinutes <= maximumMinutes) {
      return endTime
    }

    // Sort break periods by start time for efficient processing
    const sortedBreaks = [...breakPeriods].sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime()
    )

    let currentTime = startTime.getTime()
    let workedMinutes = 0
    let breakIndex = 0

    while (workedMinutes < maximumMinutes && currentTime < endTime.getTime()) {
      const nextMinute = currentTime + 60 * 1000
      
      // Skip breaks efficiently
      while (
        breakIndex < sortedBreaks.length &&
        sortedBreaks[breakIndex].endTime.getTime() <= currentTime
      ) {
        breakIndex++
      }

      const isInBreak = 
        breakIndex < sortedBreaks.length &&
        sortedBreaks[breakIndex].startTime.getTime() <= currentTime &&
        sortedBreaks[breakIndex].endTime.getTime() > currentTime

      if (!isInBreak) {
        workedMinutes++
        if (workedMinutes >= maximumMinutes) {
          return new Date(nextMinute)
        }
      }
      
      currentTime = nextMinute
    }

    return endTime
  }

  private isPublicHoliday(date: Date): boolean {
    return this.publicHolidays.some((ph) => 
      ph.isActive && ph.date.toDateString() === date.toDateString()
    )
  }

}