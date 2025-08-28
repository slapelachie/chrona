import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { PayCalculator } from '@/lib/calculations/pay-calculator';
import { ShiftType, ShiftStatus } from '@prisma/client';
import { Decimal } from 'decimal.js';

interface ShiftUpdateData {
  startTime?: Date;
  endTime?: Date;
  breakMinutes?: number;
  shiftType?: ShiftType;
  notes?: string;
  location?: string;
  status?: ShiftStatus;
  totalMinutes?: number;
  regularHours?: Decimal;
  overtimeHours?: Decimal;
  penaltyHours?: Decimal;
  grossPay?: Decimal;
  superannuation?: Decimal;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const shift = await prisma.shift.findUnique({
      where: { id },
      include: {
        payGuide: true,
        user: true
      }
    });

    if (!shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
    }

    // Convert Decimal fields to numbers for frontend
    const shiftWithNumbers = {
      ...shift,
      regularHours: shift.regularHours?.toNumber() || null,
      overtimeHours: shift.overtimeHours?.toNumber() || null,
      penaltyHours: shift.penaltyHours?.toNumber() || null,
      grossPay: shift.grossPay?.toNumber() || null,
      superannuation: shift.superannuation?.toNumber() || null
    };

    return NextResponse.json({ shift: shiftWithNumbers });
  } catch (error) {
    console.error('Get shift error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const { startTime, endTime, breakMinutes, shiftType, notes, status, location } = body;

    // Get existing shift
    const { id } = await params;
    const existingShift = await prisma.shift.findUnique({
      where: { id },
      include: { payGuide: true }
    });

    if (!existingShift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
    }

    // Prepare update data
    const updateData: ShiftUpdateData = {};
    
    if (startTime) updateData.startTime = new Date(startTime);
    if (endTime) updateData.endTime = new Date(endTime);
    if (breakMinutes !== undefined) updateData.breakMinutes = breakMinutes;
    if (shiftType) updateData.shiftType = shiftType;
    if (notes !== undefined) updateData.notes = notes;
    if (location !== undefined) updateData.location = location;
    if (status) updateData.status = status;

    // If time-related fields are being updated, recalculate pay
    if (startTime || endTime || breakMinutes !== undefined) {
      const newStartTime = startTime ? new Date(startTime) : existingShift.startTime;
      const newEndTime = endTime ? new Date(endTime) : existingShift.endTime;
      const newBreakMinutes = breakMinutes !== undefined ? breakMinutes : existingShift.breakMinutes;

      if (newEndTime && newStartTime >= newEndTime) {
        return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 });
      }

      if (newEndTime) {
        // Get public holidays for calculation
        const publicHolidays = await prisma.publicHoliday.findMany({
          where: {
            date: {
              gte: newStartTime,
              lte: newEndTime
            }
          }
        });

        // Recalculate pay
        const payCalculator = new PayCalculator(existingShift.payGuide, publicHolidays);
        const calculation = payCalculator.calculateShift(
          newStartTime,
          newEndTime,
          newBreakMinutes
        );

        updateData.totalMinutes = calculation.totalMinutes;
        updateData.regularHours = calculation.regularHours;
        updateData.overtimeHours = calculation.overtimeHours;
        updateData.penaltyHours = calculation.penaltyHours;
        updateData.grossPay = calculation.grossPay;
        updateData.superannuation = calculation.grossPay.mul(0.11);
      }
    }

    const updatedShift = await prisma.shift.update({
      where: { id },
      data: updateData,
      include: {
        payGuide: true,
        user: true
      }
    });

    // Convert Decimal fields to numbers for frontend
    const updatedShiftWithNumbers = {
      ...updatedShift,
      regularHours: updatedShift.regularHours?.toNumber() || null,
      overtimeHours: updatedShift.overtimeHours?.toNumber() || null,
      penaltyHours: updatedShift.penaltyHours?.toNumber() || null,
      grossPay: updatedShift.grossPay?.toNumber() || null,
      superannuation: updatedShift.superannuation?.toNumber() || null
    };

    return NextResponse.json({ shift: updatedShiftWithNumbers });
  } catch (error) {
    console.error('Update shift error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check if shift exists
    const { id } = await params;
    const existingShift = await prisma.shift.findUnique({
      where: { id }
    });

    if (!existingShift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
    }

    // Remove from pay period first (if exists)
    await prisma.payPeriodShift.deleteMany({
      where: { shiftId: id }
    });

    // Delete the shift
    await prisma.shift.delete({
      where: { id }
    });

    return NextResponse.json({ message: 'Shift deleted successfully' });
  } catch (error) {
    console.error('Delete shift error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}