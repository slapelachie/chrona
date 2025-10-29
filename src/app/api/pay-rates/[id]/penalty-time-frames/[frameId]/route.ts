import { NextRequest, NextResponse } from 'next/server'
import { Decimal } from 'decimal.js'
import { prisma } from '@/lib/db'
import { UpdatePenaltyTimeFrameRequest, ApiValidationResponse } from '@/types'
import { ValidationResult, validateCuid } from '@/lib/validation'
import { validatePenaltyTimeFrameFields } from '@/lib/penalty-time-frame-validation'
import { getPayGuide } from '@/lib/pay-guide-utils'
import { transformPenaltyTimeFrameToResponse } from '@/lib/penalty-time-frame-utils'

interface RouteParams {
  params: Promise<{
    id: string
    frameId: string
  }>
}

// GET /api/pay-rates/[id]/penalty-time-frames/[frameId] - Get specific penalty time frame
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, frameId } = await params

    // Validate IDs
    const validator = ValidationResult.create()
    validateCuid(id, 'id', validator)
    validateCuid(frameId, 'frameId', validator)

    if (!validator.isValid()) {
      return NextResponse.json({
        errors: validator.getErrors(),
        message: 'Invalid ID format'
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

    // Fetch penalty time frame
    const penaltyTimeFrame = await prisma.penaltyTimeFrame.findUnique({
      where: { id: frameId }
    })

    if (!penaltyTimeFrame) {
      return NextResponse.json(
        { error: 'Penalty time frame not found' },
        { status: 404 }
      )
    }

    // Verify penalty time frame belongs to pay guide
    if (penaltyTimeFrame.payGuideId !== id) {
      return NextResponse.json(
        { error: 'Penalty time frame does not belong to the specified pay guide' },
        { status: 404 }
      )
    }

    // Transform to response format
    const response = transformPenaltyTimeFrameToResponse(penaltyTimeFrame)

    return NextResponse.json({ data: response })

  } catch (error) {
    console.error('Error fetching penalty time frame:', error)
    return NextResponse.json(
      { error: 'Failed to fetch penalty time frame' },
      { status: 500 }
    )
  }
}

// PUT /api/pay-rates/[id]/penalty-time-frames/[frameId] - Update specific penalty time frame
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, frameId } = await params
    const body: UpdatePenaltyTimeFrameRequest = await request.json()

    // Validate IDs
    const validator = ValidationResult.create()
    validateCuid(id, 'id', validator)
    validateCuid(frameId, 'frameId', validator)

    if (!validator.isValid()) {
      return NextResponse.json({
        errors: validator.getErrors(),
        message: 'Invalid ID format'
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

    // Check if penalty time frame exists
    const existingPenaltyTimeFrame = await prisma.penaltyTimeFrame.findUnique({
      where: { id: frameId }
    })

    if (!existingPenaltyTimeFrame) {
      return NextResponse.json(
        { error: 'Penalty time frame not found' },
        { status: 404 }
      )
    }

    // Verify penalty time frame belongs to pay guide
    if (existingPenaltyTimeFrame.payGuideId !== id) {
      return NextResponse.json(
        { error: 'Penalty time frame does not belong to the specified pay guide' },
        { status: 404 }
      )
    }

    // Validate request body fields that are provided
    validatePenaltyTimeFrameFields(body, validator, true)

    if (!validator.isValid()) {
      return NextResponse.json({
        errors: validator.getErrors(),
        message: 'Invalid penalty time frame data'
      } as ApiValidationResponse, { status: 400 })
    }

    // Build update data
    const updateData: any = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.multiplier !== undefined) updateData.multiplier = new Decimal(body.multiplier)
    if (body.dayOfWeek !== undefined) updateData.dayOfWeek = body.dayOfWeek
    if (body.isPublicHoliday !== undefined) updateData.isPublicHoliday = body.isPublicHoliday
    if (body.startTime !== undefined) updateData.startTime = body.startTime
    if (body.endTime !== undefined) updateData.endTime = body.endTime
    if (body.description !== undefined) updateData.description = body.description
    if (body.isActive !== undefined) updateData.isActive = body.isActive

    // Update the penalty time frame
    const updatedPenaltyTimeFrame = await prisma.penaltyTimeFrame.update({
      where: { id: frameId },
      data: updateData
    })

    // Transform to response format
    const response = transformPenaltyTimeFrameToResponse(updatedPenaltyTimeFrame)

    return NextResponse.json({
      data: response,
      message: 'Penalty time frame updated successfully'
    })

  } catch (error) {
    console.error('Error updating penalty time frame:', error)
    return NextResponse.json(
      { error: 'Failed to update penalty time frame' },
      { status: 500 }
    )
  }
}

// DELETE /api/pay-rates/[id]/penalty-time-frames/[frameId] - Delete specific penalty time frame
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, frameId } = await params

    // Validate IDs
    const validator = ValidationResult.create()
    validateCuid(id, 'id', validator)
    validateCuid(frameId, 'frameId', validator)

    if (!validator.isValid()) {
      return NextResponse.json({
        errors: validator.getErrors(),
        message: 'Invalid ID format'
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

    // Check if penalty time frame exists
    const existingPenaltyTimeFrame = await prisma.penaltyTimeFrame.findUnique({
      where: { id: frameId }
    })

    if (!existingPenaltyTimeFrame) {
      return NextResponse.json(
        { error: 'Penalty time frame not found' },
        { status: 404 }
      )
    }

    // Verify penalty time frame belongs to pay guide
    if (existingPenaltyTimeFrame.payGuideId !== id) {
      return NextResponse.json(
        { error: 'Penalty time frame does not belong to the specified pay guide' },
        { status: 404 }
      )
    }

    // Delete the penalty time frame
    await prisma.penaltyTimeFrame.delete({
      where: { id: frameId }
    })

    return NextResponse.json({
      message: 'Penalty time frame deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting penalty time frame:', error)
    return NextResponse.json(
      { error: 'Failed to delete penalty time frame' },
      { status: 500 }
    )
  }
}
