'use client'

import React from 'react'
import { AppShell } from '@/components/layout'
import { ShiftForm } from '@/components/shifts'

export default function NewShiftPage() {
  return (
    <AppShell 
      title="New Shift" 
      subtitle="Add a new work shift"
      showBackButton={true}
      backButtonHref="/shifts"
    >
      <ShiftForm mode="create" />
    </AppShell>
  )
}