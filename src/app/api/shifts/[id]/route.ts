import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  UpdateShiftRequest,
  ShiftResponse,
  ApiValidationResponse,
} from '@/types'
import {
  ValidationResult,
  validateString,
  validateDateRange,
  validateCuid,
} from '@/lib/validation'
import {
  calculateAndUpdateShift,
  fetchShiftBreakPeriods,
  updateShiftWithCalculation,
} from '@/lib/shift-calculation'
import { findOrCreatePayPeriod } from '@/lib/pay-period-utils'
import { PayPeriodSyncService } from '@/lib/pay-period-sync-service'
import { parseIncludeParams } from '@/lib/api-response-utils'
import { PayPeriodLockedError, requirePayPeriodEditable } from '@/lib/pay-period-guards'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

// GET /api/shifts/[id] - Get specific shift
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const includes = parseIncludeParams(searchParams.get('include') || undefined)

    // Validate shift ID
    const validator = ValidationResult.create()
    validateCuid(id, 'id', validator)

    if (!validator.isValid()) {
      return NextResponse.json(
        {
          errors: validator.getErrors(),
          message: 'Invalid shift ID',
        } as ApiValidationResponse,
        { status: 400 }
      )
    }

    // Fetch shift with relations
    const shift = await prisma.shift.findUnique({
      where: { id },
      include: {
        payGuide: true,
        payPeriod: true,
        breakPeriods: {
          orderBy: { startTime: 'asc' },
        },
        user: {
          select: {
            id: true,
            name: true,
            timezone: true,
          },
        },
      },
    })

    if (!shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
    }

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
      payPeriodId: shift.payPeriodId,
      createdAt: shift.createdAt,
      updatedAt: shift.updatedAt,
      breakPeriods: shift.breakPeriods.map((bp) => ({
        id: bp.id,
        shiftId: bp.shiftId,
        startTime: bp.startTime.toISOString(),
        endTime: bp.endTime.toISOString(),
        createdAt: bp.createdAt.toISOString(),
        updatedAt: bp.updatedAt.toISOString(),
      })),
    }

    // Include minimal payGuide summary for convenience
    if (shift.payGuide) {
      ;(responseShift as any).payGuide = {
        id: shift.payGuide.id,
        name: shift.payGuide.name,
        baseRate: shift.payGuide.baseRate.toString(),
        minimumShiftHours: shift.payGuide.minimumShiftHours ?? undefined,
        maximumShiftHours: shift.payGuide.maximumShiftHours ?? undefined,
        timezone: shift.payGuide.timezone,
      }
    }

    // Optionally attach calculation snapshot if requested
    if (includes.has('calculation')) {
      try {
        const [penaltySegments, overtimeSegments] = await Promise.all([
          prisma.shiftPenaltySegment.findMany({ where: { shiftId: id }, orderBy: { startTime: 'asc' } }),
          prisma.shiftOvertimeSegment.findMany({ where: { shiftId: id }, orderBy: { startTime: 'asc' } }),
        ])

        const sum = (arr: any[], key: 'hours' | 'pay') =>
          arr.reduce((acc, it) => acc + parseFloat(it[key].toString()), 0)

        const totalHours = shift.totalHours ? parseFloat(shift.totalHours.toString()) : 0
        const penaltyHours = sum(penaltySegments, 'hours')
        const overtimeHours = sum(overtimeSegments, 'hours')
        const baseHours = Math.max(0, totalHours - penaltyHours - overtimeHours)

        const calculation: any = {
          shift: {
            startTime: shift.startTime,
            endTime: shift.endTime,
            breakPeriods: shift.breakPeriods.map((bp) => ({
              id: bp.id,
              shiftId: bp.shiftId,
              startTime: bp.startTime,
              endTime: bp.endTime,
              createdAt: bp.createdAt,
              updatedAt: bp.updatedAt,
            })),
            totalHours: shift.totalHours ?? '0',
          },
          breakdown: {
            baseHours: baseHours.toFixed(2),
            basePay: shift.basePay ?? '0',
            overtimeHours: overtimeHours.toFixed(2),
            overtimePay: shift.overtimePay ?? '0',
            penaltyHours: penaltyHours.toFixed(2),
            penaltyPay: shift.penaltyPay ?? '0',
            totalPay: shift.totalPay ?? '0',
          },
          penalties: penaltySegments.map((p) => ({
            timeFrameId: p.timeFrameId ?? '',
            name: p.name,
            multiplier: p.multiplier,
            hours: p.hours,
            pay: p.pay,
            startTime: p.startTime,
            endTime: p.endTime,
          })),
          overtimes: overtimeSegments.map((o) => ({
            timeFrameId: o.timeFrameId ?? '',
            name: o.name,
            multiplier: o.multiplier,
            hours: o.hours,
            pay: o.pay,
            startTime: o.startTime,
            endTime: o.endTime,
          })),
          payGuide: shift.payGuide
            ? { name: shift.payGuide.name, baseRate: shift.payGuide.baseRate }
            : { name: 'Unknown', baseRate: 0 },
        }

        ;(responseShift as any).calculation = calculation
      } catch (e) {
        console.warn('Failed to attach calculation snapshot for shift', id, e)
      }
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
      return NextResponse.json(
        {
          errors: validator.getErrors(),
          message: 'Invalid shift ID',
        } as ApiValidationResponse,
        { status: 400 }
      )
    }

    // Check if shift exists and capture current pay period for sync
    const existingShift = await prisma.shift.findUnique({
      where: { id },
      select: {
        id: true,
        payPeriodId: true,
        startTime: true,
        endTime: true,
        payGuideId: true,
        payGuide: {
          select: { timezone: true }
        }
      },
    })

    if (!existingShift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
    }

    if (existingShift.payPeriodId) {
      try {
        await requirePayPeriodEditable(existingShift.payPeriodId)
      } catch (error) {
        if (error instanceof PayPeriodLockedError) {
          return NextResponse.json(
            {
              errors: [{ field: 'payPeriodId', message: 'Reopen the pay period before editing this shift.' }],
              message: 'Pay period locked',
            } as ApiValidationResponse,
            { status: 423 }
          )
        }
        throw error
      }
    }

    // Store the previous pay period ID for sync later
    const previousPayPeriodId = existingShift.payPeriodId

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
      return NextResponse.json(
        {
          errors: validator.getErrors(),
          message: 'Invalid shift data',
        } as ApiValidationResponse,
        { status: 400 }
      )
    }

    // Check if pay guide exists (if being updated)
    let newPayGuide = null
    if (body.payGuideId) {
      newPayGuide = await prisma.payGuide.findUnique({
        where: { id: body.payGuideId },
        select: { timezone: true }
      })

      if (!newPayGuide) {
        return NextResponse.json(
          {
            errors: [{ field: 'payGuideId', message: 'Pay guide not found' }],
            message: 'Invalid pay guide',
          } as ApiValidationResponse,
          { status: 400 }
        )
      }
    }

    // Build update data
    const updateData: any = {}

    if (body.payGuideId !== undefined) updateData.payGuideId = body.payGuideId
    if (body.startTime !== undefined)
      updateData.startTime = new Date(body.startTime)
    if (body.endTime !== undefined) updateData.endTime = new Date(body.endTime)
    if (body.notes !== undefined) updateData.notes = body.notes

    // Find appropriate pay period if dates are changing
    if (body.startTime) {
      const user = await prisma.user.findFirst()

      if (user) {
        const startTime = new Date(body.startTime)
        // Use timezone from new pay guide if provided, otherwise use existing shift's pay guide timezone
        const payGuideTimezone = newPayGuide ? newPayGuide.timezone : existingShift.payGuide.timezone
        const payPeriod = await findOrCreatePayPeriod(user.id, startTime, payGuideTimezone)
        try {
          await requirePayPeriodEditable(payPeriod.id)
        } catch (error) {
          if (error instanceof PayPeriodLockedError) {
            return NextResponse.json(
              {
                errors: [{ field: 'payPeriodId', message: 'Target pay period is verified and locked.' }],
                message: 'Pay period locked',
              } as ApiValidationResponse,
              { status: 423 }
            )
          }
          throw error
        }
        updateData.payPeriodId = payPeriod.id
      }
    }

    // Clear calculated fields when shift details change
    if (body.startTime || body.endTime || body.payGuideId) {
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
          orderBy: { startTime: 'asc' },
        },
        user: {
          select: {
            id: true,
            name: true,
            timezone: true,
          },
        },
      },
    })

    // Recalculate pay if shift details changed
    if (body.startTime || body.endTime || body.payGuideId) {
      const breakPeriods = await fetchShiftBreakPeriods(updatedShift.id)
      const calculation = await calculateAndUpdateShift({
        payGuideId: updatedShift.payGuideId,
        startTime: updatedShift.startTime,
        endTime: updatedShift.endTime,
        breakPeriods,
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

    // Trigger automatic pay period sync after successful shift update
    await PayPeriodSyncService.onShiftUpdated(updatedShift.id, previousPayPeriodId ?? undefined)

    // Transform to response format
    const responseShift: ShiftResponse = {
      id: updatedShift.id,
      userId: updatedShift.userId,
      payGuideId: updatedShift.payGuideId,
      startTime: updatedShift.startTime,
      endTime: updatedShift.endTime,
      totalHours: updatedShift.totalHours?.toString(),
      basePay: updatedShift.basePay?.toString(),
      overtimePay: updatedShift.overtimePay?.toString(),
      penaltyPay: updatedShift.penaltyPay?.toString(),
      totalPay: updatedShift.totalPay?.toString(),
      notes: updatedShift.notes ?? undefined,
      payPeriodId: updatedShift.payPeriodId ?? undefined,
      createdAt: updatedShift.createdAt,
      updatedAt: updatedShift.updatedAt,
      breakPeriods: updatedShift.breakPeriods.map((bp) => ({
        id: bp.id,
        shiftId: bp.shiftId,
        startTime: bp.startTime.toISOString(),
        endTime: bp.endTime.toISOString(),
        createdAt: bp.createdAt.toISOString(),
        updatedAt: bp.updatedAt.toISOString(),
      })),
    }

    return NextResponse.json({
      data: responseShift,
      message: 'Shift updated successfully',
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
      return NextResponse.json(
        {
          errors: validator.getErrors(),
          message: 'Invalid shift ID',
        } as ApiValidationResponse,
        { status: 400 }
      )
    }

    // Check if shift exists and capture pay period for sync
    const existingShift = await prisma.shift.findUnique({
      where: { id },
      select: { id: true, payPeriodId: true },
    })

    if (!existingShift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
    }

    if (existingShift.payPeriodId) {
      try {
        await requirePayPeriodEditable(existingShift.payPeriodId)
      } catch (error) {
        if (error instanceof PayPeriodLockedError) {
          return NextResponse.json(
            {
              errors: [{ field: 'payPeriodId', message: 'Reopen the pay period before deleting this shift.' }],
              message: 'Pay period locked',
            } as ApiValidationResponse,
            { status: 423 }
          )
        }
        throw error
      }
    }

    // Store the pay period ID for sync after deletion
    const payPeriodId = existingShift.payPeriodId

    // Delete the shift
    await prisma.shift.delete({
      where: { id },
    })

    // Trigger automatic pay period sync after successful shift deletion
    if (payPeriodId) {
      await PayPeriodSyncService.onShiftDeleted(payPeriodId)
    }

    return NextResponse.json({
      message: 'Shift deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting shift:', error)
    return NextResponse.json(
      { error: 'Failed to delete shift' },
      { status: 500 }
    )
  }
}
