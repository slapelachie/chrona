"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { Button, Card, Input } from '@/components/ui'
import { CreatePenaltyTimeFrameRequest, PenaltyTimeFrameResponse } from '@/types'

interface Props { payGuideId: string }

const dayOptions: Array<{ label: string; value?: number }> = [
  { label: 'All days' },
  { label: 'Monday', value: 1 },
  { label: 'Tuesday', value: 2 },
  { label: 'Wednesday', value: 3 },
  { label: 'Thursday', value: 4 },
  { label: 'Friday', value: 5 },
  { label: 'Saturday', value: 6 },
  { label: 'Sunday', value: 0 },
]

type Row = PenaltyTimeFrameResponse

export const PenaltyFramesEditor: React.FC<Props> = ({ payGuideId }) => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [q, setQ] = useState('')

  const [form, setForm] = useState<CreatePenaltyTimeFrameRequest>({
    name: '', multiplier: '1.25', dayOfWeek: undefined, isPublicHoliday: false,
    startTime: '', endTime: '', description: '', isActive: true,
  })
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [edit, setEdit] = useState<CreatePenaltyTimeFrameRequest | null>(null)

  const fetchRows = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/pay-rates/${payGuideId}/penalty-time-frames`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to load penalty frames')
      setRows(json.data as Row[])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchRows() }, [payGuideId])

  const filtered = useMemo(() => rows.filter(r => r.name.toLowerCase().includes(q.toLowerCase())), [rows, q])

  const create = async () => {
    setSaving(true)
    setError(null)
    try {
      const payload: CreatePenaltyTimeFrameRequest = {
        name: form.name,
        multiplier: form.multiplier,
        dayOfWeek: form.dayOfWeek,
        isPublicHoliday: form.isPublicHoliday,
        startTime: form.startTime || undefined,
        endTime: form.endTime || undefined,
        description: form.description || undefined,
        isActive: form.isActive,
      }
      const res = await fetch(`/api/pay-rates/${payGuideId}/penalty-time-frames`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.message || json?.error || 'Create failed')
      setForm({ name: '', multiplier: '1.25', dayOfWeek: undefined, isPublicHoliday: false, startTime: '', endTime: '', description: '', isActive: true })
      fetchRows()
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed') } finally { setSaving(false) }
  }

  const save = async (id: string, patch: Partial<CreatePenaltyTimeFrameRequest>) => {
    try {
      // sanitize payload: convert empty strings to undefined for optional fields
      const sanitized: Partial<CreatePenaltyTimeFrameRequest> = {
        ...patch,
        startTime: patch.startTime ? patch.startTime : undefined,
        endTime: patch.endTime ? patch.endTime : undefined,
        description: patch.description ? patch.description : undefined,
      }
      const res = await fetch(`/api/pay-rates/${payGuideId}/penalty-time-frames/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sanitized)
      })
      if (!res.ok) {
        let msg = 'Update failed'
        try {
          const json = await res.json()
          msg = json?.message || json?.error || msg
        } catch {
          try { msg = await res.text() } catch { /* ignore */ }
        }
        throw new Error(msg)
      }
      setEditId(null)
      setEdit(null)
      await fetchRows()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Update failed')
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this penalty time frame?')) return
    const res = await fetch(`/api/pay-rates/${payGuideId}/penalty-time-frames/${id}`, { method: 'DELETE' })
    if (res.ok) fetchRows()
    else { const json = await res.json(); alert(json?.message || json?.error || 'Delete failed') }
  }

  return (
    <div className="d-flex flex-column gap-3">
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <div className="fw-semibold">Penalty Time Frames</div>
          <div className="text-secondary" style={{ fontSize: 13 }}>Weekend/evening/public-holiday loadings</div>
        </div>
        <Input placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} />
      </div>

      {/* Create form */}
      <Card>
        <div className="p-3 d-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <Input label="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <Input label="Multiplier" type="number" min={1} step={0.05} value={form.multiplier} onChange={e => setForm({ ...form, multiplier: e.target.value })} />
          <div>
            <label className="form-label">Day</label>
            <select className="form-select" value={form.dayOfWeek ?? ''} onChange={e => setForm({ ...form, dayOfWeek: e.target.value === '' ? undefined : Number(e.target.value) })}>
              {dayOptions.map(d => <option key={d.label} value={d.value ?? ''}>{d.label}</option>)}
            </select>
          </div>
          <Input label="Start (HH:MM)" placeholder="18:00" value={form.startTime || ''} onChange={e => setForm({ ...form, startTime: e.target.value })} />
          <Input label="End (HH:MM)" placeholder="06:00" value={form.endTime || ''} onChange={e => setForm({ ...form, endTime: e.target.value })} />
          <Input label="Description" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} />
          <div className="form-check form-switch align-self-end">
            <input className="form-check-input" type="checkbox" id="pf-active" checked={form.isActive ?? true} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
            <label htmlFor="pf-active" className="form-check-label">Active</label>
          </div>
          <div className="form-check form-switch align-self-end">
            <input className="form-check-input" type="checkbox" id="pf-ph" checked={form.isPublicHoliday ?? false} onChange={e => setForm({ ...form, isPublicHoliday: e.target.checked })} />
            <label htmlFor="pf-ph" className="form-check-label">Public holiday</label>
          </div>
          <div className="align-self-end">
            <Button onClick={create} disabled={saving || !form.name || !form.multiplier}>{saving ? 'Saving…' : 'Add'}</Button>
          </div>
        </div>
      </Card>

      {loading && <div>Loading…</div>}
      {error && <div role="alert" style={{ color: '#F44336' }}>{error}</div>}

      {/* List */}
      <div className="d-flex flex-column gap-2">
        {filtered.map(r => {
          const isEditing = editId === r.id
          return (
            <Card key={r.id}>
              {!isEditing ? (
                <div className="p-3 d-grid" style={{ gridTemplateColumns: '1.2fr 0.6fr 0.8fr 0.6fr 0.6fr 1fr auto', gap: '0.75rem', alignItems: 'center' }}>
                  <div className="fw-semibold" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {r.name}
                    <span style={{ fontSize: 12, padding: '2px 6px', borderRadius: 999, background: r.isActive ? 'rgba(0,229,255,0.15)' : 'rgba(244,67,54,0.15)', color: r.isActive ? '#00E5FF' : '#F44336' }}>{r.isActive ? 'Active' : 'Inactive'}</span>
                    {r.isPublicHoliday && <span style={{ fontSize: 12, padding: '2px 6px', borderRadius: 999, background: 'rgba(0,188,212,0.15)', color: '#00BCD4' }}>Public holiday</span>}
                  </div>
                  <div>x{Number(r.multiplier).toFixed(2)}</div>
                  <div>{r.dayOfWeek === null || r.dayOfWeek === undefined ? 'All days' : dayOptions.find(d => d.value === r.dayOfWeek)?.label}</div>
                  <div>{r.startTime || '—'}</div>
                  <div>{r.endTime || '—'}</div>
                  <div className="text-secondary" style={{ fontSize: 13 }}>{r.description || ''}</div>
                  <div className="d-flex gap-2 justify-content-end">
                    <Button size="sm" variant="outline" onClick={() => save(r.id, { isActive: !r.isActive })}>{r.isActive ? 'Deactivate' : 'Activate'}</Button>
                    <Button size="sm" variant="secondary" onClick={() => { setEditId(r.id); setEdit({
                      name: r.name,
                      multiplier: r.multiplier.toString(),
                      dayOfWeek: (r.dayOfWeek ?? undefined) as number | undefined,
                      isPublicHoliday: r.isPublicHoliday ?? false,
                      startTime: r.startTime || undefined,
                      endTime: r.endTime || undefined,
                      description: r.description || undefined,
                      isActive: r.isActive,
                    }) }}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>Delete</Button>
                  </div>
                </div>
              ) : (
                <div className="p-3 d-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <Input label="Name" value={edit?.name || ''} onChange={e => setEdit({ ...(edit as CreatePenaltyTimeFrameRequest), name: e.target.value })} />
                  <Input label="Multiplier" type="number" min={1} step={0.05} value={edit?.multiplier || ''} onChange={e => setEdit({ ...(edit as CreatePenaltyTimeFrameRequest), multiplier: e.target.value })} />
                  <div>
                    <label className="form-label">Day</label>
                    <select className="form-select" value={edit?.dayOfWeek ?? ''} onChange={e => setEdit({ ...(edit as CreatePenaltyTimeFrameRequest), dayOfWeek: e.target.value === '' ? undefined : Number(e.target.value) })}>
                      {dayOptions.map(d => <option key={d.label} value={d.value ?? ''}>{d.label}</option>)}
                    </select>
                  </div>
                  <Input label="Start (HH:MM)" value={edit?.startTime || ''} onChange={e => setEdit({ ...(edit as CreatePenaltyTimeFrameRequest), startTime: e.target.value })} />
                  <Input label="End (HH:MM)" value={edit?.endTime || ''} onChange={e => setEdit({ ...(edit as CreatePenaltyTimeFrameRequest), endTime: e.target.value })} />
                  <Input label="Description" value={edit?.description || ''} onChange={e => setEdit({ ...(edit as CreatePenaltyTimeFrameRequest), description: e.target.value })} />
                  <div className="form-check form-switch align-self-end">
                    <input className="form-check-input" type="checkbox" id={`pf-active-${r.id}`} checked={edit?.isActive ?? true} onChange={e => setEdit({ ...(edit as CreatePenaltyTimeFrameRequest), isActive: e.target.checked })} />
                    <label htmlFor={`pf-active-${r.id}`} className="form-check-label">Active</label>
                  </div>
                  <div className="form-check form-switch align-self-end">
                    <input className="form-check-input" type="checkbox" id={`pf-ph-${r.id}`} checked={edit?.isPublicHoliday ?? false} onChange={e => setEdit({ ...(edit as CreatePenaltyTimeFrameRequest), isPublicHoliday: e.target.checked })} />
                    <label htmlFor={`pf-ph-${r.id}`} className="form-check-label">Public holiday</label>
                  </div>
                  <div className="align-self-end d-flex gap-2">
                    <Button size="sm" onClick={() => save(r.id, edit as Partial<CreatePenaltyTimeFrameRequest>)}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setEditId(null); setEdit(null) }}>Cancel</Button>
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
