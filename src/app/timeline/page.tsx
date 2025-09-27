'use client'

import React from 'react'
import { AppShell } from '@/components/layout'
import { ShiftsList } from '@/components/shifts'

export default function TimelinePage() {
  return (
    <AppShell
      title="Timeline"
      subtitle="Review shifts alongside their pay periods"
    >
      <ShiftsList />
    </AppShell>
  )
}
