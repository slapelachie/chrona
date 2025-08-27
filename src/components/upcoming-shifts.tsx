'use client'

import { format, isToday, isTomorrow, addDays, differenceInDays } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Calendar,
  Clock, 
  DollarSign, 
  ChevronRight,
  Sun,
  Moon,
  AlertCircle
} from 'lucide-react'
import { type Shift, type PayRate } from '@/types'

interface UpcomingShiftsProps {
  shifts: Array<Shift & { payRate: PayRate }>
  onViewAll?: () => void
  onEditShift?: (shift: Shift & { payRate: PayRate }) => void
  limit?: number
}

export default function UpcomingShifts({ 
  shifts, 
  onViewAll, 
  onEditShift, 
  limit = 5 
}: UpcomingShiftsProps) {
  const now = new Date()
  
  // Filter and sort upcoming shifts
  const upcomingShifts = shifts
    .filter(shift => new Date(shift.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, limit)

  const formatShiftDate = (date: Date) => {
    if (isToday(date)) {
      return 'Today'
    } else if (isTomorrow(date)) {
      return 'Tomorrow'
    } else {
      const daysDiff = differenceInDays(date, now)
      if (daysDiff <= 7) {
        return format(date, 'EEEE') // Day name
      } else {
        return format(date, 'MMM dd') // Month day
      }
    }
  }

  const getShiftTimeStatus = (shift: Shift) => {
    const shiftStart = new Date(shift.startTime)
    const shiftEnd = new Date(shift.endTime)
    const now = new Date()

    if (now >= shiftStart && now <= shiftEnd) {
      return 'in-progress'
    } else if (now < shiftStart) {
      const hoursUntil = (shiftStart.getTime() - now.getTime()) / (1000 * 60 * 60)
      if (hoursUntil <= 2) {
        return 'starting-soon'
      }
      return 'upcoming'
    } else {
      return 'completed'
    }
  }

  const totalUpcomingPay = upcomingShifts.reduce((sum, shift) => sum + Number(shift.grossPay), 0)

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Upcoming Shifts
          </CardTitle>
          {onViewAll && upcomingShifts.length > 0 && (
            <Button variant="ghost" size="sm" onClick={onViewAll}>
              View All
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
        {upcomingShifts.length > 0 && (
          <div className="text-sm text-muted-foreground">
            Next {upcomingShifts.length} shifts • ${totalUpcomingPay.toFixed(2)} projected
          </div>
        )}
      </CardHeader>
      <CardContent>
        {upcomingShifts.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-medium text-muted-foreground">No upcoming shifts</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Your schedule is clear for now
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingShifts.map((shift) => {
              const shiftDate = new Date(shift.date)
              const timeStatus = getShiftTimeStatus(shift)
              
              return (
                <div 
                  key={shift.id}
                  className={`p-3 rounded-lg border transition-colors cursor-pointer hover:bg-accent ${
                    timeStatus === 'in-progress' 
                      ? 'border-green-200 bg-green-50' 
                      : timeStatus === 'starting-soon'
                        ? 'border-yellow-200 bg-yellow-50'
                        : 'border-border hover:border-border/80'
                  }`}
                  onClick={() => onEditShift?.(shift)}
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 space-y-1">
                      {/* Date and Status */}
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {formatShiftDate(shiftDate)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(shiftDate, 'MMM dd')}
                        </span>
                        {timeStatus === 'in-progress' && (
                          <Badge variant="default" className="text-xs bg-green-600">
                            In Progress
                          </Badge>
                        )}
                        {timeStatus === 'starting-soon' && (
                          <Badge variant="secondary" className="text-xs bg-yellow-600 text-white">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Starting Soon
                          </Badge>
                        )}
                      </div>

                      {/* Shift Details */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span>
                              {format(new Date(shift.startTime), 'HH:mm')} - {format(new Date(shift.endTime), 'HH:mm')}
                            </span>
                            <span className="text-muted-foreground">
                              ({Number(shift.hoursWorked).toFixed(1)}h)
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-sm font-medium">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            ${Number(shift.grossPay).toFixed(2)}
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            {shift.payRate.name}
                          </span>
                          <div className="flex gap-1">
                            {shift.isPublicHoliday && (
                              <Badge variant="destructive" className="text-xs">Holiday</Badge>
                            )}
                            {shift.isNightShift && (
                              <Badge variant="secondary" className="text-xs">
                                <Moon className="h-3 w-3 mr-1" />
                                Night
                              </Badge>
                            )}
                            {shift.payRate.rateType === 'PENALTY' && (
                              <Badge variant="outline" className="text-xs">Penalty</Badge>
                            )}
                            {shift.payRate.rateType === 'OVERTIME' && (
                              <Badge variant="secondary" className="text-xs">Overtime</Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Notes */}
                      {shift.notes && (
                        <p className="text-xs text-muted-foreground italic truncate">
                          {shift.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}