"use client"

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/components/ui/form"
import { settingsSchema, SettingsFormData, Settings, PayRate } from "@/types"
import { Loader2, Plus } from "lucide-react"

export default function SettingsPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [payRates, setPayRates] = useState<PayRate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingTax, setEditingTax] = useState(false)
  const [editingPeriod, setEditingPeriod] = useState(false)
  const [editingAdvanced, setEditingAdvanced] = useState(false)

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
  })

  // Fetch settings and pay rates on mount
  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [settingsRes, ratesRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/pay-rates')
      ])
      
      const settingsData = await settingsRes.json()
      const ratesData = await ratesRes.json()
      
      setSettings(settingsData)
      setPayRates(ratesData)
      
      // Initialize form with fetched data
      form.reset({
        taxFreeThreshold: settingsData.taxFreeThreshold,
        medicareExemption: settingsData.medicareExemption,
        hecsDebtAmount: settingsData.hecsDebtAmount ? parseFloat(settingsData.hecsDebtAmount) : undefined,
        hecsThreshold: settingsData.hecsThreshold ? parseFloat(settingsData.hecsThreshold) : undefined,
        hecsRate: settingsData.hecsRate ? parseFloat(settingsData.hecsRate) : undefined,
        extraTaxWithheld: parseFloat(settingsData.extraTaxWithheld),
        superRate: parseFloat(settingsData.superRate),
        payPeriodType: settingsData.payPeriodType,
        payPeriodStartDay: settingsData.payPeriodStartDay,
      })
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (data: SettingsFormData) => {
    setSaving(true)
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      
      if (response.ok) {
        const updatedSettings = await response.json()
        setSettings(updatedSettings)
        setEditingTax(false)
        setEditingPeriod(false)
        setEditingAdvanced(false)
      } else {
        console.error('Failed to update settings')
      }
    } catch (error) {
      console.error('Failed to update settings:', error)
    } finally {
      setSaving(false)
    }
  }

  const formatCurrency = (amount: unknown) => {
    if (!amount || parseFloat(String(amount)) === 0) return 'Not set'
    return `$${parseFloat(String(amount)).toLocaleString()}`
  }

  const formatRate = (rate: unknown) => {
    return `$${parseFloat(String(rate)).toFixed(2)}/hr`
  }

  const getDayName = (dayNumber: number) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    return days[dayNumber] || 'Monday'
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Personal Tax Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Personal Tax Settings</CardTitle>
                <CardDescription>
                  Configure your tax withholding preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!editingTax ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Tax-free threshold</Label>
                      <span className="text-sm text-muted-foreground">
                        {settings?.taxFreeThreshold ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Medicare exemption</Label>
                      <span className="text-sm text-muted-foreground">
                        {settings?.medicareExemption ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>HECS debt</Label>
                      <span className="text-sm text-muted-foreground">
                        {formatCurrency(settings?.hecsDebtAmount)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Extra tax withheld</Label>
                      <span className="text-sm text-muted-foreground">
                        {formatCurrency(settings?.extraTaxWithheld)}
                      </span>
                    </div>
                    <Button 
                      type="button"
                      variant="outline" 
                      className="w-full mt-4"
                      onClick={() => setEditingTax(true)}
                    >
                      Edit Tax Settings
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="taxFreeThreshold"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between space-y-0">
                          <FormLabel>Tax-free threshold</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="medicareExemption"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between space-y-0">
                          <FormLabel>Medicare exemption</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="hecsDebtAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>HECS debt amount</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="0" 
                              {...field}
                              value={field.value || ''}
                              onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                            />
                          </FormControl>
                          <FormDescription>Leave blank if no HECS debt</FormDescription>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="extraTaxWithheld"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Extra tax withheld per pay period</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01" 
                              placeholder="0" 
                              {...field}
                              value={field.value || 0}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <div className="flex gap-2">
                      <Button type="submit" disabled={saving} className="flex-1">
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setEditingTax(false)}
                        disabled={saving}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Advanced Tax Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Advanced Tax Settings</CardTitle>
                <CardDescription>
                  Multi-job tax scale, custom withholding, and scenario planning
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!editingAdvanced ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Tax Year</Label>
                      <span className="text-sm text-muted-foreground">
                        2024-25
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Multi-job tax scale</Label>
                      <span className="text-sm text-muted-foreground">
                        No
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Custom withholding rate</Label>
                      <span className="text-sm text-muted-foreground">
                        Not set
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Tax estimation scenarios</Label>
                      <span className="text-sm text-muted-foreground">
                        5 available
                      </span>
                    </div>
                    <Button 
                      type="button"
                      variant="outline" 
                      className="w-full mt-4"
                      onClick={() => setEditingAdvanced(true)}
                    >
                      Configure Advanced Settings
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Tax Year</Label>
                      <Select defaultValue="2024-25">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2024-25">2024-25</SelectItem>
                          <SelectItem value="2023-24">2023-24</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Select the tax year for calculations
                      </p>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Multi-job tax scale</Label>
                        <p className="text-xs text-muted-foreground">
                          No tax-free threshold for second job
                        </p>
                      </div>
                      <Switch />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Custom withholding rate (%)</Label>
                      <Input 
                        type="number" 
                        step="0.1"
                        placeholder="Optional custom rate"
                      />
                      <p className="text-xs text-muted-foreground">
                        Override standard withholding calculations
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Tax refund strategy</Label>
                      <Select defaultValue="balanced">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="conservative">Conservative (minimal refund)</SelectItem>
                          <SelectItem value="balanced">Balanced</SelectItem>
                          <SelectItem value="aggressive">Aggressive (larger refund)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Adjust withholding for desired refund size
                      </p>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button type="button" className="flex-1" disabled>
                        Save Advanced Settings
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setEditingAdvanced(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                    
                    <div className="text-xs text-muted-foreground bg-blue-50 p-3 rounded-lg">
                      <p className="font-medium mb-1">Coming Soon:</p>
                      <ul className="space-y-1">
                        <li>• Tax scenario comparisons</li>
                        <li>• Automatic tax optimization suggestions</li>
                        <li>• Historical tax year support</li>
                        <li>• Multi-job income tracking</li>
                      </ul>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Pay Rates */}
            <Card>
              <CardHeader>
                <CardTitle>Pay Rates</CardTitle>
                <CardDescription>
                  Manage your hourly rates and penalty rates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {payRates.slice(0, 3).map((rate) => (
                    <div key={rate.id} className="flex items-center justify-between">
                      <Label className="text-sm font-medium">{rate.name}</Label>
                      <span className="text-sm text-muted-foreground">
                        {formatRate(rate.baseRate)}
                      </span>
                    </div>
                  ))}
                  {payRates.length > 3 && (
                    <div className="text-sm text-muted-foreground">
                      +{payRates.length - 3} more rates
                    </div>
                  )}
                </div>
                <Button 
                  variant="outline" 
                  className="w-full mt-4"
                  onClick={() => router.push('/settings/pay-rates')}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Manage Pay Rates
                </Button>
              </CardContent>
            </Card>
            
            {/* Pay Period Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Pay Period Settings</CardTitle>
                <CardDescription>
                  Configure your pay period preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!editingPeriod ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Pay frequency</Label>
                      <span className="text-sm text-muted-foreground">
                        {settings?.payPeriodType?.toLowerCase()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Pay period start</Label>
                      <span className="text-sm text-muted-foreground">
                        {getDayName(settings?.payPeriodStartDay || 1)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Superannuation</Label>
                      <span className="text-sm text-muted-foreground">
                        {settings?.superRate ? parseFloat(settings.superRate.toString()).toFixed(1) : '11.0'}%
                      </span>
                    </div>
                    <Button 
                      type="button"
                      variant="outline" 
                      className="w-full mt-4"
                      onClick={() => setEditingPeriod(true)}
                    >
                      Edit Settings
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="payPeriodType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pay frequency</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select pay frequency" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="WEEKLY">Weekly</SelectItem>
                              <SelectItem value="FORTNIGHTLY">Fortnightly</SelectItem>
                              <SelectItem value="MONTHLY">Monthly</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="payPeriodStartDay"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pay period start day</FormLabel>
                          <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select start day" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="1">Monday</SelectItem>
                              <SelectItem value="2">Tuesday</SelectItem>
                              <SelectItem value="3">Wednesday</SelectItem>
                              <SelectItem value="4">Thursday</SelectItem>
                              <SelectItem value="5">Friday</SelectItem>
                              <SelectItem value="6">Saturday</SelectItem>
                              <SelectItem value="0">Sunday</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="superRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Superannuation rate (%)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.1" 
                              min="0" 
                              max="100"
                              {...field}
                              value={field.value || 11}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 11)}
                            />
                          </FormControl>
                          <FormDescription>Current minimum is 11%</FormDescription>
                        </FormItem>
                      )}
                    />
                    <div className="flex gap-2">
                      <Button type="submit" disabled={saving} className="flex-1">
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setEditingPeriod(false)}
                        disabled={saving}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Data Management */}
            <Card>
              <CardHeader>
                <CardTitle>Data Management</CardTitle>
                <CardDescription>
                  Backup and restore your data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" className="w-full" disabled>
                  Export Data
                </Button>
                <Button variant="outline" className="w-full" disabled>
                  Import Data
                </Button>
                <Button variant="destructive" className="w-full" disabled>
                  Reset All Data
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Data management features coming soon
                </p>
              </CardContent>
            </Card>
          </div>
        </form>
      </Form>
    </div>
  )
}