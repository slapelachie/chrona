import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { 
  CreateShiftRequest, 
  ShiftResponse, 
  ShiftsListResponse, 
  ApiValidationResponse,
  BreakPeriodResponse,
  PayPeriodStatus
} from '@/types'
import { 
  ValidationResult, 
  validateString, 
  validateDateRange
} from '@/lib/validation'
import { 
  calculateAndUpdateShift, 
  fetchShiftBreakPeriods,
  updateShiftWithCalculation 
} from '@/lib/shift-calculation'

// GET /api/shifts - List shifts with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parse query parameters
    const page = Number(searchParams.get('page') || '1')
    const limit = Number(searchParams.get('limit') || '10')
    const sortBy = searchParams.get('sortBy') || 'startTime'
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const payGuideId = searchParams.get('payGuideId')
    const payPeriodId = searchParams.get('payPeriodId')

    // Validate pagination parameters
    const validator = ValidationResult.create()
    
    if (page < 1) validator.addError('page', 'Page must be at least 1')
    if (limit < 1 || limit > 100) validator.addError('limit', 'Limit must be between 1 and 100')
    if (!['startTime', 'endTime', 'totalPay', 'createdAt'].includes(sortBy)) {
      validator.addError('sortBy', 'Invalid sort field')
    }
    if (!['asc', 'desc'].includes(sortOrder)) {
      validator.addError('sortOrder', 'Sort order must be asc or desc')
    }

    if (!validator.isValid()) {
      return NextResponse.json({
        errors: validator.getErrors(),
        message: 'Invalid query parameters'
      } as ApiValidationResponse, { status: 400 })
    }

    // Build where clause for filtering
    const where: any = {}
    
    if (startDate || endDate) {
      where.startTime = {}
      if (startDate) where.startTime.gte = new Date(startDate)
      if (endDate) where.startTime.lte = new Date(endDate)
    }
    
    if (payGuideId) where.payGuideId = payGuideId
    if (payPeriodId) where.payPeriodId = payPeriodId

    // Get total count for pagination
    const total = await prisma.shift.count({ where })
    
    // Calculate pagination
    const skip = (page - 1) * limit
    const totalPages = Math.ceil(total / limit)

    // Fetch shifts with relations
    const shifts = await prisma.shift.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        payGuide: true,
        payPeriod: true,
        breakPeriods: {
          orderBy: { startTime: 'asc' }
        },
        user: {
          select: {
            id: true,
            name: true,
            timezone: true
          }
        }
      }
    })

    // Transform to response format
    const responseShifts: ShiftResponse[] = shifts.map(shift => ({
      id: shift.id,
      userId: shift.userId,
      payGuideId: shift.payGuideId,
      startTime: shift.startTime,
      endTime: shift.endTime,
      totalHours: shift.totalHours?.toString(),
      basePay: shift.basePay?.toString(),
      overtimePay: shift.overtimePay?.toString(),
      penaltyPay: shift.penaltyPay?.toString(),
      totalPay: shift.totalPay?.toString(),
      notes: shift.notes ?? undefined,
      payPeriodId: shift.payPeriodId ?? undefined,
      createdAt: shift.createdAt,
      updatedAt: shift.updatedAt,
      breakPeriods: shift.breakPeriods.map(bp => ({
        id: bp.id,
        shiftId: bp.shiftId,
        startTime: bp.startTime.toISOString(),
        endTime: bp.endTime.toISOString(),
        createdAt: bp.createdAt.toISOString(),
        updatedAt: bp.updatedAt.toISOString()
      })),
      payGuide: shift.payGuide ? {
        id: shift.payGuide.id,
        name: shift.payGuide.name,
        baseRate: shift.payGuide.baseRate.toString(),
        minimumShiftHours: shift.payGuide.minimumShiftHours ?? undefined,
        maximumShiftHours: shift.payGuide.maximumShiftHours ?? undefined,
        description: shift.payGuide.description ?? undefined,
        effectiveFrom: shift.payGuide.effectiveFrom,
        effectiveTo: shift.payGuide.effectiveTo ?? undefined,
        timezone: shift.payGuide.timezone,
        isActive: shift.payGuide.isActive,
        createdAt: shift.payGuide.createdAt,
        updatedAt: shift.payGuide.updatedAt
      } : undefined,
      payPeriod: shift.payPeriod ? {
        id: shift.payPeriod.id,
        userId: shift.payPeriod.userId,
        startDate: shift.payPeriod.startDate,
        endDate: shift.payPeriod.endDate,
        status: shift.payPeriod.status as PayPeriodStatus,
        totalHours: shift.payPeriod.totalHours?.toString(),
        totalPay: shift.payPeriod.totalPay?.toString(),
        actualPay: shift.payPeriod.actualPay?.toString(),
        verified: shift.payPeriod.verified,
        createdAt: shift.payPeriod.createdAt,
        updatedAt: shift.payPeriod.updatedAt
      } : undefined
    }))

    const response: ShiftsListResponse = {
      shifts: responseShifts,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    }

    return NextResponse.json({ data: response })

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
    const body: CreateShiftRequest = await request.json()

    // Validate request body
    const validator = ValidationResult.create()
    
    validateString(body.payGuideId, 'payGuideId', validator)
    validateString(body.startTime, 'startTime', validator)
    validateString(body.endTime, 'endTime', validator)
    
    if (body.notes !== undefined) {
      validateString(body.notes, 'notes', validator, { maxLength: 500 })
    }

    // Validate date range
    if (validator.isValid()) {
      validateDateRange(
        body.startTime, 
        body.endTime, 
        validator, 
        { maxDurationHours: 24 }
      )
    }

    if (!validator.isValid()) {
      return NextResponse.json({
        errors: validator.getErrors(),
        message: 'Invalid shift data'
      } as ApiValidationResponse, { status: 400 })
    }

    // Check if pay guide exists
    const payGuide = await prisma.payGuide.findUnique({
      where: { id: body.payGuideId }
    })

    if (!payGuide) {
      return NextResponse.json({
        errors: [{ field: 'payGuideId', message: 'Pay guide not found' }],
        message: 'Invalid pay guide'
      } as ApiValidationResponse, { status: 400 })
    }

    // Get the default user (single user app)
    const user = await prisma.user.findFirst()
    if (!user) {
      return NextResponse.json(
        { error: 'No user found. Please seed the database first.' },
        { status: 400 }
      )
    }

    // Find appropriate pay period for the shift
    const startTime = new Date(body.startTime)
    const payPeriod = await prisma.payPeriod.findFirst({
      where: {
        userId: user.id,
        startDate: { lte: startTime },
        endDate: { gte: startTime }
      }
    })

    // Create the shift without calculations first
    const shift = await prisma.shift.create({
      data: {
        userId: user.id,
        payGuideId: body.payGuideId,
        startTime: new Date(body.startTime),
        endTime: new Date(body.endTime),
        notes: body.notes,
        payPeriodId: payPeriod?.id
      },
      include: {
        payGuide: true,
        payPeriod: true,
        user: {
          select: {
            id: true,
            name: true,
            timezone: true
          }
        }
      }
    })

    // Calculate pay for the shift
    const breakPeriods = await fetchShiftBreakPeriods(shift.id)
    const calculation = await calculateAndUpdateShift({
      payGuideId: body.payGuideId,
      startTime: new Date(body.startTime),
      endTime: new Date(body.endTime),
      breakPeriods
    })

    if (calculation) {
      // Update the shift with calculated pay values
      await updateShiftWithCalculation(shift.id, calculation)
      
      // Update the shift object with calculated values for response
      shift.totalHours = calculation.totalHours
      shift.basePay = calculation.basePay
      shift.overtimePay = calculation.overtimePay
      shift.penaltyPay = calculation.penaltyPay
      shift.totalPay = calculation.totalPay
    }

    // Get break periods for response
    const responseBreakPeriods: BreakPeriodResponse[] = breakPeriods.map(bp => ({
      id: bp.id,
      shiftId: bp.shiftId,
      startTime: bp.startTime.toISOString(),
      endTime: bp.endTime.toISOString(),
      createdAt: bp.createdAt.toISOString(),
      updatedAt: bp.updatedAt.toISOString()
    }))

    // Transform to response format
    const responseShift: ShiftResponse = {
      id: shift.id,
      userId: shift.userId,
      payGuideId: shift.payGuideId,
      startTime: shift.startTime,
      endTime: shift.endTime,
      totalHours: shift.totalHours?.toString(),
      basePay: shift.basePay?.toString(),
      overtimePay: shift.overtimePay?.toString(),
      penaltyPay: shift.penaltyPay?.toString(),
      totalPay: shift.totalPay?.toString(),
      notes: shift.notes ?? undefined,
      payPeriodId: shift.payPeriodId ?? undefined,
      createdAt: shift.createdAt,
      updatedAt: shift.updatedAt,
      breakPeriods: responseBreakPeriods,
      payGuide: {
        id: shift.payGuide.id,
        name: shift.payGuide.name,
        baseRate: shift.payGuide.baseRate.toString(),
        minimumShiftHours: shift.payGuide.minimumShiftHours ?? undefined,
        maximumShiftHours: shift.payGuide.maximumShiftHours ?? undefined,
        description: shift.payGuide.description ?? undefined,
        effectiveFrom: shift.payGuide.effectiveFrom,
        effectiveTo: shift.payGuide.effectiveTo ?? undefined,
        timezone: shift.payGuide.timezone,
        isActive: shift.payGuide.isActive,
        createdAt: shift.payGuide.createdAt,
        updatedAt: shift.payGuide.updatedAt
      },
      payPeriod: shift.payPeriod ? {
        id: shift.payPeriod.id,
        userId: shift.payPeriod.userId,
        startDate: shift.payPeriod.startDate,
        endDate: shift.payPeriod.endDate,
        status: shift.payPeriod.status as PayPeriodStatus,
        totalHours: shift.payPeriod.totalHours?.toString(),
        totalPay: shift.payPeriod.totalPay?.toString(),
        actualPay: shift.payPeriod.actualPay?.toString(),
        verified: shift.payPeriod.verified,
        createdAt: shift.payPeriod.createdAt,
        updatedAt: shift.payPeriod.updatedAt
      } : undefined
    }

    return NextResponse.json(
      { data: responseShift, message: 'Shift created successfully' },
      { status: 201 }
    )

  } catch (error) {
    console.error('Error creating shift:', error)
    return NextResponse.json(
      { error: 'Failed to create shift' },
      { status: 500 }
    )
  }
}