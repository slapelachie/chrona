'use client'

import React from 'react'
import { Card, CardBody } from '../ui'
import { AlertTriangle, Clock } from 'lucide-react'
import { AppliedPenalty } from '@/types'
import {
  formatCurrencyValue,
  formatDateContext,
  formatDecimal,
  formatHours,
  formatTime,
  sumNumeric,
  toNumber,
} from '../utils/format'

interface PenaltyBreakdownProps {
  penalties: AppliedPenalty[]
  baseRate: string | number
}

export const PenaltyBreakdown: React.FC<PenaltyBreakdownProps> = ({ 
  penalties, 
  baseRate
}) => {
  if (penalties.length === 0) {
    return null
  }

  const totalPenaltyHours = sumNumeric(penalties, penalty => penalty.hours)
  const totalPenaltyPay = sumNumeric(penalties, penalty => penalty.pay)

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
                    {formatDateContext(penalty.startTime, penalty.endTime)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ 
                    fontSize: '0.875rem', 
                    fontWeight: '600',
                    color: 'var(--color-primary)'
                  }}>
                    ${formatCurrencyValue(penalty.pay)}
                  </div>
                  <div style={{ 
                    fontSize: '0.75rem', 
                    color: 'var(--color-text-secondary)'
                  }}>
                    {formatHours(penalty.hours)}h
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
                    ${formatCurrencyValue(baseRate)}/hr
                  </span>
                </div>
                <div>
                  <span>Multiplier: </span>
                  <span style={{ color: 'var(--color-text-primary)' }}>
                    {formatDecimal(penalty.multiplier)}x
                  </span>
                </div>
                <div>
                  <span>Rate: </span>
                  <span style={{ color: 'var(--color-primary)', fontWeight: '600' }}>
                    ${formatCurrencyValue(
                      (toNumber(baseRate) ?? 0) * (toNumber(penalty.multiplier) ?? 0)
                    )}/hr
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
              {formatHours(totalPenaltyHours)} hours
            </div>
          </div>
          <div style={{ 
            fontSize: '1.25rem', 
            fontWeight: '700',
            color: 'var(--color-primary)'
          }}>
            ${formatCurrencyValue(totalPenaltyPay)}
          </div>
        </div>
      </CardBody>
    </Card>
  )
}
