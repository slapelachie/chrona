import { NextRequest, NextResponse } from 'next/server'
import { isAppInitialized, performInitialSetup } from '@/lib/initialization'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))

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
    return NextResponse.json({ error: 'Initialization failed' }, { status: 500 })
  }
}

