'use client'

import React from 'react'
import { useParams } from 'next/navigation'
import { AppShell } from '@/components/layout'
import { ShiftDetail } from '@/components/shifts'

type RouteParams = { id: string }

export default function ShiftDetailPage() {
  const params = useParams<RouteParams>()
  const id = (params?.id ?? '') as string
  return (
    <AppShell 
      title="Shift Details" 
      subtitle="View shift information"
      showBackButton={true}
      backButtonHref="/shifts"
    >
      <ShiftDetail shiftId={id} />
    </AppShell>
  )
}
