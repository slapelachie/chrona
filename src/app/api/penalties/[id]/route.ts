import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { PenaltyTimeFrameFormData } from '@/types';
import Decimal from 'decimal.js';

// GET /api/penalties/[id] - Get a specific penalty time frame
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const penalty = await prisma.penaltyTimeFrame.findUnique({
      where: { id },
      include: {
        payGuide: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!penalty) {
      return NextResponse.json(
        { error: 'Penalty time frame not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(penalty);
  } catch (error) {
    console.error('Error fetching penalty time frame:', error);
    return NextResponse.json(
      { error: 'Failed to fetch penalty time frame' },
      { status: 500 }
    );
  }
}

// PUT /api/penalties/[id] - Update a penalty time frame
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data: PenaltyTimeFrameFormData = await request.json();

    // Check if penalty exists
    const existingPenalty = await prisma.penaltyTimeFrame.findUnique({
      where: { id }
    });

    if (!existingPenalty) {
      return NextResponse.json(
        { error: 'Penalty time frame not found' },
        { status: 404 }
      );
    }

    // Validate input data
    if (!data.name?.trim()) {
      return NextResponse.json(
        { error: 'Penalty name is required' },
        { status: 400 }
      );
    }

    if (!data.startTime || !data.endTime) {
      return NextResponse.json(
        { error: 'Start time and end time are required' },
        { status: 400 }
      );
    }

    const penaltyRate = new Decimal(data.penaltyRate || '1.0');
    if (penaltyRate.lt(1)) {
      return NextResponse.json(
        { error: 'Penalty rate must be 1.0 or greater' },
        { status: 400 }
      );
    }

    // Update the penalty time frame
    const penalty = await prisma.penaltyTimeFrame.update({
      where: { id },
      data: {
        name: data.name.trim(),
        description: data.description?.trim() || null,
        startTime: data.startTime,
        endTime: data.endTime,
        penaltyRate: penaltyRate,
        dayOfWeek: data.dayOfWeek ?? null,
        priority: data.priority || 0,
        isActive: data.isActive ?? true
      }
    });

    return NextResponse.json(penalty);
  } catch (error) {
    console.error('Error updating penalty time frame:', error);
    return NextResponse.json(
      { error: 'Failed to update penalty time frame' },
      { status: 500 }
    );
  }
}

// DELETE /api/penalties/[id] - Delete a penalty time frame
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Check if penalty exists
    const existingPenalty = await prisma.penaltyTimeFrame.findUnique({
      where: { id }
    });

    if (!existingPenalty) {
      return NextResponse.json(
        { error: 'Penalty time frame not found' },
        { status: 404 }
      );
    }

    // Delete the penalty time frame
    await prisma.penaltyTimeFrame.delete({
      where: { id }
    });

    return NextResponse.json({ message: 'Penalty time frame deleted successfully' });
  } catch (error) {
    console.error('Error deleting penalty time frame:', error);
    return NextResponse.json(
      { error: 'Failed to delete penalty time frame' },
      { status: 500 }
    );
  }
}