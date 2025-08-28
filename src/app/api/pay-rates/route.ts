import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import Decimal from 'decimal.js';

// GET /api/pay-rates - List all pay guides for user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const active = searchParams.get('active');

    // In a real app, get userId from authentication
    // For now, get the first user
    const user = await prisma.user.findFirst();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const where: { userId: string; name?: { contains: string; mode: string }; isActive?: boolean } = {
      userId: user.id,
    };

    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive' as const
      };
    }

    if (active !== null && active !== undefined) {
      where.isActive = active === 'true';
    }

    const payGuides = await prisma.payGuide.findMany({
      where,
      orderBy: [
        { isActive: 'desc' },
        { updatedAt: 'desc' }
      ]
    });

    return NextResponse.json(payGuides);
  } catch (error) {
    console.error('Error fetching pay guides:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pay guides' },
      { status: 500 }
    );
  }
}

// POST /api/pay-rates - Create new pay guide
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // In a real app, get userId from authentication
    const user = await prisma.user.findFirst();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Validate required fields
    const requiredFields = ['name', 'baseHourlyRate', 'effectiveFrom'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `${field} is required` },
          { status: 400 }
        );
      }
    }

    // Validate numeric fields
    if (isNaN(parseFloat(body.baseHourlyRate)) || parseFloat(body.baseHourlyRate) <= 0) {
      return NextResponse.json(
        { error: 'Base hourly rate must be a positive number' },
        { status: 400 }
      );
    }

    const payGuideData = {
      name: body.name,
      effectiveFrom: new Date(body.effectiveFrom),
      effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : null,
      isActive: body.isActive ?? true,
      userId: user.id,
      
      // Pay rates
      baseHourlyRate: new Decimal(body.baseHourlyRate),
      casualLoading: new Decimal(body.casualLoading ?? 0.25),
      overtimeRate1_5x: new Decimal(body.overtimeRate1_5x ?? 1.5),
      overtimeRate2x: new Decimal(body.overtimeRate2x ?? 2.0),
      
      // Penalty rates
      eveningPenalty: new Decimal(body.eveningPenalty ?? 1.15),
      nightPenalty: new Decimal(body.nightPenalty ?? 1.30),
      saturdayPenalty: new Decimal(body.saturdayPenalty ?? 1.25),
      sundayPenalty: new Decimal(body.sundayPenalty ?? 1.75),
      publicHolidayPenalty: new Decimal(body.publicHolidayPenalty ?? 2.50),
      
      // Time boundaries
      eveningStart: body.eveningStart ?? "18:00",
      eveningEnd: body.eveningEnd ?? "22:00",
      nightStart: body.nightStart ?? "22:00",
      nightEnd: body.nightEnd ?? "06:00",
      
      // Overtime thresholds
      dailyOvertimeHours: new Decimal(body.dailyOvertimeHours ?? 8.0),
      weeklyOvertimeHours: new Decimal(body.weeklyOvertimeHours ?? 38.0),
      
      // Penalty combination settings
      allowPenaltyCombination: body.allowPenaltyCombination ?? true,
      penaltyCombinationRules: body.penaltyCombinationRules ? JSON.stringify(body.penaltyCombinationRules) : null,
    };

    const payGuide = await prisma.payGuide.create({
      data: payGuideData
    });

    return NextResponse.json(payGuide, { status: 201 });
  } catch (error) {
    console.error('Error creating pay guide:', error);
    return NextResponse.json(
      { error: 'Failed to create pay guide' },
      { status: 500 }
    );
  }
}