'use client'

import React from 'react'
import { AppShell } from '@/components/layout'
import { PayGuideSelector } from '@/components/settings'

export default function PayGuideSettingsPage() {
  return (
    <AppShell title="Pay Guide" subtitle="Choose a default pay guide" showBackButton backButtonHref="/settings">
      <PayGuideSelector />
    </AppShell>
  )
}

