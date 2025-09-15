'use client'

import React from 'react'
import { Card, CardBody } from '../ui'
import { DollarSign } from 'lucide-react'

export const PayBreakdown: React.FC = () => {
  return (
    <Card variant="outlined">
      <CardBody>
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          padding: '2rem',
          textAlign: 'center',
          gap: '1rem'
        }}>
          <DollarSign size={48} style={{ color: 'var(--color-text-tertiary)' }} />
          <h3 style={{ color: 'var(--color-text-primary)', margin: 0 }}>
            Pay Breakdown Coming Soon
          </h3>
          <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
            Detailed pay breakdowns are currently under development.
          </p>
        </div>
      </CardBody>
    </Card>
  )
}