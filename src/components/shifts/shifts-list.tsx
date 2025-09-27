'use client'

import React, { useState, useEffect } from 'react'
import { Button, Card, CardBody } from '../ui'
import { ShiftFilters } from './shift-filters'
import { ShiftCard } from './shift-card'
import { CalendarView } from './calendar-view'
import {
  Calendar,
  List,
  Plus,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  ShiftListItem,
  ShiftFilters as ShiftFiltersType,
  ApiResponse,
  PayPeriodsListResponse,
  PayPeriodResponse,
  ShiftResponse,
  PayGuideSummary,
} from '@/types'
import { StatusBadge, statusAccentColor } from '../pay-periods/status-badge'
import { formatPayPeriodDate } from '@/lib/date-utils'
import './shifts-list.scss'

type ViewMode = 'list' | 'calendar'
type TimelineItem = {
  payPeriod: PayPeriodResponse
  shifts: ShiftListItem[]
}

export const ShiftsList: React.FC = () => {
  const router = useRouter()
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<ShiftFiltersType>({
    page: 1,
    limit: 10,
    sortBy: 'startDate',
    sortOrder: 'desc'
  })
  const [payGuideLookup, setPayGuideLookup] = useState<Record<string, string>>({})
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  })
  const [expandedPeriods, setExpandedPeriods] = useState<Record<string, boolean>>({})

  const mapSortField = (field?: string) => {
    switch (field) {
      case 'startDate':
      case 'endDate':
      case 'totalPay':
      case 'createdAt':
        return field
      case 'startTime':
        return 'startDate'
      case 'endTime':
        return 'endDate'
      default:
        return 'startDate'
    }
  }

  const mapShiftResponseToListItem = (shift: ShiftResponse): ShiftListItem => ({
    id: shift.id,
    userId: shift.userId,
    payGuideId: shift.payGuideId,
    payPeriodId: (shift as any).payPeriodId || shift.payPeriodId || '',
    startTime: new Date(shift.startTime),
    endTime: new Date(shift.endTime),
    totalHours: shift.totalHours,
    totalPay: shift.totalPay,
    notes: shift.notes ?? undefined,
  })

  const applyShiftFilters = (shifts: ShiftResponse[]): ShiftListItem[] => {
    const filteredByGuide = filters.payGuideId
      ? shifts.filter(shift => shift.payGuideId === filters.payGuideId)
      : shifts

    const filteredByDates = filteredByGuide.filter(shift => {
      const start = new Date(shift.startTime)
      if (filters.startDate) {
        const boundary = new Date(filters.startDate)
        boundary.setHours(0, 0, 0, 0)
        if (start < boundary) return false
      }
      if (filters.endDate) {
        const boundary = new Date(filters.endDate)
        boundary.setHours(23, 59, 59, 999)
        if (start > boundary) return false
      }
      return true
    })

    return filteredByDates.map(shiftResp => {
      const listItem = mapShiftResponseToListItem(shiftResp)
      const payGuideName = payGuideLookup[listItem.payGuideId]

      if (payGuideName) {
        ;(listItem as any).payGuide = {
          id: listItem.payGuideId,
          name: payGuideName,
        }
      }

      return listItem
    })
  }

  const fetchTimeline = async () => {
    try {
      setLoading(true)
      setError(null)

      // Handle direct pay period lookups
      if (filters.payPeriodId) {
        const detailRes = await fetch(`/api/pay-periods/${filters.payPeriodId}?include=shifts`)
        if (!detailRes.ok) {
          throw new Error(`Failed to fetch pay period ${filters.payPeriodId}`)
        }

        const detailJson: ApiResponse<PayPeriodResponse> = await detailRes.json()
        const period = detailJson.data

        if (!period) {
          throw new Error('Pay period not found')
        }

        const shiftsForPeriod = applyShiftFilters(period.shifts ?? [])
        setTimelineItems(
          shiftsForPeriod.length > 0 || !filters.payGuideId
            ? [{ payPeriod: period, shifts: shiftsForPeriod }]
            : []
        )
        setPagination({
          page: 1,
          limit: filters.limit ?? 10,
          total: shiftsForPeriod.length > 0 || !filters.payGuideId ? 1 : 0,
          totalPages: shiftsForPeriod.length > 0 || !filters.payGuideId ? 1 : 0,
        })
        return
      }

      // Build list query parameters
      const params = new URLSearchParams()
      const page = filters.page ?? 1
      const limit = filters.limit ?? 10

      params.set('page', page.toString())
      params.set('limit', limit.toString())
      params.set('sortBy', mapSortField(filters.sortBy))
      params.set('sortOrder', filters.sortOrder ?? 'desc')
      if (filters.startDate) params.set('startAfter', filters.startDate)
      if (filters.endDate) params.set('endBefore', filters.endDate)

      const listRes = await fetch(`/api/pay-periods?${params.toString()}`)

      if (!listRes.ok) {
        throw new Error(`Failed to fetch pay periods: ${listRes.status}`)
      }

      const listJson: ApiResponse<PayPeriodsListResponse> = await listRes.json()
      const listData = listJson.data

      if (!listData) {
        throw new Error(listJson.error || 'Failed to fetch pay periods')
      }

      setPagination(listData.pagination)

      if (listData.payPeriods.length === 0) {
        setTimelineItems([])
        return
      }

      const detailResponses = await Promise.all(
        listData.payPeriods.map(period =>
          fetch(`/api/pay-periods/${period.id}?include=shifts`)
        )
      )

      const detailJsons = await Promise.all(detailResponses.map(res => {
        if (!res.ok) {
          throw new Error(`Failed to fetch pay period detail (${res.status})`)
        }
        return res.json()
      }))

      const detailedPeriods: PayPeriodResponse[] = detailJsons
        .map((json: ApiResponse<PayPeriodResponse>) => json.data)
        .filter((period): period is PayPeriodResponse => Boolean(period))

      const timeline = detailedPeriods
        .map(period => {
          const shiftsForPeriod = applyShiftFilters(period.shifts ?? [])
          return { payPeriod: period, shifts: shiftsForPeriod }
        })
        .filter(item => item.shifts.length > 0 || !filters.payGuideId)

      setTimelineItems(timeline)
      setExpandedPeriods(prev => {
        const next: Record<string, boolean> = {}
        for (const entry of timeline) {
          if (prev[entry.payPeriod.id]) {
            next[entry.payPeriod.id] = true
          }
        }
        if (timeline.length === 1) {
          const solo = timeline[0]
          if (next[solo.payPeriod.id] === undefined && solo.shifts.length > 0) {
            next[solo.payPeriod.id] = true
          }
        }
        return next
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch pay periods'
      setError(message)
      console.error('Error fetching pay schedule timeline:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTimeline()
  }, [filters])

  useEffect(() => {
    if (!Object.keys(payGuideLookup).length) return

    setTimelineItems(prev =>
      prev.map(item => {
        let changed = false
        const enrichedShifts = item.shifts.map(shift => {
          if ((shift as any).payGuide || !payGuideLookup[shift.payGuideId]) {
            return shift
          }

          changed = true
          const enriched = { ...shift }
          ;(enriched as any).payGuide = {
            id: shift.payGuideId,
            name: payGuideLookup[shift.payGuideId],
          }
          return enriched
        })

        return changed ? { ...item, shifts: enrichedShifts } : item
      })
    )
  }, [payGuideLookup])

  const handleFiltersChange = (newFilters: Partial<ShiftFiltersType>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      // Reset to page 1 when filters change (except pagination changes)
      page: newFilters.page !== undefined ? newFilters.page : 1
    }))
  }

  const handleAddShift = () => {
    router.push('/shifts/new')
  }

  const handleShiftClick = (shiftId: string) => {
    router.push(`/shifts/${shiftId}`)
  }

  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }))
  }

  const toggleExpanded = (payPeriodId: string) => {
    setExpandedPeriods(prev => {
      const next = { ...prev }
      if (next[payPeriodId]) {
        delete next[payPeriodId]
      } else {
        next[payPeriodId] = true
      }
      return next
    })
  }

  useEffect(() => {
    const fetchPayGuides = async () => {
      try {
        const res = await fetch('/api/pay-rates?fields=id,name&limit=200')
        if (!res.ok) return

        const json: ApiResponse<{ payGuides: PayGuideSummary[] }> = await res.json()
        const entries = json.data?.payGuides?.map(pg => [pg.id, pg.name] as [string, string]) ?? []
        if (entries.length > 0) {
          setPayGuideLookup(Object.fromEntries(entries))
        }
      } catch (err) {
        console.warn('Unable to preload pay guide names for timeline view', err)
      }
    }

    fetchPayGuides()
  }, [])

  // Timeline helpers
  const formatCurrencyValue = (amount?: string) => {
    const numeric = Number(amount ?? 0)
    if (Number.isNaN(numeric)) return '$0.00'
    return numeric.toLocaleString('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 2,
    })
  }

  const formatHoursValue = (hours?: string) => {
    const numeric = Number(hours ?? 0)
    if (Number.isNaN(numeric)) return '0h'
    return `${numeric.toFixed(2)}h`
  }

  const formatDateRange = (start: Date, end: Date) =>
    `${formatPayPeriodDate(start, { month: 'short', day: 'numeric' })} – ${formatPayPeriodDate(end, { month: 'short', day: 'numeric' })}`

  const formatYear = (date: Date) => new Date(date).getFullYear()

  const resolvePrimaryPay = (period: PayPeriodResponse) =>
    period.actualPay ?? period.netPay ?? period.totalPay ?? '0'

  if (loading && timelineItems.length === 0) {
    return (
      <div className="shifts-list">
        <div className="shifts-list__header">
          <div className="shifts-list__view-controls">
            <Button
              variant={viewMode === 'list' ? 'primary' : 'outline'}
              size="sm"
              leftIcon={<List size={18} />}
              onClick={() => setViewMode('list')}
            >
              List
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'primary' : 'outline'}
              size="sm"
              leftIcon={<Calendar size={18} />}
              onClick={() => setViewMode('calendar')}
            >
              Calendar
            </Button>
          </div>
          
          <Button
            variant="primary"
            leftIcon={<Plus size={18} />}
            onClick={handleAddShift}
          >
            Add Shift
          </Button>
        </div>

        <div className="shifts-list__loading">
          <Loader2 size={48} className="animate-spin" />
          <p>Loading pay periods...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="shifts-list">
        <div className="shifts-list__header">
          <div className="shifts-list__view-controls">
            <Button
              variant={viewMode === 'list' ? 'primary' : 'outline'}
              size="sm"
              leftIcon={<List size={18} />}
              onClick={() => setViewMode('list')}
            >
              List
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'primary' : 'outline'}
              size="sm"
              leftIcon={<Calendar size={18} />}
              onClick={() => setViewMode('calendar')}
            >
              Calendar
            </Button>
          </div>
          
          <Button
            variant="primary"
            leftIcon={<Plus size={18} />}
            onClick={handleAddShift}
          >
            Add Shift
          </Button>
        </div>

        <Card variant="outlined">
          <CardBody>
            <div className="shifts-list__error">
              <AlertCircle size={48} />
              <h3>Error Loading Timeline</h3>
              <p>{error}</p>
              <Button onClick={fetchTimeline}>
                Try Again
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    )
  }

  return (
    <div className="shifts-list">
      <div className="shifts-list__header">
        <div className="shifts-list__view-controls">
          <Button
            variant={viewMode === 'list' ? 'primary' : 'outline'}
            size="sm"
            leftIcon={<List size={18} />}
            onClick={() => setViewMode('list')}
          >
            List
          </Button>
          <Button
            variant={viewMode === 'calendar' ? 'primary' : 'outline'}
            size="sm"
            leftIcon={<Calendar size={18} />}
            onClick={() => setViewMode('calendar')}
          >
            Calendar
          </Button>
        </div>
        
        <Button
          variant="primary"
          leftIcon={<Plus size={18} />}
          onClick={handleAddShift}
        >
          Add Shift
        </Button>
      </div>

      <ShiftFilters 
        filters={filters}
        onFiltersChange={handleFiltersChange}
        loading={loading}
      />
      {viewMode === 'list' ? (
        <div className="shifts-list__content">
          {timelineItems.length === 0 ? (
            <Card variant="outlined">
              <CardBody>
                <div className="shifts-list__empty">
                  <Calendar size={48} />
                  <h3>No Pay Period Activity</h3>
                  <p>Try adjusting your filters or scheduling a new shift to populate this timeline.</p>
                  <Button
                    variant="primary"
                    leftIcon={<Plus size={18} />}
                    onClick={handleAddShift}
                  >
                    Add Shift
                  </Button>
                </div>
              </CardBody>
            </Card>
          ) : (
            <>
              <div className="shifts-timeline">
                {timelineItems.map(item => {
                  const accent = statusAccentColor(item.payPeriod.status as 'open' | 'processing' | 'paid' | 'verified')
                  const primarySource = item.payPeriod.actualPay
                    ? 'Actual Pay'
                    : item.payPeriod.netPay
                    ? 'Net Pay'
                    : 'Total Pay'
                  const primaryPay = formatCurrencyValue(resolvePrimaryPay(item.payPeriod))
                  const hours = formatHoursValue(item.payPeriod.totalHours)
                  const isExpanded = !!expandedPeriods[item.payPeriod.id]
                  const panelId = `timeline-panel-${item.payPeriod.id}`
                  const secondaryPay = item.payPeriod.actualPay && item.payPeriod.netPay && item.payPeriod.actualPay !== item.payPeriod.netPay
                    ? {
                        label: 'Net Pay',
                        value: formatCurrencyValue(item.payPeriod.netPay),
                      }
                    : item.payPeriod.actualPay && item.payPeriod.totalPay && item.payPeriod.actualPay !== item.payPeriod.totalPay
                    ? {
                        label: 'Total Pay',
                        value: formatCurrencyValue(item.payPeriod.totalPay),
                      }
                    : item.payPeriod.netPay && item.payPeriod.totalPay && item.payPeriod.netPay !== item.payPeriod.totalPay
                    ? {
                        label: 'Total Pay',
                        value: formatCurrencyValue(item.payPeriod.totalPay),
                      }
                    : null
                  const displaySecondary = secondaryPay && secondaryPay.value !== primaryPay ? secondaryPay : null

                  return (
                    <div key={item.payPeriod.id} className="shifts-timeline__item">
                      <div
                        className="shifts-timeline__marker"
                        style={{ borderColor: accent, backgroundColor: accent }}
                      />

                      <Card
                        variant="outlined"
                        className="shifts-timeline__card"
                        style={{ '--accent-color': accent } as React.CSSProperties}
                      >
                        <CardBody>
                          <div className="shifts-timeline__card-header">
                            <div>
                              <div className="shifts-timeline__range">
                                {formatDateRange(item.payPeriod.startDate, item.payPeriod.endDate)}
                              </div>
                              <div className="shifts-timeline__year">{formatYear(item.payPeriod.startDate)}</div>
                            </div>
                            <div className="shifts-timeline__header-actions">
                              <StatusBadge status={item.payPeriod.status as 'open' | 'processing' | 'paid' | 'verified'} />
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleExpanded(item.payPeriod.id)}
                                aria-expanded={isExpanded}
                                aria-controls={isExpanded ? panelId : undefined}
                              >
                                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                <span style={{ marginLeft: 6 }}>
                                  {isExpanded ? 'Hide shifts' : `View shifts (${item.shifts.length})`}
                                </span>
                              </Button>
                            </div>
                          </div>

                          <div className="shifts-timeline__metrics">
                            <div className="shifts-timeline__metric">
                              <span className="shifts-timeline__metric-label">{primarySource}</span>
                              <span className="shifts-timeline__metric-value">{primaryPay}</span>
                              {displaySecondary && (
                                <span className="shifts-timeline__metric-sub">{displaySecondary.label}: {displaySecondary.value}</span>
                              )}
                            </div>
                            <div className="shifts-timeline__metric">
                              <span className="shifts-timeline__metric-label">Total Hours</span>
                              <span className="shifts-timeline__metric-value">{hours}</span>
                            </div>
                            <div className="shifts-timeline__metric">
                              <span className="shifts-timeline__metric-label">Shifts</span>
                              <span className="shifts-timeline__metric-value">
                                {item.shifts.length} shift{item.shifts.length === 1 ? '' : 's'}
                              </span>
                            </div>
                          </div>

                          {isExpanded && (
                            item.shifts.length > 0 ? (
                              <div className="shifts-timeline__shift-list" id={panelId}>
                                {item.shifts.map(shift => (
                                  <ShiftCard key={shift.id} shift={shift} onClick={() => handleShiftClick(shift.id)} />
                                ))}
                              </div>
                            ) : (
                              <div className="shifts-timeline__no-shifts" id={panelId}>
                                No shifts recorded for this pay period.
                              </div>
                            )
                          )}

                          <div className="shifts-timeline__actions">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => router.push(`/pay-periods/${item.payPeriod.id}`)}
                            >
                              Open Pay Period
                            </Button>
                          </div>
                        </CardBody>
                      </Card>
                    </div>
                  )
                })}
              </div>

              {pagination.totalPages > 1 && (
                <div className="shifts-list__pagination">
                  <Button
                    variant="outline"
                    disabled={pagination.page <= 1}
                    onClick={() => handlePageChange(pagination.page - 1)}
                  >
                    Previous
                  </Button>

                  <span className="shifts-list__page-info">
                    Page {pagination.page} of {pagination.totalPages}
                    {typeof pagination.total === 'number' && pagination.total > 0 && ` (${pagination.total} total)`}
                  </span>

                  <Button
                    variant="outline"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => handlePageChange(pagination.page + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="shifts-list__calendar-view">
          <CalendarView onShiftClick={handleShiftClick} />
        </div>
      )}

      {loading && timelineItems.length > 0 && (
        <div className="shifts-list__loading-overlay">
          <Loader2 size={24} className="animate-spin" />
        </div>
      )}
    </div>
  )
}
