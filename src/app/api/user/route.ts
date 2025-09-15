import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ValidationResult, validateString } from '@/lib/validation'
import { validateTimezone } from '@/lib/pay-guide-validation'

// GET /api/user - Get the single app user
export async function GET() {
  try {
    const user = await prisma.user.findFirst()
    if (!user) {
      return NextResponse.json({ error: 'No user found. Please seed the database first.' }, { status: 400 })
    }
    return NextResponse.json({ data: user })
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 })
  }
}

// PUT /api/user - Update the single app user
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    const validator = ValidationResult.create()

    if (body.name !== undefined) {
      validateString(body.name, 'name', validator, { minLength: 2, maxLength: 200 })
    }
    if (body.email !== undefined) {
      // Basic email shape validation
      validateString(body.email, 'email', validator, { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ })
    }
    if (body.timezone !== undefined) {
      validateTimezone(body.timezone, 'timezone', validator)
    }
    if (body.payPeriodType !== undefined) {
      const ok = ['WEEKLY', 'FORTNIGHTLY', 'MONTHLY'].includes(body.payPeriodType)
      if (!ok) validator.addError('payPeriodType', 'Must be WEEKLY, FORTNIGHTLY, or MONTHLY')
    }

    if (!validator.isValid()) {
      return NextResponse.json({ message: 'Invalid user data', errors: validator.getErrors() }, { status: 400 })
    }

    const user = await prisma.user.findFirst()
    if (!user) {
      return NextResponse.json({ error: 'No user found. Please seed the database first.' }, { status: 400 })
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: body.name ?? user.name,
        email: body.email ?? user.email,
        timezone: body.timezone ?? user.timezone,
        payPeriodType: body.payPeriodType ?? user.payPeriodType,
      },
    })

    return NextResponse.json({ data: updated, message: 'User updated successfully' })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}

