"use client"

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { payRateSchema, PayRateFormData, PayRate, RateType } from "@/types"
import { Loader2, Calculator, Clock, DollarSign, AlertCircle } from "lucide-react"

interface PayRateFormProps {
  initialData?: PayRate | null
  onSubmit: () => void
  onCancel: () => void
}

export function PayRateForm({ initialData, onSubmit, onCancel }: PayRateFormProps) {
  const [saving, setSaving] = useState(false)
  const [previewHours, setPreviewHours] = useState(8)

  const isEditing = !!initialData?.id

  const form = useForm<PayRateFormData>({
    resolver: zodResolver(payRateSchema),
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description || '',
      baseRate: initialData?.baseRate ? parseFloat(initialData.baseRate.toString()) : 25.00,
      effectiveFrom: initialData?.effectiveFrom ? new Date(initialData.effectiveFrom) : new Date(),
      effectiveTo: initialData?.effectiveTo ? new Date(initialData.effectiveTo) : undefined,
      rateType: initialData?.rateType || 'BASE',
      multiplier: initialData?.multiplier ? parseFloat(initialData.multiplier.toString()) : 1.0,
      isDefault: initialData?.isDefault || false,
      applyWeekend: initialData?.applyWeekend || false,
      applyPublicHoliday: initialData?.applyPublicHoliday || false,
      applyNight: initialData?.applyNight || false,
      nightStart: initialData?.nightStart || '22:00',
      nightEnd: initialData?.nightEnd || '06:00',
      overtimeThreshold: initialData?.overtimeThreshold ? parseFloat(initialData.overtimeThreshold.toString()) : undefined,
      overtimeMultiplier: initialData?.overtimeMultiplier ? parseFloat(initialData.overtimeMultiplier.toString()) : undefined,
    },
  })

  const watchedValues = form.watch()
  const rateType = form.watch('rateType')
  const applyNight = form.watch('applyNight')
  const baseRate = form.watch('baseRate') || 0
  const multiplier = form.watch('multiplier') || 1

  // Calculate effective hourly rate
  const effectiveRate = baseRate * multiplier

  // Calculate preview pay for given hours
  const calculatePreviewPay = () => {
    const overtimeThreshold = watchedValues.overtimeThreshold || 8
    const overtimeMultiplier = watchedValues.overtimeMultiplier || 1.5
    
    if (previewHours <= overtimeThreshold) {
      return previewHours * effectiveRate
    } else {
      const regularPay = overtimeThreshold * effectiveRate
      const overtimePay = (previewHours - overtimeThreshold) * (baseRate * overtimeMultiplier)
      return regularPay + overtimePay
    }
  }

  const handleSubmit = async (data: PayRateFormData) => {
    setSaving(true)
    try {
      const url = isEditing ? `/api/pay-rates/${initialData.id}` : '/api/pay-rates'
      const method = isEditing ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        onSubmit()
      } else {
        const errorData = await response.json()
        console.error('Failed to save pay rate:', errorData)
        // You could add toast notifications here
      }
    } catch (error) {
      console.error('Failed to save pay rate:', error)
    } finally {
      setSaving(false)
    }
  }

  const getRateTypeDescription = (type: RateType) => {
    switch (type) {
      case 'BASE':
        return 'Standard hourly rate for regular work'
      case 'OVERTIME':
        return 'Rate applied after working a certain number of hours'
      case 'PENALTY':
        return 'Additional rate for weekends, holidays, or night work'
      case 'ALLOWANCE':
        return 'Fixed allowance added to base pay'
      default:
        return ''
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Details */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Rate Details</CardTitle>
                <CardDescription>
                  Configure the basic details of this pay rate
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rate Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Standard Rate, Weekend Penalty" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Brief description of when this rate applies" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="rateType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rate Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select rate type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="BASE">Base Rate</SelectItem>
                            <SelectItem value="OVERTIME">Overtime</SelectItem>
                            <SelectItem value="PENALTY">Penalty Rate</SelectItem>
                            <SelectItem value="ALLOWANCE">Allowance</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>{getRateTypeDescription(rateType)}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isDefault"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel>Default Rate</FormLabel>
                          <FormDescription className="text-xs">
                            Use as default for this rate type
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="baseRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Base Rate ($/hour)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="25.00"
                              className="pl-8"
                              {...field}
                              value={field.value || ''}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="multiplier"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Multiplier</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            min="0"
                            placeholder="1.0"
                            {...field}
                            value={field.value || ''}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 1)}
                          />
                        </FormControl>
                        <FormDescription>
                          Effective rate: ${effectiveRate.toFixed(2)}/hour
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Effective Dates */}
            <Card>
              <CardHeader>
                <CardTitle>Effective Period</CardTitle>
                <CardDescription>
                  Set when this rate is active
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="effectiveFrom"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Effective From</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : ''}
                            onChange={(e) => field.onChange(new Date(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="effectiveTo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Effective Until (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : ''}
                            onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormDescription>Leave blank for ongoing rate</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Conditions */}
            <Card>
              <CardHeader>
                <CardTitle>Application Conditions</CardTitle>
                <CardDescription>
                  Configure when this rate applies
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="applyWeekend"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel className="text-sm">Weekends</FormLabel>
                          <FormDescription className="text-xs">
                            Apply on Sat/Sun
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="applyPublicHoliday"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel className="text-sm">Public Holidays</FormLabel>
                          <FormDescription className="text-xs">
                            Apply on holidays
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="applyNight"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel className="text-sm">Night Shift</FormLabel>
                          <FormDescription className="text-xs">
                            Apply during night hours
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                {applyNight && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <FormField
                      control={form.control}
                      name="nightStart"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Night Start Time</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Clock className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                              <Input
                                type="time"
                                className="pl-8"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="nightEnd"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Night End Time</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Clock className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                              <Input
                                type="time"
                                className="pl-8"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {rateType === 'OVERTIME' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <FormField
                      control={form.control}
                      name="overtimeThreshold"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Overtime After (hours)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.5"
                              min="0"
                              placeholder="8"
                              {...field}
                              value={field.value || ''}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                            />
                          </FormControl>
                          <FormDescription>Hours before overtime applies</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="overtimeMultiplier"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Overtime Multiplier</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.1"
                              min="1"
                              placeholder="1.5"
                              {...field}
                              value={field.value || ''}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                            />
                          </FormControl>
                          <FormDescription>Overtime rate multiplier</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Form Actions */}
            <div className="flex gap-2">
              <Button type="submit" disabled={saving} className="flex-1">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Update Rate' : 'Create Rate'}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={onCancel}
                disabled={saving}
              >
                Cancel
              </Button>
            </div>
          </div>

          {/* Preview Panel */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  Rate Preview
                </CardTitle>
                <CardDescription>
                  See how this rate affects pay calculations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Base Rate</Label>
                  <div className="text-2xl font-bold">${baseRate.toFixed(2)}/hr</div>
                </div>

                <div className="space-y-2">
                  <Label>Effective Rate</Label>
                  <div className="text-2xl font-bold text-green-600">
                    ${effectiveRate.toFixed(2)}/hr
                  </div>
                  {multiplier !== 1 && (
                    <div className="text-xs text-muted-foreground">
                      {baseRate.toFixed(2)} × {multiplier}
                    </div>
                  )}
                </div>

                <div className="border-t pt-4">
                  <Label>Pay Calculator</Label>
                  <div className="space-y-2 mt-2">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.5"
                        min="0"
                        max="24"
                        value={previewHours}
                        onChange={(e) => setPreviewHours(parseFloat(e.target.value) || 8)}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">hours =</span>
                    </div>
                    <div className="text-xl font-bold">
                      ${calculatePreviewPay().toFixed(2)}
                    </div>
                  </div>
                </div>

                {rateType === 'OVERTIME' && watchedValues.overtimeThreshold && (
                  <div className="border-t pt-4">
                    <div className="flex items-center gap-2 text-sm text-amber-600">
                      <AlertCircle className="h-4 w-4" />
                      <span>Overtime after {watchedValues.overtimeThreshold} hrs</span>
                    </div>
                  </div>
                )}

                <div className="border-t pt-4">
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>Type: {rateType}</div>
                    <div>Default: {watchedValues.isDefault ? 'Yes' : 'No'}</div>
                    {watchedValues.applyWeekend && <div>• Weekend applicable</div>}
                    {watchedValues.applyPublicHoliday && <div>• Holiday applicable</div>}
                    {watchedValues.applyNight && <div>• Night shift applicable</div>}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </Form>
  )
}