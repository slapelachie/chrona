import { NextRequest, NextResponse } from 'next/server'
import { Decimal } from 'decimal.js'
import { prisma } from '@/lib/db'
import {
  TaxCalculationResponse,
  ApiValidationResponse,
  TaxScale,
} from '@/types'
import { PayPeriodTaxService } from '@/lib/pay-period-tax-service'

// POST /api/pay-periods/[id]/tax-calculation - Calculate taxes for a pay period
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: payPeriodId } = await params

    // Check if pay period exists
    const payPeriod = await prisma.payPeriod.findUnique({
      where: { id: payPeriodId },
      include: { shifts: true }
    })

    if (!payPeriod) {
      return NextResponse.json(
        {
          errors: [{ field: 'payPeriodId', message: 'Pay period not found' }],
          message: 'Invalid pay period',
        } as ApiValidationResponse,
        { status: 404 }
      )
    }

    // Check if pay period has any shifts
    if (payPeriod.shifts.length === 0) {
      return NextResponse.json(
        {
          errors: [{ field: 'shifts', message: 'Pay period has no shifts to calculate taxes for' }],
          message: 'No shifts found',
        } as ApiValidationResponse,
        { status: 400 }
      )
    }

    // Check if pay period is in correct status for tax calculation
    if (payPeriod.status !== 'open' && payPeriod.status !== 'processing') {
      return NextResponse.json(
        {
          errors: [{ field: 'status', message: 'Pay period must be open or processing to calculate taxes' }],
          message: 'Invalid pay period status',
        } as ApiValidationResponse,
        { status: 400 }
      )
    }

    // Calculate taxes for the pay period
    const taxCalculation = await PayPeriodTaxService.calculatePayPeriodTax(payPeriodId)

    const response: TaxCalculationResponse = {
      taxCalculation,
      success: true,
    }

    return NextResponse.json(
      { data: response, message: 'Tax calculation completed successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error calculating pay period taxes:', error)

    // Handle specific error messages from the service
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json(
          {
            errors: [{ field: 'payPeriodId', message: error.message }],
            message: 'Pay period not found',
          } as ApiValidationResponse,
          { status: 404 }
        )
      }

      if (error.message.includes('no calculated total pay')) {
        return NextResponse.json(
          {
            errors: [{ field: 'totalPay', message: error.message }],
            message: 'Pay period totals not calculated',
          } as ApiValidationResponse,
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to calculate pay period taxes' },
      { status: 500 }
    )
  }
}

// GET /api/pay-periods/[id]/tax-calculation - Get existing tax calculation for a pay period
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: payPeriodId } = await params

    // Get pay period with tax information
    const payPeriod = await prisma.payPeriod.findUnique({
      where: { id: payPeriodId },
      include: {
        user: {
          include: {
            taxSettings: true,
          }
        }
      }
    })

    if (!payPeriod) {
      return NextResponse.json(
        {
          errors: [{ field: 'payPeriodId', message: 'Pay period not found' }],
          message: 'Invalid pay period',
        } as ApiValidationResponse,
        { status: 404 }
      )
    }

    // Check if tax has been calculated
    if (!payPeriod.totalPay || !payPeriod.totalWithholdings) {
      return NextResponse.json(
        {
          errors: [{ field: 'taxCalculation', message: 'Tax calculation not found for this pay period' }],
          message: 'Tax not calculated',
        } as ApiValidationResponse,
        { status: 404 }
      )
    }

    // Get year-to-date tax information
    const taxYear = getCurrentTaxYear()
    const yearToDateTax = await PayPeriodTaxService.getYearToDateTaxSummary(payPeriod.userId, taxYear)

    // Reconstruct tax calculation result
    const taxCalculation = {
      payPeriod: {
        id: payPeriod.id,
        grossPay: payPeriod.totalPay,
        payPeriodType: payPeriod.user.payPeriodType,
      },
      breakdown: {
        grossPay: payPeriod.totalPay,
        paygWithholding: payPeriod.paygWithholding || new Decimal(0),
        medicareLevy: payPeriod.medicareLevy || new Decimal(0),
        hecsHelpAmount: payPeriod.hecsHelpAmount || new Decimal(0),
        totalWithholdings: payPeriod.totalWithholdings || new Decimal(0),
        netPay: payPeriod.netPay || payPeriod.totalPay,
      },
      taxScale: determineTaxScale(payPeriod.user.taxSettings) as TaxScale,
      yearToDate: {
        grossIncome: yearToDateTax.grossIncome,
        totalWithholdings: yearToDateTax.totalWithholdings,
      },
    }

    const response: TaxCalculationResponse = {
      taxCalculation,
      success: true,
    }

    return NextResponse.json({ data: response })
  } catch (error) {
    console.error('Error fetching pay period tax calculation:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pay period tax calculation' },
      { status: 500 }
    )
  }
}

// Helper function to determine tax scale from settings
function determineTaxScale(taxSettings: any): string {
  if (!taxSettings) return 'scale2' // Default to claimed tax-free threshold

  if (!taxSettings.hasTaxFileNumber) {
    return 'scale4' // No TFN provided
  }

  if (taxSettings.isForeignResident) {
    return 'scale3' // Foreign resident
  }

  if (taxSettings.medicareExemption === 'full') {
    return 'scale5' // Full Medicare exemption
  }

  if (taxSettings.medicareExemption === 'half') {
    return 'scale6' // Half Medicare exemption
  }

  if (taxSettings.claimedTaxFreeThreshold) {
    return 'scale2' // Claimed tax-free threshold
  }

  return 'scale1' // Did not claim tax-free threshold
}

// Helper function to get current tax year
function getCurrentTaxYear(): string {
  const now = new Date()
  const year = now.getFullYear()
  
  // Australian tax year runs from July 1 to June 30
  if (now.getMonth() >= 6) { // July (6) onwards
    return `${year}-${(year + 1) % 100}`
  } else {
    return `${year - 1}-${year % 100}`
  }
}