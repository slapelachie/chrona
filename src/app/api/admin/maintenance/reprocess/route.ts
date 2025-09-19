import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { Decimal } from 'decimal.js'

// POST /api/admin/maintenance/reprocess
// Re-sync all pay periods (totals + taxes) and recompute YTD per tax year
export async function POST(_request: NextRequest) {
  try {
    const user = await prisma.user.findFirst({ select: { id: true, payPeriodType: true } })
    if (!user) {
      return NextResponse.json({ error: 'No user found. Please seed the database first.' }, { status: 400 })
    }

    const periods = await prisma.payPeriod.findMany({
      where: { userId: user.id },
      orderBy: { startDate: 'asc' },
      select: { id: true, startDate: true, endDate: true }
    })

    // Group pay periods by tax year (AU: July 1 – June 30)
    const byYear = new Map<string, { id: string; startDate: Date; endDate: Date }[]>()
    for (const p of periods) {
      const ty = getTaxYearFromDate(p.startDate)
      if (!byYear.has(ty)) byYear.set(ty, [])
      byYear.get(ty)!.push(p)
    }

    const summary: Array<{ taxYear: string; processed: number }> = []

    // Iterate per tax year to keep YTD consistent
    for (const [taxYear, list] of byYear) {
      // Zero out YTD before reprocessing this tax year
      await prisma.yearToDateTax.upsert({
        where: { userId_taxYear: { userId: user.id, taxYear } },
        update: {
          grossIncome: new Decimal(0),
          payGWithholding: new Decimal(0),
          stslAmount: new Decimal(0),
          totalWithholdings: new Decimal(0),
          lastUpdated: new Date(),
        },
        create: {
          userId: user.id,
          taxYear,
          grossIncome: new Decimal(0),
          payGWithholding: new Decimal(0),
          stslAmount: new Decimal(0),
          totalWithholdings: new Decimal(0),
          lastUpdated: new Date(),
        }
      })

      // Recompute each pay period: sync totals, then taxes
      const { PayPeriodSyncService } = await import('@/lib/pay-period-sync-service')
      const { PayPeriodTaxService } = await import('@/lib/pay-period-tax-service')

      for (const p of list) {
        await PayPeriodSyncService.syncPayPeriod(p.id)
        await PayPeriodTaxService.calculatePayPeriodTax(p.id)
      }

      // Finalize YTD from authoritative period sums (processing/paid/verified)
      const yearStart = getTaxYearStartDate(taxYear)
      const yearEnd = getTaxYearEndDate(taxYear)
      const agg = await prisma.payPeriod.findMany({
        where: {
          userId: user.id,
          startDate: { gte: yearStart },
          endDate: { lte: yearEnd },
          status: { in: ['processing', 'paid', 'verified'] }
        },
        select: {
          totalPay: true,
          paygWithholding: true,
          stslAmount: true,
          totalWithholdings: true,
        }
      })

      const gross = agg.reduce((s, r) => s.plus(r.totalPay || 0), new Decimal(0))
      const payg = agg.reduce((s, r) => s.plus(r.paygWithholding || 0), new Decimal(0))
      const stsl = agg.reduce((s, r) => s.plus(r.stslAmount || 0), new Decimal(0))
      const withhold = agg.reduce((s, r) => s.plus(r.totalWithholdings || 0), new Decimal(0))

      await prisma.yearToDateTax.update({
        where: { userId_taxYear: { userId: user.id, taxYear } },
        data: {
          grossIncome: gross,
          payGWithholding: payg,
          stslAmount: stsl,
          totalWithholdings: withhold,
          lastUpdated: new Date(),
        }
      })

      summary.push({ taxYear, processed: list.length })
    }

    return NextResponse.json({
      data: {
        processedTaxYears: summary.length,
        details: summary,
        totalPayPeriods: periods.length,
      },
      message: 'Reprocessing completed'
    })
  } catch (error) {
    console.error('Reprocess failed:', error)
    return NextResponse.json({ error: 'Failed to reprocess all data' }, { status: 500 })
  }
}

function getTaxYearFromDate(date: Date): string {
  const year = date.getFullYear()
  return date.getMonth() >= 6 ? `${year}-${(year + 1) % 100}` : `${year - 1}-${year % 100}`
}

function getTaxYearStartDate(taxYear: string): Date {
  const startYear = parseInt(taxYear.split('-')[0])
  return new Date(startYear, 6, 1) // July 1
}

function getTaxYearEndDate(taxYear: string): Date {
  const startYear = parseInt(taxYear.split('-')[0])
  return new Date(startYear + 1, 5, 30) // June 30
}

