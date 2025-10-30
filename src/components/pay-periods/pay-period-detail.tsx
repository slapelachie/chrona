'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardBody, CardHeader, Button, Input } from '../ui'
import {
  DollarSign,
  Loader2,
  ShieldCheck,
  TriangleAlert,
  Plus,
  Trash2,
} from 'lucide-react'
import {
  PayPeriodResponse,
  PayPeriodStatus,
  TaxCalculationResponse,
  ShiftResponse,
  ShiftListItem,
} from '@/types'
import { StatusBadge, statusAccentColor } from './status-badge'
import { formatPayPeriodDate } from '@/lib/date-utils'
import { ShiftCard } from '@/components/shifts/shift-card'
import './pay-period-detail.scss'
import { formatCurrencyValue } from '../utils/format'

interface Props {
  payPeriodId: string
}

type TaxState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; data: TaxCalculationResponse['taxCalculation'] }
  | { status: 'error'; error: string }

type ReadinessState = {
  status: PayPeriodStatus
  isFuture: boolean
  readyForVerification: boolean
  totalShifts: number
  shiftsWithPay: number
  shiftsWithoutPay: number
  blockers: string[]
  timezone: string | null
}

type ReadinessDescriptor = {
  headline: string
  description: string
  tone?: 'success' | 'warning' | 'info'
}

export const PayPeriodDetail: React.FC<Props> = ({ payPeriodId }) => {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pp, setPp] = useState<PayPeriodResponse | null>(null)
  const [tax, setTax] = useState<TaxState>({ status: 'idle' })
  const [actualPay, setActualPay] = useState('')
  const [verifyBusy, setVerifyBusy] = useState(false)
  const [readiness, setReadiness] = useState<ReadinessState | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
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
  const [payGuideLookup, setPayGuideLookup] = useState<Record<string, string>>({})
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

  const fetchReadiness = async () => {
    try {
      const res = await fetch(`/api/pay-periods/${payPeriodId}/readiness`)
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.data) {
        throw new Error(json?.message || 'Unable to load readiness data')
      }
      setReadiness(json.data as ReadinessState)
    } catch (error) {
      console.error('Failed to load readiness', error)
      setReadiness(null)
    }
  }

  const refreshPayPeriod = async () => {
    try {
      setVerifyBusy(true)
      setActionError(null)
      setActionSuccess(null)
      const res = await fetch(`/api/pay-periods/${payPeriodId}/recalculate`, {
        method: 'POST',
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        const msg = json?.message || json?.error || 'Failed to refresh pay period'
        throw new Error(msg)
      }
      await fetchPayPeriod()
      await fetchTax()
      await fetchReadiness()
      setActionSuccess('Pay period recalculated.')
      setTimeout(() => setActionSuccess(null), 5000)
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : 'Unable to refresh pay period. Please try again.'
      setActionError(msg)
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
        body: JSON.stringify({ status: 'pending' }),
      })
      if (!res.ok) throw new Error('Failed to open pay period')
      await fetchPayPeriod()
      await fetchReadiness()
    } catch (error) {
      console.error('Could not open the period.', error)
      alert('Could not open the period. Please try again.')
    } finally {
      setOpenBusy(false)
    }
  }

  const saveVerification = async (markVerified: boolean) => {
    try {
      setVerifyBusy(true)
      setActionError(null)
      setActionSuccess(null)
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
      await fetchReadiness()
      if (markVerified) {
        setActionSuccess('Pay period marked as verified.')
      } else {
        setActionSuccess('Actual pay saved.')
      }
      setTimeout(() => setActionSuccess(null), 5000)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to save verification.'
      setActionError(msg)
    } finally {
      setVerifyBusy(false)
    }
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
      await fetchReadiness()
    }
  }

  const deleteExtra = async (id: string) => {
    const res = await fetch(`/api/pay-periods/${payPeriodId}/extras/${id}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      await fetchPayPeriod()
      await fetchTax()
      await fetchReadiness()
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
    fetchReadiness()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payPeriodId])

  useEffect(() => {
    const fetchPayGuides = async () => {
      try {
        const res = await fetch('/api/pay-rates?fields=id,name&limit=200')
        if (!res.ok) return
        const json = await res.json().catch(() => null)
        const entries = json?.data?.payGuides?.map((pg: { id: string; name: string }) => [pg.id, pg.name]) ?? []
        if (entries.length) {
          setPayGuideLookup(Object.fromEntries(entries))
        }
      } catch (e) {
        console.warn('Unable to preload pay guide names for pay period detail', e)
      }
    }

    fetchPayGuides()
  }, [])

  const readinessInfo = useMemo<ReadinessDescriptor | null>(() => {
    if (!pp) return null
    if (!readiness) {
      return {
        headline: 'Readiness unavailable',
        description: 'Refresh totals to try again.',
      }
    }

    if (pp.status === 'verified') {
      return {
        headline: 'Verified',
        description: 'Reopen the pay period to make further changes.',
        tone: 'success' as const,
      }
    }

    if (readiness.isFuture) {
      const endLabel = formatPayPeriodDate(pp.endDate, { month: 'short', day: 'numeric' })
      return {
        headline: 'Upcoming period',
        description: `Ends ${endLabel}. Totals will update as shifts are added.`,
        tone: 'info' as const,
      }
    }

    if (readiness.readyForVerification) {
      return {
        headline: 'Ready for verification',
        description: `${readiness.totalShifts} shift${readiness.totalShifts === 1 ? '' : 's'} have calculated pay.`,
        tone: 'success' as const,
      }
    }

    const blockers = readiness.blockers.length > 0
      ? readiness.blockers.join(' • ')
      : 'Review outstanding items before verifying.'

    return {
      headline: 'Needs attention',
      description: blockers,
      tone: 'warning' as const,
    }
  }, [pp, readiness])

  const shiftListItems = useMemo<ShiftListItem[]>(() => {
    return shifts.map(shift => {
      const item: ShiftListItem = {
        id: shift.id,
        userId: shift.userId,
        payGuideId: shift.payGuideId,
        payPeriodId: shift.payPeriodId || '',
        startTime: new Date(shift.startTime),
        endTime: new Date(shift.endTime),
        totalHours: shift.totalHours,
        totalPay: shift.totalPay,
        notes: shift.notes ?? undefined,
      }

      const guideName = payGuideLookup[shift.payGuideId]
      if (guideName) {
        ;(item as any).payGuide = {
          id: shift.payGuideId,
          name: guideName,
        }
      }

      return item
    })
  }, [shifts, payGuideLookup])

  const visibleShiftItems = useMemo(
    () => (shiftsExpanded ? shiftListItems : shiftListItems.slice(0, 3)),
    [shiftListItems, shiftsExpanded]
  )

  const handleShiftOpen = (shiftId: string) => {
    router.push(`/shifts/${shiftId}`)
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

        {actionError && (
          <div
            style={{
              padding: '0.75rem',
              border: '1px solid var(--color-danger)',
              borderRadius: '6px',
              backgroundColor: 'rgba(220, 53, 69, 0.1)',
              color: 'var(--color-danger)',
            }}
          >
            <strong>Action Error:</strong> {actionError}
          </div>
        )}

        {actionSuccess && (
          <div
            style={{
              padding: '0.75rem',
              border: '1px solid var(--color-success)',
              borderRadius: '6px',
              backgroundColor: 'rgba(40, 167, 69, 0.1)',
              color: 'var(--color-success)',
            }}
          >
            <strong>Success:</strong> {actionSuccess}
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
              <Card
                variant="outlined"
                style={{
                  boxShadow: pp ? `inset 0 4px 0 0 ${statusAccentColor(pp.status as any)}` : undefined,
                }}
              >
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
                    <StatusBadge status={pp.status as any} size="lg" emphasis />
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
                        {formatPayPeriodDate(pp.startDate, {
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
                        -{' '}
                        {formatPayPeriodDate(pp.endDate, {
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
                        ${formatCurrencyValue(pp.totalPay, { fallback: '-' })}
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
                          ${formatCurrencyValue(pp.actualPay || pp.netPay, { fallback: '-' })}
                        </div>
                        {pp.actualPay && (
                          <div
                            style={{
                              color: 'var(--color-text-secondary)',
                              fontSize: '0.8rem',
                            }}
                          >
                            Calculated net: ${formatCurrencyValue(pp.netPay, { fallback: '-' })}
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
                            {formatCurrencyValue(
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
                            {formatCurrencyValue(
                              tax.data.breakdown.stslAmount.toString()
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
                            Total Tax
                          </div>
                          <div
                            style={{ fontWeight: 700, fontSize: '0.875rem' }}
                          >
                            $
                            {formatCurrencyValue(
                              tax.data.breakdown.totalWithholdings.toString()
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {tax.status === 'loading' && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        paddingTop: '1rem',
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
                        paddingTop: '1rem',
                      }}
                    >
                      <TriangleAlert size={14} />
                      <span style={{ fontSize: '0.75rem' }}>
                        Tax calculation error
                      </span>
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
                          <div>${formatCurrencyValue(e.amount, { fallback: '0.00' })}</div>
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
                    <div className="pay-period-detail__shifts">
                      {visibleShiftItems.map(shift => (
                        <ShiftCard
                          key={shift.id}
                          shift={shift}
                          onClick={() => handleShiftOpen(shift.id)}
                        />
                      ))}
                      {!shiftsExpanded && shiftListItems.length > 3 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setShiftsExpanded(true)}
                          style={{ marginTop: '0.5rem' }}
                        >
                          Show {shiftListItems.length - 3} more shifts
                        </Button>
                      )}
                    </div>
                  )}
                </CardBody>
              </Card>
            </div>

            {/* Sidebar Column */}
            <div className="sidebar-section pay-period-detail__sidebar">
              <Card variant="outlined">
                <CardHeader>
                  <h3 className="pay-period-detail__section-title">Readiness</h3>
                </CardHeader>
                <CardBody className="pay-period-detail__readiness-body">
                  <div className="pay-period-detail__readiness-header">
                    <StatusBadge status={(pp.status as 'pending' | 'verified')} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                        {readinessInfo?.headline ?? '—'}
                      </div>
                      <div className={['pay-period-detail__readiness-description',
                        readinessInfo?.tone ? `pay-period-detail__readiness-description--${readinessInfo.tone}` : ''
                      ].filter(Boolean).join(' ')}>
                        {readinessInfo?.description ?? 'Readiness data unavailable.'}
                      </div>
                    </div>
                  </div>
                  {readiness && readiness.blockers.length > 0 && pp.status === 'pending' && !readiness.readyForVerification && (
                    <div className="pay-period-detail__readiness-blockers">
                      <span className="pay-period-detail__readiness-blockers-title">Blockers</span>
                      <ul className="pay-period-detail__readiness-blockers-list">
                        {readiness.blockers.map((blocker) => (
                          <li key={blocker}>{blocker}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardBody>
              </Card>

              <Card variant="outlined">
                <CardHeader>
                  <h3 className="pay-period-detail__section-title">Actions</h3>
                </CardHeader>
                <CardBody className="pay-period-detail__actions-body">
                  <div className="pay-period-detail__actions-group">
                    <Button
                      size="sm"
                      leftIcon={<Loader2 size={16} className={verifyBusy ? 'loading-pulse' : undefined} />}
                      disabled={verifyBusy || pp.status === 'verified'}
                      onClick={refreshPayPeriod}
                    >
                      {verifyBusy ? 'Refreshing…' : 'Refresh totals & tax'}
                    </Button>
                    {pp.status === 'verified' && (
                      <div className="pay-period-detail__actions-note">
                        Reopen the pay period before recalculating totals.
                      </div>
                    )}
                  </div>

                  <div className="pay-period-detail__actions-group">
                    <Button
                      size="sm"
                      variant="success"
                      leftIcon={<ShieldCheck size={16} />}
                      disabled={verifyBusy || !pp || pp.status !== 'pending' || !(readiness?.readyForVerification ?? false)}
                      onClick={() => saveVerification(true)}
                    >
                      {verifyBusy ? 'Marking…' : 'Mark Verified'}
                    </Button>
                    {pp?.status === 'pending' && !(readiness?.readyForVerification ?? false) && (
                      <div className="pay-period-detail__actions-note pay-period-detail__actions-note--warning">
                        Complete outstanding items before verifying.
                      </div>
                    )}
                    {isVerified && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={reopenAsOpen}
                        disabled={openBusy}
                      >
                        {openBusy ? 'Opening…' : 'Reopen to Edit'}
                      </Button>
                    )}
                  </div>

                </CardBody>
              </Card>

              {/* Verification Section - Only show when pending or verified */}
              {(pp.status === 'pending' || isVerified) && (
                <Card variant="outlined">
                  <CardHeader>
                    <h3 className="pay-period-detail__section-title">
                      Verification
                    </h3>
                  </CardHeader>
                  <CardBody>
                    <div className="pay-period-detail__verification-body">
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
                          placeholder={`Expected: ${formatCurrencyValue(pp.netPay, { fallback: '0.00' })}`}
                          className="pay-period-detail__actual-input"
                        />
                      </div>
                      <div className={[
                        'pay-period-detail__variance-text',
                        variance === 0
                          ? 'pay-period-detail__variance-text--success'
                          : variance
                              ? 'pay-period-detail__variance-text--warning'
                              : ''
                      ].filter(Boolean).join(' ')}>
                        {variance === null
                          ? 'Enter actual amount'
                          : variance === 0
                            ? '✓ Matches'
                            : `Variance: ${variance > 0 ? '+' : ''}$${Math.abs(variance).toFixed(2)}`}
                      </div>
                      {!isVerified && (
                        <Button
                          size="sm"
                          onClick={() => saveVerification(false)}
                          disabled={verifyBusy}
                        >
                          Save Amount
                        </Button>
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
