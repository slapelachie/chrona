"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { Button, Card, Input, Alert } from '@/components/ui'
import { ChevronDown, ChevronRight, ChevronUp } from 'lucide-react'
import './tax-admin.scss'

type Rate = {
  id?: string
  scale: 'WITH_TFT_OR_FR' | 'NO_TFT'
  earningsFrom: string
  earningsTo: string | null
  coefficientA: string
  coefficientB: string
  description?: string | null
}

const SCALES: Array<{ key: Rate['scale']; label: string; desc: string }> = [
  { key: 'WITH_TFT_OR_FR', label: 'With Tax‑Free Threshold or Foreign Resident', desc: 'Applies if you claimed the tax‑free threshold for this payer or are a foreign resident.' },
  { key: 'NO_TFT', label: 'No Tax‑Free Threshold', desc: 'Applies if you did not claim the tax‑free threshold for this payer.' },
]

import { getCurrentAuTaxYearString } from '@/lib/tax-year'

export const StslEditor: React.FC<{ initialTaxYear?: string }> = ({ initialTaxYear = getCurrentAuTaxYearString() }) => {
  const [taxYear, setTaxYear] = useState(initialTaxYear)
  const [rows, setRows] = useState<Rate[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => ({ WITH_TFT_OR_FR: true, NO_TFT: true }))

  const fetchRows = async () => {
    setLoading(true); setErr(null); setMsg(null)
    try {
      const q = new URLSearchParams({ taxYear })
      const res = await fetch(`/api/admin/stsl-rates?${q.toString()}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to load STSL rates')
      // API already serves formula-only A/B rows; no mode property is present.
      const data = (json.data || [])
      setRows(data as Rate[])
    } catch (e: any) { setErr(e.message) } finally { setLoading(false) }
  }

  useEffect(() => { fetchRows() }, [taxYear])

  const grouped = useMemo(() => {
    return {
      WITH_TFT_OR_FR: rows.filter(r => r.scale === 'WITH_TFT_OR_FR'),
      NO_TFT: rows.filter(r => r.scale === 'NO_TFT'),
    }
  }, [rows])

  const addRow = (scale: Rate['scale']) => setRows(prev => ([...prev, { scale, earningsFrom: '0', earningsTo: '0', coefficientA: '0', coefficientB: '0', description: '' }]))
  const removeRow = (idx: number) => setRows(prev => prev.filter((_, i) => i !== idx))
  const update = (idx: number, patch: Partial<Rate>) => setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r))

  const [violations, setViolations] = useState<Record<string, string | null>>({})
  const recomputeValidation = (draft: Rate[] = rows) => {
    const v: Record<string, string | null> = {}
    for (const s of ['WITH_TFT_OR_FR','NO_TFT'] as const) {
      const list = draft.filter(r => r.scale === s)
      const ths = list.filter(r => r.earningsTo !== null && r.earningsTo !== '').map(r => Number(r.earningsTo))
      if (ths.some(isNaN)) { v[s] = 'All "Less than" values must be numbers'; continue }
      if (ths.length > 0 && ths[0] <= 0) { v[s] = 'First "Less than" must be greater than 0'; continue }
      const sorted = [...ths].sort((a,b) => a-b)
      let ok = true
      for (let i=1;i<sorted.length;i++){ if (sorted[i] <= sorted[i-1]) { ok = false; break } }
      v[s] = ok ? null : 'Thresholds must strictly increase'
    }
    setViolations(v)
    return v
  }
  useEffect(() => { recomputeValidation() }, [rows])

  const save = async () => {
    setSaving(true); setErr(null); setMsg(null)
    try {
      const v = recomputeValidation()
      if (Object.values(v).some(Boolean)) throw new Error('Fix validation errors before saving')

      // Derive contiguous brackets from Less-than entries; last row = Otherwise
      const finalRows: Rate[] = []
      for (const s of ['WITH_TFT_OR_FR','NO_TFT'] as const) {
        const list = rows.filter(r => r.scale === s)
        const nonLast = list.filter(r => r.earningsTo !== null && r.earningsTo !== '')
        const top = list.find(r => r.earningsTo === null || r.earningsTo === '')
        const sorted = [...nonLast].sort((a,b) => Number(a.earningsTo) - Number(b.earningsTo))
        let from = 0
        for (const r of sorted) {
          finalRows.push({ scale: s, earningsFrom: String(from), earningsTo: String(r.earningsTo!), coefficientA: r.coefficientA, coefficientB: r.coefficientB, description: r.description || '' })
          from = Number(r.earningsTo)
        }
        const last = top || { scale: s, earningsFrom: String(from), earningsTo: null, coefficientA: '0', coefficientB: '0', description: '' }
        finalRows.push({ scale: s, earningsFrom: String(from), earningsTo: null, coefficientA: last.coefficientA, coefficientB: last.coefficientB, description: last.description || '' })
      }

      const rates = finalRows.map(r => ({
        scale: r.scale,
        earningsFrom: r.earningsFrom,
        earningsTo: r.earningsTo,
        coefficientA: r.coefficientA,
        coefficientB: r.coefficientB,
        description: r.description || undefined,
      }))
      const res = await fetch('/api/admin/stsl-rates', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taxYear, rates }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.message || json?.error || 'Failed to save')
      setMsg(json.message || 'Saved successfully')
      await fetchRows()
    } catch (e: any) { setErr(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="tax-admin">
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <div className="fw-semibold">STSL Component (Schedule 8)</div>
          <div className="text-secondary" style={{ fontSize: 13 }}>Weekly component rates by earnings, applied per pay period</div>
        </div>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <div>
            <label className="form-label m-0" style={{ fontSize: 12 }}>Tax Year</label>
            <Input value={taxYear} onChange={e => setTaxYear(e.target.value)} placeholder="e.g. 2024-25" />
          </div>
          {/* Formula-only UI */}
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

      {SCALES.map(({ key, label, desc }) => {
        const list = grouped[key]
        const open = expanded[key]
        return (
          <Card key={key}>
            <div className="tax-admin__section-header">
              <div className="d-flex align-items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="tax-admin__collapse"
                  onClick={() => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))}
                  aria-expanded={open}
                >
                  {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </Button>
                <div className="tax-admin__title">
                  <span>{label}</span>
                  <span className="tax-admin__chip">{list.length} bracket{list.length === 1 ? '' : 's'}</span>
                </div>
              </div>
              <div className="d-flex align-items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => addRow(key)}>Add Row</Button>
              </div>
            </div>
            {open && (
              <div className="px-3 pb-3 d-flex flex-column gap-2">
                <div className="tax-admin__desc">{desc}</div>
                <div className="tax-admin__grid-head">
                  <div>Less than</div>
                  <div>A</div>
                  <div>B</div>
                  <div>Description</div>
                  <div className="text-secondary" style={{ textAlign: 'right' }}>Reorder</div>
                </div>
                {list.map((r) => {
                  const idx = rows.indexOf(r)
                  return (
                    <div key={idx} className="tax-admin__grid-row">
                      {r.earningsTo === null || r.earningsTo === '' ? (
                        <div className="text-secondary">Otherwise</div>
                      ) : (
                        <Input type="number" min={0} step={1} value={r.earningsTo ?? ''} onChange={e => update(idx, { earningsTo: e.target.value })} />
                      )}
                      <Input type="number" min={0} step={0.0001} value={r.coefficientA} onChange={e => update(idx, { coefficientA: e.target.value })} />
                      <Input type="number" min={0} step={0.0001} value={r.coefficientB} onChange={e => update(idx, { coefficientB: e.target.value })} />
                      <Input value={r.description || ''} onChange={e => update(idx, { description: e.target.value })} />
                      <div className="d-flex justify-content-end gap-1">
                        {r.earningsTo !== null && r.earningsTo !== '' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              aria-label="Move bracket up"
                              onClick={() => {
                                const idxs = rows
                                  .map((rr, i) => ({ rr, i }))
                                  .filter(x => x.rr.scale === key && x.rr.earningsTo !== null && x.rr.earningsTo !== '')
                                  .map(x => x.i)
                                const pos = idxs.indexOf(idx)
                                if (pos > 0) setRows(prev => { const copy = [...prev]; const a = idxs[pos-1], b = idxs[pos]; const t = copy[a]; copy[a] = copy[b]; copy[b] = t; return copy })
                            }}
                            >
                              <ChevronUp size={16} />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              aria-label="Move bracket down"
                              onClick={() => {
                                const idxs = rows
                                  .map((rr, i) => ({ rr, i }))
                                  .filter(x => x.rr.scale === key && x.rr.earningsTo !== null && x.rr.earningsTo !== '')
                                  .map(x => x.i)
                                const pos = idxs.indexOf(idx)
                                if (pos < idxs.length - 1) setRows(prev => { const copy = [...prev]; const a = idxs[pos], b = idxs[pos+1]; const t = copy[a]; copy[a] = copy[b]; copy[b] = t; return copy })
                            }}
                            >
                              <ChevronDown size={16} />
                            </Button>
                          </>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => removeRow(idx)}>Delete</Button>
                      </div>
                    </div>
                  )
                })}
                {violations[key] && (
                  <div className="tax-admin__validation">{violations[key]}</div>
                )}
                <div className="d-flex justify-content-end gap-2">
                  <Button variant="secondary" size="sm" onClick={() => {
                    setRows(prev => {
                      const before = prev.filter(r => r.scale !== key)
                      const nonLast = prev.filter(r => r.scale === key && r.earningsTo !== null && r.earningsTo !== '')
                      const last = prev.find(r => r.scale === key && (r.earningsTo === null || r.earningsTo === ''))
                      nonLast.sort((a,b) => Number(a.earningsTo) - Number(b.earningsTo))
                      return [...before, ...nonLast, ...(last ? [last] : [])]
                    })
                  }}>Sort ascending</Button>
                </div>
                {list.length === 0 && (
                  <div className="text-secondary px-1">No brackets in this group. Add one to get started.</div>
                )}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}
