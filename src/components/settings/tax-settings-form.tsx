"use client"

import React, { useEffect, useState } from 'react'
import { Button, Card, Input } from '@/components/ui'

type TaxSettings = {
  id: string
  claimedTaxFreeThreshold: boolean
  isForeignResident: boolean
  hasTaxFileNumber: boolean
  medicareExemption: 'none' | 'half' | 'full'
  hecsHelpRate?: string
}

export const TaxSettingsForm: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [data, setData] = useState<TaxSettings | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('/api/tax-settings', { cache: 'no-store' })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || 'Failed to load tax settings')
        if (mounted) setData(json.data)
      } catch (e: any) {
        if (mounted) setErr(e.message)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!data) return
    setSaving(true)
    setErr(null)
    setMsg(null)
    try {
      const res = await fetch('/api/tax-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimedTaxFreeThreshold: data.claimedTaxFreeThreshold,
          isForeignResident: data.isForeignResident,
          hasTaxFileNumber: data.hasTaxFileNumber,
          medicareExemption: data.medicareExemption,
          // hecsHelpRate is derived from ATO thresholds; not configurable here
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.message || json?.error || 'Failed to save')
      setMsg('Saved successfully')
      setData(json.data)
    } catch (e: any) {
      setErr(e.message)
    } finally { setSaving(false) }
  }

  if (loading) return <div>Loading…</div>
  if (err) return <div role="alert" style={{ color: '#F44336' }}>{err}</div>
  if (!data) return null

  return (
    <Card>
      <form onSubmit={onSubmit} aria-label="Tax Settings">
        <div className="mb-3">
          <label className="form-label">Tax File Number provided</label>
          <div className="form-check form-switch">
            <input className="form-check-input" type="checkbox" checked={data.hasTaxFileNumber} onChange={e => setData({ ...data, hasTaxFileNumber: e.target.checked })} />
          </div>
        </div>
        <div className="mb-3">
          <label className="form-label">Claim tax-free threshold</label>
          <div className="form-check form-switch">
            <input className="form-check-input" type="checkbox" checked={data.claimedTaxFreeThreshold} onChange={e => setData({ ...data, claimedTaxFreeThreshold: e.target.checked })} />
          </div>
        </div>
        <div className="mb-3">
          <label className="form-label">Foreign resident</label>
          <div className="form-check form-switch">
            <input className="form-check-input" type="checkbox" checked={data.isForeignResident} onChange={e => setData({ ...data, isForeignResident: e.target.checked })} />
          </div>
        </div>
        <div className="mb-3">
          <label className="form-label">Medicare exemption</label>
          <select className="form-select" value={data.medicareExemption} onChange={e => setData({ ...data, medicareExemption: e.target.value as any })}>
            <option value="none">None</option>
            <option value="half">Half</option>
            <option value="full">Full</option>
          </select>
        </div>
        {/* HECS-HELP rate is not user-configurable; applied per pay period thresholds */}
        <div className="d-flex gap-2">
          <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          {msg && <span aria-live="polite" style={{ color: '#00E5FF' }}>{msg}</span>}
        </div>
      </form>
    </Card>
  )
}
