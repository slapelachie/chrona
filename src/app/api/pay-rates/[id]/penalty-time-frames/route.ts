import { NextRequest, NextResponse } from 'next/server'
import { Decimal } from 'decimal.js'
import { prisma } from '@/lib/db'
import { CreatePenaltyTimeFrameRequest, ApiValidationResponse } from '@/types'
import { ValidationResult, validateCuid } from '@/lib/validation'
import { validatePenaltyTimeFrameFields } from '@/lib/penalty-time-frame-validation'
import { getPayGuide } from '@/lib/pay-guide-utils'
import { transformPenaltyTimeFrameToResponse } from '@/lib/penalty-time-frame-utils'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

// GET /api/pay-rates/[id]/penalty-time-frames - Get penalty time frames for pay guide
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

    // Fetch penalty time frames for the pay guide
    const penaltyTimeFrames = await prisma.penaltyTimeFrame.findMany({
      where: { payGuideId: id },
      orderBy: { createdAt: 'asc' }
    })

    // Transform to response format
    const responsePenaltyTimeFrames = penaltyTimeFrames.map(transformPenaltyTimeFrameToResponse)

    return NextResponse.json({ 
      data: responsePenaltyTimeFrames,
      message: `Found ${responsePenaltyTimeFrames.length} penalty time frames`
    })

  } catch (error) {
    console.error('Error fetching penalty time frames:', error)
    return NextResponse.json(
      { error: 'Failed to fetch penalty time frames' },
      { status: 500 }
    )
  }
}

// POST /api/pay-rates/[id]/penalty-time-frames - Create new penalty time frame for pay guide
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body: CreatePenaltyTimeFrameRequest = await request.json()

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
    validatePenaltyTimeFrameFields(body, validator)

    if (!validator.isValid()) {
      return NextResponse.json({
        errors: validator.getErrors(),
        message: 'Invalid penalty time frame data'
      } as ApiValidationResponse, { status: 400 })
    }

    // Create the penalty time frame
    const penaltyTimeFrame = await prisma.penaltyTimeFrame.create({
      data: {
        payGuideId: id,
        name: body.name,
        multiplier: new Decimal(body.multiplier),
        dayOfWeek: body.dayOfWeek ?? null,
        isPublicHoliday: body.isPublicHoliday || false,
        startTime: body.startTime || null,
        endTime: body.endTime || null,
        description: body.description || null,
        isActive: body.isActive !== undefined ? body.isActive : true
      }
    })

    // Transform to response format
    const responsePenaltyTimeFrame = transformPenaltyTimeFrameToResponse(penaltyTimeFrame)

    return NextResponse.json({
      data: responsePenaltyTimeFrame,
      message: 'Penalty time frame created successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating penalty time frame:', error)
    return NextResponse.json(
      { error: 'Failed to create penalty time frame' },
      { status: 500 }
    )
  }
}
