"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { Loader } from 'lucide-react'
import { Button, Card, CardBody, CardHeader, Input } from '@/components/ui'
import { usePreferences } from '@/hooks/use-preferences'
import './settings-section.scss'

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
    return () => {
      mounted = false
    }
  }, [])

  const filtered = useMemo(
    () => items.filter((i) => i.name.toLowerCase().includes(query.toLowerCase())),
    [items, query]
  )

  const currentGuide = useMemo(
    () => items.find((i) => i.id === prefs.defaultPayGuideId),
    [items, prefs.defaultPayGuideId]
  )

  if (loading) {
    return (
      <div className="settings-section">
        <Card className="settings-section__card" variant="outlined">
          <CardBody>
            <div className="settings-section__spinner" role="status" aria-live="polite">
              <Loader size={18} />
              <span>Loading pay guides...</span>
            </div>
          </CardBody>
        </Card>
      </div>
    )
  }

  return (
    <div className="settings-section">
      <Card className="settings-section__card" variant="outlined">
        <CardHeader>
          <div className="settings-section__header">
            <div className="settings-section__heading">
              <h3 className="settings-section__title">Default pay guide</h3>
              <p className="settings-section__description">
                Choose the pay guide Chrona should use when pre-filling new shifts.
              </p>
            </div>
            {currentGuide && (
              <span className="settings-section__badge" aria-live="polite">
                Current: {currentGuide.name}
              </span>
            )}
          </div>
        </CardHeader>
        <CardBody>
          <div className="settings-section__content">
            {error && (
              <div className="settings-inline-feedback settings-inline-feedback--error" role="alert">
                {error}
              </div>
            )}

            <div className="settings-search">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search pay guides"
                aria-label="Search pay guides"
              />
            </div>

            <div className="settings-list" role="list" aria-label="Pay guides">
              {filtered.map((pg) => {
                const isSelected = prefs.defaultPayGuideId === pg.id
                return (
                  <div key={pg.id} role="listitem" className="settings-list__item">
                    <div className="settings-list__row">
                      <div className="settings-list__meta">
                        <span className="settings-list__title">{pg.name}</span>
                        <span className="settings-list__description">Base rate ${Number(pg.baseRate).toFixed(2)}/hr</span>
                      </div>
                      <div className="settings-list__actions">
                        <Button
                          variant={isSelected ? 'secondary' : 'primary'}
                          size="sm"
                          onClick={() => update({ defaultPayGuideId: pg.id })}
                        >
                          {isSelected ? 'Selected' : 'Set default'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}

              {filtered.length === 0 && (
                <div className="settings-list__empty">No pay guides match that search.</div>
              )}
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
