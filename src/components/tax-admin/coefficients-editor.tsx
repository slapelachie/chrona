"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { Button, Card, Input } from '@/components/ui'
import './tax-admin.scss'

type Coeff = {
  id?: string
  scale: string
  earningsFrom: string
  earningsTo: string | null
  coefficientA: string
  coefficientB: string
  description?: string | null
}

interface Props {
  initialTaxYear?: string
}

const SCALES = ['scale1','scale2','scale3','scale4','scale5','scale6']

function ScalePicker({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {SCALES.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          className="btn btn-sm"
          style={{
            padding: '4px 8px',
            borderRadius: 999,
            border: '1px solid var(--color-border)',
            background: value === s ? 'rgba(0,229,255,0.15)' : 'transparent',
            color: value === s ? 'var(--color-primary)' : 'var(--color-text-secondary)',
          }}
          aria-pressed={value === s}
        >
          {s.replace('scale','Scale ')}
        </button>
      ))}
    </div>
  )
}

export const CoefficientsEditor: React.FC<Props> = ({ initialTaxYear = '2024-25' }) => {
  const [taxYear, setTaxYear] = useState(initialTaxYear)
  const [rows, setRows] = useState<Coeff[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => Object.fromEntries(SCALES.map(s => [s, true])) as Record<string, boolean>)
  const [currentScale, setCurrentScale] = useState<string>('')

  const fetchRows = async () => {
    setLoading(true); setErr(null); setMsg(null)
    try {
      const q = new URLSearchParams({ taxYear })
      const res = await fetch(`/api/admin/tax-coefficients?${q.toString()}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to load coefficients')
      setRows(json.data as Coeff[])
    } catch (e: any) { setErr(e.message) } finally { setLoading(false) }
  }

  useEffect(() => { fetchRows() }, [taxYear])

  const grouped = useMemo(() => {
    const map = Object.fromEntries(SCALES.map(s => [s, [] as Coeff[]])) as Record<string, Coeff[]>
    for (const r of rows) {
      if (SCALES.includes(r.scale)) map[r.scale].push(r)
    }
    return map
  }, [rows])

  const addRow = (scale: string) => setRows(prev => ([
    ...prev,
    // Start a new threshold row with a visible input for "Less than"
    { scale, earningsFrom: '0', earningsTo: '0', coefficientA: '0', coefficientB: '0', description: '' }
  ]))

  const removeRow = (idx: number) => setRows(prev => prev.filter((_, i) => i !== idx))

  const update = (idx: number, patch: Partial<Coeff>) => setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r))

  const [violations, setViolations] = useState<Record<string, string | null>>({})

  const recomputeValidation = (draft: Coeff[] = rows) => {
    const v: Record<string, string | null> = {}
    for (const s of SCALES) {
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
      // Validate first
      const v = recomputeValidation()
      if (Object.values(v).some(m => !!m)) throw new Error('Fix validation errors before saving')

      // Derive contiguous from/to from "Less than" thresholds per scale
      const finalRows: Coeff[] = []
      for (const s of SCALES) {
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

      const coefficients = finalRows.map(r => ({
        scale: r.scale,
        earningsFrom: r.earningsFrom,
        earningsTo: r.earningsTo,
        coefficientA: r.coefficientA,
        coefficientB: r.coefficientB,
        description: r.description || undefined,
      }))
      const res = await fetch('/api/admin/tax-coefficients', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taxYear, coefficients }) })
      let ok = res.ok
      let msg = 'Saved successfully'
      if (!ok) {
        try { const json = await res.json(); msg = json?.message || json?.error || msg } catch { msg = await res.text() }
        throw new Error(msg)
      }
      setMsg(msg)
      await fetchRows()
    } catch (e: any) { setErr(e.message) } finally { setSaving(false) }
  }

  // Derive user's current tax scale to highlight the relevant section
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/tax-settings', { cache: 'no-store' })
        const json = await res.json()
        if (!res.ok) return
        const ts = json.data || {}
        const scale = determineTaxScale(ts)
        setCurrentScale(scale)
      } catch {
        // ignore
      }
    })()
  }, [])

  const SCALE_DESCRIPTIONS: Record<string, string> = {
    scale1: 'Residents who did not claim the tax‑free threshold for this payer.',
    scale2: 'Residents who claimed the tax‑free threshold for this payer (default for most).',
    scale3: 'Foreign residents (no tax‑free threshold, different rates).',
    scale4: 'No Tax File Number provided (higher withholding until TFN supplied).',
    scale5: 'Residents with a full Medicare levy exemption.',
    scale6: 'Residents with a half Medicare levy exemption.',
  }

  function determineTaxScale(taxSettings: any): string {
    if (!taxSettings) return 'scale2'
    if (!taxSettings.hasTaxFileNumber) return 'scale4'
    if (taxSettings.isForeignResident) return 'scale3'
    if (taxSettings.medicareExemption === 'full') return 'scale5'
    if (taxSettings.medicareExemption === 'half') return 'scale6'
    if (taxSettings.claimedTaxFreeThreshold) return 'scale2'
    return 'scale1'
  }

  return (
    <div className="tax-admin">
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <div className="fw-semibold">PAYG Tax Coefficients</div>
          <div className="text-secondary" style={{ fontSize: 13 }}>ATO Schedule 1 scales and earnings brackets</div>
        </div>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <div>
            <label className="form-label m-0" style={{ fontSize: 12 }}>Tax Year</label>
            <Input value={taxYear} onChange={e => setTaxYear(e.target.value)} placeholder="e.g. 2024-25" />
          </div>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </div>

      {err && <div role="alert" style={{ color: '#F44336' }}>{err}</div>}
      {msg && <div aria-live="polite" style={{ color: '#00E5FF' }}>{msg}</div>}
      {loading && <div>Loading…</div>}

      {SCALES.map((scale) => {
        const list = grouped[scale]
        const open = expanded[scale]
        return (
          <Card key={scale}>
            <div className="tax-admin__section-header">
              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setExpanded(prev => ({ ...prev, [scale]: !prev[scale] }))}
                  aria-expanded={open}
                >
                  {open ? '▾' : '▸'}
                </button>
                <div className="tax-admin__title" style={{ color: currentScale === scale ? 'var(--color-primary)' : 'var(--color-text-primary)' }}>
                  <span>{scale.replace('scale','Scale ')}</span>
                  <span className="tax-admin__chip">{list.length} bracket{list.length === 1 ? '' : 's'}</span>
                  {currentScale === scale && (
                    <span className="tax-admin__badge">Your current scale</span>
                  )}
                </div>
              </div>
              <div className="d-flex align-items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => addRow(scale)}>Add Row</Button>
              </div>
            </div>
            {open && (
              <div className="px-3 pb-3 d-flex flex-column gap-2">
                <div className="tax-admin__desc">{SCALE_DESCRIPTIONS[scale]}</div>
                <div className="tax-admin__grid-head">
                  <div>Less than</div>
                  <div>A</div>
                  <div>B</div>
                  <div>Description</div>
                  <div className="text-secondary" style={{ textAlign: 'right' }}>Reorder</div>
                </div>
                {list.map((r, localIdx) => {
                  // compute global index for update/remove operations
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
                            <Button variant="outline" size="sm" onClick={() => {
                              const idxs = rows
                                .map((rr, i) => ({ rr, i }))
                                .filter(x => x.rr.scale === scale && x.rr.earningsTo !== null && x.rr.earningsTo !== '')
                                .map(x => x.i)
                              const pos = idxs.indexOf(idx)
                              if (pos > 0) setRows(prev => { const copy = [...prev]; const a = idxs[pos-1], b = idxs[pos]; const t = copy[a]; copy[a] = copy[b]; copy[b] = t; return copy })
                            }}>↑</Button>
                            <Button variant="outline" size="sm" onClick={() => {
                              const idxs = rows
                                .map((rr, i) => ({ rr, i }))
                                .filter(x => x.rr.scale === scale && x.rr.earningsTo !== null && x.rr.earningsTo !== '')
                                .map(x => x.i)
                              const pos = idxs.indexOf(idx)
                              if (pos < idxs.length - 1) setRows(prev => { const copy = [...prev]; const a = idxs[pos], b = idxs[pos+1]; const t = copy[a]; copy[a] = copy[b]; copy[b] = t; return copy })
                            }}>↓</Button>
                          </>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => removeRow(idx)}>Delete</Button>
                      </div>
                    </div>
                  )
                })}
                {violations[scale] && (
                  <div className="text-warning" style={{ color: '#FFC107' }}>{violations[scale]}</div>
                )}
                <div className="d-flex justify-content-end gap-2">
                  <Button variant="secondary" size="sm" onClick={() => {
                    setRows(prev => {
                      const before = prev.filter(r => r.scale !== scale)
                      const nonLast = prev.filter(r => r.scale === scale && r.earningsTo !== null && r.earningsTo !== '')
                      const last = prev.find(r => r.scale === scale && (r.earningsTo === null || r.earningsTo === ''))
                      nonLast.sort((a,b) => Number(a.earningsTo) - Number(b.earningsTo))
                      return [...before, ...nonLast, ...(last ? [last] : [])]
                    })
                  }}>Sort ascending</Button>
                </div>
                {list.length === 0 && (
                  <div className="text-secondary px-1">No brackets in this scale. Add one to get started.</div>
                )}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}
