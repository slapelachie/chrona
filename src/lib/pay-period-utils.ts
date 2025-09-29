import { prisma } from '@/lib/db'
import { PayPeriod, PayPeriodStatus, PayPeriodType } from '@/types'
import { TimeZoneHelper } from './calculations/timezone-helper'
import { formatInTimeZone } from 'date-fns-tz'
import { applyDefaultExtrasToPayPeriod } from '@/lib/pay-period-default-extras'
import { PayPeriodSyncService } from '@/lib/pay-period-sync-service'

/**
 * Pay Period Utilities
 * 
 * Handles Australian pay period calculations and management for weekly, fortnightly, and monthly periods
 */

/**
 * Calculates the weekly pay period that contains a given date
 * Week starts on Monday (Australian business standard)
 */
export function calculateWeeklyPeriod(date: Date): {
  startDate: Date
  endDate: Date
} {
  const targetDate = new Date(date)
  
  // Calculate start of week (Monday) using UTC to avoid timezone issues
  const dayOfWeek = targetDate.getUTCDay() // 0 = Sunday, 1 = Monday, etc.
  const daysToSubtract = (dayOfWeek === 0 ? 6 : dayOfWeek - 1) // Convert Sunday to 6, others to dayOfWeek - 1
  
  const payPeriodStart = new Date(Date.UTC(
    targetDate.getUTCFullYear(),
    targetDate.getUTCMonth(),
    targetDate.getUTCDate() - daysToSubtract
  ))

  // Calculate end of week (Sunday)
  const payPeriodEnd = new Date(Date.UTC(
    payPeriodStart.getUTCFullYear(),
    payPeriodStart.getUTCMonth(),
    payPeriodStart.getUTCDate() + 6,
    23, 59, 59, 999
  ))

  return {
    startDate: payPeriodStart,
    endDate: payPeriodEnd
  }
}

/**
 * Calculates the fortnightly pay period that contains a given date
 * Uses Australian standard of fortnightly pay periods starting on specific days
 */
export function calculateFortnightlyPeriod(date: Date): {
  startDate: Date
  endDate: Date
} {
  // Define a fixed anchor Monday in UTC (1970-01-05 was a Monday)
  const anchor = new Date(Date.UTC(1970, 0, 5, 0, 0, 0, 0))

  // Work in UTC to avoid local-time DST/year crossover issues
  const d = new Date(date)
  const targetUTC = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0))

  const dayMs = 24 * 60 * 60 * 1000
  const daysSinceAnchor = Math.floor((targetUTC.getTime() - anchor.getTime()) / dayMs)

  // Snap down to nearest 14-day boundary
  const startDays = daysSinceAnchor - (daysSinceAnchor % 14)
  const startUTC = new Date(anchor.getTime() + startDays * dayMs)
  const endUTC = new Date(startUTC.getTime() + 13 * dayMs)
  endUTC.setUTCHours(23, 59, 59, 999)

  return {
    startDate: startUTC,
    endDate: endUTC,
  }
}

/**
 * Calculates the monthly pay period that contains a given date
 * Uses calendar month boundaries
 */
export function calculateMonthlyPeriod(date: Date): {
  startDate: Date
  endDate: Date
} {
  const targetDate = new Date(date)
  
  // Calculate start of month (use UTC to avoid timezone issues)
  const payPeriodStart = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), 1))

  // Calculate end of month (use UTC to avoid timezone issues)
  const payPeriodEnd = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth() + 1, 0, 23, 59, 59, 999))

  return {
    startDate: payPeriodStart,
    endDate: payPeriodEnd
  }
}

/**
 * Calculates the pay period that contains a given date based on the pay period type
 */
function calculatePayPeriodUtc(date: Date, payPeriodType: PayPeriodType): {
  startDate: Date
  endDate: Date
} {
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
  const offsetStr = formatInTimeZone(date, timeZone, 'xxx')
  const sign = offsetStr.startsWith('-') ? -1 : 1
  const [hours, minutes] = offsetStr.slice(1).split(':').map(Number)
  return sign * ((hours || 0) * 60 + (minutes || 0)) * 60 * 1000
}

export function calculatePayPeriod(
  date: Date,
  payPeriodType: PayPeriodType,
  timeZone?: string
): { startDate: Date; endDate: Date } {
  if (!timeZone) {
    return calculatePayPeriodUtc(date, payPeriodType)
  }

  const helper = new TimeZoneHelper(timeZone)
  const localDateStr = formatInTimeZone(date, timeZone, 'yyyy-MM-dd')
  const localMidnight = helper.createLocalMidnight(new Date(`${localDateStr}T12:00:00Z`))
  const offsetMs = getTimeZoneOffsetMs(localMidnight, timeZone)
  const adjustedDate = new Date(localMidnight.getTime() + offsetMs)

  const { startDate: adjustedStart, endDate: adjustedEnd } = calculatePayPeriodUtc(adjustedDate, payPeriodType)

  const startOffset = getTimeZoneOffsetMs(adjustedStart, timeZone)
  const endOffset = getTimeZoneOffsetMs(adjustedEnd, timeZone)

  const startDate = new Date(adjustedStart.getTime() - startOffset)
  const endDate = new Date(adjustedEnd.getTime() - endOffset)

  return { startDate, endDate }
}

/**
 * Finds an existing pay period for a user and date, or creates one if it doesn't exist
 * Uses upsert pattern to handle concurrent requests safely
 * Automatically uses the user's configured pay period type
 * Uses pay guide timezone to determine correct pay period boundaries
 */
export async function findOrCreatePayPeriod(
  userId: string,
  shiftDate: Date,
  payGuideTimezone: string
): Promise<PayPeriod> {
  const targetTimeZone = payGuideTimezone || 'Australia/Sydney'

  // Get user's pay period type configuration
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { payPeriodType: true },
  })

  if (!user) {
    throw new Error(`User not found: ${userId}`)
  }

  const { startDate: periodStart, endDate: periodEnd } = calculatePayPeriod(
    shiftDate,
    user.payPeriodType,
    targetTimeZone
  )

  const existingPayPeriod = await prisma.payPeriod.findUnique({
    where: {
      userId_startDate: {
        userId,
        startDate: periodStart,
      },
    },
  })

  if (existingPayPeriod) {
    if (existingPayPeriod.endDate.getTime() !== periodEnd.getTime()) {
      await prisma.payPeriod.update({
        where: { id: existingPayPeriod.id },
        data: { endDate: periodEnd },
      })
      existingPayPeriod.endDate = periodEnd
    }
    return existingPayPeriod as PayPeriod
  }

  const overlappingPayPeriod = await prisma.payPeriod.findFirst({
    where: {
      userId,
      startDate: { lte: shiftDate },
      endDate: { gte: shiftDate },
    },
  })

  if (overlappingPayPeriod) {
    const updated = await prisma.payPeriod.update({
      where: { id: overlappingPayPeriod.id },
      data: { startDate: periodStart, endDate: periodEnd },
    })
    return updated as PayPeriod
  }

  // Use upsert to handle concurrent creation attempts
  const { payPeriod, createdExtras } = await prisma.$transaction(async (tx) => {
    const created = await tx.payPeriod.create({
      data: {
        userId,
        startDate: periodStart,
        endDate: periodEnd,
        status: 'open' as PayPeriodStatus,
      },
    })

    const extrasCount = await applyDefaultExtrasToPayPeriod(userId, created.id, tx)

    return { payPeriod: created, createdExtras: extrasCount }
  })

  if (createdExtras > 0) {
    await PayPeriodSyncService.onExtrasChanged(payPeriod.id)
  }

  return payPeriod as PayPeriod
}

/**
 * Gets all pay periods for a user, optionally filtered by date range
 */
export async function getPayPeriodsForUser(
  userId: string,
  options?: {
    startAfter?: Date
    endBefore?: Date
    status?: string
  }
): Promise<PayPeriod[]> {
  const where: any = { userId }

  if (options?.startAfter) {
    where.startDate = { gte: options.startAfter }
  }

  if (options?.endBefore) {
    where.endDate = { lte: options.endBefore }
  }

  if (options?.status) {
    where.status = options.status
  }

  const results = await prisma.payPeriod.findMany({
    where,
    orderBy: { startDate: 'desc' },
  })

  return results as PayPeriod[]
}

/**
 * Gets the current active pay period for a user (contains today's date)
 * Uses user's timezone if no pay guide timezone is provided
 */
export async function getCurrentPayPeriod(userId: string, payGuideTimezone?: string): Promise<PayPeriod> {
  const today = new Date()
  
  // If no pay guide timezone provided, fall back to user's timezone
  if (!payGuideTimezone) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    })
    
    if (!user) {
      throw new Error(`User not found: ${userId}`)
    }
    
    payGuideTimezone = user.timezone
  }
  
  return await findOrCreatePayPeriod(userId, today, payGuideTimezone)
}
