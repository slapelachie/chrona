'use client'

import React from 'react'
import { AppShell } from '@/components/layout'
import { PayGuidesList } from '@/components/pay-guides'

export default function PayGuidesPage() {
  return (
    <AppShell title="Pay Guides" subtitle="Manage your pay guides" showBackButton backButtonHref="/settings">
      <PayGuidesList />
    </AppShell>
  )
}

