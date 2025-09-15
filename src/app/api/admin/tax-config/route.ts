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

    // Validate request
    const validator = ValidationResult.create()

    validateString(taxYear, 'taxYear', validator, { required: true })
    validateDecimal(medicareRate, 'medicareRate', validator, { required: true, min: 0, max: 1 })
    validateDecimal(medicareLowIncomeThreshold, 'medicareLowIncomeThreshold', validator, { required: true, min: 0 })
    validateDecimal(medicareHighIncomeThreshold, 'medicareHighIncomeThreshold', validator, { required: true, min: 0 })

    // Validate that high threshold is greater than low threshold
    if (medicareRate && medicareLowIncomeThreshold && medicareHighIncomeThreshold) {
      const lowThreshold = new Decimal(medicareLowIncomeThreshold)
      const highThreshold = new Decimal(medicareHighIncomeThreshold)
      
      if (highThreshold.lte(lowThreshold)) {
        validator.addError('medicareHighIncomeThreshold', 'High income threshold must be greater than low income threshold')
      }
    }

    if (!validator.isValid()) {
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

    // Validate request
    const validator = ValidationResult.create()

    validateString(taxYear, 'taxYear', validator, { required: true })
    validateDecimal(medicareRate, 'medicareRate', validator, { required: true, min: 0, max: 1 })
    validateDecimal(medicareLowIncomeThreshold, 'medicareLowIncomeThreshold', validator, { required: true, min: 0 })
    validateDecimal(medicareHighIncomeThreshold, 'medicareHighIncomeThreshold', validator, { required: true, min: 0 })

    // Validate that high threshold is greater than low threshold
    if (medicareRate && medicareLowIncomeThreshold && medicareHighIncomeThreshold) {
      const lowThreshold = new Decimal(medicareLowIncomeThreshold)
      const highThreshold = new Decimal(medicareHighIncomeThreshold)
      
      if (highThreshold.lte(lowThreshold)) {
        validator.addError('medicareHighIncomeThreshold', 'High income threshold must be greater than low income threshold')
      }
    }

    if (!validator.isValid()) {
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