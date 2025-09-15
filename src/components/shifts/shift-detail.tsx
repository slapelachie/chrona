'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardBody, Button } from '../ui'
import { 
  Calendar, 
  Clock, 
  DollarSign, 
  FileText, 
  Edit3, 
  Trash2, 
  MapPin,
  Loader,
  AlertTriangle
} from 'lucide-react'
import { useRouter } from 'next/navigation'

interface ShiftData {
  id: string
  startTime: string
  endTime: string
  totalHours?: string
  basePay?: string
  overtimePay?: string
  penaltyPay?: string
  totalPay?: string
  notes?: string
  payGuideId: string
  payPeriodId?: string
  createdAt: string
  updatedAt: string
  payGuide?: {
    id: string
    name: string
    baseRate: string
    timezone: string
  }
  payPeriod?: {
    id: string
    startDate: string
    endDate: string
    status: string
  }
  breakPeriods?: Array<{
    id: string
    startTime: string
    endTime: string
  }>
}

interface ShiftDetailProps {
  shiftId: string
}

export const ShiftDetail: React.FC<ShiftDetailProps> = ({ shiftId }) => {
  const [shift, setShift] = useState<ShiftData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  
  const router = useRouter()

  useEffect(() => {
    fetchShiftDetail()
  }, [shiftId])

  const fetchShiftDetail = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/shifts/${shiftId}`)
      
      if (response.ok) {
        const data = await response.json()
        setShift(data.data)
      } else if (response.status === 404) {
        setError('Shift not found')
      } else {
        setError('Failed to load shift details')
      }
    } catch (err) {
      console.error('Failed to fetch shift:', err)
      setError('Failed to load shift details')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = () => {
    router.push(`/shifts/${shiftId}/edit`)
  }

  const handleDelete = async () => {
    try {
      setDeleting(true)
      
      const response = await fetch(`/api/shifts/${shiftId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        router.push('/shifts')
      } else {
        setError('Failed to delete shift')
      }
    } catch (err) {
      console.error('Failed to delete shift:', err)
      setError('Failed to delete shift')
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return {
      date: date.toLocaleDateString('en-AU', { 
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      time: date.toLocaleTimeString('en-AU', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false
      })
    }
  }

  const formatDuration = (startTime: string, endTime: string) => {
    const start = new Date(startTime)
    const end = new Date(endTime)
    const durationMs = end.getTime() - start.getTime()
    const hours = Math.floor(durationMs / (1000 * 60 * 60))
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m`
  }

  const getShiftStatus = (startTime: string, endTime: string) => {
    const now = new Date()
    const start = new Date(startTime)
    const end = new Date(endTime)
    
    if (now < start) return { status: 'upcoming', color: 'var(--color-primary)' }
    if (now >= start && now <= end) return { status: 'in-progress', color: 'var(--color-warning)' }
    return { status: 'completed', color: 'var(--color-success)' }
  }

  if (loading) {
    return (
      <Card>
        <CardBody>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            gap: '0.5rem'
          }}>
            <Loader size={20} style={{ color: 'var(--color-primary)' }} className="spinner" />
            <span style={{ color: 'var(--color-text-secondary)' }}>
              Loading shift details...
            </span>
          </div>
        </CardBody>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardBody>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            gap: '1rem',
            textAlign: 'center'
          }}>
            <AlertTriangle size={48} style={{ color: 'var(--color-danger)' }} />
            <h3 style={{ color: 'var(--color-text-primary)', margin: 0 }}>
              {error}
            </h3>
            <Button variant="primary" onClick={() => router.push('/shifts')}>
              Back to Shifts
            </Button>
          </div>
        </CardBody>
      </Card>
    )
  }

  if (!shift) return null

  const startDateTime = formatDateTime(shift.startTime)
  const endDateTime = formatDateTime(shift.endTime)
  const shiftStatus = getShiftStatus(shift.startTime, shift.endTime)
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Shift Header */}
      <Card>
        <CardBody>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'flex-start',
            marginBottom: '1rem',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                marginBottom: '0.5rem'
              }}>
                <h2 style={{ 
                  color: 'var(--color-text-primary)', 
                  margin: 0,
                  fontSize: '1.5rem',
                  fontWeight: '600'
                }}>
                  {shift.payGuide?.name || 'Unknown Pay Guide'}
                </h2>
                <span style={{
                  backgroundColor: shiftStatus.status === 'upcoming' ? 'var(--color-primary-bg)' :
                    shiftStatus.status === 'in-progress' ? 'var(--color-warning-bg)' :
                    'var(--color-success-bg)',
                  color: shiftStatus.color,
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  textTransform: 'capitalize'
                }}>
                  {shiftStatus.status.replace('-', ' ')}
                </span>
              </div>
              <p style={{ 
                color: 'var(--color-text-secondary)', 
                margin: 0,
                fontSize: '0.875rem'
              }}>
                {startDateTime.date}
              </p>
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Button
                variant="outline"
                size="sm"
                onClick={handleEdit}
                leftIcon={<Edit3 size={16} />}
              >
                Edit
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                leftIcon={<Trash2 size={16} />}
              >
                Delete
              </Button>
            </div>
          </div>
          
          {/* Time Information */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '1rem',
            marginBottom: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={16} style={{ color: 'var(--color-text-tertiary)' }} />
              <div>
                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                  Start Time
                </div>
                <div style={{ color: 'var(--color-text-primary)', fontWeight: '500' }}>
                  {startDateTime.time}
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={16} style={{ color: 'var(--color-text-tertiary)' }} />
              <div>
                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                  End Time
                </div>
                <div style={{ color: 'var(--color-text-primary)', fontWeight: '500' }}>
                  {endDateTime.time}
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={16} style={{ color: 'var(--color-text-tertiary)' }} />
              <div>
                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                  Duration
                </div>
                <div style={{ color: 'var(--color-text-primary)', fontWeight: '500' }}>
                  {formatDuration(shift.startTime, shift.endTime)}
                </div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Pay Breakdown */}
      {shift.totalPay && (
        <Card>
          <CardBody>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <DollarSign size={20} style={{ color: 'var(--color-primary)' }} />
              <h3 style={{ 
                color: 'var(--color-text-primary)', 
                margin: 0,
                fontSize: '1.25rem',
                fontWeight: '600'
              }}>
                Pay Breakdown
              </h3>
            </div>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
              gap: '1.5rem',
              marginBottom: '1rem'
            }}>
              {shift.totalHours && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
                    Total Hours
                  </div>
                  <div style={{ fontSize: '1.5rem', color: 'var(--color-text-primary)', fontWeight: '600' }}>
                    {parseFloat(shift.totalHours).toFixed(2)}h
                  </div>
                </div>
              )}
              
              {shift.basePay && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
                    Base Pay
                  </div>
                  <div style={{ fontSize: '1.5rem', color: 'var(--color-text-primary)', fontWeight: '600' }}>
                    ${parseFloat(shift.basePay).toFixed(2)}
                  </div>
                </div>
              )}
              
              {shift.overtimePay && parseFloat(shift.overtimePay) > 0 && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
                    Overtime Pay
                  </div>
                  <div style={{ fontSize: '1.5rem', color: 'var(--color-warning)', fontWeight: '600' }}>
                    ${parseFloat(shift.overtimePay).toFixed(2)}
                  </div>
                </div>
              )}
              
              {shift.penaltyPay && parseFloat(shift.penaltyPay) > 0 && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
                    Penalty Pay
                  </div>
                  <div style={{ fontSize: '1.5rem', color: 'var(--color-primary)', fontWeight: '600' }}>
                    ${parseFloat(shift.penaltyPay).toFixed(2)}
                  </div>
                </div>
              )}
              
              <div style={{ 
                gridColumn: 'span 1',
                padding: '1rem',
                backgroundColor: 'var(--color-success-bg)',
                borderRadius: '8px',
                border: '1px solid var(--color-success)'
              }}>
                <div style={{ fontSize: '0.875rem', color: 'var(--color-success)', marginBottom: '0.25rem' }}>
                  Total Pay
                </div>
                <div style={{ fontSize: '2rem', color: 'var(--color-success)', fontWeight: '700' }}>
                  ${parseFloat(shift.totalPay).toFixed(2)}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Additional Information */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
        gap: '1.5rem' 
      }}>
        {/* Notes */}
        {shift.notes && (
          <Card>
            <CardBody>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <FileText size={16} style={{ color: 'var(--color-text-tertiary)' }} />
                <h4 style={{ 
                  color: 'var(--color-text-primary)', 
                  margin: 0,
                  fontSize: '1rem',
                  fontWeight: '600'
                }}>
                  Notes
                </h4>
              </div>
              <p style={{ 
                color: 'var(--color-text-primary)', 
                margin: 0,
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap'
              }}>
                {shift.notes}
              </p>
            </CardBody>
          </Card>
        )}

        {/* Pay Guide Information */}
        {shift.payGuide && (
          <Card>
            <CardBody>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <MapPin size={16} style={{ color: 'var(--color-text-tertiary)' }} />
                <h4 style={{ 
                  color: 'var(--color-text-primary)', 
                  margin: 0,
                  fontSize: '1rem',
                  fontWeight: '600'
                }}>
                  Pay Guide Details
                </h4>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div>
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                    Name: 
                  </span>
                  <span style={{ color: 'var(--color-text-primary)', marginLeft: '0.5rem' }}>
                    {shift.payGuide.name}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                    Base Rate: 
                  </span>
                  <span style={{ color: 'var(--color-text-primary)', marginLeft: '0.5rem' }}>
                    ${shift.payGuide.baseRate}/hour
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                    Timezone: 
                  </span>
                  <span style={{ color: 'var(--color-text-primary)', marginLeft: '0.5rem' }}>
                    {shift.payGuide.timezone}
                  </span>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Break Periods */}
        {shift.breakPeriods && shift.breakPeriods.length > 0 && (
          <Card>
            <CardBody>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <Clock size={16} style={{ color: 'var(--color-text-tertiary)' }} />
                <h4 style={{ 
                  color: 'var(--color-text-primary)', 
                  margin: 0,
                  fontSize: '1rem',
                  fontWeight: '600'
                }}>
                  Break Periods
                </h4>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {shift.breakPeriods.map((breakPeriod, index) => {
                  const breakStart = formatDateTime(breakPeriod.startTime)
                  const breakEnd = formatDateTime(breakPeriod.endTime)
                  return (
                    <div key={breakPeriod.id} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      padding: '0.5rem',
                      backgroundColor: 'var(--color-surface-secondary)',
                      borderRadius: '4px'
                    }}>
                      <span style={{ color: 'var(--color-text-primary)', fontSize: '0.875rem' }}>
                        Break {index + 1}
                      </span>
                      <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                        {breakStart.time} - {breakEnd.time}
                      </span>
                    </div>
                  )
                })}
              </div>
            </CardBody>
          </Card>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <Card style={{ maxWidth: '400px', width: '100%' }}>
            <CardBody>
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <AlertTriangle size={48} style={{ color: 'var(--color-danger)', marginBottom: '1rem' }} />
                <h3 style={{ color: 'var(--color-text-primary)', margin: 0, marginBottom: '0.5rem' }}>
                  Delete Shift
                </h3>
                <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
                  Are you sure you want to delete this shift? This action cannot be undone.
                </p>
              </div>
              
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={handleDelete}
                  isLoading={deleting}
                  disabled={deleting}
                >
                  Delete Shift
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  )
}