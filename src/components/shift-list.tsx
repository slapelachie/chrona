'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Clock, 
  DollarSign, 
  Calendar, 
  Search, 
  Filter,
  Edit2,
  Trash2,
  Moon,
  Sun
} from 'lucide-react'
import { type Shift, type PayRate } from '@/types'

interface ShiftListProps {
  shifts: Array<Shift & { payRate: PayRate }>
  onEditShift?: (shift: Shift & { payRate: PayRate }) => void
  onDeleteShift?: (shiftId: string) => void
  isLoading?: boolean
}

interface ShiftFilters {
  search: string
  payRateId: string
  dateRange: 'all' | 'week' | 'month'
  sortBy: 'date' | 'hours' | 'pay'
  sortOrder: 'asc' | 'desc'
}

export default function ShiftList({ 
  shifts, 
  onEditShift, 
  onDeleteShift, 
  isLoading = false 
}: ShiftListProps) {
  const [filters, setFilters] = useState<ShiftFilters>({
    search: '',
    payRateId: '',
    dateRange: 'all',
    sortBy: 'date',
    sortOrder: 'desc',
  })

  // Get unique pay rates for filter
  const payRates = Array.from(
    new Map(shifts.map(shift => [shift.payRate.id, shift.payRate])).values()
  )

  // Filter and sort shifts
  const filteredShifts = shifts
    .filter(shift => {
      // Search filter
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase()
        const matchesSearch = 
          shift.payRate.name.toLowerCase().includes(searchTerm) ||
          (shift.notes && shift.notes.toLowerCase().includes(searchTerm))
        if (!matchesSearch) return false
      }

      // Pay rate filter
      if (filters.payRateId && shift.payRateId !== filters.payRateId) {
        return false
      }

      // Date range filter
      if (filters.dateRange !== 'all') {
        const now = new Date()
        const shiftDate = new Date(shift.date)
        
        if (filters.dateRange === 'week') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          if (shiftDate < weekAgo) return false
        } else if (filters.dateRange === 'month') {
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          if (shiftDate < monthAgo) return false
        }
      }

      return true
    })
    .sort((a, b) => {
      let aValue: any, bValue: any

      switch (filters.sortBy) {
        case 'date':
          aValue = new Date(a.date).getTime()
          bValue = new Date(b.date).getTime()
          break
        case 'hours':
          aValue = Number(a.hoursWorked)
          bValue = Number(b.hoursWorked)
          break
        case 'pay':
          aValue = Number(a.grossPay)
          bValue = Number(b.grossPay)
          break
        default:
          return 0
      }

      if (filters.sortOrder === 'asc') {
        return aValue - bValue
      } else {
        return bValue - aValue
      }
    })

  const totalHours = filteredShifts.reduce((sum, shift) => sum + Number(shift.hoursWorked), 0)
  const totalPay = filteredShifts.reduce((sum, shift) => sum + Number(shift.grossPay), 0)

  return (
    <div className="space-y-4">
      {/* Filters and Summary */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Shift List ({filteredShifts.length})
            </CardTitle>
            <div className="text-sm text-muted-foreground">
              Total: {totalHours.toFixed(1)}h • ${totalPay.toFixed(2)}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search shifts..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="pl-10"
              />
            </div>

            <Select
              value={filters.payRateId}
              onValueChange={(value) => setFilters(prev => ({ ...prev, payRateId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="All pay rates" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All pay rates</SelectItem>
                {payRates.map(rate => (
                  <SelectItem key={rate.id} value={rate.id}>
                    {rate.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.dateRange}
              onValueChange={(value: any) => setFilters(prev => ({ ...prev, dateRange: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="week">Last 7 days</SelectItem>
                <SelectItem value="month">Last 30 days</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={`${filters.sortBy}-${filters.sortOrder}`}
              onValueChange={(value) => {
                const [sortBy, sortOrder] = value.split('-')
                setFilters(prev => ({ 
                  ...prev, 
                  sortBy: sortBy as any, 
                  sortOrder: sortOrder as any 
                }))
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-desc">Date (newest)</SelectItem>
                <SelectItem value="date-asc">Date (oldest)</SelectItem>
                <SelectItem value="hours-desc">Hours (most)</SelectItem>
                <SelectItem value="hours-asc">Hours (least)</SelectItem>
                <SelectItem value="pay-desc">Pay (highest)</SelectItem>
                <SelectItem value="pay-asc">Pay (lowest)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Shift Cards */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground mt-2">Loading shifts...</p>
          </div>
        ) : filteredShifts.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">No shifts found</h3>
              <p className="text-muted-foreground">
                {filters.search || filters.payRateId || filters.dateRange !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Create your first shift to get started'
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredShifts.map((shift) => (
            <Card key={shift.id} className="transition-shadow hover:shadow-md">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                  {/* Shift Info */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{shift.payRate.name}</h3>
                      <div className="flex gap-1">
                        {shift.isPublicHoliday && (
                          <Badge variant="destructive" className="text-xs">Holiday</Badge>
                        )}
                        {shift.isNightShift && (
                          <Badge variant="secondary" className="text-xs">
                            <Moon className="h-3 w-3 mr-1" />
                            Night
                          </Badge>
                        )}
                        {shift.payRate.rateType === 'PENALTY' && (
                          <Badge variant="outline" className="text-xs">Penalty</Badge>
                        )}
                        {shift.payRate.rateType === 'OVERTIME' && (
                          <Badge variant="secondary" className="text-xs">Overtime</Badge>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{format(new Date(shift.date), 'MMM dd, yyyy')}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {format(new Date(shift.startTime), 'HH:mm')} - {format(new Date(shift.endTime), 'HH:mm')}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Sun className="h-4 w-4 text-muted-foreground" />
                        <span>{Number(shift.hoursWorked).toFixed(1)}h worked</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">${Number(shift.grossPay).toFixed(2)}</span>
                      </div>
                    </div>

                    {shift.notes && (
                      <p className="text-sm text-muted-foreground italic">
                        {shift.notes}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 shrink-0">
                    {onEditShift && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEditShift(shift)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    )}
                    {onDeleteShift && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDeleteShift(shift.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}