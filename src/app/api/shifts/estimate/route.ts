import { NextRequest, NextResponse } from 'next/server'
import { calculateShiftPay } from '@/lib/pay-calculations'
import { z } from 'zod'

const estimateSchema = z.object({
  date: z.coerce.date(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  breakTime: z.number().min(0),
  payRateId: z.string(),
  isPublicHoliday: z.boolean().optional(),
})

// POST /api/shifts/estimate - Calculate pay estimate for a shift
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = estimateSchema.parse(body)

    const shiftDetails = {
      date: validatedData.date,
      startTime: validatedData.startTime,
      endTime: validatedData.endTime,
      breakTime: validatedData.breakTime,
      isPublicHoliday: validatedData.isPublicHoliday,
    }

    const calculation = await calculateShiftPay(shiftDetails)

    return NextResponse.json({
      hourlyRate: calculation.hourlyRate,
      hoursWorked: calculation.hoursWorked,
      regularHours: calculation.regularHours,
      overtimeHours: calculation.overtimeHours,
      penaltyHours: calculation.penaltyHours,
      estimatedPay: calculation.grossPay,
      rateType: calculation.payRate.rateType,
      rateName: calculation.payRate.name,
      isNightShift: calculation.isNightShift,
    })
  } catch (error) {
    console.error('Error calculating shift estimate:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to calculate estimate' },
      { status: 500 }
    )
  }
}