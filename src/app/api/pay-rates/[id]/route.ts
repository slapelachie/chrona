import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import Decimal from 'decimal.js';

// GET /api/pay-rates/[id] - Get specific pay guide
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  try {
    const payGuide = await prisma.payGuide.findUnique({
      where: {
        id: params.id
      },
      include: {
        user: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!payGuide) {
      return NextResponse.json({ error: 'Pay guide not found' }, { status: 404 });
    }

    return NextResponse.json(payGuide);
  } catch (error) {
    console.error('Error fetching pay guide:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pay guide' },
      { status: 500 }
    );
  }
}

// PUT /api/pay-rates/[id] - Update pay guide
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  try {
    const body = await request.json();

    // Check if pay guide exists
    const existingPayGuide = await prisma.payGuide.findUnique({
      where: { id: params.id }
    });

    if (!existingPayGuide) {
      return NextResponse.json({ error: 'Pay guide not found' }, { status: 404 });
    }

    // Validate numeric fields if provided
    if (body.baseHourlyRate && (isNaN(parseFloat(body.baseHourlyRate)) || parseFloat(body.baseHourlyRate) <= 0)) {
      return NextResponse.json(
        { error: 'Base hourly rate must be a positive number' },
        { status: 400 }
      );
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};

    // Basic fields
    if (body.name !== undefined) updateData.name = body.name;
    if (body.effectiveFrom !== undefined) updateData.effectiveFrom = new Date(body.effectiveFrom);
    if (body.effectiveTo !== undefined) updateData.effectiveTo = body.effectiveTo ? new Date(body.effectiveTo) : null;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    // Pay rates
    if (body.baseHourlyRate !== undefined) updateData.baseHourlyRate = new Decimal(body.baseHourlyRate);
    if (body.casualLoading !== undefined) updateData.casualLoading = new Decimal(body.casualLoading);
    if (body.overtimeRate1_5x !== undefined) updateData.overtimeRate1_5x = new Decimal(body.overtimeRate1_5x);
    if (body.overtimeRate2x !== undefined) updateData.overtimeRate2x = new Decimal(body.overtimeRate2x);

    // Penalty rates
    if (body.eveningPenalty !== undefined) updateData.eveningPenalty = new Decimal(body.eveningPenalty);
    if (body.nightPenalty !== undefined) updateData.nightPenalty = new Decimal(body.nightPenalty);
    if (body.saturdayPenalty !== undefined) updateData.saturdayPenalty = new Decimal(body.saturdayPenalty);
    if (body.sundayPenalty !== undefined) updateData.sundayPenalty = new Decimal(body.sundayPenalty);
    if (body.publicHolidayPenalty !== undefined) updateData.publicHolidayPenalty = new Decimal(body.publicHolidayPenalty);

    // Time boundaries
    if (body.eveningStart !== undefined) updateData.eveningStart = body.eveningStart;
    if (body.eveningEnd !== undefined) updateData.eveningEnd = body.eveningEnd;
    if (body.nightStart !== undefined) updateData.nightStart = body.nightStart;
    if (body.nightEnd !== undefined) updateData.nightEnd = body.nightEnd;

    // Overtime thresholds
    if (body.dailyOvertimeHours !== undefined) updateData.dailyOvertimeHours = new Decimal(body.dailyOvertimeHours);
    if (body.weeklyOvertimeHours !== undefined) updateData.weeklyOvertimeHours = new Decimal(body.weeklyOvertimeHours);

    // Penalty combination settings
    if (body.allowPenaltyCombination !== undefined) updateData.allowPenaltyCombination = body.allowPenaltyCombination;
    if (body.penaltyCombinationRules !== undefined) {
      updateData.penaltyCombinationRules = body.penaltyCombinationRules ? JSON.stringify(body.penaltyCombinationRules) : null;
    }

    const payGuide = await prisma.payGuide.update({
      where: { id: params.id },
      data: updateData
    });

    return NextResponse.json(payGuide);
  } catch (error) {
    console.error('Error updating pay guide:', error);
    return NextResponse.json(
      { error: 'Failed to update pay guide' },
      { status: 500 }
    );
  }
}

// DELETE /api/pay-rates/[id] - Delete pay guide
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  try {
    // Check if pay guide exists
    const existingPayGuide = await prisma.payGuide.findUnique({
      where: { id: params.id },
      include: {
        shifts: {
          select: { id: true }
        }
      }
    });

    if (!existingPayGuide) {
      return NextResponse.json({ error: 'Pay guide not found' }, { status: 404 });
    }

    // Check if pay guide is being used by shifts
    if (existingPayGuide.shifts.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete pay guide that is being used by shifts' },
        { status: 400 }
      );
    }

    await prisma.payGuide.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ message: 'Pay guide deleted successfully' });
  } catch (error) {
    console.error('Error deleting pay guide:', error);
    return NextResponse.json(
      { error: 'Failed to delete pay guide' },
      { status: 500 }
    );
  }
}