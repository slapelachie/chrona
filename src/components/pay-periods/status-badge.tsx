"use client"

import React from 'react'
import { ShieldCheck, DollarSign, Loader2, Clock } from 'lucide-react'

type Status = 'open' | 'processing' | 'paid' | 'verified'

export interface StatusBadgeProps {
  status: Status
  size?: 'sm' | 'md' | 'lg'
  emphasis?: boolean // filled vs subtle
  className?: string
}

const STATUS_META: Record<Status, {
  label: string
  color: string // CSS variable for main color
  bg: string // subtle background
  Icon: React.ComponentType<{ size?: number, className?: string }>
}> = {
  open: {
    label: 'Open',
    // Use a distinct indigo so it's clearly different from success green
    color: '#6E59F7',
    bg: 'rgba(110, 89, 247, 0.14)',
    Icon: Clock,
  },
  processing: {
    label: 'Processing',
    color: 'var(--color-warning)',
    bg: 'rgba(255,193,7,0.16)',
    Icon: Loader2,
  },
  paid: {
    label: 'Paid',
    color: 'var(--color-info)',
    bg: 'rgba(0,229,255,0.16)',
    Icon: DollarSign,
  },
  verified: {
    label: 'Verified',
    color: 'var(--color-success)',
    bg: 'rgba(40,167,69,0.14)',
    Icon: ShieldCheck,
  },
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  emphasis = false,
  className,
}) => {
  const meta = STATUS_META[status]
  const px = size === 'lg' ? '0.5rem 0.75rem' : size === 'sm' ? '0.125rem 0.5rem' : '0.25rem 0.6rem'
  const fs = size === 'lg' ? 13 : size === 'sm' ? 11 : 12
  const icon = size === 'lg' ? 16 : size === 'sm' ? 12 : 14

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: px,
        borderRadius: 999,
        fontWeight: 700,
        fontSize: fs,
        letterSpacing: 0.2,
        color: emphasis ? 'white' : meta.color,
        background: emphasis ? meta.color : meta.bg,
        border: emphasis ? `1px solid ${meta.color}` : `1px solid transparent`,
      }}
    >
      <meta.Icon size={icon} className={status === 'processing' ? 'loading-rotate' : undefined} />
      {meta.label}
      <style jsx>{`
        .loading-rotate {
          animation: spin 1.1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </span>
  )
}

export function statusAccentColor(status: Status): string {
  return STATUS_META[status].color
}
