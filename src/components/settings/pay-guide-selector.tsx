"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { Button, Card, Input } from '@/components/ui'
import { usePreferences } from '@/hooks/use-preferences'

type PayGuide = { id: string; name: string; baseRate: string }

export const PayGuideSelector: React.FC = () => {
  const { prefs, update } = usePreferences()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<PayGuide[]>([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('/api/pay-rates?active=true&limit=100&fields=id,name,baseRate')
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || 'Failed to load pay guides')
        const list: PayGuide[] = json.data.payGuides
        if (mounted) setItems(list)
      } catch (e: any) {
        if (mounted) setError(e.message)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  const filtered = useMemo(() =>
    items.filter(i => i.name.toLowerCase().includes(query.toLowerCase())),
    [items, query]
  )

  if (loading) return <div>Loading…</div>
  if (error) return <div role="alert" style={{ color: '#F44336' }}>{error}</div>

  return (
    <Card>
      <div className="mb-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <div className="fw-semibold">Default Pay Guide</div>
          <div className="text-secondary" style={{ fontSize: 13 }}>Used to prefill new shifts</div>
        </div>
        {prefs.defaultPayGuideId && (
          <span className="badge bg-info">Current: {items.find(i => i.id === prefs.defaultPayGuideId)?.name || 'Unknown'}</span>
        )}
      </div>
      <div className="mb-3">
        <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search pay guides…" />
      </div>
      <div className="d-flex flex-column gap-2" role="list" aria-label="Pay guides">
        {filtered.map(pg => (
          <div key={pg.id} role="listitem" className="d-flex align-items-center justify-content-between p-2 rounded" style={{ background: '#121212', border: '1px solid #333' }}>
            <div>
              <div className="fw-semibold">{pg.name}</div>
              <div className="text-secondary" style={{ fontSize: 13 }}>Base rate: ${Number(pg.baseRate).toFixed(2)}/hr</div>
            </div>
            <div className="d-flex gap-2">
              <Button
                variant={prefs.defaultPayGuideId === pg.id ? 'secondary' : 'primary'}
                onClick={() => update({ defaultPayGuideId: pg.id })}
              >
                {prefs.defaultPayGuideId === pg.id ? 'Selected' : 'Set Default'}
              </Button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-secondary">No pay guides match that search.</div>
        )}
      </div>
    </Card>
  )
}

