'use client'

import React, { useState } from 'react'
import { Button, Input, Card, CardBody } from '../ui'
import { Plus, Trash2, Clock } from 'lucide-react'

export interface BreakPeriodInput {
  id: string
  startTime: string
  endTime: string
}

interface BreakPeriodsInputProps {
  breakPeriods: BreakPeriodInput[]
  onBreakPeriodsChange: (breakPeriods: BreakPeriodInput[]) => void
  shiftStartTime?: string
  shiftEndTime?: string
  errors?: Record<string, string>
}

export const BreakPeriodsInput: React.FC<BreakPeriodsInputProps> = ({
  breakPeriods,
  onBreakPeriodsChange,
  shiftStartTime,
  shiftEndTime,
  errors = {}
}) => {
  const [newBreakPeriod, setNewBreakPeriod] = useState<Omit<BreakPeriodInput, 'id'>>({
    startTime: '',
    endTime: ''
  })

  const generateId = () => `break-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

  const handleAddBreakPeriod = () => {
    if (!newBreakPeriod.startTime || !newBreakPeriod.endTime) {
      return
    }

    const newBreak: BreakPeriodInput = {
      id: generateId(),
      ...newBreakPeriod
    }

    onBreakPeriodsChange([...breakPeriods, newBreak])
    setNewBreakPeriod({ startTime: '', endTime: '' })
  }

  const handleRemoveBreakPeriod = (id: string) => {
    onBreakPeriodsChange(breakPeriods.filter(bp => bp.id !== id))
  }

  const handleUpdateBreakPeriod = (id: string, field: 'startTime' | 'endTime', value: string) => {
    onBreakPeriodsChange(
      breakPeriods.map(bp => 
        bp.id === id ? { ...bp, [field]: value } : bp
      )
    )
  }

  const validateBreakPeriod = (startTime: string, endTime: string): string | null => {
    if (!startTime || !endTime) return null
    
    const start = new Date(startTime)
    const end = new Date(endTime)
    
    if (end <= start) {
      return 'End time must be after start time'
    }
    
    if (shiftStartTime && shiftEndTime) {
      const shiftStart = new Date(shiftStartTime)
      const shiftEnd = new Date(shiftEndTime)
      
      if (start < shiftStart || end > shiftEnd) {
        return 'Break must be within shift time'
      }
    }
    
    return null
  }

  const calculateBreakDuration = (startTime: string, endTime: string): string => {
    if (!startTime || !endTime) return ''
    
    const start = new Date(startTime)
    const end = new Date(endTime)
    const durationMs = end.getTime() - start.getTime()
    
    if (durationMs <= 0) return ''
    
    const minutes = Math.floor(durationMs / (1000 * 60))
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`
    } else {
      return `${remainingMinutes}m`
    }
  }

  const totalBreakTime = breakPeriods.reduce((total, bp) => {
    if (!bp.startTime || !bp.endTime) return total
    const start = new Date(bp.startTime)
    const end = new Date(bp.endTime)
    const duration = end.getTime() - start.getTime()
    return total + (duration > 0 ? duration : 0)
  }, 0)

  const formatTotalBreakTime = (ms: number): string => {
    const minutes = Math.floor(ms / (1000 * 60))
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`
    } else {
      return `${remainingMinutes}m`
    }
  }

  return (
    <div>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: '1rem' 
      }}>
        <div>
          <label style={{ 
            color: 'var(--color-text-primary)', 
            fontWeight: '500',
            marginBottom: '0.5rem',
            display: 'block'
          }}>
            Break Periods
          </label>
          {totalBreakTime > 0 && (
            <div style={{ 
              fontSize: '0.875rem', 
              color: 'var(--color-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}>
              <Clock size={14} />
              Total break time: {formatTotalBreakTime(totalBreakTime)}
            </div>
          )}
        </div>
      </div>

      {/* Existing Break Periods */}
      {breakPeriods.length > 0 && (
        <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {breakPeriods.map((breakPeriod, index) => {
            const error = validateBreakPeriod(breakPeriod.startTime, breakPeriod.endTime)
            const duration = calculateBreakDuration(breakPeriod.startTime, breakPeriod.endTime)
            
            return (
              <Card key={breakPeriod.id} variant="outlined">
                <CardBody style={{ padding: '1rem' }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.75rem',
                    flexWrap: 'wrap'
                  }}>
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '1fr 1fr', 
                      gap: '0.75rem',
                      flex: '1',
                      minWidth: '280px'
                    }}>
                      <Input
                        type="time"
                        label={`Break ${index + 1} Start`}
                        value={breakPeriod.startTime ? new Date(breakPeriod.startTime).toTimeString().substring(0, 5) : ''}
                        onChange={(e) => {
                          if (e.target.value && shiftStartTime) {
                            // Extract date part from shift start time without timezone conversion
                            const shiftDate = shiftStartTime.split('T')[0]
                            const dateTime = `${shiftDate}T${e.target.value}`
                            handleUpdateBreakPeriod(breakPeriod.id, 'startTime', dateTime)
                          }
                        }}
                        size="sm"
                      />
                      <Input
                        type="time"
                        label="End"
                        value={breakPeriod.endTime ? new Date(breakPeriod.endTime).toTimeString().substring(0, 5) : ''}
                        onChange={(e) => {
                          if (e.target.value && shiftStartTime) {
                            // Extract date part from shift start time without timezone conversion
                            const shiftDate = shiftStartTime.split('T')[0]
                            const dateTime = `${shiftDate}T${e.target.value}`
                            handleUpdateBreakPeriod(breakPeriod.id, 'endTime', dateTime)
                          }
                        }}
                        size="sm"
                      />
                    </div>
                    
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem' 
                    }}>
                      {duration && (
                        <span style={{ 
                          fontSize: '0.875rem', 
                          color: 'var(--color-text-secondary)',
                          whiteSpace: 'nowrap'
                        }}>
                          {duration}
                        </span>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveBreakPeriod(breakPeriod.id)}
                        style={{ 
                          padding: '0.375rem',
                          minWidth: 'auto'
                        }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                  
                  {error && (
                    <div style={{ 
                      color: 'var(--color-danger)', 
                      fontSize: '0.875rem', 
                      marginTop: '0.5rem' 
                    }}>
                      {error}
                    </div>
                  )}
                </CardBody>
              </Card>
            )
          })}
        </div>
      )}

      {/* Add New Break Period */}
      <Card variant="outlined">
        <CardBody style={{ padding: '1rem' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'end', 
            gap: '0.75rem',
            flexWrap: 'wrap'
          }}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: '0.75rem',
              flex: '1',
              minWidth: '280px'
            }}>
              <Input
                type="time"
                label="Break Start Time"
                value={newBreakPeriod.startTime ? new Date(newBreakPeriod.startTime).toTimeString().substring(0, 5) : ''}
                onChange={(e) => {
                  if (e.target.value && shiftStartTime) {
                    // Extract date part from shift start time without timezone conversion
                    const shiftDate = shiftStartTime.split('T')[0]
                    const dateTime = `${shiftDate}T${e.target.value}`
                    setNewBreakPeriod(prev => ({ ...prev, startTime: dateTime }))
                  } else {
                    setNewBreakPeriod(prev => ({ ...prev, startTime: '' }))
                  }
                }}
                size="sm"
              />
              <Input
                type="time"
                label="Break End Time"
                value={newBreakPeriod.endTime ? new Date(newBreakPeriod.endTime).toTimeString().substring(0, 5) : ''}
                onChange={(e) => {
                  if (e.target.value && shiftStartTime) {
                    // Extract date part from shift start time without timezone conversion
                    const shiftDate = shiftStartTime.split('T')[0]
                    const dateTime = `${shiftDate}T${e.target.value}`
                    setNewBreakPeriod(prev => ({ ...prev, endTime: dateTime }))
                  } else {
                    setNewBreakPeriod(prev => ({ ...prev, endTime: '' }))
                  }
                }}
                size="sm"
              />
            </div>
            
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddBreakPeriod}
              disabled={!newBreakPeriod.startTime || !newBreakPeriod.endTime}
              style={{ 
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem'
              }}
            >
              <Plus size={16} />
              Add Break
            </Button>
          </div>
          
          {newBreakPeriod.startTime && newBreakPeriod.endTime && (
            <div style={{ marginTop: '0.5rem' }}>
              {(() => {
                const error = validateBreakPeriod(newBreakPeriod.startTime, newBreakPeriod.endTime)
                const duration = calculateBreakDuration(newBreakPeriod.startTime, newBreakPeriod.endTime)
                
                return error ? (
                  <div style={{ 
                    color: 'var(--color-danger)', 
                    fontSize: '0.875rem' 
                  }}>
                    {error}
                  </div>
                ) : duration ? (
                  <div style={{ 
                    color: 'var(--color-text-secondary)', 
                    fontSize: '0.875rem' 
                  }}>
                    Duration: {duration}
                  </div>
                ) : null
              })()}
            </div>
          )}
        </CardBody>
      </Card>

      {errors.breakPeriods && (
        <div style={{ 
          color: 'var(--color-danger)', 
          fontSize: '0.875rem', 
          marginTop: '0.5rem' 
        }}>
          {errors.breakPeriods}
        </div>
      )}
    </div>
  )
}