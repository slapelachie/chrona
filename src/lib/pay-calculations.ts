import { prisma } from './db'
import { PayRate } from '@/types'

export interface ShiftDetails {
  date: Date
  startTime: Date
  endTime: Date
  breakTime: number // hours
  isPublicHoliday?: boolean
}

export interface PayCalculationResult {
  payRate: PayRate
  hourlyRate: number
  hoursWorked: number
  regularHours: number
  overtimeHours: number
  penaltyHours: number
  grossPay: number
  isNightShift: boolean
}

/**
 * Determine if a time falls within night shift hours
 */
export function isNightShift(time: Date, nightStart: string, nightEnd: string): boolean {
  const timeStr = time.toTimeString().substring(0, 5) // HH:MM format
  
  // Handle overnight shifts (e.g., 22:00 to 06:00)
  if (nightStart > nightEnd) {
    return timeStr >= nightStart || timeStr <= nightEnd
  } else {
    return timeStr >= nightStart && timeStr <= nightEnd
  }
}

/**
 * Calculate hours worked excluding break time
 */
export function calculateHoursWorked(startTime: Date, endTime: Date, breakTime: number): number {
  const totalMilliseconds = endTime.getTime() - startTime.getTime()
  const totalHours = totalMilliseconds / (1000 * 60 * 60)
  return Math.max(0, totalHours - breakTime)
}

/**
 * Find the most appropriate pay rate for a shift
 */
export async function findApplicablePayRate(shift: ShiftDetails): Promise<PayRate> {
  const { date, startTime, isPublicHoliday = false } = shift
  
  // Get all active pay rates for the shift date
  const availableRates = await prisma.payRate.findMany({
    where: {
      effectiveFrom: { lte: date },
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gte: date } }
      ]
    },
    orderBy: [
      { isDefault: 'desc' },
      { effectiveFrom: 'desc' }
    ]
  })

  if (availableRates.length === 0) {
    throw new Error('No applicable pay rates found for shift date')
  }

  // Check for public holiday rate first (highest priority)
  if (isPublicHoliday) {
    const holidayRate = availableRates.find(rate => rate.applyPublicHoliday)
    if (holidayRate) return holidayRate
  }

  // Check for weekend rate
  const dayOfWeek = date.getDay() // 0 = Sunday, 6 = Saturday
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    const weekendRate = availableRates.find(rate => rate.applyWeekend)
    if (weekendRate) return weekendRate
  }

  // Check for night shift rate
  const nightRates = availableRates.filter(rate => 
    rate.applyNight && rate.nightStart && rate.nightEnd
  )
  
  for (const nightRate of nightRates) {
    if (isNightShift(startTime, nightRate.nightStart!, nightRate.nightEnd!)) {
      return nightRate
    }
  }

  // Default to base rate
  const baseRate = availableRates.find(rate => rate.isDefault && rate.rateType === 'BASE')
  if (baseRate) return baseRate

  // Fallback to first available rate
  return availableRates[0]
}

/**
 * Calculate overtime hours based on pay rate rules
 */
export function calculateOvertimeHours(
  hoursWorked: number, 
  payRate: PayRate
): { regularHours: number; overtimeHours: number } {
  const overtimeThreshold = payRate.overtimeThreshold ? Number(payRate.overtimeThreshold) : null
  
  if (!overtimeThreshold || hoursWorked <= overtimeThreshold) {
    return {
      regularHours: hoursWorked,
      overtimeHours: 0
    }
  }
  
  return {
    regularHours: overtimeThreshold,
    overtimeHours: hoursWorked - overtimeThreshold
  }
}

/**
 * Calculate penalty hours (weekend, holiday, night shift hours that aren't overtime)
 */
export function calculatePenaltyHours(
  hoursWorked: number,
  regularHours: number,
  payRate: PayRate
): number {
  // Penalty hours are regular hours worked under penalty conditions
  if (payRate.rateType !== 'PENALTY') return 0
  
  // For penalty rates, the regular hours (not overtime) are penalty hours
  return regularHours
}

/**
 * Calculate total gross pay for a shift
 */
export async function calculateShiftPay(shift: ShiftDetails): Promise<PayCalculationResult> {
  const payRate = await findApplicablePayRate(shift)
  const hoursWorked = calculateHoursWorked(shift.startTime, shift.endTime, shift.breakTime)
  
  // Calculate regular vs overtime hours
  const { regularHours, overtimeHours } = calculateOvertimeHours(hoursWorked, payRate)
  
  // Calculate penalty hours
  const penaltyHours = calculatePenaltyHours(hoursWorked, regularHours, payRate)
  
  // Determine effective hourly rate
  const baseRate = Number(payRate.baseRate)
  const multiplier = Number(payRate.multiplier)
  const hourlyRate = baseRate * multiplier
  
  // Calculate gross pay
  let grossPay = regularHours * hourlyRate
  
  // Add overtime pay if applicable
  if (overtimeHours > 0 && payRate.overtimeMultiplier) {
    const overtimeRate = baseRate * Number(payRate.overtimeMultiplier)
    grossPay += overtimeHours * overtimeRate
  }
  
  // Check if this is a night shift
  const isNightShiftResult = Boolean(payRate.applyNight && 
    payRate.nightStart && 
    payRate.nightEnd && 
    isNightShift(shift.startTime, payRate.nightStart, payRate.nightEnd))
  
  return {
    payRate,
    hourlyRate,
    hoursWorked,
    regularHours,
    overtimeHours,
    penaltyHours,
    grossPay,
    isNightShift: isNightShiftResult
  }
}

/**
 * Calculate pay for multiple shifts (e.g., for a pay period)
 */
export async function calculatePeriodPay(shifts: ShiftDetails[]) {
  const shiftCalculations = await Promise.all(
    shifts.map(shift => calculateShiftPay(shift))
  )
  
  const totals = shiftCalculations.reduce(
    (acc, calc) => ({
      totalHours: acc.totalHours + calc.hoursWorked,
      regularHours: acc.regularHours + calc.regularHours,
      overtimeHours: acc.overtimeHours + calc.overtimeHours,
      penaltyHours: acc.penaltyHours + calc.penaltyHours,
      grossPay: acc.grossPay + calc.grossPay
    }),
    {
      totalHours: 0,
      regularHours: 0,
      overtimeHours: 0,
      penaltyHours: 0,
      grossPay: 0
    }
  )
  
  return {
    shifts: shiftCalculations,
    totals
  }
}