import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { payRateSchema } from '@/types'
import { z } from 'zod'

// GET /api/pay-rates - Get all pay rates
export async function GET() {
  try {
    const payRates = await prisma.payRate.findMany({
      orderBy: [
        { isDefault: 'desc' }, // Default rates first
        { effectiveFrom: 'desc' }, // Most recent first
        { name: 'asc' }
      ]
    })

    return NextResponse.json(payRates)
  } catch (error) {
    console.error('Failed to fetch pay rates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pay rates' },
      { status: 500 }
    )
  }
}

// POST /api/pay-rates - Create new pay rate
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate the request body
    const validatedData = payRateSchema.parse(body)
    
    // Convert number fields to Decimal for Prisma
    const createData = {
      ...validatedData,
      baseRate: String(validatedData.baseRate),
      multiplier: String(validatedData.multiplier),
      overtimeThreshold: validatedData.overtimeThreshold ? String(validatedData.overtimeThreshold) : null,
      overtimeMultiplier: validatedData.overtimeMultiplier ? String(validatedData.overtimeMultiplier) : null,
    }

    // If this is set as default, unset any existing default rates of the same type
    if (validatedData.isDefault) {
      await prisma.payRate.updateMany({
        where: {
          rateType: validatedData.rateType,
          isDefault: true,
        },
        data: { isDefault: false }
      })
    }

    const newPayRate = await prisma.payRate.create({
      data: createData,
    })

    return NextResponse.json(newPayRate, { status: 201 })
  } catch (error) {
    console.error('Failed to create pay rate:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create pay rate' },
      { status: 500 }
    )
  }
}