'use client'

import { useMemo } from 'react'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { 
  Clock, 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  Target,
  Calendar,
  BarChart3
} from 'lucide-react'
import { type Shift, type PayRate } from '@/types'

interface HoursSummaryProps {
  shifts: Array<Shift & { payRate: PayRate }>
  weeklyTarget?: number // Target hours per week
  monthlyTarget?: number // Target hours per month
}

interface PeriodStats {
  hours: number
  earnings: number
  shifts: number
  averageShiftLength: number
  regularHours: number
  overtimeHours: number
  penaltyHours: number
}

export default function HoursSummary({ 
  shifts, 
  weeklyTarget = 38, 
  monthlyTarget = 152 
}: HoursSummaryProps) {
  const now = new Date()
  
  const periodStats = useMemo(() => {
    const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 })
    const currentWeekEnd = endOfWeek(now, { weekStartsOn: 1 })
    const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
    const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
    
    const currentMonthStart = startOfMonth(now)
    const currentMonthEnd = endOfMonth(now)
    const lastMonthStart = startOfMonth(subMonths(now, 1))
    const lastMonthEnd = endOfMonth(subMonths(now, 1))

    const calculatePeriodStats = (start: Date, end: Date): PeriodStats => {
      const periodShifts = shifts.filter(shift => {
        const shiftDate = new Date(shift.date)
        return shiftDate >= start && shiftDate <= end
      })

      const hours = periodShifts.reduce((sum, shift) => sum + Number(shift.hoursWorked), 0)
      const earnings = periodShifts.reduce((sum, shift) => sum + Number(shift.grossPay), 0)
      const regularHours = periodShifts.reduce((sum, shift) => sum + Number(shift.regularHours), 0)
      const overtimeHours = periodShifts.reduce((sum, shift) => sum + Number(shift.overtimeHours), 0)
      const penaltyHours = periodShifts.reduce((sum, shift) => sum + Number(shift.penaltyHours), 0)

      return {
        hours,
        earnings,
        shifts: periodShifts.length,
        averageShiftLength: periodShifts.length > 0 ? hours / periodShifts.length : 0,
        regularHours,
        overtimeHours,
        penaltyHours,
      }
    }

    return {
      thisWeek: calculatePeriodStats(currentWeekStart, currentWeekEnd),
      lastWeek: calculatePeriodStats(lastWeekStart, lastWeekEnd),
      thisMonth: calculatePeriodStats(currentMonthStart, currentMonthEnd),
      lastMonth: calculatePeriodStats(lastMonthStart, lastMonthEnd),
    }
  }, [shifts, now])

  const weekProgress = (periodStats.thisWeek.hours / weeklyTarget) * 100
  const monthProgress = (periodStats.thisMonth.hours / monthlyTarget) * 100

  const weekChange = periodStats.thisWeek.hours - periodStats.lastWeek.hours
  const monthChange = periodStats.thisMonth.hours - periodStats.lastMonth.hours

  const formatChange = (change: number, suffix: string = 'h') => {
    const sign = change > 0 ? '+' : ''
    return `${sign}${change.toFixed(1)}${suffix}`
  }

  return (
    <div className="space-y-4">
      {/* Current Period Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Hours Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* This Week */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="font-medium">This Week</span>
                <Badge variant={weekProgress >= 100 ? 'default' : 'secondary'}>
                  {weekProgress.toFixed(0)}%
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-bold">
                  {periodStats.thisWeek.hours.toFixed(1)}h
                </span>
                <span className="text-muted-foreground">
                  / {weeklyTarget}h
                </span>
                {weekChange !== 0 && (
                  <div className={`flex items-center gap-1 ${
                    weekChange > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {weekChange > 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    <span className="text-xs">
                      {formatChange(weekChange)}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <Progress value={Math.min(weekProgress, 100)} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{periodStats.thisWeek.shifts} shifts</span>
              <span>${periodStats.thisWeek.earnings.toFixed(2)}</span>
            </div>
          </div>

          {/* This Month */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="font-medium">This Month</span>
                <Badge variant={monthProgress >= 100 ? 'default' : 'secondary'}>
                  {monthProgress.toFixed(0)}%
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-bold">
                  {periodStats.thisMonth.hours.toFixed(1)}h
                </span>
                <span className="text-muted-foreground">
                  / {monthlyTarget}h
                </span>
                {monthChange !== 0 && (
                  <div className={`flex items-center gap-1 ${
                    monthChange > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {monthChange > 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    <span className="text-xs">
                      {formatChange(monthChange)}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <Progress value={Math.min(monthProgress, 100)} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{periodStats.thisMonth.shifts} shifts</span>
              <span>${periodStats.thisMonth.earnings.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Weekly Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Weekly Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Regular Hours</p>
                <p className="font-semibold">
                  {periodStats.thisWeek.regularHours.toFixed(1)}h
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Overtime Hours</p>
                <p className="font-semibold">
                  {periodStats.thisWeek.overtimeHours.toFixed(1)}h
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Penalty Hours</p>
                <p className="font-semibold">
                  {periodStats.thisWeek.penaltyHours.toFixed(1)}h
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Avg Shift</p>
                <p className="font-semibold">
                  {periodStats.thisWeek.averageShiftLength.toFixed(1)}h
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Monthly Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Regular Hours</p>
                <p className="font-semibold">
                  {periodStats.thisMonth.regularHours.toFixed(1)}h
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Overtime Hours</p>
                <p className="font-semibold">
                  {periodStats.thisMonth.overtimeHours.toFixed(1)}h
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Penalty Hours</p>
                <p className="font-semibold">
                  {periodStats.thisMonth.penaltyHours.toFixed(1)}h
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Avg Shift</p>
                <p className="font-semibold">
                  {periodStats.thisMonth.averageShiftLength.toFixed(1)}h
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Target Progress Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className={weekProgress >= 100 ? 'border-green-200 bg-green-50' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Weekly Target</span>
              </div>
              <Badge variant={weekProgress >= 100 ? 'default' : 'secondary'}>
                {weekProgress >= 100 ? '✓ Complete' : `${weekProgress.toFixed(0)}%`}
              </Badge>
            </div>
            <div className="mt-2">
              <p className="text-2xl font-bold">
                {periodStats.thisWeek.hours.toFixed(1)} / {weeklyTarget}h
              </p>
              {weekProgress < 100 && (
                <p className="text-sm text-muted-foreground">
                  {(weeklyTarget - periodStats.thisWeek.hours).toFixed(1)}h remaining
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className={monthProgress >= 100 ? 'border-green-200 bg-green-50' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Monthly Target</span>
              </div>
              <Badge variant={monthProgress >= 100 ? 'default' : 'secondary'}>
                {monthProgress >= 100 ? '✓ Complete' : `${monthProgress.toFixed(0)}%`}
              </Badge>
            </div>
            <div className="mt-2">
              <p className="text-2xl font-bold">
                {periodStats.thisMonth.hours.toFixed(1)} / {monthlyTarget}h
              </p>
              {monthProgress < 100 && (
                <p className="text-sm text-muted-foreground">
                  {(monthlyTarget - periodStats.thisMonth.hours).toFixed(1)}h remaining
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}