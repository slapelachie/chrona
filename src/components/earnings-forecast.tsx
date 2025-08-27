'use client'

import { useMemo } from 'react'
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  addMonths, 
  eachMonthOfInterval,
  startOfWeek,
  endOfWeek,
  addWeeks,
  eachWeekOfInterval
} from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  TrendingUp, 
  DollarSign, 
  Calendar,
  Target,
  AlertTriangle,
  CheckCircle
} from 'lucide-react'
import { type Shift, type PayRate } from '@/types'

interface EarningsForecastProps {
  shifts: Array<Shift & { payRate: PayRate }>
  monthlyTarget?: number // Target earnings per month
  weeklyTarget?: number // Target earnings per week
}

interface ForecastPeriod {
  period: string
  actual: number
  projected: number
  target: number
  isComplete: boolean
  daysRemaining: number
  dailyRequired: number
}

export default function EarningsForecast({ 
  shifts, 
  monthlyTarget = 6000, 
  weeklyTarget = 1500 
}: EarningsForecastProps) {
  const now = new Date()

  const forecast = useMemo(() => {
    // Current week forecast
    const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 })
    const currentWeekEnd = endOfWeek(now, { weekStartsOn: 1 })
    
    const thisWeekShifts = shifts.filter(shift => {
      const shiftDate = new Date(shift.date)
      return shiftDate >= currentWeekStart && shiftDate <= currentWeekEnd
    })

    const thisWeekActual = thisWeekShifts
      .filter(shift => new Date(shift.date) <= now)
      .reduce((sum, shift) => sum + Number(shift.grossPay), 0)

    const thisWeekProjected = thisWeekShifts
      .filter(shift => new Date(shift.date) > now)
      .reduce((sum, shift) => sum + Number(shift.grossPay), 0)

    const weekDaysRemaining = Math.max(0, Math.ceil((currentWeekEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    const weekDailyRequired = weekDaysRemaining > 0 
      ? Math.max(0, (weeklyTarget - thisWeekActual - thisWeekProjected) / weekDaysRemaining)
      : 0

    // Current month forecast
    const currentMonthStart = startOfMonth(now)
    const currentMonthEnd = endOfMonth(now)
    
    const thisMonthShifts = shifts.filter(shift => {
      const shiftDate = new Date(shift.date)
      return shiftDate >= currentMonthStart && shiftDate <= currentMonthEnd
    })

    const thisMonthActual = thisMonthShifts
      .filter(shift => new Date(shift.date) <= now)
      .reduce((sum, shift) => sum + Number(shift.grossPay), 0)

    const thisMonthProjected = thisMonthShifts
      .filter(shift => new Date(shift.date) > now)
      .reduce((sum, shift) => sum + Number(shift.grossPay), 0)

    const monthDaysRemaining = Math.max(0, Math.ceil((currentMonthEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    const monthDailyRequired = monthDaysRemaining > 0 
      ? Math.max(0, (monthlyTarget - thisMonthActual - thisMonthProjected) / monthDaysRemaining)
      : 0

    // Next 3 months forecast
    const futureMonths = eachMonthOfInterval({
      start: addMonths(now, 1),
      end: addMonths(now, 3)
    })

    const monthlyForecasts = futureMonths.map(month => {
      const monthStart = startOfMonth(month)
      const monthEnd = endOfMonth(month)
      
      const monthShifts = shifts.filter(shift => {
        const shiftDate = new Date(shift.date)
        return shiftDate >= monthStart && shiftDate <= monthEnd
      })

      const projected = monthShifts.reduce((sum, shift) => sum + Number(shift.grossPay), 0)

      return {
        period: format(month, 'MMM yyyy'),
        actual: 0,
        projected,
        target: monthlyTarget,
        isComplete: false,
        daysRemaining: Math.ceil((monthEnd.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24)),
        dailyRequired: projected < monthlyTarget 
          ? (monthlyTarget - projected) / Math.ceil((monthEnd.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24))
          : 0
      }
    })

    return {
      thisWeek: {
        period: 'This Week',
        actual: thisWeekActual,
        projected: thisWeekProjected,
        target: weeklyTarget,
        isComplete: now > currentWeekEnd,
        daysRemaining: weekDaysRemaining,
        dailyRequired: weekDailyRequired,
      },
      thisMonth: {
        period: 'This Month',
        actual: thisMonthActual,
        projected: thisMonthProjected,
        target: monthlyTarget,
        isComplete: now > currentMonthEnd,
        daysRemaining: monthDaysRemaining,
        dailyRequired: monthDailyRequired,
      },
      futureMonths: monthlyForecasts,
    }
  }, [shifts, now, weeklyTarget, monthlyTarget])

  const ForecastCard = ({ forecast: f }: { forecast: ForecastPeriod }) => {
    const totalProjected = f.actual + f.projected
    const progress = (totalProjected / f.target) * 100
    const isOnTrack = totalProjected >= f.target * 0.8 // Consider 80%+ as on track
    const isExceeding = totalProjected >= f.target

    return (
      <Card className={isExceeding ? 'border-green-200 bg-green-50' : isOnTrack ? 'border-blue-200 bg-blue-50' : 'border-yellow-200 bg-yellow-50'}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium">{f.period}</h3>
            <div className="flex items-center gap-2">
              {isExceeding ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : isOnTrack ? (
                <TrendingUp className="h-4 w-4 text-blue-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
              )}
              <Badge variant={isExceeding ? 'default' : isOnTrack ? 'secondary' : 'outline'}>
                {progress.toFixed(0)}%
              </Badge>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Earned</span>
              <span className="font-semibold">${f.actual.toFixed(2)}</span>
            </div>
            
            {f.projected > 0 && (
              <div className="flex justify-between text-sm">
                <span>Projected</span>
                <span className="font-semibold text-blue-600">${f.projected.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between text-sm font-medium border-t pt-2">
              <span>Total</span>
              <span className={isExceeding ? 'text-green-600' : isOnTrack ? 'text-blue-600' : 'text-yellow-600'}>
                ${totalProjected.toFixed(2)} / ${f.target.toFixed(2)}
              </span>
            </div>

            <Progress 
              value={Math.min(progress, 100)} 
              className={`h-2 ${
                isExceeding ? '[&>div]:bg-green-600' : 
                isOnTrack ? '[&>div]:bg-blue-600' : '[&>div]:bg-yellow-600'
              }`} 
            />

            {!f.isComplete && f.daysRemaining > 0 && f.dailyRequired > 0 && (
              <div className="text-xs text-muted-foreground">
                Need ${f.dailyRequired.toFixed(2)}/day for {f.daysRemaining} days to reach target
              </div>
            )}

            {totalProjected < f.target && (
              <div className="text-xs text-muted-foreground">
                ${(f.target - totalProjected).toFixed(2)} remaining to target
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  const totalUpcoming = forecast.thisWeek.projected + forecast.thisMonth.projected + 
    forecast.futureMonths.reduce((sum, f) => sum + f.projected, 0)

  return (
    <div className="space-y-4">
      {/* Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Earnings Forecast
          </CardTitle>
          <div className="text-sm text-muted-foreground">
            ${totalUpcoming.toFixed(2)} in upcoming scheduled shifts
          </div>
        </CardHeader>
      </Card>

      {/* Current Period Forecasts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ForecastCard forecast={forecast.thisWeek} />
        <ForecastCard forecast={forecast.thisMonth} />
      </div>

      {/* Future Months */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Upcoming Months
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {forecast.futureMonths.map((monthForecast, index) => (
              <div key={index} className="p-3 border rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">{monthForecast.period}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">
                      ${monthForecast.projected.toFixed(2)}
                    </span>
                    <Badge 
                      variant={
                        monthForecast.projected >= monthForecast.target ? 'default' :
                        monthForecast.projected >= monthForecast.target * 0.8 ? 'secondary' : 
                        'outline'
                      }
                    >
                      {((monthForecast.projected / monthForecast.target) * 100).toFixed(0)}%
                    </Badge>
                  </div>
                </div>
                
                <Progress 
                  value={Math.min((monthForecast.projected / monthForecast.target) * 100, 100)} 
                  className="h-1" 
                />
                
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Target: ${monthForecast.target.toFixed(2)}</span>
                  {monthForecast.projected < monthForecast.target && (
                    <span>
                      ${(monthForecast.target - monthForecast.projected).toFixed(2)} short
                    </span>
                  )}
                </div>
              </div>
            ))}

            {forecast.futureMonths.every(f => f.projected === 0) && (
              <div className="text-center py-4">
                <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No shifts scheduled for upcoming months
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}