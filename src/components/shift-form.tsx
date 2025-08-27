'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { shiftSchema, type ShiftFormData, type PayRate } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { CalendarIcon, ClockIcon, DollarSignIcon } from 'lucide-react'
import { isLikelyPublicHoliday } from '@/lib/shift-calculations'

interface ShiftFormProps {
  initialData?: Partial<ShiftFormData>
  payRates: PayRate[]
  onSubmit: (data: ShiftFormData) => Promise<void>
  onCancel?: () => void
  isLoading?: boolean
}

interface PayEstimate {
  hourlyRate: number
  hoursWorked: number
  estimatedPay: number
  rateType: string
}

export default function ShiftForm({
  initialData,
  payRates,
  onSubmit,
  onCancel,
  isLoading = false
}: ShiftFormProps) {
  const [payEstimate, setPayEstimate] = useState<PayEstimate | null>(null)
  const [estimateLoading, setEstimateLoading] = useState(false)

  const form = useForm<ShiftFormData>({
    resolver: zodResolver(shiftSchema),
    defaultValues: {
      date: initialData?.date || new Date(),
      startTime: initialData?.startTime || new Date(),
      endTime: initialData?.endTime || new Date(),
      breakTime: initialData?.breakTime || 0,
      payRateId: initialData?.payRateId || '',
      isPublicHoliday: initialData?.isPublicHoliday || false,
      notes: initialData?.notes || '',
    },
  })

  const watchedValues = form.watch()

  // Auto-detect public holiday
  useEffect(() => {
    if (watchedValues.date && !initialData) {
      const isHoliday = isLikelyPublicHoliday(watchedValues.date)
      if (isHoliday && !watchedValues.isPublicHoliday) {
        form.setValue('isPublicHoliday', true)
      }
    }
  }, [watchedValues.date, form, initialData])

  // Calculate pay estimate when values change
  useEffect(() => {
    const calculateEstimate = async () => {
      if (!watchedValues.startTime || !watchedValues.endTime || !watchedValues.payRateId) {
        setPayEstimate(null)
        return
      }

      setEstimateLoading(true)

      try {
        const response = await fetch('/api/shifts/estimate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: watchedValues.date,
            startTime: watchedValues.startTime,
            endTime: watchedValues.endTime,
            breakTime: watchedValues.breakTime,
            payRateId: watchedValues.payRateId,
            isPublicHoliday: watchedValues.isPublicHoliday,
          }),
        })

        if (response.ok) {
          const estimate = await response.json()
          setPayEstimate(estimate)
        }
      } catch (error) {
        console.error('Error calculating estimate:', error)
      } finally {
        setEstimateLoading(false)
      }
    }

    const debounceTimer = setTimeout(calculateEstimate, 500)
    return () => clearTimeout(debounceTimer)
  }, [watchedValues.startTime, watchedValues.endTime, watchedValues.breakTime, watchedValues.payRateId, watchedValues.isPublicHoliday, watchedValues.date])

  const selectedPayRate = payRates.find(rate => rate.id === watchedValues.payRateId)

  const formatDateTime = (date: Date): string => {
    return date.toISOString().slice(0, 16) // YYYY-MM-DDTHH:MM format for datetime-local
  }

  const parseDateTime = (dateTimeString: string): Date => {
    return new Date(dateTimeString)
  }

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Date and Time Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Date & Time
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
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
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Time</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          value={formatDateTime(field.value)}
                          onChange={(e) => field.onChange(parseDateTime(e.target.value))}
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
                          type="datetime-local"
                          value={formatDateTime(field.value)}
                          onChange={(e) => field.onChange(parseDateTime(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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
                        placeholder="0"
                        value={field.value}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Pay Rate Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSignIcon className="h-5 w-5" />
                Pay Rate & Conditions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="payRateId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pay Rate</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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

              {selectedPayRate && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium">{selectedPayRate.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Base rate: ${Number(selectedPayRate.baseRate).toFixed(2)}/hr
                    {Number(selectedPayRate.multiplier) !== 1 && (
                      <span> × {Number(selectedPayRate.multiplier)}x</span>
                    )}
                  </p>
                  {selectedPayRate.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedPayRate.description}
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center space-x-2">
                <FormField
                  control={form.control}
                  name="isPublicHoliday"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <Label>Public Holiday</Label>
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Pay Estimate */}
          {payEstimate && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-800">
                  <ClockIcon className="h-5 w-5" />
                  Pay Estimate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="font-medium">Hours Worked</p>
                    <p className="text-lg font-bold text-green-800">
                      {payEstimate.hoursWorked.toFixed(2)}h
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">Hourly Rate</p>
                    <p className="text-lg font-bold text-green-800">
                      ${payEstimate.hourlyRate.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">Rate Type</p>
                    <Badge variant="secondary">{payEstimate.rateType}</Badge>
                  </div>
                  <div>
                    <p className="font-medium">Estimated Pay</p>
                    <p className="text-xl font-bold text-green-800">
                      ${payEstimate.estimatedPay.toFixed(2)}
                    </p>
                  </div>
                </div>
                {estimateLoading && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Recalculating...
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Notes Section */}
          <Card>
            <CardContent className="pt-6">
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Add any notes about this shift..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Submit Buttons */}
          <div className="flex justify-end space-x-2">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : initialData ? 'Update Shift' : 'Create Shift'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}