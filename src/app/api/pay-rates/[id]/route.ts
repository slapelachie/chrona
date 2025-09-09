import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { UpdatePayGuideRequest, PayGuideResponse, ApiValidationResponse } from '@/types'
import { ValidationResult, validateCuid } from '@/lib/validation'
import {
  validatePayGuideFields,
  validateDateRange,
  transformPayGuideToResponse,
} from '@/lib/pay-guide-validation'
import {
  checkPayGuideNameUniqueness,
  buildPayGuideUpdateData,
  getPayGuide,
} from '@/lib/pay-guide-utils'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

// GET /api/pay-rates/[id] - Get specific pay guide
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

    // Fetch pay guide
    const payGuide = await getPayGuide(id)

    if (!payGuide) {
      return NextResponse.json(
        { error: 'Pay guide not found' },
        { status: 404 }
      )
    }

    // Transform to response format
    const responsePayGuide = transformPayGuideToResponse(payGuide)

    return NextResponse.json({ data: responsePayGuide })

  } catch (error) {
    console.error('Error fetching pay guide:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pay guide' },
      { status: 500 }
    )
  }
}

// PUT /api/pay-rates/[id] - Update specific pay guide
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body: UpdatePayGuideRequest = await request.json()

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
    const existingPayGuide = await prisma.payGuide.findUnique({
      where: { id }
    })

    if (!existingPayGuide) {
      return NextResponse.json(
        { error: 'Pay guide not found' },
        { status: 404 }
      )
    }

    // Validate request body fields that are provided
    validatePayGuideFields(body, validator, true)

    // Validate effective date range if both are provided
    const effectiveFrom = body.effectiveFrom || existingPayGuide.effectiveFrom
    const effectiveTo = body.effectiveTo !== undefined ? body.effectiveTo : existingPayGuide.effectiveTo
    
    validateDateRange(effectiveFrom, effectiveTo, validator)

    if (!validator.isValid()) {
      return NextResponse.json({
        errors: validator.getErrors(),
        message: 'Invalid pay guide data'
      } as ApiValidationResponse, { status: 400 })
    }

    // Check for unique name (if being updated)
    if (body.name && body.name !== existingPayGuide.name) {
      const isNameUnique = await checkPayGuideNameUniqueness(body.name, id)
      if (!isNameUnique) {
        return NextResponse.json({
          errors: [{ field: 'name', message: 'A pay guide with this name already exists' }],
          message: 'Duplicate pay guide name'
        } as ApiValidationResponse, { status: 400 })
      }
    }

    // Build update data
    const updateData = buildPayGuideUpdateData(body)

    // Update the pay guide
    const updatedPayGuide = await prisma.payGuide.update({
      where: { id },
      data: updateData
    })

    // Transform to response format
    const responsePayGuide = transformPayGuideToResponse(updatedPayGuide)

    return NextResponse.json({
      data: responsePayGuide,
      message: 'Pay guide updated successfully'
    })

  } catch (error) {
    console.error('Error updating pay guide:', error)
    return NextResponse.json(
      { error: 'Failed to update pay guide' },
      { status: 500 }
    )
  }
}

// DELETE /api/pay-rates/[id] - Delete specific pay guide
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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
    const existingPayGuide = await prisma.payGuide.findUnique({
      where: { id },
      include: {
        shifts: { take: 1 } // Just check if any shifts exist
      }
    })

    if (!existingPayGuide) {
      return NextResponse.json(
        { error: 'Pay guide not found' },
        { status: 404 }
      )
    }

    // Check if pay guide is being used by shifts
    if (existingPayGuide.shifts.length > 0) {
      return NextResponse.json({
        error: 'Cannot delete pay guide that is being used by shifts. Please deactivate it instead.'
      }, { status: 400 })
    }

    // Delete the pay guide (this will cascade delete penalty time frames)
    await prisma.payGuide.delete({
      where: { id }
    })

    return NextResponse.json({
      message: 'Pay guide deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting pay guide:', error)
    return NextResponse.json(
      { error: 'Failed to delete pay guide' },
      { status: 500 }
    )
  }
}