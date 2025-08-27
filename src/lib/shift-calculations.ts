import { prisma } from './db'
import { Shift, PayRate } from '@/types'

export interface ShiftSummary {
  totalShifts: number
  totalHours: number
  totalGrossPay: number
  averageHours: number
  averageShiftPay: number
}

export interface WeeklySummary {
  weekStarting: Date
  shifts: number
  hours: number
  grossPay: number
}

export interface MonthlySummary {
  month: string
  year: number
  shifts: number
  hours: number
  grossPay: number
}

/**
 * Get shift summary statistics for a date range
 */
export async function getShiftSummary(
  startDate: Date,
  endDate: Date
): Promise<ShiftSummary> {
  const shifts = await prisma.shift.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
  })

  if (shifts.length === 0) {
    return {
      totalShifts: 0,
      totalHours: 0,
      totalGrossPay: 0,
      averageHours: 0,
      averageShiftPay: 0,
    }
  }

  const totalHours = shifts.reduce((sum, shift) => sum + Number(shift.hoursWorked), 0)
  const totalGrossPay = shifts.reduce((sum, shift) => sum + Number(shift.grossPay), 0)

  return {
    totalShifts: shifts.length,
    totalHours,
    totalGrossPay,
    averageHours: totalHours / shifts.length,
    averageShiftPay: totalGrossPay / shifts.length,
  }
}

/**
 * Get upcoming shifts (next 7 days by default)
 */
export async function getUpcomingShifts(days: number = 7) {
  const now = new Date()
  const futureDate = new Date()
  futureDate.setDate(now.getDate() + days)

  return await prisma.shift.findMany({
    where: {
      date: {
        gte: now,
        lte: futureDate,
      },
    },
    include: {
      payRate: true,
    },
    orderBy: [
      { date: 'asc' },
      { startTime: 'asc' },
    ],
  })
}

/**
 * Get recent shifts (last 30 days by default)
 */
export async function getRecentShifts(days: number = 30) {
  const now = new Date()
  const pastDate = new Date()
  pastDate.setDate(now.getDate() - days)

  return await prisma.shift.findMany({
    where: {
      date: {
        gte: pastDate,
        lte: now,
      },
    },
    include: {
      payRate: true,
    },
    orderBy: [
      { date: 'desc' },
      { startTime: 'desc' },
    ],
  })
}

/**
 * Get weekly shift summaries
 */
export async function getWeeklySummaries(
  startDate: Date,
  endDate: Date
): Promise<WeeklySummary[]> {
  const shifts = await prisma.shift.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { date: 'asc' },
  })

  const weekMap = new Map<string, WeeklySummary>()

  shifts.forEach((shift) => {
    // Get Monday of the week for this shift
    const shiftDate = new Date(shift.date)
    const monday = new Date(shiftDate)
    const dayOfWeek = shiftDate.getDay()
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek // Handle Sunday as 0
    monday.setDate(shiftDate.getDate() + diff)
    monday.setHours(0, 0, 0, 0)

    const weekKey = monday.toISOString()

    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, {
        weekStarting: monday,
        shifts: 0,
        hours: 0,
        grossPay: 0,
      })
    }

    const week = weekMap.get(weekKey)!
    week.shifts += 1
    week.hours += Number(shift.hoursWorked)
    week.grossPay += Number(shift.grossPay)
  })

  return Array.from(weekMap.values()).sort(
    (a, b) => a.weekStarting.getTime() - b.weekStarting.getTime()
  )
}

/**
 * Get monthly shift summaries
 */
export async function getMonthlySummaries(
  startDate: Date,
  endDate: Date
): Promise<MonthlySummary[]> {
  const shifts = await prisma.shift.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
  })

  const monthMap = new Map<string, MonthlySummary>()

  shifts.forEach((shift) => {
    const shiftDate = new Date(shift.date)
    const monthKey = `${shiftDate.getFullYear()}-${shiftDate.getMonth()}`
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ]

    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, {
        month: monthNames[shiftDate.getMonth()],
        year: shiftDate.getFullYear(),
        shifts: 0,
        hours: 0,
        grossPay: 0,
      })
    }

    const month = monthMap.get(monthKey)!
    month.shifts += 1
    month.hours += Number(shift.hoursWorked)
    month.grossPay += Number(shift.grossPay)
  })

  const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  
  return Array.from(monthMap.values()).sort(
    (a, b) => a.year - b.year || monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month)
  )
}

/**
 * Check if a given date is likely a public holiday (basic Australian holidays)
 */
export function isLikelyPublicHoliday(date: Date): boolean {
  const month = date.getMonth() + 1 // 1-based month
  const day = date.getDate()

  // Fixed date holidays
  const fixedHolidays = [
    { month: 1, day: 1 },   // New Year's Day
    { month: 1, day: 26 },  // Australia Day
    { month: 4, day: 25 },  // ANZAC Day
    { month: 12, day: 25 }, // Christmas Day
    { month: 12, day: 26 }, // Boxing Day
  ]

  return fixedHolidays.some(holiday => 
    holiday.month === month && holiday.day === day
  )
}

/**
 * Get shifts for a specific calendar month
 */
export async function getShiftsForMonth(year: number, month: number) {
  const startDate = new Date(year, month, 1)
  const endDate = new Date(year, month + 1, 0) // Last day of month

  return await prisma.shift.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      payRate: true,
    },
    orderBy: [
      { date: 'asc' },
      { startTime: 'asc' },
    ],
  })
}

/**
 * Calculate projected earnings for upcoming shifts
 */
export async function calculateUpcomingEarnings(days: number = 30): Promise<number> {
  const upcomingShifts = await getUpcomingShifts(days)
  return upcomingShifts.reduce((total, shift) => total + Number(shift.grossPay), 0)
}

/**
 * Get shift conflicts (overlapping shifts)
 */
export async function getShiftConflicts(): Promise<Array<{ shift1: Shift; shift2: Shift }>> {
  const shifts = await prisma.shift.findMany({
    orderBy: { startTime: 'asc' },
  })

  const conflicts: Array<{ shift1: Shift; shift2: Shift }> = []

  for (let i = 0; i < shifts.length; i++) {
    for (let j = i + 1; j < shifts.length; j++) {
      const shift1 = shifts[i]
      const shift2 = shifts[j]

      // Check if shifts overlap
      if (
        shift1.startTime < shift2.endTime &&
        shift1.endTime > shift2.startTime
      ) {
        conflicts.push({ shift1, shift2 })
      }
    }
  }

  return conflicts
}