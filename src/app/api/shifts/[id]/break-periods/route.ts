import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { 
  CreateBreakPeriodRequest, 
  BreakPeriodResponse, 
  BreakPeriodsListResponse, 
  ApiValidationResponse 
} from '@/types'
import { 
  ValidationResult, 
  validateString, 
  validateDateRange,
  validateCuid
} from '@/lib/validation'
import { 
  calculateAndUpdateShift, 
  fetchShiftBreakPeriods,
  updateShiftWithCalculation 
} from '@/lib/shift-calculation'
import { PayPeriodSyncService } from '@/lib/pay-period-sync-service'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

/**
 * Recalculates and updates shift pay after break period changes
 */
async function recalculateShiftPay(shiftId: string): Promise<void> {
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId }
  })
  
  if (!shift) return
  
  const breakPeriods = await fetchShiftBreakPeriods(shiftId)
  const calculation = await calculateAndUpdateShift({
    payGuideId: shift.payGuideId,
    startTime: shift.startTime,
    endTime: shift.endTime,
    breakPeriods
  })
  
  if (calculation) {
    await updateShiftWithCalculation(shiftId, calculation)
  }
}

// GET /api/shifts/[id]/break-periods - List break periods for a shift
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: shiftId } = await params
    const { searchParams } = new URL(request.url)
    
    // Parse query parameters
    const page = Number(searchParams.get('page') || '1')
    const limit = Number(searchParams.get('limit') || '10')
    const sortBy = searchParams.get('sortBy') || 'startTime'
    const sortOrder = (searchParams.get('sortOrder') || 'asc') as 'asc' | 'desc'

    // Validate parameters
    const validator = ValidationResult.create()
    validateCuid(shiftId, 'shiftId', validator)
    
    if (page < 1) validator.addError('page', 'Page must be at least 1')
    if (limit < 1 || limit > 100) validator.addError('limit', 'Limit must be between 1 and 100')
    if (!['startTime', 'endTime', 'createdAt'].includes(sortBy)) {
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

    // Check if shift exists
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId }
    })

    if (!shift) {
      return NextResponse.json(
        { error: 'Shift not found' },
        { status: 404 }
      )
    }

    // Get total count for pagination
    const total = await prisma.breakPeriod.count({
      where: { shiftId }
    })
    
    // Calculate pagination
    const skip = (page - 1) * limit
    const totalPages = Math.ceil(total / limit)

    // Fetch break periods
    const breakPeriods = await prisma.breakPeriod.findMany({
      where: { shiftId },
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder }
    })

    // Transform to response format
    const responseBreakPeriods: BreakPeriodResponse[] = breakPeriods.map(bp => ({
      id: bp.id,
      shiftId: bp.shiftId,
      startTime: bp.startTime.toISOString(),
      endTime: bp.endTime.toISOString(),
      createdAt: bp.createdAt.toISOString(),
      updatedAt: bp.updatedAt.toISOString()
    }))

    const response: BreakPeriodsListResponse = {
      breakPeriods: responseBreakPeriods,
      shiftId,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    }

    return NextResponse.json({ data: response })

  } catch (error) {
    console.error('Error fetching break periods:', error)
    return NextResponse.json(
      { error: 'Failed to fetch break periods' },
      { status: 500 }
    )
  }
}

// POST /api/shifts/[id]/break-periods - Create a new break period
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: shiftId } = await params
    const body: CreateBreakPeriodRequest = await request.json()

    // Validate shift ID
    const validator = ValidationResult.create()
    validateCuid(shiftId, 'shiftId', validator)

    if (!validator.isValid()) {
      return NextResponse.json({
        errors: validator.getErrors(),
        message: 'Invalid shift ID'
      } as ApiValidationResponse, { status: 400 })
    }

    // Check if shift exists and get its timing
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId }
    })

    if (!shift) {
      return NextResponse.json({
        errors: [{ field: 'shiftId', message: 'Shift not found' }],
        message: 'Invalid shift'
      } as ApiValidationResponse, { status: 404 })
    }

    // Validate request body
    validateString(body.startTime, 'startTime', validator)
    validateString(body.endTime, 'endTime', validator)

    // Validate date range
    if (validator.isValid()) {
      validateDateRange(
        body.startTime, 
        body.endTime, 
        validator, 
        { maxDurationHours: 4 } // Maximum 4 hour break
      )
    }

    if (!validator.isValid()) {
      return NextResponse.json({
        errors: validator.getErrors(),
        message: 'Invalid break period data'
      } as ApiValidationResponse, { status: 400 })
    }

    const breakStart = new Date(body.startTime)
    const breakEnd = new Date(body.endTime)

    // Validate break period is within shift bounds
    if (breakStart < shift.startTime || breakEnd > shift.endTime) {
      return NextResponse.json({
        errors: [{ 
          field: 'timing', 
          message: 'Break period must be within shift duration' 
        }],
        message: 'Invalid break timing'
      } as ApiValidationResponse, { status: 400 })
    }

    // Check for overlapping break periods
    const overlappingBreaks = await prisma.breakPeriod.findMany({
      where: {
        shiftId,
        OR: [
          {
            AND: [
              { startTime: { lte: breakStart } },
              { endTime: { gt: breakStart } }
            ]
          },
          {
            AND: [
              { startTime: { lt: breakEnd } },
              { endTime: { gte: breakEnd } }
            ]
          },
          {
            AND: [
              { startTime: { gte: breakStart } },
              { endTime: { lte: breakEnd } }
            ]
          }
        ]
      }
    })

    if (overlappingBreaks.length > 0) {
      return NextResponse.json({
        errors: [{ 
          field: 'timing', 
          message: 'Break period overlaps with existing break' 
        }],
        message: 'Overlapping break periods not allowed'
      } as ApiValidationResponse, { status: 409 })
    }

    // Create the break period
    const breakPeriod = await prisma.breakPeriod.create({
      data: {
        shiftId,
        startTime: breakStart,
        endTime: breakEnd
      }
    })

    // Recalculate shift pay with updated break periods
    await recalculateShiftPay(shiftId)

    // Trigger automatic pay period sync after break period changes
    await PayPeriodSyncService.onBreakPeriodsChanged(shiftId)

    // Transform to response format
    const responseBreakPeriod: BreakPeriodResponse = {
      id: breakPeriod.id,
      shiftId: breakPeriod.shiftId,
      startTime: breakPeriod.startTime.toISOString(),
      endTime: breakPeriod.endTime.toISOString(),
      createdAt: breakPeriod.createdAt.toISOString(),
      updatedAt: breakPeriod.updatedAt.toISOString()
    }

    return NextResponse.json(
      { data: responseBreakPeriod, message: 'Break period created successfully' },
      { status: 201 }
    )

  } catch (error) {
    console.error('Error creating break period:', error)
    return NextResponse.json(
      { error: 'Failed to create break period' },
      { status: 500 }
    )
  }
}