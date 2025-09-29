import { Decimal } from 'decimal.js'
import { prisma } from '@/lib/db'
import { getTaxYearBounds, normalizeTaxYear } from '@/lib/tax-year'
import { FinancialYearStatisticsResponse, PayPeriodStatus } from '@/types'

type DecimalLike = Decimal | number | string | null | undefined

const ZERO = new Decimal(0)

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

function prepareStatusCounts(periods: FinancialYearStatisticsResponse['payPeriods']): Record<PayPeriodStatus, number> {
  return periods.reduce((acc, period) => {
    acc[period.status] = (acc[period.status] || 0) + 1
    return acc
  }, { open: 0, processing: 0, paid: 0, verified: 0 } as Record<PayPeriodStatus, number>)
}

export async function getFinancialYearStatistics(taxYearParam?: string | null): Promise<FinancialYearStatisticsResponse> {
  const taxYear = normalizeTaxYear(taxYearParam)
  const { start, end } = getTaxYearBounds(taxYear)

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

  const payPeriodStats = payPeriods.map((period) => {
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
  })

  const grossTotals = payPeriodStats.reduce((sum, p) => sum.plus(new Decimal(p.totals.gross)), ZERO)
  const netTotals = payPeriodStats.reduce((sum, p) => sum.plus(new Decimal(p.totals.net)), ZERO)
  const actualTotals = payPeriodStats.reduce((sum, p) => sum.plus(new Decimal(p.totals.actual)), ZERO)
  const varianceTotals = payPeriodStats.reduce((sum, p) => sum.plus(new Decimal(p.totals.variance)), ZERO)
  const withholdTotals = payPeriodStats.reduce((sum, p) => sum.plus(new Decimal(p.totals.withholdings)), ZERO)
  const paygTotals = payPeriodStats.reduce((sum, p) => sum.plus(new Decimal(p.totals.payg)), ZERO)
  const stslTotals = payPeriodStats.reduce((sum, p) => sum.plus(new Decimal(p.totals.stsl)), ZERO)
  const taxableExtrasTotals = payPeriodStats.reduce((sum, p) => sum.plus(new Decimal(p.totals.extrasTaxable)), ZERO)
  const nonTaxableExtrasTotals = payPeriodStats.reduce((sum, p) => sum.plus(new Decimal(p.totals.extrasNonTaxable)), ZERO)
  const positiveExtrasTotals = payPeriodStats.reduce((sum, p) => sum.plus(new Decimal(p.totals.extrasPositive)), ZERO)
  const negativeExtrasTotals = payPeriodStats.reduce((sum, p) => sum.plus(new Decimal(p.totals.extrasNegative)), ZERO)
  const totalHoursTotals = payPeriodStats.reduce((sum, p) => sum.plus(new Decimal(p.hours.total)), ZERO)
  const overtimeHoursTotals = payPeriodStats.reduce((sum, p) => sum.plus(new Decimal(p.hours.overtime)), ZERO)
  const penaltyHoursTotals = payPeriodStats.reduce((sum, p) => sum.plus(new Decimal(p.hours.penalty)), ZERO)
  const ordinaryHoursTotals = payPeriodStats.reduce((sum, p) => sum.plus(new Decimal(p.hours.ordinary)), ZERO)
  const basePayTotals = payPeriodStats.reduce((sum, p) => sum.plus(new Decimal(p.breakdown.basePay)), ZERO)
  const overtimePayTotals = payPeriodStats.reduce((sum, p) => sum.plus(new Decimal(p.breakdown.overtimePay)), ZERO)
  const penaltyPayTotals = payPeriodStats.reduce((sum, p) => sum.plus(new Decimal(p.breakdown.penaltyPay)), ZERO)

  const averageRates = payPeriodStats
    .map((p) => new Decimal(p.breakdown.averageRate))
    .filter((rate) => rate.gt(0))

  const averageGrossPerPeriod = payPeriodStats.length > 0
    ? grossTotals.dividedBy(payPeriodStats.length)
    : ZERO

  const averageNetPerPeriod = payPeriodStats.length > 0
    ? netTotals.dividedBy(payPeriodStats.length)
    : ZERO

  const averageHoursPerPeriod = payPeriodStats.length > 0
    ? totalHoursTotals.dividedBy(payPeriodStats.length)
    : ZERO

  const averagePayRate = averageRates.length > 0
    ? averageRates.reduce((sum, rate) => sum.plus(rate), ZERO).dividedBy(averageRates.length)
    : ZERO

  const response: FinancialYearStatisticsResponse = {
    taxYear,
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
      gross: formatCurrency(grossTotals),
      net: formatCurrency(netTotals),
      actual: formatCurrency(actualTotals),
      variance: formatCurrency(varianceTotals),
      withholdings: formatCurrency(withholdTotals),
      payg: formatCurrency(paygTotals),
      stsl: formatCurrency(stslTotals),
      extrasTaxable: formatCurrency(taxableExtrasTotals),
      extrasNonTaxable: formatCurrency(nonTaxableExtrasTotals),
      extrasPositive: formatCurrency(positiveExtrasTotals),
      extrasNegative: formatCurrency(negativeExtrasTotals),
      basePay: formatCurrency(basePayTotals),
      overtimePay: formatCurrency(overtimePayTotals),
      penaltyPay: formatCurrency(penaltyPayTotals),
    },
    hours: {
      total: formatHours(totalHoursTotals),
      overtime: formatHours(overtimeHoursTotals),
      penalty: formatHours(penaltyHoursTotals),
      ordinary: formatHours(ordinaryHoursTotals),
      averagePerPeriod: formatHours(averageHoursPerPeriod),
    },
    averages: {
      grossPerPeriod: formatCurrency(averageGrossPerPeriod),
      netPerPeriod: formatCurrency(averageNetPerPeriod),
      payRate: averagePayRate.toFixed(4),
      medianPayRate: median(averageRates).toFixed(4),
      medianGrossPerPeriod: median(payPeriodStats.map((p) => new Decimal(p.totals.gross))).toFixed(2),
    },
    statusCounts: prepareStatusCounts(payPeriodStats),
    payPeriods: payPeriodStats,
  }

  return response
}
