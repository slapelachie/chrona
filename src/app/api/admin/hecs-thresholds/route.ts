import { NextRequest, NextResponse } from 'next/server'
import { Decimal } from 'decimal.js'
import { prisma } from '@/lib/db'
import { ValidationResult, validateString, validateDecimal } from '@/lib/validation'

// GET /api/admin/hecs-thresholds - Get HECS-HELP thresholds by tax year
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const { getCurrentAuTaxYearString } = await import('@/lib/tax-year')
    const taxYear = searchParams.get('taxYear') || getCurrentAuTaxYearString()

    const thresholds = await prisma.hecsThreshold.findMany({
      where: {
        taxYear,
        isActive: true,
      },
      orderBy: {
        incomeFrom: 'asc',
      },
    })

    // Transform to response format
    const response = thresholds.map(threshold => ({
      id: threshold.id,
      taxYear: threshold.taxYear,
      incomeFrom: threshold.incomeFrom.toString(),
      incomeTo: threshold.incomeTo?.toString() || null,
      // Format rate with 2 decimal places to preserve trailing zeros (e.g., 0.10)
      rate: new Decimal(threshold.rate).toFixed(2),
      description: threshold.description,
      isActive: threshold.isActive,
      createdAt: threshold.createdAt,
      updatedAt: threshold.updatedAt,
    }))

    return NextResponse.json({ data: response })
  } catch (error) {
    console.error('Error fetching HECS thresholds:', error)
    return NextResponse.json(
      { error: 'Failed to fetch HECS thresholds' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/hecs-thresholds - Bulk update HECS-HELP thresholds
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { taxYear, thresholds } = body

    // Validate request
    const validator = ValidationResult.create()
    let earlyInvalid = false

    if (!taxYear || typeof taxYear !== 'string') {
      earlyInvalid = true
      validator.addError('taxYear', 'Tax year is required and must be a string')
    }

    if (!Array.isArray(thresholds)) {
      earlyInvalid = true
      validator.addError('thresholds', 'Thresholds must be an array')
    }

    if (earlyInvalid) {
      return NextResponse.json(
        {
          errors: validator.getErrors(),
          message: 'Invalid request data',
        },
        { status: 400 }
      )
    }

    // Validate each threshold (shape/type only first)
    const validatedThresholds = []
    for (let i = 0; i < thresholds.length; i++) {
      const threshold = thresholds[i]
      const thresholdValidator = ValidationResult.create()

      validateDecimal(threshold.incomeFrom, 'incomeFrom', thresholdValidator, { required: true, min: 0 })
      
      if (threshold.incomeTo !== null && threshold.incomeTo !== undefined) {
        validateDecimal(threshold.incomeTo, 'incomeTo', thresholdValidator, { min: 0 })
      }
      
      validateDecimal(threshold.rate, 'rate', thresholdValidator, { required: true, min: 0, max: 1 })

      if (!thresholdValidator.isValid()) {
        return NextResponse.json(
          {
            errors: thresholdValidator.getErrors(),
            message: `Invalid threshold data at index ${i}`,
          },
          { status: 400 }
        )
      }

      // At this point basic validation passed; perform relational checks and build objects
      let incomeFromDec: Decimal
      let incomeToDec: Decimal | null = null
      try {
        incomeFromDec = new Decimal(threshold.incomeFrom)
        if (threshold.incomeTo !== null && threshold.incomeTo !== undefined) {
          incomeToDec = new Decimal(threshold.incomeTo)
        }
      } catch {
        return NextResponse.json(
          {
            errors: [{ field: 'incomeFrom', message: 'Income values must be valid decimals' }],
            message: `Invalid threshold data at index ${i}`,
          },
          { status: 400 }
        )
      }

      if (incomeToDec && incomeToDec.lte(incomeFromDec)) {
        return NextResponse.json(
          {
            errors: [{ field: 'incomeTo', message: 'Income to must be greater than income from' }],
            message: `Invalid threshold data at index ${i}`,
          },
          { status: 400 }
        )
      }

      let rateDec: Decimal
      try {
        rateDec = new Decimal(threshold.rate)
      } catch {
        return NextResponse.json(
          {
            errors: [{ field: 'rate', message: 'Rate must be a valid decimal' }],
            message: `Invalid threshold data at index ${i}`,
          },
          { status: 400 }
        )
      }

      // Enforce bounds independently of mocked validators
      if (rateDec.lt(0) || rateDec.gt(1)) {
        return NextResponse.json(
          {
            errors: [{ field: 'rate', message: 'Rate must be between 0 and 1' }],
            message: `Invalid threshold data at index ${i}`,
          },
          { status: 400 }
        )
      }

      validatedThresholds.push({
        incomeFrom: incomeFromDec,
        incomeTo: incomeToDec,
        rate: rateDec,
        description: threshold.description || null,
      })
    }

    // Validate that thresholds don't overlap and are in order
    for (let i = 1; i < validatedThresholds.length; i++) {
      const prev = validatedThresholds[i - 1]
      const curr = validatedThresholds[i]
      
      if (prev.incomeTo && curr.incomeFrom.lt(prev.incomeTo)) {
        return NextResponse.json(
          {
            errors: { thresholds: 'Income thresholds cannot overlap' },
            message: 'Threshold validation failed',
          },
          { status: 400 }
        )
      }
    }

    // Use transaction to update thresholds
    const result = await prisma.$transaction(async (tx) => {
      // First, deactivate existing thresholds for this tax year
      await tx.hecsThreshold.updateMany({
        where: { taxYear },
        data: { isActive: false },
      })

      // Then create new thresholds
      const createdThresholds = []
      for (const threshold of validatedThresholds) {
        const created = await tx.hecsThreshold.create({
          data: {
            taxYear,
            incomeFrom: threshold.incomeFrom,
            incomeTo: threshold.incomeTo,
            rate: threshold.rate,
            description: threshold.description,
            isActive: true,
          },
        })
        createdThresholds.push(created)
      }

      return createdThresholds
    })

    // Transform response
    const response = result.map(threshold => ({
      id: threshold.id,
      taxYear: threshold.taxYear,
      incomeFrom: threshold.incomeFrom.toString(),
      incomeTo: threshold.incomeTo?.toString() || null,
      rate: new Decimal(threshold.rate).toFixed(2),
      description: threshold.description,
      isActive: threshold.isActive,
      createdAt: threshold.createdAt,
      updatedAt: threshold.updatedAt,
    }))

    return NextResponse.json(
      { 
        data: response,
        message: `Successfully updated ${result.length} HECS thresholds for ${taxYear}`,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error updating HECS thresholds:', error)
    return NextResponse.json(
      { error: 'Failed to update HECS thresholds' },
      { status: 500 }
    )
  }
}
