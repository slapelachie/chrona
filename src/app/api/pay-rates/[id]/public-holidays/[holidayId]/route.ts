import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { UpdatePublicHolidayRequest, PublicHolidayResponse, ApiValidationResponse } from '@/types'
import { ValidationResult, validateCuid } from '@/lib/validation'
import { validatePublicHolidayFields } from '@/lib/public-holiday-validation'
import { getPayGuide } from '@/lib/pay-guide-utils'
import { transformPublicHolidayToResponse } from '@/lib/public-holiday-utils'

interface RouteParams {
  params: Promise<{
    id: string
    holidayId: string
  }>
}

// GET /api/pay-rates/[id]/public-holidays/[holidayId] - Get specific public holiday
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, holidayId } = await params

    // Validate IDs
    const validator = ValidationResult.create()
    validateCuid(id, 'id', validator)
    validateCuid(holidayId, 'holidayId', validator)

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

    // Fetch public holiday
    const publicHoliday = await prisma.publicHoliday.findUnique({
      where: { id: holidayId }
    })

    if (!publicHoliday) {
      return NextResponse.json(
        { error: 'Public holiday not found' },
        { status: 404 }
      )
    }

    // Verify public holiday belongs to pay guide
    if (publicHoliday.payGuideId !== id) {
      return NextResponse.json(
        { error: 'Public holiday does not belong to the specified pay guide' },
        { status: 404 }
      )
    }

    // Transform to response format
    const response = transformPublicHolidayToResponse(publicHoliday)

    return NextResponse.json({ data: response })

  } catch (error) {
    console.error('Error fetching public holiday:', error)
    return NextResponse.json(
      { error: 'Failed to fetch public holiday' },
      { status: 500 }
    )
  }
}

// PUT /api/pay-rates/[id]/public-holidays/[holidayId] - Update specific public holiday
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, holidayId } = await params
    const body: UpdatePublicHolidayRequest = await request.json()

    // Validate IDs
    const validator = ValidationResult.create()
    validateCuid(id, 'id', validator)
    validateCuid(holidayId, 'holidayId', validator)

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

    // Check if public holiday exists
    const existingPublicHoliday = await prisma.publicHoliday.findUnique({
      where: { id: holidayId }
    })

    if (!existingPublicHoliday) {
      return NextResponse.json(
        { error: 'Public holiday not found' },
        { status: 404 }
      )
    }

    // Verify public holiday belongs to pay guide
    if (existingPublicHoliday.payGuideId !== id) {
      return NextResponse.json(
        { error: 'Public holiday does not belong to the specified pay guide' },
        { status: 404 }
      )
    }

    // Validate request body fields that are provided
    validatePublicHolidayFields(body, validator, true)

    if (!validator.isValid()) {
      return NextResponse.json({
        errors: validator.getErrors(),
        message: 'Invalid public holiday data'
      } as ApiValidationResponse, { status: 400 })
    }

    // Check for duplicate public holiday on same date for same pay guide (if date is being updated)
    if (body.date && body.date !== existingPublicHoliday.date.toISOString().split('T')[0]) {
      const existingHolidayOnDate = await prisma.publicHoliday.findFirst({
        where: {
          payGuideId: id,
          date: new Date(body.date),
          id: { not: holidayId } // Exclude current record from duplicate check
        }
      })

      if (existingHolidayOnDate) {
        return NextResponse.json({
          errors: [{ field: 'date', message: 'A public holiday already exists for this date on this pay guide' }],
          message: 'Duplicate public holiday'
        } as ApiValidationResponse, { status: 400 })
      }
    }

    // Build update data
    const updateData: any = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.date !== undefined) updateData.date = new Date(body.date)
    if (body.isActive !== undefined) updateData.isActive = body.isActive

    // Update the public holiday
    const updatedPublicHoliday = await prisma.publicHoliday.update({
      where: { id: holidayId },
      data: updateData
    })

    // Transform to response format
    const response = transformPublicHolidayToResponse(updatedPublicHoliday)

    return NextResponse.json({
      data: response,
      message: 'Public holiday updated successfully'
    })

  } catch (error) {
    console.error('Error updating public holiday:', error)
    return NextResponse.json(
      { error: 'Failed to update public holiday' },
      { status: 500 }
    )
  }
}

// DELETE /api/pay-rates/[id]/public-holidays/[holidayId] - Delete specific public holiday
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, holidayId } = await params

    // Validate IDs
    const validator = ValidationResult.create()
    validateCuid(id, 'id', validator)
    validateCuid(holidayId, 'holidayId', validator)

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

    // Check if public holiday exists
    const existingPublicHoliday = await prisma.publicHoliday.findUnique({
      where: { id: holidayId }
    })

    if (!existingPublicHoliday) {
      return NextResponse.json(
        { error: 'Public holiday not found' },
        { status: 404 }
      )
    }

    // Verify public holiday belongs to pay guide
    if (existingPublicHoliday.payGuideId !== id) {
      return NextResponse.json(
        { error: 'Public holiday does not belong to the specified pay guide' },
        { status: 404 }
      )
    }

    // Delete the public holiday
    await prisma.publicHoliday.delete({
      where: { id: holidayId }
    })

    return NextResponse.json({
      message: 'Public holiday deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting public holiday:', error)
    return NextResponse.json(
      { error: 'Failed to delete public holiday' },
      { status: 500 }
    )
  }
}