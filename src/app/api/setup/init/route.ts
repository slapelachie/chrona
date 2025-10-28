import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { isAppInitialized, performInitialSetup } from '@/lib/initialization'

type ValidationResult = {
  valid: boolean
  errors: string[]
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validatePayload(body: any): ValidationResult {
  const errors: string[] = []

  if (!body || typeof body !== 'object') {
    errors.push('Payload must be an object')
    return { valid: false, errors }
  }

  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    errors.push('Name is required')
  }

  if (!body.email || typeof body.email !== 'string' || !emailRegex.test(body.email.trim().toLowerCase())) {
    errors.push('A valid email is required')
  }

  if (body.timezone && typeof body.timezone !== 'string') {
    errors.push('Timezone must be a string when provided')
  }

  if (body.payPeriodType && !['WEEKLY', 'FORTNIGHTLY', 'MONTHLY'].includes(body.payPeriodType)) {
    errors.push('Pay period type must be WEEKLY, FORTNIGHTLY, or MONTHLY')
  }

  return { valid: errors.length === 0, errors }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))

     const validation = validatePayload(body)
    if (!validation.valid) {
      return NextResponse.json({
        error: 'Invalid setup data',
        details: validation.errors,
      }, { status: 400 })
    }

    // Short-circuit if already initialized
    if (await isAppInitialized()) {
      return NextResponse.json({ data: { initialized: true }, message: 'Already initialized' })
    }

    const { user, created } = await performInitialSetup({
      name: body?.name,
      email: body?.email,
      timezone: body?.timezone,
      payPeriodType: body?.payPeriodType,
    })

    return NextResponse.json({
      data: {
        initialized: true,
        user: { id: user.id, name: user.name, email: user.email, payPeriodType: user.payPeriodType, timezone: user.timezone },
        created,
      },
      message: 'Initialization complete',
    })
  } catch (e) {
    console.error('POST /api/setup/init failed:', e)
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2002') {
        return NextResponse.json({ error: 'A user with that email already exists', code: 'user_exists' }, { status: 409 })
      }
    }
    return NextResponse.json({ error: 'Initialization failed' }, { status: 500 })
  }
}
