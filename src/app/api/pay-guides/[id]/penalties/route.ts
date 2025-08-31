import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { PenaltyTimeFrameFormData } from '@/types';
import Decimal from 'decimal.js';

// GET /api/pay-guides/[id]/penalties - List all penalty time frames for a pay guide
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: payGuideId } = await params;

    const penalties = await prisma.penaltyTimeFrame.findMany({
      where: {
        payGuideId
      },
      orderBy: [
        { priority: 'desc' },
        { startTime: 'asc' }
      ]
    });

    return NextResponse.json(penalties);
  } catch (error) {
    console.error('Error fetching penalty time frames:', error);
    return NextResponse.json(
      { error: 'Failed to fetch penalty time frames' },
      { status: 500 }
    );
  }
}

// POST /api/pay-guides/[id]/penalties - Create a new penalty time frame
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: payGuideId } = await params;
    const data: PenaltyTimeFrameFormData = await request.json();

    // Validate the pay guide exists
    const payGuide = await prisma.payGuide.findUnique({
      where: { id: payGuideId }
    });

    if (!payGuide) {
      return NextResponse.json(
        { error: 'Pay guide not found' },
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

    // Create the penalty time frame
    const penalty = await prisma.penaltyTimeFrame.create({
      data: {
        payGuideId,
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
    console.error('Error creating penalty time frame:', error);
    return NextResponse.json(
      { error: 'Failed to create penalty time frame' },
      { status: 500 }
    );
  }
}