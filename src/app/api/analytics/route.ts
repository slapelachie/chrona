import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

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

    // Get all shifts for the user
    const shifts = await prisma.shift.findMany({
      where: { 
        userId: user.id,
        status: 'COMPLETED',
        grossPay: { not: null },
        regularHours: { not: null }
      },
      orderBy: { startTime: 'desc' },
      take: 500 // Limit to recent 500 shifts
    });

    if (shifts.length === 0) {
      return NextResponse.json({
        weeklyTrends: [],
        monthlyTotals: [],
        payTypeBreakdown: {
          regular: { hours: 0, earnings: 0, percentage: 0 },
          overtime: { hours: 0, earnings: 0, percentage: 0 },
          penalty: { hours: 0, earnings: 0, percentage: 0 }
        },
        yearToDate: {
          totalEarnings: 0,
          totalHours: 0,
          totalTax: 0,
          totalSuper: 0,
          shiftsWorked: 0,
          averageWeeklyHours: 0,
          averageHourlyRate: 0
        }
      });
    }

    // Calculate year to date totals
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(currentYear, 0, 1);
    
    const yearToDateShifts = shifts.filter(shift => 
      new Date(shift.startTime) >= yearStart
    );

    const totalEarnings = yearToDateShifts.reduce((sum, shift) => 
      sum + (shift.grossPay?.toNumber() || 0), 0
    );

    const totalHours = yearToDateShifts.reduce((sum, shift) => {
      const regular = shift.regularHours?.toNumber() || 0;
      const overtime = shift.overtimeHours?.toNumber() || 0;
      const penalty = shift.penaltyHours?.toNumber() || 0;
      return sum + regular + overtime + penalty;
    }, 0);

    const totalSuper = yearToDateShifts.reduce((sum, shift) => 
      sum + (shift.superannuation?.toNumber() || 0), 0
    );

    // Estimate tax at 19% for now (could be enhanced with real tax calculation)
    const totalTax = totalEarnings * 0.19;

    const shiftsWorked = yearToDateShifts.length;
    const weeksInYear = Math.max(1, Math.ceil((new Date().getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24 * 7)));
    const averageWeeklyHours = totalHours / weeksInYear;
    const averageHourlyRate = totalHours > 0 ? totalEarnings / totalHours : 0;

    // Calculate pay type breakdown
    const regularHours = yearToDateShifts.reduce((sum, shift) => 
      sum + (shift.regularHours?.toNumber() || 0), 0
    );
    const overtimeHours = yearToDateShifts.reduce((sum, shift) => 
      sum + (shift.overtimeHours?.toNumber() || 0), 0
    );
    const penaltyHours = yearToDateShifts.reduce((sum, shift) => 
      sum + (shift.penaltyHours?.toNumber() || 0), 0
    );

    const baseRate = user.payGuides[0].baseHourlyRate.toNumber();
    const regularEarnings = regularHours * baseRate;
    const overtimeEarnings = overtimeHours * baseRate * user.payGuides[0].overtimeRate1_5x.toNumber();
    const penaltyEarnings = totalEarnings - regularEarnings - overtimeEarnings;

    const payTypeBreakdown = {
      regular: {
        hours: regularHours,
        earnings: regularEarnings,
        percentage: totalEarnings > 0 ? Math.round((regularEarnings / totalEarnings) * 100) : 0
      },
      overtime: {
        hours: overtimeHours,
        earnings: overtimeEarnings,
        percentage: totalEarnings > 0 ? Math.round((overtimeEarnings / totalEarnings) * 100) : 0
      },
      penalty: {
        hours: penaltyHours,
        earnings: penaltyEarnings,
        percentage: totalEarnings > 0 ? Math.round((penaltyEarnings / totalEarnings) * 100) : 0
      }
    };

    // Calculate weekly trends (last 4 weeks)
    const weeklyTrends = [];
    const now = new Date();
    
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - (i * 7) - now.getDay());
      weekStart.setHours(0, 0, 0, 0);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const weekShifts = shifts.filter(shift => {
        const shiftDate = new Date(shift.startTime);
        return shiftDate >= weekStart && shiftDate <= weekEnd;
      });

      const weekHours = weekShifts.reduce((sum, shift) => {
        const regular = shift.regularHours?.toNumber() || 0;
        const overtime = shift.overtimeHours?.toNumber() || 0;
        const penalty = shift.penaltyHours?.toNumber() || 0;
        return sum + regular + overtime + penalty;
      }, 0);

      const weekEarnings = weekShifts.reduce((sum, shift) => 
        sum + (shift.grossPay?.toNumber() || 0), 0
      );

      weeklyTrends.push({
        week: `Week ${4 - i}`,
        hours: Math.round(weekHours * 10) / 10,
        earnings: Math.round(weekEarnings * 100) / 100,
        shifts: weekShifts.length
      });
    }

    // Calculate monthly totals (last 3 months)
    const monthlyTotals = [];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                    'July', 'August', 'September', 'October', 'November', 'December'];
    
    for (let i = 2; i >= 0; i--) {
      const monthDate = new Date();
      monthDate.setMonth(monthDate.getMonth() - i);
      
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);

      const monthShifts = shifts.filter(shift => {
        const shiftDate = new Date(shift.startTime);
        return shiftDate >= monthStart && shiftDate <= monthEnd;
      });

      const monthHours = monthShifts.reduce((sum, shift) => {
        const regular = shift.regularHours?.toNumber() || 0;
        const overtime = shift.overtimeHours?.toNumber() || 0;
        const penalty = shift.penaltyHours?.toNumber() || 0;
        return sum + regular + overtime + penalty;
      }, 0);

      const monthEarnings = monthShifts.reduce((sum, shift) => 
        sum + (shift.grossPay?.toNumber() || 0), 0
      );

      const averageHourlyRate = monthHours > 0 ? monthEarnings / monthHours : 0;

      monthlyTotals.push({
        month: months[monthDate.getMonth()],
        totalHours: Math.round(monthHours * 10) / 10,
        totalEarnings: Math.round(monthEarnings * 100) / 100,
        averageHourlyRate: Math.round(averageHourlyRate * 100) / 100
      });
    }

    const yearToDate = {
      totalEarnings: Math.round(totalEarnings * 100) / 100,
      totalHours: Math.round(totalHours * 10) / 10,
      totalTax: Math.round(totalTax * 100) / 100,
      totalSuper: Math.round(totalSuper * 100) / 100,
      shiftsWorked,
      averageWeeklyHours: Math.round(averageWeeklyHours * 10) / 10,
      averageHourlyRate: Math.round(averageHourlyRate * 100) / 100
    };

    return NextResponse.json({
      weeklyTrends,
      monthlyTotals,
      payTypeBreakdown,
      yearToDate
    });

  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}