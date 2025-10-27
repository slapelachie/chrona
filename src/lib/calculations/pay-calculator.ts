import { Decimal } from 'decimal.js'
import {
  PayCalculationResult,
  PayGuide,
  PenaltyTimeFrame,
  OvertimeTimeFrame,
  AppliedPenalty,
  AppliedOvertime,
  BreakPeriod,
  PublicHoliday,
  RateRule,
} from '@/types'
import { TimeRuleEngine } from './time-rule-engine'
import { ValidationHelpers } from './validation-helpers'
import { TimeCalculations } from './time-calculations'

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
  private publicHolidays: PublicHoliday[]

  private ruleEngine: TimeRuleEngine

  constructor(
    payGuide: PayGuide,
    penaltyTimeFrames: PenaltyTimeFrame[] = [],
    overtimeTimeFrames: OvertimeTimeFrame[] = [],
    publicHolidays: PublicHoliday[] = []
  ) {
    ValidationHelpers.validatePayGuide(payGuide)
    this.payGuide = payGuide
    this.penaltyTimeFrames = penaltyTimeFrames.filter((ptf) => ptf.isActive)
    this.overtimeTimeFrames = overtimeTimeFrames.filter((otf) => otf.isActive)
    this.publicHolidays = publicHolidays.filter((ph) => ph.isActive)
    this.ruleEngine = new TimeRuleEngine(payGuide, this.publicHolidays)
  }


  /**
   * Calculate complete pay breakdown for a shift
   */
  calculate(
    startTime: Date,
    endTime: Date,
    breakPeriods: BreakPeriod[] = []
  ): PayCalculationResult {
    ValidationHelpers.validateShiftTimes(startTime, endTime, breakPeriods)

    endTime = TimeCalculations.adjustEndTimeForMinimumShift(
      startTime,
      endTime,
      this.payGuide
    )

    const { totalHours } = TimeCalculations.calculateWorkedHours(
      startTime,
      endTime,
      breakPeriods
    )

    const { appliedPenalties, appliedOvertimePeriods } =
      this.calculateUnifiedRateRules(startTime, endTime, breakPeriods)

    const penaltyHours = TimeCalculations.sumHours(appliedPenalties)
    const overtimePeriodHours = TimeCalculations.sumHours(appliedOvertimePeriods)
    const baseHours = Decimal.max(
      0,
      totalHours.minus(penaltyHours).minus(overtimePeriodHours)
    )

    const basePay = baseHours.times(this.payGuide.baseRate)
    const overtimePay = TimeCalculations.sumPay(appliedOvertimePeriods)
    const penaltyPay = TimeCalculations.sumPay(appliedPenalties)
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
        basePay: TimeCalculations.roundToCents(basePay),
        overtimeHours: overtimePeriodHours,
        overtimePay: TimeCalculations.roundToCents(overtimePay),
        penaltyHours,
        penaltyPay: TimeCalculations.roundToCents(penaltyPay),
        totalPay: TimeCalculations.roundToCents(totalPay),
      },
      penalties: appliedPenalties,
      overtimes: appliedOvertimePeriods,
      payGuide: {
        name: this.payGuide.name,
        baseRate: this.payGuide.baseRate,
      },
    }
  }

  private calculateUnifiedRateRules(
    startTime: Date,
    endTime: Date,
    breakPeriods: BreakPeriod[]
  ): {
    appliedPenalties: AppliedPenalty[]
    appliedOvertimePeriods: AppliedOvertime[]
  } {
    const { totalHours: totalWorkedHours } = TimeCalculations.calculateWorkedHours(
      startTime,
      endTime,
      breakPeriods
    )
    const { overtimeHours, regularHours } = TimeCalculations.calculateOvertimeHours(
      totalWorkedHours,
      this.payGuide.maximumShiftHours || 11
    )

    const allRateRules = this.ruleEngine.collectApplicableRules(
      startTime,
      endTime,
      this.penaltyTimeFrames,
      this.overtimeTimeFrames,
      overtimeHours,
      breakPeriods
    )

    const selectedRules = this.ruleEngine.selectOptimalRules(allRateRules)

    return this.applySelectedRules(selectedRules, breakPeriods, regularHours)
  }

  private applySelectedRules(
    selectedRules: RateRule[],
    breakPeriods: BreakPeriod[],
    regularHours: Decimal
  ): {
    appliedPenalties: AppliedPenalty[]
    appliedOvertimePeriods: AppliedOvertime[]
  } {
    const appliedPenalties: AppliedPenalty[] = []
    const appliedOvertimePeriods: AppliedOvertime[] = []

    for (const rule of selectedRules) {
      if (rule.type === 'penalty') {
        const penaltyResult = this.ruleEngine.createAppliedPenalty(
          rule,
          breakPeriods,
          regularHours
        )
        if (penaltyResult) appliedPenalties.push(penaltyResult)
      } else if (rule.type === 'overtime') {
        const overtimeResults = this.ruleEngine.createAppliedOvertimes(
          rule,
          breakPeriods
        )
        appliedOvertimePeriods.push(...overtimeResults)
      }
    }

    return { appliedPenalties, appliedOvertimePeriods }
  }
}

/**
 * Utility function to format currency for display
 */
export function formatAustralianCurrency(amount: Decimal): string {
  return `$${amount.toFixed(2)}`
}

export { TimeCalculations } from './time-calculations'

/**
 * Utility function to calculate total hours between two dates
 */
export function calculateTotalHours(
  startTime: Date,
  endTime: Date,
  breakPeriods: BreakPeriod[] = []
): Decimal {
  return TimeCalculations.calculateWorkedHours(
    startTime,
    endTime,
    breakPeriods
  ).totalHours
}
