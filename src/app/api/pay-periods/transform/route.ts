import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { PayPeriodType } from '@/types'
import { calculatePayPeriod } from '@/lib/pay-period-utils'
import { PayPeriodSyncService } from '@/lib/pay-period-sync-service'

type Body = {
  newPayPeriodType: PayPeriodType
  cleanup?: boolean // remove empty pay periods after transform
}

export async function POST(request: NextRequest) {
  try {
    const body: Body = await request.json()
    const { newPayPeriodType, cleanup = true } = body || ({} as Body)

    const validTypes: ReadonlyArray<PayPeriodType> = ['WEEKLY','FORTNIGHTLY','MONTHLY']
    if (!validTypes.includes(newPayPeriodType)) {
      return NextResponse.json({ message: 'Invalid pay period type' }, { status: 400 })
    }

    // Single-user app: find the user
    const user = await prisma.user.findFirst()
    if (!user) {
      return NextResponse.json({ error: 'No user found. Please seed the database first.' }, { status: 400 })
    }

    // Short-circuit if no change
    if (user.payPeriodType === newPayPeriodType) {
      return NextResponse.json({ data: { updated: false, movedShifts: 0, affectedPayPeriods: 0 }, message: 'No change in pay period type' })
    }

    // Update user first so future operations use the new type
    await prisma.user.update({ where: { id: user.id }, data: { payPeriodType: newPayPeriodType } })

    // Fetch all shifts for user
    const shifts = await prisma.shift.findMany({
      where: { userId: user.id },
      select: { id: true, startTime: true, payPeriodId: true },
      orderBy: { startTime: 'asc' }
    })

    const touched = new Set<string>()
    let moved = 0

    for (const s of shifts) {
      const { startDate } = calculatePayPeriod(s.startTime, newPayPeriodType)
      // Upsert target pay period by composite (userId, startDate)
      const target = await prisma.payPeriod.upsert({
        where: { userId_startDate: { userId: user.id, startDate } },
        update: {},
        create: {
          userId: user.id,
          startDate,
          endDate: calculatePayPeriod(s.startTime, newPayPeriodType).endDate,
          status: 'open',
        }
      })
      if (s.payPeriodId !== target.id) {
        await prisma.shift.update({ where: { id: s.id }, data: { payPeriodId: target.id } })
        if (s.payPeriodId) touched.add(s.payPeriodId)
        touched.add(target.id)
        moved++
      }
    }

    // Optionally clean up empty pay periods
    let removed = 0
    if (cleanup) {
      const empties = await prisma.payPeriod.findMany({
        where: { userId: user.id },
        select: { id: true },
      })
      for (const pp of empties) {
        const count = await prisma.shift.count({ where: { payPeriodId: pp.id } })
        if (count === 0) {
          await prisma.payPeriod.delete({ where: { id: pp.id } })
          removed++
        }
      }
    }

    // Sync affected pay periods for accurate totals and taxes
    if (touched.size > 0) {
      await PayPeriodSyncService.syncMultiplePayPeriods(Array.from(touched))
    }

    return NextResponse.json({
      data: {
        updated: true,
        movedShifts: moved,
        affectedPayPeriods: touched.size,
        removedEmptyPayPeriods: removed,
        newPayPeriodType,
      },
      message: 'Pay periods transformed successfully'
    })
  } catch (error) {
    console.error('Error transforming pay periods:', error)
    return NextResponse.json({ error: 'Failed to transform pay periods' }, { status: 500 })
  }
}
