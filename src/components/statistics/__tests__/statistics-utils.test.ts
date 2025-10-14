import { describe, expect, it } from 'vitest'
import { buildChartData, buildMonthlyBuckets, buildWithholdingShare, toNumber } from '../statistics-utils'
import { FinancialYearPayPeriodStat } from '@/types'

const stubPeriod = (overrides: Partial<FinancialYearPayPeriodStat> = {}): FinancialYearPayPeriodStat => ({
  id: overrides.id ?? 'pp-1',
  startDate: overrides.startDate ?? new Date('2025-07-01T00:00:00.000Z').toISOString(),
  endDate: overrides.endDate ?? new Date('2025-07-07T23:59:59.000Z').toISOString(),
  status: overrides.status ?? 'pending',
  totals: {
    gross: '1500.50',
    rosteredGross: '1550.00',
    net: '1200.25',
    actual: '1195.10',
    variance: '-5.15',
    withholdings: '300.25',
    payg: '250.00',
    stsl: '25.00',
    extrasTaxable: '20.00',
    extrasNonTaxable: '10.00',
    extrasPositive: '30.00',
    extrasNegative: '-5.00',
    ...(overrides.totals ?? {}),
  },
  hours: {
    total: '38.00',
    overtime: '4.00',
    penalty: '2.00',
    ordinary: '32.00',
    ...(overrides.hours ?? {}),
  },
  breakdown: {
    basePay: '1000.00',
    overtimePay: '300.00',
    penaltyPay: '200.50',
    averageRate: '39.49',
    ...(overrides.breakdown ?? {}),
  }
})

describe('statistics utils', () => {
  it('converts safe numeric strings via toNumber', () => {
    expect(toNumber('123.45')).toBeCloseTo(123.45)
    expect(toNumber(null)).toBe(0)
    expect(toNumber('foo')).toBe(0)
  })

  it('builds chart data with derived otherWithholdings', () => {
    const chart = buildChartData([stubPeriod()])
    expect(chart).toHaveLength(1)
    expect(chart[0]).toMatchObject({
      gross: 1500.5,
      rosteredGross: 1550,
      net: 1200.25,
      payg: 250,
      stsl: 25,
      otherWithholdings: 25.25,
    })
  })

  it('aggregates monthly buckets', () => {
    const periods: FinancialYearPayPeriodStat[] = [
      stubPeriod({ id: 'pp-1', startDate: new Date('2025-07-01').toISOString(), totals: { gross: '100', net: '80', withholdings: '20', payg: '10', stsl: '5', variance: '0', actual: '80', extrasPositive: '0', extrasNegative: '0', extrasTaxable: '0', extrasNonTaxable: '0' }, hours: { total: '10', overtime: '0', penalty: '0', ordinary: '10' } }),
      stubPeriod({ id: 'pp-2', startDate: new Date('2025-07-08').toISOString(), totals: { gross: '50', net: '40', withholdings: '10', payg: '5', stsl: '2', variance: '0', actual: '40', extrasPositive: '0', extrasNegative: '0', extrasTaxable: '0', extrasNonTaxable: '0' }, hours: { total: '5', overtime: '0', penalty: '0', ordinary: '5' } })
    ]
    const monthly = buildMonthlyBuckets(periods)
    expect(monthly).toHaveLength(1)
    expect(monthly[0]).toMatchObject({ gross: 150, net: 120, hours: 15 })
  })

  it('builds withholding share segments while dropping zeroes', () => {
    const share = buildWithholdingShare({ withholdings: '100.00', payg: '60.00', stsl: '0.00' })
    expect(share).toEqual([
      { name: 'PAYG', value: 60, color: '#F44336' },
      { name: 'Other', value: 40, color: '#0097A7' },
    ])
  })
})
