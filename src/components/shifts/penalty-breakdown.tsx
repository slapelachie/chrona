'use client'

import React from 'react'
import { Card, CardBody } from '../ui'
import { AlertTriangle, Clock } from 'lucide-react'
import { AppliedPenalty } from '@/types'

interface PenaltyBreakdownProps {
  penalties: AppliedPenalty[]
  baseRate: string | number
  isPreview?: boolean
}

export const PenaltyBreakdown: React.FC<PenaltyBreakdownProps> = ({ 
  penalties, 
  baseRate,
  isPreview = false 
}) => {
  if (penalties.length === 0) {
    return null
  }

  const asDate = (value: any): Date => (typeof value === 'string' ? new Date(value) : value)

  const formatTime = (date: any) => {
    const d = asDate(date)
    return d.toLocaleTimeString('en-AU', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false
    })
  }

  const formatDate = (date: any) => {
    const d = asDate(date)
    return d.toLocaleDateString('en-AU', { 
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })
  }

  const getDayContext = (startTime: any, endTime: any) => {
    const startDate = formatDate(startTime)
    const endDate = formatDate(endTime)
    
    if (startDate === endDate) {
      return startDate
    }
    return `${startDate} - ${endDate}`
  }

  const totalPenaltyHours = penalties.reduce((sum, penalty) => 
    sum + parseFloat(penalty.hours.toString()), 0
  )

  const totalPenaltyPay = penalties.reduce((sum, penalty) => 
    sum + parseFloat(penalty.pay.toString()), 0
  )

  return (
    <Card variant="outlined" style={{ marginTop: '0.5rem' }}>
      <CardBody>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <AlertTriangle size={16} style={{ color: 'var(--color-primary)' }} />
          <h5 style={{ 
            color: 'var(--color-text-primary)', 
            margin: 0,
            fontSize: '0.9rem',
            fontWeight: '600'
          }}>
            Penalty Rates Applied
          </h5>
          <span style={{
            backgroundColor: 'var(--color-primary-bg)',
            color: 'var(--color-primary)',
            padding: '0.125rem 0.375rem',
            borderRadius: '4px',
            fontSize: '0.75rem',
            fontWeight: '600'
          }}>
            {penalties.length} rule{penalties.length > 1 ? 's' : ''}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {penalties.map((penalty, index) => (
            <div 
              key={`${penalty.timeFrameId}-${index}`}
              style={{
                padding: '0.75rem',
                backgroundColor: 'var(--color-surface-secondary)',
                borderRadius: '6px',
                border: '1px solid var(--color-border-light)'
              }}
            >
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'flex-start',
                marginBottom: '0.5rem',
                flexWrap: 'wrap',
                gap: '0.5rem'
              }}>
                <div>
                  <div style={{ 
                    fontSize: '0.875rem', 
                    fontWeight: '600',
                    color: 'var(--color-text-primary)',
                    marginBottom: '0.25rem'
                  }}>
                    {penalty.name}
                  </div>
                  <div style={{ 
                    fontSize: '0.75rem', 
                    color: 'var(--color-text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}>
                    <Clock size={12} />
                    {formatTime(penalty.startTime)} - {formatTime(penalty.endTime)}
                    <span style={{ margin: '0 0.25rem' }}>•</span>
                    {getDayContext(penalty.startTime, penalty.endTime)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ 
                    fontSize: '0.875rem', 
                    fontWeight: '600',
                    color: 'var(--color-primary)'
                  }}>
                    ${parseFloat(penalty.pay.toString()).toFixed(2)}
                  </div>
                  <div style={{ 
                    fontSize: '0.75rem', 
                    color: 'var(--color-text-secondary)'
                  }}>
                    {parseFloat(penalty.hours.toString()).toFixed(2)}h
                  </div>
                </div>
              </div>

              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', 
                gap: '0.5rem',
                fontSize: '0.75rem',
                color: 'var(--color-text-secondary)'
              }}>
                <div>
                  <span>Base Rate: </span>
                  <span style={{ color: 'var(--color-text-primary)' }}>
                    ${typeof baseRate === 'string' ? parseFloat(baseRate).toFixed(2) : baseRate.toFixed(2)}/hr
                  </span>
                </div>
                <div>
                  <span>Multiplier: </span>
                  <span style={{ color: 'var(--color-text-primary)' }}>
                    {parseFloat(penalty.multiplier.toString()).toFixed(2)}x
                  </span>
                </div>
                <div>
                  <span>Rate: </span>
                  <span style={{ color: 'var(--color-primary)', fontWeight: '600' }}>
                    ${(parseFloat(penalty.multiplier.toString()) * (typeof baseRate === 'string' ? parseFloat(baseRate) : baseRate)).toFixed(2)}/hr
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: '1rem',
          padding: '0.75rem',
          backgroundColor: 'var(--color-primary-bg)',
          borderRadius: '6px',
          border: '1px solid var(--color-primary)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-primary)', fontWeight: '600' }}>
              Total Penalty Pay
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
              {totalPenaltyHours.toFixed(2)} hours
            </div>
          </div>
          <div style={{ 
            fontSize: '1.25rem', 
            fontWeight: '700',
            color: 'var(--color-primary)'
          }}>
            ${totalPenaltyPay.toFixed(2)}
          </div>
        </div>
      </CardBody>
    </Card>
  )
}
