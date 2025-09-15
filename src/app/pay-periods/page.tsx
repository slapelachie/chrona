'use client'

import React from 'react'
import { AppShell } from '@/components/layout'
import { PayPeriodsList } from '@/components/pay-periods'

export default function PayPeriodsPage() {
  return (
    <AppShell
      title="Pay Periods"
      subtitle="View pay periods and totals"
    >
      <PayPeriodsList />
    </AppShell>
  )
}

