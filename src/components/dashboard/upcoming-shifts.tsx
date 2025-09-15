'use client'

import React from 'react'
import { Card, CardHeader, CardBody } from '../ui'
import { Calendar, Clock, MapPin, DollarSign, ChevronRight } from 'lucide-react'
import './upcoming-shifts.scss'

interface Shift {
  id: string
  date: string
  startTime: string
  endTime: string
  location: string
  estimatedPay: number
  duration: string
  isToday?: boolean
  isTomorrow?: boolean
}

const ShiftCard: React.FC<{ shift: Shift }> = ({ shift }) => {
  const getDateLabel = () => {
    if (shift.isToday) return 'Today'
    if (shift.isTomorrow) return 'Tomorrow'
    return new Date(shift.date).toLocaleDateString('en-AU', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  return (
    <Card 
      variant="default" 
      interactive 
      className="shift-card"
    >
      <CardBody>
        <div className="shift-card__content">
          <div className="shift-card__header">
            <div className="shift-card__date">
              <Calendar size={16} />
              <span className={shift.isToday || shift.isTomorrow ? 'text-aqua' : ''}>
                {getDateLabel()}
              </span>
            </div>
            <ChevronRight size={16} className="shift-card__arrow" />
          </div>
          
          <div className="shift-card__details">
            <div className="shift-card__time">
              <Clock size={16} />
              <span className="text-mono">
                {shift.startTime} - {shift.endTime}
              </span>
              <span className="shift-card__duration">
                ({shift.duration})
              </span>
            </div>
            
            <div className="shift-card__location">
              <MapPin size={16} />
              <span>{shift.location}</span>
            </div>
            
            <div className="shift-card__pay">
              <DollarSign size={16} />
              <span className="text-mono text-aqua">
                ${shift.estimatedPay.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
              </span>
              <span className="shift-card__pay-label">estimated</span>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}

export const UpcomingShifts: React.FC = () => {
  // Mock data - in real app, this would come from API/database
  const upcomingShifts: Shift[] = [
    {
      id: '1',
      date: '2024-09-11',
      startTime: '9:00 AM',
      endTime: '5:00 PM',
      location: 'Main Store',
      estimatedPay: 208.50,
      duration: '8h',
      isTomorrow: true
    },
    {
      id: '2',
      date: '2024-09-12',
      startTime: '10:00 AM',
      endTime: '6:00 PM',
      location: 'West Side Location',
      estimatedPay: 216.75,
      duration: '8h'
    },
    {
      id: '3',
      date: '2024-09-14',
      startTime: '8:00 AM',
      endTime: '2:00 PM',
      location: 'Main Store',
      estimatedPay: 156.25,
      duration: '6h'
    }
  ]

  return (
    <div className="upcoming-shifts">
      <div className="upcoming-shifts__header">
        <h2 className="upcoming-shifts__title">Upcoming Shifts</h2>
        <button className="upcoming-shifts__view-all">
          View All
        </button>
      </div>
      
      {upcomingShifts.length > 0 ? (
        <div className="upcoming-shifts__list">
          {upcomingShifts.map((shift) => (
            <ShiftCard key={shift.id} shift={shift} />
          ))}
        </div>
      ) : (
        <Card variant="default">
          <CardBody>
            <div className="upcoming-shifts__empty">
              <Calendar size={48} />
              <h3>No upcoming shifts</h3>
              <p>Your next shifts will appear here once scheduled.</p>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  )
}