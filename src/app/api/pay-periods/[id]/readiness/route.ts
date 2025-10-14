import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ApiValidationResponse } from '@/types'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: payPeriodId } = await params

    const payPeriod = await prisma.payPeriod.findUnique({
      where: { id: payPeriodId },
      include: {
        shifts: {
          select: {
            id: true,
            totalPay: true,
            startTime: true,
            endTime: true,
          },
        },
        user: {
          select: {
            timezone: true,
          },
        },
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

    const now = new Date()
    const isFuture = payPeriod.endDate > now
    const shifts = payPeriod.shifts || []
    const totalShifts = shifts.length
    const shiftsWithPay = shifts.filter((shift) => !!shift.totalPay).length
    const shiftsWithoutPay = totalShifts - shiftsWithPay

    const readyForVerification =
      !isFuture &&
      totalShifts > 0 &&
      shiftsWithoutPay === 0 &&
      payPeriod.status === 'pending'

    const blockers: string[] = []
    if (isFuture) blockers.push('Pay period ends in the future')
    if (totalShifts === 0) blockers.push('No shifts recorded this period')
    if (shiftsWithoutPay > 0) blockers.push(`${shiftsWithoutPay} shift(s) missing pay calculations`)
    if (payPeriod.status !== 'pending') blockers.push('Pay period already verified')

    return NextResponse.json({
      data: {
        status: payPeriod.status,
        isFuture,
        readyForVerification,
        totalShifts,
        shiftsWithPay,
        shiftsWithoutPay,
        blockers,
        timezone: payPeriod.user?.timezone ?? null,
      },
      message: readyForVerification
        ? 'Pay period is ready for verification'
        : 'Pay period is not ready for verification',
    })
  } catch (error) {
    console.error('Error checking pay period readiness:', error)
    return NextResponse.json(
      { error: 'Failed to check pay period readiness' },
      { status: 500 }
    )
  }
}
