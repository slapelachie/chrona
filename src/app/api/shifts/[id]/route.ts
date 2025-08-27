import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { shiftSchema } from '@/types'
import { calculateShiftPay } from '@/lib/pay-calculations'
import { z } from 'zod'

// GET /api/shifts/[id] - Get a single shift
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const shift = await prisma.shift.findUnique({
      where: { id },
      include: {
        payRate: true,
      },
    })

    if (!shift) {
      return NextResponse.json(
        { error: 'Shift not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(shift)
  } catch (error) {
    console.error('Error fetching shift:', error)
    return NextResponse.json(
      { error: 'Failed to fetch shift' },
      { status: 500 }
    )
  }
}

// PUT /api/shifts/[id] - Update a shift
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await request.json()
    // Parse and convert date strings to Date objects
    const bodyWithDates = {
      ...body,
      date: new Date(body.date),
      startTime: new Date(body.startTime),
      endTime: new Date(body.endTime),
    }
    const validatedData = shiftSchema.parse(bodyWithDates)

    // Check if shift exists
    const existingShift = await prisma.shift.findUnique({
      where: { id },
    })

    if (!existingShift) {
      return NextResponse.json(
        { error: 'Shift not found' },
        { status: 404 }
      )
    }

    // Recalculate shift details
    const shiftDetails = {
      date: validatedData.date,
      startTime: validatedData.startTime,
      endTime: validatedData.endTime,
      breakTime: validatedData.breakTime,
      isPublicHoliday: validatedData.isPublicHoliday,
    }

    const calculation = await calculateShiftPay(shiftDetails)

    // Update the shift with new calculated values
    const updatedShift = await prisma.shift.update({
      where: { id },
      data: {
        date: validatedData.date,
        startTime: validatedData.startTime,
        endTime: validatedData.endTime,
        breakTime: validatedData.breakTime,
        payRateId: validatedData.payRateId,
        hourlyRate: calculation.hourlyRate,
        hoursWorked: calculation.hoursWorked,
        regularHours: calculation.regularHours,
        overtimeHours: calculation.overtimeHours,
        penaltyHours: calculation.penaltyHours,
        grossPay: calculation.grossPay,
        isPublicHoliday: validatedData.isPublicHoliday,
        isNightShift: calculation.isNightShift,
        notes: validatedData.notes,
      },
      include: {
        payRate: true,
      },
    })

    return NextResponse.json(updatedShift)
  } catch (error) {
    console.error('Error updating shift:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update shift' },
      { status: 500 }
    )
  }
}

// DELETE /api/shifts/[id] - Delete a shift
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    // Check if shift exists
    const existingShift = await prisma.shift.findUnique({
      where: { id },
    })

    if (!existingShift) {
      return NextResponse.json(
        { error: 'Shift not found' },
        { status: 404 }
      )
    }

    await prisma.shift.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting shift:', error)
    return NextResponse.json(
      { error: 'Failed to delete shift' },
      { status: 500 }
    )
  }
}