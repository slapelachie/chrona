'use client'

import React from 'react'
import Link from 'next/link'
import { AppShell } from '@/components/layout'
import { SETTINGS_SECTION_LIST } from '@/lib/settings-sections'

export default function SettingsIndexPage() {
  const items = [
    ...SETTINGS_SECTION_LIST.map(section => ({
      href: `/settings/${section.slug}`,
      title: section.title,
      desc: section.description,
    })),
    { href: '/pay-guides', title: 'Pay Guides (Manage)', desc: 'Add, edit, deactivate, or delete pay guides' },
    { href: '/settings/tax-tables', title: 'Tax Tables (Admin)', desc: 'PAYG coefficients and HECS thresholds' },
  ]

  return (
    <AppShell title="Settings" subtitle="Manage your configuration">
      <div className="d-flex flex-column gap-2">
        {items.map(i => (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          <Link key={i.href} href={i.href as any} className="p-3 rounded" style={{ background: '#121212', border: '1px solid #333' }}>
            <div className="fw-semibold">{i.title}</div>
            <div className="text-secondary" style={{ fontSize: 13 }}>{i.desc}</div>
          </Link>
        ))}
      </div>
    </AppShell>
  )
}
