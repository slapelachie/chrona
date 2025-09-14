import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  CreatePayPeriodRequest,
  PayPeriodListItem,
  PayPeriodsListResponse,
  PayPeriodResponse,
  ApiValidationResponse,
  PayPeriodStatus,
} from '@/types'
import {
  ValidationResult,
  validateString,
  validateDateRange,
} from '@/lib/validation'

// GET /api/pay-periods - List pay periods with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Parse query parameters
    const page = Number(searchParams.get('page') || '1')
    const limit = Number(searchParams.get('limit') || '10')
    const sortBy = searchParams.get('sortBy') || 'startDate'
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'
    const startAfter = searchParams.get('startAfter')
    const endBefore = searchParams.get('endBefore')
    const status = searchParams.get('status')
    const includeShifts = searchParams.get('include')?.includes('shifts')

    // Validate pagination parameters
    const validator = ValidationResult.create()

    if (page < 1) validator.addError('page', 'Page must be at least 1')
    if (limit < 1 || limit > 100)
      validator.addError('limit', 'Limit must be between 1 and 100')
    if (!['startDate', 'endDate', 'totalPay', 'createdAt'].includes(sortBy)) {
      validator.addError('sortBy', 'Invalid sort field')
    }
    if (!['asc', 'desc'].includes(sortOrder)) {
      validator.addError('sortOrder', 'Sort order must be asc or desc')
    }

    if (status && !['open', 'processing', 'paid', 'verified'].includes(status)) {
      validator.addError('status', 'Invalid status value')
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

    // Get the default user (single user app)
    const user = await prisma.user.findFirst()
    if (!user) {
      return NextResponse.json(
        { error: 'No user found. Please seed the database first.' },
        { status: 400 }
      )
    }

    // Build where clause for filtering
    const where: Record<string, any> = { userId: user.id }

    if (startAfter) {
      where.startDate = { gte: new Date(startAfter) }
    }

    if (endBefore) {
      where.endDate = { lte: new Date(endBefore) }
    }

    if (status) {
      where.status = status
    }

    // Get total count for pagination
    const total = await prisma.payPeriod.count({ where })

    // Calculate pagination
    const skip = (page - 1) * limit
    const totalPages = Math.ceil(total / limit)

    // Fetch pay periods
    const payPeriods = await prisma.payPeriod.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        _count: {
          select: { shifts: true }
        },
        ...(includeShifts && {
          shifts: {
            orderBy: { startTime: 'asc' as const }
          }
        })
      },
    })

    // Transform to response format
    if (includeShifts) {
      // Return full PayPeriodResponse with shifts
      const responsePayPeriods: PayPeriodResponse[] = payPeriods.map((payPeriod) => ({
        id: payPeriod.id,
        userId: payPeriod.userId,
        startDate: payPeriod.startDate,
        endDate: payPeriod.endDate,
        status: payPeriod.status as PayPeriodStatus,
        totalHours: payPeriod.totalHours?.toString(),
        totalPay: payPeriod.totalPay?.toString(),
        paygWithholding: payPeriod.paygWithholding?.toString(),
        medicareLevy: payPeriod.medicareLevy?.toString(),
        hecsHelpAmount: payPeriod.hecsHelpAmount?.toString(),
        totalWithholdings: payPeriod.totalWithholdings?.toString(),
        netPay: payPeriod.netPay?.toString(),
        actualPay: payPeriod.actualPay?.toString(),
        verified: payPeriod.verified,
        createdAt: payPeriod.createdAt,
        updatedAt: payPeriod.updatedAt,
        shifts: (payPeriod as any).shifts?.map((shift: any) => ({
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
          notes: shift.notes || undefined,
          payPeriodId: shift.payPeriodId || '',
          createdAt: shift.createdAt,
          updatedAt: shift.updatedAt,
        })),
      }))

      return NextResponse.json({ data: responsePayPeriods })
    } else {
      // Return lightweight list format
      const responsePayPeriods: PayPeriodListItem[] = payPeriods.map((payPeriod) => ({
        id: payPeriod.id,
        startDate: payPeriod.startDate,
        endDate: payPeriod.endDate,
        status: payPeriod.status as PayPeriodStatus,
        totalHours: payPeriod.totalHours?.toString(),
        totalPay: payPeriod.totalPay?.toString(),
        netPay: payPeriod.netPay?.toString(),
        verified: payPeriod.verified,
        shiftsCount: (payPeriod as any)._count.shifts,
      }))

      const response: PayPeriodsListResponse = {
        payPeriods: responsePayPeriods,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      }

      return NextResponse.json({ data: response })
    }
  } catch (error) {
    console.error('Error fetching pay periods:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pay periods' },
      { status: 500 }
    )
  }
}

// POST /api/pay-periods - Create a new pay period
export async function POST(request: NextRequest) {
  try {
    const body: CreatePayPeriodRequest = await request.json()

    // Validate request body
    const validator = ValidationResult.create()

    validateString(body.startDate, 'startDate', validator)
    validateString(body.endDate, 'endDate', validator)

    if (body.status && !['open', 'processing', 'paid', 'verified'].includes(body.status)) {
      validator.addError('status', 'Invalid status value')
    }

    // Validate date range
    if (validator.isValid()) {
      validateDateRange(body.startDate, body.endDate, validator)
    }

    if (!validator.isValid()) {
      return NextResponse.json(
        {
          errors: validator.getErrors(),
          message: 'Invalid pay period data',
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

    const startDate = new Date(body.startDate)
    const endDate = new Date(body.endDate)

    // Check for overlapping pay periods
    const overlappingPeriod = await prisma.payPeriod.findFirst({
      where: {
        userId: user.id,
        OR: [
          {
            AND: [
              { startDate: { lte: startDate } },
              { endDate: { gte: startDate } }
            ]
          },
          {
            AND: [
              { startDate: { lte: endDate } },
              { endDate: { gte: endDate } }
            ]
          },
          {
            AND: [
              { startDate: { gte: startDate } },
              { endDate: { lte: endDate } }
            ]
          }
        ]
      }
    })

    if (overlappingPeriod) {
      return NextResponse.json(
        {
          errors: [{
            field: 'dateRange',
            message: 'Pay period overlaps with existing period'
          }],
          message: 'Overlapping pay period',
        } as ApiValidationResponse,
        { status: 400 }
      )
    }

    // Create the pay period
    const payPeriod = await prisma.payPeriod.create({
      data: {
        userId: user.id,
        startDate,
        endDate,
        status: body.status || 'open',
        verified: false,
      },
    })

    // Transform to response format
    const response: PayPeriodResponse = {
      id: payPeriod.id,
      userId: payPeriod.userId,
      startDate: payPeriod.startDate,
      endDate: payPeriod.endDate,
      status: payPeriod.status as PayPeriodStatus,
      totalHours: payPeriod.totalHours?.toString(),
      totalPay: payPeriod.totalPay?.toString(),
      paygWithholding: payPeriod.paygWithholding?.toString(),
      medicareLevy: payPeriod.medicareLevy?.toString(),
      hecsHelpAmount: payPeriod.hecsHelpAmount?.toString(),
      totalWithholdings: payPeriod.totalWithholdings?.toString(),
      netPay: payPeriod.netPay?.toString(),
      actualPay: payPeriod.actualPay?.toString(),
      verified: payPeriod.verified,
      createdAt: payPeriod.createdAt,
      updatedAt: payPeriod.updatedAt,
    }

    return NextResponse.json(
      { data: response, message: 'Pay period created successfully' },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating pay period:', error)
    return NextResponse.json(
      { error: 'Failed to create pay period' },
      { status: 500 }
    )
  }
}