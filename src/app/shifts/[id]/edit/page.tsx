'use client'

import React from 'react'
import { useParams } from 'next/navigation'
import { AppShell } from '@/components/layout'
import { ShiftForm } from '@/components/shifts'

type RouteParams = { id: string }

export default function EditShiftPage() {
  const params = useParams<RouteParams>()
  const id = (params?.id ?? '') as string
  return (
    <AppShell 
      title="Edit Shift" 
      subtitle="Modify shift details"
      showBackButton={true}
      backButtonHref={`/shifts/${id}`}
    >
      <ShiftForm mode="edit" shiftId={id} />
    </AppShell>
  )
}
