import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { Decimal } from 'decimal.js'
import {
  CreatePayGuideRequest,
  PayGuideResponse,
  PayGuidesListResponse,
  ApiValidationResponse,
} from '@/types'
import {
  ValidationResult,
  validateString,
  validateDecimal,
  validateDate,
  validateNumber,
} from '@/lib/validation'

const validateTimezone = (timezone: string, field: string, validator: ValidationResult) => {
  if (!validateString(timezone, field, validator)) return false
  
  try {
    // Test if timezone is valid by trying to create a DateTimeFormat
    new Intl.DateTimeFormat('en-US', { timeZone: timezone })
    return true
  } catch {
    validator.addError(field, `${field} must be a valid IANA timezone identifier`)
    return false
  }
}

// GET /api/pay-rates - List all pay guides
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Parse query parameters
    const page = Number(searchParams.get('page') || '1')
    const limit = Number(searchParams.get('limit') || '10')
    const sortBy = searchParams.get('sortBy') || 'name'
    const sortOrder = (searchParams.get('sortOrder') || 'asc') as 'asc' | 'desc'
    const active = searchParams.get('active')

    // Validate pagination parameters
    const validator = ValidationResult.create()

    if (page < 1) validator.addError('page', 'Page must be at least 1')
    if (limit < 1 || limit > 100)
      validator.addError('limit', 'Limit must be between 1 and 100')
    if (!['name', 'baseRate', 'effectiveFrom', 'createdAt'].includes(sortBy)) {
      validator.addError('sortBy', 'Invalid sort field')
    }
    if (!['asc', 'desc'].includes(sortOrder)) {
      validator.addError('sortOrder', 'Sort order must be asc or desc')
    }

    if (!validator.isValid()) {
      return NextResponse.json(
        {
          errors: validator.getErrors(),
          message: 'Invalid query parameters',
        } as ApiValidationResponse,
        { status: 400 }
      )
    }

    // Build where clause for filtering
    const where: { isActive?: boolean } = {}

    if (active !== null) {
      if (active === 'true') where.isActive = true
      if (active === 'false') where.isActive = false
    }

    // Get total count for pagination
    const total = await prisma.payGuide.count({ where })

    // Calculate pagination
    const skip = (page - 1) * limit
    const totalPages = Math.ceil(total / limit)

    const payGuides = await prisma.payGuide.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    })

    // Transform to response format
    const responsePayGuides: PayGuideResponse[] = payGuides.map((payGuide) => ({
      id: payGuide.id,
      name: payGuide.name,
      baseRate: payGuide.baseRate.toString(),
      minimumShiftHours: payGuide.minimumShiftHours,
      maximumShiftHours: payGuide.maximumShiftHours,
      description: payGuide.description,
      effectiveFrom: payGuide.effectiveFrom,
      effectiveTo: payGuide.effectiveTo,
      timezone: payGuide.timezone,
      isActive: payGuide.isActive,
      createdAt: payGuide.createdAt,
      updatedAt: payGuide.updatedAt,
    }))

    const response: PayGuidesListResponse = {
      payGuides: responsePayGuides,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    }

    return NextResponse.json({ data: response })
  } catch (error) {
    console.error('Error fetching pay guides:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pay guides' },
      { status: 500 }
    )
  }
}

// POST /api/pay-rates - Create a new pay guide
export async function POST(request: NextRequest) {
  try {
    const body: CreatePayGuideRequest = await request.json()

    // Validate request body
    const validator = ValidationResult.create()

    validateString(body.name, 'name', validator, {
      minLength: 3,
      maxLength: 200,
    })

    validateDecimal(body.baseRate, 'baseRate', validator, {
      min: new Decimal('0.01'),
      max: new Decimal('1000.00'),
    })

    validateDate(body.effectiveFrom, 'effectiveFrom', validator)

    if (body.effectiveTo !== undefined) {
      validateDate(body.effectiveTo, 'effectiveTo', validator)
    }

    if (body.description !== undefined) {
      validateString(body.description, 'description', validator, {
        maxLength: 500,
      })
    }

    // Validate timezone (required field)
    validateTimezone(body.timezone, 'timezone', validator)

    // Validate minimum and maximum shift hours
    if (body.minimumShiftHours !== undefined) {
      validateNumber(body.minimumShiftHours, 'minimumShiftHours', validator, {
        min: 0.5,
        max: 24,
      })
    }

    if (body.maximumShiftHours !== undefined) {
      validateNumber(body.maximumShiftHours, 'maximumShiftHours', validator, {
        min: 1,
        max: 24,
      })
    }

    // Validate that minimum is less than maximum if both are provided
    if (body.minimumShiftHours !== undefined && body.maximumShiftHours !== undefined) {
      if (body.minimumShiftHours >= body.maximumShiftHours) {
        validator.addError('maximumShiftHours', 'Maximum shift hours must be greater than minimum shift hours')
      }
    }

    // Validate date range - effectiveTo must be after effectiveFrom
    if (body.effectiveTo !== undefined) {
      const effectiveFrom = new Date(body.effectiveFrom)
      const effectiveTo = new Date(body.effectiveTo)
      
      if (effectiveTo <= effectiveFrom) {
        validator.addError('effectiveTo', 'Effective end date must be after effective start date')
      }
    }

    if (!validator.isValid()) {
      return NextResponse.json(
        {
          errors: validator.getErrors(),
          message: 'Invalid pay guide data',
        } as ApiValidationResponse,
        { status: 400 }
      )
    }

    // Check for unique name
    const existingPayGuide = await prisma.payGuide.findUnique({
      where: { name: body.name },
    })

    if (existingPayGuide) {
      return NextResponse.json(
        {
          errors: [
            {
              field: 'name',
              message: 'A pay guide with this name already exists',
            },
          ],
          message: 'Duplicate pay guide name',
        } as ApiValidationResponse,
        { status: 400 }
      )
    }

    // Create the pay guide
    const payGuide = await prisma.payGuide.create({
      data: {
        name: body.name,
        baseRate: new Decimal(body.baseRate),
        minimumShiftHours: body.minimumShiftHours,
        maximumShiftHours: body.maximumShiftHours,
        description: body.description,
        effectiveFrom: new Date(body.effectiveFrom),
        effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : null,
        timezone: body.timezone,
        isActive: body.isActive !== undefined ? body.isActive : true,
      },
      include: {
        penaltyTimeFrames: true,
      },
    })

    // Transform to response format
    const responsePayGuide: PayGuideResponse = {
      id: payGuide.id,
      name: payGuide.name,
      baseRate: payGuide.baseRate.toString(),
      minimumShiftHours: payGuide.minimumShiftHours,
      maximumShiftHours: payGuide.maximumShiftHours,
      description: payGuide.description,
      effectiveFrom: payGuide.effectiveFrom,
      effectiveTo: payGuide.effectiveTo,
      timezone: payGuide.timezone,
      isActive: payGuide.isActive,
      createdAt: payGuide.createdAt,
      updatedAt: payGuide.updatedAt,
    }

    return NextResponse.json(
      { data: responsePayGuide, message: 'Pay guide created successfully' },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating pay guide:', error)
    return NextResponse.json(
      { error: 'Failed to create pay guide' },
      { status: 500 }
    )
  }
}
