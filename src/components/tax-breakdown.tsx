'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { TaxCalculationResult } from '@/types'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface TaxBreakdownProps {
  result: TaxCalculationResult
  showAnnualView?: boolean
  className?: string
}

export default function TaxBreakdown({ result, showAnnualView = false, className }: TaxBreakdownProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatPercentage = (rate: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(rate / 100)
  }

  // Data for charts
  const grossAmount = showAnnualView ? result.annualProjections.annualIncome : result.grossPay
  const netAmount = showAnnualView ? result.annualProjections.annualNetIncome : result.netPay
  const incomeTax = showAnnualView ? result.annualProjections.annualIncomeTax : result.incomeTax
  const medicareLevy = showAnnualView ? result.annualProjections.annualMedicareLevy : result.medicareLevy
  const hecsDeduction = showAnnualView ? result.annualProjections.annualHecsDeduction : result.hecsDeduction
  const totalTax = showAnnualView ? result.annualProjections.annualTotalTax : result.totalTaxWithheld
  const superContribution = showAnnualView ? result.annualProjections.annualSuperContribution : result.superContribution

  // Pie chart data for tax breakdown
  const pieData = [
    { name: 'Net Pay', value: netAmount, color: '#10B981' },
    { name: 'Income Tax', value: incomeTax, color: '#EF4444' },
    { name: 'Medicare Levy', value: medicareLevy, color: '#F59E0B' },
    ...(hecsDeduction > 0 ? [{ name: 'HECS', value: hecsDeduction, color: '#8B5CF6' }] : []),
    ...(result.extraTaxWithheld > 0 ? [{ 
      name: 'Extra Tax', 
      value: showAnnualView ? result.extraTaxWithheld * 26 : result.extraTaxWithheld, 
      color: '#EC4899' 
    }] : [])
  ]

  // Bar chart data for comparison
  const barData = [
    {
      name: 'Gross Pay',
      amount: grossAmount,
      percentage: 100
    },
    {
      name: 'After Tax',
      amount: netAmount,
      percentage: (netAmount / grossAmount) * 100
    },
    {
      name: 'Tax Paid',
      amount: totalTax + hecsDeduction,
      percentage: ((totalTax + hecsDeduction) / grossAmount) * 100
    }
  ]

  // Calculate tax efficiency metrics
  const taxEfficiency = (netAmount / grossAmount) * 100


  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }>; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded-lg shadow-md">
          <p className="font-medium">{`${payload[0].name}: ${formatCurrency(payload[0].value)}`}</p>
          <p className="text-sm text-muted-foreground">
            {`${((payload[0].value / grossAmount) * 100).toFixed(1)}% of gross pay`}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tax Efficiency</CardDescription>
            <CardTitle className="text-2xl flex items-center">
              {formatPercentage(taxEfficiency)}
              {taxEfficiency > 75 ? (
                <TrendingUp className="ml-2 h-4 w-4 text-green-600" />
              ) : taxEfficiency > 65 ? (
                <Minus className="ml-2 h-4 w-4 text-yellow-600" />
              ) : (
                <TrendingDown className="ml-2 h-4 w-4 text-red-600" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={taxEfficiency} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              Take-home after tax
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Effective Tax Rate</CardDescription>
            <CardTitle className="text-2xl">
              {formatPercentage(result.taxRates.effectiveTotalTaxRate)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={result.taxRates.effectiveTotalTaxRate} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              Total tax as % of income
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Marginal Tax Rate</CardDescription>
            <CardTitle className="text-2xl">
              {formatPercentage(result.taxRates.marginalTaxRate)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={result.taxRates.marginalTaxRate} className="h-2 bg-orange-100" />
            <p className="text-xs text-muted-foreground mt-2">
              Tax on next dollar earned
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Pay Breakdown</CardTitle>
            <CardDescription>
              {showAnnualView ? 'Annual' : 'Per pay period'} distribution
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Pay Comparison</CardTitle>
            <CardDescription>
              Gross vs net vs tax breakdown
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={formatCurrency} />
                <Tooltip 
                  formatter={(value: number) => [formatCurrency(value), 'Amount']}
                  labelFormatter={(label) => `${label}`}
                />
                <Bar dataKey="amount" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Tax Breakdown</CardTitle>
          <CardDescription>
            {showAnnualView ? 'Annual' : 'Per pay period'} amounts and rates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium text-green-700">Income</h4>
                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Gross Pay</span>
                    <span className="font-medium">{formatCurrency(grossAmount)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-red-700">Tax & Deductions</h4>
                <div className="bg-red-50 p-3 rounded-lg space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Income Tax</span>
                    <span className="font-medium">{formatCurrency(incomeTax)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Medicare Levy</span>
                    <span className="font-medium">{formatCurrency(medicareLevy)}</span>
                  </div>
                  {hecsDeduction > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm">HECS Repayment</span>
                      <span className="font-medium">{formatCurrency(hecsDeduction)}</span>
                    </div>
                  )}
                  {result.extraTaxWithheld > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Extra Tax</span>
                      <span className="font-medium">
                        {formatCurrency(showAnnualView ? result.extraTaxWithheld * 26 : result.extraTaxWithheld)}
                      </span>
                    </div>
                  )}
                  <div className="border-t pt-1 flex justify-between items-center font-medium">
                    <span>Total</span>
                    <span>{formatCurrency(totalTax + hecsDeduction)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-blue-700">Take Home</h4>
                <div className="bg-blue-50 p-3 rounded-lg space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Net Pay</span>
                    <span className="font-medium">{formatCurrency(netAmount)}</span>
                  </div>
                  {result.calculationContext.includesSuper && (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Super Contribution</span>
                        <span className="font-medium text-green-600">+{formatCurrency(superContribution)}</span>
                      </div>
                      <div className="border-t pt-1 flex justify-between items-center font-medium">
                        <span className="text-sm">Total Benefit</span>
                        <span>{formatCurrency(netAmount + superContribution)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Tax Rates Summary */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Applied Tax Rates</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-lg font-bold text-red-600">
                    {formatPercentage(result.taxRates.effectiveIncomeTaxRate)}
                  </div>
                  <div className="text-xs text-muted-foreground">Income Tax</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-orange-600">
                    {formatPercentage(result.taxRates.medicareRate)}
                  </div>
                  <div className="text-xs text-muted-foreground">Medicare</div>
                </div>
                {result.taxRates.hecsRate > 0 && (
                  <div className="text-center">
                    <div className="text-lg font-bold text-purple-600">
                      {formatPercentage(result.taxRates.hecsRate)}
                    </div>
                    <div className="text-xs text-muted-foreground">HECS</div>
                  </div>
                )}
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600">
                    {formatPercentage(result.taxRates.superRate)}
                  </div>
                  <div className="text-xs text-muted-foreground">Super</div>
                </div>
              </div>
            </div>

            {/* Calculation Context */}
            {(result.calculationContext.multiJobTaxScale || result.calculationContext.customWithholding || !result.calculationContext.includesSuper) && (
              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Calculation Notes</h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  {result.calculationContext.multiJobTaxScale && (
                    <p>• Multi-job tax scale applied (no tax-free threshold)</p>
                  )}
                  {result.calculationContext.customWithholding && (
                    <p>• Custom withholding rate used: {formatPercentage(result.taxRates.customWithholdingRate || 0)}</p>
                  )}
                  {!result.calculationContext.includesSuper && (
                    <p>• Superannuation not included in calculations</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}