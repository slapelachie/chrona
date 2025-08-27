import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { payRateSchema } from '@/types'
import { z } from 'zod'

// GET /api/pay-rates/[id] - Get specific pay rate
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const payRate = await prisma.payRate.findUnique({
      where: { id }
    })

    if (!payRate) {
      return NextResponse.json(
        { error: 'Pay rate not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(payRate)
  } catch (error) {
    console.error('Failed to fetch pay rate:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pay rate' },
      { status: 500 }
    )
  }
}

// PUT /api/pay-rates/[id] - Update pay rate
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await request.json()
    
    // Validate the request body
    const validatedData = payRateSchema.parse(body)
    
    // Check if pay rate exists
    const existingPayRate = await prisma.payRate.findUnique({
      where: { id }
    })

    if (!existingPayRate) {
      return NextResponse.json(
        { error: 'Pay rate not found' },
        { status: 404 }
      )
    }

    // Convert number fields to Decimal for Prisma
    const updateData = {
      ...validatedData,
      baseRate: String(validatedData.baseRate),
      multiplier: String(validatedData.multiplier),
      overtimeThreshold: validatedData.overtimeThreshold ? String(validatedData.overtimeThreshold) : null,
      overtimeMultiplier: validatedData.overtimeMultiplier ? String(validatedData.overtimeMultiplier) : null,
    }

    // If this is set as default, unset any existing default rates of the same type
    if (validatedData.isDefault && !existingPayRate.isDefault) {
      await prisma.payRate.updateMany({
        where: {
          rateType: validatedData.rateType,
          isDefault: true,
          id: { not: id }
        },
        data: { isDefault: false }
      })
    }

    const updatedPayRate = await prisma.payRate.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(updatedPayRate)
  } catch (error) {
    console.error('Failed to update pay rate:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update pay rate' },
      { status: 500 }
    )
  }
}

// DELETE /api/pay-rates/[id] - Delete pay rate
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    // Check if pay rate exists
    const existingPayRate = await prisma.payRate.findUnique({
      where: { id },
      include: { shifts: { take: 1 } } // Check if any shifts use this rate
    })

    if (!existingPayRate) {
      return NextResponse.json(
        { error: 'Pay rate not found' },
        { status: 404 }
      )
    }

    // Don't allow deletion if rate is used in shifts
    if (existingPayRate.shifts.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete pay rate that is used in shifts' },
        { status: 400 }
      )
    }

    await prisma.payRate.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete pay rate:', error)
    return NextResponse.json(
      { error: 'Failed to delete pay rate' },
      { status: 500 }
    )
  }
}