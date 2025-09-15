'use client'

import React from 'react'
import { useParams } from 'next/navigation'
import { AppShell } from '@/components/layout'
import { PayPeriodDetail } from '@/components/pay-periods'

type RouteParams = { id: string }

export default function PayPeriodDetailPage() {
  const params = useParams<RouteParams>()
  const id = (params?.id ?? '') as string
  return (
    <AppShell
      title="Pay Period"
      subtitle="Totals, taxes and verification"
      showBackButton={true}
      backButtonHref="/pay-periods"
    >
      <PayPeriodDetail payPeriodId={id} />
    </AppShell>
  )
}

