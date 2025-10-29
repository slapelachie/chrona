import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  CreatePayGuideRequest,
  PayGuidesListResponse,
  ApiValidationResponse,
  PayGuideListItem,
} from '@/types'
import { ValidationResult } from '@/lib/validation'
import {
  validatePayGuideFields,
  validateDateRange,
  transformPayGuideToResponse,
} from '@/lib/pay-guide-validation'
import {
  checkPayGuideNameUniqueness,
  createPayGuideData,
} from '@/lib/pay-guide-utils'
import {
  parseIncludeParams,
  parseFieldParams,
  transformPayGuideToListItem,
  applyFieldSelection
} from '@/lib/api-response-utils'

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
    
    // Parse optimization parameters
    const includes = parseIncludeParams(searchParams.get('include') || undefined)
    const fields = parseFieldParams(searchParams.get('fields') || undefined)
    // Only include metadata when specifically requested
    const includeMetadata = includes.has('metadata')

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

    // Transform to lightweight response format
    const responsePayGuides: PayGuideListItem[] = payGuides.map(payGuide => {
      const listItem = transformPayGuideToListItem(payGuide, includeMetadata)
      return fields ? applyFieldSelection(listItem, fields) as PayGuideListItem : listItem
    })

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

    validatePayGuideFields(body, validator, false)
    validateDateRange(body.effectiveFrom, body.effectiveTo, validator)

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
    const isNameUnique = await checkPayGuideNameUniqueness(body.name)
    if (!isNameUnique) {
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
      data: createPayGuideData(body)
    })

    // Transform to response format
    const responsePayGuide = transformPayGuideToResponse(payGuide)

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
