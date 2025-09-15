'use client'

import React from 'react'
import { AppShell } from '@/components/layout'
import { TaxSettingsForm } from '@/components/settings'

export default function TaxSettingsPage() {
  return (
    <AppShell title="Tax Settings" subtitle="PAYG & Medicare" showBackButton backButtonHref="/settings">
      <TaxSettingsForm />
    </AppShell>
  )
}

