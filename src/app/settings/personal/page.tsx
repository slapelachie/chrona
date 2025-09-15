'use client'

import React from 'react'
import { AppShell } from '@/components/layout'
import { PersonalInfoForm } from '@/components/settings'

export default function PersonalSettingsPage() {
  return (
    <AppShell title="Personal Information" subtitle="Profile and pay period" showBackButton backButtonHref="/settings">
      <PersonalInfoForm />
    </AppShell>
  )
}

