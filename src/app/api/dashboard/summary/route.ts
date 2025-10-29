import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { calculatePayPeriod } from '@/lib/pay-period-utils'
import { Decimal } from 'decimal.js'

// GET /api/dashboard/summary - consolidated data for dashboard widgets
export async function GET() {
  try {
    // Get the default user (single-user app assumption)
    const user = await prisma.user.findFirst({
      select: { id: true, name: true, payPeriodType: true, timezone: true }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'No user found. Please seed the database first.' },
        { status: 400 }
      )
    }

    // Compute the current period range without creating a DB record
    const now = new Date()
    const timeZone = user.timezone || 'Australia/Sydney'
    const { startDate, endDate } = calculatePayPeriod(now, user.payPeriodType, timeZone)

    // Try to find an existing current pay period (do NOT create one if missing)
    const currentPayPeriod = await prisma.payPeriod.findUnique({
      where: { userId_startDate: { userId: user.id, startDate } },
      include: { shifts: { select: { id: true } }, extras: true }
    })

    const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime() + 1) / (24 * 60 * 60 * 1000)))
    const daysElapsed = Math.min(
      totalDays,
      Math.max(1, Math.ceil((now.getTime() - startDate.getTime() + 1) / (24 * 60 * 60 * 1000)))
    )

    // Tally hours/pay from existing period (or zeros if it doesn’t exist)
    const grossPay = currentPayPeriod?.totalPay ?? new Decimal(0)
    const paygWithholding = currentPayPeriod?.paygWithholding ?? new Decimal(0)
    const stslAmount = currentPayPeriod?.stslAmount ?? new Decimal(0)
    const totalWithholdings = currentPayPeriod?.totalWithholdings ?? new Decimal(0)
    const netPay = currentPayPeriod?.netPay ?? grossPay.minus(totalWithholdings)
    const actualPay = currentPayPeriod?.actualPay ?? null

    // (Removed time-based projection in favor of rostered projection below)

    // Shifts within current period window (for rostered projection)
    const periodShifts = await prisma.shift.findMany({
      where: { userId: user.id, startTime: { gte: startDate, lte: endDate } },
      orderBy: { startTime: 'asc' },
      select: { id: true, startTime: true, endTime: true, totalHours: true, totalPay: true, payGuideId: true }
    })
    // Extras already attached to current period (no roster concept, assume apply to full window)
    const periodExtras = await prisma.payPeriodExtra.findMany({
      where: { payPeriod: { userId: user.id, startDate } },
      select: { amount: true, taxable: true }
    })

    // Completed vs upcoming in current period
    const completed = periodShifts.filter(s => s.endTime && s.endTime <= now)


    const hoursSoFar = completed.reduce((sum, s) => sum.plus(s.totalHours || new Decimal(0)), new Decimal(0))
    const grossSoFar = completed.reduce((sum, s) => sum.plus(s.totalPay || new Decimal(0)), new Decimal(0))
      .plus((currentPayPeriod?.extras || []).reduce((sum, e) => e.taxable ? sum.plus(e.amount) : sum, new Decimal(0)))
    const grossRosteredTotal = periodShifts.reduce((sum, s) => sum.plus(s.totalPay || new Decimal(0)), new Decimal(0))
      .plus(periodExtras.reduce((sum, e) => e.taxable ? sum.plus(e.amount) : sum, new Decimal(0)))
    const hoursRosteredTotal = periodShifts.reduce((sum, s) => sum.plus(s.totalHours || new Decimal(0)), new Decimal(0))

    // Project net using preview calculator against rostered gross
    let projectedNet = new Decimal(0)
    try {
      const { PayPeriodTaxService } = await import('@/lib/pay-period-tax-service')
      const preview = await PayPeriodTaxService.previewTaxCalculation(user.id, grossRosteredTotal, user.payPeriodType)
      projectedNet = preview.breakdown.netPay
    } catch {
      projectedNet = grossRosteredTotal.minus(paygWithholding).minus(stslAmount)
    }

    // Upcoming shifts (next 5 overall)
    const upcomingShifts = await prisma.shift.findMany({
      where: { userId: user.id, startTime: { gte: now } },
      orderBy: { startTime: 'asc' },
      take: 5,
      include: { payGuide: { select: { name: true } } }
    })

    // Recent shifts (last 5 completed)
    const recentShifts = await prisma.shift.findMany({
      where: { userId: user.id, endTime: { lte: now } },
      orderBy: { endTime: 'desc' },
      take: 5,
      include: { payGuide: { select: { name: true } } }
    })

    const response = {
      asAt: now,
      user: { id: user.id, name: user.name, payPeriodType: user.payPeriodType },
      currentPeriod: {
        exists: !!currentPayPeriod,
        id: currentPayPeriod?.id ?? null,
        status: currentPayPeriod?.status ?? null,
        shiftsCount: periodShifts.length,
        startDate,
        endDate,
        totalDays,
        daysElapsed,
        hoursWorked: hoursSoFar.toString(),
        grossPay: grossSoFar.toString(),
        paygWithholding: paygWithholding.toString(),
        stslAmount: stslAmount.toString(),
        totalWithholdings: totalWithholdings.toString(),
        netPay: netPay.toString(),
        actualPay: actualPay ? actualPay.toString() : null,
        displayNetPay: (actualPay ?? netPay).toString(),
        projections: {
          grossPay: grossRosteredTotal.toString(),
          netPay: projectedNet.toString(),
          rosteredHours: hoursRosteredTotal.toString(),
        }
      },
      upcomingShifts: upcomingShifts.map((s) => ({
        id: s.id,
        startTime: s.startTime,
        endTime: s.endTime,
        totalHours: s.totalHours?.toString() ?? null,
        totalPay: s.totalPay?.toString() ?? null,
        payGuideName: (s as any).payGuide?.name ?? null,
      })),
      recentActivities: recentShifts.map((s) => ({
        id: s.id,
        type: 'shift_completed' as const,
        title: 'Shift Completed',
        description: `${(s as any).payGuide?.name ?? 'Shift'} (${s.totalHours?.toFixed?.(2) ?? '0'}h)`,
        timestamp: s.endTime,
        amount: s.totalPay?.toNumber?.() ?? null,
        status: 'success' as const,
      }))
    }

    return NextResponse.json({ data: response })
  } catch (error) {
    console.error('Error building dashboard summary:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard summary' },
      { status: 500 }
    )
  }
}
