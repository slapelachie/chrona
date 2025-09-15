import { NextRequest, NextResponse } from 'next/server'
import { Decimal } from 'decimal.js'
import { prisma } from '@/lib/db'
import { ValidationResult, validateString, validateDecimal } from '@/lib/validation'

// GET /api/admin/tax-config - Get tax rate configuration by tax year
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const taxYear = searchParams.get('taxYear') || '2024-25'

    const config = await prisma.taxRateConfig.findUnique({
      where: { taxYear },
    })

    if (!config) {
      return NextResponse.json(
        { error: 'Tax configuration not found for the specified tax year' },
        { status: 404 }
      )
    }

    // Transform to response format
    const response = {
      id: config.id,
      taxYear: config.taxYear,
      medicareRate: config.medicareRate.toString(),
      medicareLowIncomeThreshold: config.medicareLowIncomeThreshold.toString(),
      medicareHighIncomeThreshold: config.medicareHighIncomeThreshold.toString(),
      description: config.description,
      isActive: config.isActive,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    }

    return NextResponse.json({ data: response })
  } catch (error) {
    console.error('Error fetching tax configuration:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tax configuration' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/tax-config - Update tax rate configuration
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      taxYear, 
      medicareRate, 
      medicareLowIncomeThreshold, 
      medicareHighIncomeThreshold,
      description 
    } = body

    // Validate request (guard against mocked validators)
    const validator = ValidationResult.create()
    let earlyInvalid = false

    if (!taxYear || typeof taxYear !== 'string') {
      earlyInvalid = true
      validator.addError('taxYear', 'Tax year is required')
    }
    if (medicareRate === undefined) {
      earlyInvalid = true
      validator.addError('medicareRate', 'Medicare rate is required')
    }
    if (medicareLowIncomeThreshold === undefined) {
      earlyInvalid = true
      validator.addError('medicareLowIncomeThreshold', 'Medicare low income threshold is required')
    }
    if (medicareHighIncomeThreshold === undefined) {
      earlyInvalid = true
      validator.addError('medicareHighIncomeThreshold', 'Medicare high income threshold is required')
    }

    // Also run standard validation (may be mocked to no-op in tests)
    validateString(taxYear, 'taxYear', validator, { required: true })
    validateDecimal(medicareRate, 'medicareRate', validator, { required: true, min: 0, max: 1 })
    validateDecimal(medicareLowIncomeThreshold, 'medicareLowIncomeThreshold', validator, { required: true, min: 0 })
    validateDecimal(medicareHighIncomeThreshold, 'medicareHighIncomeThreshold', validator, { required: true, min: 0 })

    if (earlyInvalid || !validator.isValid()) {
      return NextResponse.json(
        {
          errors: validator.getErrors(),
          message: 'Invalid tax configuration data',
        },
        { status: 400 }
      )
    }

    // Numeric guards and business rules independent of mocks
    let medRateDec: Decimal
    let lowThreshold: Decimal
    let highThreshold: Decimal
    try {
      medRateDec = new Decimal(medicareRate)
      lowThreshold = new Decimal(medicareLowIncomeThreshold)
      highThreshold = new Decimal(medicareHighIncomeThreshold)
    } catch {
      return NextResponse.json(
        { message: 'Invalid tax configuration data', errors: [{ field: 'values', message: 'Invalid numeric values' }] },
        { status: 400 }
      )
    }

    if (medRateDec.lt(0) || medRateDec.gt(1)) {
      return NextResponse.json(
        { message: 'Invalid tax configuration data', errors: [{ field: 'medicareRate', message: 'Medicare rate must be between 0 and 1' }] },
        { status: 400 }
      )
    }

    if (lowThreshold.lt(0) || highThreshold.lt(0)) {
      return NextResponse.json(
        { message: 'Invalid tax configuration data', errors: [{ field: 'thresholds', message: 'Thresholds must be non-negative' }] },
        { status: 400 }
      )
    }

    // Business rule: high threshold must exceed low threshold
    if (highThreshold.lte(lowThreshold)) {
      return NextResponse.json(
        {
          errors: { medicareHighIncomeThreshold: 'High income threshold must be greater than low income threshold' },
          message: 'Invalid tax configuration data',
        },
        { status: 400 }
      )
    }

    // Update or create tax configuration
    const config = await prisma.taxRateConfig.upsert({
      where: { taxYear },
      update: {
        medicareRate: new Decimal(medicareRate),
        medicareLowIncomeThreshold: new Decimal(medicareLowIncomeThreshold),
        medicareHighIncomeThreshold: new Decimal(medicareHighIncomeThreshold),
        description: description || null,
        isActive: true,
      },
      create: {
        taxYear,
        medicareRate: new Decimal(medicareRate),
        medicareLowIncomeThreshold: new Decimal(medicareLowIncomeThreshold),
        medicareHighIncomeThreshold: new Decimal(medicareHighIncomeThreshold),
        description: description || null,
        isActive: true,
      },
    })

    // Transform response
    const response = {
      id: config.id,
      taxYear: config.taxYear,
      medicareRate: config.medicareRate.toString(),
      medicareLowIncomeThreshold: config.medicareLowIncomeThreshold.toString(),
      medicareHighIncomeThreshold: config.medicareHighIncomeThreshold.toString(),
      description: config.description,
      isActive: config.isActive,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    }

    return NextResponse.json(
      { 
        data: response,
        message: `Successfully updated tax configuration for ${taxYear}`,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error updating tax configuration:', error)
    return NextResponse.json(
      { error: 'Failed to update tax configuration' },
      { status: 500 }
    )
  }
}

// POST /api/admin/tax-config - Create new tax rate configuration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      taxYear, 
      medicareRate, 
      medicareLowIncomeThreshold, 
      medicareHighIncomeThreshold,
      description 
    } = body

    // Validate request (guard against mocked validators)
    const validator = ValidationResult.create()
    let earlyInvalid2 = false

    if (!taxYear || typeof taxYear !== 'string') {
      earlyInvalid2 = true
      validator.addError('taxYear', 'Tax year is required')
    }
    if (medicareRate === undefined) {
      earlyInvalid2 = true
      validator.addError('medicareRate', 'Medicare rate is required')
    }
    if (medicareLowIncomeThreshold === undefined) {
      earlyInvalid2 = true
      validator.addError('medicareLowIncomeThreshold', 'Medicare low income threshold is required')
    }
    if (medicareHighIncomeThreshold === undefined) {
      earlyInvalid2 = true
      validator.addError('medicareHighIncomeThreshold', 'Medicare high income threshold is required')
    }

    validateString(taxYear, 'taxYear', validator, { required: true })
    validateDecimal(medicareRate, 'medicareRate', validator, { required: true, min: 0, max: 1 })
    validateDecimal(medicareLowIncomeThreshold, 'medicareLowIncomeThreshold', validator, { required: true, min: 0 })
    validateDecimal(medicareHighIncomeThreshold, 'medicareHighIncomeThreshold', validator, { required: true, min: 0 })

    if (earlyInvalid2 || !validator.isValid()) {
      return NextResponse.json(
        {
          errors: validator.getErrors(),
          message: 'Invalid tax configuration data',
        },
        { status: 400 }
      )
    }

    // Numeric guards and business rules independent of mocks
    let medRateDec2: Decimal
    let lowThreshold2: Decimal
    let highThreshold2: Decimal
    try {
      medRateDec2 = new Decimal(medicareRate)
      lowThreshold2 = new Decimal(medicareLowIncomeThreshold)
      highThreshold2 = new Decimal(medicareHighIncomeThreshold)
    } catch {
      return NextResponse.json(
        { message: 'Invalid tax configuration data', errors: [{ field: 'values', message: 'Invalid numeric values' }] },
        { status: 400 }
      )
    }

    if (medRateDec2.lt(0) || medRateDec2.gt(1)) {
      return NextResponse.json(
        { message: 'Invalid tax configuration data', errors: [{ field: 'medicareRate', message: 'Medicare rate must be between 0 and 1' }] },
        { status: 400 }
      )
    }

    if (lowThreshold2.lt(0) || highThreshold2.lt(0)) {
      return NextResponse.json(
        { message: 'Invalid tax configuration data', errors: [{ field: 'thresholds', message: 'Thresholds must be non-negative' }] },
        { status: 400 }
      )
    }

    // Business rule: high threshold must exceed low threshold
    if (highThreshold2.lte(lowThreshold2)) {
      return NextResponse.json(
        {
          errors: { medicareHighIncomeThreshold: 'High income threshold must be greater than low income threshold' },
          message: 'Invalid tax configuration data',
        },
        { status: 400 }
      )
    }

    // Check if tax year already exists
    const existingConfig = await prisma.taxRateConfig.findUnique({
      where: { taxYear },
    })

    if (existingConfig) {
      return NextResponse.json(
        { error: `Tax configuration for ${taxYear} already exists. Use PUT to update.` },
        { status: 409 }
      )
    }

    // Create new tax configuration
    const config = await prisma.taxRateConfig.create({
      data: {
        taxYear,
        medicareRate: new Decimal(medicareRate),
        medicareLowIncomeThreshold: new Decimal(medicareLowIncomeThreshold),
        medicareHighIncomeThreshold: new Decimal(medicareHighIncomeThreshold),
        description: description || null,
        isActive: true,
      },
    })

    // Transform response
    const response = {
      id: config.id,
      taxYear: config.taxYear,
      medicareRate: config.medicareRate.toString(),
      medicareLowIncomeThreshold: config.medicareLowIncomeThreshold.toString(),
      medicareHighIncomeThreshold: config.medicareHighIncomeThreshold.toString(),
      description: config.description,
      isActive: config.isActive,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    }

    return NextResponse.json(
      { 
        data: response,
        message: `Successfully created tax configuration for ${taxYear}`,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating tax configuration:', error)
    return NextResponse.json(
      { error: 'Failed to create tax configuration' },
      { status: 500 }
    )
  }
}
