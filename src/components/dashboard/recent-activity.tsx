'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardHeader, CardBody } from '../ui'
import { 
  Clock, 
  DollarSign, 
  FileText, 
  CheckCircle, 
  AlertCircle,
  TrendingUp
} from 'lucide-react'
import './recent-activity.scss'

interface ActivityItem {
  id: string
  type: 'shift_completed' | 'pay_period_closed' | 'payment_received' | 'tax_calculated' | 'alert'
  title: string
  description: string
  timestamp: string
  amount?: number
  status?: 'success' | 'warning' | 'info'
}

const getActivityIcon = (type: ActivityItem['type'], status?: ActivityItem['status']) => {
  switch (type) {
    case 'shift_completed':
      return <Clock size={18} />
    case 'pay_period_closed':
      return <FileText size={18} />
    case 'payment_received':
      return <DollarSign size={18} />
    case 'tax_calculated':
      return <TrendingUp size={18} />
    case 'alert':
      return status === 'warning' ? <AlertCircle size={18} /> : <CheckCircle size={18} />
    default:
      return <Clock size={18} />
  }
}

const getActivityColor = (type: ActivityItem['type'], status?: ActivityItem['status']) => {
  switch (type) {
    case 'shift_completed':
      return 'var(--color-primary)'
    case 'pay_period_closed':
      return 'var(--color-text-secondary)'
    case 'payment_received':
      return 'var(--color-success)'
    case 'tax_calculated':
      return 'var(--color-primary)'
    case 'alert':
      return status === 'warning' ? 'var(--color-warning)' : 'var(--color-success)'
    default:
      return 'var(--color-text-secondary)'
  }
}

const ActivityItemComponent: React.FC<{ activity: ActivityItem }> = ({ activity }) => {
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) {
      return date.toLocaleTimeString('en-AU', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return `${diffDays} days ago`
    } else {
      return date.toLocaleDateString('en-AU', { 
        month: 'short', 
        day: 'numeric' 
      })
    }
  }

  return (
    <div className="activity-item">
      <div 
        className="activity-item__icon"
        style={{ color: getActivityColor(activity.type, activity.status) }}
      >
        {getActivityIcon(activity.type, activity.status)}
      </div>
      
      <div className="activity-item__content">
        <div className="activity-item__header">
          <h4 className="activity-item__title">
            {activity.title}
          </h4>
          <span className="activity-item__timestamp">
            {formatTimestamp(activity.timestamp)}
          </span>
        </div>
        
        <p className="activity-item__description">
          {activity.description}
        </p>
        
        {activity.amount && (
          <div className="activity-item__amount">
            <span className="text-mono text-aqua">
              ${activity.amount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export const RecentActivity: React.FC = () => {
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/dashboard/summary', { cache: 'no-store' })
        const json = await res.json()
        if (cancelled) return
        const items: ActivityItem[] = (json?.data?.recentActivities ?? []).map((a: any) => ({
          id: a.id,
          type: a.type,
          title: a.title,
          description: a.description,
          timestamp: a.timestamp,
          amount: typeof a.amount === 'number' ? a.amount : undefined,
          status: a.status,
        }))
        setRecentActivities(items)
      } catch (_) {
        if (!cancelled) setRecentActivities([])
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="recent-activity">
      <div className="recent-activity__header">
        <h2 className="recent-activity__title">Recent Activity</h2>
        <button className="recent-activity__view-all">
          View All
        </button>
      </div>
      
      <Card variant="default">
        <CardBody padding="none">
          <div className="recent-activity__list">
            {recentActivities.map((activity, index) => (
              <div key={activity.id}>
                <ActivityItemComponent activity={activity} />
                {index < recentActivities.length - 1 && (
                  <div className="recent-activity__divider" />
                )}
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
