'use client'

import React from 'react'
import { AppShell } from '@/components/layout'
import { DataManagement } from '@/components/settings'

export default function DataSettingsPage() {
  return (
    <AppShell title="Data Management" subtitle="Export & preferences" showBackButton backButtonHref="/settings">
      <DataManagement />
    </AppShell>
  )
}

