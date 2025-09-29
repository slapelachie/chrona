import { NextRequest, NextResponse } from 'next/server'
import { Decimal } from 'decimal.js'
import { prisma } from '@/lib/db'
import { ValidationResult, validateString, validateDecimal } from '@/lib/validation'
import {
  PayPeriodExtraTemplateResponse,
  UpdatePayPeriodExtraTemplateRequest,
} from '@/types'

function toResponse(template: any): PayPeriodExtraTemplateResponse {
  return {
    id: template.id,
    userId: template.userId,
    label: template.label,
    description: template.description ?? undefined,
    amount: template.amount.toString(),
    taxable: template.taxable,
    active: template.active,
    sortOrder: template.sortOrder,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  }
}

async function getCurrentUser() {
  return prisma.user.findFirst()
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = (await request.json()) as UpdatePayPeriodExtraTemplateRequest

    const validator = ValidationResult.create()

    if (body.label !== undefined) {
      validateString(body.label, 'label', validator, { minLength: 1, maxLength: 80 })
    }
    if (body.description !== undefined && body.description !== null) {
      validateString(body.description, 'description', validator, { maxLength: 160 })
    }
    if (body.amount !== undefined) {
      validateString(body.amount, 'amount', validator)
      validateDecimal(body.amount, 'amount', validator)
    }

    if (!validator.isValid()) {
      return NextResponse.json({
        errors: validator.getErrors(),
        message: 'Invalid default extra',
      }, { status: 400 })
    }

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No user configured' }, { status: 400 })
    }

    const existing = await prisma.payPeriodExtraTemplate.findUnique({ where: { id } })
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: 'Default extra not found' }, { status: 404 })
    }

    const data: any = {}
    if (body.label !== undefined) data.label = body.label.trim()
    if (body.description !== undefined) data.description = body.description?.trim() || null
    if (body.amount !== undefined) data.amount = new Decimal(body.amount)
    if (body.taxable !== undefined) data.taxable = !!body.taxable
    if (body.active !== undefined) data.active = !!body.active
    if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder)

    const template = await prisma.payPeriodExtraTemplate.update({ where: { id }, data })

    return NextResponse.json({ data: toResponse(template), message: 'Default extra updated' })
  } catch (error) {
    console.error('Error updating default extra:', error)
    return NextResponse.json({ error: 'Failed to update default extra' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No user configured' }, { status: 400 })
    }

    const existing = await prisma.payPeriodExtraTemplate.findUnique({ where: { id } })
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: 'Default extra not found' }, { status: 404 })
    }

    await prisma.payPeriodExtraTemplate.delete({ where: { id } })

    return NextResponse.json({ message: 'Default extra deleted' })
  } catch (error) {
    console.error('Error deleting default extra:', error)
    return NextResponse.json({ error: 'Failed to delete default extra' }, { status: 500 })
  }
}
