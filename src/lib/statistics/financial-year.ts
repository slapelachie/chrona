import type { Prisma } from '@prisma/client'
import { Decimal } from 'decimal.js'
import { prisma } from '@/lib/db'
import { getTaxYearBounds, getTaxYearStringFromDate, normalizeTaxYear } from '@/lib/tax-year'
import {
  FinancialYearComparisonSnapshot,
  FinancialYearPayPeriodStat,
  FinancialYearStatisticsResponse,
  PayPeriodStatus,
} from '@/types'

type DecimalLike = Decimal | number | string | null | undefined

const ZERO = new Decimal(0)

type QuarterNumber = 1 | 2 | 3 | 4

function toDecimal(value: DecimalLike): Decimal {
  if (!value) return ZERO
  if (value instanceof Decimal) return value
  try {
    return new Decimal(value)
  } catch {
    return ZERO
  }
}

function formatCurrency(value: Decimal): string {
  return value.toFixed(2)
}

function formatHours(value: Decimal): string {
  return value.toFixed(2)
}

function median(values: Decimal[]): Decimal {
  if (values.length === 0) return ZERO
  const sorted = [...values].sort((a, b) => a.comparedTo(b))
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return sorted[middle - 1].plus(sorted[middle]).dividedBy(2)
  }
  return sorted[middle]
}

function computeVariance(actual: Decimal, expected: Decimal): Decimal {
  return actual.minus(expected)
}

function parseQuarter(quarterParam?: string | null): QuarterNumber | null {
  if (!quarterParam) return null
  const parsed = Number(quarterParam)
  if (!Number.isInteger(parsed)) return null
  if (parsed < 1 || parsed > 4) return null
  return parsed as QuarterNumber
}

function getQuarterBoundsForTaxYear(taxYear: string, quarter: QuarterNumber | null) {
  const { start: yearStart, end: yearEnd } = getTaxYearBounds(taxYear)
  if (!quarter) {
    return { start: yearStart, end: yearEnd }
  }

  const [startYearStr] = taxYear.split('-')
  const startYear = Number(startYearStr)
  if (Number.isNaN(startYear)) {
    return { start: yearStart, end: yearEnd }
  }

  const nextYear = startYear + 1

  switch (quarter) {
    case 1:
      return {
        start: new Date(Date.UTC(startYear, 6, 1, 0, 0, 0, 0)),
        end: new Date(Date.UTC(startYear, 8, 30, 23, 59, 59, 999)),
      }
    case 2:
      return {
        start: new Date(Date.UTC(startYear, 9, 1, 0, 0, 0, 0)),
        end: new Date(Date.UTC(startYear, 11, 31, 23, 59, 59, 999)),
      }
    case 3:
      return {
        start: new Date(Date.UTC(nextYear, 0, 1, 0, 0, 0, 0)),
        end: new Date(Date.UTC(nextYear, 2, 31, 23, 59, 59, 999)),
      }
    case 4:
      return {
        start: new Date(Date.UTC(nextYear, 3, 1, 0, 0, 0, 0)),
        end: new Date(Date.UTC(nextYear, 5, 30, 23, 59, 59, 999)),
      }
    default:
      return { start: yearStart, end: yearEnd }
  }
}

function parseTaxYearStartYear(taxYear: string): number {
  const [startYearStr] = taxYear.split('-')
  const startYear = Number(startYearStr)
  return Number.isNaN(startYear) ? 0 : startYear
}

async function getAvailableTaxYearsForUser(userId: string): Promise<string[]> {
  const periods = await prisma.payPeriod.findMany({
    where: { userId },
    select: { startDate: true },
    orderBy: { startDate: 'desc' },
  })

  const seen = new Set<string>()
  for (const period of periods) {
    seen.add(getTaxYearStringFromDate(period.startDate))
  }

  const available = Array.from(seen.values())
  available.sort((a, b) => parseTaxYearStartYear(b) - parseTaxYearStartYear(a))
  return available
}

function prepareStatusCounts(periods: FinancialYearStatisticsResponse['payPeriods']): Record<PayPeriodStatus, number> {
  return periods.reduce((acc, period) => {
    acc[period.status] = (acc[period.status] || 0) + 1
    return acc
  }, { pending: 0, verified: 0 } as Record<PayPeriodStatus, number>)
}

function buildTaxYearStringFromStartYear(startYear: number): string {
  const endSuffix = String((startYear + 1) % 100).padStart(2, '0')
  return `${startYear}-${endSuffix}`
}

function buildQuarterLabel(quarter: QuarterNumber, taxYear: string): string {
  return `Q${quarter} ${taxYear}`
}

type ComparisonScope = 'quarter' | 'financialYear'

interface PeriodContext {
  scope: ComparisonScope
  taxYear: string
  quarter: QuarterNumber | null
  start: Date
  end: Date
  label: string
  periodLabel: string
}

function getPreviousPeriodContext(taxYear: string, quarter: QuarterNumber | null): PeriodContext | null {
  const [startYearStr] = taxYear.split('-')
  const startYear = Number(startYearStr)
  if (!startYearStr || Number.isNaN(startYear)) {
    return null
  }

  if (quarter) {
    if (quarter > 1) {
      const previousQuarter = (quarter - 1) as QuarterNumber
      const bounds = getQuarterBoundsForTaxYear(taxYear, previousQuarter)
      return {
        scope: 'quarter',
        taxYear,
        quarter: previousQuarter,
        start: bounds.start,
        end: bounds.end,
        label: 'vs last quarter',
        periodLabel: buildQuarterLabel(previousQuarter, taxYear),
      }
    }

    const previousStartYear = startYear - 1
    const previousTaxYear = buildTaxYearStringFromStartYear(previousStartYear)
    const previousQuarter = 4 as QuarterNumber
    const bounds = getQuarterBoundsForTaxYear(previousTaxYear, previousQuarter)
    return {
      scope: 'quarter',
      taxYear: previousTaxYear,
      quarter: previousQuarter,
      start: bounds.start,
      end: bounds.end,
      label: 'vs last quarter',
      periodLabel: buildQuarterLabel(previousQuarter, previousTaxYear),
    }
  }

  const previousStartYear = startYear - 1
  const previousTaxYear = buildTaxYearStringFromStartYear(previousStartYear)
  const bounds = getTaxYearBounds(previousTaxYear)
  return {
    scope: 'financialYear',
    taxYear: previousTaxYear,
    quarter: null,
    start: bounds.start,
    end: bounds.end,
    label: 'vs last financial year',
    periodLabel: previousTaxYear,
  }
}

type PayPeriodWithRelations = Prisma.PayPeriodGetPayload<{
  include: {
    extras: true
    shifts: {
      include: {
        penaltySegments: true
        overtimeSegments: true
      }
    }
  }
}>

function mapPayPeriodToStat(period: PayPeriodWithRelations): FinancialYearPayPeriodStat {
  const totalPay = toDecimal(period.totalPay)
  const totalHours = toDecimal(period.totalHours)
  const totalWithholdings = toDecimal(period.totalWithholdings)
  const payg = toDecimal(period.paygWithholding)
  const stsl = toDecimal(period.stslAmount)
  const actual = toDecimal(period.actualPay ?? null)
  const expectedNet = totalPay.minus(totalWithholdings)
  const netPay = totalWithholdings.isZero() ? totalPay : expectedNet
  const actualPay = actual.isZero() ? netPay : actual
  const variance = computeVariance(actualPay, netPay)

  const extras = period.extras || []
  const extrasTaxable = extras
    .filter((ex) => ex.taxable)
    .reduce((sum, ex) => sum.plus(toDecimal(ex.amount)), ZERO)
  const extrasNonTaxable = extras
    .filter((ex) => !ex.taxable)
    .reduce((sum, ex) => sum.plus(toDecimal(ex.amount)), ZERO)
  const extrasPositive = extras
    .filter((ex) => toDecimal(ex.amount).gt(0))
    .reduce((sum, ex) => sum.plus(toDecimal(ex.amount)), ZERO)
  const extrasNegative = extras
    .filter((ex) => toDecimal(ex.amount).lt(0))
    .reduce((sum, ex) => sum.plus(toDecimal(ex.amount)), ZERO)

  const shifts = period.shifts || []
  const shiftBasePay = shifts.reduce((sum, shift) => sum.plus(toDecimal(shift.basePay)), ZERO)
  const shiftOvertimePay = shifts.reduce((sum, shift) => sum.plus(toDecimal(shift.overtimePay)), ZERO)
  const shiftPenaltyPay = shifts.reduce((sum, shift) => sum.plus(toDecimal(shift.penaltyPay)), ZERO)
  const rosteredGross = shiftBasePay.plus(shiftOvertimePay).plus(shiftPenaltyPay).plus(extrasPositive)

  const overtimeHours = shifts.reduce((sum, shift) => sum.plus(
    (shift.overtimeSegments || []).reduce((segSum, seg) => segSum.plus(toDecimal(seg.hours)), ZERO)
  ), ZERO)

  const penaltyHours = shifts.reduce((sum, shift) => sum.plus(
    (shift.penaltySegments || []).reduce((segSum, seg) => segSum.plus(toDecimal(seg.hours)), ZERO)
  ), ZERO)

  const ordinaryHours = Decimal.max(totalHours.minus(overtimeHours), ZERO)

  const averageRate = totalHours.gt(0)
    ? totalPay.dividedBy(totalHours)
    : ZERO

  return {
    id: period.id,
    startDate: period.startDate.toISOString(),
    endDate: period.endDate.toISOString(),
    status: period.status as PayPeriodStatus,
    totals: {
      gross: formatCurrency(totalPay),
      rosteredGross: formatCurrency(rosteredGross),
      net: formatCurrency(netPay),
      actual: formatCurrency(actualPay),
      variance: formatCurrency(variance),
      withholdings: formatCurrency(totalWithholdings),
      payg: formatCurrency(payg),
      stsl: formatCurrency(stsl),
      extrasTaxable: formatCurrency(extrasTaxable),
      extrasNonTaxable: formatCurrency(extrasNonTaxable),
      extrasPositive: formatCurrency(extrasPositive),
      extrasNegative: formatCurrency(extrasNegative),
    },
    hours: {
      total: formatHours(totalHours),
      overtime: formatHours(overtimeHours),
      penalty: formatHours(penaltyHours),
      ordinary: formatHours(ordinaryHours),
    },
    breakdown: {
      basePay: formatCurrency(shiftBasePay),
      overtimePay: formatCurrency(shiftOvertimePay),
      penaltyPay: formatCurrency(shiftPenaltyPay),
      averageRate: averageRate.toFixed(4),
    }
  }
}

interface AggregatedMetrics {
  totals: {
    gross: Decimal
    net: Decimal
    actual: Decimal
    variance: Decimal
    withholdings: Decimal
    payg: Decimal
    stsl: Decimal
    extrasTaxable: Decimal
    extrasNonTaxable: Decimal
    extrasPositive: Decimal
    extrasNegative: Decimal
    basePay: Decimal
    overtimePay: Decimal
    penaltyPay: Decimal
  }
  hours: {
    total: Decimal
    overtime: Decimal
    penalty: Decimal
    ordinary: Decimal
    averagePerPeriod: Decimal
  }
  averages: {
    grossPerPeriod: Decimal
    netPerPeriod: Decimal
    actualPerPeriod: Decimal
    payRate: Decimal
    medianPayRate: Decimal
    medianGrossPerPeriod: Decimal
  }
}

function aggregatePayPeriodStats(stats: FinancialYearPayPeriodStat[]): AggregatedMetrics {
  const count = stats.length

  const grossTotals = stats.reduce((sum, p) => sum.plus(new Decimal(p.totals.gross)), ZERO)
  const netTotals = stats.reduce((sum, p) => sum.plus(new Decimal(p.totals.net)), ZERO)
  const actualTotals = stats.reduce((sum, p) => sum.plus(new Decimal(p.totals.actual)), ZERO)
  const varianceTotals = stats.reduce((sum, p) => sum.plus(new Decimal(p.totals.variance)), ZERO)
  const withholdTotals = stats.reduce((sum, p) => sum.plus(new Decimal(p.totals.withholdings)), ZERO)
  const paygTotals = stats.reduce((sum, p) => sum.plus(new Decimal(p.totals.payg)), ZERO)
  const stslTotals = stats.reduce((sum, p) => sum.plus(new Decimal(p.totals.stsl)), ZERO)
  const taxableExtrasTotals = stats.reduce((sum, p) => sum.plus(new Decimal(p.totals.extrasTaxable)), ZERO)
  const nonTaxableExtrasTotals = stats.reduce((sum, p) => sum.plus(new Decimal(p.totals.extrasNonTaxable)), ZERO)
  const positiveExtrasTotals = stats.reduce((sum, p) => sum.plus(new Decimal(p.totals.extrasPositive)), ZERO)
  const negativeExtrasTotals = stats.reduce((sum, p) => sum.plus(new Decimal(p.totals.extrasNegative)), ZERO)
  const basePayTotals = stats.reduce((sum, p) => sum.plus(new Decimal(p.breakdown.basePay)), ZERO)
  const overtimePayTotals = stats.reduce((sum, p) => sum.plus(new Decimal(p.breakdown.overtimePay)), ZERO)
  const penaltyPayTotals = stats.reduce((sum, p) => sum.plus(new Decimal(p.breakdown.penaltyPay)), ZERO)

  const totalHoursTotals = stats.reduce((sum, p) => sum.plus(new Decimal(p.hours.total)), ZERO)
  const overtimeHoursTotals = stats.reduce((sum, p) => sum.plus(new Decimal(p.hours.overtime)), ZERO)
  const penaltyHoursTotals = stats.reduce((sum, p) => sum.plus(new Decimal(p.hours.penalty)), ZERO)
  const ordinaryHoursTotals = stats.reduce((sum, p) => sum.plus(new Decimal(p.hours.ordinary)), ZERO)

  const averageRates = stats
    .map((p) => new Decimal(p.breakdown.averageRate))
    .filter((rate) => rate.gt(0))

  const averageGrossPerPeriod = count > 0 ? grossTotals.dividedBy(count) : ZERO
  const averageNetPerPeriod = count > 0 ? netTotals.dividedBy(count) : ZERO
  const averageActualPerPeriod = count > 0 ? actualTotals.dividedBy(count) : ZERO
  const averageHoursPerPeriod = count > 0 ? totalHoursTotals.dividedBy(count) : ZERO

  const averagePayRate = averageRates.length > 0
    ? averageRates.reduce((sum, rate) => sum.plus(rate), ZERO).dividedBy(averageRates.length)
    : ZERO

  return {
    totals: {
      gross: grossTotals,
      net: netTotals,
      actual: actualTotals,
      variance: varianceTotals,
      withholdings: withholdTotals,
      payg: paygTotals,
      stsl: stslTotals,
      extrasTaxable: taxableExtrasTotals,
      extrasNonTaxable: nonTaxableExtrasTotals,
      extrasPositive: positiveExtrasTotals,
      extrasNegative: negativeExtrasTotals,
      basePay: basePayTotals,
      overtimePay: overtimePayTotals,
      penaltyPay: penaltyPayTotals,
    },
    hours: {
      total: totalHoursTotals,
      overtime: overtimeHoursTotals,
      penalty: penaltyHoursTotals,
      ordinary: ordinaryHoursTotals,
      averagePerPeriod: averageHoursPerPeriod,
    },
    averages: {
      grossPerPeriod: averageGrossPerPeriod,
      netPerPeriod: averageNetPerPeriod,
      actualPerPeriod: averageActualPerPeriod,
      payRate: averagePayRate,
      medianPayRate: median(averageRates),
      medianGrossPerPeriod: median(stats.map((p) => new Decimal(p.totals.gross))),
    },
  }
}

async function buildComparisonSnapshot(
  userId: string,
  currentTaxYear: string,
  currentQuarter: QuarterNumber | null
): Promise<FinancialYearComparisonSnapshot | null> {
  const previousContext = getPreviousPeriodContext(currentTaxYear, currentQuarter)
  if (!previousContext) {
    return null
  }

  const previousPayPeriods = await prisma.payPeriod.findMany({
    where: {
      userId,
      startDate: { gte: previousContext.start },
      endDate: { lte: previousContext.end },
    },
    include: {
      extras: true,
      shifts: {
        include: {
          penaltySegments: true,
          overtimeSegments: true,
        }
      }
    },
    orderBy: { startDate: 'asc' },
  })

  if (previousPayPeriods.length === 0) {
    return null
  }

  const previousStats = previousPayPeriods.map(mapPayPeriodToStat)
  const aggregates = aggregatePayPeriodStats(previousStats)

  return {
    scope: previousContext.scope,
    label: previousContext.label,
    periodLabel: previousContext.periodLabel,
    taxYear: previousContext.taxYear,
    quarter: previousContext.quarter,
    totals: {
      gross: formatCurrency(aggregates.totals.gross),
      net: formatCurrency(aggregates.totals.net),
      actual: formatCurrency(aggregates.totals.actual),
      variance: formatCurrency(aggregates.totals.variance),
      withholdings: formatCurrency(aggregates.totals.withholdings),
      payg: formatCurrency(aggregates.totals.payg),
      stsl: formatCurrency(aggregates.totals.stsl),
      extrasTaxable: formatCurrency(aggregates.totals.extrasTaxable),
      extrasNonTaxable: formatCurrency(aggregates.totals.extrasNonTaxable),
      extrasPositive: formatCurrency(aggregates.totals.extrasPositive),
      extrasNegative: formatCurrency(aggregates.totals.extrasNegative),
      basePay: formatCurrency(aggregates.totals.basePay),
      overtimePay: formatCurrency(aggregates.totals.overtimePay),
      penaltyPay: formatCurrency(aggregates.totals.penaltyPay),
    },
    hours: {
      total: formatHours(aggregates.hours.total),
      overtime: formatHours(aggregates.hours.overtime),
      penalty: formatHours(aggregates.hours.penalty),
      ordinary: formatHours(aggregates.hours.ordinary),
      averagePerPeriod: formatHours(aggregates.hours.averagePerPeriod),
    },
    averages: {
      grossPerPeriod: formatCurrency(aggregates.averages.grossPerPeriod),
      netPerPeriod: formatCurrency(aggregates.averages.netPerPeriod),
      actualPerPeriod: formatCurrency(aggregates.averages.actualPerPeriod),
      payRate: aggregates.averages.payRate.toFixed(4),
      medianPayRate: aggregates.averages.medianPayRate.toFixed(4),
      medianGrossPerPeriod: aggregates.averages.medianGrossPerPeriod.toFixed(2),
    },
  }
}

export async function getFinancialYearStatistics(
  taxYearParam?: string | null,
  quarterParam?: string | null
): Promise<FinancialYearStatisticsResponse> {
  const taxYear = normalizeTaxYear(taxYearParam)
  const quarter = parseQuarter(quarterParam)
  const { start, end } = getQuarterBoundsForTaxYear(taxYear, quarter)

  const user = await prisma.user.findFirst({
    select: {
      id: true,
      name: true,
      payPeriodType: true,
    }
  })

  if (!user) {
    throw new Error('No user found. Seed the database to proceed.')
  }

  const availableTaxYears = await getAvailableTaxYearsForUser(user.id)
  if (!availableTaxYears.includes(taxYear)) {
    availableTaxYears.push(taxYear)
    availableTaxYears.sort((a, b) => parseTaxYearStartYear(b) - parseTaxYearStartYear(a))
  }

  const payPeriods = await prisma.payPeriod.findMany({
    where: {
      userId: user.id,
      startDate: { gte: start },
      endDate: { lte: end },
    },
    include: {
      extras: true,
      shifts: {
        include: {
          penaltySegments: true,
          overtimeSegments: true,
        }
      }
    },
    orderBy: { startDate: 'asc' }
  })

  const payPeriodStats = payPeriods.map(mapPayPeriodToStat)
  const aggregates = aggregatePayPeriodStats(payPeriodStats)
  const comparison = await buildComparisonSnapshot(user.id, taxYear, quarter)
  const statusCounts = prepareStatusCounts(payPeriodStats)

  const response: FinancialYearStatisticsResponse = {
    taxYear,
    quarter: quarter ?? null,
    availableTaxYears,
    range: {
      start: start.toISOString(),
      end: end.toISOString(),
      currentDate: new Date().toISOString(),
    },
    user: {
      id: user.id,
      name: user.name,
      payPeriodType: user.payPeriodType,
    },
    totals: {
      gross: formatCurrency(aggregates.totals.gross),
      net: formatCurrency(aggregates.totals.net),
      actual: formatCurrency(aggregates.totals.actual),
      variance: formatCurrency(aggregates.totals.variance),
      withholdings: formatCurrency(aggregates.totals.withholdings),
      payg: formatCurrency(aggregates.totals.payg),
      stsl: formatCurrency(aggregates.totals.stsl),
      extrasTaxable: formatCurrency(aggregates.totals.extrasTaxable),
      extrasNonTaxable: formatCurrency(aggregates.totals.extrasNonTaxable),
      extrasPositive: formatCurrency(aggregates.totals.extrasPositive),
      extrasNegative: formatCurrency(aggregates.totals.extrasNegative),
      basePay: formatCurrency(aggregates.totals.basePay),
      overtimePay: formatCurrency(aggregates.totals.overtimePay),
      penaltyPay: formatCurrency(aggregates.totals.penaltyPay),
    },
    hours: {
      total: formatHours(aggregates.hours.total),
      overtime: formatHours(aggregates.hours.overtime),
      penalty: formatHours(aggregates.hours.penalty),
      ordinary: formatHours(aggregates.hours.ordinary),
      averagePerPeriod: formatHours(aggregates.hours.averagePerPeriod),
    },
    averages: {
      grossPerPeriod: formatCurrency(aggregates.averages.grossPerPeriod),
      netPerPeriod: formatCurrency(aggregates.averages.netPerPeriod),
      actualPerPeriod: formatCurrency(aggregates.averages.actualPerPeriod),
      payRate: aggregates.averages.payRate.toFixed(4),
      medianPayRate: aggregates.averages.medianPayRate.toFixed(4),
      medianGrossPerPeriod: aggregates.averages.medianGrossPerPeriod.toFixed(2),
    },
    statusCounts,
    payPeriods: payPeriodStats,
    comparison: comparison ?? null,
  }

  return response
}
