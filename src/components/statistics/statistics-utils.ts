import { FinancialYearPayPeriodStat } from '@/types'

export function toNumber(value: string | null | undefined): number {
  if (!value) return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function buildChartData(periods: FinancialYearPayPeriodStat[]) {
  return periods.map((period) => {
    const label = new Date(period.startDate).toLocaleDateString('en-AU', {
      month: 'short',
      day: 'numeric',
    })
    const payg = toNumber(period.totals.payg)
    const stsl = toNumber(period.totals.stsl)
    return {
      id: period.id,
      label,
      gross: toNumber(period.totals.gross),
      net: toNumber(period.totals.net),
      actual: toNumber(period.totals.actual),
      payg,
      stsl,
      status: period.status,
    }
  })
}

export function buildMonthlyBuckets(periods: FinancialYearPayPeriodStat[]) {
  const buckets = new Map<string, { gross: number; net: number; hours: number }>()
  periods.forEach((period) => {
    const date = new Date(period.startDate)
    const key = date.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
    const current = buckets.get(key) ?? { gross: 0, net: 0, hours: 0 }
    current.gross += toNumber(period.totals.gross)
    current.net += toNumber(period.totals.net)
    current.hours += toNumber(period.hours.total)
    buckets.set(key, current)
  })
  return Array.from(buckets.entries()).map(([month, values]) => ({
    month,
    ...values,
  }))
}

export function buildWithholdingShare(totals: { withholdings: string; payg: string; stsl: string }) {
  const payg = toNumber(totals.payg)
  const stsl = toNumber(totals.stsl)
  return [
    { name: 'PAYG', value: payg, color: '#F44336' },
    { name: 'STSL', value: stsl, color: '#6E59F7' },
  ].filter((entry) => entry.value > 0)
}
