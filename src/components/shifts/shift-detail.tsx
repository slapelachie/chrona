'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Calendar,
  Clock,
  DollarSign,
  FileText,
  Edit3,
  Trash2,
  MapPin,
  Loader,
  AlertTriangle,
} from 'lucide-react'
import { Card, CardBody, CardHeader, Button } from '../ui'
import { PayCalculationResult } from '@/types'
import { PayBreakdown } from './pay-breakdown'
import { StatusBadge } from '@/components/pay-periods/status-badge'
import './shift-detail.scss'
import { formatCurrencyValue } from '../utils/format'

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
  calculation?: PayCalculationResult
}

interface ShiftDetailProps {
  shiftId: string
}

type ShiftStatus = 'upcoming' | 'in-progress' | 'completed'

const formatDateTime = (dateString: string) => {
  const date = new Date(dateString)
  return {
    date: date.toLocaleDateString('en-AU', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    time: date.toLocaleTimeString('en-AU', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
  }
}

const formatDuration = (startTime: string, endTime: string) => {
  const start = new Date(startTime)
  const end = new Date(endTime)
  const durationMs = end.getTime() - start.getTime()
  const hours = Math.max(Math.floor(durationMs / (1000 * 60 * 60)), 0)
  const minutes = Math.max(
    Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60)),
    0
  )
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`
}

const getShiftStatus = (startTime: string, endTime: string): ShiftStatus => {
  const now = new Date()
  const start = new Date(startTime)
  const end = new Date(endTime)

  if (now < start) return 'upcoming'
  if (now >= start && now <= end) return 'in-progress'
  return 'completed'
}

export const ShiftDetail: React.FC<ShiftDetailProps> = ({ shiftId }) => {
  const router = useRouter()
  const [shift, setShift] = useState<ShiftData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const fetchShiftDetail = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/shifts/${shiftId}?include=calculation`)
      if (response.ok) {
        const data = await response.json()
        setShift(data.data as ShiftData)
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
  }, [shiftId])

  useEffect(() => {
    fetchShiftDetail()
  }, [fetchShiftDetail])

  const startDateTime = useMemo(
    () => (shift ? formatDateTime(shift.startTime) : null),
    [shift]
  )

  const endDateTime = useMemo(
    () => (shift ? formatDateTime(shift.endTime) : null),
    [shift]
  )

  const shiftStatus = useMemo(
    () => (shift ? getShiftStatus(shift.startTime, shift.endTime) : null),
    [shift]
  )

  const duration = useMemo(
    () => (shift ? formatDuration(shift.startTime, shift.endTime) : null),
    [shift]
  )

  const payPeriodRange = useMemo(() => {
    if (!shift?.payPeriod) return null
    const start = new Date(shift.payPeriod.startDate)
    const end = new Date(shift.payPeriod.endDate)
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
    return `${start.toLocaleDateString('en-AU', options)} - ${end.toLocaleDateString('en-AU', options)}`
  }, [shift?.payPeriod])

  const paySummary = useMemo(() => {
    if (!shift) return []
    const entries: Array<{ label: string; value: string }> = []

    if (shift.totalHours) {
      entries.push({ label: 'Total hours', value: `${parseFloat(shift.totalHours).toFixed(2)}h` })
    }
    if (shift.basePay) {
      entries.push({ label: 'Base pay', value: `$${formatCurrencyValue(shift.basePay)}` })
    }
    if (shift.overtimePay && parseFloat(shift.overtimePay) > 0) {
      entries.push({ label: 'Overtime', value: `$${formatCurrencyValue(shift.overtimePay)}` })
    }
    if (shift.penaltyPay && parseFloat(shift.penaltyPay) > 0) {
      entries.push({ label: 'Penalties', value: `$${formatCurrencyValue(shift.penaltyPay)}` })
    }
    return entries
  }, [shift])

  const breakPeriods = useMemo(() => {
    if (!shift?.breakPeriods?.length) return []
    return shift.breakPeriods.map((breakPeriod, index) => {
      const start = formatDateTime(breakPeriod.startTime)
      const end = formatDateTime(breakPeriod.endTime)
      return {
        id: breakPeriod.id,
        label: `Break ${index + 1}`,
        range: `${start.time} - ${end.time}`,
      }
    })
  }, [shift])

  const handleEdit = () => {
    router.push(`/shifts/${shiftId}/edit`)
  }

  const handleDelete = async () => {
    try {
      setDeleting(true)
      const response = await fetch(`/api/shifts/${shiftId}`, { method: 'DELETE' })
      if (response.ok) {
        router.push('/timeline')
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

  if (loading) {
    return (
      <div className="shift-detail">
        <Card className="shift-detail__state-card" variant="outlined">
          <CardBody>
            <div className="shift-detail__state">
              <Loader size={20} className="shift-detail__state-icon" />
              <span>Loading shift details...</span>
            </div>
          </CardBody>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="shift-detail">
        <Card className="shift-detail__state-card" variant="outlined">
          <CardBody>
            <div className="shift-detail__state shift-detail__state--error">
              <AlertTriangle size={24} />
              <div className="shift-detail__state-copy">
                <h3>{error}</h3>
                <p>We couldn’t load that shift right now.</p>
              </div>
              <Button variant="primary" onClick={() => router.push('/timeline')}>
                Back to shifts
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    )
  }

  if (!shift) {
    return null
  }

  return (
    <div className="shift-detail">
      <Card className="shift-detail__header-card" variant="elevated">
        <CardHeader className="shift-detail__header">
          <div className="shift-detail__title-group">
            <div className="shift-detail__title-line">
              <h2 className="shift-detail__title">{shift.payGuide?.name || 'Shift'}</h2>
              {shiftStatus && (
                <span className={`shift-detail__status shift-detail__status--${shiftStatus}`}>
                  {shiftStatus.replace('-', ' ')}
                </span>
              )}
            </div>
            {startDateTime && <p className="shift-detail__date">{startDateTime.date}</p>}
          </div>
          <div className="shift-detail__actions">
            <Button variant="outline" size="sm" onClick={handleEdit} leftIcon={<Edit3 size={16} />}>
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
        </CardHeader>
        <CardBody>
          <div className="shift-detail__meta-grid">
            {startDateTime && (
              <div className="shift-detail__meta-item">
                <Calendar size={16} className="shift-detail__meta-icon" />
                <div className="shift-detail__meta-copy">
                  <span>Start</span>
                  <strong>{startDateTime.time}</strong>
                </div>
              </div>
            )}
            {endDateTime && (
              <div className="shift-detail__meta-item">
                <Clock size={16} className="shift-detail__meta-icon" />
                <div className="shift-detail__meta-copy">
                  <span>End</span>
                  <strong>{endDateTime.time}</strong>
                </div>
              </div>
            )}
            {duration && (
              <div className="shift-detail__meta-item">
                <Clock size={16} className="shift-detail__meta-icon" />
                <div className="shift-detail__meta-copy">
                  <span>Duration</span>
                  <strong>{duration}</strong>
                </div>
              </div>
            )}
            {shift.payPeriod && (
              <div className="shift-detail__meta-item shift-detail__meta-item--pay-period">
                <div className="shift-detail__meta-copy">
                  <span>Pay period</span>
                  <strong>{payPeriodRange}</strong>
                </div>
                <StatusBadge status={shift.payPeriod.status as any} size="sm" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push(`/pay-periods/${shift.payPeriod?.id}`)}
                >
                  View period
                </Button>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {shift.calculation ? (
        <PayBreakdown calculation={shift.calculation} showHeader defaultExpanded />
      ) : (
        (shift.totalPay || paySummary.length > 0) && (
          <Card className="shift-detail__pay-card" variant="outlined">
            <CardHeader>
              <div className="shift-detail__section-heading">
                <DollarSign size={18} className="shift-detail__section-icon" />
                <h3>Pay summary</h3>
              </div>
            </CardHeader>
            <CardBody>
              <div className="shift-detail__pay-grid">
                {paySummary.map((metric) => (
                  <div key={metric.label} className="shift-detail__pay-item">
                    <span>{metric.label}</span>
                    <strong className="shift-detail__pay-value">{metric.value}</strong>
                  </div>
                ))}
                {shift.totalPay && (
                  <div className="shift-detail__pay-total">
                    <span>Total pay</span>
                    <strong>${formatCurrencyValue(shift.totalPay)}</strong>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>
        )
      )}

      <div className="shift-detail__panels">
        {shift.notes && (
          <Card className="shift-detail__panel">
            <CardHeader>
              <div className="shift-detail__section-heading">
                <FileText size={16} className="shift-detail__section-icon" />
                <h4>Notes</h4>
              </div>
            </CardHeader>
            <CardBody>
              <p className="shift-detail__notes">{shift.notes}</p>
            </CardBody>
          </Card>
        )}

        {shift.payGuide && (
          <Card className="shift-detail__panel">
            <CardHeader>
              <div className="shift-detail__section-heading">
                <MapPin size={16} className="shift-detail__section-icon" />
                <h4>Pay guide</h4>
              </div>
            </CardHeader>
            <CardBody>
              <dl className="shift-detail__definition-list">
                <div>
                  <dt>Name</dt>
                  <dd>{shift.payGuide.name}</dd>
                </div>
                <div>
                  <dt>Base rate</dt>
                  <dd>${formatCurrencyValue(shift.payGuide.baseRate)}/hr</dd>
                </div>
                <div>
                  <dt>Timezone</dt>
                  <dd>{shift.payGuide.timezone}</dd>
                </div>
              </dl>
            </CardBody>
          </Card>
        )}

        {breakPeriods.length > 0 && (
          <Card className="shift-detail__panel">
            <CardHeader>
              <div className="shift-detail__section-heading">
                <Clock size={16} className="shift-detail__section-icon" />
                <h4>Break periods</h4>
              </div>
            </CardHeader>
            <CardBody>
              <ul className="shift-detail__break-list">
                {breakPeriods.map((item) => (
                  <li key={item.id}>
                    <span>{item.label}</span>
                    <span>{item.range}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        )}
      </div>

      {showDeleteConfirm && (
        <div className="shift-detail__overlay" role="dialog" aria-modal="true">
          <Card className="shift-detail__modal" variant="elevated">
            <CardBody>
              <div className="shift-detail__modal-header">
                <AlertTriangle size={32} className="shift-detail__modal-icon" />
                <h3>Delete shift</h3>
                <p>Are you sure you want to delete this shift? This action cannot be undone.</p>
              </div>
              <div className="shift-detail__modal-actions">
                <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
                  Cancel
                </Button>
                <Button variant="danger" onClick={handleDelete} isLoading={deleting} disabled={deleting}>
                  Delete shift
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  )
}
