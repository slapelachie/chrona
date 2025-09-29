'use client'

import React from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import type { LucideIcon } from 'lucide-react'

type SettingsCardProps = {
  title: string
  description: string
  href: string
  icon: LucideIcon
  status?: React.ReactNode
  tone?: 'default' | 'admin'
}

export const SettingsCard: React.FC<SettingsCardProps> = ({
  title,
  description,
  href,
  icon: Icon,
  status,
  tone = 'default',
}) => {
  const className = `settings-card ${tone === 'admin' ? 'settings-card--admin' : ''}`

  return (
    <Link href={href as Route} className={className} aria-label={`${title} settings`}>
      <span className="settings-card__icon" aria-hidden>
        <Icon size={20} strokeWidth={1.75} />
      </span>
      <span className="settings-card__body">
        <span className="settings-card__title">{title}</span>
        <span className="settings-card__description">{description}</span>
      </span>
      {status ? <span className="settings-card__status">{status}</span> : null}
    </Link>
  )
}
