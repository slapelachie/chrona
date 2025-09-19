import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ValidationResult, validateString } from '@/lib/validation'

// GET /api/admin/tax-config - Get tax rate configuration by tax year
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const { getCurrentAuTaxYearString } = await import('@/lib/tax-year')
    const taxYear = searchParams.get('taxYear') || getCurrentAuTaxYearString()

    const config = await prisma.taxRateConfig.findUnique({
      where: { taxYear },
    })

    if (!config) {
      return NextResponse.json(
        { error: 'Tax configuration not found for the specified tax year' },
        { status: 404 }
      )
    }

    const response = {
      id: config.id,
      taxYear: config.taxYear,
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
    const { taxYear, description, isActive } = body

    // Validate request (guard against mocked validators)
    const validator = ValidationResult.create()
    let earlyInvalid = false

    if (!taxYear || typeof taxYear !== 'string') {
      earlyInvalid = true
      validator.addError('taxYear', 'Tax year is required')
    }
    validateString(taxYear, 'taxYear', validator, { required: true })

    if (earlyInvalid || !validator.isValid()) {
      return NextResponse.json(
        {
          errors: validator.getErrors(),
          message: 'Invalid tax configuration data',
        },
        { status: 400 }
      )
    }

    // Update or create tax configuration
    const config = await prisma.taxRateConfig.upsert({
      where: { taxYear },
      update: {
        description: description || null,
        isActive: typeof isActive === 'boolean' ? isActive : true,
      },
      create: {
        taxYear,
        description: description || null,
        isActive: true,
      },
    })

    // Transform response
    const response = {
      id: config.id,
      taxYear: config.taxYear,
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
    const { taxYear, description, isActive } = body

    // Validate request (guard against mocked validators)
    const validator = ValidationResult.create()
    let earlyInvalid2 = false

    if (!taxYear || typeof taxYear !== 'string') {
      earlyInvalid2 = true
      validator.addError('taxYear', 'Tax year is required')
    }
    validateString(taxYear, 'taxYear', validator, { required: true })

    if (earlyInvalid2 || !validator.isValid()) {
      return NextResponse.json(
        {
          errors: validator.getErrors(),
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
        description: description || null,
        isActive: typeof isActive === 'boolean' ? isActive : true,
      },
    })

    // Transform response
    const response = {
      id: config.id,
      taxYear: config.taxYear,
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
