import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ApiValidationResponse } from '@/types'
import { PayPeriodTaxService } from '@/lib/pay-period-tax-service'
import { transformPayPeriodToResponse } from '@/lib/api-response-utils'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: payPeriodId } = await params

    const payPeriod = await prisma.payPeriod.findUnique({
      where: { id: payPeriodId },
      include: {
        shifts: {
          orderBy: { startTime: 'asc' },
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

    if (payPeriod.status === 'verified') {
      return NextResponse.json(
        {
          errors: [{ field: 'status', message: 'Reopen the pay period before recalculating totals' }],
          message: 'Pay period locked',
        } as ApiValidationResponse,
        { status: 423 }
      )
    }

    const updated = await PayPeriodTaxService.recalculatePayPeriod(payPeriodId)

    return NextResponse.json({
      data: transformPayPeriodToResponse(updated),
      message: 'Pay period recalculated',
    })
  } catch (error) {
    console.error('Error recalculating pay period:', error)
    return NextResponse.json(
      { error: 'Failed to recalculate pay period' },
      { status: 500 }
    )
  }
}
