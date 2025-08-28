import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { PayCalculator } from '@/lib/calculations/pay-calculator';
import { Prisma, ShiftStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = searchParams.get('limit');

    // Get the first user (single-user application)
    const user = await prisma.user.findFirst();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const whereCondition: Prisma.ShiftWhereInput = { userId: user.id };

    if (status && Object.values(ShiftStatus).includes(status as ShiftStatus)) {
      whereCondition.status = status as ShiftStatus;
    }

    if (startDate || endDate) {
      whereCondition.startTime = {};
      if (startDate) whereCondition.startTime.gte = new Date(startDate);
      if (endDate) whereCondition.startTime.lte = new Date(endDate);
    }

    const shifts = await prisma.shift.findMany({
      where: whereCondition,
      include: {
        payGuide: true
      },
      orderBy: { startTime: 'desc' },
      take: limit ? parseInt(limit) : undefined
    });

    // Convert Decimal fields to numbers for frontend
    const shiftsWithNumbers = shifts.map(shift => ({
      ...shift,
      regularHours: shift.regularHours?.toNumber() || null,
      overtimeHours: shift.overtimeHours?.toNumber() || null,
      penaltyHours: shift.penaltyHours?.toNumber() || null,
      grossPay: shift.grossPay?.toNumber() || null,
      superannuation: shift.superannuation?.toNumber() || null
    }));

    return NextResponse.json({ shifts: shiftsWithNumbers });
  } catch (error) {
    console.error('Get shifts error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      startTime,
      endTime,
      breakMinutes = 0,
      shiftType = 'REGULAR',
      notes,
      location
    } = body;

    // Validation
    if (!startTime || !endTime) {
      return NextResponse.json({ error: 'Start time and end time are required' }, { status: 400 });
    }

    const startTimeDate = new Date(startTime);
    const endTimeDate = new Date(endTime);

    if (startTimeDate >= endTimeDate) {
      return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 });
    }

    // Get the first user (single-user application)
    const user = await prisma.user.findFirst({
      include: {
        payGuides: {
          where: { isActive: true },
          take: 1
        }
      }
    });

    if (!user || !user.payGuides[0]) {
      return NextResponse.json({ error: 'User or active pay guide not found' }, { status: 404 });
    }

    const payGuide = user.payGuides[0];

    // Get public holidays for calculation
    const publicHolidays = await prisma.publicHoliday.findMany({
      where: {
        date: {
          gte: startTimeDate,
          lte: endTimeDate
        }
      }
    });

    // Calculate shift pay
    const payCalculator = new PayCalculator(payGuide, publicHolidays);
    const calculation = payCalculator.calculateShift(
      startTimeDate,
      endTimeDate,
      breakMinutes
    );

    // Create the shift with calculated values
    const shift = await prisma.shift.create({
      data: {
        userId: user.id,
        payGuideId: payGuide.id,
        startTime: startTimeDate,
        endTime: endTimeDate,
        breakMinutes,
        shiftType,
        status: 'COMPLETED', // Assume completed shifts for now
        notes,
        location,
        totalMinutes: calculation.totalMinutes,
        regularHours: calculation.regularHours,
        overtimeHours: calculation.overtimeHours,
        penaltyHours: calculation.penaltyHours,
        grossPay: calculation.grossPay,
        superannuation: calculation.grossPay.mul(0.11) // 11% super
      },
      include: {
        payGuide: true
      }
    });

    // Add shift to current pay period
    await addShiftToPayPeriod(shift.id, user.id, startTimeDate);

    // Convert Decimal fields to numbers for frontend
    const shiftWithNumbers = {
      ...shift,
      regularHours: shift.regularHours?.toNumber() || null,
      overtimeHours: shift.overtimeHours?.toNumber() || null,
      penaltyHours: shift.penaltyHours?.toNumber() || null,
      grossPay: shift.grossPay?.toNumber() || null,
      superannuation: shift.superannuation?.toNumber() || null
    };

    return NextResponse.json({ 
      shift: shiftWithNumbers, 
      calculation: {
        ...calculation,
        breakdown: {
          ...calculation.breakdown,
          regularHours: {
            ...calculation.breakdown.regularHours,
            hours: calculation.breakdown.regularHours.hours.toNumber(),
            rate: calculation.breakdown.regularHours.rate.toNumber(),
            amount: calculation.breakdown.regularHours.amount.toNumber()
          },
          overtime1_5x: {
            ...calculation.breakdown.overtime1_5x,
            hours: calculation.breakdown.overtime1_5x.hours.toNumber(),
            rate: calculation.breakdown.overtime1_5x.rate.toNumber(),
            amount: calculation.breakdown.overtime1_5x.amount.toNumber()
          },
          overtime2x: {
            ...calculation.breakdown.overtime2x,
            hours: calculation.breakdown.overtime2x.hours.toNumber(),
            rate: calculation.breakdown.overtime2x.rate.toNumber(),
            amount: calculation.breakdown.overtime2x.amount.toNumber()
          },
          eveningPenalty: {
            ...calculation.breakdown.eveningPenalty,
            hours: calculation.breakdown.eveningPenalty.hours.toNumber(),
            rate: calculation.breakdown.eveningPenalty.rate.toNumber(),
            amount: calculation.breakdown.eveningPenalty.amount.toNumber()
          },
          nightPenalty: {
            ...calculation.breakdown.nightPenalty,
            hours: calculation.breakdown.nightPenalty.hours.toNumber(),
            rate: calculation.breakdown.nightPenalty.rate.toNumber(),
            amount: calculation.breakdown.nightPenalty.amount.toNumber()
          },
          weekendPenalty: {
            ...calculation.breakdown.weekendPenalty,
            hours: calculation.breakdown.weekendPenalty.hours.toNumber(),
            rate: calculation.breakdown.weekendPenalty.rate.toNumber(),
            amount: calculation.breakdown.weekendPenalty.amount.toNumber()
          },
          publicHolidayPenalty: {
            ...calculation.breakdown.publicHolidayPenalty,
            hours: calculation.breakdown.publicHolidayPenalty.hours.toNumber(),
            rate: calculation.breakdown.publicHolidayPenalty.rate.toNumber(),
            amount: calculation.breakdown.publicHolidayPenalty.amount.toNumber()
          },
          casualLoading: {
            ...calculation.breakdown.casualLoading,
            rate: calculation.breakdown.casualLoading.rate.toNumber(),
            amount: calculation.breakdown.casualLoading.amount.toNumber()
          },
          baseRate: calculation.breakdown.baseRate.toNumber()
        }
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Create shift error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function addShiftToPayPeriod(shiftId: string, userId: string, shiftDate: Date) {
  // Find or create pay period for this shift
  let payPeriod = await prisma.payPeriod.findFirst({
    where: {
      userId,
      startDate: { lte: shiftDate },
      endDate: { gte: shiftDate }
    }
  });

  if (!payPeriod) {
    // Create a new fortnightly pay period
    const today = shiftDate;
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - mondayOffset);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 13);
    endDate.setHours(23, 59, 59, 999);

    const payDate = new Date(endDate);
    payDate.setDate(endDate.getDate() + 7);

    payPeriod = await prisma.payPeriod.create({
      data: {
        userId,
        startDate,
        endDate,
        payDate,
        status: 'OPEN'
      }
    });
  }

  // Add shift to pay period
  await prisma.payPeriodShift.upsert({
    where: {
      payPeriodId_shiftId: {
        payPeriodId: payPeriod.id,
        shiftId
      }
    },
    update: {},
    create: {
      payPeriodId: payPeriod.id,
      shiftId
    }
  });
}