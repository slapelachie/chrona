'use client'

import React from 'react'
import { AppShell } from '@/components/layout'
import { NotificationPreferences } from '@/components/settings'

export default function NotificationsSettingsPage() {
  return (
    <AppShell title="Notifications" subtitle="Reminder preferences" showBackButton backButtonHref="/settings">
      <NotificationPreferences />
    </AppShell>
  )
}

