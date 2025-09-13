import { prisma } from '@/lib/db'
import { PayPeriod, PayPeriodStatus, PayPeriodType } from '@/types'

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
  const targetDate = new Date(date)
  
  // Calculate start of fortnight
  // This logic matches the seed file calculation
  const payPeriodStart = new Date(targetDate)
  payPeriodStart.setDate(targetDate.getDate() - ((targetDate.getDay() + 6) % 14))
  payPeriodStart.setHours(0, 0, 0, 0)

  // Calculate end of fortnight (13 days later)
  const payPeriodEnd = new Date(payPeriodStart)
  payPeriodEnd.setDate(payPeriodStart.getDate() + 13)
  payPeriodEnd.setHours(23, 59, 59, 999)

  return {
    startDate: payPeriodStart,
    endDate: payPeriodEnd
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
export function calculatePayPeriod(date: Date, payPeriodType: PayPeriodType): {
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

/**
 * Finds an existing pay period for a user and date, or creates one if it doesn't exist
 * Uses upsert pattern to handle concurrent requests safely
 * Automatically uses the user's configured pay period type
 */
export async function findOrCreatePayPeriod(
  userId: string,
  shiftDate: Date
): Promise<PayPeriod> {
  // First try to find existing pay period
  const existingPayPeriod = await prisma.payPeriod.findFirst({
    where: {
      userId,
      startDate: { lte: shiftDate },
      endDate: { gte: shiftDate },
    },
  })

  if (existingPayPeriod) {
    return existingPayPeriod
  }

  // Get user's pay period type configuration
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { payPeriodType: true },
  })

  if (!user) {
    throw new Error(`User not found: ${userId}`)
  }

  // Calculate the pay period for this date using user's preference
  const { startDate, endDate } = calculatePayPeriod(shiftDate, user.payPeriodType)

  // Use upsert to handle concurrent creation attempts
  const payPeriod = await prisma.payPeriod.upsert({
    where: {
      userId_startDate: {
        userId,
        startDate,
      },
    },
    update: {}, // No update needed if it exists
    create: {
      userId,
      startDate,
      endDate,
      status: 'open' as PayPeriodStatus,
      verified: false,
    },
  })

  return payPeriod
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

  return await prisma.payPeriod.findMany({
    where,
    orderBy: { startDate: 'desc' },
  })
}

/**
 * Gets the current active pay period for a user (contains today's date)
 */
export async function getCurrentPayPeriod(userId: string): Promise<PayPeriod> {
  const today = new Date()
  return await findOrCreatePayPeriod(userId, today)
}