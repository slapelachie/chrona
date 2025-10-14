"use client"

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button, Card, Input } from '@/components/ui'
import { PayGuideListItem, PayGuidesListResponse } from '@/types'

export const PayGuidesList: React.FC = () => {
  const router = useRouter()
  const [items, setItems] = useState<PayGuideListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeOnly, setActiveOnly] = useState(true)
  const [query, setQuery] = useState('')

  const fetchGuides = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('limit', '100')
      if (activeOnly) params.set('active', 'true')
      const res = await fetch(`/api/pay-rates?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to load pay guides')
      const data = json.data as PayGuidesListResponse
      setItems(data.payGuides)
    } catch (e: any) {
      setError(e.message)
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchGuides() }, [activeOnly])

  const filtered = useMemo(() => items.filter(i => i.name.toLowerCase().includes(query.toLowerCase())), [items, query])

  const toggleActive = async (id: string, isActive: boolean) => {
    const res = await fetch(`/api/pay-rates/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !isActive }) })
    if (res.ok) fetchGuides()
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this pay guide? This may fail if it is in use by shifts.')) return
    const res = await fetch(`/api/pay-rates/${id}`, { method: 'DELETE' })
    if (res.ok) fetchGuides()
    else {
      const json = await res.json()
      alert(json?.error || json?.message || 'Delete failed')
    }
  }

  const duplicate = async (id: string) => {
    try {
      const res = await fetch(`/api/pay-rates/${id}/duplicate`, { method: 'POST' })
      const json = await res.json().catch(() => null)

      if (!res.ok) {
        alert(json?.error || json?.message || 'Failed to duplicate pay guide')
        return
      }

      fetchGuides()

      const newId = json?.data?.id
      if (newId) {
        router.push(`/pay-guides/${newId}/edit?source=${id}`)
      }
    } catch (error) {
      console.error('Failed to duplicate pay guide:', error)
      alert('Failed to duplicate pay guide. Please try again.')
    }
  }

  return (
    <div className="d-flex flex-column gap-3">
      <div className="d-flex gap-2 align-items-center flex-wrap">
        <Input placeholder="Search pay guides…" value={query} onChange={e => setQuery(e.target.value)} />
        <div className="form-check form-switch">
          <input className="form-check-input" type="checkbox" id="pg-active-only" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} />
          <label className="form-check-label" htmlFor="pg-active-only">Active only</label>
        </div>
        <Link href="/pay-guides/new" className="btn btn-primary">Add Pay Guide</Link>
      </div>

      {loading && <div>Loading…</div>}
      {error && <div role="alert" style={{ color: '#F44336' }}>{error}</div>}

      {!loading && filtered.length === 0 && (
        <Card>
          <div className="p-3 text-secondary">No pay guides found.</div>
        </Card>
      )}

      <div className="d-flex flex-column gap-2">
        {filtered.map(pg => (
          <Card key={pg.id}>
            <div className="p-3 d-flex align-items-center justify-content-between gap-2">
              <div>
                <div className="fw-semibold">{pg.name}</div>
                <div className="text-secondary" style={{ fontSize: 13 }}>
                  ${Number(pg.baseRate).toFixed(2)} / hr · Effective {new Date(pg.effectiveFrom).toLocaleDateString('en-AU')}
                  {pg.effectiveTo ? ` – ${new Date(pg.effectiveTo).toLocaleDateString('en-AU')}` : ''}
                </div>
              </div>
              <div className="d-flex gap-2 flex-wrap">
                <Link href={`/pay-guides/${pg.id}/edit`} className="btn btn-secondary btn-sm">Edit</Link>
                <Button size="sm" variant="outline" onClick={() => toggleActive(pg.id, pg.isActive)}>
                  {pg.isActive ? 'Deactivate' : 'Activate'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => duplicate(pg.id)}>
                  Duplicate
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(pg.id)}>Delete</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
