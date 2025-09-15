import { Decimal } from 'decimal.js'
import { PayCalculator } from '@/lib/calculations/pay-calculator'
import { prisma } from '@/lib/db'
import { 
  PayGuide, 
  PenaltyTimeFrame, 
  OvertimeTimeFrame, 
  PublicHoliday, 
  BreakPeriod,
  PayCalculationResult 
} from '@/types'

/**
 * Shared utilities for shift pay calculation integration
 * Follows DRY principles and provides consistent calculation logic across the API
 */

export interface ShiftCalculationInput {
  payGuideId: string
  startTime: Date
  endTime: Date
  breakPeriods?: BreakPeriod[]
}

export interface ShiftCalculationResult {
  totalHours: Decimal
  basePay: Decimal
  overtimePay: Decimal
  penaltyPay: Decimal
  totalPay: Decimal
  calculationDetails: PayCalculationResult
}

/**
 * Fetches all required data for pay calculation from database
 */
export async function fetchCalculationData(payGuideId: string): Promise<{
  payGuide: PayGuide
  penaltyTimeFrames: PenaltyTimeFrame[]
  overtimeTimeFrames: OvertimeTimeFrame[]
  publicHolidays: PublicHoliday[]
} | null> {
  const payGuideRecord = await prisma.payGuide.findUnique({
    where: { 
      id: payGuideId,
      isActive: true 
    },
    include: {
      penaltyTimeFrames: {
        where: { isActive: true }
      },
      overtimeTimeFrames: {
        where: { isActive: true }
      },
      publicHolidays: {
        where: { isActive: true }
      }
    }
  })

  if (!payGuideRecord) {
    return null
  }

  // Transform database records to domain types
  const payGuide: PayGuide = {
    id: payGuideRecord.id,
    name: payGuideRecord.name,
    baseRate: payGuideRecord.baseRate,
    minimumShiftHours: payGuideRecord.minimumShiftHours,
    maximumShiftHours: payGuideRecord.maximumShiftHours,
    description: payGuideRecord.description,
    effectiveFrom: payGuideRecord.effectiveFrom,
    effectiveTo: payGuideRecord.effectiveTo,
    timezone: payGuideRecord.timezone,
    isActive: payGuideRecord.isActive,
    createdAt: payGuideRecord.createdAt,
    updatedAt: payGuideRecord.updatedAt
  }

  const penaltyTimeFrames: PenaltyTimeFrame[] = payGuideRecord.penaltyTimeFrames.map(ptf => ({
    id: ptf.id,
    payGuideId: ptf.payGuideId,
    name: ptf.name,
    multiplier: ptf.multiplier,
    dayOfWeek: ptf.dayOfWeek,
    startTime: ptf.startTime,
    endTime: ptf.endTime,
    isPublicHoliday: ptf.isPublicHoliday,
    description: ptf.description,
    isActive: ptf.isActive,
    createdAt: ptf.createdAt,
    updatedAt: ptf.updatedAt
  }))

  const overtimeTimeFrames: OvertimeTimeFrame[] = payGuideRecord.overtimeTimeFrames.map(otf => ({
    id: otf.id,
    payGuideId: otf.payGuideId,
    name: otf.name,
    firstThreeHoursMult: otf.firstThreeHoursMult,
    afterThreeHoursMult: otf.afterThreeHoursMult,
    dayOfWeek: otf.dayOfWeek,
    startTime: otf.startTime,
    endTime: otf.endTime,
    isPublicHoliday: otf.isPublicHoliday,
    description: otf.description,
    isActive: otf.isActive,
    createdAt: otf.createdAt,
    updatedAt: otf.updatedAt
  }))

  const publicHolidays: PublicHoliday[] = payGuideRecord.publicHolidays.map(ph => ({
    id: ph.id,
    payGuideId: ph.payGuideId,
    name: ph.name,
    date: ph.date,
    isActive: ph.isActive,
    createdAt: ph.createdAt,
    updatedAt: ph.updatedAt
  }))

  return {
    payGuide,
    penaltyTimeFrames,
    overtimeTimeFrames,
    publicHolidays
  }
}

/**
 * Calculates shift pay using the PayCalculator
 */
export function calculateShiftPay(
  calculationData: {
    payGuide: PayGuide
    penaltyTimeFrames: PenaltyTimeFrame[]
    overtimeTimeFrames: OvertimeTimeFrame[]
    publicHolidays: PublicHoliday[]
  },
  input: ShiftCalculationInput
): ShiftCalculationResult {
  const { payGuide, penaltyTimeFrames, overtimeTimeFrames, publicHolidays } = calculationData
  
  const calculator = new PayCalculator(
    payGuide,
    penaltyTimeFrames,
    overtimeTimeFrames,
    publicHolidays
  )

  const calculationDetails = calculator.calculate(
    input.startTime,
    input.endTime,
    input.breakPeriods || []
  )

  return {
    totalHours: calculationDetails.breakdown.baseHours
      .plus(calculationDetails.breakdown.overtimeHours)
      .plus(calculationDetails.breakdown.penaltyHours),
    basePay: calculationDetails.breakdown.basePay,
    overtimePay: calculationDetails.breakdown.overtimePay,
    penaltyPay: calculationDetails.breakdown.penaltyPay,
    totalPay: calculationDetails.breakdown.totalPay,
    calculationDetails
  }
}

/**
 * Complete workflow for calculating and getting shift pay data
 */
export async function calculateAndUpdateShift(
  input: ShiftCalculationInput
): Promise<ShiftCalculationResult | null> {
  const calculationData = await fetchCalculationData(input.payGuideId)
  
  if (!calculationData) {
    return null
  }

  return calculateShiftPay(calculationData, input)
}

/**
 * Updates shift record with calculated pay values
 */
export async function updateShiftWithCalculation(
  shiftId: string,
  calculation: ShiftCalculationResult
): Promise<void> {
  try {
    // Persist shift aggregate fields and replace per-segment rows atomically
    const { penalties, overtimes } = calculation.calculationDetails

    await prisma.$transaction(async (tx) => {
      // 1) Update aggregate totals on the shift
      await tx.shift.update({
        where: { id: shiftId },
        data: {
          totalHours: calculation.totalHours,
          basePay: calculation.basePay,
          overtimePay: calculation.overtimePay,
          penaltyPay: calculation.penaltyPay,
          totalPay: calculation.totalPay,
        },
      })

      // 2) Replace penalty segments
      await tx.shiftPenaltySegment.deleteMany({ where: { shiftId } })
      if (penalties && penalties.length > 0) {
        await tx.shiftPenaltySegment.createMany({
          data: penalties.map((p) => ({
            shiftId,
            timeFrameId: p.timeFrameId,
            name: p.name,
            multiplier: p.multiplier,
            hours: p.hours,
            pay: p.pay,
            startTime: p.startTime,
            endTime: p.endTime,
          })),
        })
      }

      // 3) Replace overtime segments
      await tx.shiftOvertimeSegment.deleteMany({ where: { shiftId } })
      if (overtimes && overtimes.length > 0) {
        await tx.shiftOvertimeSegment.createMany({
          data: overtimes.map((o) => ({
            shiftId,
            timeFrameId: o.timeFrameId,
            name: o.name,
            multiplier: o.multiplier,
            hours: o.hours,
            pay: o.pay,
            startTime: o.startTime,
            endTime: o.endTime,
          })),
        })
      }
    })
  } catch (err: any) {
    // In test/mock flows, the shift may have been removed or updated concurrently.
    // Swallow Prisma P2025 (record not found for update) to keep sync idempotent.
    if (err && err.code === 'P2025') {
      console.warn('Skipping shift update; record not found:', shiftId)
      return
    }
    throw err
  }
}

/**
 * Fetches break periods for a shift
 */
export async function fetchShiftBreakPeriods(shiftId: string): Promise<BreakPeriod[]> {
  const breakPeriods = await prisma.breakPeriod.findMany({
    where: { shiftId },
    orderBy: { startTime: 'asc' }
  })

  return breakPeriods.map(bp => ({
    id: bp.id,
    shiftId: bp.shiftId,
    startTime: bp.startTime,
    endTime: bp.endTime,
    createdAt: bp.createdAt,
    updatedAt: bp.updatedAt
  }))
}
