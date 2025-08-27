'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { 
  Calendar, 
  List, 
  BarChart3, 
  RefreshCw,
  AlertCircle
} from 'lucide-react'
import { type Shift, type PayRate } from '@/types'
import ShiftCalendar from '@/components/shift-calendar'
import ShiftList from '@/components/shift-list'
import ShiftQuickAdd from '@/components/shift-quick-add'
import UpcomingShifts from '@/components/upcoming-shifts'
import HoursSummary from '@/components/hours-summary'
import EarningsForecast from '@/components/earnings-forecast'
import BulkShiftOperations from '@/components/bulk-shift-operations'

export default function Roster() {
  const [shifts, setShifts] = useState<Array<Shift & { payRate: PayRate }>>([])
  const [payRates, setPayRates] = useState<PayRate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('calendar')

  // Fetch shifts and pay rates
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const [shiftsResponse, payRatesResponse] = await Promise.all([
          fetch('/api/shifts'),
          fetch('/api/pay-rates')
        ])

        if (!shiftsResponse.ok) throw new Error('Failed to fetch shifts')
        if (!payRatesResponse.ok) throw new Error('Failed to fetch pay rates')

        const shiftsData = await shiftsResponse.json()
        const payRatesData = await payRatesResponse.json()

        setShifts(shiftsData.shifts || [])
        setPayRates(payRatesData || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data')
        console.error('Error fetching roster data:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  // Handle shift creation
  const handleShiftCreated = (newShift: Shift & { payRate: PayRate }) => {
    setShifts(prev => [newShift, ...prev])
  }

  // Handle shift update
  const handleShiftUpdate = (updatedShift: Shift & { payRate: PayRate }) => {
    setShifts(prev => prev.map(shift => 
      shift.id === updatedShift.id ? updatedShift : shift
    ))
  }

  // Handle shift deletion
  const handleShiftDelete = async (shiftId: string) => {
    try {
      const response = await fetch(`/api/shifts/${shiftId}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete shift')

      setShifts(prev => prev.filter(shift => shift.id !== shiftId))
    } catch (err) {
      console.error('Error deleting shift:', err)
      // TODO: Add proper error handling/toast notification
    }
  }

  // Refresh data
  const handleRefresh = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/shifts')
      if (!response.ok) throw new Error('Failed to refresh shifts')
      
      const data = await response.json()
      setShifts(data.shifts || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh data')
    } finally {
      setIsLoading(false)
    }
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="h-5 w-5" />
              <h2 className="font-semibold">Error Loading Roster</h2>
            </div>
            <p className="text-red-700 mt-2">{error}</p>
            <Button 
              variant="outline" 
              className="mt-4" 
              onClick={handleRefresh}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const upcomingShifts = shifts
    .filter(shift => new Date(shift.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const totalScheduledHours = shifts.reduce((sum, shift) => sum + Number(shift.hoursWorked), 0)
  const totalScheduledEarnings = shifts.reduce((sum, shift) => sum + Number(shift.grossPay), 0)

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Roster & Shifts</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
            <span>{shifts.length} total shifts</span>
            <span>{totalScheduledHours.toFixed(1)}h scheduled</span>
            <span>${totalScheduledEarnings.toFixed(2)} total</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <BulkShiftOperations
            payRates={payRates}
            onShiftsCreated={() => {
              // Refresh the shifts list after bulk creation
              handleRefresh()
            }}
          />
          <ShiftQuickAdd 
            payRates={payRates}
            onShiftCreated={handleShiftCreated}
          />
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Calendar</span>
          </TabsTrigger>
          <TabsTrigger value="list" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            <span className="hidden sm:inline">List</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Analytics</span>
          </TabsTrigger>
          <TabsTrigger value="forecast" className="flex items-center gap-2">
            <Badge className="h-4 w-4" />
            <span className="hidden sm:inline">Forecast</span>
          </TabsTrigger>
        </TabsList>

        {/* Calendar View */}
        <TabsContent value="calendar" className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            <div className="xl:col-span-3">
              <ShiftCalendar
                shifts={shifts}
                payRates={payRates}
                onShiftCreate={handleShiftCreated}
                onShiftUpdate={handleShiftUpdate}
                onShiftDelete={handleShiftDelete}
              />
            </div>
            <div className="space-y-4">
              <UpcomingShifts 
                shifts={upcomingShifts}
                onViewAll={() => setActiveTab('list')}
              />
            </div>
          </div>
        </TabsContent>

        {/* List View */}
        <TabsContent value="list" className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            <div className="xl:col-span-3">
              <ShiftList
                shifts={shifts}
                onDeleteShift={handleShiftDelete}
                isLoading={isLoading}
              />
            </div>
            <div className="space-y-4">
              <UpcomingShifts 
                shifts={upcomingShifts}
                limit={3}
              />
            </div>
          </div>
        </TabsContent>

        {/* Analytics View */}
        <TabsContent value="analytics" className="space-y-4">
          <HoursSummary shifts={shifts} />
        </TabsContent>

        {/* Forecast View */}
        <TabsContent value="forecast" className="space-y-4">
          <EarningsForecast shifts={shifts} />
        </TabsContent>
      </Tabs>

      {/* Empty State for New Users */}
      {shifts.length === 0 && !isLoading && (
        <Card className="border-dashed">
          <CardContent className="text-center py-12">
            <Calendar className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No shifts scheduled yet</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Get started by creating your first shift. You can add individual shifts or set up recurring patterns.
            </p>
            <ShiftQuickAdd 
              payRates={payRates}
              onShiftCreated={handleShiftCreated}
              triggerText="Create Your First Shift"
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}