'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardBody } from '../ui'
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
  const [items, setItems] = useState<any[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/dashboard/summary', { cache: 'no-store' })
        const json = await res.json()
        if (!cancelled) setItems(json?.data?.upcomingShifts ?? [])
      } catch {
        if (!cancelled) setItems([])
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="upcoming-shifts">
      <div className="upcoming-shifts__header">
        <h2 className="upcoming-shifts__title">Upcoming Shifts</h2>
        <button className="upcoming-shifts__view-all">
          View All
        </button>
      </div>
      
      {items.length > 0 ? (
        <div className="upcoming-shifts__list">
          {items.map((s: any) => {
            const start = new Date(s.startTime)
            const end = new Date(s.endTime)
            const shift: Shift = {
              id: s.id,
              date: start.toISOString(),
              startTime: start.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }),
              endTime: end.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }),
              location: s.payGuideName ?? '—',
              estimatedPay: Number(s.totalPay ?? '0'),
              duration: `${Number(s.totalHours ?? '0').toFixed(1)}h`,
              isToday: new Date().toDateString() === start.toDateString(),
              isTomorrow: new Date(Date.now() + 24*60*60*1000).toDateString() === start.toDateString(),
            }
            return <ShiftCard key={shift.id} shift={shift} />
          })}
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
