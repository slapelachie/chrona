'use client'

import React from 'react'
import { AppShell } from '@/components/layout'
import { ShiftsList } from '@/components/shifts'

export default function ShiftsPage() {
  return (
    <AppShell 
      title="Shifts" 
      subtitle="Manage your work schedule"
    >
      <ShiftsList />
    </AppShell>
  )
}