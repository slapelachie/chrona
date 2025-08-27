import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { shiftSchema } from '@/types'
import { calculateShiftPay } from '@/lib/pay-calculations'
import { z } from 'zod'

const bulkCreateSchema = z.object({
  shifts: z.array(shiftSchema),
})

const bulkUpdateSchema = z.object({
  shifts: z.array(
    shiftSchema.extend({
      id: z.string(),
    })
  ),
})

const bulkDeleteSchema = z.object({
  shiftIds: z.array(z.string()),
})

const recurringShiftSchema = z.object({
  shift: shiftSchema,
  pattern: z.object({
    type: z.enum(['daily', 'weekly', 'monthly']),
    interval: z.number().min(1), // every N days/weeks/months
    endDate: z.date(),
    daysOfWeek: z.array(z.number().min(0).max(6)).optional(), // For weekly patterns
  }),
})

// POST /api/shifts/bulk - Bulk operations
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { operation } = body

    switch (operation) {
      case 'create':
        return await handleBulkCreate(body)
      case 'update':
        return await handleBulkUpdate(body)
      case 'delete':
        return await handleBulkDelete(body)
      case 'recurring':
        return await handleRecurringShift(body)
      default:
        return NextResponse.json(
          { error: 'Invalid operation. Must be create, update, delete, or recurring' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error in bulk operation:', error)
    return NextResponse.json(
      { error: 'Failed to perform bulk operation' },
      { status: 500 }
    )
  }
}

async function handleBulkCreate(body: any) {
  const validatedData = bulkCreateSchema.parse(body)

  // Calculate all shifts first
  const shiftCalculations = await Promise.all(
    validatedData.shifts.map(async (shift) => {
      const shiftDetails = {
        date: shift.date,
        startTime: shift.startTime,
        endTime: shift.endTime,
        breakTime: shift.breakTime,
        isPublicHoliday: shift.isPublicHoliday,
      }

      const calculation = await calculateShiftPay(shiftDetails)

      return {
        date: shift.date,
        startTime: shift.startTime,
        endTime: shift.endTime,
        breakTime: shift.breakTime,
        payRateId: shift.payRateId,
        hourlyRate: calculation.hourlyRate,
        hoursWorked: calculation.hoursWorked,
        regularHours: calculation.regularHours,
        overtimeHours: calculation.overtimeHours,
        penaltyHours: calculation.penaltyHours,
        grossPay: calculation.grossPay,
        isPublicHoliday: shift.isPublicHoliday,
        isNightShift: calculation.isNightShift,
        notes: shift.notes,
      }
    })
  )

  // Create all shifts in a transaction
  const createdShifts = await prisma.shift.createMany({
    data: shiftCalculations,
  })

  return NextResponse.json({
    success: true,
    count: createdShifts.count,
  })
}

async function handleBulkUpdate(body: any) {
  const validatedData = bulkUpdateSchema.parse(body)

  const updatePromises = validatedData.shifts.map(async (shift) => {
    const shiftDetails = {
      date: shift.date,
      startTime: shift.startTime,
      endTime: shift.endTime,
      breakTime: shift.breakTime,
      isPublicHoliday: shift.isPublicHoliday,
    }

    const calculation = await calculateShiftPay(shiftDetails)

    return prisma.shift.update({
      where: { id: shift.id },
      data: {
        date: shift.date,
        startTime: shift.startTime,
        endTime: shift.endTime,
        breakTime: shift.breakTime,
        payRateId: shift.payRateId,
        hourlyRate: calculation.hourlyRate,
        hoursWorked: calculation.hoursWorked,
        regularHours: calculation.regularHours,
        overtimeHours: calculation.overtimeHours,
        penaltyHours: calculation.penaltyHours,
        grossPay: calculation.grossPay,
        isPublicHoliday: shift.isPublicHoliday,
        isNightShift: calculation.isNightShift,
        notes: shift.notes,
      },
    })
  })

  await Promise.all(updatePromises)

  return NextResponse.json({
    success: true,
    count: validatedData.shifts.length,
  })
}

async function handleBulkDelete(body: any) {
  const validatedData = bulkDeleteSchema.parse(body)

  const deletedShifts = await prisma.shift.deleteMany({
    where: {
      id: {
        in: validatedData.shiftIds,
      },
    },
  })

  return NextResponse.json({
    success: true,
    count: deletedShifts.count,
  })
}

async function handleRecurringShift(body: any) {
  // Parse and convert date strings to Date objects
  const bodyWithDates = {
    ...body,
    shift: {
      ...body.shift,
      date: new Date(body.shift.date),
      startTime: new Date(body.shift.startTime),
      endTime: new Date(body.shift.endTime),
    },
    pattern: {
      ...body.pattern,
      endDate: new Date(body.pattern.endDate),
    }
  }
  const validatedData = recurringShiftSchema.parse(bodyWithDates)
  const { shift, pattern } = validatedData

  const shifts: any[] = []
  let currentDate = new Date(shift.date)

  while (currentDate <= pattern.endDate) {
    // Check if this date should be included based on pattern
    let shouldInclude = true

    if (pattern.type === 'weekly' && pattern.daysOfWeek) {
      shouldInclude = pattern.daysOfWeek.includes(currentDate.getDay())
    }

    if (shouldInclude) {
      // Create shift for this date
      const shiftDate = new Date(currentDate)
      const startTime = new Date(shift.startTime)
      const endTime = new Date(shift.endTime)

      // Adjust date components while keeping time
      startTime.setFullYear(shiftDate.getFullYear())
      startTime.setMonth(shiftDate.getMonth())
      startTime.setDate(shiftDate.getDate())

      endTime.setFullYear(shiftDate.getFullYear())
      endTime.setMonth(shiftDate.getMonth())
      endTime.setDate(shiftDate.getDate())

      const shiftDetails = {
        date: shiftDate,
        startTime,
        endTime,
        breakTime: shift.breakTime,
        isPublicHoliday: shift.isPublicHoliday,
      }

      const calculation = await calculateShiftPay(shiftDetails)

      shifts.push({
        date: shiftDate,
        startTime,
        endTime,
        breakTime: shift.breakTime,
        payRateId: shift.payRateId,
        hourlyRate: calculation.hourlyRate,
        hoursWorked: calculation.hoursWorked,
        regularHours: calculation.regularHours,
        overtimeHours: calculation.overtimeHours,
        penaltyHours: calculation.penaltyHours,
        grossPay: calculation.grossPay,
        isPublicHoliday: shift.isPublicHoliday,
        isNightShift: calculation.isNightShift,
        notes: shift.notes,
      })
    }

    // Move to next date based on pattern
    switch (pattern.type) {
      case 'daily':
        currentDate.setDate(currentDate.getDate() + pattern.interval)
        break
      case 'weekly':
        currentDate.setDate(currentDate.getDate() + (7 * pattern.interval))
        break
      case 'monthly':
        currentDate.setMonth(currentDate.getMonth() + pattern.interval)
        break
    }
  }

  // Create all shifts
  const createdShifts = await prisma.shift.createMany({
    data: shifts,
  })

  return NextResponse.json({
    success: true,
    count: createdShifts.count,
    shiftsCreated: shifts.length,
  })
}