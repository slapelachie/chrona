'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardBody, CardHeader, Button, Input } from '../ui'
import { Calendar, DollarSign, Loader2, RefreshCcw } from 'lucide-react'
import { PayPeriodListItem, PayPeriodsListResponse } from '@/types'
import { StatusBadge, statusAccentColor } from './status-badge'
import { formatPayPeriodDate } from '@/lib/date-utils'
import { formatCurrencyValue } from '../utils/format'

type StatusFilter = 'all' | 'pending' | 'verified'

export const PayPeriodsList: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<PayPeriodListItem[]>([])
  const [status, setStatus] = useState<StatusFilter>('all')
  const [query, setQuery] = useState('')

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams()
      params.set('limit', '20')
      if (status !== 'all') params.set('status', status)
      const res = await fetch(`/api/pay-periods?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch pay periods')
      const json = await res.json()
      const data = (json.data as PayPeriodsListResponse).payPeriods
      setItems(data)
    } catch (e: any) {
      setError(e.message || 'Error loading pay periods')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const filtered = useMemo(() => {
    if (!query) return items
    const q = query.toLowerCase()
    return items.filter(pp => {
      const range = `${formatPayPeriodDate(pp.startDate)} - ${formatPayPeriodDate(pp.endDate)}`
      return range.toLowerCase().includes(q) || (pp.totalPay || '').toString().includes(q)
    })
  }, [items, query])

  // Removed local chip map in favor of shared StatusBadge

  return (
    <div className="mobile-container" style={{ display: 'grid', gap: '1rem' }}>
      <Card variant="outlined">
        <CardHeader>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <DollarSign size={18} style={{ color: 'var(--color-primary)' }} />
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Pay Periods</h3>
          </div>
        </CardHeader>
        <CardBody>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: '1 1 180px' }}>
              <Input
                placeholder="Search by date range or amount"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              {(['all','pending','verified'] as StatusFilter[]).map(s => (
                <Button
                  key={s}
                  size="sm"
                  variant={status === s ? 'primary' : 'ghost'}
                  onClick={() => setStatus(s)}
                >
                  {s[0].toUpperCase()+s.slice(1)}
                </Button>
              ))}
              <Button size="sm" variant="ghost" onClick={fetchData} leftIcon={<RefreshCcw size={16} />}>Refresh</Button>
            </div>
          </div>

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
              <Loader2 size={18} className="loading-pulse" /> Loading pay periods...
            </div>
          )}
          {error && (
            <div style={{ color: 'var(--color-danger)', marginTop: '1rem' }}>{error}</div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div style={{ marginTop: '1rem', color: 'var(--color-text-secondary)' }}>No pay periods found.</div>
          )}

          <div style={{ marginTop: '1rem', display: 'grid', gap: '0.75rem' }}>
            {filtered.map(pp => (
              <Link key={pp.id} href={`/pay-periods/${pp.id}`} style={{ textDecoration: 'none' }}>
                <div
                  style={{
                    position: 'relative',
                    border: '1px solid var(--color-border-primary)',
                    background: 'var(--color-bg-secondary)',
                    borderRadius: 12,
                    padding: '0.875rem 0.875rem 0.875rem 0.75rem',
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: '0.5rem',
                    // left status accent
                    boxShadow: `inset 4px 0 0 0 ${statusAccentColor(pp.status as Exclude<StatusFilter,'all'>)}`
                  }}
                >
                  {/* Ribbon */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                    }}
                  >
                    <StatusBadge status={pp.status as Exclude<StatusFilter,'all'>} size="sm" />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Calendar size={16} style={{ color: 'var(--color-text-tertiary)' }} />
                      <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                        {formatPayPeriodDate(pp.startDate)} - {formatPayPeriodDate(pp.endDate)}
                      </span>
                    </div>
                    <div style={{ marginTop: 4, display: 'flex', gap: '0.75rem', alignItems: 'baseline' }}>
                      <div style={{ color: 'var(--color-text-primary)', fontWeight: 700, fontSize: '1.125rem' }}>
                        ${formatCurrencyValue(pp.actualPay || pp.netPay || pp.totalPay, { fallback: '-' })}
                      </div>
                      {typeof pp.shiftsCount === 'number' && (
                        <span style={{ color: 'var(--color-text-tertiary)', fontSize: '0.8rem' }}>
                          {pp.shiftsCount} shift{pp.shiftsCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <div />
                </div>
              </Link>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
