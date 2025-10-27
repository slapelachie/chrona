'use client'

import React, { useState } from 'react'
import { Card, CardBody, Button } from '../ui'
import { DollarSign, ChevronDown, ChevronRight } from 'lucide-react'
import { PayCalculationResult } from '@/types'
import { PenaltyBreakdown } from './penalty-breakdown'
import { OvertimeBreakdown } from './overtime-breakdown'

interface PayBreakdownProps {
  calculation: PayCalculationResult
  isPreview?: boolean
  showHeader?: boolean
  defaultExpanded?: boolean
}

export const PayBreakdown: React.FC<PayBreakdownProps> = ({ 
  calculation, 
  isPreview = false,
  showHeader = true,
  defaultExpanded = false
}) => {
  const [showDetails, setShowDetails] = useState(defaultExpanded)
  
  const {
    breakdown,
    penalties,
    overtimes,
    payGuide
  } = calculation

  const hasBreakdownDetails = penalties.length > 0 || overtimes.length > 0

  const formatCurrency = (amount: any) => {
    const value = typeof amount === 'string' ? parseFloat(amount) : amount
    return value.toFixed(2)
  }

  const formatHours = (hours: any) => {
    const value = typeof hours === 'string' ? parseFloat(hours) : hours
    return value.toFixed(2)
  }

  return (
    <Card variant="outlined">
      <CardBody>
        {showHeader && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <DollarSign size={16} style={{ color: 'var(--color-primary)' }} />
            <h4 style={{ 
              color: 'var(--color-text-primary)', 
              margin: 0, 
              fontSize: '1rem',
              fontWeight: '600'
            }}>
              {isPreview ? 'Pay Preview' : 'Pay Breakdown'}
            </h4>
          </div>
        )}
        
        {/* Summary Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', 
          gap: '1rem',
          marginBottom: hasBreakdownDetails ? '1rem' : 0
        }}>
          <div>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
              Total Hours
            </div>
            <div style={{ fontSize: '1.1rem', color: 'var(--color-text-primary)', fontWeight: '600' }}>
              {formatHours(calculation.shift.totalHours)}h
            </div>
          </div>
          
          <div>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
              Base Pay
            </div>
            <div style={{ fontSize: '1.1rem', color: 'var(--color-text-primary)', fontWeight: '600' }}>
              ${formatCurrency(breakdown.basePay)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>
              {formatHours(breakdown.baseHours)}h @ ${payGuide.baseRate}/hr
            </div>
          </div>
          
          {parseFloat(breakdown.overtimePay.toString()) > 0 && (
            <div>
              <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                Overtime
              </div>
              <div style={{ fontSize: '1.1rem', color: 'var(--color-warning)', fontWeight: '600' }}>
                ${formatCurrency(breakdown.overtimePay)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>
                {formatHours(breakdown.overtimeHours)}h
              </div>
            </div>
          )}
          
          {parseFloat(breakdown.penaltyPay.toString()) > 0 && (
            <div>
              <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                Penalties
              </div>
              <div style={{ fontSize: '1.1rem', color: 'var(--color-primary)', fontWeight: '600' }}>
                ${formatCurrency(breakdown.penaltyPay)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>
                {formatHours(breakdown.penaltyHours)}h
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
            <div style={{ fontSize: '1.5rem', color: 'var(--color-success)', fontWeight: '700' }}>
              ${formatCurrency(breakdown.totalPay)}
            </div>
          </div>
        </div>

        {/* Detailed Breakdown Toggle */}
        {hasBreakdownDetails && (
          <>
            <div style={{ 
              borderTop: '1px solid var(--color-border)', 
              marginTop: '1rem',
              paddingTop: '1rem'
            }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
                leftIcon={showDetails ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                style={{
                  padding: '0.5rem',
                  fontSize: '0.875rem',
                  color: 'var(--color-text-primary)',
                  fontWeight: '500'
                }}
              >
                {showDetails ? 'Hide' : 'Show'} Detailed Breakdown
                {penalties.length > 0 && (
                  <span style={{ 
                    marginLeft: '0.5rem',
                    color: 'var(--color-text-secondary)',
                    fontSize: '0.75rem'
                  }}>
                    {penalties.length} penalty{penalties.length > 1 ? ' rules' : ' rule'}
                  </span>
                )}
                {overtimes.length > 0 && (
                  <span style={{ 
                    marginLeft: penalties.length > 0 ? '0.25rem' : '0.5rem',
                    color: 'var(--color-text-secondary)',
                    fontSize: '0.75rem'
                  }}>
                    {penalties.length > 0 ? ', ' : ''}{overtimes.length} overtime period{overtimes.length > 1 ? 's' : ''}
                  </span>
                )}
              </Button>
            </div>

            {/* Detailed Breakdown Content */}
            {showDetails && (
              <div style={{ marginTop: '0.5rem' }}>
                {penalties.length > 0 && (
                  <PenaltyBreakdown 
                    penalties={penalties}
                    baseRate={payGuide.baseRate.toString()}
                    isPreview={isPreview}
                  />
                )}
                
                {overtimes.length > 0 && (
                  <OvertimeBreakdown 
                    overtimes={overtimes}
                    baseRate={payGuide.baseRate.toString()}
                    isPreview={isPreview}
                  />
                )}
              </div>
            )}
          </>
        )}
      </CardBody>
    </Card>
  )
}