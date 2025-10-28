'use client'

import React, { Suspense } from 'react'
import { AppShell } from '@/components/layout'
import { ShiftForm } from '@/components/shifts'

export default function NewShiftPage() {
  return (
    <AppShell
      title="New Shift"
      subtitle="Add a new work shift"
      showBackButton={true}
      backButtonHref="/timeline"
    >
      <Suspense fallback={null /* or a small skeleton */}>
        <ShiftForm mode="create" />
      </Suspense>
    </AppShell>
  )
}
