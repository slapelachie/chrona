"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PayRate } from "@/types"
import { 
  Clock, 
  Calendar, 
  TrendingUp,
  TrendingDown,
  Minus,
  History,
  Info
} from "lucide-react"

interface PayRateHistoryProps {
  payRateName: string
  onClose?: () => void
}

interface PayRateVersion extends PayRate {
  changeAmount?: number
  changePercentage?: number
  changeType?: 'increase' | 'decrease' | 'no-change'
}

export function PayRateHistory({ payRateName, onClose }: PayRateHistoryProps) {
  const [history, setHistory] = useState<PayRateVersion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPayRateHistory()
  }, [payRateName])

  const fetchPayRateHistory = async () => {
    try {
      // For now, we'll fetch all pay rates with the same name and simulate history
      // In a real implementation, you might want a separate history endpoint
      const response = await fetch('/api/pay-rates')
      if (response.ok) {
        const allRates = await response.json() as PayRate[]
        const rateHistory = allRates
          .filter(rate => rate.name === payRateName)
          .sort((a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime())

        // Calculate changes between versions
        const historyWithChanges: PayRateVersion[] = rateHistory.map((rate, index) => {
          const previousRate = rateHistory[index + 1]
          let changeAmount = 0
          let changePercentage = 0
          let changeType: 'increase' | 'decrease' | 'no-change' = 'no-change'

          if (previousRate) {
            const currentEffectiveRate = parseFloat(rate.baseRate.toString()) * parseFloat(rate.multiplier.toString())
            const previousEffectiveRate = parseFloat(previousRate.baseRate.toString()) * parseFloat(previousRate.multiplier.toString())
            
            changeAmount = currentEffectiveRate - previousEffectiveRate
            changePercentage = ((currentEffectiveRate - previousEffectiveRate) / previousEffectiveRate) * 100
            
            if (changeAmount > 0) {
              changeType = 'increase'
            } else if (changeAmount < 0) {
              changeType = 'decrease'
            }
          }

          return {
            ...rate,
            changeAmount,
            changePercentage,
            changeType
          }
        })

        setHistory(historyWithChanges)
      }
    } catch (error) {
      console.error('Failed to fetch pay rate history:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const formatPercentage = (percentage: number) => {
    return `${percentage > 0 ? '+' : ''}${percentage.toFixed(1)}%`
  }

  const getChangeIcon = (changeType: string) => {
    switch (changeType) {
      case 'increase':
        return <TrendingUp className="h-4 w-4 text-green-600" />
      case 'decrease':
        return <TrendingDown className="h-4 w-4 text-red-600" />
      default:
        return <Minus className="h-4 w-4 text-gray-400" />
    }
  }

  const getChangeColor = (changeType: string) => {
    switch (changeType) {
      case 'increase':
        return 'text-green-600'
      case 'decrease':
        return 'text-red-600'
      default:
        return 'text-gray-500'
    }
  }

  const isCurrentRate = (rate: PayRateVersion) => {
    const now = new Date()
    const effectiveFrom = new Date(rate.effectiveFrom)
    const effectiveTo = rate.effectiveTo ? new Date(rate.effectiveTo) : null
    
    return effectiveFrom <= now && (!effectiveTo || effectiveTo >= now)
  }

  const isFutureRate = (rate: PayRateVersion) => {
    return new Date(rate.effectiveFrom) > new Date()
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 flex justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
        </CardContent>
      </Card>
    )
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Pay Rate History
          </CardTitle>
          <CardDescription>
            No history available for &quot;{payRateName}&quot;
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No rate changes found</p>
            {onClose && (
              <Button variant="outline" className="mt-4" onClick={onClose}>
                Close
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Pay Rate History
            </CardTitle>
            <CardDescription>
              Change history for &quot;{payRateName}&quot;
            </CardDescription>
          </div>
          {onClose && (
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {history.map((rate, index) => {
            const effectiveRate = parseFloat(rate.baseRate.toString()) * parseFloat(rate.multiplier.toString())
            const isActive = isCurrentRate(rate)
            const isFuture = isFutureRate(rate)
            const isExpired = !isActive && !isFuture

            return (
              <div
                key={rate.id}
                className={`relative pl-6 pb-4 ${index !== history.length - 1 ? 'border-l-2 border-gray-200' : ''}`}
              >
                {/* Timeline dot */}
                <div className={`absolute left-0 top-0 -translate-x-1/2 w-3 h-3 rounded-full border-2 ${
                  isActive ? 'bg-green-500 border-green-500' :
                  isFuture ? 'bg-blue-500 border-blue-500' :
                  'bg-gray-300 border-gray-300'
                }`} />

                {/* Rate details */}
                <div className="bg-card border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-semibold">
                          {formatCurrency(effectiveRate)}/hr
                        </span>
                        {isActive && (
                          <Badge className="bg-green-100 text-green-800">
                            Current
                          </Badge>
                        )}
                        {isFuture && (
                          <Badge className="bg-blue-100 text-blue-800">
                            Future
                          </Badge>
                        )}
                        {isExpired && (
                          <Badge variant="outline" className="text-gray-500">
                            Expired
                          </Badge>
                        )}
                      </div>
                      
                      {rate.changeType && rate.changeType !== 'no-change' && (
                        <div className={`flex items-center gap-1 text-sm ${getChangeColor(rate.changeType)}`}>
                          {getChangeIcon(rate.changeType)}
                          <span>
                            {formatCurrency(Math.abs(rate.changeAmount!))} 
                            ({formatPercentage(rate.changePercentage!)})
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="text-right text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(rate.effectiveFrom)}</span>
                      </div>
                      {rate.effectiveTo && (
                        <div className="flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3" />
                          <span>Until {formatDate(rate.effectiveTo)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Rate breakdown */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Base Rate</span>
                      <div className="font-medium">
                        {formatCurrency(parseFloat(rate.baseRate.toString()))}
                      </div>
                    </div>
                    
                    <div>
                      <span className="text-muted-foreground">Multiplier</span>
                      <div className="font-medium">
                        ×{parseFloat(rate.multiplier.toString())}
                      </div>
                    </div>
                    
                    <div>
                      <span className="text-muted-foreground">Type</span>
                      <div className="font-medium">
                        <Badge variant="outline" className="text-xs">
                          {rate.rateType}
                        </Badge>
                      </div>
                    </div>
                    
                    <div>
                      <span className="text-muted-foreground">Default</span>
                      <div className="font-medium">
                        {rate.isDefault ? 'Yes' : 'No'}
                      </div>
                    </div>
                  </div>

                  {/* Conditions */}
                  {(rate.applyWeekend || rate.applyPublicHoliday || rate.applyNight) && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="text-xs text-muted-foreground mb-1">CONDITIONS</div>
                      <div className="flex flex-wrap gap-1">
                        {rate.applyWeekend && (
                          <Badge variant="outline" className="text-xs">Weekends</Badge>
                        )}
                        {rate.applyPublicHoliday && (
                          <Badge variant="outline" className="text-xs">Holidays</Badge>
                        )}
                        {rate.applyNight && (
                          <Badge variant="outline" className="text-xs">
                            Night ({rate.nightStart}-{rate.nightEnd})
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  {rate.description && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="text-xs text-muted-foreground mb-1">DESCRIPTION</div>
                      <p className="text-sm">{rate.description}</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Summary */}
        {history.length > 1 && (
          <div className="mt-6 pt-4 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Info className="h-4 w-4" />
              <span>Summary</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Total Changes</span>
                <div className="font-medium">{history.length - 1}</div>
              </div>
              <div>
                <span className="text-muted-foreground">First Rate</span>
                <div className="font-medium">
                  {formatCurrency(
                    parseFloat(history[history.length - 1].baseRate.toString()) * 
                    parseFloat(history[history.length - 1].multiplier.toString())
                  )}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Latest Rate</span>
                <div className="font-medium">
                  {formatCurrency(
                    parseFloat(history[0].baseRate.toString()) * 
                    parseFloat(history[0].multiplier.toString())
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}