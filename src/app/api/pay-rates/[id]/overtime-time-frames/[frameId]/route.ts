import { NextRequest, NextResponse } from 'next/server'
import { Decimal } from 'decimal.js'
import { prisma } from '@/lib/db'
import { UpdateOvertimeTimeFrameRequest, OvertimeTimeFrameResponse, ApiValidationResponse } from '@/types'
import { ValidationResult, validateCuid } from '@/lib/validation'
import { validateOvertimeTimeFrameFields } from '@/lib/overtime-time-frame-validation'
import { getPayGuide } from '@/lib/pay-guide-utils'
import { transformOvertimeTimeFrameToResponse } from '@/lib/overtime-time-frame-utils'

interface RouteParams {
  params: Promise<{
    id: string
    frameId: string
  }>
}

// GET /api/pay-rates/[id]/overtime-time-frames/[frameId] - Get specific overtime time frame
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

    // Fetch overtime time frame
    const overtimeTimeFrame = await prisma.overtimeTimeFrame.findUnique({
      where: { id: frameId }
    })

    if (!overtimeTimeFrame) {
      return NextResponse.json(
        { error: 'Overtime time frame not found' },
        { status: 404 }
      )
    }

    // Verify overtime time frame belongs to pay guide
    if (overtimeTimeFrame.payGuideId !== id) {
      return NextResponse.json(
        { error: 'Overtime time frame does not belong to the specified pay guide' },
        { status: 404 }
      )
    }

    // Transform to response format
    const response = transformOvertimeTimeFrameToResponse(overtimeTimeFrame)

    return NextResponse.json({ data: response })

  } catch (error) {
    console.error('Error fetching overtime time frame:', error)
    return NextResponse.json(
      { error: 'Failed to fetch overtime time frame' },
      { status: 500 }
    )
  }
}

// PUT /api/pay-rates/[id]/overtime-time-frames/[frameId] - Update specific overtime time frame
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, frameId } = await params
    const body: UpdateOvertimeTimeFrameRequest = await request.json()

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

    // Check if overtime time frame exists
    const existingOvertimeTimeFrame = await prisma.overtimeTimeFrame.findUnique({
      where: { id: frameId }
    })

    if (!existingOvertimeTimeFrame) {
      return NextResponse.json(
        { error: 'Overtime time frame not found' },
        { status: 404 }
      )
    }

    // Verify overtime time frame belongs to pay guide
    if (existingOvertimeTimeFrame.payGuideId !== id) {
      return NextResponse.json(
        { error: 'Overtime time frame does not belong to the specified pay guide' },
        { status: 404 }
      )
    }

    // Validate request body fields that are provided
    validateOvertimeTimeFrameFields(body, validator, true)

    if (!validator.isValid()) {
      return NextResponse.json({
        errors: validator.getErrors(),
        message: 'Invalid overtime time frame data'
      } as ApiValidationResponse, { status: 400 })
    }

    // Build update data
    const updateData: any = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.firstThreeHoursMult !== undefined) updateData.firstThreeHoursMult = new Decimal(body.firstThreeHoursMult)
    if (body.afterThreeHoursMult !== undefined) updateData.afterThreeHoursMult = new Decimal(body.afterThreeHoursMult)
    if (body.dayOfWeek !== undefined) updateData.dayOfWeek = body.dayOfWeek
    if (body.isPublicHoliday !== undefined) updateData.isPublicHoliday = body.isPublicHoliday
    if (body.startTime !== undefined) updateData.startTime = body.startTime
    if (body.endTime !== undefined) updateData.endTime = body.endTime
    if (body.description !== undefined) updateData.description = body.description
    if (body.isActive !== undefined) updateData.isActive = body.isActive

    // Update the overtime time frame
    const updatedOvertimeTimeFrame = await prisma.overtimeTimeFrame.update({
      where: { id: frameId },
      data: updateData
    })

    // Transform to response format
    const response = transformOvertimeTimeFrameToResponse(updatedOvertimeTimeFrame)

    return NextResponse.json({
      data: response,
      message: 'Overtime time frame updated successfully'
    })

  } catch (error) {
    console.error('Error updating overtime time frame:', error)
    return NextResponse.json(
      { error: 'Failed to update overtime time frame' },
      { status: 500 }
    )
  }
}

// DELETE /api/pay-rates/[id]/overtime-time-frames/[frameId] - Delete specific overtime time frame
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

    // Check if overtime time frame exists
    const existingOvertimeTimeFrame = await prisma.overtimeTimeFrame.findUnique({
      where: { id: frameId }
    })

    if (!existingOvertimeTimeFrame) {
      return NextResponse.json(
        { error: 'Overtime time frame not found' },
        { status: 404 }
      )
    }

    // Verify overtime time frame belongs to pay guide
    if (existingOvertimeTimeFrame.payGuideId !== id) {
      return NextResponse.json(
        { error: 'Overtime time frame does not belong to the specified pay guide' },
        { status: 404 }
      )
    }

    // Delete the overtime time frame
    await prisma.overtimeTimeFrame.delete({
      where: { id: frameId }
    })

    return NextResponse.json({
      message: 'Overtime time frame deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting overtime time frame:', error)
    return NextResponse.json(
      { error: 'Failed to delete overtime time frame' },
      { status: 500 }
    )
  }
}