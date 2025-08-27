'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import TaxCalculator from "@/components/tax-calculator"
import TaxBreakdown from "@/components/tax-breakdown"
import { useState, useEffect } from 'react'
import { TaxCalculationResult } from '@/types'

export default function Dashboard() {
  const [taxResult, setTaxResult] = useState<TaxCalculationResult | null>(null)

  // Sample calculation for demonstration
  useEffect(() => {
    const fetchSampleCalculation = async () => {
      try {
        const response = await fetch('/api/tax-calculation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grossPay: 1200,
            payPeriodType: 'FORTNIGHTLY',
            taxFreeThreshold: true,
            medicareExemption: false,
            hecsDebtAmount: 0,
            extraTaxWithheld: 0,
            superRate: 11,
            multiJobTaxScale: false,
            includeSuper: true
          })
        })
        
        if (response.ok) {
          const data = await response.json()
          setTaxResult(data)
        }
      } catch (error) {
        console.error('Failed to fetch tax calculation:', error)
      }
    }
    
    fetchSampleCalculation()
  }, [])

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Current Pay Period</CardDescription>
            <CardTitle className="text-2xl">
              {taxResult ? `$${taxResult.grossPay.toFixed(2)}` : '$1,245.50'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Forecast for this period
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Net Pay</CardDescription>
            <CardTitle className="text-2xl">
              {taxResult ? `$${taxResult.netPay.toFixed(2)}` : '$958.30'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Take-home after tax
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tax Withholding</CardDescription>
            <CardTitle className="text-2xl">
              {taxResult ? `$${taxResult.totalTaxWithheld.toFixed(2)}` : '$287.20'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Income tax + Medicare levy
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Effective Tax Rate</CardDescription>
            <CardTitle className="text-2xl">
              {taxResult ? `${taxResult.taxRates.effectiveTotalTaxRate.toFixed(1)}%` : '23.1%'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Total tax as % of gross
            </p>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Tax Calculator */}
        <div className="xl:col-span-2">
          <TaxCalculator />
        </div>
        
        {/* Quick Stats */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks and shortcuts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <button className="w-full text-left p-3 hover:bg-gray-50 rounded-lg transition-colors">
                <div className="font-medium text-sm">Add New Shift</div>
                <div className="text-xs text-muted-foreground">Record hours worked</div>
              </button>
              <button className="w-full text-left p-3 hover:bg-gray-50 rounded-lg transition-colors">
                <div className="font-medium text-sm">Update Pay Rates</div>
                <div className="text-xs text-muted-foreground">Manage hourly rates</div>
              </button>
              <button className="w-full text-left p-3 hover:bg-gray-50 rounded-lg transition-colors">
                <div className="font-medium text-sm">Tax Settings</div>
                <div className="text-xs text-muted-foreground">Configure withholding</div>
              </button>
              <button className="w-full text-left p-3 hover:bg-gray-50 rounded-lg transition-colors">
                <div className="font-medium text-sm">Pay Verification</div>
                <div className="text-xs text-muted-foreground">Compare actual vs calculated</div>
              </button>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest updates and changes</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                No recent activity. Start by adding your pay rates and first shift.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Tax Breakdown */}
      {taxResult && (
        <div className="mt-8">
          <TaxBreakdown result={taxResult} />
        </div>
      )}
    </div>
  )
}