import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  PayPeriodResponse,
  ApiValidationResponse,
  PayPeriodStatus,
} from '@/types'
import { PayPeriodTaxService } from '@/lib/pay-period-tax-service'

// POST /api/pay-periods/[id]/process - Process a pay period (calculate totals and taxes)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: payPeriodId } = await params

    // Check if pay period exists
    const payPeriod = await prisma.payPeriod.findUnique({
      where: { id: payPeriodId },
      include: { 
        shifts: true,
        user: true,
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

    // Check if pay period has any shifts
    if (payPeriod.shifts.length === 0) {
      return NextResponse.json(
        {
          errors: [{ field: 'shifts', message: 'Pay period has no shifts to process' }],
          message: 'No shifts found',
        } as ApiValidationResponse,
        { status: 400 }
      )
    }

    // Check if pay period is in correct status for processing
    if (payPeriod.status !== 'open') {
      return NextResponse.json(
        {
          errors: [{ field: 'status', message: 'Only open pay periods can be processed' }],
          message: 'Invalid pay period status',
        } as ApiValidationResponse,
        { status: 400 }
      )
    }

    // Check that all shifts in the pay period have calculated pay
    const shiftsWithoutPay = payPeriod.shifts.filter(shift => !shift.totalPay)
    if (shiftsWithoutPay.length > 0) {
      return NextResponse.json(
        {
          errors: [{ 
            field: 'shifts', 
            message: `${shiftsWithoutPay.length} shift(s) do not have calculated pay. Please calculate shift pay before processing the pay period.` 
          }],
          message: 'Shifts missing pay calculations',
        } as ApiValidationResponse,
        { status: 400 }
      )
    }

    // Process the pay period (calculates totals and taxes)
    const processedPayPeriod = await PayPeriodTaxService.processPayPeriod(payPeriodId)

    // Fetch the updated pay period with all calculated fields
    const updatedPayPeriod = await prisma.payPeriod.findUnique({
      where: { id: payPeriodId },
      include: {
        shifts: {
          orderBy: { startTime: 'asc' }
        }
      }
    })

    if (!updatedPayPeriod) {
      throw new Error('Failed to fetch updated pay period after processing')
    }

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
      shifts: updatedPayPeriod.shifts.map(shift => ({
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
    }

    return NextResponse.json(
      { data: response, message: 'Pay period processed successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error processing pay period:', error)

    // Handle specific error messages from the service
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json(
          {
            errors: [{ field: 'payPeriodId', message: error.message }],
            message: 'Pay period not found',
          } as ApiValidationResponse,
          { status: 404 }
        )
      }

      if (error.message.includes('no shifts') || error.message.includes('no calculated total pay')) {
        return NextResponse.json(
          {
            errors: [{ field: 'processing', message: error.message }],
            message: 'Cannot process pay period',
          } as ApiValidationResponse,
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to process pay period' },
      { status: 500 }
    )
  }
}

// GET /api/pay-periods/[id]/process - Get processing status and requirements
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: payPeriodId } = await params

    // Check if pay period exists and get current status
    const payPeriod = await prisma.payPeriod.findUnique({
      where: { id: payPeriodId },
      include: { 
        shifts: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
            totalPay: true,
            notes: true,
          }
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

    // Check processing readiness
    const canProcess = payPeriod.status === 'open'
    const hasShifts = payPeriod.shifts.length > 0
    const shiftsWithPay = payPeriod.shifts.filter(shift => shift.totalPay).length
    const shiftsWithoutPay = payPeriod.shifts.filter(shift => !shift.totalPay)

    const processingStatus = {
      canProcess: canProcess && hasShifts && shiftsWithoutPay.length === 0,
      currentStatus: payPeriod.status,
      requirements: {
        hasShifts,
        totalShifts: payPeriod.shifts.length,
        shiftsWithPay,
        shiftsWithoutPay: shiftsWithoutPay.length,
        isOpen: payPeriod.status === 'open',
      },
      blockers: [] as string[],
    }

    // Identify blockers
    if (!hasShifts) {
      processingStatus.blockers.push('Pay period has no shifts')
    }

    if (shiftsWithoutPay.length > 0) {
      processingStatus.blockers.push(`${shiftsWithoutPay.length} shift(s) do not have calculated pay`)
    }

    if (payPeriod.status !== 'open') {
      processingStatus.blockers.push(`Pay period status is '${payPeriod.status}' (must be 'open')`)
    }

    return NextResponse.json({ 
      data: processingStatus,
      message: processingStatus.canProcess 
        ? 'Pay period is ready for processing' 
        : 'Pay period cannot be processed yet'
    })
  } catch (error) {
    console.error('Error checking pay period processing status:', error)
    return NextResponse.json(
      { error: 'Failed to check pay period processing status' },
      { status: 500 }
    )
  }
}