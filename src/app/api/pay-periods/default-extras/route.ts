import { NextRequest, NextResponse } from 'next/server'
import { Decimal } from 'decimal.js'
import { prisma } from '@/lib/db'
import { ValidationResult, validateString, validateDecimal } from '@/lib/validation'
import {
  CreatePayPeriodExtraTemplateRequest,
  PayPeriodExtraTemplateResponse,
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

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ data: [] })
    }

    const templates = await prisma.payPeriodExtraTemplate.findMany({
      where: { userId: user.id },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })

    return NextResponse.json({ data: templates.map(toResponse) })
  } catch (error) {
    console.error('Error fetching default extras:', error)
    return NextResponse.json({ error: 'Failed to fetch default extras' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreatePayPeriodExtraTemplateRequest

    const validator = ValidationResult.create()
    validateString(body.label, 'label', validator, { minLength: 1, maxLength: 80 })
    validateString(body.amount, 'amount', validator)
    validateDecimal(body.amount, 'amount', validator)

    if (body.description) {
      validateString(body.description, 'description', validator, { maxLength: 160 })
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

    const amount = new Decimal(body.amount)
    const sortOrder = body.sortOrder ?? 0

    const template = await prisma.payPeriodExtraTemplate.create({
      data: {
        userId: user.id,
        label: body.label.trim(),
        description: body.description?.trim() || null,
        amount,
        taxable: body.taxable ?? true,
        active: body.active ?? true,
        sortOrder,
      },
    })

    return NextResponse.json({
      data: toResponse(template),
      message: 'Default extra saved',
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating default extra:', error)
    return NextResponse.json({ error: 'Failed to create default extra' }, { status: 500 })
  }
}
