'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Button } from '../ui'
import { Plus, Play, RotateCw, FolderOpen } from 'lucide-react'
import { useRouter } from 'next/navigation'
import './quick-actions.scss'

export const QuickActions: React.FC = () => {
  const router = useRouter()
  const [summary, setSummary] = useState<any | null>(null)
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

  const currentId = summary?.currentPeriod?.id ?? null
  const shiftsCount = summary?.currentPeriod?.shiftsCount ?? 0
  const canView = !!currentId

  const [canProcess, setCanProcess] = useState<boolean>(false)
  const [status, setStatus] = useState<string | null>(null)
  useEffect(() => {
    let cancel = false
    async function checkProcess() {
      if (!currentId) { setCanProcess(false); setStatus(null); return }
      try {
        const r = await fetch(`/api/pay-periods/${currentId}/process`)
        const j = await r.json()
        if (!cancel) {
          setCanProcess(!!j?.data?.canProcess)
          setStatus(j?.data?.currentStatus || null)
        }
      } catch { if (!cancel) { setCanProcess(false); setStatus(null) } }
    }
    checkProcess()
    return () => { cancel = true }
  }, [currentId])

  const actions = useMemo(() => [
    {
      label: 'Add Shift',
      icon: <Plus size={20} />,
      variant: 'primary' as const,
      onClick: () => router.push('/shifts/new'),
      isPrimary: true,
      disabled: false,
    },
    {
      label: 'View Current Period',
      icon: <FolderOpen size={20} />,
      variant: 'outline' as const,
      onClick: () => currentId && router.push(`/pay-periods/${currentId}`),
      disabled: !canView,
      title: !canView ? 'No current pay period yet' : undefined,
    },
    {
      label: 'Process Current Period',
      icon: <Play size={20} />,
      variant: 'outline' as const,
      onClick: async () => {
        if (!currentId) return
        setBusy('process')
        try {
          await fetch(`/api/pay-periods/${currentId}/process`, { method: 'POST' })
        } finally { setBusy(null) }
      },
      disabled: !canProcess,
      title: !canProcess ? 'Requires open period with all shifts calculated' : undefined,
    },
    ...(status && status !== 'open' ? [{
      label: 'Open Current Period',
      icon: <Play size={20} />,
      variant: 'outline' as const,
      onClick: async () => {
        if (!currentId) return
        setBusy('open')
        try {
          await fetch(`/api/pay-periods/${currentId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'open' }) })
          // refresh summary + status
          const res = await fetch('/api/dashboard/summary', { cache: 'no-store' })
          const json = await res.json()
          setSummary(json.data)
          const chk = await fetch(`/api/pay-periods/${currentId}/process`)
          const cjson = await chk.json()
          setCanProcess(!!cjson?.data?.canProcess)
          setStatus(cjson?.data?.currentStatus || null)
        } finally { setBusy(null) }
      },
      disabled: !!busy,
      title: undefined,
    }] : []),
    {
      label: 'Recalculate Taxes',
      icon: <RotateCw size={20} />,
      variant: 'outline' as const,
      onClick: async () => {
        if (!currentId) return
        setBusy('tax')
        try {
          await fetch(`/api/pay-periods/${currentId}/tax-calculation`, { method: 'POST' })
        } finally { setBusy(null) }
      },
      disabled: !(currentId && shiftsCount > 0),
      title: !(currentId && shiftsCount > 0) ? 'No pay period or no shifts to calculate' : undefined,
    },
  ], [router, currentId, canView, canProcess, shiftsCount, status, busy])

  return (
    <div className="quick-actions">
      <h2 className="quick-actions__title">Quick Actions</h2>
      
      <div className="quick-actions__grid">
        {actions.map((action, index) => (
          <Button
            key={index}
            variant={action.variant}
            leftIcon={busy ? undefined : action.icon}
            onClick={action.onClick}
            disabled={!!busy || action.disabled}
            title={action.title}
            className={`quick-actions__button ${action.isPrimary ? 'quick-actions__button--primary' : ''}`}
            size="lg"
          >
            {busy && index > 0 && action.label.includes('Recalculate') ? 'Recalculating…' : busy && index > 0 && action.label.includes('Process') ? 'Processing…' : action.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
