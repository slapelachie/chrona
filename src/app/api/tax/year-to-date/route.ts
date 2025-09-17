import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { PayPeriodTaxService } from '@/lib/pay-period-tax-service'
import { Decimal } from 'decimal.js'

// GET /api/tax/year-to-date - Get year-to-date tax summary
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const taxYear = searchParams.get('taxYear') // Optional - defaults to current tax year

    // Get the default user (single user app)
    const user = await prisma.user.findFirst({
      select: {
        id: true,
        name: true,
        payPeriodType: true,
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'No user found. Please seed the database first.' },
        { status: 400 }
      )
    }

    // Get year-to-date tax summary (stored)
    const yearToDateTax = await PayPeriodTaxService.getYearToDateTaxSummary(
      user.id,
      taxYear || undefined
    )

    // Get user's tax settings for additional context
    const taxSettings = await PayPeriodTaxService.getUserTaxSettings(user.id)

    // Calculate some additional summary statistics
    const effectiveTaxRate = yearToDateTax.grossIncome.gt(0) 
      ? yearToDateTax.payGWithholding.div(yearToDateTax.grossIncome).times(100)
      : new Decimal(0)

    const effectiveMedicareRate = yearToDateTax.grossIncome.gt(0) 
      ? yearToDateTax.medicareLevy.div(yearToDateTax.grossIncome).times(100)
      : new Decimal(0)

    const effectiveHecsRate = yearToDateTax.grossIncome.gt(0) 
      ? yearToDateTax.hecsHelpAmount.div(yearToDateTax.grossIncome).times(100)
      : new Decimal(0)

    const effectiveTotalWithholdingRate = yearToDateTax.grossIncome.gt(0) 
      ? yearToDateTax.totalWithholdings.div(yearToDateTax.grossIncome).times(100)
      : new Decimal(0)

    // Project annualized figures based on current progress through tax year
    const currentDate = new Date()
    const taxYearStart = getTaxYearStartDate(yearToDateTax.taxYear)
    const taxYearEnd = getTaxYearEndDate(yearToDateTax.taxYear)
    const daysSinceStart = Math.max(1, Math.floor((currentDate.getTime() - taxYearStart.getTime()) / (1000 * 60 * 60 * 24)))
    const totalDaysInTaxYear = Math.floor((taxYearEnd.getTime() - taxYearStart.getTime()) / (1000 * 60 * 60 * 24))
    const progressThroughYear = Math.min(1, daysSinceStart / totalDaysInTaxYear)

    const projectedAnnualIncome = progressThroughYear > 0 
      ? yearToDateTax.grossIncome.div(progressThroughYear)
      : new Decimal(0)

    const projectedAnnualWithholdings = progressThroughYear > 0 
      ? yearToDateTax.totalWithholdings.div(progressThroughYear)
      : new Decimal(0)

    // Also compute a live YTD by summing pay periods within the tax year window
    const ty = yearToDateTax.taxYear
    const tyStart = getTaxYearStartDate(ty)
    const tyEnd = getTaxYearEndDate(ty)
    const periods = await prisma.payPeriod.findMany({
      where: {
        userId: user.id,
        startDate: { gte: tyStart },
        endDate: { lte: tyEnd },
        status: { in: ['processing','paid','verified'] },
      },
      select: { totalPay: true, totalWithholdings: true }
    })
    const liveGross = periods.reduce((sum, p) => sum.plus(p.totalPay || new Decimal(0)), new Decimal(0))
    const liveWithhold = periods.reduce((sum, p) => sum.plus(p.totalWithholdings || new Decimal(0)), new Decimal(0))
    const liveNet = liveGross.minus(liveWithhold)

    const response = {
      taxYear: yearToDateTax.taxYear,
      asAt: yearToDateTax.lastUpdated,
      user: {
        name: user.name,
        payPeriodType: user.payPeriodType,
      },
      yearToDate: {
        grossIncome: yearToDateTax.grossIncome.toString(),
        payGWithholding: yearToDateTax.payGWithholding.toString(),
        medicareLevy: yearToDateTax.medicareLevy.toString(),
        hecsHelpAmount: yearToDateTax.hecsHelpAmount.toString(),
        totalWithholdings: yearToDateTax.totalWithholdings.toString(),
        netIncome: yearToDateTax.grossIncome.minus(yearToDateTax.totalWithholdings).toString(),
      },
      liveYearToDate: {
        grossIncome: liveGross.toString(),
        totalWithholdings: liveWithhold.toString(),
        netIncome: liveNet.toString(),
      },
      effectiveRates: {
        payGWithholdingRate: effectiveTaxRate.toFixed(2) + '%',
        medicareRate: effectiveMedicareRate.toFixed(2) + '%',
        hecsHelpRate: effectiveHecsRate.toFixed(2) + '%',
        totalWithholdingRate: effectiveTotalWithholdingRate.toFixed(2) + '%',
      },
      projections: {
        annualGrossIncome: projectedAnnualIncome.toString(),
        annualTotalWithholdings: projectedAnnualWithholdings.toString(),
        annualNetIncome: projectedAnnualIncome.minus(projectedAnnualWithholdings).toString(),
        progressThroughTaxYear: Math.round(progressThroughYear * 100) + '%',
      },
      taxSettings: {
        claimedTaxFreeThreshold: taxSettings.claimedTaxFreeThreshold,
        isForeignResident: taxSettings.isForeignResident,
        medicareExemption: taxSettings.medicareExemption,
        hasHecsHelp: !!taxSettings.hecsHelpRate,
        hecsHelpRate: taxSettings.hecsHelpRate ? (taxSettings.hecsHelpRate.times(100).toFixed(1) + '%') : null,
      },
    }

    return NextResponse.json({ data: response })
  } catch (error) {
    console.error('Error fetching year-to-date tax summary:', error)
    return NextResponse.json(
      { error: 'Failed to fetch year-to-date tax summary' },
      { status: 500 }
    )
  }
}

// Helper function to get tax year start date (July 1)
function getTaxYearStartDate(taxYear: string): Date {
  const startYear = parseInt(taxYear.split('-')[0])
  return new Date(startYear, 6, 1) // July 1st (month is 0-indexed)
}

// Helper function to get tax year end date (June 30)
function getTaxYearEndDate(taxYear: string): Date {
  const startYear = parseInt(taxYear.split('-')[0])
  return new Date(startYear + 1, 5, 30) // June 30th of following year
}
