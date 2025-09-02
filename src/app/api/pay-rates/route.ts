import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { Decimal } from 'decimal.js'
import { 
  CreatePayGuideRequest, 
  PayGuideResponse, 
  PayGuidesListResponse, 
  ApiValidationResponse 
} from '@/types'
import { 
  ValidationResult, 
  validateString, 
  validateDecimal, 
  validateDate 
} from '@/lib/validation'

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
    if (limit < 1 || limit > 100) validator.addError('limit', 'Limit must be between 1 and 100')
    if (!['name', 'baseRate', 'effectiveFrom', 'createdAt'].includes(sortBy)) {
      validator.addError('sortBy', 'Invalid sort field')
    }
    if (!['asc', 'desc'].includes(sortOrder)) {
      validator.addError('sortOrder', 'Sort order must be asc or desc')
    }

    if (!validator.isValid()) {
      return NextResponse.json({
        errors: validator.getErrors(),
        message: 'Invalid query parameters'
      } as ApiValidationResponse, { status: 400 })
    }

    // Build where clause for filtering
    const where: any = {}
    
    if (active !== null) {
      if (active === 'true') where.isActive = true
      if (active === 'false') where.isActive = false
    }

    // Get total count for pagination
    const total = await prisma.payGuide.count({ where })
    
    // Calculate pagination
    const skip = (page - 1) * limit
    const totalPages = Math.ceil(total / limit)

    // Fetch pay guides with penalty time frames
    const payGuides = await prisma.payGuide.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        penaltyTimeFrames: {
          where: { isActive: true },
          orderBy: { name: 'asc' }
        }
      }
    })

    // Transform to response format
    const responsePayGuides: PayGuideResponse[] = payGuides.map(payGuide => ({
      id: payGuide.id,
      name: payGuide.name,
      baseRate: payGuide.baseRate.toString(),
      casualLoading: payGuide.casualLoading.toString(),
      overtimeRules: payGuide.overtimeRules,
      description: payGuide.description,
      effectiveFrom: payGuide.effectiveFrom,
      effectiveTo: payGuide.effectiveTo,
      isActive: payGuide.isActive,
      createdAt: payGuide.createdAt,
      updatedAt: payGuide.updatedAt,
      penaltyTimeFrames: payGuide.penaltyTimeFrames.map(ptf => ({
        id: ptf.id,
        payGuideId: ptf.payGuideId,
        name: ptf.name,
        multiplier: ptf.multiplier.toString(),
        dayOfWeek: ptf.dayOfWeek,
        startTime: ptf.startTime,
        endTime: ptf.endTime,
        isPublicHoliday: ptf.isPublicHoliday,
        description: ptf.description,
        isActive: ptf.isActive,
        createdAt: ptf.createdAt,
        updatedAt: ptf.updatedAt
      }))
    }))

    const response: PayGuidesListResponse = {
      payGuides: responsePayGuides,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
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
    
    validateString(body.name, 'name', validator, { minLength: 3, maxLength: 200 })
    validateDecimal(body.baseRate, 'baseRate', validator, { 
      min: new Decimal('0.01'), 
      max: new Decimal('1000.00') 
    })
    validateDecimal(body.casualLoading, 'casualLoading', validator, { 
      min: new Decimal('0'), 
      max: new Decimal('1.0') 
    })
    validateDate(body.effectiveFrom, 'effectiveFrom', validator)
    
    if (body.description !== undefined) {
      validateString(body.description, 'description', validator, { maxLength: 500 })
    }

    // Validate overtime rules structure
    if (!body.overtimeRules || typeof body.overtimeRules !== 'object') {
      validator.addError('overtimeRules', 'Overtime rules must be an object')
    } else {
      if (body.overtimeRules.daily) {
        const daily = body.overtimeRules.daily
        if (typeof daily.regularHours !== 'number' || daily.regularHours <= 0) {
          validator.addError('overtimeRules.daily.regularHours', 'Regular hours must be a positive number')
        }
        if (typeof daily.firstOvertimeRate !== 'number' || daily.firstOvertimeRate <= 1) {
          validator.addError('overtimeRules.daily.firstOvertimeRate', 'First overtime rate must be greater than 1')
        }
        if (typeof daily.firstOvertimeHours !== 'number' || daily.firstOvertimeHours <= daily.regularHours) {
          validator.addError('overtimeRules.daily.firstOvertimeHours', 'First overtime hours must be greater than regular hours')
        }
        if (typeof daily.secondOvertimeRate !== 'number' || daily.secondOvertimeRate <= daily.firstOvertimeRate) {
          validator.addError('overtimeRules.daily.secondOvertimeRate', 'Second overtime rate must be greater than first overtime rate')
        }
      }
      
      if (body.overtimeRules.weekly) {
        const weekly = body.overtimeRules.weekly
        if (typeof weekly.regularHours !== 'number' || weekly.regularHours <= 0) {
          validator.addError('overtimeRules.weekly.regularHours', 'Weekly regular hours must be a positive number')
        }
        if (typeof weekly.overtimeRate !== 'number' || weekly.overtimeRate <= 1) {
          validator.addError('overtimeRules.weekly.overtimeRate', 'Weekly overtime rate must be greater than 1')
        }
      }
    }

    if (!validator.isValid()) {
      return NextResponse.json({
        errors: validator.getErrors(),
        message: 'Invalid pay guide data'
      } as ApiValidationResponse, { status: 400 })
    }

    // Check for unique name
    const existingPayGuide = await prisma.payGuide.findUnique({
      where: { name: body.name }
    })

    if (existingPayGuide) {
      return NextResponse.json({
        errors: [{ field: 'name', message: 'A pay guide with this name already exists' }],
        message: 'Duplicate pay guide name'
      } as ApiValidationResponse, { status: 400 })
    }

    // Create the pay guide
    const payGuide = await prisma.payGuide.create({
      data: {
        name: body.name,
        baseRate: new Decimal(body.baseRate),
        casualLoading: new Decimal(body.casualLoading),
        overtimeRules: body.overtimeRules,
        description: body.description,
        effectiveFrom: new Date(body.effectiveFrom),
        isActive: true
      },
      include: {
        penaltyTimeFrames: true
      }
    })

    // Transform to response format
    const responsePayGuide: PayGuideResponse = {
      id: payGuide.id,
      name: payGuide.name,
      baseRate: payGuide.baseRate.toString(),
      casualLoading: payGuide.casualLoading.toString(),
      overtimeRules: payGuide.overtimeRules,
      description: payGuide.description,
      effectiveFrom: payGuide.effectiveFrom,
      effectiveTo: payGuide.effectiveTo,
      isActive: payGuide.isActive,
      createdAt: payGuide.createdAt,
      updatedAt: payGuide.updatedAt,
      penaltyTimeFrames: []
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