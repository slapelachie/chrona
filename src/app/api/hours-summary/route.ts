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
      },
      orderBy: { startTime: 'asc' }
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

    // Calculate hours breakdown
    let totalRegularMinutes = 0;
    let totalOvertimeMinutes = 0;
    let totalPenaltyMinutes = 0;
    let totalMinutes = 0;

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
        
        // Add to totals (convert hours to minutes)
        totalRegularMinutes += calculation.regularHours.toNumber() * 60;
        totalOvertimeMinutes += calculation.overtimeHours.toNumber() * 60;
        totalPenaltyMinutes += calculation.penaltyHours.toNumber() * 60;
        totalMinutes += calculation.totalMinutes;
      }
    }

    // Convert to hours
    const totalHours = totalMinutes / 60;
    const regularHours = totalRegularMinutes / 60;
    const overtimeHours = totalOvertimeMinutes / 60;
    const penaltyHours = totalPenaltyMinutes / 60;

    // Calculate percentages
    const regularPercentage = totalHours > 0 ? Math.round((regularHours / totalHours) * 100) : 0;
    const overtimePercentage = totalHours > 0 ? Math.round((overtimeHours / totalHours) * 100) : 0;
    const penaltyPercentage = totalHours > 0 ? Math.round((penaltyHours / totalHours) * 100) : 0;

    // Get current week's hours for comparison
    const now = new Date();
    const startOfWeek = new Date(now);
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startOfWeek.setDate(now.getDate() - mondayOffset);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    // Get this week's shifts
    const thisWeekShifts = await prisma.shift.findMany({
      where: {
        userId: user.id,
        status: 'COMPLETED',
        startTime: {
          gte: startOfWeek,
          lte: endOfWeek
        }
      },
      include: {
        payGuide: true
      }
    });

    let currentWeekMinutes = 0;
    for (const shift of thisWeekShifts) {
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
        currentWeekMinutes += calculation.totalMinutes;
      }
    }

    // Get previous week for comparison
    const prevWeekStart = new Date(startOfWeek);
    prevWeekStart.setDate(startOfWeek.getDate() - 7);
    
    const prevWeekEnd = new Date(endOfWeek);
    prevWeekEnd.setDate(endOfWeek.getDate() - 7);

    const prevWeekShifts = await prisma.shift.findMany({
      where: {
        userId: user.id,
        status: 'COMPLETED',
        startTime: {
          gte: prevWeekStart,
          lte: prevWeekEnd
        }
      },
      include: {
        payGuide: true
      }
    });

    let previousWeekMinutes = 0;
    for (const shift of prevWeekShifts) {
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
        previousWeekMinutes += calculation.totalMinutes;
      }
    }

    const currentWeekHours = currentWeekMinutes / 60;
    const previousWeekHours = previousWeekMinutes / 60;
    const weeklyChange = currentWeekHours - previousWeekHours;
    
    let trend: 'up' | 'down' | 'stable';
    if (weeklyChange > 2) {
      trend = 'up';
    } else if (weeklyChange < -2) {
      trend = 'down';
    } else {
      trend = 'stable';
    }

    const response = {
      regular: {
        hours: Math.round(regularHours * 100) / 100,
        percentage: regularPercentage,
        color: 'primary'
      },
      overtime: {
        hours: Math.round(overtimeHours * 100) / 100,
        percentage: overtimePercentage,
        color: 'warning'
      },
      penalty: {
        hours: Math.round(penaltyHours * 100) / 100,
        percentage: penaltyPercentage,
        color: 'info'
      },
      total: Math.round(totalHours * 100) / 100,
      weeklyComparison: {
        currentWeek: Math.round(currentWeekHours * 100) / 100,
        previousWeek: Math.round(previousWeekHours * 100) / 100,
        change: Math.round(weeklyChange * 100) / 100,
        trend
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Hours summary API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

