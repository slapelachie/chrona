'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardBody, CardHeader, Button, Input } from '../ui'
import {
  DollarSign,
  FileDown,
  Loader2,
  Play,
  ShieldCheck,
  TriangleAlert,
  Plus,
  Trash2,
} from 'lucide-react'
import {
  PayPeriodResponse,
  TaxCalculationResponse,
  ShiftResponse,
} from '@/types'

interface Props {
  payPeriodId: string
}

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
  const [processReady, setProcessReady] = useState<{
    canProcess: boolean
    message?: string
    blockers?: string[]
  } | null>(null)
  const [processError, setProcessError] = useState<string | null>(null)
  const [processSuccess, setProcessSuccess] = useState<string | null>(null)
  const [openBusy, setOpenBusy] = useState(false)
  const [extras, setExtras] = useState<
    Array<{
      id: string
      type: string
      description?: string
      amount: string
      taxable: boolean
    }>
  >([])
  const [newExtra, setNewExtra] = useState<{
    type: string
    description: string
    amount: string
  }>({ type: '', description: '', amount: '' })
  const [shifts, setShifts] = useState<ShiftResponse[]>([])
  const [shiftsExpanded, setShiftsExpanded] = useState(false)
  const isVerified = useMemo(() => pp?.status === 'verified', [pp])

  const fetchPayPeriod = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(
        `/api/pay-periods/${payPeriodId}?include=shifts,extras`
      )
      if (!res.ok) throw new Error('Failed to fetch pay period')
      const json = await res.json()
      setPp(json.data as PayPeriodResponse)
      setActualPay((json.data as PayPeriodResponse).actualPay || '')
      setExtras((json.data as any).extras || [])
      setShifts((json.data as any).shifts || [])
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
      setTax({
        status: 'error',
        error: e.message || 'Error loading tax calculation',
      })
    }
  }

  const fetchProcessReadiness = async () => {
    try {
      const res = await fetch(`/api/pay-periods/${payPeriodId}/process`)
      const json = await res.json().catch(() => null)
      if (res.ok) {
        setProcessReady({
          canProcess: !!json?.data?.canProcess,
          message: json?.message,
          blockers: json?.data?.blockers || [],
        })
      } else {
        setProcessReady({
          canProcess: false,
          message: json?.message || 'Not ready to process',
          blockers: json?.errors?.map?.((e: any) => e.message) || [],
        })
      }
    } catch {
      setProcessReady({
        canProcess: false,
        message: 'Unable to determine processing readiness',
      })
    }
  }

  const processPayPeriod = async () => {
    try {
      setVerifyBusy(true)
      setProcessError(null)
      setProcessSuccess(null)
      const res = await fetch(`/api/pay-periods/${payPeriodId}/process`, {
        method: 'POST',
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        const msg =
          json?.message || json?.error || 'Failed to process pay period'
        throw new Error(msg)
      }
      await fetchPayPeriod()
      await fetchTax()
      await fetchProcessReadiness()
      setProcessSuccess(
        'Pay period processed successfully! All shifts and extras have been calculated with taxes.'
      )
      // Clear success message after 5 seconds
      setTimeout(() => setProcessSuccess(null), 5000)
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : 'Processing failed. Please try again.'
      setProcessError(msg)
    } finally {
      setVerifyBusy(false)
    }
  }

  const runTaxOnly = async () => {
    try {
      setVerifyBusy(true)
      const res = await fetch(
        `/api/pay-periods/${payPeriodId}/tax-calculation`,
        { method: 'POST' }
      )
      if (!res.ok) throw new Error('Failed to calculate taxes')
      await fetchTax()
    } catch (e) {
      alert('Tax calculation failed.')
    } finally {
      setVerifyBusy(false)
    }
  }

  const reopenAsOpen = async () => {
    try {
      setOpenBusy(true)
      const res = await fetch(`/api/pay-periods/${payPeriodId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'open' }),
      })
      if (!res.ok) throw new Error('Failed to open pay period')
      await fetchPayPeriod()
      await fetchProcessReadiness()
    } catch (e) {
      alert('Could not open the period. Please try again.')
    } finally {
      setOpenBusy(false)
    }
  }

  const saveVerification = async (markVerified: boolean) => {
    try {
      setVerifyBusy(true)
      const payload: any = {}
      if (actualPay) payload.actualPay = actualPay
      if (markVerified) payload.status = 'verified'
      const res = await fetch(`/api/pay-periods/${payPeriodId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
    const blob = new Blob([JSON.stringify(json.data, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pay-period-${payPeriodId}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportCSV = async () => {
    const res = await fetch(
      `/api/pay-periods/${payPeriodId}?include=shifts,extras`
    )
    if (!res.ok) return alert('Export failed')
    const json = await res.json()
    const data = json.data as PayPeriodResponse
    const shifts = (data.shifts || []) as ShiftResponse[]
    const header = ['Shift ID', 'Start', 'End', 'Total Hours', 'Total Pay']
    const rows = shifts.map((s) => [
      s.id,
      new Date(s.startTime).toISOString(),
      new Date(s.endTime).toISOString(),
      s.totalHours || '',
      s.totalPay || '',
    ])
    const csv = [header, ...rows]
      .map((r) =>
        r.map((v) => `"${(v ?? '').toString().replace(/"/g, '""')}"`).join(',')
      )
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pay-period-${payPeriodId}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const addExtra = async () => {
    if (!newExtra.type || !newExtra.amount) return
    const res = await fetch(`/api/pay-periods/${payPeriodId}/extras`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: newExtra.type,
        description: newExtra.description || undefined,
        amount: newExtra.amount,
        taxable: true,
      }),
    })
    if (res.ok) {
      setNewExtra({ type: '', description: '', amount: '' })
      await fetchPayPeriod()
      await fetchTax()
    }
  }

  const deleteExtra = async (id: string) => {
    const res = await fetch(`/api/pay-periods/${payPeriodId}/extras/${id}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      await fetchPayPeriod()
      await fetchTax()
    }
  }

  useEffect(() => {
    fetchPayPeriod()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payPeriodId])

  useEffect(() => {
    fetchTax()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payPeriodId])

  useEffect(() => {
    fetchProcessReadiness()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payPeriodId])

  const formatCurrency = (amount?: string) => {
    if (!amount) return '-'
    const n = Number(amount)
    return n.toLocaleString('en-AU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  const variance = useMemo(() => {
    if (!pp?.netPay || !actualPay) return null
    const diff = Number(actualPay) - Number(pp.netPay)
    return diff
  }, [pp?.netPay, actualPay])

  return (
    <>
      <style jsx>{`
        .pay-period-layout {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
          align-items: start;
        }

        @media (min-width: 768px) {
          .pay-period-layout {
            grid-template-columns: 1fr 300px;
          }
        }

        @media (max-width: 767px) {
          .sidebar-section {
            order: -1;
          }

          .main-content {
            order: 1;
          }
        }
      `}</style>
      <div
        className="mobile-container"
        style={{ display: 'grid', gap: '1rem' }}
      >
        {pp && new Date(pp.endDate) < new Date('2025-09-24') && (
          <div
            style={{
              padding: '0.75rem',
              border: '1px solid var(--color-warning, #FFC107)',
              borderRadius: 6,
              background: 'rgba(255,193,7,0.1)',
              color: 'var(--color-text-primary)',
            }}
          >
            Heads up: STSL (HECS/HELP) amounts for pay periods ending before 24
            Sep 2025 may differ from ATO tables. This app applies Schedule 8
            formulas without legacy thresholds.
          </div>
        )}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Loader2 size={18} className="loading-pulse" /> Loading pay
            period...
          </div>
        )}
        {error && <div style={{ color: 'var(--color-danger)' }}>{error}</div>}

        {processError && (
          <div
            style={{
              padding: '0.75rem',
              border: '1px solid var(--color-danger)',
              borderRadius: '6px',
              backgroundColor: 'rgba(220, 53, 69, 0.1)',
              color: 'var(--color-danger)',
            }}
          >
            <strong>Processing Error:</strong> {processError}
          </div>
        )}

        {processSuccess && (
          <div
            style={{
              padding: '0.75rem',
              border: '1px solid var(--color-success)',
              borderRadius: '6px',
              backgroundColor: 'rgba(40, 167, 69, 0.1)',
              color: 'var(--color-success)',
            }}
          >
            <strong>Success:</strong> {processSuccess}
          </div>
        )}

        {pp && (
          <div className="pay-period-layout">
            {/* Main Content Column */}
            <div
              className="main-content"
              style={{ display: 'grid', gap: '1rem' }}
            >
              {/* Overview Summary */}
              <Card variant="outlined">
                <CardHeader>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <DollarSign
                        size={18}
                        style={{ color: 'var(--color-primary)' }}
                      />
                      <h3 style={{ margin: 0, fontSize: '1rem' }}>
                        Pay Period Summary
                      </h3>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 600,
                          color: isVerified
                            ? 'var(--color-success)'
                            : pp.status === 'processing'
                              ? 'var(--color-warning)'
                              : pp.status === 'paid'
                                ? 'var(--color-info)'
                                : 'var(--color-text-primary)',
                        }}
                      >
                        {isVerified
                          ? 'Verified'
                          : pp.status[0].toUpperCase() + pp.status.slice(1)}
                      </div>
                    {pp.status === 'processing' && (
                      <Loader2
                          size={14}
                          className="loading-pulse"
                          style={{ color: 'var(--color-warning)' }}
                        />
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardBody>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(auto-fit, minmax(120px, 1fr))',
                      gap: '1rem',
                      marginBottom: '1rem',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          color: 'var(--color-text-secondary)',
                          fontSize: '0.875rem',
                        }}
                      >
                        Period
                      </div>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                        {new Date(pp.startDate).toLocaleDateString('en-AU', {
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
                        -{' '}
                        {new Date(pp.endDate).toLocaleDateString('en-AU', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                    </div>
                    <div>
                      <div
                        style={{
                          color: 'var(--color-text-secondary)',
                          fontSize: '0.875rem',
                        }}
                      >
                        Hours
                      </div>
                      <div style={{ fontWeight: 600 }}>
                        {pp.totalHours || '0'}
                      </div>
                    </div>
                    <div>
                      <div
                        style={{
                          color: 'var(--color-text-secondary)',
                          fontSize: '0.875rem',
                        }}
                      >
                        Gross Pay
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '1.125rem' }}>
                        ${formatCurrency(pp.totalPay)}
                      </div>
                    </div>
                    <div>
                      <div
                        style={{
                          color: 'var(--color-text-secondary)',
                          fontSize: '0.875rem',
                        }}
                      >
                        {pp.actualPay ? (isVerified ? 'Actual Paid' : 'Actual (pending)') : 'Net Pay'}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: '1.125rem',
                            color: 'var(--color-success)',
                          }}
                        >
                          ${formatCurrency(pp.actualPay || pp.netPay)}
                        </div>
                        {pp.actualPay && (
                          <div
                            style={{
                              color: 'var(--color-text-secondary)',
                              fontSize: '0.8rem',
                            }}
                          >
                            Calculated net: ${formatCurrency(pp.netPay)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Tax Breakdown - Only show when processed */}
                  {tax.status === 'ready' && (
                    <div
                      style={{
                        borderTop: '1px solid var(--color-border)',
                        paddingTop: '1rem',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.875rem',
                          color: 'var(--color-text-secondary)',
                          marginBottom: '0.75rem',
                          fontWeight: 600,
                        }}
                      >
                        Tax Breakdown
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns:
                            'repeat(auto-fit, minmax(120px, 1fr))',
                          gap: '1rem',
                        }}
                      >
                        <div>
                          <div
                            style={{
                              color: 'var(--color-text-secondary)',
                              fontSize: '0.75rem',
                            }}
                          >
                            PAYG
                          </div>
                          <div
                            style={{ fontWeight: 600, fontSize: '0.875rem' }}
                          >
                            $
                            {formatCurrency(
                              tax.data.breakdown.paygWithholding.toString()
                            )}
                          </div>
                        </div>
                        <div>
                          <div
                            style={{
                              color: 'var(--color-text-secondary)',
                              fontSize: '0.75rem',
                            }}
                          >
                            STSL
                          </div>
                          <div
                            style={{ fontWeight: 600, fontSize: '0.875rem' }}
                          >
                            $
                            {formatCurrency(tax.data.breakdown.stslAmount.toString())}
                          </div>
                        </div>
                        <div>
                          <div
                            style={{
                              color: 'var(--color-text-secondary)',
                              fontSize: '0.75rem',
                            }}
                          >
                            Total Tax
                          </div>
                          <div
                            style={{ fontWeight: 700, fontSize: '0.875rem' }}
                          >
                            $
                            {formatCurrency(
                              tax.data.breakdown.totalWithholdings.toString()
                            )}
                          </div>
                        </div>
                        {tax.status === 'loading' && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                            }}
                          >
                            <Loader2 size={16} className="loading-pulse" />
                            <span
                              style={{
                                fontSize: '0.75rem',
                                color: 'var(--color-text-secondary)',
                              }}
                            >
                              Loading...
                            </span>
                          </div>
                        )}
                        {tax.status === 'error' && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              color: 'var(--color-text-secondary)',
                            }}
                          >
                            <TriangleAlert size={14} />
                            <span style={{ fontSize: '0.75rem' }}>
                              Tax calculation error
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardBody>
              </Card>

              {/* Extras Section */}
              <Card variant="outlined">
                <CardHeader>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <Plus size={18} style={{ color: 'var(--color-primary)' }} />
                    <h3 style={{ margin: 0, fontSize: '1rem' }}>
                      Extras & Allowances
                    </h3>
                  </div>
                </CardHeader>
                <CardBody>
                  <div className="d-grid" style={{ gap: '0.5rem' }}>
                    {extras.length === 0 && (
                      <div className="text-secondary">No extras yet.</div>
                    )}
                    {extras.map((e) => (
                      <div
                        key={e.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.75rem',
                          borderBottom: '1px solid var(--color-border)',
                          paddingBottom: '0.5rem',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600 }}>{e.type}</div>
                          {e.description && (
                            <div
                              className="text-secondary"
                              style={{ fontSize: 12 }}
                            >
                              {e.description}
                            </div>
                          )}
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          <div>${formatCurrency(e.amount)}</div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteExtra(e.id)}
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </div>
                    ))}

                    {/* Add extra form */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 2fr 1fr auto',
                        gap: '0.5rem',
                        alignItems: 'center',
                      }}
                    >
                      <Input
                        placeholder="Type (e.g., Uniform)"
                        value={newExtra.type}
                        onChange={(e) =>
                          setNewExtra((prev) => ({
                            ...prev,
                            type: e.target.value,
                          }))
                        }
                      />
                      <Input
                        placeholder="Description (optional)"
                        value={newExtra.description}
                        onChange={(e) =>
                          setNewExtra((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                      />
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Amount"
                        value={newExtra.amount}
                        onChange={(e) =>
                          setNewExtra((prev) => ({
                            ...prev,
                            amount: e.target.value,
                          }))
                        }
                      />
                      <Button
                        size="sm"
                        onClick={addExtra}
                        leftIcon={<Plus size={16} />}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                </CardBody>
              </Card>

              {/* Shifts Section */}
              <Card variant="outlined">
                <CardHeader>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <div style={{ fontSize: '1rem', fontWeight: 600 }}>
                        Shifts ({shifts.length})
                      </div>
                    </div>
                    {shifts.length > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShiftsExpanded(!shiftsExpanded)}
                      >
                        {shiftsExpanded ? 'Collapse' : 'Expand'}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardBody>
                  {shifts.length === 0 ? (
                    <div
                      style={{
                        color: 'var(--color-text-secondary)',
                        textAlign: 'center',
                        padding: '1rem',
                      }}
                    >
                      No shifts recorded for this period
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                      {shifts
                        .slice(0, shiftsExpanded ? shifts.length : 3)
                        .map((shift, index) => (
                          <div
                            key={shift.id}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr auto auto',
                              gap: '1rem',
                              alignItems: 'center',
                              padding: '0.75rem',
                              backgroundColor:
                                'var(--color-background-secondary)',
                              borderRadius: '6px',
                            }}
                          >
                            <div>
                              <div
                                style={{
                                  fontWeight: 600,
                                  fontSize: '0.875rem',
                                }}
                              >
                                {new Date(shift.startTime).toLocaleDateString(
                                  'en-AU',
                                  {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                  }
                                )}
                              </div>
                              <div
                                style={{
                                  fontSize: '0.75rem',
                                  color: 'var(--color-text-secondary)',
                                }}
                              >
                                {new Date(shift.startTime).toLocaleTimeString(
                                  'en-AU',
                                  { hour: '2-digit', minute: '2-digit' }
                                )}{' '}
                                -{' '}
                                {new Date(shift.endTime).toLocaleTimeString(
                                  'en-AU',
                                  { hour: '2-digit', minute: '2-digit' }
                                )}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div
                                style={{
                                  fontSize: '0.75rem',
                                  color: 'var(--color-text-secondary)',
                                }}
                              >
                                Hours
                              </div>
                              <div
                                style={{
                                  fontWeight: 600,
                                  fontSize: '0.875rem',
                                }}
                              >
                                {shift.totalHours || '0'}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div
                                style={{
                                  fontSize: '0.75rem',
                                  color: 'var(--color-text-secondary)',
                                }}
                              >
                                Total Pay
                              </div>
                              <div
                                style={{
                                  fontWeight: 700,
                                  fontSize: '0.875rem',
                                }}
                              >
                                ${formatCurrency(shift.totalPay)}
                              </div>
                            </div>
                          </div>
                        ))}
                      {!shiftsExpanded && shifts.length > 3 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setShiftsExpanded(true)}
                          style={{ marginTop: '0.5rem' }}
                        >
                          Show {shifts.length - 3} more shifts
                        </Button>
                      )}
                    </div>
                  )}
                </CardBody>
              </Card>
            </div>

            {/* Sidebar Column */}
            <div
              className="sidebar-section"
              style={{ display: 'grid', gap: '1rem' }}
            >
              {/* Status Progression */}
              <Card variant="outlined">
                <CardHeader>
                  <h3 style={{ margin: 0, fontSize: '0.875rem' }}>Progress</h3>
                </CardHeader>
                <CardBody style={{ padding: '0.75rem' }}>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        color:
                          pp.status === 'open'
                            ? 'var(--color-primary)'
                            : 'var(--color-success)',
                        fontWeight: pp.status === 'open' ? 600 : 400,
                      }}
                    >
                      {pp.status === 'open' ? '○' : '●'} Open
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        color:
                          pp.status === 'processing'
                            ? 'var(--color-warning)'
                            : ['paid', 'verified'].includes(pp.status)
                              ? 'var(--color-success)'
                              : 'var(--color-text-secondary)',
                        fontWeight: pp.status === 'processing' ? 600 : 400,
                      }}
                    >
                      {pp.status === 'processing'
                        ? '◉'
                        : ['paid', 'verified'].includes(pp.status)
                          ? '●'
                          : '○'}{' '}
                      Processing
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        color:
                          pp.status === 'paid'
                            ? 'var(--color-info)'
                            : isVerified
                              ? 'var(--color-success)'
                              : 'var(--color-text-secondary)',
                        fontWeight: pp.status === 'paid' ? 600 : 400,
                      }}
                    >
                      {pp.status === 'paid' ? '◉' : isVerified ? '●' : '○'}{' '}
                      Paid
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        color: isVerified
                          ? 'var(--color-success)'
                          : 'var(--color-text-secondary)',
                        fontWeight: isVerified ? 600 : 400,
                      }}
                    >
                      {isVerified ? '●' : '○'} Verified
                    </div>
                  </div>
                </CardBody>
              </Card>

              {/* Actions */}
              <Card variant="outlined">
                <CardHeader>
                  <h3 style={{ margin: 0, fontSize: '0.875rem' }}>Actions</h3>
                </CardHeader>
                <CardBody style={{ padding: '0.75rem' }}>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}
                  >
                    {/* Primary Action based on status */}
                    {pp.status === 'open' && (
                      <Button
                        size="sm"
                        leftIcon={<Play size={16} />}
                        disabled={verifyBusy || !processReady?.canProcess}
                        onClick={processPayPeriod}
                        title={
                          processReady?.canProcess
                            ? 'Process pay period and calculate taxes'
                            : processReady?.blockers?.join(', ') ||
                              'Not ready to process'
                        }
                      >
                        {verifyBusy ? 'Processing…' : 'Process'}
                      </Button>
                    )}

                    {pp.status === 'processing' && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          color: 'var(--color-success)',
                          padding: '0.5rem',
                          backgroundColor: 'var(--color-background-secondary)',
                          borderRadius: '4px',
                        }}
                      >
                        <ShieldCheck size={16} />
                        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                          Ready for verification
                        </span>
                      </div>
                    )}

                    {pp.status === 'paid' && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          color: 'var(--color-info)',
                          padding: '0.5rem',
                          backgroundColor: 'var(--color-background-secondary)',
                          borderRadius: '4px',
                        }}
                      >
                        <DollarSign size={16} />
                        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                          Payment recorded
                        </span>
                      </div>
                    )}

                    {isVerified && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          color: 'var(--color-success)',
                          padding: '0.5rem',
                          backgroundColor: 'var(--color-background-secondary)',
                          borderRadius: '4px',
                        }}
                      >
                        <ShieldCheck size={16} />
                        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                          ✓ Verified
                        </span>
                      </div>
                    )}

                    {/* Utility Actions */}
                    {pp.status === 'open' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={runTaxOnly}
                        disabled={verifyBusy}
                      >
                        Preview Tax
                      </Button>
                    )}

                    {pp.status !== 'open' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={reopenAsOpen}
                        disabled={openBusy}
                      >
                        {openBusy ? 'Opening…' : 'Reopen to Edit'}
                      </Button>
                    )}

                    {/* Export Actions */}
                    <div
                      style={{
                        display: 'flex',
                        gap: '0.5rem',
                        marginTop: '0.5rem',
                      }}
                    >
                      <Button
                        size="sm"
                        variant="ghost"
                        leftIcon={<FileDown size={16} />}
                        onClick={exportCSV}
                      >
                        CSV
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        leftIcon={<FileDown size={16} />}
                        onClick={exportJSON}
                      >
                        JSON
                      </Button>
                    </div>
                  </div>
                </CardBody>
              </Card>

              {/* Verification Section - Only show when processing/paid/verified */}
              {(pp.status === 'processing' || pp.status === 'paid' || isVerified) && (
                <Card variant="outlined">
                  <CardHeader>
                    <h3 style={{ margin: 0, fontSize: '0.875rem' }}>
                      Verification
                    </h3>
                  </CardHeader>
                  <CardBody style={{ padding: '0.75rem' }}>
                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                      <div>
                        <label
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--color-text-secondary)',
                            display: 'block',
                            marginBottom: '0.25rem',
                          }}
                        >
                          Actual Net Pay ($)
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          value={actualPay}
                          onChange={(e) => setActualPay(e.target.value)}
                          placeholder={`Expected: ${formatCurrency(pp.netPay)}`}
                          style={{ fontSize: '0.875rem' }}
                        />
                      </div>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color:
                            variance === null
                              ? 'var(--color-text-secondary)'
                              : variance === 0
                                ? 'var(--color-success)'
                                : 'var(--color-warning)',
                        }}
                      >
                        {variance === null
                          ? 'Enter actual amount'
                          : variance === 0
                            ? '✓ Matches'
                            : `Variance: ${variance > 0 ? '+' : ''}$${Math.abs(variance).toFixed(2)}`}
                      </div>
                      {!isVerified && (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem',
                          }}
                        >
                          <Button
                            size="sm"
                            onClick={() => saveVerification(false)}
                            disabled={verifyBusy}
                          >
                            Save Amount
                          </Button>
                          <Button
                            size="sm"
                            variant="success"
                            onClick={() => saveVerification(true)}
                            disabled={verifyBusy}
                          >
                            Mark Verified
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardBody>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
