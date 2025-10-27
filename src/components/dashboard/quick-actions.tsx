'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '../ui'
import { Plus, RotateCw, FolderOpen, ShieldCheck } from 'lucide-react'
import { PayPeriodStatus } from '@/types'
import { useRouter } from 'next/navigation'
import './quick-actions.scss'

type ReadinessState = {
  status: PayPeriodStatus
  readyForVerification: boolean
  isFuture: boolean
  blockers: string[]
}

export const QuickActions: React.FC = () => {
  const router = useRouter()
  const [summary, setSummary] = useState<any | null>(null)
  const [readiness, setReadiness] = useState<ReadinessState | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/dashboard/summary', { cache: 'no-store' })
        const json = await res.json()
        if (!cancelled) setSummary(json.data)
      } catch (_) {
        if (!cancelled) setSummary(null)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const reloadSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/summary', { cache: 'no-store' })
      const json = await res.json()
      setSummary(json.data)
      return json.data
    } catch (error) {
      setSummary(null)
      return null
    }
  }, [])

  const reloadReadiness = useCallback(async (id: string | null) => {
    if (!id) {
      setReadiness(null)
      return null
    }
    try {
      const res = await fetch(`/api/pay-periods/${id}/readiness`, { cache: 'no-store' })
      const json = await res.json()
      setReadiness(json?.data ?? null)
      return json?.data ?? null
    } catch (error) {
      setReadiness(null)
      return null
    }
  }, [])

  const currentId = summary?.currentPeriod?.id ?? null
  const canView = !!currentId

  const currentStatus = (summary?.currentPeriod?.status ?? null) as PayPeriodStatus | null
  const canRefresh = !!currentId && currentStatus !== 'verified'
  const canVerify = !!currentId && currentStatus === 'pending' && !!readiness?.readyForVerification && !readiness?.isFuture
  const canReopen = !!currentId && currentStatus === 'verified'

  useEffect(() => {
    let cancel = false
    async function loadReadiness() {
      if (cancel) return
      await reloadReadiness(currentId)
    }
    loadReadiness()
    return () => { cancel = true }
  }, [currentId, reloadReadiness])

  const actions = useMemo(() => {
    const base = [
      {
        key: 'add',
        label: 'Add Shift',
        icon: <Plus size={20} />,
        variant: 'primary' as const,
        onClick: () => router.push('/shifts/new'),
        isPrimary: true,
        disabled: false,
        title: undefined as string | undefined,
      },
      {
        key: 'view',
        label: 'View Current Period',
        icon: <FolderOpen size={20} />,
        variant: 'outline' as const,
        onClick: () => currentId && router.push(`/pay-periods/${currentId}`),
        disabled: !canView,
        title: !canView ? 'No current pay period yet' : undefined,
      },
      {
        key: 'refresh',
        label: 'Refresh totals & tax',
        icon: <RotateCw size={20} />,
        variant: 'outline' as const,
        progressLabel: 'Refreshing…',
        onClick: async () => {
          if (!currentId) return
          setBusy('refresh')
          try {
            await fetch(`/api/pay-periods/${currentId}/recalculate`, { method: 'POST' })
            const updated = await reloadSummary()
            await reloadReadiness(updated?.currentPeriod?.id ?? currentId)
          } finally {
            setBusy(null)
          }
        },
        disabled: !canRefresh,
        title: !canRefresh ? 'Verified periods must be reopened before refreshing' : undefined,
      },
      {
        key: 'verify',
        label: 'Mark verified',
        icon: <ShieldCheck size={20} />,
        variant: 'outline' as const,
        progressLabel: 'Verifying…',
        onClick: async () => {
          if (!currentId) return
          setBusy('verify')
          try {
            await fetch(`/api/pay-periods/${currentId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'verified' }),
            })
            const updated = await reloadSummary()
            await reloadReadiness(updated?.currentPeriod?.id ?? currentId)
          } finally {
            setBusy(null)
          }
        },
        disabled: !canVerify,
        title: !canVerify ? 'Complete shifts and calculations before verifying' : undefined,
      },
    ]

    if (canReopen) {
      base.push({
        key: 'reopen',
        label: 'Reopen pay period',
        icon: <FolderOpen size={20} />,
        variant: 'outline' as const,
        progressLabel: 'Reopening…',
        onClick: async () => {
          if (!currentId) return
          setBusy('reopen')
          try {
            await fetch(`/api/pay-periods/${currentId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'pending' }),
            })
            const updated = await reloadSummary()
            await reloadReadiness(updated?.currentPeriod?.id ?? currentId)
          } finally {
            setBusy(null)
          }
        },
        disabled: false,
        title: undefined,
      })
    }

    return base
  }, [router, currentId, canView, canRefresh, canVerify, canReopen, busy, reloadSummary, reloadReadiness])

  return (
    <div className="quick-actions">
      <h2 className="quick-actions__title">Quick Actions</h2>
      
      <div className="quick-actions__grid">
        {actions.map((action) => {
          const isBusy = busy === action.key
          const disabled = (busy !== null && !isBusy) || action.disabled
          return (
            <Button
              key={action.key}
              variant={action.variant}
              leftIcon={!isBusy ? action.icon : undefined}
              onClick={action.onClick}
              disabled={disabled}
              title={action.title}
              className={`quick-actions__button ${action.isPrimary ? 'quick-actions__button--primary' : ''}`}
              size="lg"
            >
              {isBusy ? action.progressLabel ?? `${action.label}…` : action.label}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
