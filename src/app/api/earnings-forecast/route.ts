import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { PayCalculator } from '@/lib/calculations/pay-calculator';

export async function GET() {
  try {
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

    // Get current pay period
    const currentPayPeriod = await getCurrentPayPeriod(user.id);
    
    if (!currentPayPeriod) {
      return NextResponse.json({ error: 'No current pay period found' }, { status: 404 });
    }

    // Get completed shifts for current pay period
    const completedShifts = await prisma.shift.findMany({
      where: {
        userId: user.id,
        status: 'COMPLETED',
        startTime: {
          gte: currentPayPeriod.startDate,
          lte: currentPayPeriod.endDate
        }
      },
      include: {
        payGuide: true
      }
    });

    // Get scheduled/upcoming shifts for current pay period
    const upcomingShifts = await prisma.shift.findMany({
      where: {
        userId: user.id,
        status: 'SCHEDULED',
        startTime: {
          gte: new Date(),
          lte: currentPayPeriod.endDate
        }
      },
      include: {
        payGuide: true
      }
    });

    // Get public holidays for calculations
    const publicHolidays = await prisma.publicHoliday.findMany({
      where: {
        date: {
          gte: currentPayPeriod.startDate,
          lte: currentPayPeriod.endDate
        }
      }
    });

    // Calculate current earnings from completed shifts
    let currentEarnings = 0;
    let totalCompletedMinutes = 0;

    for (const shift of completedShifts) {
      if (shift.endTime) {
        const calculator = new PayCalculator(shift.payGuide, publicHolidays);
        const calculation = calculator.calculateShift(
          shift.startTime,
          shift.endTime,
          shift.breakMinutes
        );
        currentEarnings += calculation.grossPay.toNumber();
        totalCompletedMinutes += calculation.totalMinutes;
      }
    }

    // Estimate earnings from upcoming shifts
    let projectedEarnings = currentEarnings;
    let totalUpcomingMinutes = 0;

    for (const shift of upcomingShifts) {
      if (shift.endTime) {
        const calculator = new PayCalculator(shift.payGuide, publicHolidays);
        const calculation = calculator.calculateShift(
          shift.startTime,
          shift.endTime,
          shift.breakMinutes
        );
        projectedEarnings += calculation.grossPay.toNumber();
        totalUpcomingMinutes += calculation.totalMinutes;
      }
    }

    // Calculate progress percentage
    const totalMinutes = totalCompletedMinutes + totalUpcomingMinutes;
    const progressPercentage = totalMinutes > 0 ? Math.round((totalCompletedMinutes / totalMinutes) * 100) : 0;

    // Calculate remaining earnings
    const remainingEarnings = projectedEarnings - currentEarnings;

    // Calculate average daily rate based on completed shifts
    const completedDays = completedShifts.length;
    const averageDailyRate = completedDays > 0 ? currentEarnings / completedDays : 0;

    // Calculate remaining working days
    const today = new Date();
    const endDate = currentPayPeriod.endDate;
    const msPerDay = 24 * 60 * 60 * 1000;
    const remainingDays = Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / msPerDay));

    // Get previous pay period for comparison
    const previousPayPeriod = await prisma.payPeriod.findFirst({
      where: {
        userId: user.id,
        endDate: { lt: currentPayPeriod.startDate }
      },
      orderBy: { endDate: 'desc' }
    });

    let vsLastPeriod = 0;
    let trend: 'up' | 'down' | 'stable' = 'stable';

    if (previousPayPeriod) {
      const previousShifts = await prisma.shift.findMany({
        where: {
          userId: user.id,
          status: 'COMPLETED',
          startTime: {
            gte: previousPayPeriod.startDate,
            lte: previousPayPeriod.endDate
          }
        },
        include: {
          payGuide: true
        }
      });

      let previousEarnings = 0;
      for (const shift of previousShifts) {
        if (shift.endTime) {
          const calculator = new PayCalculator(shift.payGuide, publicHolidays);
          const calculation = calculator.calculateShift(
            shift.startTime,
            shift.endTime,
            shift.breakMinutes
          );
          previousEarnings += calculation.grossPay.toNumber();
        }
      }

      vsLastPeriod = projectedEarnings - previousEarnings;
      trend = vsLastPeriod > 10 ? 'up' : vsLastPeriod < -10 ? 'down' : 'stable';
    }

    // Determine confidence level
    const completedShiftCount = completedShifts.length;
    const upcomingShiftCount = upcomingShifts.length;
    
    let confidence: 'high' | 'medium' | 'low';
    if (completedShiftCount >= 5 && upcomingShiftCount >= 3) {
      confidence = 'high';
    } else if (completedShiftCount >= 2 && upcomingShiftCount >= 1) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    const response = {
      currentEarnings: Math.round(currentEarnings * 100) / 100,
      projectedTotal: Math.round(projectedEarnings * 100) / 100,
      remainingEarnings: Math.round(remainingEarnings * 100) / 100,
      progressPercentage,
      averageDailyRate: Math.round(averageDailyRate * 100) / 100,
      remainingDays,
      confidence,
      trends: {
        vsLastPeriod: Math.round(Math.abs(vsLastPeriod) * 100) / 100,
        trend
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Earnings forecast API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function getCurrentPayPeriod(userId: string) {
  const now = new Date();
  
  // Look for existing pay period that includes today
  const existing = await prisma.payPeriod.findFirst({
    where: {
      userId,
      startDate: { lte: now },
      endDate: { gte: now }
    }
  });

  if (existing) {
    return existing;
  }

  // Create a new fortnightly pay period starting from the most recent Monday
  const today = new Date();
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 0, so offset by 6
  
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - mondayOffset);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 13); // 14 days total (fortnightly)
  endDate.setHours(23, 59, 59, 999);

  const payDate = new Date(endDate);
  payDate.setDate(endDate.getDate() + 7); // Pay date 1 week after period ends

  return await prisma.payPeriod.create({
    data: {
      userId,
      startDate,
      endDate,
      payDate,
      status: 'OPEN'
    }
  });
}