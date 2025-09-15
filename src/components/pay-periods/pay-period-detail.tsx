'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardBody, CardHeader, Button, Input } from '../ui'
import { DollarSign, FileDown, Loader2, Play, ShieldCheck, TriangleAlert } from 'lucide-react'
import {
  PayPeriodResponse,
  TaxCalculationResponse,
  ShiftResponse,
} from '@/types'

interface Props { payPeriodId: string }

type TaxState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; data: TaxCalculationResponse['taxCalculation'] }
  | { status: 'error'; error: string }

export const PayPeriodDetail: React.FC<Props> = ({ payPeriodId }) => {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pp, setPp] = useState<PayPeriodResponse | null>(null)
  const [tax, setTax] = useState<TaxState>({ status: 'idle' })
  const [actualPay, setActualPay] = useState('')
  const [verifyBusy, setVerifyBusy] = useState(false)

  const fetchPayPeriod = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/pay-periods/${payPeriodId}`)
      if (!res.ok) throw new Error('Failed to fetch pay period')
      const json = await res.json()
      setPp(json.data as PayPeriodResponse)
      setActualPay((json.data as PayPeriodResponse).actualPay || '')
    } catch (e: any) {
      setError(e.message || 'Error loading pay period')
    } finally {
      setLoading(false)
    }
  }

  const fetchTax = async () => {
    try {
      setTax({ status: 'loading' })
      const res = await fetch(`/api/pay-periods/${payPeriodId}/tax-calculation`)
      if (res.status === 404) {
        setTax({ status: 'error', error: 'No tax calculation found yet.' })
        return
      }
      if (!res.ok) throw new Error('Failed to fetch tax calculation')
      const json = await res.json()
      setTax({ status: 'ready', data: json.data.taxCalculation })
    } catch (e: any) {
      setTax({ status: 'error', error: e.message || 'Error loading tax calculation' })
    }
  }

  const processPayPeriod = async () => {
    try {
      setVerifyBusy(true)
      const res = await fetch(`/api/pay-periods/${payPeriodId}/process`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to process pay period')
      await fetchPayPeriod()
      await fetchTax()
    } catch (e) {
      alert('Processing failed. Please try again.')
    } finally {
      setVerifyBusy(false)
    }
  }

  const runTaxOnly = async () => {
    try {
      setVerifyBusy(true)
      const res = await fetch(`/api/pay-periods/${payPeriodId}/tax-calculation`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to calculate taxes')
      await fetchTax()
    } catch (e) {
      alert('Tax calculation failed.')
    } finally {
      setVerifyBusy(false)
    }
  }

  const saveVerification = async (markVerified: boolean) => {
    try {
      setVerifyBusy(true)
      const payload: any = { }
      if (actualPay) payload.actualPay = actualPay
      if (markVerified) payload.verified = true
      const res = await fetch(`/api/pay-periods/${payPeriodId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) throw new Error('Failed to save verification')
      await fetchPayPeriod()
    } catch (e) {
      alert('Failed to save verification.')
    } finally {
      setVerifyBusy(false)
    }
  }

  const exportJSON = async () => {
    const res = await fetch(`/api/pay-periods/${payPeriodId}?include=shifts`)
    if (!res.ok) return alert('Export failed')
    const json = await res.json()
    const blob = new Blob([JSON.stringify(json.data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pay-period-${payPeriodId}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportCSV = async () => {
    const res = await fetch(`/api/pay-periods/${payPeriodId}?include=shifts`)
    if (!res.ok) return alert('Export failed')
    const json = await res.json()
    const data = json.data as PayPeriodResponse
    const shifts = (data.shifts || []) as ShiftResponse[]
    const header = ['Shift ID','Start','End','Total Hours','Total Pay']
    const rows = shifts.map(s => [
      s.id,
      new Date(s.startTime).toISOString(),
      new Date(s.endTime).toISOString(),
      s.totalHours || '',
      s.totalPay || ''
    ])
    const csv = [header, ...rows].map(r => r.map(v => `"${(v ?? '').toString().replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pay-period-${payPeriodId}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  useEffect(() => {
    fetchPayPeriod()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payPeriodId])

  useEffect(() => {
    fetchTax()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payPeriodId])

  const formatCurrency = (amount?: string) => {
    if (!amount) return '-'
    const n = Number(amount)
    return n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const variance = useMemo(() => {
    if (!pp?.netPay || !actualPay) return null
    const diff = Number(actualPay) - Number(pp.netPay)
    return diff
  }, [pp?.netPay, actualPay])

  return (
    <div className="mobile-container" style={{ display: 'grid', gap: '1rem' }}>
      {pp && new Date(pp.endDate) < new Date('2025-09-24') && (
        <div style={{
          padding: '0.75rem',
          border: '1px solid var(--color-warning, #FFC107)',
          borderRadius: 6,
          background: 'rgba(255,193,7,0.1)',
          color: 'var(--color-text-primary)'
        }}>
          Heads up: STSL (HECS/HELP) amounts for pay periods ending before 24 Sep 2025 may differ from ATO tables. This app applies Schedule 8 formulas without legacy thresholds.
        </div>
      )}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Loader2 size={18} className="loading-pulse" /> Loading pay period...
        </div>
      )}
      {error && (
        <div style={{ color: 'var(--color-danger)' }}>{error}</div>
      )}

      {pp && (
        <>
          {/* Overview */}
          <Card variant="outlined">
            <CardHeader>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <DollarSign size={18} style={{ color: 'var(--color-primary)' }} />
                <h3 style={{ margin: 0, fontSize: '1rem' }}>Overview</h3>
              </div>
            </CardHeader>
            <CardBody>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
                <div>
                  <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Date Range</div>
                  <div style={{ fontWeight: 600 }}>
                    {new Date(pp.startDate).toLocaleDateString('en-AU')} - {new Date(pp.endDate).toLocaleDateString('en-AU')}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Gross Pay</div>
                  <div style={{ fontWeight: 700, fontSize: '1.125rem' }}>${formatCurrency(pp.totalPay)}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Net Pay</div>
                  <div style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--color-success)' }}>${formatCurrency(pp.netPay)}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Status</div>
                  <div style={{ fontWeight: 600 }}>{pp.verified ? 'Verified' : pp.status[0].toUpperCase()+pp.status.slice(1)}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                <Button size="sm" leftIcon={<Play size={16} />} disabled={verifyBusy} onClick={processPayPeriod}>
                  Process
                </Button>
                <Button size="sm" variant="secondary" onClick={runTaxOnly} disabled={verifyBusy}>
                  Calculate Tax
                </Button>
                <Button size="sm" variant="ghost" leftIcon={<FileDown size={16} />} onClick={exportCSV}>
                  Export CSV
                </Button>
                <Button size="sm" variant="ghost" leftIcon={<FileDown size={16} />} onClick={exportJSON}>
                  Export JSON
                </Button>
              </div>
            </CardBody>
          </Card>

          {/* Tax Visualization */}
          <Card variant="outlined">
            <CardHeader>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={18} style={{ color: 'var(--color-primary)' }} />
                <h3 style={{ margin: 0, fontSize: '1rem' }}>Tax Breakdown</h3>
              </div>
            </CardHeader>
            <CardBody>
              {tax.status === 'loading' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Loader2 size={18} className="loading-pulse" /> Loading...
                </div>
              )}
              {tax.status === 'error' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-secondary)' }}>
                  <TriangleAlert size={16} /> {tax.error}
                </div>
              )}
              {tax.status === 'ready' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
                  <div>
                    <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>PAYG</div>
                    <div style={{ fontWeight: 700 }}>${formatCurrency(tax.data.breakdown.paygWithholding.toString())}</div>
                  </div>
                  {/* Medicare levy is included in PAYG; no separate line */}
                  <div>
                    <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>STSL (HECS/HELP)</div>
                    <div style={{ fontWeight: 700 }}>${formatCurrency(tax.data.breakdown.hecsHelpAmount.toString())}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Total Withholdings</div>
                    <div style={{ fontWeight: 700 }}>${formatCurrency(tax.data.breakdown.totalWithholdings.toString())}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Net Pay</div>
                    <div style={{ fontWeight: 700, color: 'var(--color-success)' }}>${formatCurrency(tax.data.breakdown.netPay.toString())}</div>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Verification */}
          <Card variant="outlined">
            <CardHeader>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={18} style={{ color: 'var(--color-primary)' }} />
                <h3 style={{ margin: 0, fontSize: '1rem' }}>Pay Verification</h3>
              </div>
            </CardHeader>
            <CardBody>
              <div style={{ display: 'grid', gap: '0.75rem', maxWidth: 420 }}>
                <label style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Actual Net Pay Received ($)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={actualPay}
                  onChange={(e) => setActualPay(e.target.value)}
                  placeholder="e.g. 1240.50"
                />
                <div style={{ fontSize: '0.875rem', color: variance === null ? 'var(--color-text-secondary)' : (variance === 0 ? 'var(--color-success)' : 'var(--color-warning)') }}>
                  {variance === null ? 'Enter an amount to compare to calculated net pay.' : (
                    variance === 0 ? 'Matches calculated net pay.' : `Variance: ${variance > 0 ? '+' : ''}${variance.toFixed(2)}`
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <Button size="sm" onClick={() => saveVerification(false)} disabled={verifyBusy}>Save</Button>
                  <Button size="sm" variant="secondary" onClick={() => saveVerification(true)} disabled={verifyBusy}>Mark Verified</Button>
                </div>
              </div>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  )
}
