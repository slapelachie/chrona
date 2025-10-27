import { formatInTimeZone } from 'date-fns-tz'
import { PayPeriodType } from '@/types'
import { TimeZoneHelper } from './calculations/timezone-helper'

type DateRange = { startDate: Date; endDate: Date }

const DAY_MS = 24 * 60 * 60 * 1000

function calculateWeeklyPeriod(date: Date): DateRange {
  const target = new Date(date)
  const dayOfWeek = target.getUTCDay()
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1

  const startDate = new Date(Date.UTC(
    target.getUTCFullYear(),
    target.getUTCMonth(),
    target.getUTCDate() - daysToSubtract,
  ))

  const endDate = new Date(Date.UTC(
    startDate.getUTCFullYear(),
    startDate.getUTCMonth(),
    startDate.getUTCDate() + 6,
    23, 59, 59, 999,
  ))

  return { startDate, endDate }
}

function calculateFortnightlyPeriod(date: Date): DateRange {
  const anchor = new Date(Date.UTC(1970, 0, 5, 0, 0, 0, 0))
  const target = new Date(date)
  const targetUtc = new Date(Date.UTC(
    target.getUTCFullYear(),
    target.getUTCMonth(),
    target.getUTCDate(),
    0, 0, 0, 0,
  ))

  const daysSinceAnchor = Math.floor((targetUtc.getTime() - anchor.getTime()) / DAY_MS)
  const startDays = daysSinceAnchor - (daysSinceAnchor % 14)
  const startUtc = new Date(anchor.getTime() + startDays * DAY_MS)
  const endUtc = new Date(startUtc.getTime() + 13 * DAY_MS)
  endUtc.setUTCHours(23, 59, 59, 999)

  return { startDate: startUtc, endDate: endUtc }
}

function calculateMonthlyPeriod(date: Date): DateRange {
  const target = new Date(date)

  const startDate = new Date(Date.UTC(
    target.getUTCFullYear(),
    target.getUTCMonth(),
    1,
  ))

  const endDate = new Date(Date.UTC(
    target.getUTCFullYear(),
    target.getUTCMonth() + 1,
    0,
    23, 59, 59, 999,
  ))

  return { startDate, endDate }
}

function calculatePayPeriodUtc(date: Date, payPeriodType: PayPeriodType): DateRange {
  switch (payPeriodType) {
    case 'WEEKLY':
      return calculateWeeklyPeriod(date)
    case 'FORTNIGHTLY':
      return calculateFortnightlyPeriod(date)
    case 'MONTHLY':
      return calculateMonthlyPeriod(date)
    default:
      throw new Error(`Unsupported pay period type: ${payPeriodType}`)
  }
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const offset = formatInTimeZone(date, timeZone, 'xxx')
  const sign = offset.startsWith('-') ? -1 : 1
  const [hours, minutes] = offset.slice(1).split(':').map(Number)
  return sign * ((hours || 0) * 60 + (minutes || 0)) * 60 * 1000
}

export function calculatePayPeriodRange(
  date: Date,
  payPeriodType: PayPeriodType,
  timeZone?: string,
): DateRange {
  if (!timeZone) {
    return calculatePayPeriodUtc(date, payPeriodType)
  }

  const helper = new TimeZoneHelper(timeZone)
  const localDateStr = formatInTimeZone(date, timeZone, 'yyyy-MM-dd')
  const localMidnight = helper.createLocalMidnight(new Date(`${localDateStr}T12:00:00Z`))
  const offsetMs = getTimeZoneOffsetMs(localMidnight, timeZone)
  const adjustedDate = new Date(localMidnight.getTime() + offsetMs)

  const { startDate: adjustedStart, endDate: adjustedEnd } = calculatePayPeriodUtc(
    adjustedDate,
    payPeriodType,
  )

  const startOffset = getTimeZoneOffsetMs(adjustedStart, timeZone)
  const endOffset = getTimeZoneOffsetMs(adjustedEnd, timeZone)

  return {
    startDate: new Date(adjustedStart.getTime() - startOffset),
    endDate: new Date(adjustedEnd.getTime() - endOffset),
  }
}

