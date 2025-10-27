import { NextRequest, NextResponse } from 'next/server'
import { Decimal } from 'decimal.js'
import { prisma } from '@/lib/db'
import { CreateOvertimeTimeFrameRequest, OvertimeTimeFrameResponse, ApiValidationResponse } from '@/types'
import { ValidationResult, validateCuid } from '@/lib/validation'
import { validateOvertimeTimeFrameFields } from '@/lib/overtime-time-frame-validation'
import { getPayGuide } from '@/lib/pay-guide-utils'
import { transformOvertimeTimeFrameToResponse } from '@/lib/overtime-time-frame-utils'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

// GET /api/pay-rates/[id]/overtime-time-frames - Get overtime time frames for pay guide
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

    // Fetch overtime time frames for the pay guide
    const overtimeTimeFrames = await prisma.overtimeTimeFrame.findMany({
      where: { payGuideId: id },
      orderBy: { createdAt: 'asc' }
    })

    // Transform to response format
    const responseOvertimeTimeFrames = overtimeTimeFrames.map(transformOvertimeTimeFrameToResponse)

    return NextResponse.json({ 
      data: responseOvertimeTimeFrames,
      message: `Found ${responseOvertimeTimeFrames.length} overtime time frames`
    })

  } catch (error) {
    console.error('Error fetching overtime time frames:', error)
    return NextResponse.json(
      { error: 'Failed to fetch overtime time frames' },
      { status: 500 }
    )
  }
}

// POST /api/pay-rates/[id]/overtime-time-frames - Create new overtime time frame for pay guide
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body: CreateOvertimeTimeFrameRequest = await request.json()

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
    validateOvertimeTimeFrameFields(body, validator)

    if (!validator.isValid()) {
      return NextResponse.json({
        errors: validator.getErrors(),
        message: 'Invalid overtime time frame data'
      } as ApiValidationResponse, { status: 400 })
    }

    // Create the overtime time frame
    const overtimeTimeFrame = await prisma.overtimeTimeFrame.create({
      data: {
        payGuideId: id,
        name: body.name,
        firstThreeHoursMult: new Decimal(body.firstThreeHoursMult),
        afterThreeHoursMult: new Decimal(body.afterThreeHoursMult),
        dayOfWeek: body.dayOfWeek ?? null,
        isPublicHoliday: body.isPublicHoliday || false,
        startTime: body.startTime || null,
        endTime: body.endTime || null,
        description: body.description || null,
        isActive: body.isActive !== undefined ? body.isActive : true
      }
    })

    // Transform to response format
    const responseOvertimeTimeFrame = transformOvertimeTimeFrameToResponse(overtimeTimeFrame)

    return NextResponse.json({
      data: responseOvertimeTimeFrame,
      message: 'Overtime time frame created successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating overtime time frame:', error)
    return NextResponse.json(
      { error: 'Failed to create overtime time frame' },
      { status: 500 }
    )
  }
}
