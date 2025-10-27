import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { Decimal } from 'decimal.js'
import { PayPeriodSyncService } from '@/lib/pay-period-sync-service'
import { PayPeriodLockedError, requirePayPeriodEditable } from '@/lib/pay-period-guards'
import { ApiValidationResponse } from '@/types'

// PUT /api/pay-periods/[id]/extras/[extraId] - update an extra
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; extraId: string }> }
) {
  try {
    const { id: payPeriodId, extraId } = await params
    const body = await request.json()

    const data: any = {}
    if (body.type !== undefined) data.type = String(body.type)
    if (body.description !== undefined) data.description = body.description ? String(body.description) : null
    if (body.amount !== undefined) {
      try { data.amount = new Decimal(String(body.amount)) } catch { return NextResponse.json({ error: 'amount must be a decimal' }, { status: 400 }) }
    }
    if (body.taxable !== undefined) data.taxable = !!body.taxable

    const existing = await prisma.payPeriodExtra.findUnique({ where: { id: extraId } })
    if (!existing || existing.payPeriodId !== payPeriodId) return NextResponse.json({ error: 'Extra not found' }, { status: 404 })

    try {
      await requirePayPeriodEditable(existing.payPeriodId)
    } catch (error) {
      if (error instanceof PayPeriodLockedError) {
        return NextResponse.json(
          {
            errors: [{ field: 'payPeriodId', message: 'Reopen the pay period before modifying extras.' }],
            message: 'Pay period locked',
          } as ApiValidationResponse,
          { status: 423 }
        )
      }
      throw error
    }

    const updated = await prisma.payPeriodExtra.update({ where: { id: extraId }, data })
    await PayPeriodSyncService.onExtrasChanged(payPeriodId)

    return NextResponse.json({ data: {
      id: updated.id,
      type: updated.type,
      description: updated.description || undefined,
      amount: updated.amount.toString(),
      taxable: updated.taxable,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    }, message: 'Extra updated' })
  } catch (err) {
    console.error('Error updating extra:', err)
    return NextResponse.json({ error: 'Failed to update extra' }, { status: 500 })
  }
}

// DELETE /api/pay-periods/[id]/extras/[extraId] - delete an extra
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; extraId: string }> }
) {
  try {
    const { id: payPeriodId, extraId } = await params
    const existing = await prisma.payPeriodExtra.findUnique({ where: { id: extraId } })
    if (!existing || existing.payPeriodId !== payPeriodId) return NextResponse.json({ error: 'Extra not found' }, { status: 404 })

    try {
      await requirePayPeriodEditable(existing.payPeriodId)
    } catch (error) {
      if (error instanceof PayPeriodLockedError) {
        return NextResponse.json(
          {
            errors: [{ field: 'payPeriodId', message: 'Reopen the pay period before modifying extras.' }],
            message: 'Pay period locked',
          } as ApiValidationResponse,
          { status: 423 }
        )
      }
      throw error
    }

    await prisma.payPeriodExtra.delete({ where: { id: extraId } })
    await PayPeriodSyncService.onExtrasChanged(payPeriodId)

    return NextResponse.json({ message: 'Extra deleted' })
  } catch (err) {
    console.error('Error deleting extra:', err)
    return NextResponse.json({ error: 'Failed to delete extra' }, { status: 500 })
  }
}
