"use client"

import React, { useEffect, useState } from 'react'
import { Button, Card, CardBody, Input, Select, Toggle, Alert } from '@/components/ui'
import { CreatePayGuideRequest, PayGuideResponse, UpdatePayGuideRequest } from '@/types'
import './pay-guide-form.scss'

const AU_TIMEZONES = [
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Brisbane',
  'Australia/Adelaide',
  'Australia/Darwin',
  'Australia/Perth',
  'Australia/Hobart',
]

type Mode = 'create' | 'edit'

interface Props {
  mode: Mode
  payGuideId?: string
  onSaved?: (pg: PayGuideResponse) => void
}

export const PayGuideForm: React.FC<Props> = ({ mode, payGuideId, onSaved }) => {
  const [loading, setLoading] = useState(mode === 'edit')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const [form, setForm] = useState<{
    name: string
    baseRate: string
    description: string
    effectiveFrom: string
    effectiveTo: string
    timezone: string
    isActive: boolean
    minimumShiftHours: string
    maximumShiftHours: string
  }>({
    name: '',
    baseRate: '',
    description: '',
    effectiveFrom: new Date().toISOString().slice(0,10),
    effectiveTo: '',
    timezone: AU_TIMEZONES[0],
    isActive: true,
    minimumShiftHours: '',
    maximumShiftHours: '',
  })

  useEffect(() => {
    if (mode !== 'edit' || !payGuideId) return
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/pay-rates/${payGuideId}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || 'Failed to load pay guide')
        const pg: PayGuideResponse = json.data
        if (!mounted) return
        setForm({
          name: pg.name,
          baseRate: pg.baseRate,
          description: pg.description || '',
          effectiveFrom: new Date(pg.effectiveFrom).toISOString().slice(0,10),
          effectiveTo: pg.effectiveTo ? new Date(pg.effectiveTo).toISOString().slice(0,10) : '',
          timezone: pg.timezone,
          isActive: pg.isActive,
          minimumShiftHours: pg.minimumShiftHours?.toString() || '',
          maximumShiftHours: pg.maximumShiftHours?.toString() || '',
        })
      } catch (e: any) {
        setErr(e.message)
      } finally { setLoading(false) }
    })()
    return () => { mounted = false }
  }, [mode, payGuideId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setErr(null)
    setMsg(null)
    try {
      const payload: CreatePayGuideRequest | UpdatePayGuideRequest = {
        name: form.name,
        baseRate: form.baseRate,
        description: form.description || undefined,
        effectiveFrom: new Date(form.effectiveFrom).toISOString(),
        effectiveTo: form.effectiveTo ? new Date(form.effectiveTo).toISOString() : undefined,
        timezone: form.timezone,
        isActive: form.isActive,
        minimumShiftHours: form.minimumShiftHours ? Number(form.minimumShiftHours) : undefined,
        maximumShiftHours: form.maximumShiftHours ? Number(form.maximumShiftHours) : undefined,
      }
      const res = await fetch(mode === 'create' ? '/api/pay-rates' : `/api/pay-rates/${payGuideId}`, {
        method: mode === 'create' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.message || json?.error || 'Save failed')
      setMsg('Saved successfully')
      if (onSaved) onSaved(json.data as PayGuideResponse)
    } catch (e: any) { setErr(e.message) } finally { setSaving(false) }
  }

  if (loading) return <div>Loading…</div>

  return (
    <Card variant="elevated" className="pay-guide-form">
      <CardBody>
        <form onSubmit={handleSubmit} className="pay-guide-form__form">
          {(err || msg) && (
            <div className="pay-guide-form__message">
              {err && (
                <Alert tone="danger" role="alert">
                  {err}
                </Alert>
              )}
              {msg && (
                <Alert tone="success" role="status">
                  {msg}
                </Alert>
              )}
            </div>
          )}

          <div className="pay-guide-form__grid">
            <Input label="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            <Input label="Base Rate ($/hr)" type="number" min={0} step={0.01} value={form.baseRate} onChange={e => setForm({ ...form, baseRate: e.target.value })} required />
            <Input label="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>

          <div className="pay-guide-form__split">
            <Input
              type="date"
              label="Effective From"
              value={form.effectiveFrom}
              onChange={e => setForm({ ...form, effectiveFrom: e.target.value })}
              required
            />
            <Input
              type="date"
              label="Effective To"
              value={form.effectiveTo}
              onChange={e => setForm({ ...form, effectiveTo: e.target.value })}
            />
          </div>

          <div className="pay-guide-form__split">
            <Input label="Min Shift Hours" type="number" min={0} step={0.5} value={form.minimumShiftHours} onChange={e => setForm({ ...form, minimumShiftHours: e.target.value })} />
            <Input label="Max Shift Hours" type="number" min={0} step={0.5} value={form.maximumShiftHours} onChange={e => setForm({ ...form, maximumShiftHours: e.target.value })} />
          </div>

          <Select
            label="Timezone"
            value={form.timezone}
            onChange={e => setForm({ ...form, timezone: e.target.value })}
          >
            {AU_TIMEZONES.map(tz => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </Select>

          <div className="pay-guide-form__toggles">
            <Toggle
              label="Active"
              checked={form.isActive}
              onChange={e => setForm({ ...form, isActive: e.target.checked })}
            />
          </div>

          <div className="pay-guide-form__actions">
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : (mode === 'create' ? 'Create' : 'Save')}</Button>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}
