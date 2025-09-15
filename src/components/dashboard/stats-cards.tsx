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
}

const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle, icon, trend }) => (
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
        <h3 className="stat-card__value text-mono">
          {value}
        </h3>
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
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
      } catch (e) {
        if (!cancelled) {
          setSummary(null)
          setYtd(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const stats = useMemo(() => {
    const hoursWorked = Number(summary?.currentPeriod?.hoursWorked ?? '0')
    const projectedGross = Number(summary?.currentPeriod?.projections?.grossPay ?? '0')
    const ytdGross = Number(ytd?.yearToDate?.grossIncome ?? '0')

    // Next shift summary
    const next = summary?.upcomingShifts?.[0]
    const start = next ? new Date(next.startTime) : null
    const end = next ? new Date(next.endTime) : null
    const nextSubtitle = start && end
      ? `${start.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })} - ${end.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}`
      : '—'

    const items = [
      {
        title: 'This Period',
        value: `${hoursWorked.toFixed(1)}h`,
        subtitle: 'Hours worked',
        icon: <Clock size={24} />,
      },
      {
        title: 'Projected Pay',
        value: `$${projectedGross.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        subtitle: 'This period (rostered)',
        icon: <DollarSign size={24} />,
      },
      {
        title: 'YTD Earnings',
        value: `$${ytdGross.toLocaleString('en-AU')}`,
        subtitle: `Tax year ${ytd?.taxYear ?? ''}`,
        icon: <TrendingUp size={24} />,
      },
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
