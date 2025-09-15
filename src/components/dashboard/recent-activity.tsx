'use client'

import React from 'react'
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
  // Mock data - in real app, this would come from API/database
  const recentActivities: ActivityItem[] = [
    {
      id: '1',
      type: 'shift_completed',
      title: 'Shift Completed',
      description: 'Morning shift at Main Store (8h)',
      timestamp: '2024-09-10T17:00:00',
      amount: 208.50
    },
    {
      id: '2',
      type: 'payment_received',
      title: 'Payment Received',
      description: 'Pay period Sep 2-15 payment processed',
      timestamp: '2024-09-09T10:30:00',
      amount: 1847.25,
      status: 'success'
    },
    {
      id: '3',
      type: 'tax_calculated',
      title: 'Tax Update',
      description: 'YTD tax calculations updated',
      timestamp: '2024-09-09T10:30:00',
      status: 'info'
    },
    {
      id: '4',
      type: 'alert',
      title: 'Hours Alert',
      description: 'You\'re close to overtime threshold this week',
      timestamp: '2024-09-08T14:15:00',
      status: 'warning'
    },
    {
      id: '5',
      type: 'pay_period_closed',
      title: 'Pay Period Closed',
      description: 'Aug 19 - Sep 1 period finalized',
      timestamp: '2024-09-02T09:00:00'
    }
  ]

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