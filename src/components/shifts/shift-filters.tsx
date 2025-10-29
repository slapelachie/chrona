'use client'

import React, { useState, useEffect } from 'react'
import { Button, Input, Card, CardBody } from '../ui'
import { 
  Search, 
  Filter, 
  X, 
  Calendar,
  Loader2 
} from 'lucide-react'
import { ShiftFilters as ShiftFiltersType, PayGuideSummary, ApiResponse } from '@/types'
import './shift-filters.scss'

interface ShiftFiltersProps {
  filters: ShiftFiltersType
  onFiltersChange: (filters: Partial<ShiftFiltersType>) => void
  loading?: boolean
}

export const ShiftFilters: React.FC<ShiftFiltersProps> = ({
  filters,
  onFiltersChange,
  loading = false
}) => {
  const [showFilters, setShowFilters] = useState(false)
  const [payGuides, setPayGuides] = useState<PayGuideSummary[]>([])
  const [loadingPayGuides, setLoadingPayGuides] = useState(false)

  // Local state for form inputs
  const [localFilters, setLocalFilters] = useState({
    startDate: filters.startDate || '',
    endDate: filters.endDate || '',
    payGuideId: filters.payGuideId || '',
    sortBy: filters.sortBy || 'startDate',
    sortOrder: filters.sortOrder || 'desc'
  })

  const fetchPayGuides = async () => {
    try {
      setLoadingPayGuides(true)
      const response = await fetch('/api/pay-rates?fields=id,name&limit=100')
      
      if (!response.ok) {
        throw new Error('Failed to fetch pay guides')
      }

      const result: ApiResponse<{ payGuides: PayGuideSummary[] }> = await response.json()
      
      if (result.data) {
        setPayGuides(result.data.payGuides)
      }
    } catch (err) {
      console.error('Error fetching pay guides:', err)
    } finally {
      setLoadingPayGuides(false)
    }
  }

  useEffect(() => {
    if (showFilters && payGuides.length === 0) {
      fetchPayGuides()
    }
  }, [showFilters, payGuides.length])

  useEffect(() => {
    setLocalFilters({
      startDate: filters.startDate || '',
      endDate: filters.endDate || '',
      payGuideId: filters.payGuideId || '',
      sortBy: filters.sortBy || 'startDate',
      sortOrder: filters.sortOrder || 'desc'
    })
  }, [filters])

  const handleApplyFilters = () => {
    onFiltersChange({
      startDate: localFilters.startDate || undefined,
      endDate: localFilters.endDate || undefined,
      payGuideId: localFilters.payGuideId || undefined,
      sortBy: localFilters.sortBy,
      sortOrder: localFilters.sortOrder as 'asc' | 'desc',
      page: 1 // Reset to first page when applying filters
    })
    setShowFilters(false)
  }

  const handleClearFilters = () => {
    const clearedFilters = {
      startDate: '',
      endDate: '',
      payGuideId: '',
      sortBy: 'startDate',
      sortOrder: 'desc' as const
    }
    
    setLocalFilters(clearedFilters)
    onFiltersChange({
      startDate: undefined,
      endDate: undefined,
      payGuideId: undefined,
      sortBy: 'startDate',
      sortOrder: 'desc',
      page: 1
    })
    setShowFilters(false)
  }

  const hasActiveFilters = filters.startDate || filters.endDate || filters.payGuideId

  return (
    <div className="shift-filters">
      <div className="shift-filters__header">
        <div className="shift-filters__search">
          <Input
            placeholder="Search by notes..."
            leftIcon={<Search size={18} />}
            // TODO: Implement search functionality when backend supports it
            disabled
          />
        </div>

        <Button
          variant={hasActiveFilters ? 'primary' : 'outline'}
          leftIcon={<Filter size={18} />}
          onClick={() => setShowFilters(!showFilters)}
        >
          Filters
          {hasActiveFilters && <span className="shift-filters__active-indicator" />}
        </Button>
      </div>

      {showFilters && (
        <Card variant="outlined" className="shift-filters__panel">
          <CardBody>
            <div className="shift-filters__form">
              <div className="shift-filters__row">
                <div className="shift-filters__field">
                  <label htmlFor="startDate">Start Date</label>
                  <Input
                    id="startDate"
                    type="date"
                    value={localFilters.startDate}
                    onChange={(e) => setLocalFilters(prev => ({ ...prev, startDate: e.target.value }))}
                    leftIcon={<Calendar size={18} />}
                  />
                </div>

                <div className="shift-filters__field">
                  <label htmlFor="endDate">End Date</label>
                  <Input
                    id="endDate"
                    type="date"
                    value={localFilters.endDate}
                    onChange={(e) => setLocalFilters(prev => ({ ...prev, endDate: e.target.value }))}
                    leftIcon={<Calendar size={18} />}
                  />
                </div>
              </div>

              <div className="shift-filters__row">
                <div className="shift-filters__field">
                  <label htmlFor="payGuideId">Pay Guide</label>
                  <select
                    id="payGuideId"
                    value={localFilters.payGuideId}
                    onChange={(e) => setLocalFilters(prev => ({ ...prev, payGuideId: e.target.value }))}
                    className="shift-filters__select"
                    disabled={loadingPayGuides}
                  >
                    <option value="">All Pay Guides</option>
                    {payGuides.map(guide => (
                      <option key={guide.id} value={guide.id}>
                        {guide.name}
                      </option>
                    ))}
                  </select>
                  {loadingPayGuides && (
                    <Loader2 size={16} className="shift-filters__loading animate-spin" />
                  )}
                </div>

                <div className="shift-filters__field">
                  <label htmlFor="sortBy">Sort By</label>
                  <select
                    id="sortBy"
                    value={localFilters.sortBy}
                    onChange={(e) => setLocalFilters(prev => ({ ...prev, sortBy: e.target.value }))}
                    className="shift-filters__select"
                  >
                    <option value="startDate">Period Start</option>
                    <option value="endDate">Period End</option>
                    <option value="totalPay">Total Pay</option>
                    <option value="createdAt">Date Added</option>
                  </select>
                </div>
              </div>

              <div className="shift-filters__row">
                <div className="shift-filters__field">
                  <label htmlFor="sortOrder">Sort Order</label>
                  <select
                    id="sortOrder"
                    value={localFilters.sortOrder}
                    onChange={(e) =>
                      setLocalFilters(prev => ({ ...prev, sortOrder: e.target.value as 'asc' | 'desc' }))
                    }
                    className="shift-filters__select"
                  >
                    <option value="desc">Newest First</option>
                    <option value="asc">Oldest First</option>
                  </select>
                </div>
              </div>

              <div className="shift-filters__actions">
                <Button
                  variant="outline"
                  leftIcon={<X size={18} />}
                  onClick={handleClearFilters}
                >
                  Clear All
                </Button>
                
                <Button
                  variant="primary"
                  onClick={handleApplyFilters}
                  disabled={loading}
                  isLoading={loading}
                >
                  Apply Filters
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  )
}
