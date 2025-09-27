'use client'

import React from 'react'
import { Card, CardBody } from '../ui'
import { 
  Clock, 
  MapPin, 
  DollarSign, 
  Calendar,
  ChevronRight 
} from 'lucide-react'
import { ShiftListItem } from '@/types'
import './shift-card.scss'

interface ShiftCardProps {
  shift: ShiftListItem
  onClick?: () => void
  showActions?: boolean
  showDate?: boolean
}

export const ShiftCard: React.FC<ShiftCardProps> = ({
  shift,
  onClick,
  showActions = false,
  showDate = true
}) => {
  const formatDate = (date: Date | string) => {
    const d = new Date(date)
    return d.toLocaleDateString('en-AU', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric' 
    })
  }

  const formatTime = (date: Date | string) => {
    const d = new Date(date)
    return d.toLocaleTimeString('en-AU', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false
    })
  }

  const formatDuration = (hours: string | number | undefined) => {
    if (!hours) return 'N/A'
    const h = typeof hours === 'string' ? parseFloat(hours) : hours
    const wholeHours = Math.floor(h)
    const minutes = Math.round((h - wholeHours) * 60)
    
    if (minutes === 0) {
      return `${wholeHours}h`
    } else {
      return `${wholeHours}h ${minutes}m`
    }
  }

  const formatCurrency = (amount: string | number | undefined) => {
    if (!amount) return '$0.00'
    const value = typeof amount === 'string' ? parseFloat(amount) : amount
    return value.toLocaleString('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 2
    })
  }

  const getShiftStatus = () => {
    const now = new Date()
    const startTime = new Date(shift.startTime)
    const endTime = new Date(shift.endTime)

    if (now < startTime) {
      return 'upcoming'
    } else if (now > endTime) {
      return 'completed'
    } else {
      return 'in-progress'
    }
  }

  const status = getShiftStatus()

  return (
    <Card 
      variant="default" 
      interactive={!!onClick}
      className={`shift-card shift-card--${status}`}
      onClick={onClick}
    >
      <CardBody>
        <div className="shift-card__content">
          {showDate && (
            <div className="shift-card__header">
              <div className="shift-card__date">
                <Calendar size={16} />
                <span>{formatDate(shift.startTime)}</span>
              </div>
              
              <div className="shift-card__status">
                <span className={`shift-card__status-badge shift-card__status-badge--${status}`}>
                  {status === 'upcoming' && 'Upcoming'}
                  {status === 'in-progress' && 'In Progress'}
                  {status === 'completed' && 'Completed'}
                </span>
              </div>
              
              {onClick && (
                <ChevronRight size={16} className="shift-card__arrow" />
              )}
            </div>
          )}

          <div className="shift-card__details">
            <div className="shift-card__time">
              <Clock size={16} />
              <span>
                {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                <span className="shift-card__duration">
                  ({formatDuration(shift.totalHours)})
                </span>
              </span>
            </div>

            {shift.payGuide && (
              <div className="shift-card__location">
                <MapPin size={16} />
                <span>{shift.payGuide.name}</span>
              </div>
            )}

            <div className="shift-card__pay">
              <DollarSign size={16} />
              <span className="shift-card__pay-amount">
                {formatCurrency(shift.totalPay)}
                <span className="shift-card__pay-label">total</span>
              </span>
            </div>
          </div>

          {shift.notes && (
            <div className="shift-card__notes">
              <p>{shift.notes}</p>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  )
}
