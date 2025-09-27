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
  AlertCircle 
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { ShiftListItem, ShiftFilters as ShiftFiltersType, ApiResponse, ShiftsListResponse } from '@/types'
import './shifts-list.scss'

type ViewMode = 'list' | 'calendar'
type GroupBy = 'day' | 'week'

export const ShiftsList: React.FC = () => {
  const router = useRouter()
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [shifts, setShifts] = useState<ShiftListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<ShiftFiltersType>({
    page: 1,
    limit: 10,
    sortBy: 'startTime',
    sortOrder: 'desc'
  })
  const [groupBy, setGroupBy] = useState<GroupBy>('day')
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  })

  const fetchShifts = async () => {
    try {
      setLoading(true)
      setError(null)

      // Build query parameters
      const params = new URLSearchParams()
      
      if (filters.page) params.set('page', filters.page.toString())
      if (filters.limit) params.set('limit', filters.limit.toString())
      if (filters.sortBy) params.set('sortBy', filters.sortBy)
      if (filters.sortOrder) params.set('sortOrder', filters.sortOrder)
      if (filters.startDate) params.set('startDate', filters.startDate)
      if (filters.endDate) params.set('endDate', filters.endDate)
      if (filters.payGuideId) params.set('payGuideId', filters.payGuideId)
      if (filters.payPeriodId) params.set('payPeriodId', filters.payPeriodId)

      // Include basic related data
      params.set('include', 'payGuide')

      const response = await fetch(`/api/shifts?${params}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch shifts: ${response.status}`)
      }

      const result: ApiResponse<ShiftsListResponse> = await response.json()
      
      if (result.data) {
        setShifts(result.data.shifts)
        setPagination(result.data.pagination)
      } else {
        throw new Error(result.error || 'Failed to fetch shifts')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch shifts'
      setError(message)
      console.error('Error fetching shifts:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchShifts()
  }, [filters])

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

  // Grouping helpers
  const formatCurrency = (amount?: string) => {
    if (!amount) return 0
    const n = Number(amount)
    return isNaN(n) ? 0 : n
  }

  const toDateKey = (d: Date) => d.toISOString().slice(0, 10)

  const startOfWeek = (d: Date) => {
    const date = new Date(d)
    const day = date.getDay() // 0 Sun
    const diff = date.getDate() - day // go back to Sunday
    const start = new Date(date)
    start.setDate(diff)
    start.setHours(0,0,0,0)
    return start
  }

  const endOfWeek = (d: Date) => {
    const s = startOfWeek(d)
    const e = new Date(s)
    e.setDate(s.getDate() + 6)
    e.setHours(23,59,59,999)
    return e
  }

  const groups = React.useMemo(() => {
    const map = new Map<string, { label: string; sublabel?: string; items: ShiftListItem[]; totalHours: number; totalPay: number }>()
    for (const sh of shifts) {
      const start = new Date(sh.startTime)
      let key: string
      let label: string
      let sublabel: string | undefined
      if (groupBy === 'week') {
        const s = startOfWeek(start)
        const e = endOfWeek(start)
        key = `${toDateKey(s)}_${toDateKey(e)}`
        label = `${s.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}`
        sublabel = `${s.getFullYear()}`
      } else {
        key = toDateKey(start)
        // Today/Yesterday nicety
        const todayKey = toDateKey(new Date())
        const y = new Date()
        y.setDate(y.getDate()-1)
        const yesterdayKey = toDateKey(y)
        if (key === todayKey) {
          label = 'Today'
          sublabel = start.toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric' })
        } else if (key === yesterdayKey) {
          label = 'Yesterday'
          sublabel = start.toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric' })
        } else {
          label = start.toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric' })
        }
      }
      if (!map.has(key)) map.set(key, { label, sublabel, items: [], totalHours: 0, totalPay: 0 })
      const grp = map.get(key)!
      grp.items.push(sh)
      grp.totalHours += Number(sh.totalHours ?? 0)
      grp.totalPay += formatCurrency(sh.totalPay)
    }
    // Preserve original order (sorted by filters), but group key order stable by first occurrence
    return Array.from(map.values())
  }, [shifts, groupBy])

  if (loading && shifts.length === 0) {
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
          <p>Loading shifts...</p>
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
              <h3>Error Loading Shifts</h3>
              <p>{error}</p>
              <Button onClick={fetchShifts}>
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
      {/* Group controls */}
      <div className="shifts-list__group-controls">
        <span className="shifts-list__group-label">Group by:</span>
        <div className="shifts-list__group-buttons">
          <Button size="sm" variant={groupBy === 'day' ? 'primary' : 'outline'} onClick={() => setGroupBy('day')}>Day</Button>
          <Button size="sm" variant={groupBy === 'week' ? 'primary' : 'outline'} onClick={() => setGroupBy('week')}>Week</Button>
        </div>
      </div>

      {viewMode === 'list' ? (
        <div className="shifts-list__content">
          {shifts.length === 0 ? (
            <Card variant="outlined">
              <CardBody>
                <div className="shifts-list__empty">
                  <Calendar size={48} />
                  <h3>No Shifts Found</h3>
                  <p>You haven't added any shifts yet, or no shifts match your current filters.</p>
                  <Button 
                    variant="primary"
                    leftIcon={<Plus size={18} />}
                    onClick={handleAddShift}
                  >
                    Add Your First Shift
                  </Button>
                </div>
              </CardBody>
            </Card>
          ) : (
            <>
              <div className="shifts-list__groups">
                {groups.map((g, idx) => (
                  <div key={idx} className="shifts-group">
                    <div className="shifts-group__header">
                      <div className="shifts-group__title">
                        <span className="shifts-group__label">{g.label}</span>
                        {g.sublabel && <span className="shifts-group__sublabel">{g.sublabel}</span>}
                      </div>
                      <div className="shifts-group__totals">
                        <span className="shifts-group__total">
                          {g.totalHours.toFixed(2)}h
                        </span>
                        <span className="shifts-group__total">
                          ${g.totalPay.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                    <div className="shifts-group__items">
                      {g.items.map(item => (
                        <ShiftCard key={item.id} shift={item} onClick={() => handleShiftClick(item.id)} showDate={groupBy !== 'day'} />
                      ))}
                    </div>
                  </div>
                ))}
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
                    ({pagination.total} total)
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

      {loading && shifts.length > 0 && (
        <div className="shifts-list__loading-overlay">
          <Loader2 size={24} className="animate-spin" />
        </div>
      )}
    </div>
  )
}
