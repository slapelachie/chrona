'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout'
import { PayGuideForm } from '@/components/pay-guides'

export default function NewPayGuidePage() {
  const router = useRouter()
  return (
    <AppShell title="New Pay Guide" subtitle="Create a pay guide" showBackButton backButtonHref="/pay-guides">
      <PayGuideForm mode="create" onSaved={(pg) => router.push(`/pay-guides/${pg.id}/edit`)} />
    </AppShell>
  )
}

