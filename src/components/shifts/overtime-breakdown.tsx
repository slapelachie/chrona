'use client'

import React from 'react'
import { Card, CardBody } from '../ui'
import { TrendingUp, Clock } from 'lucide-react'
import { AppliedOvertime } from '@/types'
import {
  formatCurrencyValue,
  formatDateContext,
  formatDecimal,
  formatHours,
  formatTime,
  sumNumeric,
  toNumber,
} from '../utils/format'

interface OvertimeBreakdownProps {
  overtimes: AppliedOvertime[]
  baseRate: string | number
}

export const OvertimeBreakdown: React.FC<OvertimeBreakdownProps> = ({ 
  overtimes, 
  baseRate
}) => {
  if (overtimes.length === 0) {
    return null
  }

  const getOvertimeCategory = (multiplier: number) => {
    if (multiplier >= 2.0) {
      return { label: 'Double Time', color: 'var(--color-danger)' }
    } else if (multiplier >= 1.5) {
      return { label: 'Time and a Half', color: 'var(--color-warning)' }
    } else if (multiplier > 1.0) {
      return { label: 'Premium Rate', color: 'var(--color-primary)' }
    }
    return { label: 'Standard Rate', color: 'var(--color-text-primary)' }
  }

  const totalOvertimeHours = sumNumeric(overtimes, overtime => overtime.hours)
  const totalOvertimePay = sumNumeric(overtimes, overtime => overtime.pay)

  return (
    <Card variant="outlined" style={{ marginTop: '0.5rem' }}>
      <CardBody>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <TrendingUp size={16} style={{ color: 'var(--color-warning)' }} />
          <h5 style={{ 
            color: 'var(--color-text-primary)', 
            margin: 0,
            fontSize: '0.9rem',
            fontWeight: '600'
          }}>
            Overtime Rates Applied
          </h5>
          <span style={{
            backgroundColor: 'var(--color-warning-bg)',
            color: 'var(--color-warning)',
            padding: '0.125rem 0.375rem',
            borderRadius: '4px',
            fontSize: '0.75rem',
            fontWeight: '600'
          }}>
            {overtimes.length} period{overtimes.length > 1 ? 's' : ''}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {overtimes.map((overtime, index) => {
            const multiplierValue = toNumber(overtime.multiplier) ?? 0
            const category = getOvertimeCategory(multiplierValue)
            
            return (
              <div 
                key={`${overtime.timeFrameId}-${index}`}
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
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '0.25rem'
                    }}>
                      <div style={{ 
                        fontSize: '0.875rem', 
                        fontWeight: '600',
                        color: 'var(--color-text-primary)'
                      }}>
                        {overtime.name}
                      </div>
                      <span style={{
                        backgroundColor: category.color + '20',
                        color: category.color,
                        padding: '0.125rem 0.375rem',
                        borderRadius: '4px',
                        fontSize: '0.65rem',
                        fontWeight: '600'
                      }}>
                        {category.label}
                      </span>
                    </div>
                    <div style={{ 
                      fontSize: '0.75rem', 
                      color: 'var(--color-text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}>
                      <Clock size={12} />
                      {formatTime(overtime.startTime)} - {formatTime(overtime.endTime)}
                      <span style={{ margin: '0 0.25rem' }}>•</span>
                      {formatDateContext(overtime.startTime, overtime.endTime)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ 
                      fontSize: '0.875rem', 
                      fontWeight: '600',
                      color: category.color
                    }}>
                      ${formatCurrencyValue(overtime.pay)}
                    </div>
                    <div style={{ 
                      fontSize: '0.75rem', 
                      color: 'var(--color-text-secondary)'
                    }}>
                      {formatHours(overtime.hours)}h
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
                      {formatDecimal(overtime.multiplier)}x
                    </span>
                  </div>
                  <div>
                    <span>Rate: </span>
                    <span style={{ color: category.color, fontWeight: '600' }}>
                      ${formatCurrencyValue(
                        (toNumber(baseRate) ?? 0) * multiplierValue
                      )}/hr
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div style={{
          marginTop: '1rem',
          padding: '0.75rem',
          backgroundColor: 'var(--color-warning-bg)',
          borderRadius: '6px',
          border: '1px solid var(--color-warning)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-warning)', fontWeight: '600' }}>
              Total Overtime Pay
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
              {formatHours(totalOvertimeHours)} hours
            </div>
          </div>
          <div style={{ 
            fontSize: '1.25rem', 
            fontWeight: '700',
            color: 'var(--color-warning)'
          }}>
            ${formatCurrencyValue(totalOvertimePay)}
          </div>
        </div>
      </CardBody>
    </Card>
  )
}
