import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { settingsSchema } from '@/types'
import { z } from 'zod'

// GET /api/settings - Get current settings
export async function GET() {
  try {
    // Get the first (and only) settings record
    const settings = await prisma.settings.findFirst()
    
    if (!settings) {
      return NextResponse.json(
        { error: 'Settings not found. Please run database seed.' },
        { status: 404 }
      )
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Failed to fetch settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

// PUT /api/settings - Update settings
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate the request body
    const validatedData = settingsSchema.parse(body)
    
    // Convert number fields to Decimal for Prisma
    const updateData = {
      ...validatedData,
      hecsDebtAmount: validatedData.hecsDebtAmount ? String(validatedData.hecsDebtAmount) : null,
      hecsThreshold: validatedData.hecsThreshold ? String(validatedData.hecsThreshold) : null,
      hecsRate: validatedData.hecsRate ? String(validatedData.hecsRate) : null,
      extraTaxWithheld: String(validatedData.extraTaxWithheld),
      superRate: String(validatedData.superRate),
    }

    // Get the first settings record to update
    const existingSettings = await prisma.settings.findFirst()
    
    if (!existingSettings) {
      return NextResponse.json(
        { error: 'Settings not found. Please run database seed.' },
        { status: 404 }
      )
    }

    // Update the settings
    const updatedSettings = await prisma.settings.update({
      where: { id: existingSettings.id },
      data: updateData,
    })

    return NextResponse.json(updatedSettings)
  } catch (error) {
    console.error('Failed to update settings:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}