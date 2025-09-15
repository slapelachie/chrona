'use client'

import React from 'react'
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
  // Mock data - in real app, this would come from API/database
  const stats = [
    {
      title: 'This Week',
      value: '32.5h',
      subtitle: 'Hours worked',
      icon: <Clock size={24} />,
      trend: {
        value: '+5.2h',
        isPositive: true
      }
    },
    {
      title: 'Projected Pay',
      value: '$847.50',
      subtitle: 'This period',
      icon: <DollarSign size={24} />,
      trend: {
        value: '+$127',
        isPositive: true
      }
    },
    {
      title: 'YTD Earnings',
      value: '$12,345',
      subtitle: 'Tax year 2024-25',
      icon: <TrendingUp size={24} />
    },
    {
      title: 'Next Shift',
      value: 'Tomorrow',
      subtitle: '9:00 AM - 5:00 PM',
      icon: <Calendar size={24} />
    }
  ]

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