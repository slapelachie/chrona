"use client"

import React, { useCallback, useEffect, useState } from 'react'
import { Button, Card, Input, Alert } from '@/components/ui'
import './tax-admin.scss'

type Hecs = {
  id?: string
  incomeFrom: string
  incomeTo: string | null
  rate: string
  description?: string | null
}

import { getCurrentAuTaxYearString } from '@/lib/tax-year'

interface Props { initialTaxYear?: string }

export const HecsEditor: React.FC<Props> = ({ initialTaxYear = getCurrentAuTaxYearString() }) => {
  const [taxYear, setTaxYear] = useState(initialTaxYear)
  const [rows, setRows] = useState<Hecs[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const fetchRows = useCallback(async () => {
    setLoading(true); setErr(null); setMsg(null)
    try {
      const q = new URLSearchParams({ taxYear })
      const res = await fetch(`/api/admin/hecs-thresholds?${q.toString()}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to load thresholds')
      setRows(json.data as Hecs[])
    } catch (e: any) { setErr(e.message) } finally { setLoading(false) }
  }, [taxYear])

  useEffect(() => { fetchRows() }, [fetchRows])

  const addRow = () => setRows(prev => ([...prev, { incomeFrom: '0', incomeTo: '', rate: '0.00', description: '' }]))
  const removeRow = (idx: number) => setRows(prev => prev.filter((_, i) => i !== idx))
  const update = (idx: number, patch: Partial<Hecs>) => setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r))

  const save = async () => {
    setSaving(true); setErr(null); setMsg(null)
    try {
      const thresholds = rows.map(r => ({
        incomeFrom: r.incomeFrom,
        incomeTo: r.incomeTo === '' || r.incomeTo === null ? null : r.incomeTo,
        rate: r.rate,
        description: r.description || undefined,
      }))
      const res = await fetch('/api/admin/hecs-thresholds', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taxYear, thresholds }) })
      if (!res.ok) {
        let msg = 'Save failed'
        try { const json = await res.json(); msg = json?.message || json?.error || msg } catch { msg = await res.text() }
        throw new Error(msg)
      }
      setMsg('Saved successfully')
      await fetchRows()
    } catch (e: any) { setErr(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="tax-admin">
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <div className="fw-semibold">HECS-HELP Thresholds</div>
          <div className="text-secondary" style={{ fontSize: 13 }}>Annual income brackets and repayment rates</div>
        </div>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <div>
            <label className="form-label m-0" style={{ fontSize: 12 }}>Tax Year</label>
            <Input value={taxYear} onChange={e => setTaxYear(e.target.value)} placeholder="e.g. 2024-25" />
          </div>
          <Button onClick={addRow} variant="secondary">Add Row</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </div>

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
      {loading && <div>Loading…</div>}

      <Card>
        <div className="p-3 d-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(140px, 1fr)) 1fr auto', gap: '0.5rem', alignItems: 'center' }}>
          <div className="text-secondary" style={{ fontSize: 12 }}>Income From</div>
          <div className="text-secondary" style={{ fontSize: 12 }}>Income To</div>
          <div className="text-secondary" style={{ fontSize: 12 }}>Rate (0–1)</div>
          <div className="text-secondary" style={{ fontSize: 12 }}>Description</div>
          <div></div>
        </div>
        {rows.map((r, idx) => (
          <div key={idx} className="px-3 pb-2 d-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(140px, 1fr)) 1fr auto', gap: '0.5rem', alignItems: 'center' }}>
            <Input type="number" min={0} step={1} value={r.incomeFrom} onChange={e => update(idx, { incomeFrom: e.target.value })} />
            <Input type="number" min={0} step={1} value={r.incomeTo ?? ''} onChange={e => update(idx, { incomeTo: e.target.value })} placeholder="null = top bracket" />
            <Input type="number" min={0} max={1} step={0.01} value={r.rate} onChange={e => update(idx, { rate: e.target.value })} />
            <Input value={r.description || ''} onChange={e => update(idx, { description: e.target.value })} />
            <div className="d-flex justify-content-end">
              <Button variant="ghost" size="sm" onClick={() => removeRow(idx)}>Delete</Button>
            </div>
          </div>
        ))}
        {rows.length === 0 && !loading && (
          <div className="p-3 text-secondary">No rows. Add one to get started.</div>
        )}
      </Card>
    </div>
  )
}
