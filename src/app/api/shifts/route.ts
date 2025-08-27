import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { shiftSchema } from '@/types'
import { calculateShiftPay } from '@/lib/pay-calculations'
import { z } from 'zod'

const querySchema = z.object({
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  payRateId: z.string().optional().nullable(),
  limit: z.string().optional().nullable(),
  offset: z.string().optional().nullable(),
})

// GET /api/shifts - List shifts with optional filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = querySchema.parse({
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      payRateId: searchParams.get('payRateId'),
      limit: searchParams.get('limit'),
      offset: searchParams.get('offset'),
    })

    const where: any = {}
    
    // Date range filtering
    if (query.startDate) {
      where.date = { gte: new Date(query.startDate) }
    }
    if (query.endDate) {
      where.date = { ...where.date, lte: new Date(query.endDate) }
    }
    
    // Pay rate filtering
    if (query.payRateId) {
      where.payRateId = query.payRateId
    }

    const limit = query.limit ? parseInt(query.limit) : 50
    const offset = query.offset ? parseInt(query.offset) : 0

    const [shifts, total] = await Promise.all([
      prisma.shift.findMany({
        where,
        include: {
          payRate: true,
        },
        orderBy: [
          { date: 'desc' },
          { startTime: 'desc' }
        ],
        take: limit,
        skip: offset,
      }),
      prisma.shift.count({ where })
    ])

    return NextResponse.json({
      shifts,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + shifts.length < total
      }
    })
  } catch (error) {
    console.error('Error fetching shifts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch shifts' },
      { status: 500 }
    )
  }
}

// POST /api/shifts - Create a new shift
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    // Parse and convert date strings to Date objects
    const bodyWithDates = {
      ...body,
      date: new Date(body.date),
      startTime: new Date(body.startTime),
      endTime: new Date(body.endTime),
    }
    const validatedData = shiftSchema.parse(bodyWithDates)

    // Calculate shift details before saving
    const shiftDetails = {
      date: validatedData.date,
      startTime: validatedData.startTime,
      endTime: validatedData.endTime,
      breakTime: validatedData.breakTime,
      isPublicHoliday: validatedData.isPublicHoliday,
    }

    const calculation = await calculateShiftPay(shiftDetails)

    // Create the shift with calculated values
    const shift = await prisma.shift.create({
      data: {
        date: validatedData.date,
        startTime: validatedData.startTime,
        endTime: validatedData.endTime,
        breakTime: validatedData.breakTime,
        payRateId: validatedData.payRateId,
        hourlyRate: calculation.hourlyRate,
        hoursWorked: calculation.hoursWorked,
        regularHours: calculation.regularHours,
        overtimeHours: calculation.overtimeHours,
        penaltyHours: calculation.penaltyHours,
        grossPay: calculation.grossPay,
        isPublicHoliday: validatedData.isPublicHoliday,
        isNightShift: calculation.isNightShift,
        notes: validatedData.notes,
      },
      include: {
        payRate: true,
      },
    })

    return NextResponse.json(shift, { status: 201 })
  } catch (error) {
    console.error('Error creating shift:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create shift' },
      { status: 500 }
    )
  }
}