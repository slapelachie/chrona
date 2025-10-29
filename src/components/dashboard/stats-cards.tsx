'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Card, CardBody } from '../ui'
import { Clock, DollarSign, TrendingUp, Calendar } from 'lucide-react'
import './stats-cards.scss'

interface StatCardProps {
  title: string
  value: string
  subtitle?: string
  icon: React.ReactNode
  trend?: {
    value: string
    isPositive: boolean
  }
  inlineNote?: string
}

const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle, icon, trend, inlineNote }) => (
  <Card variant="elevated" className="stat-card">
    <CardBody>
      <div className="stat-card__header">
        <div className="stat-card__icon">
          {icon}
        </div>
        {trend && (
          <div className={`stat-card__trend ${trend.isPositive ? 'stat-card__trend--positive' : 'stat-card__trend--negative'}`}>
            <TrendingUp size={16} />
            <span>{trend.value}</span>
          </div>
        )}
      </div>
      
      <div className="stat-card__content">
        <div className="stat-card__value-row">
          <h3 className="stat-card__value text-mono" style={{ display: 'inline', marginRight: 8 }}>
            {value}
          </h3>
          {inlineNote && (
            <span className="stat-card__inline-note" style={{ opacity: 0.8, fontSize: 14 }}>
              {inlineNote}
            </span>
          )}
        </div>
        <p className="stat-card__title">
          {title}
        </p>
        {subtitle && (
          <p className="stat-card__subtitle">
            {subtitle}
          </p>
        )}
      </div>
    </CardBody>
  </Card>
)

export const StatsCards: React.FC = () => {
  const [summary, setSummary] = useState<any | null>(null)
  const [ytd, setYtd] = useState<any | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [summaryRes, ytdRes] = await Promise.all([
          fetch('/api/dashboard/summary', { cache: 'no-store' }),
          fetch('/api/tax/year-to-date', { cache: 'no-store' }),
        ])
        const summaryJson = await summaryRes.json()
        const ytdJson = await ytdRes.json()
        if (!cancelled) {
          setSummary(summaryJson.data)
          setYtd(ytdJson.data)
        }
      } catch {
        if (!cancelled) {
          setSummary(null)
          setYtd(null)
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const stats = useMemo(() => {
    const hoursWorked = Number(summary?.currentPeriod?.hoursWorked ?? '0')
    const hoursRostered = Number(summary?.currentPeriod?.projections?.rosteredHours ?? '0')
    const projectedGross = Number(summary?.currentPeriod?.projections?.grossPay ?? '0')
    const projectedNet = Number(summary?.currentPeriod?.projections?.netPay ?? '0')
    const rawActual = summary?.currentPeriod?.actualPay
    const hasActual = rawActual !== null && rawActual !== undefined
    const actualNet = hasActual ? Number(rawActual) : 0
    const rawCalc = summary?.currentPeriod?.netPay
    const hasCalc = rawCalc !== null && rawCalc !== undefined
    const calcNet = hasCalc ? Number(rawCalc) : 0
    const ytdGross = Number((ytd?.liveYearToDate?.grossIncome ?? ytd?.yearToDate?.grossIncome) ?? '0')
    const ytdNet = Number((ytd?.liveYearToDate?.netIncome ?? ytd?.yearToDate?.netIncome) ?? '0')

    const fmt = (n: number, min = 2, max = 2) => n.toLocaleString('en-AU', { minimumFractionDigits: min, maximumFractionDigits: max })

    // Next shift summary
    const next = summary?.upcomingShifts?.[0]
    const start = next ? new Date(next.startTime) : null
    const end = next ? new Date(next.endTime) : null
    const nextSubtitle = start && end
      ? `${start.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })} - ${end.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}`
      : '—'

    const items = [
      // 1) Period Pay (Gross vs Net combined)
      {
        title: 'This Period Pay',
        value: `$${fmt(hasActual ? actualNet : (hasCalc ? calcNet : projectedNet))}`,
        inlineNote: hasActual
          ? '(Actual)'
          : (hasCalc ? '(Calculated)' : `(Gross $${fmt(projectedGross)})`),
        subtitle: hasActual
          ? 'Received'
          : (hasCalc ? 'Calculated' : 'Projected (rostered)'),
        icon: <DollarSign size={24} />,
      },
      // 2) YTD Earnings (Gross vs Net combined)
      {
        title: 'YTD Earnings',
        value: `$${fmt(ytdNet, 0, 0)}`,
        inlineNote: `(Gross $${fmt(ytdGross, 0, 0)})`,
        subtitle: `Tax year ${ytd?.taxYear ?? ''}`,
        icon: <TrendingUp size={24} />,
      },
      // 3) Hours worked this period
      {
        title: 'This Period',
        value: `${hoursWorked.toFixed(1)}h`,
        inlineNote: `(Rostered ${hoursRostered.toFixed(1)}h)`,
        subtitle: 'Hours worked',
        icon: <Clock size={24} />,
      },
      // 4) Next shift
      {
        title: 'Next Shift',
        value: start ? start.toLocaleDateString('en-AU', { weekday: 'short' }) : '—',
        subtitle: nextSubtitle,
        icon: <Calendar size={24} />,
      },
    ]
    return items
  }, [summary, ytd])

  return (
    <div className="stats-cards">
      <h2 className="stats-cards__title">Quick Overview</h2>
      <div className="stats-cards__grid">
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>
    </div>
  )
}
