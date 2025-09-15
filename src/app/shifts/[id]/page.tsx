'use client'

import React from 'react'
import { AppShell } from '@/components/layout'
import { ShiftDetail } from '@/components/shifts'

interface ShiftDetailPageProps {
  params: {
    id: string
  }
}

export default function ShiftDetailPage({ params }: ShiftDetailPageProps) {
  return (
    <AppShell 
      title="Shift Details" 
      subtitle="View shift information"
      showBackButton={true}
      backButtonHref="/shifts"
    >
      <ShiftDetail shiftId={params.id} />
    </AppShell>
  )
}