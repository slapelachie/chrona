'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TaxCalculationResult } from '@/types'
import { Loader2, Calculator } from 'lucide-react'

interface TaxCalculatorProps {
  className?: string
}

export default function TaxCalculator({ className }: TaxCalculatorProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<TaxCalculationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // Form state
  const [grossPay, setGrossPay] = useState<string>('1000')
  const [payPeriodType, setPayPeriodType] = useState<'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY'>('FORTNIGHTLY')
  const [taxFreeThreshold, setTaxFreeThreshold] = useState(true)
  const [medicareExemption, setMedicareExemption] = useState(false)
  const [hecsDebtAmount, setHecsDebtAmount] = useState<string>('0')
  const [extraTaxWithheld, setExtraTaxWithheld] = useState<string>('0')
  const [superRate, setSuperRate] = useState<string>('11')
  const [multiJobTaxScale, setMultiJobTaxScale] = useState(false)
  const [customWithholdingRate, setCustomWithholdingRate] = useState<string>('')
  const [includeSuper, setIncludeSuper] = useState(true)

  const calculateTax = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const requestData = {
        grossPay: parseFloat(grossPay) || 0,
        payPeriodType,
        taxFreeThreshold,
        medicareExemption,
        hecsDebtAmount: parseFloat(hecsDebtAmount) || 0,
        extraTaxWithheld: parseFloat(extraTaxWithheld) || 0,
        superRate: parseFloat(superRate) || 11,
        multiJobTaxScale,
        customWithholdingRate: customWithholdingRate ? parseFloat(customWithholdingRate) : undefined,
        includeSuper,
        taxYear: '2024-25'
      }

      const response = await fetch('/api/tax-calculation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to calculate tax')
      }

      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  // Auto-calculate on input changes
  useEffect(() => {
    if (grossPay && parseFloat(grossPay) > 0) {
      const timeoutId = setTimeout(() => {
        calculateTax()
      }, 500) // Debounce for 500ms
      
      return () => clearTimeout(timeoutId)
    }
  }, [grossPay, payPeriodType, taxFreeThreshold, medicareExemption, hecsDebtAmount, extraTaxWithheld, superRate, multiJobTaxScale, customWithholdingRate, includeSuper])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const formatPercentage = (rate: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(rate / 100)
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Tax Calculator
        </CardTitle>
        <CardDescription>
          Calculate your tax breakdown and net pay in real-time
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="calculator" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="calculator">Calculator</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
          </TabsList>
          
          <TabsContent value="calculator" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="grossPay">Gross Pay</Label>
                <Input
                  id="grossPay"
                  type="number"
                  step="0.01"
                  value={grossPay}
                  onChange={(e) => setGrossPay(e.target.value)}
                  placeholder="Enter gross pay amount"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payPeriod">Pay Period</Label>
                <Select value={payPeriodType} onValueChange={(value: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY') => setPayPeriodType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WEEKLY">Weekly</SelectItem>
                    <SelectItem value="FORTNIGHTLY">Fortnightly</SelectItem>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hecsDebt">HECS Debt Amount</Label>
                <Input
                  id="hecsDebt"
                  type="number"
                  step="0.01"
                  value={hecsDebtAmount}
                  onChange={(e) => setHecsDebtAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="extraTax">Extra Tax Withheld</Label>
                <Input
                  id="extraTax"
                  type="number"
                  step="0.01"
                  value={extraTaxWithheld}
                  onChange={(e) => setExtraTaxWithheld(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="superRate">Super Rate (%)</Label>
                <Input
                  id="superRate"
                  type="number"
                  step="0.1"
                  value={superRate}
                  onChange={(e) => setSuperRate(e.target.value)}
                  placeholder="11.0"
                  disabled={!includeSuper}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customWithholding">Custom Withholding Rate (%)</Label>
                <Input
                  id="customWithholding"
                  type="number"
                  step="0.1"
                  value={customWithholdingRate}
                  onChange={(e) => setCustomWithholdingRate(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="taxFreeThreshold"
                  checked={taxFreeThreshold}
                  onCheckedChange={setTaxFreeThreshold}
                />
                <Label htmlFor="taxFreeThreshold">Claim tax-free threshold</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="medicareExemption"
                  checked={medicareExemption}
                  onCheckedChange={setMedicareExemption}
                />
                <Label htmlFor="medicareExemption">Medicare levy exemption</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="multiJobTaxScale"
                  checked={multiJobTaxScale}
                  onCheckedChange={setMultiJobTaxScale}
                />
                <Label htmlFor="multiJobTaxScale">Multi-job tax scale</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="includeSuper"
                  checked={includeSuper}
                  onCheckedChange={setIncludeSuper}
                />
                <Label htmlFor="includeSuper">Include superannuation</Label>
              </div>
            </div>

            <Button onClick={calculateTax} className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Calculating...
                </>
              ) : (
                'Calculate Tax'
              )}
            </Button>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                Error: {error}
              </div>
            )}
          </TabsContent>

          <TabsContent value="results">
            {result ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Pay Period Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Gross Pay:</span>
                        <span className="font-medium">{formatCurrency(result.grossPay)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Income Tax:</span>
                        <span className="font-medium text-red-600">-{formatCurrency(result.incomeTax)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Medicare Levy:</span>
                        <span className="font-medium text-red-600">-{formatCurrency(result.medicareLevy)}</span>
                      </div>
                      {result.hecsDeduction > 0 && (
                        <div className="flex justify-between">
                          <span className="text-sm">HECS Deduction:</span>
                          <span className="font-medium text-red-600">-{formatCurrency(result.hecsDeduction)}</span>
                        </div>
                      )}
                      {result.extraTaxWithheld > 0 && (
                        <div className="flex justify-between">
                          <span className="text-sm">Extra Tax:</span>
                          <span className="font-medium text-red-600">-{formatCurrency(result.extraTaxWithheld)}</span>
                        </div>
                      )}
                      <div className="border-t pt-2 flex justify-between font-semibold">
                        <span>Net Pay:</span>
                        <span className="text-green-600">{formatCurrency(result.netPay)}</span>
                      </div>
                      {result.calculationContext.includesSuper && (
                        <div className="flex justify-between">
                          <span className="text-sm">Super Contribution:</span>
                          <span className="font-medium text-blue-600">{formatCurrency(result.superContribution)}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Annual Projections</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Annual Income:</span>
                        <span className="font-medium">{formatCurrency(result.annualProjections.annualIncome)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Annual Tax:</span>
                        <span className="font-medium text-red-600">-{formatCurrency(result.annualProjections.annualTotalTax)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Annual HECS:</span>
                        <span className="font-medium text-red-600">-{formatCurrency(result.annualProjections.annualHecsDeduction)}</span>
                      </div>
                      <div className="border-t pt-2 flex justify-between font-semibold">
                        <span>Annual Net:</span>
                        <span className="text-green-600">{formatCurrency(result.annualProjections.annualNetIncome)}</span>
                      </div>
                      {result.calculationContext.includesSuper && (
                        <div className="flex justify-between">
                          <span className="text-sm">Annual Super:</span>
                          <span className="font-medium text-blue-600">{formatCurrency(result.annualProjections.annualSuperContribution)}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Tax Rates</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {formatPercentage(result.taxRates.marginalTaxRate)}
                      </div>
                      <div className="text-sm text-muted-foreground">Marginal Rate</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {formatPercentage(result.taxRates.effectiveIncomeTaxRate)}
                      </div>
                      <div className="text-sm text-muted-foreground">Effective Rate</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {formatPercentage(result.taxRates.medicareRate)}
                      </div>
                      <div className="text-sm text-muted-foreground">Medicare</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {formatPercentage(result.taxRates.superRate)}
                      </div>
                      <div className="text-sm text-muted-foreground">Super Rate</div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Enter your pay details to see tax calculations</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}