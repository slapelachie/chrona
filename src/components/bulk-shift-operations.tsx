'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { addDays, eachDayOfInterval, format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { 
  Copy, 
  Calendar,
  Clock,
  RefreshCw,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import { type PayRate } from '@/types'

const recurringShiftSchema = z.object({
  // Basic shift details
  startTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
  endTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
  breakTime: z.number().min(0).max(8),
  payRateId: z.string().min(1, "Pay rate is required"),
  notes: z.string().optional(),
  
  // Pattern details
  patternType: z.enum(['daily', 'weekly', 'custom']),
  startDate: z.date(),
  endDate: z.date(),
  interval: z.number().min(1).max(30),
  
  // Weekly pattern options
  daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
  
  // Holiday handling
  skipPublicHolidays: z.boolean(),
  markPublicHolidays: z.boolean(),
})

type RecurringShiftFormData = z.infer<typeof recurringShiftSchema>

interface BulkShiftOperationsProps {
  payRates: PayRate[]
  onShiftsCreated?: (shifts: any[]) => void
  triggerText?: string
}

const DAYS_OF_WEEK = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
]

export default function BulkShiftOperations({
  payRates,
  onShiftsCreated,
  triggerText = 'Bulk Operations'
}: BulkShiftOperationsProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [previewShifts, setPreviewShifts] = useState<any[]>([])
  const [operationType, setOperationType] = useState<'recurring' | 'copy' | 'template'>('recurring')

  const form = useForm<RecurringShiftFormData>({
    resolver: zodResolver(recurringShiftSchema),
    defaultValues: {
      startTime: '09:00',
      endTime: '17:00',
      breakTime: 0.5,
      payRateId: '',
      notes: '',
      patternType: 'weekly',
      startDate: new Date(),
      endDate: addDays(new Date(), 30),
      interval: 1,
      daysOfWeek: [1, 2, 3, 4, 5], // Monday to Friday
      skipPublicHolidays: false,
      markPublicHolidays: true,
    },
  })

  const watchedValues = form.watch()

  // Generate preview shifts
  const generatePreview = () => {
    const data = form.getValues()
    const shifts: any[] = []
    
    const dateRange = eachDayOfInterval({
      start: data.startDate,
      end: data.endDate,
    })

    dateRange.forEach((date, index) => {
      let shouldInclude = false

      switch (data.patternType) {
        case 'daily':
          shouldInclude = index % data.interval === 0
          break
        case 'weekly':
          if (data.daysOfWeek && data.daysOfWeek.length > 0) {
            shouldInclude = data.daysOfWeek.includes(date.getDay())
          }
          break
        case 'custom':
          shouldInclude = index % data.interval === 0
          break
      }

      if (shouldInclude) {
        // Create start and end datetime objects
        const [startHour, startMinute] = data.startTime.split(':').map(Number)
        const [endHour, endMinute] = data.endTime.split(':').map(Number)
        
        const startDateTime = new Date(date)
        startDateTime.setHours(startHour, startMinute, 0, 0)
        
        const endDateTime = new Date(date)
        endDateTime.setHours(endHour, endMinute, 0, 0)
        
        // Handle overnight shifts
        if (endDateTime <= startDateTime) {
          endDateTime.setDate(endDateTime.getDate() + 1)
        }

        shifts.push({
          date,
          startTime: startDateTime,
          endTime: endDateTime,
          breakTime: data.breakTime,
          payRateId: data.payRateId,
          notes: data.notes,
          isPublicHoliday: data.markPublicHolidays && isLikelyPublicHoliday(date),
        })
      }
    })

    setPreviewShifts(shifts.slice(0, 10)) // Limit preview to 10 shifts
  }

  // Simple public holiday detection (same as in shift-calculations.ts)
  const isLikelyPublicHoliday = (date: Date): boolean => {
    const month = date.getMonth() + 1
    const day = date.getDate()

    const fixedHolidays = [
      { month: 1, day: 1 },   // New Year's Day
      { month: 1, day: 26 },  // Australia Day
      { month: 4, day: 25 },  // ANZAC Day
      { month: 12, day: 25 }, // Christmas Day
      { month: 12, day: 26 }, // Boxing Day
    ]

    return fixedHolidays.some(holiday => 
      holiday.month === month && holiday.day === day
    )
  }

  const handleSubmit = async (data: RecurringShiftFormData) => {
    setIsLoading(true)
    
    try {
      const response = await fetch('/api/shifts/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: 'recurring',
          shift: {
            date: data.startDate,
            startTime: data.startTime,
            endTime: data.endTime,
            breakTime: data.breakTime,
            payRateId: data.payRateId,
            notes: data.notes,
            isPublicHoliday: false, // Will be calculated per shift
          },
          pattern: {
            type: data.patternType,
            interval: data.interval,
            endDate: data.endDate,
            daysOfWeek: data.daysOfWeek,
          },
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create recurring shifts')
      }

      const result = await response.json()
      onShiftsCreated?.(result)
      setOpen(false)
      form.reset()
      setPreviewShifts([])
    } catch (error) {
      console.error('Error creating recurring shifts:', error)
      // TODO: Add proper error handling/toast notification
    } finally {
      setIsLoading(false)
    }
  }

  const selectedPayRate = payRates.find(rate => rate.id === watchedValues.payRateId)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Copy className="h-4 w-4" />
          {triggerText}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Shift Operations</DialogTitle>
          <DialogDescription>
            Create multiple shifts at once using patterns and templates.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Operation Type Selection */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={operationType === 'recurring' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setOperationType('recurring')}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Recurring Pattern
            </Button>
            <Button
              type="button"
              variant={operationType === 'copy' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setOperationType('copy')}
              disabled
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Existing (Coming Soon)
            </Button>
          </div>

          {operationType === 'recurring' && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                {/* Shift Details */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Shift Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="startTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Start Time</FormLabel>
                            <FormControl>
                              <Input
                                type="time"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="endTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>End Time</FormLabel>
                            <FormControl>
                              <Input
                                type="time"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="breakTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Break Time (hours)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.25"
                                min="0"
                                max="8"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="payRateId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pay Rate</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a pay rate" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {payRates.map((rate) => (
                                <SelectItem key={rate.id} value={rate.id}>
                                  <div className="flex items-center justify-between w-full">
                                    <span>{rate.name}</span>
                                    <Badge variant="secondary" className="ml-2">
                                      ${Number(rate.baseRate).toFixed(2)}/hr
                                    </Badge>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes (optional)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Add notes for all shifts..."
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Pattern Configuration */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Pattern Configuration</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="startDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Start Date</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                value={field.value.toISOString().split('T')[0]}
                                onChange={(e) => field.onChange(new Date(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="endDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>End Date</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                value={field.value.toISOString().split('T')[0]}
                                onChange={(e) => field.onChange(new Date(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="patternType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pattern Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="daily">Daily</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="custom">Custom Interval</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {watchedValues.patternType === 'weekly' && (
                      <FormField
                        control={form.control}
                        name="daysOfWeek"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Days of Week</FormLabel>
                            <div className="grid grid-cols-7 gap-2">
                              {DAYS_OF_WEEK.map((day) => (
                                <div key={day.value} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`day-${day.value}`}
                                    checked={field.value?.includes(day.value) || false}
                                    onCheckedChange={(checked) => {
                                      const current = field.value || []
                                      if (checked) {
                                        field.onChange([...current, day.value])
                                      } else {
                                        field.onChange(current.filter(d => d !== day.value))
                                      }
                                    }}
                                  />
                                  <Label 
                                    htmlFor={`day-${day.value}`}
                                    className="text-xs"
                                  >
                                    {day.label.slice(0, 3)}
                                  </Label>
                                </div>
                              ))}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {(watchedValues.patternType === 'daily' || watchedValues.patternType === 'custom') && (
                      <FormField
                        control={form.control}
                        name="interval"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Interval (every {field.value} {watchedValues.patternType === 'daily' ? 'days' : 'days'})
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="1"
                                max="30"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <div className="space-y-2">
                      <FormField
                        control={form.control}
                        name="markPublicHolidays"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2">
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <Label>Mark shifts on public holidays</Label>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="skipPublicHolidays"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2">
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <Label>Skip creating shifts on public holidays</Label>
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Preview */}
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-sm">Preview</CardTitle>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={generatePreview}
                        disabled={!watchedValues.payRateId}
                      >
                        Generate Preview
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {previewShifts.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground mb-3">
                          Showing first {previewShifts.length} shifts (of many)
                        </p>
                        {previewShifts.map((shift, index) => (
                          <div key={index} className="flex items-center justify-between p-2 border rounded text-sm">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span>{format(shift.date, 'EEE, MMM dd, yyyy')}</span>
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span>
                                {watchedValues.startTime} - {watchedValues.endTime}
                              </span>
                              {shift.isPublicHoliday && (
                                <Badge variant="destructive" className="text-xs">Holiday</Badge>
                              )}
                            </div>
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                        <p>Select a pay rate and click "Generate Preview" to see the shifts that will be created.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Submit Buttons */}
                <div className="flex justify-end space-x-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isLoading || previewShifts.length === 0}
                  >
                    {isLoading ? 'Creating Shifts...' : `Create ${previewShifts.length}+ Shifts`}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}