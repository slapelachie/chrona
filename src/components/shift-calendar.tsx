'use client'

import { useState, useCallback, useMemo } from 'react'
import { Calendar, dateFnsLocalizer, View, Views } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { enUS } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List, BarChart3 } from 'lucide-react'
import { type Shift, type PayRate } from '@/types'
import ShiftForm from './shift-form'
import 'react-big-calendar/lib/css/react-big-calendar.css'

const locales = {
  'en-US': enUS,
}

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
})

interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  resource: Shift & { payRate: PayRate }
}

interface ShiftCalendarProps {
  shifts: Array<Shift & { payRate: PayRate }>
  payRates: PayRate[]
  onShiftCreate?: (shift: any) => void
  onShiftUpdate?: (shift: any) => void
  onShiftDelete?: (shiftId: string) => void
}

export default function ShiftCalendar({
  shifts,
  payRates,
  onShiftCreate,
  onShiftUpdate,
  onShiftDelete,
}: ShiftCalendarProps) {
  const [view, setView] = useState<View>(Views.WEEK)
  const [date, setDate] = useState(new Date())
  const [selectedShift, setSelectedShift] = useState<(Shift & { payRate: PayRate }) | null>(null)
  const [showShiftDialog, setShowShiftDialog] = useState(false)
  const [isCreateMode, setIsCreateMode] = useState(false)
  const [newShiftSlot, setNewShiftSlot] = useState<{ start: Date; end: Date } | null>(null)

  // Transform shifts to calendar events
  const events: CalendarEvent[] = useMemo(() => {
    return shifts.map((shift) => ({
      id: shift.id,
      title: `${shift.payRate.name} - $${Number(shift.grossPay).toFixed(0)}`,
      start: new Date(shift.startTime),
      end: new Date(shift.endTime),
      resource: shift,
    }))
  }, [shifts])

  // Custom event style based on shift type
  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    const shift = event.resource
    let backgroundColor = '#3174ad' // Default blue

    // Color coding based on rate type or conditions
    if (shift.isPublicHoliday) {
      backgroundColor = '#dc2626' // Red for public holidays
    } else if (shift.isNightShift) {
      backgroundColor = '#7c3aed' // Purple for night shifts
    } else if (shift.payRate.rateType === 'PENALTY') {
      backgroundColor = '#ea580c' // Orange for penalty rates
    } else if (shift.payRate.rateType === 'OVERTIME') {
      backgroundColor = '#059669' // Green for overtime
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        opacity: 0.8,
        color: 'white',
        border: '0px',
        display: 'block',
      },
    }
  }, [])

  // Handle selecting a time slot for new shift
  const handleSelectSlot = useCallback(
    ({ start, end }: { start: Date; end: Date }) => {
      setNewShiftSlot({ start, end })
      setSelectedShift(null)
      setIsCreateMode(true)
      setShowShiftDialog(true)
    },
    []
  )

  // Handle selecting an existing shift
  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    setSelectedShift(event.resource)
    setIsCreateMode(false)
    setShowShiftDialog(true)
  }, [])

  // Handle creating a new shift
  const handleCreateShift = async (data: any) => {
    try {
      const response = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) throw new Error('Failed to create shift')

      const newShift = await response.json()
      onShiftCreate?.(newShift)
      setShowShiftDialog(false)
      setNewShiftSlot(null)
    } catch (error) {
      console.error('Error creating shift:', error)
    }
  }

  // Handle updating an existing shift
  const handleUpdateShift = async (data: any) => {
    if (!selectedShift) return

    try {
      const response = await fetch(`/api/shifts/${selectedShift.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) throw new Error('Failed to update shift')

      const updatedShift = await response.json()
      onShiftUpdate?.(updatedShift)
      setShowShiftDialog(false)
      setSelectedShift(null)
    } catch (error) {
      console.error('Error updating shift:', error)
    }
  }

  // Handle deleting a shift
  const handleDeleteShift = async () => {
    if (!selectedShift) return

    try {
      const response = await fetch(`/api/shifts/${selectedShift.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete shift')

      onShiftDelete?.(selectedShift.id)
      setShowShiftDialog(false)
      setSelectedShift(null)
    } catch (error) {
      console.error('Error deleting shift:', error)
    }
  }

  // Custom toolbar
  const CustomToolbar = ({ date, view, onNavigate, onView }: any) => {
    return (
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate('PREV')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold min-w-0 flex-1">
            {format(date, view === 'month' ? 'MMMM yyyy' : 'MMM dd, yyyy')}
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate('NEXT')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={view === 'month' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onView('month')}
          >
            <CalendarIcon className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Month</span>
          </Button>
          <Button
            variant={view === 'week' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onView('week')}
          >
            <List className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Week</span>
          </Button>
          <Button
            variant={view === 'day' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onView('day')}
          >
            <BarChart3 className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Day</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate('TODAY')}
          >
            Today
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="h-[600px] bg-white rounded-lg border p-4">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          view={view}
          date={date}
          onView={setView}
          onNavigate={setDate}
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          selectable
          eventPropGetter={eventStyleGetter}
          components={{
            toolbar: CustomToolbar,
          }}
          step={15}
          timeslots={4}
          min={new Date(0, 0, 0, 6, 0, 0)} // 6 AM
          max={new Date(0, 0, 0, 23, 59, 59)} // 11:59 PM
        />
      </div>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge style={{ backgroundColor: '#3174ad' }}>Base Rate</Badge>
            <Badge style={{ backgroundColor: '#ea580c' }}>Penalty Rate</Badge>
            <Badge style={{ backgroundColor: '#059669' }}>Overtime</Badge>
            <Badge style={{ backgroundColor: '#7c3aed' }}>Night Shift</Badge>
            <Badge style={{ backgroundColor: '#dc2626' }}>Public Holiday</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Shift Details/Edit Dialog */}
      <Dialog open={showShiftDialog} onOpenChange={setShowShiftDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isCreateMode ? 'Create New Shift' : 'Edit Shift'}
            </DialogTitle>
            <DialogDescription>
              {isCreateMode 
                ? 'Create a new shift for the selected time slot.'
                : 'Update shift details and pay calculations.'
              }
            </DialogDescription>
          </DialogHeader>

          {isCreateMode && newShiftSlot ? (
            <ShiftForm
              initialData={{
                date: newShiftSlot.start,
                startTime: newShiftSlot.start,
                endTime: newShiftSlot.end,
                breakTime: 0,
                payRateId: payRates.find(r => r.isDefault)?.id || '',
                isPublicHoliday: false,
                notes: '',
              }}
              payRates={payRates}
              onSubmit={handleCreateShift}
              onCancel={() => setShowShiftDialog(false)}
            />
          ) : selectedShift ? (
            <div className="space-y-4">
              <ShiftForm
                initialData={{
                  date: new Date(selectedShift.date),
                  startTime: new Date(selectedShift.startTime),
                  endTime: new Date(selectedShift.endTime),
                  breakTime: Number(selectedShift.breakTime),
                  payRateId: selectedShift.payRateId,
                  isPublicHoliday: selectedShift.isPublicHoliday,
                  notes: selectedShift.notes || '',
                }}
                payRates={payRates}
                onSubmit={handleUpdateShift}
                onCancel={() => setShowShiftDialog(false)}
              />
              
              <div className="flex justify-between pt-4 border-t">
                <Button
                  variant="destructive"
                  onClick={handleDeleteShift}
                >
                  Delete Shift
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}