'use client'

import React, { useEffect, useState } from 'react'
import { AppShell } from '@/components/layout'
import { SettingsCard } from '@/components/settings'
import {
  SETTINGS_CARD_ITEMS,
  type SettingsCardConfig,
  type SettingsCategory,
  type SettingsStatusKey,
} from '@/lib/settings-sections'
import { usePreferences } from '@/hooks/use-preferences'

const CATEGORY_ORDER: SettingsCategory[] = ['Personal', 'Pay & Tax', 'Productivity', 'Administration']

export default function SettingsIndexPage() {
  const groupedByCategory = CATEGORY_ORDER.map(category => ({
    category,
    items: SETTINGS_CARD_ITEMS.filter(item => item.category === category),
  }))

  return (
    <AppShell title="Settings" subtitle="Manage your configuration">
      <div className="settings-section-stack">
        {groupedByCategory.map(({ category, items }) => (
          items.length > 0 && (
            <section key={category} className="settings-section" aria-labelledby={`settings-${category}`}>
              <header className="settings-section__header">
                <h2 id={`settings-${category}`} className="settings-section__title">{category}</h2>
              </header>
              <div className="settings-grid">
                {items.map(item => (
                  <SettingsCardWrapper key={item.key} config={item} />
                ))}
              </div>
            </section>
          )
        ))}
      </div>
    </AppShell>
  )
}

function DefaultPayGuideStatus() {
  const { prefs } = usePreferences()
  const [label, setLabel] = useState<string>('Not set')
  const [tone, setTone] = useState<'default' | 'warning' | 'info'>('warning')

  useEffect(() => {
    let active = true
    async function resolveDefault() {
      if (!prefs.defaultPayGuideId) {
        setLabel('Not set')
        setTone('warning')
        return
      }

      try {
        const res = await fetch('/api/pay-rates?active=true&limit=100&fields=id,name')
        const json = await res.json()
        if (!active) return
        if (!res.ok) throw new Error()
        const match = json?.data?.payGuides?.find((pg: { id: string }) => pg.id === prefs.defaultPayGuideId)
        if (match?.name) {
          setLabel(`Default: ${match.name}`)
        } else {
          setLabel('Default selected')
        }
        setTone('info')
      } catch {
        if (!active) return
        setLabel('Default selected')
        setTone('info')
      }
    }

    resolveDefault()
    return () => { active = false }
  }, [prefs.defaultPayGuideId])

  return <StatusPill tone={tone}>{label}</StatusPill>
}

function NotificationsStatus() {
  const { prefs } = usePreferences()
  const enabledCount = [
    prefs.emailReminders,
    prefs.payPeriodAlerts,
    prefs.shiftReminders,
  ].filter(Boolean).length

  if (enabledCount === 0) {
    return <StatusPill tone="warning">All off</StatusPill>
  }

  return <StatusPill tone="info">Enabled ({enabledCount})</StatusPill>
}

type StatusPillProps = {
  tone?: 'default' | 'warning' | 'info'
  children: React.ReactNode
}

function StatusPill({ tone = 'default', children }: StatusPillProps) {
  const toneClass = tone === 'default' ? '' : ` settings-chip--${tone}`
  return <span className={`settings-chip${toneClass}`}>{children}</span>
}

const STATUS_COMPONENTS: Partial<Record<SettingsStatusKey, React.ComponentType>> = {
  defaultPayGuide: DefaultPayGuideStatus,
  notifications: NotificationsStatus,
}

type SettingsCardWrapperProps = {
  config: SettingsCardConfig
}

function SettingsCardWrapper({ config }: SettingsCardWrapperProps) {
  const StatusComponent = config.statusKey ? STATUS_COMPONENTS[config.statusKey] : undefined
  return (
    <SettingsCard
      title={config.title}
      description={config.description}
      href={config.href}
      icon={config.icon}
      tone={config.tone}
      status={StatusComponent ? <StatusComponent /> : undefined}
    />
  )
}
