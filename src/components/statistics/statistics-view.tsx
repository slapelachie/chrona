'use client'

import React, { useMemo, useState } from 'react'
import type { PieLabelRenderProps } from 'recharts'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChevronDown, RefreshCw, Sparkle, Zap } from 'lucide-react'
import { Button, Card, CardBody } from '../ui'
import { QuarterFilterValue, useFinancialYearStats } from '@/hooks/use-financial-year-stats'
import { FinancialYearPayPeriodStat, PayPeriodStatus } from '@/types'
import { StatusBadge } from '@/components/pay-periods/status-badge'
import { buildChartData, buildMonthlyBuckets, buildWithholdingShare, toNumber } from './statistics-utils'
import './statistics.scss'

type ChartMetricKey = 'gross' | 'net' | 'actual' | 'payg' | 'stsl'

type SummaryTone = 'neutral' | 'positive' | 'negative'

interface SummaryCardDetail {
  label: string
  value: string
  tone?: SummaryTone
}

interface SummaryCardSection {
  title: string
  items: SummaryCardDetail[]
}

interface SummaryCardData {
  key: string
  label: string
  total: string
  tone: SummaryTone
  sections: SummaryCardSection[]
}

interface MetricConfig {
  key: ChartMetricKey
  label: string
  color: string
  axis?: 'left' | 'right'
  formatter: (value: number) => string
}

const palette = {
  primary: '#00BCD4',
  primaryLight: '#00E5FF',
  warning: '#FFC107',
  danger: '#F44336',
  accent: '#6E59F7',
  contrast: '#00ACC1',
}

const tooltipStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-bg-tertiary)',
  border: '1px solid var(--color-border-secondary)',
  borderRadius: '12px',
  color: 'var(--color-text-primary)',
  fontSize: '0.875rem',
  boxShadow: 'var(--shadow-md)',
}

const tooltipLabelStyle: React.CSSProperties = {
  color: 'var(--color-text-secondary)',
  fontSize: '0.75rem',
  marginBottom: 4,
}

const tooltipItemStyle: React.CSSProperties = {
  color: 'var(--color-text-primary)',
}

const legendStyle: React.CSSProperties = {
  color: 'var(--color-text-secondary)',
  fontSize: '0.75rem',
}

const axisTickStyle = { fill: 'var(--color-text-secondary)', fontSize: 12 }
const axisLineColor = 'rgba(255, 255, 255, 0.12)'
const gridStroke = 'rgba(255, 255, 255, 0.08)'

const renderPieLabel = ({ name, percent }: PieLabelRenderProps) => {
  const pct = percent ? Math.round(percent * 100) : 0
  return `${name} ${pct}%`
}

const currency = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  minimumFractionDigits: 2,
})

const hoursFmt = new Intl.NumberFormat('en-AU', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const metricConfigs: MetricConfig[] = [
  { key: 'gross', label: 'Gross Pay', color: palette.primary, formatter: (v) => currency.format(v) },
  { key: 'net', label: 'Net Pay', color: palette.primaryLight, formatter: (v) => currency.format(v) },
  { key: 'actual', label: 'Actual Pay', color: palette.warning, formatter: (v) => currency.format(v) },
  { key: 'payg', label: 'PAYG', color: palette.danger, formatter: (v) => currency.format(v) },
  { key: 'stsl', label: 'STSL', color: palette.accent, formatter: (v) => currency.format(v) },
]

const quarterOptions: { value: QuarterFilterValue; label: string }[] = [
  { value: 'all', label: 'All quarters' },
  { value: '1', label: 'Q1 (Jul-Sep)' },
  { value: '2', label: 'Q2 (Oct-Dec)' },
  { value: '3', label: 'Q3 (Jan-Mar)' },
  { value: '4', label: 'Q4 (Apr-Jun)' },
]

const formatPayRate = (value: number): string => `${currency.format(value)}/h`

type DeltaResult = { text: string; tone: SummaryTone }

function buildDelta(
  current: number,
  previous: number,
  formatter: (value: number) => string,
  zeroText: string
): DeltaResult | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) {
    return null
  }
  const delta = current - previous
  if (Math.abs(delta) < 1e-9) {
    return { text: zeroText, tone: 'neutral' }
  }
  const sign = delta > 0 ? '+' : '-'
  return {
    text: `${sign}${formatter(Math.abs(delta))}`,
    tone: delta > 0 ? 'positive' : 'negative',
  }
}

const getCurrencyDelta = (current: number, previous: number) =>
  buildDelta(current, previous, (value) => currency.format(value), '=$0.00')

const getHoursDelta = (current: number, previous: number) =>
  buildDelta(current, previous, (value) => `${hoursFmt.format(value)}h`, '=0.00h')

const getPayRateDelta = (current: number, previous: number) =>
  buildDelta(current, previous, (value) => `${currency.format(value)}/h`, `=${currency.format(0)}/h`)

function Heatmap({ periods }: { periods: FinancialYearPayPeriodStat[] }) {
  if (periods.length === 0) {
    return <div className="statistics__heatmap-empty">No pay periods to chart yet.</div>
  }

  const values = periods.map((p) => toNumber(p.totals.gross))
  const max = Math.max(...values)
  const min = Math.min(...values)

  return (
    <div className="statistics__heatmap-grid">
      {periods.map((period) => {
        const gross = toNumber(period.totals.gross)
        const ratio = max === min ? 0.5 : (gross - min) / (max - min)
        const intensity = Math.max(0.2, Math.min(0.85, ratio * 0.75 + 0.2))
        const style = {
          backgroundColor: `rgba(0, 188, 212, ${intensity})`,
          border: '1px solid var(--color-border-secondary)',
        }
        const label = new Date(period.startDate).toLocaleDateString('en-AU', {
          month: 'short',
          day: 'numeric',
        })
        return (
          <div key={period.id} className="statistics__heatmap-cell" style={style}>
            <span>{label}</span>
            <strong>{currency.format(gross)}</strong>
          </div>
        )
      })}
    </div>
  )
}

export const StatisticsView: React.FC = () => {
  const {
    data,
    error,
    loading,
    availableTaxYears,
    taxYear,
    setTaxYear,
    quarter,
    setQuarter,
    refresh,
  } = useFinancialYearStats()
  const [activeMetricKeys, setActiveMetricKeys] = useState<ChartMetricKey[]>(metricConfigs.map((m) => m.key))
  const [expandedCards, setExpandedCards] = useState<Set<string>>(() => new Set())

  const payPeriods = useMemo(() => data?.payPeriods ?? [], [data])
  const chartData = useMemo(() => buildChartData(payPeriods), [payPeriods])
  const monthlyBuckets = useMemo(() => buildMonthlyBuckets(payPeriods), [payPeriods])
  const totals = data?.totals
  const withholdingShare = totals ? buildWithholdingShare(totals) : []
  const selectedTaxYear = taxYear ?? data?.taxYear ?? (availableTaxYears[0] ?? '')
  const selectedQuarter = quarter

  const toggleMetric = (key: ChartMetricKey) => {
    setActiveMetricKeys((prev) => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev
        return prev.filter((k) => k !== key)
      }
      return [...prev, key]
    })
  }

  const toggleCardExpansion = (key: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const activeMetrics = metricConfigs.filter((config) => activeMetricKeys.includes(config.key))

  const comparison = data?.comparison ?? null

  const comparisonLabel = comparison
    ? comparison.scope === 'quarter'
      ? 'last quarter'
      : 'last financial year'
    : null

  const comparisonTitle = comparison
    ? comparison.scope === 'quarter'
      ? 'Last quarter'
      : 'Last financial year'
    : null

  const comparisonNote = comparison
    ? `Comparing against ${comparisonLabel}${comparison.periodLabel ? ` (${comparison.periodLabel})` : ''}.`
    : 'No historical data available for comparison yet.'

  const comparisonSectionTitle = comparisonTitle ?? 'Previous period'

  const activeQuarterLabel = quarterOptions.find((option) => option.value === selectedQuarter)?.label
  const totalsHeading = selectedQuarter !== 'all'
    ? `${activeQuarterLabel ?? 'Quarter'} Totals`
    : `${selectedTaxYear} Financial Year Totals`

  const resolveCurrencyDeltaDetail = (
    label: string,
    current: number,
    previousValue?: string | null
  ): SummaryCardDetail | null => {
    if (!comparison || previousValue === undefined || previousValue === null) {
      return null
    }
    const delta = getCurrencyDelta(current, toNumber(previousValue))
    if (!delta) return null
    return { label, value: delta.text, tone: delta.tone }
  }

  const resolveHoursDeltaDetail = (
    label: string,
    current: number,
    previousValue?: string | null
  ): SummaryCardDetail | null => {
    if (!comparison || previousValue === undefined || previousValue === null) {
      return null
    }
    const delta = getHoursDelta(current, toNumber(previousValue))
    if (!delta) return null
    return { label, value: delta.text, tone: delta.tone }
  }

  const resolvePayRateDeltaDetail = (
    label: string,
    current: number,
    previousValue?: string | null
  ): SummaryCardDetail | null => {
    if (!comparison || previousValue === undefined || previousValue === null) {
      return null
    }
    const delta = getPayRateDelta(current, toNumber(previousValue))
    if (!delta) return null
    return { label, value: delta.text, tone: delta.tone }
  }

  const grossTotalNumber = toNumber(totals?.gross)
  const netTotalNumber = toNumber(totals?.net)
  const actualTotalNumber = toNumber(totals?.actual)
  const totalDeductionsNumber = toNumber(totals?.withholdings)
  const totalHoursNumber = toNumber(data?.hours.total)
  const averageGrossNumber = toNumber(data?.averages.grossPerPeriod)
  const averageNetNumber = toNumber(data?.averages.netPerPeriod)
  const averageActualNumber = toNumber(data?.averages.actualPerPeriod)
  const averageHoursNumber = toNumber(data?.hours.averagePerPeriod)
  const averagePayRateNumber = toNumber(data?.averages.payRate)
  const totalHoursValue = `${hoursFmt.format(totalHoursNumber)}h`
  const averageHoursValue = `${hoursFmt.format(averageHoursNumber)}h`
  const averagePayRateValue = formatPayRate(averagePayRateNumber)
  const totalDeductionsValue = currency.format(totalDeductionsNumber)
  const paygValue = currency.format(toNumber(totals?.payg))
  const stslValue = currency.format(toNumber(totals?.stsl))
  const otherWithholdings = Math.max(
    0,
    toNumber(totals?.withholdings) - (toNumber(totals?.payg) + toNumber(totals?.stsl))
  )
  const otherWithholdingsValue = currency.format(otherWithholdings)
  const varianceNumber = toNumber(totals?.variance)
  const varianceValue = currency.format(varianceNumber)
  const varianceTone = varianceNumber > 0 ? 'positive' : varianceNumber < 0 ? 'negative' : 'neutral'
  const varianceDescriptor =
    varianceNumber > 0 ? 'Above expectations' : varianceNumber < 0 ? 'Below expectations' : 'On target'

  const grossComparisonItems = comparison && comparisonTitle
    ? [
        resolveCurrencyDeltaDetail('Total Δ', grossTotalNumber, comparison.totals.gross),
        resolveCurrencyDeltaDetail('Avg Δ', averageGrossNumber, comparison.averages.grossPerPeriod),
      ].filter((detail): detail is SummaryCardDetail => Boolean(detail))
    : []

  const netComparisonItems = comparison && comparisonTitle
    ? [
        resolveCurrencyDeltaDetail('Total Δ', netTotalNumber, comparison.totals.net),
        resolveCurrencyDeltaDetail('Avg Δ', averageNetNumber, comparison.averages.netPerPeriod),
      ].filter((detail): detail is SummaryCardDetail => Boolean(detail))
    : []

  const actualComparisonItems = comparison && comparisonTitle
    ? [
        resolveCurrencyDeltaDetail('Total Δ', actualTotalNumber, comparison.totals.actual),
        resolveCurrencyDeltaDetail('Avg Δ', averageActualNumber, comparison.averages.actualPerPeriod),
      ].filter((detail): detail is SummaryCardDetail => Boolean(detail))
    : []

  const deductionsComparisonItems = comparison && comparisonTitle
    ? [resolveCurrencyDeltaDetail('Total Δ', totalDeductionsNumber, comparison.totals.withholdings)].filter(
        (detail): detail is SummaryCardDetail => Boolean(detail)
      )
    : []

  const hoursComparisonItems = comparison && comparisonTitle
    ? [
        resolveHoursDeltaDetail('Total Δ', totalHoursNumber, comparison.hours.total),
        resolveHoursDeltaDetail('Avg Δ', averageHoursNumber, comparison.hours.averagePerPeriod),
        resolvePayRateDeltaDetail('Avg rate Δ', averagePayRateNumber, comparison.averages.payRate),
      ].filter((detail): detail is SummaryCardDetail => Boolean(detail))
    : []

  const varianceComparisonItems = comparison && comparisonTitle
    ? [resolveCurrencyDeltaDetail('Total Δ', varianceNumber, comparison.totals.variance)].filter(
        (detail): detail is SummaryCardDetail => Boolean(detail)
      )
    : []

  const summaryCards: SummaryCardData[] = [
    {
      key: 'gross',
      label: 'Gross Pay',
      total: currency.format(grossTotalNumber),
      tone: 'neutral' as const,
      sections: [
        {
          title: 'This period',
          items: [{ label: 'Avg / period', value: currency.format(averageGrossNumber) }],
        },
        ...(grossComparisonItems.length > 0
          ? [
              {
                title: `Change vs ${comparisonSectionTitle}`,
                items: grossComparisonItems,
              },
            ]
          : []),
      ],
    },
    {
      key: 'net',
      label: 'Net Pay',
      total: currency.format(netTotalNumber),
      tone: 'neutral' as const,
      sections: [
        {
          title: 'This period',
          items: [{ label: 'Avg / period', value: currency.format(averageNetNumber) }],
        },
        ...(netComparisonItems.length > 0
          ? [
              {
                title: `Change vs ${comparisonSectionTitle}`,
                items: netComparisonItems,
              },
            ]
          : []),
      ],
    },
    {
      key: 'actual',
      label: 'Actual Pay',
      total: currency.format(actualTotalNumber),
      tone: 'neutral' as const,
      sections: [
        {
          title: 'This period',
          items: [{ label: 'Avg / period', value: currency.format(averageActualNumber) }],
        },
        ...(actualComparisonItems.length > 0
          ? [
              {
                title: `Change vs ${comparisonSectionTitle}`,
                items: actualComparisonItems,
              },
            ]
          : []),
      ],
    },
    {
      key: 'deductions',
      label: 'Total Deductions',
      total: totalDeductionsValue,
      tone: 'neutral' as const,
      sections: [
        {
          title: 'This period',
          items: [
            { label: 'PAYG', value: paygValue },
            { label: 'STSL', value: stslValue },
            ...(otherWithholdings > 0 ? [{ label: 'Other', value: otherWithholdingsValue }] : []),
          ],
        },
        ...(deductionsComparisonItems.length > 0
          ? [
              {
                title: `Change vs ${comparisonSectionTitle}`,
                items: deductionsComparisonItems,
              },
            ]
          : []),
      ],
    },
    {
      key: 'hours',
      label: 'Hours Worked',
      total: totalHoursValue,
      tone: 'neutral' as const,
      sections: [
        {
          title: 'This period',
          items: [
            { label: 'Avg / period', value: averageHoursValue },
            { label: 'Avg pay rate', value: averagePayRateValue },
          ],
        },
        ...(hoursComparisonItems.length > 0
          ? [
              {
                title: `Change vs ${comparisonSectionTitle}`,
                items: hoursComparisonItems,
              },
            ]
          : []),
      ],
    },
    {
      key: 'variance',
      label: 'Variance',
      total: varianceValue,
      tone: varianceTone,
      sections: [
        {
          title: 'This period',
          items: [{ label: 'Actual vs expected', value: varianceDescriptor }],
        },
        ...(varianceComparisonItems.length > 0
          ? [
              {
                title: `Change vs ${comparisonSectionTitle}`,
                items: varianceComparisonItems,
              },
            ]
          : []),
      ],
    },
  ]

  if (loading && !data) {
    return (
      <div className="statistics statistics__loading-state">
        <Card variant="elevated" className="statistics__card">
          <CardBody>
            <p>Loading financial year statistics…</p>
          </CardBody>
        </Card>
      </div>
    )
  }

  return (
    <div className="statistics">
      <div className="statistics__toolbar">
        <div className="statistics__toolbar-inputs">
          <div>
            <p className="statistics__toolbar-label">Financial Year</p>
            <select
              className="statistics__select"
              value={selectedTaxYear}
              onChange={(event) => setTaxYear(event.target.value || undefined)}
            >
              {availableTaxYears.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="statistics__toolbar-label">Quarter</p>
            <select
              className="statistics__select"
              value={selectedQuarter}
              onChange={(event) => setQuarter(event.target.value as QuarterFilterValue)}
            >
              {quarterOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="primary"
          className="statistics__refresh"
          leftIcon={<RefreshCw size={16} />}
          onClick={() => refresh(selectedTaxYear || undefined, selectedQuarter)}
          isLoading={loading}
          loadingText="Refreshing"
        >
          Refresh
        </Button>
      </div>

      {error && (
        <Card variant="elevated">
          <CardBody>
            <p className="statistics__error">{error}</p>
          </CardBody>
        </Card>
      )}

      <div className="statistics__grid">
        <Card variant="elevated">
          <CardBody>
            <h3>{totalsHeading}</h3>
            <div className="statistics__summary-grid">
              {summaryCards.map((card) => (
                <div
                  key={card.key}
                  className={`statistics__summary-card${
                    card.tone !== 'neutral' ? ` statistics__summary-card--${card.tone}` : ''
                  }`}
                >
                  <div className="statistics__summary-main">
                    <p className="statistics__summary-label">{card.label}</p>
                    <p className="statistics__summary-value">{card.total}</p>
                  </div>
                  {card.sections.length > 1 && (
                    <button
                      type="button"
                      className={`statistics__summary-toggle${expandedCards.has(card.key) ? ' statistics__summary-toggle--expanded' : ''}`}
                      onClick={() => toggleCardExpansion(card.key)}
                      aria-expanded={expandedCards.has(card.key)}
                    >
                      <span>{expandedCards.has(card.key) ? 'Hide comparison' : 'Show comparison'}</span>
                      <ChevronDown size={14} aria-hidden className="statistics__summary-toggle-icon" />
                    </button>
                  )}
                  {card.sections.map((section, index) => {
                    if (index > 0 && !expandedCards.has(card.key)) {
                      return null
                    }
                    return (
                      <div key={`${card.key}-${section.title}`} className="statistics__summary-section">
                        <p className="statistics__summary-section-title">{section.title}</p>
                        <dl className="statistics__summary-details">
                          {section.items.map((detail) => {
                            const toneClass = detail.tone && detail.tone !== 'neutral'
                              ? ` statistics__summary-detail-value--${detail.tone}`
                              : ''
                            return (
                              <React.Fragment key={`${card.key}-${section.title}-${detail.label}`}>
                                <dt>{detail.label}</dt>
                                <dd className={`statistics__summary-detail-value${toneClass}`}>{detail.value}</dd>
                              </React.Fragment>
                            )
                          })}
                        </dl>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
            <p className={`statistics__comparison-note${comparison ? '' : ' statistics__comparison-note--muted'}`}>
              {comparisonNote}
            </p>
            <div className="statistics__status-bar">
              {data && Object.entries(data.statusCounts).map(([status, count]) => (
                <div key={status} className="statistics__status-chip">
                  <StatusBadge status={status as PayPeriodStatus} size="sm" />
                  <span className="statistics__status-count">{count}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card variant="elevated">
          <CardBody>
            <div className="statistics__card-header">
              <h3>Pay Period Trends</h3>
              <div className="statistics__chip-group">
                {metricConfigs.map((metric) => (
                  <button
                    key={metric.key}
                    type="button"
                    className={`statistics__chip ${activeMetricKeys.includes(metric.key) ? 'statistics__chip--active' : ''}`}
                    onClick={() => toggleMetric(metric.key)}
                  >
                    {metric.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="statistics__chart">
              <ResponsiveContainer width="100%" height={360}>
                <LineChart data={chartData} margin={{ top: 16, right: 16, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis
                    dataKey="label"
                    tick={axisTickStyle}
                    tickLine={false}
                    axisLine={{ stroke: axisLineColor }}
                  />
                  <YAxis
                    tickFormatter={(value) => currency.format(value)}
                    tick={axisTickStyle}
                    tickLine={false}
                    axisLine={{ stroke: axisLineColor }}
                    width={100}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={tooltipLabelStyle}
                    itemStyle={tooltipItemStyle}
                    formatter={(value: number, name: string) => {
                      const metric = metricConfigs.find((m) => m.label === name)
                      return [metric ? metric.formatter(value) : value, name]
                    }}
                  />
                  <Legend wrapperStyle={legendStyle} iconType="circle" />
                  {activeMetrics.map((metric) => (
                    <Line
                      key={metric.key}
                      type="monotone"
                      dataKey={metric.key}
                      name={metric.label}
                      stroke={metric.color}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="statistics__grid statistics__grid--two-column">
        <Card variant="elevated">
          <CardBody>
            <div className="statistics__card-header">
              <h3>Withholdings Breakdown</h3>
              <span className="statistics__subtle">Stacked comparison of PAYG, STSL and other deductions</span>
            </div>
            <div className="statistics__chart">
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
                  <defs>
                    <linearGradient id="colorPayg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={palette.danger} stopOpacity={0.8} />
                      <stop offset="95%" stopColor={palette.danger} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorStsl" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={palette.accent} stopOpacity={0.8} />
                      <stop offset="95%" stopColor={palette.accent} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorOther" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={palette.contrast} stopOpacity={0.8} />
                      <stop offset="95%" stopColor={palette.contrast} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis
                    dataKey="label"
                    tick={axisTickStyle}
                    tickLine={false}
                    axisLine={{ stroke: axisLineColor }}
                  />
                  <YAxis
                    tickFormatter={(value) => currency.format(value)}
                    tick={axisTickStyle}
                    tickLine={false}
                    axisLine={{ stroke: axisLineColor }}
                    width={100}
                  />
                  <Tooltip
                    formatter={(value: number) => currency.format(value)}
                    contentStyle={tooltipStyle}
                    labelStyle={tooltipLabelStyle}
                    itemStyle={tooltipItemStyle}
                  />
                  <Legend wrapperStyle={legendStyle} iconType="circle" />
                  <Area type="monotone" dataKey="payg" stackId="1" stroke={palette.danger} fill="url(#colorPayg)" name="PAYG" />
                  <Area type="monotone" dataKey="stsl" stackId="1" stroke={palette.accent} fill="url(#colorStsl)" name="STSL" />
                  <Area type="monotone" dataKey="otherWithholdings" stackId="1" stroke={palette.contrast} fill="url(#colorOther)" name="Other" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <Card variant="elevated">
          <CardBody>
            <div className="statistics__card-header">
              <h3>Monthly Totals</h3>
              <span className="statistics__subtle">Gross vs Net outlook by month</span>
            </div>
            <div className="statistics__chart">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={monthlyBuckets} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis
                    dataKey="month"
                    tick={axisTickStyle}
                    tickLine={false}
                    axisLine={{ stroke: axisLineColor }}
                  />
                  <YAxis
                    tickFormatter={(value) => currency.format(value)}
                    tick={axisTickStyle}
                    tickLine={false}
                    axisLine={{ stroke: axisLineColor }}
                    width={100}
                  />
                  <Tooltip
                    formatter={(value: number) => currency.format(value)}
                    contentStyle={tooltipStyle}
                    labelStyle={tooltipLabelStyle}
                    itemStyle={tooltipItemStyle}
                  />
                  <Legend wrapperStyle={legendStyle} iconType="circle" />
                  <Bar dataKey="gross" fill={palette.primary} name="Gross" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="net" fill={palette.primaryLight} name="Net" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <Card variant="elevated">
          <CardBody>
            <div className="statistics__card-header">
              <h3>Withholding Share</h3>
              <span className="statistics__subtle">Share of total deductions across the year</span>
            </div>
            <div className="statistics__chart statistics__chart--center">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={withholdingShare}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={100}
                    labelLine={false}
                    label={renderPieLabel}
                  >
                    {withholdingShare.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => currency.format(value)}
                    contentStyle={tooltipStyle}
                    labelStyle={tooltipLabelStyle}
                    itemStyle={tooltipItemStyle}
                  />
                </PieChart>
              </ResponsiveContainer>
              {withholdingShare.length === 0 && <p className="statistics__empty-note">No withholdings recorded yet.</p>}
            </div>
          </CardBody>
        </Card>

        <Card variant="elevated">
          <CardBody>
            <div className="statistics__card-header">
              <h3>Heatmap by Pay Period</h3>
              <span className="statistics__subtle">Spot the biggest earning periods at a glance</span>
            </div>
            <Heatmap periods={payPeriods} />
          </CardBody>
        </Card>
      </div>

      <Card variant="elevated">
        <CardBody>
          <div className="statistics__card-header">
            <h3>Pay Period Detail</h3>
            <span className="statistics__subtle">All figures are rounded to two decimals</span>
          </div>
          <div className="statistics__table-wrapper">
            <table className="statistics__table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Status</th>
                  <th>Gross</th>
                  <th>Net</th>
                  <th>Actual</th>
                  <th>Variance</th>
                  <th>Hours</th>
                  <th>Base</th>
                  <th>Overtime</th>
                  <th>Penalty</th>
                </tr>
              </thead>
              <tbody>
                {payPeriods.map((period) => {
                  const start = new Date(period.startDate)
                  const end = new Date(period.endDate)
                  const range = `${start.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}`
                  return (
                    <tr key={period.id}>
                      <td>{range}</td>
                      <td>
                        <StatusBadge status={period.status} size="sm" />
                      </td>
                      <td>{currency.format(toNumber(period.totals.gross))}</td>
                      <td>{currency.format(toNumber(period.totals.net))}</td>
                      <td>{currency.format(toNumber(period.totals.actual))}</td>
                      <td>{currency.format(toNumber(period.totals.variance))}</td>
                      <td>{hoursFmt.format(toNumber(period.hours.total))}h</td>
                      <td>{currency.format(toNumber(period.breakdown.basePay))}</td>
                      <td>{currency.format(toNumber(period.breakdown.overtimePay))}</td>
                      <td>{currency.format(toNumber(period.breakdown.penaltyPay))}</td>
                    </tr>
                  )
                })}
                {payPeriods.length === 0 && (
                  <tr>
                    <td colSpan={10} className="statistics__empty-note">No pay periods captured in this tax year yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Card variant="elevated">
        <CardBody>
          <div className="statistics__card-header">
            <h3>Insights & Highlights</h3>
            <span className="statistics__subtle">Auto-generated from the latest data snapshot</span>
          </div>
          <ul className="statistics__insights">
            <li>
              <Sparkle size={16} />
              <span>Total processed pay periods: <strong>{payPeriods.length}</strong></span>
            </li>
            <li>
              <Zap size={16} />
              <span>Highest gross pay: <strong>{currency.format(Math.max(0, ...payPeriods.map((p) => toNumber(p.totals.gross))))}</strong></span>
            </li>
            <li>
              <Zap size={16} />
              <span>Largest variance: <strong>{currency.format(Math.max(0, ...payPeriods.map((p) => Math.abs(toNumber(p.totals.variance)))))}</strong></span>
            </li>
          </ul>
        </CardBody>
      </Card>
    </div>
  )
}
