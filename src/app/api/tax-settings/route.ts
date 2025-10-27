import { NextRequest, NextResponse } from 'next/server'
import { Decimal } from 'decimal.js'
import { prisma } from '@/lib/db'
import {
  CreateTaxSettingsRequest,
  UpdateTaxSettingsRequest,
  TaxSettingsResponse,
  ApiValidationResponse,
} from '@/types'
import { ValidationResult, validateBoolean } from '@/lib/validation'
import { PayPeriodTaxService } from '@/lib/pay-period-tax-service'

// GET /api/tax-settings - Get user's tax settings
export async function GET(request: NextRequest) {
  try {
    // Get the default user (single user app)
    const user = await prisma.user.findFirst()
    if (!user) {
      return NextResponse.json(
        { error: 'No user found. Please seed the database first.' },
        { status: 400 }
      )
    }

    const taxSettings = await PayPeriodTaxService.getUserTaxSettings(user.id)

    // Transform to response format
    const response: TaxSettingsResponse = {
      id: taxSettings.id,
      userId: taxSettings.userId,
      claimedTaxFreeThreshold: taxSettings.claimedTaxFreeThreshold,
      isForeignResident: taxSettings.isForeignResident,
      hasTaxFileNumber: taxSettings.hasTaxFileNumber,
      medicareExemption: taxSettings.medicareExemption,
      createdAt: taxSettings.createdAt,
      updatedAt: taxSettings.updatedAt,
    }

    return NextResponse.json({ data: response })
  } catch (error) {
    console.error('Error fetching tax settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tax settings' },
      { status: 500 }
    )
  }
}

// POST /api/tax-settings - Create or update user's tax settings
export async function POST(request: NextRequest) {
  try {
    const body: CreateTaxSettingsRequest = await request.json()

    // Validate request body
    const validator = ValidationResult.create()

    if (body.claimedTaxFreeThreshold !== undefined) {
      validateBoolean(body.claimedTaxFreeThreshold, 'claimedTaxFreeThreshold', validator)
    }

    if (body.isForeignResident !== undefined) {
      validateBoolean(body.isForeignResident, 'isForeignResident', validator)
    }

    if (body.hasTaxFileNumber !== undefined) {
      validateBoolean(body.hasTaxFileNumber, 'hasTaxFileNumber', validator)
    }

    if (body.medicareExemption !== undefined) {
      const validExemptions = ['none', 'half', 'full']
      if (!validExemptions.includes(body.medicareExemption)) {
        validator.addError('medicareExemption', 'Medicare exemption must be none, half, or full')
      }
    }

    // hecsHelpRate removed – no validation

    if (!validator.isValid()) {
      return NextResponse.json(
        {
          errors: validator.getErrors(),
          message: 'Invalid tax settings data',
        } as ApiValidationResponse,
        { status: 400 }
      )
    }

    // Get the default user (single user app)
    const user = await prisma.user.findFirst()
    if (!user) {
      return NextResponse.json(
        { error: 'No user found. Please seed the database first.' },
        { status: 400 }
      )
    }

    // Prepare update data
    const updateData: any = {}
    
    if (body.claimedTaxFreeThreshold !== undefined) {
      updateData.claimedTaxFreeThreshold = body.claimedTaxFreeThreshold
    }
    
    if (body.isForeignResident !== undefined) {
      updateData.isForeignResident = body.isForeignResident
    }
    
    if (body.hasTaxFileNumber !== undefined) {
      updateData.hasTaxFileNumber = body.hasTaxFileNumber
    }
    
    if (body.medicareExemption !== undefined) {
      updateData.medicareExemption = body.medicareExemption
    }
    
    // hecsHelpRate removed

    // Update tax settings
    const taxSettings = await PayPeriodTaxService.updateUserTaxSettings(user.id, updateData)

    // Transform to response format
    const response: TaxSettingsResponse = {
      id: taxSettings.id,
      userId: taxSettings.userId,
      claimedTaxFreeThreshold: taxSettings.claimedTaxFreeThreshold,
      isForeignResident: taxSettings.isForeignResident,
      hasTaxFileNumber: taxSettings.hasTaxFileNumber,
      medicareExemption: taxSettings.medicareExemption,
      createdAt: taxSettings.createdAt,
      updatedAt: taxSettings.updatedAt,
    }

    return NextResponse.json(
      { data: response, message: 'Tax settings updated successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error updating tax settings:', error)
    return NextResponse.json(
      { error: 'Failed to update tax settings' },
      { status: 500 }
    )
  }
}

// PUT /api/tax-settings - Update user's tax settings
export async function PUT(request: NextRequest) {
  try {
    const body: UpdateTaxSettingsRequest = await request.json()

    // Validate request body
    const validator = ValidationResult.create()

    if (body.claimedTaxFreeThreshold !== undefined) {
      validateBoolean(body.claimedTaxFreeThreshold, 'claimedTaxFreeThreshold', validator)
    }

    if (body.isForeignResident !== undefined) {
      validateBoolean(body.isForeignResident, 'isForeignResident', validator)
    }

    if (body.hasTaxFileNumber !== undefined) {
      validateBoolean(body.hasTaxFileNumber, 'hasTaxFileNumber', validator)
    }

    if (body.medicareExemption !== undefined) {
      const validExemptions = ['none', 'half', 'full']
      if (!validExemptions.includes(body.medicareExemption)) {
        validator.addError('medicareExemption', 'Medicare exemption must be none, half, or full')
      }
    }

    // hecsHelpRate removed – no validation

    if (!validator.isValid()) {
      return NextResponse.json(
        {
          errors: validator.getErrors(),
          message: 'Invalid tax settings data',
        } as ApiValidationResponse,
        { status: 400 }
      )
    }

    // Get the default user (single user app)
    const user = await prisma.user.findFirst()
    if (!user) {
      return NextResponse.json(
        { error: 'No user found. Please seed the database first.' },
        { status: 400 }
      )
    }

    // Prepare update data
    const updateData: any = {}
    
    if (body.claimedTaxFreeThreshold !== undefined) {
      updateData.claimedTaxFreeThreshold = body.claimedTaxFreeThreshold
    }
    
    if (body.isForeignResident !== undefined) {
      updateData.isForeignResident = body.isForeignResident
    }
    
    if (body.hasTaxFileNumber !== undefined) {
      updateData.hasTaxFileNumber = body.hasTaxFileNumber
    }
    
    if (body.medicareExemption !== undefined) {
      updateData.medicareExemption = body.medicareExemption
    }
    
    // hecsHelpRate removed

    // Update tax settings
    const taxSettings = await PayPeriodTaxService.updateUserTaxSettings(user.id, updateData)

    // Transform to response format
    const response: TaxSettingsResponse = {
      id: taxSettings.id,
      userId: taxSettings.userId,
      claimedTaxFreeThreshold: taxSettings.claimedTaxFreeThreshold,
      isForeignResident: taxSettings.isForeignResident,
      hasTaxFileNumber: taxSettings.hasTaxFileNumber,
      medicareExemption: taxSettings.medicareExemption,
      createdAt: taxSettings.createdAt,
      updatedAt: taxSettings.updatedAt,
    }

    return NextResponse.json(
      { data: response, message: 'Tax settings updated successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error updating tax settings:', error)
    return NextResponse.json(
      { error: 'Failed to update tax settings' },
      { status: 500 }
    )
  }
}
