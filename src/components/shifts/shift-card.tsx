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
import {
  formatCurrencyAmount,
  formatDateLabel,
  formatDurationFromHours,
  formatTime,
} from '../utils/format'

interface ShiftCardProps {
  shift: ShiftListItem
  onClick?: () => void
  showDate?: boolean
}

export const ShiftCard: React.FC<ShiftCardProps> = ({
  shift,
  onClick,
  showDate = true
}) => {
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
                <span>{formatDateLabel(shift.startTime)}</span>
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
                  ({formatDurationFromHours(shift.totalHours)})
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
                {formatCurrencyAmount(shift.totalPay)}
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
