import { NextRequest, NextResponse } from 'next/server'
import { Decimal } from 'decimal.js'
import { prisma } from '@/lib/db'
import {
  TaxPreviewRequest,
  TaxPreviewResponse,
  ApiValidationResponse,
  PayPeriodType,
} from '@/types'
import { ValidationResult, validateString } from '@/lib/validation'
import { PayPeriodTaxService } from '@/lib/pay-period-tax-service'

// POST /api/tax/preview - Preview tax calculation without saving
export async function POST(request: NextRequest) {
  try {
    const body: TaxPreviewRequest = await request.json()

    // Validate request body
    const validator = ValidationResult.create()

    validateString(body.grossPay, 'grossPay', validator)
    
    if (body.payPeriodType && !['WEEKLY', 'FORTNIGHTLY', 'MONTHLY'].includes(body.payPeriodType)) {
      validator.addError('payPeriodType', 'Pay period type must be WEEKLY, FORTNIGHTLY, or MONTHLY')
    }

    // Validate gross pay amount
    let grossPayDecimal: Decimal
    try {
      grossPayDecimal = new Decimal(body.grossPay)
      if (grossPayDecimal.lt(0)) {
        validator.addError('grossPay', 'Gross pay must be a positive amount')
      }
      if (grossPayDecimal.gt(50000)) {
        validator.addError('grossPay', 'Gross pay amount is unreasonably high for a single pay period')
      }
    } catch {
      validator.addError('grossPay', 'Gross pay must be a valid decimal number')
    }

    if (!validator.isValid()) {
      return NextResponse.json(
        {
          errors: validator.getErrors(),
          message: 'Invalid tax preview request',
        } as ApiValidationResponse,
        { status: 400 }
      )
    }

    // Get the default user (single user app)
    const user = await prisma.user.findFirst({
      select: {
        id: true,
        payPeriodType: true,
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'No user found. Please seed the database first.' },
        { status: 400 }
      )
    }

    // Use provided pay period type or default to user's preference
    const payPeriodType: PayPeriodType = body.payPeriodType || user.payPeriodType

    // Preview tax calculation
    const preview = await PayPeriodTaxService.previewTaxCalculation(
      user.id,
      grossPayDecimal!,
      payPeriodType
    )

    const response: TaxPreviewResponse = {
      preview,
    }

    return NextResponse.json(
      { data: response, message: 'Tax preview calculated successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error calculating tax preview:', error)

    // Handle specific errors
    const errors: string[] = []

    if (error instanceof Error) {
      if (error.message.includes('User not found')) {
        errors.push('User configuration not found')
      } else if (error.message.includes('tax settings')) {
        errors.push('Tax settings not configured')
      } else if (error.message.includes('Unsupported pay period type')) {
        errors.push('Invalid pay period type')
      } else {
        errors.push('Failed to calculate tax preview')
      }
    } else {
      errors.push('An unexpected error occurred')
    }

    const response: TaxPreviewResponse = {
      preview: {} as any, // Empty preview on error
      errors,
    }

    return NextResponse.json(
      { data: response },
      { status: 500 }
    )
  }
}

// GET /api/tax/preview - Get tax preview form with current settings
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const grossPay = searchParams.get('grossPay')
    const payPeriodType = searchParams.get('payPeriodType') as PayPeriodType

    if (!grossPay) {
      return NextResponse.json(
        {
          errors: [{ field: 'grossPay', message: 'Gross pay is required for tax preview' }],
          message: 'Missing required parameter',
        } as ApiValidationResponse,
        { status: 400 }
      )
    }

    // Validate gross pay
    let grossPayDecimal: Decimal
    try {
      grossPayDecimal = new Decimal(grossPay)
      if (grossPayDecimal.lt(0)) {
        return NextResponse.json(
          {
            errors: [{ field: 'grossPay', message: 'Gross pay must be a positive amount' }],
            message: 'Invalid gross pay amount',
          } as ApiValidationResponse,
          { status: 400 }
        )
      }
    } catch {
      return NextResponse.json(
        {
          errors: [{ field: 'grossPay', message: 'Gross pay must be a valid decimal number' }],
          message: 'Invalid gross pay format',
        } as ApiValidationResponse,
        { status: 400 }
      )
    }

    // Validate pay period type if provided
    if (payPeriodType && !['WEEKLY', 'FORTNIGHTLY', 'MONTHLY'].includes(payPeriodType)) {
      return NextResponse.json(
        {
          errors: [{ field: 'payPeriodType', message: 'Pay period type must be WEEKLY, FORTNIGHTLY, or MONTHLY' }],
          message: 'Invalid pay period type',
        } as ApiValidationResponse,
        { status: 400 }
      )
    }

    // Get the default user (single user app)
    const user = await prisma.user.findFirst({
      select: {
        id: true,
        payPeriodType: true,
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'No user found. Please seed the database first.' },
        { status: 400 }
      )
    }

    // Use provided pay period type or default to user's preference
    const effectivePayPeriodType: PayPeriodType = payPeriodType || user.payPeriodType

    // Preview tax calculation
    const preview = await PayPeriodTaxService.previewTaxCalculation(
      user.id,
      grossPayDecimal,
      effectivePayPeriodType
    )

    const response: TaxPreviewResponse = {
      preview,
    }

    return NextResponse.json({ data: response })
  } catch (error) {
    console.error('Error calculating tax preview:', error)

    const errors: string[] = ['Failed to calculate tax preview']

    const response: TaxPreviewResponse = {
      preview: {} as any, // Empty preview on error
      errors,
    }

    return NextResponse.json(
      { data: response },
      { status: 500 }
    )
  }
}