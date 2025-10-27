import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { Decimal } from 'decimal.js'
import { PayPeriodSyncService } from '@/lib/pay-period-sync-service'
import { PayPeriodLockedError, requirePayPeriodEditable } from '@/lib/pay-period-guards'

// GET /api/pay-periods/[id]/extras - list extras for a pay period
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: payPeriodId } = await params
    const payPeriod = await prisma.payPeriod.findUnique({ where: { id: payPeriodId } })
    if (!payPeriod) return NextResponse.json({ error: 'Pay period not found' }, { status: 404 })

    const extras = await prisma.payPeriodExtra.findMany({ where: { payPeriodId }, orderBy: { createdAt: 'asc' } })
    return NextResponse.json({ data: extras.map(e => ({
      id: e.id,
      type: e.type,
      description: e.description || undefined,
      amount: e.amount.toString(),
      taxable: e.taxable,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    })) })
  } catch (err) {
    console.error('Error fetching extras:', err)
    return NextResponse.json({ error: 'Failed to fetch extras' }, { status: 500 })
  }
}

// POST /api/pay-periods/[id]/extras - create an extra (taxable by default)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: payPeriodId } = await params
    const body = await request.json()
    const type = (body?.type || '').toString().trim()
    const amountStr = (body?.amount || '').toString()
    const description = body?.description ? String(body.description) : undefined
    const taxable = body?.taxable !== undefined ? !!body.taxable : true

    if (!type) return NextResponse.json({ error: 'type is required' }, { status: 400 })
    let amount: Decimal
    try { amount = new Decimal(amountStr) } catch { return NextResponse.json({ error: 'amount must be a decimal' }, { status: 400 }) }

    const period = await prisma.payPeriod.findUnique({ where: { id: payPeriodId } })
    if (!period) return NextResponse.json({ error: 'Pay period not found' }, { status: 404 })

    try {
      await requirePayPeriodEditable(payPeriodId)
    } catch (error) {
      if (error instanceof PayPeriodLockedError) {
        return NextResponse.json(
          {
            errors: [{ field: 'payPeriodId', message: 'Reopen the pay period before modifying extras.' }],
            message: 'Pay period locked',
          },
          { status: 423 }
        )
      }
      throw error
    }

    const extra = await prisma.payPeriodExtra.create({
      data: { payPeriodId, type, description: description || null, amount, taxable },
    })

    await PayPeriodSyncService.onExtrasChanged(payPeriodId)

    return NextResponse.json({ data: {
      id: extra.id,
      type: extra.type,
      description: extra.description || undefined,
      amount: extra.amount.toString(),
      taxable: extra.taxable,
      createdAt: extra.createdAt,
      updatedAt: extra.updatedAt,
    }, message: 'Extra added' }, { status: 201 })
  } catch (err) {
    console.error('Error creating extra:', err)
    return NextResponse.json({ error: 'Failed to create extra' }, { status: 500 })
  }
}
