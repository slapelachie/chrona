import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { UpdateShiftRequest, ShiftResponse, ApiValidationResponse, BreakPeriodResponse, PayPeriodStatus } from '@/types'
import { 
  ValidationResult, 
  validateString, 
  validateNumber, 
  validateDateRange,
  validateCuid
} from '@/lib/validation'
import { 
  calculateAndUpdateShift, 
  fetchShiftBreakPeriods,
  updateShiftWithCalculation 
} from '@/lib/shift-calculation'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

// GET /api/shifts/[id] - Get specific shift
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    // Validate shift ID
    const validator = ValidationResult.create()
    validateCuid(id, 'id', validator)

    if (!validator.isValid()) {
      return NextResponse.json({
        errors: validator.getErrors(),
        message: 'Invalid shift ID'
      } as ApiValidationResponse, { status: 400 })
    }

    // Fetch shift with relations
    const shift = await prisma.shift.findUnique({
      where: { id },
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

    if (!shift) {
      return NextResponse.json(
        { error: 'Shift not found' },
        { status: 404 }
      )
    }

    // Transform to response format
    const responseShift: ShiftResponse = {
      id: shift.id,
      userId: shift.userId,
      payGuideId: shift.payGuideId,
      startTime: shift.startTime,
      endTime: shift.endTime,
      breakMinutes: shift.breakMinutes,
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

    return NextResponse.json({ data: responseShift })

  } catch (error) {
    console.error('Error fetching shift:', error)
    return NextResponse.json(
      { error: 'Failed to fetch shift' },
      { status: 500 }
    )
  }
}

// PUT /api/shifts/[id] - Update specific shift
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body: UpdateShiftRequest = await request.json()

    // Validate shift ID
    const validator = ValidationResult.create()
    validateCuid(id, 'id', validator)

    if (!validator.isValid()) {
      return NextResponse.json({
        errors: validator.getErrors(),
        message: 'Invalid shift ID'
      } as ApiValidationResponse, { status: 400 })
    }

    // Check if shift exists
    const existingShift = await prisma.shift.findUnique({
      where: { id }
    })

    if (!existingShift) {
      return NextResponse.json(
        { error: 'Shift not found' },
        { status: 404 }
      )
    }

    // Validate request body fields that are provided
    if (body.payGuideId !== undefined) {
      validateString(body.payGuideId, 'payGuideId', validator)
    }
    
    if (body.startTime !== undefined) {
      validateString(body.startTime, 'startTime', validator)
    }
    
    if (body.endTime !== undefined) {
      validateString(body.endTime, 'endTime', validator)
    }
    
    if (body.breakMinutes !== undefined) {
      validateNumber(body.breakMinutes, 'breakMinutes', validator, { min: 0, max: 480, integer: true })
    }
    
    if (body.notes !== undefined && body.notes !== null) {
      validateString(body.notes, 'notes', validator, { maxLength: 500 })
    }

    // Validate date range if both dates are provided or being updated
    const startTime = body.startTime || existingShift.startTime.toISOString()
    const endTime = body.endTime || existingShift.endTime.toISOString()
    
    if (body.startTime || body.endTime) {
      validateDateRange(startTime, endTime, validator, { maxDurationHours: 24 })
    }

    if (!validator.isValid()) {
      return NextResponse.json({
        errors: validator.getErrors(),
        message: 'Invalid shift data'
      } as ApiValidationResponse, { status: 400 })
    }

    // Check if pay guide exists (if being updated)
    if (body.payGuideId) {
      const payGuide = await prisma.payGuide.findUnique({
        where: { id: body.payGuideId }
      })

      if (!payGuide) {
        return NextResponse.json({
          errors: [{ field: 'payGuideId', message: 'Pay guide not found' }],
          message: 'Invalid pay guide'
        } as ApiValidationResponse, { status: 400 })
      }
    }

    // Build update data
    const updateData: any = {}
    
    if (body.payGuideId !== undefined) updateData.payGuideId = body.payGuideId
    if (body.startTime !== undefined) updateData.startTime = new Date(body.startTime)
    if (body.endTime !== undefined) updateData.endTime = new Date(body.endTime)
    if (body.breakMinutes !== undefined) updateData.breakMinutes = body.breakMinutes
    if (body.notes !== undefined) updateData.notes = body.notes

    // Find appropriate pay period if dates are changing
    if (body.startTime) {
      const user = await prisma.user.findFirst()
      if (user) {
        const payPeriod = await prisma.payPeriod.findFirst({
          where: {
            userId: user.id,
            startDate: { lte: new Date(body.startTime) },
            endDate: { gte: new Date(body.startTime) }
          }
        })
        updateData.payPeriodId = payPeriod?.id || null
      }
    }

    // Clear calculated fields when shift details change
    if (body.startTime || body.endTime || body.breakMinutes || body.payGuideId) {
      updateData.totalHours = null
      updateData.basePay = null
      updateData.overtimePay = null
      updateData.penaltyPay = null
      updateData.totalPay = null
    }

    // Update the shift
    const updatedShift = await prisma.shift.update({
      where: { id },
      data: updateData,
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

    // Recalculate pay if shift details changed
    if (body.startTime || body.endTime || body.breakMinutes || body.payGuideId) {
      const breakPeriods = await fetchShiftBreakPeriods(updatedShift.id)
      const calculation = await calculateAndUpdateShift({
        payGuideId: updatedShift.payGuideId,
        startTime: updatedShift.startTime,
        endTime: updatedShift.endTime,
        breakPeriods
      })

      if (calculation) {
        // Update the shift with calculated pay values
        await updateShiftWithCalculation(updatedShift.id, calculation)
        
        // Update the updatedShift object with calculated values for response
        updatedShift.totalHours = calculation.totalHours
        updatedShift.basePay = calculation.basePay
        updatedShift.overtimePay = calculation.overtimePay
        updatedShift.penaltyPay = calculation.penaltyPay
        updatedShift.totalPay = calculation.totalPay
      }
    }

    // Transform to response format
    const responseShift: ShiftResponse = {
      id: updatedShift.id,
      userId: updatedShift.userId,
      payGuideId: updatedShift.payGuideId,
      startTime: updatedShift.startTime,
      endTime: updatedShift.endTime,
      breakMinutes: updatedShift.breakMinutes,
      totalHours: updatedShift.totalHours?.toString(),
      basePay: updatedShift.basePay?.toString(),
      overtimePay: updatedShift.overtimePay?.toString(),
      penaltyPay: updatedShift.penaltyPay?.toString(),
      totalPay: updatedShift.totalPay?.toString(),
      notes: updatedShift.notes,
      payPeriodId: updatedShift.payPeriodId,
      createdAt: updatedShift.createdAt,
      updatedAt: updatedShift.updatedAt,
      breakPeriods: updatedShift.breakPeriods.map(bp => ({
        id: bp.id,
        shiftId: bp.shiftId,
        startTime: bp.startTime.toISOString(),
        endTime: bp.endTime.toISOString(),
        createdAt: bp.createdAt.toISOString(),
        updatedAt: bp.updatedAt.toISOString()
      })),
      payGuide: {
        id: updatedShift.payGuide.id,
        name: updatedShift.payGuide.name,
        baseRate: updatedShift.payGuide.baseRate.toString(),
        minimumShiftHours: updatedShift.payGuide.minimumShiftHours ?? undefined,
        maximumShiftHours: updatedShift.payGuide.maximumShiftHours ?? undefined,
        description: updatedShift.payGuide.description ?? undefined,
        effectiveFrom: updatedShift.payGuide.effectiveFrom,
        effectiveTo: updatedShift.payGuide.effectiveTo ?? undefined,
        timezone: updatedShift.payGuide.timezone,
        isActive: updatedShift.payGuide.isActive,
        createdAt: updatedShift.payGuide.createdAt,
        updatedAt: updatedShift.payGuide.updatedAt
      },
      payPeriod: updatedShift.payPeriod ? {
        id: updatedShift.payPeriod.id,
        userId: updatedShift.payPeriod.userId,
        startDate: updatedShift.payPeriod.startDate,
        endDate: updatedShift.payPeriod.endDate,
        status: updatedShift.payPeriod.status as PayPeriodStatus,
        totalHours: updatedShift.payPeriod.totalHours?.toString(),
        totalPay: updatedShift.payPeriod.totalPay?.toString(),
        actualPay: updatedShift.payPeriod.actualPay?.toString(),
        verified: updatedShift.payPeriod.verified,
        createdAt: updatedShift.payPeriod.createdAt,
        updatedAt: updatedShift.payPeriod.updatedAt
      } : undefined
    }

    return NextResponse.json({
      data: responseShift,
      message: 'Shift updated successfully'
    })

  } catch (error) {
    console.error('Error updating shift:', error)
    return NextResponse.json(
      { error: 'Failed to update shift' },
      { status: 500 }
    )
  }
}

// DELETE /api/shifts/[id] - Delete specific shift
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    // Validate shift ID
    const validator = ValidationResult.create()
    validateCuid(id, 'id', validator)

    if (!validator.isValid()) {
      return NextResponse.json({
        errors: validator.getErrors(),
        message: 'Invalid shift ID'
      } as ApiValidationResponse, { status: 400 })
    }

    // Check if shift exists
    const existingShift = await prisma.shift.findUnique({
      where: { id }
    })

    if (!existingShift) {
      return NextResponse.json(
        { error: 'Shift not found' },
        { status: 404 }
      )
    }

    // Delete the shift
    await prisma.shift.delete({
      where: { id }
    })

    return NextResponse.json({
      message: 'Shift deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting shift:', error)
    return NextResponse.json(
      { error: 'Failed to delete shift' },
      { status: 500 }
    )
  }
}