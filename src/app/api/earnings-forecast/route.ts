import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { EnhancedPayCalculator } from '@/lib/calculations/enhanced-pay-calculator';
import { PayPeriodService } from '@/lib/services/pay-period-service';
import { PayGuideWithPenalties } from '@/types';

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

    // Get current pay period using centralized service
    const currentPayPeriod = await PayPeriodService.getCurrentPayPeriod(user.id);

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

    // Get unique pay guide IDs for efficient penalty time frame fetching
    const uniquePayGuideIds = [...new Set(completedShifts.map(s => s.payGuideId))];
    
    // Get penalty time frames for all used pay guides
    const penaltyTimeFrames = await prisma.penaltyTimeFrame.findMany({
      where: { 
        payGuideId: { in: uniquePayGuideIds }, 
        isActive: true 
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
        // Create PayGuideWithPenalties for this shift
        const payGuideWithPenalties: PayGuideWithPenalties = {
          ...shift.payGuide,
          penaltyTimeFrames: penaltyTimeFrames.filter(p => p.payGuideId === shift.payGuide.id)
        };

        const calculator = new EnhancedPayCalculator(payGuideWithPenalties, publicHolidays);
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
        // Create PayGuideWithPenalties for this shift
        const payGuideWithPenalties: PayGuideWithPenalties = {
          ...shift.payGuide,
          penaltyTimeFrames: penaltyTimeFrames.filter(p => p.payGuideId === shift.payGuide.id)
        };

        const calculator = new EnhancedPayCalculator(payGuideWithPenalties, publicHolidays);
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
          // Create PayGuideWithPenalties for this shift
          const payGuideWithPenalties: PayGuideWithPenalties = {
            ...shift.payGuide,
            penaltyTimeFrames: penaltyTimeFrames.filter(p => p.payGuideId === shift.payGuide.id)
          };

          const calculator = new EnhancedPayCalculator(payGuideWithPenalties, publicHolidays);
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

