import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  CreateShiftRequest,
  ShiftResponse,
  ShiftsListResponse,
  ApiValidationResponse,
  BreakPeriodResponse,
  PayPeriodStatus,
  ShiftListItem,
} from '@/types'
import {
  ValidationResult,
  validateString,
  validateDateRange,
} from '@/lib/validation'
import {
  calculateAndUpdateShift,
  fetchShiftBreakPeriods,
  updateShiftWithCalculation,
} from '@/lib/shift-calculation'
import { findOrCreatePayPeriod } from '@/lib/pay-period-utils'
import {
  parseIncludeParams,
  parseFieldParams,
  transformShiftToListItem,
  applyFieldSelection,
} from '@/lib/api-response-utils'
import { PayPeriodSyncService } from '@/lib/pay-period-sync-service'

// GET /api/shifts - List shifts with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Parse query parameters
    const page = Number(searchParams.get('page') || '1')
    const limit = Number(searchParams.get('limit') || '10')
    const sortBy = searchParams.get('sortBy') || 'startTime'
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as
      | 'asc'
      | 'desc'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const payGuideId = searchParams.get('payGuideId')
    const payPeriodId = searchParams.get('payPeriodId')

    // Parse optimization parameters
    const includes = parseIncludeParams(
      searchParams.get('include') || undefined
    )
    const fields = parseFieldParams(searchParams.get('fields') || undefined)

    // Validate pagination parameters
    const validator = ValidationResult.create()

    if (page < 1) validator.addError('page', 'Page must be at least 1')
    if (limit < 1 || limit > 100)
      validator.addError('limit', 'Limit must be between 1 and 100')
    if (!['startTime', 'endTime', 'totalPay', 'createdAt'].includes(sortBy)) {
      validator.addError('sortBy', 'Invalid sort field')
    }
    if (!['asc', 'desc'].includes(sortOrder)) {
      validator.addError('sortOrder', 'Sort order must be asc or desc')
    }

    if (!validator.isValid()) {
      return NextResponse.json(
        {
          errors: validator.getErrors(),
          message: 'Invalid query parameters',
        } as ApiValidationResponse,
        { status: 400 }
      )
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

    // Build include clause based on requested data
    const includeClause: any = {}

    // Only include payGuide if specifically requested
    if (includes.has('payGuide')) {
      includeClause.payGuide = true
    }

    // Only include payPeriod if specifically requested
    if (includes.has('payPeriod')) {
      includeClause.payPeriod = true
    }

    // Only include breakPeriods if specifically requested
    if (includes.has('breakPeriods')) {
      includeClause.breakPeriods = {
        orderBy: { startTime: 'asc' },
      }
    }

    // Fetch shifts with selective relations
    const shifts = await prisma.shift.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: includeClause,
    })

    // Transform to lightweight response format
    const responseShifts: ShiftListItem[] = shifts.map((shift) => {
      const listItem = transformShiftToListItem(shift, includes)
      return fields
        ? (applyFieldSelection(listItem, fields) as ShiftListItem)
        : listItem
    })

    const response: ShiftsListResponse = {
      shifts: responseShifts,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
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
      validateDateRange(body.startTime, body.endTime, validator, {
        maxDurationHours: 24,
      })
    }

    if (!validator.isValid()) {
      return NextResponse.json(
        {
          errors: validator.getErrors(),
          message: 'Invalid shift data',
        } as ApiValidationResponse,
        { status: 400 }
      )
    }

    // Check if pay guide exists
    const payGuide = await prisma.payGuide.findUnique({
      where: { id: body.payGuideId },
    })

    if (!payGuide) {
      return NextResponse.json(
        {
          errors: [{ field: 'payGuideId', message: 'Pay guide not found' }],
          message: 'Invalid pay guide',
        } as ApiValidationResponse,
        { status: 400 }
      )
    }

    // Get the default user (single user app)
    const user = await prisma.user.findFirst()
    if (!user) {
      return NextResponse.json(
        { error: 'No user found. Please seed the database first.' },
        { status: 400 }
      )
    }

    // Find or create appropriate pay period for the shift
    const startTime = new Date(body.startTime)
    const payPeriod = await findOrCreatePayPeriod(user.id, startTime)

    // Create the shift without calculations first
    const shift = await prisma.shift.create({
      data: {
        userId: user.id,
        payGuideId: body.payGuideId,
        startTime: new Date(body.startTime),
        endTime: new Date(body.endTime),
        notes: body.notes,
        payPeriodId: payPeriod.id,
      },
      include: {
        payGuide: true,
        payPeriod: true,
        user: {
          select: {
            id: true,
            name: true,
            timezone: true,
          },
        },
      },
    })

    // Calculate pay for the shift
    const breakPeriods = await fetchShiftBreakPeriods(shift.id)
    const calculation = await calculateAndUpdateShift({
      payGuideId: body.payGuideId,
      startTime: new Date(body.startTime),
      endTime: new Date(body.endTime),
      breakPeriods,
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

    // Trigger automatic pay period sync after successful shift creation
    await PayPeriodSyncService.onShiftCreated(shift.id)

    // Get break periods for response
    const responseBreakPeriods: BreakPeriodResponse[] = breakPeriods.map(
      (bp) => ({
        id: bp.id,
        shiftId: bp.shiftId,
        startTime: bp.startTime.toISOString(),
        endTime: bp.endTime.toISOString(),
        createdAt: bp.createdAt.toISOString(),
        updatedAt: bp.updatedAt.toISOString(),
      })
    )

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
