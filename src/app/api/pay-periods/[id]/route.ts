import { NextRequest, NextResponse } from 'next/server'
import { Decimal } from 'decimal.js'
import { prisma } from '@/lib/db'
import {
  UpdatePayPeriodRequest,
  PayPeriodResponse,
  ApiValidationResponse,
  PayPeriodStatus,
} from '@/types'
import {
  ValidationResult,
  validateString,
  validateDateRange,
  validateBoolean,
  validateDecimal,
} from '@/lib/validation'

// GET /api/pay-periods/[id] - Get specific pay period
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: payPeriodId } = await params
    const { searchParams } = new URL(request.url)
    const includeShifts = searchParams.get('include')?.includes('shifts')

    // Find the pay period
    const payPeriod = await prisma.payPeriod.findUnique({
      where: { id: payPeriodId },
      include: {
        ...(includeShifts && {
          shifts: {
            orderBy: { startTime: 'asc' }
          }
        })
      },
    })

    if (!payPeriod) {
      return NextResponse.json(
        {
          errors: [{ field: 'payPeriodId', message: 'Pay period not found' }],
          message: 'Invalid pay period',
        } as ApiValidationResponse,
        { status: 404 }
      )
    }

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

    if (includeShifts && (payPeriod as any).shifts) {
      response.shifts = (payPeriod as any).shifts.map((shift: any) => ({
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
      }))
    }

    return NextResponse.json({ data: response })
  } catch (error) {
    console.error('Error fetching pay period:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pay period' },
      { status: 500 }
    )
  }
}

// PUT /api/pay-periods/[id] - Update pay period
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: payPeriodId } = await params
    const body: UpdatePayPeriodRequest = await request.json()

    // Validate request body
    const validator = ValidationResult.create()

    if (body.startDate !== undefined) {
      validateString(body.startDate, 'startDate', validator)
    }

    if (body.endDate !== undefined) {
      validateString(body.endDate, 'endDate', validator)
    }

    if (body.status && !['open', 'processing', 'paid', 'verified'].includes(body.status)) {
      validator.addError('status', 'Invalid status value')
    }

    if (body.verified !== undefined) {
      validateBoolean(body.verified, 'verified', validator)
    }

    if (body.actualPay !== undefined && body.actualPay !== null) {
      validateDecimal(body.actualPay, 'actualPay', validator, {
        min: new Decimal(0)
      })
    }

    // Validate date range if both dates are provided
    if (body.startDate && body.endDate && validator.isValid()) {
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

    // Check if pay period exists
    const existingPayPeriod = await prisma.payPeriod.findUnique({
      where: { id: payPeriodId },
      include: {
        _count: {
          select: { shifts: true }
        }
      }
    })

    if (!existingPayPeriod) {
      return NextResponse.json(
        {
          errors: [{ field: 'payPeriodId', message: 'Pay period not found' }],
          message: 'Invalid pay period',
        } as ApiValidationResponse,
        { status: 404 }
      )
    }

    // Validate business rules for date changes
    if ((body.startDate || body.endDate) && (existingPayPeriod as any)._count.shifts > 0) {
      // Check if changing dates would conflict with existing shifts
      const newStartDate = body.startDate ? new Date(body.startDate) : existingPayPeriod.startDate
      const newEndDate = body.endDate ? new Date(body.endDate) : existingPayPeriod.endDate

      const shiftsOutsideRange = await prisma.shift.count({
        where: {
          payPeriodId: payPeriodId,
          OR: [
            { startTime: { lt: newStartDate } },
            { startTime: { gt: newEndDate } }
          ]
        }
      })

      if (shiftsOutsideRange > 0) {
        return NextResponse.json(
          {
            errors: [{
              field: 'dateRange',
              message: 'Cannot change dates - some shifts would fall outside the new period'
            }],
            message: 'Date change conflicts with existing shifts',
          } as ApiValidationResponse,
          { status: 400 }
        )
      }
    }

    // Check for overlapping periods if dates are changing
    if (body.startDate || body.endDate) {
      const newStartDate = body.startDate ? new Date(body.startDate) : existingPayPeriod.startDate
      const newEndDate = body.endDate ? new Date(body.endDate) : existingPayPeriod.endDate

      const overlappingPeriod = await prisma.payPeriod.findFirst({
        where: {
          userId: existingPayPeriod.userId,
          id: { not: payPeriodId }, // Exclude current period
          OR: [
            {
              AND: [
                { startDate: { lte: newStartDate } },
                { endDate: { gte: newStartDate } }
              ]
            },
            {
              AND: [
                { startDate: { lte: newEndDate } },
                { endDate: { gte: newEndDate } }
              ]
            },
            {
              AND: [
                { startDate: { gte: newStartDate } },
                { endDate: { lte: newEndDate } }
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
              message: 'Updated dates would overlap with existing pay period'
            }],
            message: 'Overlapping pay period',
          } as ApiValidationResponse,
          { status: 400 }
        )
      }
    }

    // Prepare update data
    const updateData: any = {}

    if (body.startDate !== undefined) {
      updateData.startDate = new Date(body.startDate)
    }

    if (body.endDate !== undefined) {
      updateData.endDate = new Date(body.endDate)
    }

    if (body.status !== undefined) {
      updateData.status = body.status
    }

    if (body.verified !== undefined) {
      updateData.verified = body.verified
    }

    if (body.actualPay !== undefined) {
      updateData.actualPay = body.actualPay ? new Decimal(body.actualPay) : null
    }

    // Update the pay period
    const updatedPayPeriod = await prisma.payPeriod.update({
      where: { id: payPeriodId },
      data: updateData,
    })

    // Transform to response format
    const response: PayPeriodResponse = {
      id: updatedPayPeriod.id,
      userId: updatedPayPeriod.userId,
      startDate: updatedPayPeriod.startDate,
      endDate: updatedPayPeriod.endDate,
      status: updatedPayPeriod.status as PayPeriodStatus,
      totalHours: updatedPayPeriod.totalHours?.toString(),
      totalPay: updatedPayPeriod.totalPay?.toString(),
      paygWithholding: updatedPayPeriod.paygWithholding?.toString(),
      medicareLevy: updatedPayPeriod.medicareLevy?.toString(),
      hecsHelpAmount: updatedPayPeriod.hecsHelpAmount?.toString(),
      totalWithholdings: updatedPayPeriod.totalWithholdings?.toString(),
      netPay: updatedPayPeriod.netPay?.toString(),
      actualPay: updatedPayPeriod.actualPay?.toString(),
      verified: updatedPayPeriod.verified,
      createdAt: updatedPayPeriod.createdAt,
      updatedAt: updatedPayPeriod.updatedAt,
    }

    return NextResponse.json(
      { data: response, message: 'Pay period updated successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error updating pay period:', error)
    return NextResponse.json(
      { error: 'Failed to update pay period' },
      { status: 500 }
    )
  }
}

// DELETE /api/pay-periods/[id] - Delete pay period with cascading delete to shifts
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: payPeriodId } = await params
    const { searchParams } = new URL(request.url)
    const force = searchParams.get('force') === 'true'

    // Check if pay period exists and get shift count
    const payPeriod = await prisma.payPeriod.findUnique({
      where: { id: payPeriodId },
      include: {
        _count: {
          select: { shifts: true }
        }
      }
    })

    if (!payPeriod) {
      return NextResponse.json(
        {
          errors: [{ field: 'payPeriodId', message: 'Pay period not found' }],
          message: 'Invalid pay period',
        } as ApiValidationResponse,
        { status: 404 }
      )
    }

    // Check if pay period can be safely deleted
    const shiftsCount = (payPeriod as any)._count.shifts
    const isProcessedOrPaid = ['processing', 'paid', 'verified'].includes(payPeriod.status)

    // Prevent deletion of processed/paid periods unless forced
    if (isProcessedOrPaid && !force) {
      return NextResponse.json(
        {
          errors: [{
            field: 'status',
            message: `Cannot delete ${payPeriod.status} pay period. Use force=true to override.`
          }],
          message: 'Pay period cannot be deleted',
          metadata: {
            shiftsCount,
            status: payPeriod.status,
            canForceDelete: true
          }
        } as ApiValidationResponse & { metadata: any },
        { status: 400 }
      )
    }

    // Warn about shifts if there are any
    if (shiftsCount > 0 && !force) {
      return NextResponse.json(
        {
          errors: [{
            field: 'shifts',
            message: `This will permanently delete ${shiftsCount} shift(s). Use force=true to confirm.`
          }],
          message: 'Confirm deletion',
          metadata: {
            shiftsCount,
            status: payPeriod.status,
            requiresForce: true
          }
        } as ApiValidationResponse & { metadata: any },
        { status: 400 }
      )
    }

    // Perform the deletion (cascading delete will handle shifts automatically)
    await prisma.payPeriod.delete({
      where: { id: payPeriodId }
    })

    return NextResponse.json(
      {
        message: `Pay period deleted successfully. ${shiftsCount} shift(s) were also deleted.`,
        metadata: {
          deletedShiftsCount: shiftsCount
        }
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error deleting pay period:', error)

    // Handle foreign key constraint errors
    if (error instanceof Error) {
      if (error.message.includes('foreign key constraint')) {
        return NextResponse.json(
          {
            errors: [{
              field: 'deletion',
              message: 'Cannot delete pay period - it is referenced by other records'
            }],
            message: 'Deletion blocked by constraints',
          } as ApiValidationResponse,
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to delete pay period' },
      { status: 500 }
    )
  }
}