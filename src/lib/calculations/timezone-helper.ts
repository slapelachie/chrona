import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz'
import { addDays } from 'date-fns'
import { Period } from '@/types'

export class TimeZoneHelper {
  constructor(private timeZone: string) {}

  createLocalMidnight(date: Date): Date {
    const ymd = formatInTimeZone(date, this.timeZone, 'yyyy-MM-dd')
    return fromZonedTime(`${ymd}T00:00:00`, this.timeZone)
  }

  createLocalTime(date: Date, time: string): Date {
    const timeStr = time === '24:00' ? '00:00' : time
    const targetDate = time === '24:00' ? addDays(date, 1) : date
    const targetYmd = formatInTimeZone(targetDate, this.timeZone, 'yyyy-MM-dd')
    return fromZonedTime(`${targetYmd}T${timeStr}:00`, this.timeZone)
  }

  getLocalDayOfWeek(date: Date): number {
    const isoDow = Number(formatInTimeZone(date, this.timeZone, 'i'))
    return isoDow % 7 // Convert ISO (1=Mon..7=Sun) to JS (0=Sun..6=Sat)
  }

  advanceToNextLocalDay(currentDayUtc: Date): Date {
    const originalCursor = currentDayUtc.getTime()
    const localMidnight = toZonedTime(currentDayUtc, this.timeZone)
    
    // Method 1: Standard timezone advancement
    const nextLocalMidnight = addDays(localMidnight, 1)
    const nextYmd = formatInTimeZone(nextLocalMidnight, this.timeZone, 'yyyy-MM-dd')
    let newDayCursorUtc = fromZonedTime(`${nextYmd}T00:00:00`, this.timeZone)
    
    // Safety check for DST transitions
    if (newDayCursorUtc.getTime() <= originalCursor) {
      // Method 2: UTC advancement with local alignment
      const roughNextDay = new Date(originalCursor + 25 * 60 * 60 * 1000)
      const roughNextYmd = formatInTimeZone(roughNextDay, this.timeZone, 'yyyy-MM-dd')
      newDayCursorUtc = fromZonedTime(`${roughNextYmd}T00:00:00`, this.timeZone)
      
      // Final fallback
      if (newDayCursorUtc.getTime() <= originalCursor) {
        newDayCursorUtc = new Date(originalCursor + 24 * 60 * 60 * 1000)
      }
    }
    
    return newDayCursorUtc
  }

  doesTimeWrap(startTime: string, endTime: string): boolean {
    if (endTime === '24:00') return true
    
    const [sH, sM] = startTime.split(':').map(Number)
    const [eH, eM] = endTime.split(':').map(Number)
    return eH < sH || (eH === sH && eM <= sM)
  }

  intersectWithShift(
    ruleStart: Date,
    ruleEnd: Date,
    shiftStart: Date,
    shiftEnd: Date
  ): Period | null {
    const start = ruleStart > shiftStart ? ruleStart : shiftStart
    const end = ruleEnd < shiftEnd ? ruleEnd : shiftEnd
    return end > start ? { start, end } : null
  }
}