import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { 
  UpdateBreakPeriodRequest, 
  BreakPeriodResponse, 
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

interface RouteParams {
  params: {
    id: string
    periodId: string
  }
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

// GET /api/shifts/[id]/break-periods/[periodId] - Get specific break period
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: shiftId, periodId } = params

    // Validate IDs
    const validator = ValidationResult.create()
    validateCuid(shiftId, 'shiftId', validator)
    validateCuid(periodId, 'periodId', validator)

    if (!validator.isValid()) {
      return NextResponse.json({
        errors: validator.getErrors(),
        message: 'Invalid ID parameters'
      } as ApiValidationResponse, { status: 400 })
    }

    // Fetch break period with shift validation
    const breakPeriod = await prisma.breakPeriod.findFirst({
      where: { 
        id: periodId,
        shiftId: shiftId
      }
    })

    if (!breakPeriod) {
      return NextResponse.json(
        { error: 'Break period not found' },
        { status: 404 }
      )
    }

    // Transform to response format
    const responseBreakPeriod: BreakPeriodResponse = {
      id: breakPeriod.id,
      shiftId: breakPeriod.shiftId,
      startTime: breakPeriod.startTime.toISOString(),
      endTime: breakPeriod.endTime.toISOString(),
      createdAt: breakPeriod.createdAt.toISOString(),
      updatedAt: breakPeriod.updatedAt.toISOString()
    }

    return NextResponse.json({ data: responseBreakPeriod })

  } catch (error) {
    console.error('Error fetching break period:', error)
    return NextResponse.json(
      { error: 'Failed to fetch break period' },
      { status: 500 }
    )
  }
}

// PUT /api/shifts/[id]/break-periods/[periodId] - Update specific break period
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: shiftId, periodId } = params
    const body: UpdateBreakPeriodRequest = await request.json()

    // Validate IDs
    const validator = ValidationResult.create()
    validateCuid(shiftId, 'shiftId', validator)
    validateCuid(periodId, 'periodId', validator)

    if (!validator.isValid()) {
      return NextResponse.json({
        errors: validator.getErrors(),
        message: 'Invalid ID parameters'
      } as ApiValidationResponse, { status: 400 })
    }

    // Check if break period exists and get current data
    const existingBreakPeriod = await prisma.breakPeriod.findFirst({
      where: { 
        id: periodId,
        shiftId: shiftId
      },
      include: {
        shift: true
      }
    })

    if (!existingBreakPeriod) {
      return NextResponse.json(
        { error: 'Break period not found' },
        { status: 404 }
      )
    }

    // Validate request body fields that are provided
    if (body.startTime !== undefined) {
      validateString(body.startTime, 'startTime', validator)
    }
    
    if (body.endTime !== undefined) {
      validateString(body.endTime, 'endTime', validator)
    }

    // Validate date range if both dates are provided or being updated
    const startTime = body.startTime || existingBreakPeriod.startTime.toISOString()
    const endTime = body.endTime || existingBreakPeriod.endTime.toISOString()
    
    if (body.startTime || body.endTime) {
      validateDateRange(startTime, endTime, validator, { maxDurationHours: 4 })
    }

    if (!validator.isValid()) {
      return NextResponse.json({
        errors: validator.getErrors(),
        message: 'Invalid break period data'
      } as ApiValidationResponse, { status: 400 })
    }

    const newBreakStart = new Date(startTime)
    const newBreakEnd = new Date(endTime)

    // Validate break period is within shift bounds
    if (newBreakStart < existingBreakPeriod.shift.startTime || 
        newBreakEnd > existingBreakPeriod.shift.endTime) {
      return NextResponse.json({
        errors: [{ 
          field: 'timing', 
          message: 'Break period must be within shift duration' 
        }],
        message: 'Invalid break timing'
      } as ApiValidationResponse, { status: 400 })
    }

    // Check for overlapping break periods (excluding current one)
    const overlappingBreaks = await prisma.breakPeriod.findMany({
      where: {
        shiftId,
        id: { not: periodId }, // Exclude current break period
        OR: [
          {
            AND: [
              { startTime: { lte: newBreakStart } },
              { endTime: { gt: newBreakStart } }
            ]
          },
          {
            AND: [
              { startTime: { lt: newBreakEnd } },
              { endTime: { gte: newBreakEnd } }
            ]
          },
          {
            AND: [
              { startTime: { gte: newBreakStart } },
              { endTime: { lte: newBreakEnd } }
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

    // Build update data
    const updateData: any = {}
    if (body.startTime !== undefined) updateData.startTime = new Date(body.startTime)
    if (body.endTime !== undefined) updateData.endTime = new Date(body.endTime)

    // Update the break period
    const updatedBreakPeriod = await prisma.breakPeriod.update({
      where: { id: periodId },
      data: updateData
    })

    // Recalculate shift pay with updated break periods
    await recalculateShiftPay(shiftId)

    // Transform to response format
    const responseBreakPeriod: BreakPeriodResponse = {
      id: updatedBreakPeriod.id,
      shiftId: updatedBreakPeriod.shiftId,
      startTime: updatedBreakPeriod.startTime.toISOString(),
      endTime: updatedBreakPeriod.endTime.toISOString(),
      createdAt: updatedBreakPeriod.createdAt.toISOString(),
      updatedAt: updatedBreakPeriod.updatedAt.toISOString()
    }

    return NextResponse.json({
      data: responseBreakPeriod,
      message: 'Break period updated successfully'
    })

  } catch (error) {
    console.error('Error updating break period:', error)
    return NextResponse.json(
      { error: 'Failed to update break period' },
      { status: 500 }
    )
  }
}

// DELETE /api/shifts/[id]/break-periods/[periodId] - Delete specific break period
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: shiftId, periodId } = params

    // Validate IDs
    const validator = ValidationResult.create()
    validateCuid(shiftId, 'shiftId', validator)
    validateCuid(periodId, 'periodId', validator)

    if (!validator.isValid()) {
      return NextResponse.json({
        errors: validator.getErrors(),
        message: 'Invalid ID parameters'
      } as ApiValidationResponse, { status: 400 })
    }

    // Check if break period exists
    const existingBreakPeriod = await prisma.breakPeriod.findFirst({
      where: { 
        id: periodId,
        shiftId: shiftId
      }
    })

    if (!existingBreakPeriod) {
      return NextResponse.json(
        { error: 'Break period not found' },
        { status: 404 }
      )
    }

    // Delete the break period
    await prisma.breakPeriod.delete({
      where: { id: periodId }
    })

    // Recalculate shift pay with updated break periods
    await recalculateShiftPay(shiftId)

    return NextResponse.json({
      message: 'Break period deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting break period:', error)
    return NextResponse.json(
      { error: 'Failed to delete break period' },
      { status: 500 }
    )
  }
}