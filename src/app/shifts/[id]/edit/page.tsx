'use client'

import React from 'react'
import { AppShell } from '@/components/layout'
import { ShiftForm } from '@/components/shifts'

interface EditShiftPageProps {
  params: {
    id: string
  }
}

export default function EditShiftPage({ params }: EditShiftPageProps) {
  return (
    <AppShell 
      title="Edit Shift" 
      subtitle="Modify shift details"
      showBackButton={true}
      backButtonHref={`/shifts/${params.id}`}
    >
      <ShiftForm mode="edit" shiftId={params.id} />
    </AppShell>
  )
}