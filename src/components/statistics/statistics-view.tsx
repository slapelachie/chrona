'use client'

import React, { useMemo, useState } from 'react'
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
import { RefreshCw, Sparkle, Zap } from 'lucide-react'
import { Card, CardBody } from '../ui'
import { useFinancialYearStats } from '@/hooks/use-financial-year-stats'
import { FinancialYearPayPeriodStat } from '@/types'
import { buildChartData, buildMonthlyBuckets, buildWithholdingShare, toNumber } from './statistics-utils'
import './statistics.scss'

type ChartMetricKey = 'gross' | 'rosteredGross' | 'net' | 'actual' | 'payg' | 'stsl'

interface MetricConfig {
  key: ChartMetricKey
  label: string
  color: string
  axis?: 'left' | 'right'
  formatter: (value: number) => string
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
  { key: 'gross', label: 'Gross Pay', color: '#2563eb', formatter: (v) => currency.format(v) },
  { key: 'rosteredGross', label: 'Rostered Gross', color: '#1d4ed8', formatter: (v) => currency.format(v) },
  { key: 'net', label: 'Net Pay', color: '#16a34a', formatter: (v) => currency.format(v) },
  { key: 'actual', label: 'Actual Pay', color: '#f97316', formatter: (v) => currency.format(v) },
  { key: 'payg', label: 'PAYG', color: '#dc2626', formatter: (v) => currency.format(v) },
  { key: 'stsl', label: 'STSL', color: '#0ea5e9', formatter: (v) => currency.format(v) },
]

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
        const intensity = Math.max(0.08, ratio)
        const style = {
          backgroundColor: `rgba(37, 99, 235, ${intensity})`,
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
  const { data, error, loading, availableTaxYears, taxYear, setTaxYear, refresh } = useFinancialYearStats()
  const [activeMetricKeys, setActiveMetricKeys] = useState<ChartMetricKey[]>(metricConfigs.map((m) => m.key))

  const payPeriods = data?.payPeriods ?? []
  const chartData = useMemo(() => buildChartData(payPeriods), [payPeriods])
  const monthlyBuckets = useMemo(() => buildMonthlyBuckets(payPeriods), [payPeriods])
  const totals = data?.totals
  const withholdingShare = totals ? buildWithholdingShare(totals) : []
  const selectedTaxYear = taxYear ?? data?.taxYear ?? (availableTaxYears[0] ?? '')

  const toggleMetric = (key: ChartMetricKey) => {
    setActiveMetricKeys((prev) => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev
        return prev.filter((k) => k !== key)
      }
      return [...prev, key]
    })
  }

  const activeMetrics = metricConfigs.filter((config) => activeMetricKeys.includes(config.key))

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
        <button className="statistics__refresh" type="button" onClick={() => refresh(selectedTaxYear)} disabled={loading}>
          <RefreshCw size={16} />
          <span>Refresh</span>
        </button>
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
            <h3>Year-to-date Totals</h3>
            <div className="statistics__summary-grid">
              <div>
                <p className="statistics__summary-label">Gross Pay</p>
                <p className="statistics__summary-value">{currency.format(toNumber(totals?.gross))}</p>
              </div>
              <div>
                <p className="statistics__summary-label">Net Pay</p>
                <p className="statistics__summary-value">{currency.format(toNumber(totals?.net))}</p>
              </div>
              <div>
                <p className="statistics__summary-label">Actual Pay</p>
                <p className="statistics__summary-value">{currency.format(toNumber(totals?.actual))}</p>
              </div>
              <div>
                <p className="statistics__summary-label">Variance</p>
                <p className="statistics__summary-value statistics__summary-value--accent">{currency.format(toNumber(totals?.variance))}</p>
              </div>
              <div>
                <p className="statistics__summary-label">Total Hours</p>
                <p className="statistics__summary-value">{hoursFmt.format(toNumber(data?.hours.total))}h</p>
              </div>
              <div>
                <p className="statistics__summary-label">Average Pay Rate</p>
                <p className="statistics__summary-value">{currency.format(toNumber(data?.averages.payRate))}/h</p>
              </div>
            </div>
            <div className="statistics__status-bar">
              {data && Object.entries(data.statusCounts).map(([status, count]) => (
                <div key={status}>
                  <span>{status}</span>
                  <strong>{count}</strong>
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(value) => currency.format(value).replace('$', '$')} tick={{ fontSize: 12 }} width={90} />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      const metric = metricConfigs.find((m) => m.label === name)
                      return [metric ? metric.formatter(value) : value, name]
                    }}
                  />
                  <Legend />
                  {activeMetrics.map((metric) => (
                    <Line
                      key={metric.key}
                      type="monotone"
                      dataKey={metric.key}
                      name={metric.label}
                      stroke={metric.color}
                      strokeWidth={2}
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
                      <stop offset="5%" stopColor="#dc2626" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorStsl" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorOther" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7e22ce" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#7e22ce" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(value) => currency.format(value)} tick={{ fontSize: 12 }} width={90} />
                  <Tooltip formatter={(value: number) => currency.format(value)} />
                  <Legend />
                  <Area type="monotone" dataKey="payg" stackId="1" stroke="#dc2626" fill="url(#colorPayg)" name="PAYG" />
                  <Area type="monotone" dataKey="stsl" stackId="1" stroke="#0ea5e9" fill="url(#colorStsl)" name="STSL" />
                  <Area type="monotone" dataKey="otherWithholdings" stackId="1" stroke="#7e22ce" fill="url(#colorOther)" name="Other" />
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(value) => currency.format(value)} tick={{ fontSize: 12 }} width={90} />
                  <Tooltip formatter={(value: number) => currency.format(value)} />
                  <Legend />
                  <Bar dataKey="gross" fill="#2563eb" name="Gross" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="net" fill="#16a34a" name="Net" radius={[4, 4, 0, 0]} />
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
                  <Pie data={withholdingShare} dataKey="value" nameKey="name" outerRadius={100} label> 
                    {withholdingShare.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => currency.format(value)} />
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
                      <td className={`statistics__status statistics__status--${period.status}`}>{period.status}</td>
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
