"use client"

import React, { useState } from 'react'
import { Button, Card } from '@/components/ui'
import { usePreferences } from '@/hooks/use-preferences'

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error || `Failed: ${url}`)
  return json.data as T
}

export const DataManagement: React.FC = () => {
  const { reset } = usePreferences()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [newType, setNewType] = useState<'WEEKLY'|'FORTNIGHTLY'|'MONTHLY'>('WEEKLY')

  const exportAll = async () => {
    setBusy(true); setErr(null); setMsg(null)
    try {
      const [user, payPeriods, shifts, payGuides, taxSettings] = await Promise.all([
        fetchJson('/api/user'),
        fetchJson('/api/pay-periods?limit=100&include=shifts'),
        fetchJson('/api/shifts?limit=200'),
        fetchJson('/api/pay-rates?limit=200'),
        fetchJson('/api/tax-settings'),
      ])

      const blob = new Blob([JSON.stringify({ user, payPeriods, shifts, payGuides, taxSettings }, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `chrona-export-${new Date().toISOString().slice(0,10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setMsg('Exported successfully')
    } catch (e: any) {
      setErr(e.message)
    } finally { setBusy(false) }
  }

  const importPrefs = async (file: File) => {
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      // Only restore known local preferences
      const prefs = json?.preferences || json?.prefs
      if (prefs && typeof window !== 'undefined') {
        localStorage.setItem('chrona:prefs', JSON.stringify(prefs))
        setMsg('Preferences imported')
      } else {
        setErr('No preferences found in file')
      }
    } catch (e: any) {
      setErr(e.message)
    }
  }

  return (
    <Card>
      <div className="d-flex flex-column gap-3">
        {err && <div role="alert" style={{ color: '#F44336' }}>{err}</div>}
        {msg && <div aria-live="polite" style={{ color: '#00E5FF' }}>{msg}</div>}

        <div className="d-flex gap-2 flex-wrap">
          <Button onClick={exportAll} disabled={busy}>{busy ? 'Exporting…' : 'Export JSON Snapshot'}</Button>
          <label className="btn btn-outline-secondary" style={{ cursor: 'pointer' }}>
            Import Preferences
            <input type="file" accept="application/json" onChange={(e) => e.target.files && e.target.files[0] && importPrefs(e.target.files[0])} style={{ display: 'none' }} />
          </label>
          <Button variant="secondary" onClick={() => { reset(); setMsg('Local preferences cleared') }}>Clear Local Preferences</Button>
        </div>
        <div className="text-secondary" style={{ fontSize: 13 }}>
          Export includes user, shifts, pay periods, pay guides and tax settings. Import restores only local preferences.
        </div>

        <hr style={{ borderColor: '#333' }} />

        <div>
          <div className="fw-semibold mb-2">Transform Pay Periods</div>
          <div className="text-secondary mb-2" style={{ fontSize: 13 }}>
            Change between weekly, fortnightly, and monthly. Existing shifts will be reassigned to new periods and totals recalculated.
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <select className="form-select" value={newType} onChange={e => setNewType(e.target.value as any)}>
              <option value="WEEKLY">Weekly</option>
              <option value="FORTNIGHTLY">Fortnightly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
            <Button
              variant="primary"
              disabled={busy}
              onClick={async () => {
                if (!confirm(`Transform all pay periods to ${newType}? This will recalculate and may take a moment.`)) return
                setBusy(true); setErr(null); setMsg(null)
                try {
                  const res = await fetch('/api/pay-periods/transform', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newPayPeriodType: newType, cleanup: true })
                  })
                  const json = await res.json()
                  if (!res.ok) throw new Error(json?.error || json?.message || 'Failed to transform')
                  setMsg(`Transformed: moved ${json.data.movedShifts} shifts; affected ${json.data.affectedPayPeriods} periods; removed ${json.data.removedEmptyPayPeriods} empty.`)
                } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
              }}
            >
              {busy ? 'Transforming…' : 'Transform'}
            </Button>
          </div>
          <div className="text-warning mt-2" style={{ color: '#FFC107', fontSize: 13 }}>
            Tip: Export a backup before transforming.
          </div>
        </div>
      </div>
    </Card>
  )
}
