'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardBody, Button } from '../ui'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface ShiftEvent {
  id: string
  startTime: Date
  endTime: Date
  totalPay?: string
  payGuide?: {
    name: string
  }
  status: 'upcoming' | 'in-progress' | 'completed'
}

interface CalendarViewProps {
  onShiftClick?: (shiftId: string) => void
}

export const CalendarView: React.FC<CalendarViewProps> = ({ onShiftClick }) => {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [shifts, setShifts] = useState<ShiftEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month')
  const router = useRouter()

  // Generate calendar dates for the current view
  const getCalendarDates = () => {
    if (viewMode === 'week') {
      const startOfWeek = new Date(currentDate)
      startOfWeek.setDate(currentDate.getDate() - currentDate.getDay())
      
      const dates = []
      for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek)
        date.setDate(startOfWeek.getDate() + i)
        dates.push(date)
      }
      return dates
    } else {
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth()
      
      const firstDay = new Date(year, month, 1)
      const lastDay = new Date(year, month + 1, 0)
      const startDate = new Date(firstDay)
      startDate.setDate(startDate.getDate() - startDate.getDay())
      
      const dates = []
      for (let i = 0; i < 42; i++) {
        const date = new Date(startDate)
        date.setDate(startDate.getDate() + i)
        dates.push(date)
      }
      return dates
    }
  }

  // Fetch shifts for the current view period
  const fetchShifts = async () => {
    try {
      setLoading(true)
      
      const dates = getCalendarDates()
      const startDate = dates[0].toISOString().split('T')[0]
      const endDate = dates[dates.length - 1].toISOString().split('T')[0]
      
      const response = await fetch(
        `/api/shifts?startDate=${startDate}&endDate=${endDate}&include=payGuide&limit=100`
      )
      
      if (response.ok) {
        const data = await response.json()
        const shiftsData = data.data?.shifts || []
        
        const parsedShifts: ShiftEvent[] = shiftsData.map((shift: any) => ({
          id: shift.id,
          startTime: new Date(shift.startTime),
          endTime: new Date(shift.endTime),
          totalPay: shift.totalPay,
          payGuide: shift.payGuide,
          status: getShiftStatus(new Date(shift.startTime), new Date(shift.endTime))
        }))
        
        setShifts(parsedShifts)
      }
    } catch (error) {
      console.error('Failed to fetch shifts:', error)
    } finally {
      setLoading(false)
    }
  }

  // Determine shift status based on timing
  const getShiftStatus = (startTime: Date, endTime: Date): 'upcoming' | 'in-progress' | 'completed' => {
    const now = new Date()
    if (now < startTime) return 'upcoming'
    if (now >= startTime && now <= endTime) return 'in-progress'
    return 'completed'
  }

  // Get shifts for a specific date
  const getShiftsForDate = (date: Date) => {
    return shifts.filter(shift => {
      const shiftDate = new Date(shift.startTime)
      return shiftDate.toDateString() === date.toDateString()
    })
  }

  // Navigation handlers
  const navigatePrevious = () => {
    const newDate = new Date(currentDate)
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7)
    } else {
      newDate.setMonth(newDate.getMonth() - 1)
    }
    setCurrentDate(newDate)
  }

  const navigateNext = () => {
    const newDate = new Date(currentDate)
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7)
    } else {
      newDate.setMonth(newDate.getMonth() + 1)
    }
    setCurrentDate(newDate)
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const handleShiftClick = (shiftId: string) => {
    if (onShiftClick) {
      onShiftClick(shiftId)
    } else {
      router.push(`/shifts/${shiftId}`)
    }
  }

  const handleAddShift = () => {
    router.push('/shifts/new')
  }

  // Fetch shifts when date or view mode changes
  useEffect(() => {
    fetchShifts()
  }, [currentDate, viewMode])

  const calendarDates = getCalendarDates()
  const currentMonth = currentDate.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
  const currentWeek = viewMode === 'week' 
    ? `${calendarDates[0].toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} - ${calendarDates[6].toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : currentMonth

  return (
    <Card>
      <CardBody>
        {/* Calendar Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={navigatePrevious}
              disabled={loading}
            >
              <ChevronLeft size={16} />
            </Button>
            <h3 style={{ 
              color: 'var(--color-text-primary)', 
              margin: 0,
              fontSize: '1.1rem',
              fontWeight: '600'
            }}>
              {currentWeek}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={navigateNext}
              disabled={loading}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              disabled={loading}
            >
              Today
            </Button>
            <div style={{ display: 'flex', backgroundColor: 'var(--color-surface)', borderRadius: '4px' }}>
              <Button
                variant={viewMode === 'month' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('month')}
                style={{ borderRadius: '4px 0 0 4px' }}
              >
                Month
              </Button>
              <Button
                variant={viewMode === 'week' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('week')}
                style={{ borderRadius: '0 4px 4px 0' }}
              >
                Week
              </Button>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={handleAddShift}
              disabled={loading}
            >
              <Plus size={16} style={{ marginRight: '0.25rem' }} />
              Add Shift
            </Button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '1px',
          backgroundColor: 'var(--color-border)',
          borderRadius: '6px',
          overflow: 'hidden'
        }}>
          {/* Day Headers */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div
              key={day}
              style={{
                backgroundColor: 'var(--color-surface-secondary)',
                padding: '0.75rem 0.5rem',
                textAlign: 'center',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: 'var(--color-text-secondary)'
              }}
            >
              {day}
            </div>
          ))}

          {/* Calendar Days */}
          {calendarDates.map((date, index) => {
            const dayShifts = getShiftsForDate(date)
            const isCurrentMonth = viewMode === 'week' || date.getMonth() === currentDate.getMonth()
            const isToday = date.toDateString() === new Date().toDateString()

            return (
              <div
                key={index}
                style={{
                  backgroundColor: isCurrentMonth ? 'var(--color-surface)' : 'var(--color-surface-secondary)',
                  minHeight: viewMode === 'week' ? '120px' : '80px',
                  padding: '0.5rem',
                  position: 'relative',
                  opacity: isCurrentMonth ? 1 : 0.6
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.25rem'
                }}>
                  <span style={{
                    fontSize: '0.875rem',
                    fontWeight: isToday ? '600' : '400',
                    color: isToday ? 'var(--color-primary)' : 'var(--color-text-primary)',
                    backgroundColor: isToday ? 'var(--color-primary-bg)' : 'transparent',
                    padding: isToday ? '2px 6px' : '0',
                    borderRadius: isToday ? '4px' : '0'
                  }}>
                    {date.getDate()}
                  </span>
                </div>

                {/* Shift indicators */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {dayShifts.slice(0, viewMode === 'week' ? 4 : 2).map(shift => (
                    <div
                      key={shift.id}
                      onClick={() => handleShiftClick(shift.id)}
                      style={{
                        backgroundColor: 
                          shift.status === 'upcoming' ? 'var(--color-primary-bg)' :
                          shift.status === 'in-progress' ? 'var(--color-warning-bg)' :
                          'var(--color-success-bg)',
                        color:
                          shift.status === 'upcoming' ? 'var(--color-primary)' :
                          shift.status === 'in-progress' ? 'var(--color-warning)' :
                          'var(--color-success)',
                        padding: '2px 4px',
                        borderRadius: '3px',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        border: '1px solid transparent'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 
                          shift.status === 'upcoming' ? 'var(--color-primary)' :
                          shift.status === 'in-progress' ? 'var(--color-warning)' :
                          'var(--color-success)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'transparent'
                      }}
                    >
                      {shift.startTime.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })}
                      {shift.payGuide && ` • ${shift.payGuide.name}`}
                    </div>
                  ))}
                  {dayShifts.length > (viewMode === 'week' ? 4 : 2) && (
                    <div style={{
                      fontSize: '0.75rem',
                      color: 'var(--color-text-tertiary)',
                      textAlign: 'center',
                      padding: '2px'
                    }}>
                      +{dayShifts.length - (viewMode === 'week' ? 4 : 2)} more
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {loading && (
          <div style={{
            position: 'absolute',
            top: '0',
            left: '0',
            right: '0',
            bottom: '0',
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '6px'
          }}>
            <div style={{ 
              color: 'var(--color-text-secondary)', 
              fontSize: '0.875rem' 
            }}>
              Loading shifts...
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  )
}