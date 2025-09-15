import { NextRequest, NextResponse } from 'next/server'
import { Decimal } from 'decimal.js'
import { prisma } from '@/lib/db'
import { ValidationResult, validateString, validateDecimal } from '@/lib/validation'

// GET /api/admin/hecs-thresholds - Get HECS-HELP thresholds by tax year
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const taxYear = searchParams.get('taxYear') || '2024-25'

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
      rate: threshold.rate.toString(),
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

    if (!taxYear || typeof taxYear !== 'string') {
      validator.addError('taxYear', 'Tax year is required and must be a string')
    }

    if (!Array.isArray(thresholds)) {
      validator.addError('thresholds', 'Thresholds must be an array')
    }

    if (!validator.isValid()) {
      return NextResponse.json(
        {
          errors: validator.getErrors(),
          message: 'Invalid request data',
        },
        { status: 400 }
      )
    }

    // Validate each threshold
    const validatedThresholds = []
    for (let i = 0; i < thresholds.length; i++) {
      const threshold = thresholds[i]
      const thresholdValidator = ValidationResult.create()

      validateDecimal(threshold.incomeFrom, 'incomeFrom', thresholdValidator, { required: true, min: 0 })
      
      if (threshold.incomeTo !== null) {
        validateDecimal(threshold.incomeTo, 'incomeTo', thresholdValidator, { min: 0 })
        
        // Validate that incomeTo is greater than incomeFrom
        if (threshold.incomeTo && new Decimal(threshold.incomeTo).lte(new Decimal(threshold.incomeFrom))) {
          thresholdValidator.addError('incomeTo', 'Income to must be greater than income from')
        }
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

      validatedThresholds.push({
        incomeFrom: new Decimal(threshold.incomeFrom),
        incomeTo: threshold.incomeTo ? new Decimal(threshold.incomeTo) : null,
        rate: new Decimal(threshold.rate),
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
      rate: threshold.rate.toString(),
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