import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { CreatePublicHolidayRequest, ApiValidationResponse } from '@/types'
import { ValidationResult, validateCuid } from '@/lib/validation'
import { validatePublicHolidayFields } from '@/lib/public-holiday-validation'
import { getPayGuide } from '@/lib/pay-guide-utils'
import { transformPublicHolidayToResponse } from '@/lib/public-holiday-utils'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

// GET /api/pay-rates/[id]/public-holidays - Get public holidays for pay guide
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    // Validate pay guide ID
    const validator = ValidationResult.create()
    validateCuid(id, 'id', validator)

    if (!validator.isValid()) {
      return NextResponse.json({
        errors: validator.getErrors(),
        message: 'Invalid pay guide ID'
      } as ApiValidationResponse, { status: 400 })
    }

    // Check if pay guide exists
    const payGuide = await getPayGuide(id)
    if (!payGuide) {
      return NextResponse.json(
        { error: 'Pay guide not found' },
        { status: 404 }
      )
    }

    // Fetch public holidays for the pay guide
    const publicHolidays = await prisma.publicHoliday.findMany({
      where: { payGuideId: id },
      orderBy: { date: 'asc' }
    })

    // Transform to response format
    const responsePublicHolidays = publicHolidays.map(transformPublicHolidayToResponse)

    return NextResponse.json({ 
      data: responsePublicHolidays,
      message: `Found ${responsePublicHolidays.length} public holidays`
    })

  } catch (error) {
    console.error('Error fetching public holidays:', error)
    return NextResponse.json(
      { error: 'Failed to fetch public holidays' },
      { status: 500 }
    )
  }
}

// POST /api/pay-rates/[id]/public-holidays - Create new public holiday for pay guide
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body: CreatePublicHolidayRequest = await request.json()

    // Validate pay guide ID
    const validator = ValidationResult.create()
    validateCuid(id, 'id', validator)

    if (!validator.isValid()) {
      return NextResponse.json({
        errors: validator.getErrors(),
        message: 'Invalid pay guide ID'
      } as ApiValidationResponse, { status: 400 })
    }

    // Check if pay guide exists
    const payGuide = await getPayGuide(id)
    if (!payGuide) {
      return NextResponse.json(
        { error: 'Pay guide not found' },
        { status: 404 }
      )
    }

    // Validate request body
    validatePublicHolidayFields(body, validator)

    if (!validator.isValid()) {
      return NextResponse.json({
        errors: validator.getErrors(),
        message: 'Invalid public holiday data'
      } as ApiValidationResponse, { status: 400 })
    }

    // Check for duplicate public holiday on same date for same pay guide
    const existingHoliday = await prisma.publicHoliday.findFirst({
      where: {
        payGuideId: id,
        date: new Date(body.date)
      }
    })

    if (existingHoliday) {
      return NextResponse.json({
        errors: [{ field: 'date', message: 'A public holiday already exists for this date on this pay guide' }],
        message: 'Duplicate public holiday'
      } as ApiValidationResponse, { status: 400 })
    }

    // Create the public holiday
    const publicHoliday = await prisma.publicHoliday.create({
      data: {
        payGuideId: id,
        name: body.name,
        date: new Date(body.date),
        isActive: body.isActive !== undefined ? body.isActive : true
      }
    })

    // Transform to response format
    const responsePublicHoliday = transformPublicHolidayToResponse(publicHoliday)

    return NextResponse.json({
      data: responsePublicHoliday,
      message: 'Public holiday created successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating public holiday:', error)
    return NextResponse.json(
      { error: 'Failed to create public holiday' },
      { status: 500 }
    )
  }
}
