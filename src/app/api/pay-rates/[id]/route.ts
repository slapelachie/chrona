import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { Decimal } from 'decimal.js'
import { UpdatePayGuideRequest, PayGuideResponse, ApiValidationResponse } from '@/types'
import { 
  ValidationResult, 
  validateString, 
  validateDecimal, 
  validateDate,
  validateUUID
} from '@/lib/validation'

interface RouteParams {
  params: {
    id: string
  }
}

// GET /api/pay-rates/[id] - Get specific pay guide
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params

    // Validate pay guide ID
    const validator = ValidationResult.create()
    validateUUID(id, 'id', validator)

    if (!validator.isValid()) {
      return NextResponse.json({
        errors: validator.getErrors(),
        message: 'Invalid pay guide ID'
      } as ApiValidationResponse, { status: 400 })
    }

    // Fetch pay guide with penalty time frames
    const payGuide = await prisma.payGuide.findUnique({
      where: { id },
      include: {
        penaltyTimeFrames: {
          orderBy: { name: 'asc' }
        }
      }
    })

    if (!payGuide) {
      return NextResponse.json(
        { error: 'Pay guide not found' },
        { status: 404 }
      )
    }

    // Transform to response format
    const responsePayGuide: PayGuideResponse = {
      id: payGuide.id,
      name: payGuide.name,
      baseRate: payGuide.baseRate.toString(),
      minimumShiftHours: payGuide.minimumShiftHours,
      maximumShiftHours: payGuide.maximumShiftHours,
      timezone: payGuide.timezone,
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
    }

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
    const { id } = params
    const body: UpdatePayGuideRequest = await request.json()

    // Validate pay guide ID
    const validator = ValidationResult.create()
    validateUUID(id, 'id', validator)

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
    if (body.name !== undefined) {
      validateString(body.name, 'name', validator, { minLength: 3, maxLength: 200 })
    }
    
    if (body.baseRate !== undefined) {
      validateDecimal(body.baseRate, 'baseRate', validator, { 
        min: new Decimal('0.01'), 
        max: new Decimal('1000.00') 
      })
    }
    
    if (body.casualLoading !== undefined) {
      validateDecimal(body.casualLoading, 'casualLoading', validator, { 
        min: new Decimal('0'), 
        max: new Decimal('1.0') 
      })
    }
    
    if (body.effectiveFrom !== undefined) {
      validateDate(body.effectiveFrom, 'effectiveFrom', validator)
    }
    
    if (body.effectiveTo !== undefined) {
      validateDate(body.effectiveTo, 'effectiveTo', validator)
    }
    
    if (body.description !== undefined && body.description !== null) {
      validateString(body.description, 'description', validator, { maxLength: 500 })
    }

    // Validate overtime rules structure if provided
    if (body.overtimeRules !== undefined) {
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
    }

    // Validate effective date range if both are provided
    const effectiveFrom = body.effectiveFrom ? new Date(body.effectiveFrom) : existingPayGuide.effectiveFrom
    const effectiveTo = body.effectiveTo ? new Date(body.effectiveTo) : existingPayGuide.effectiveTo
    
    if (effectiveTo && effectiveTo <= effectiveFrom) {
      validator.addError('effectiveTo', 'Effective to date must be after effective from date')
    }

    if (!validator.isValid()) {
      return NextResponse.json({
        errors: validator.getErrors(),
        message: 'Invalid pay guide data'
      } as ApiValidationResponse, { status: 400 })
    }

    // Check for unique name (if being updated)
    if (body.name && body.name !== existingPayGuide.name) {
      const duplicatePayGuide = await prisma.payGuide.findUnique({
        where: { name: body.name }
      })

      if (duplicatePayGuide) {
        return NextResponse.json({
          errors: [{ field: 'name', message: 'A pay guide with this name already exists' }],
          message: 'Duplicate pay guide name'
        } as ApiValidationResponse, { status: 400 })
      }
    }

    // Build update data
    const updateData: any = {}
    
    if (body.name !== undefined) updateData.name = body.name
    if (body.baseRate !== undefined) updateData.baseRate = new Decimal(body.baseRate)
    if (body.casualLoading !== undefined) updateData.casualLoading = new Decimal(body.casualLoading)
    if (body.overtimeRules !== undefined) updateData.overtimeRules = body.overtimeRules
    if (body.description !== undefined) updateData.description = body.description
    if (body.effectiveFrom !== undefined) updateData.effectiveFrom = new Date(body.effectiveFrom)
    if (body.effectiveTo !== undefined) updateData.effectiveTo = new Date(body.effectiveTo)
    if (body.isActive !== undefined) updateData.isActive = body.isActive

    // Update the pay guide
    const updatedPayGuide = await prisma.payGuide.update({
      where: { id },
      data: updateData,
      include: {
        penaltyTimeFrames: {
          orderBy: { name: 'asc' }
        }
      }
    })

    // Transform to response format
    const responsePayGuide: PayGuideResponse = {
      id: updatedPayGuide.id,
      name: updatedPayGuide.name,
      baseRate: updatedPayGuide.baseRate.toString(),
      casualLoading: updatedPayGuide.casualLoading.toString(),
      overtimeRules: updatedPayGuide.overtimeRules,
      description: updatedPayGuide.description,
      effectiveFrom: updatedPayGuide.effectiveFrom,
      effectiveTo: updatedPayGuide.effectiveTo,
      isActive: updatedPayGuide.isActive,
      createdAt: updatedPayGuide.createdAt,
      updatedAt: updatedPayGuide.updatedAt,
      penaltyTimeFrames: updatedPayGuide.penaltyTimeFrames.map(ptf => ({
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
    }

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
    const { id } = params

    // Validate pay guide ID
    const validator = ValidationResult.create()
    validateUUID(id, 'id', validator)

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