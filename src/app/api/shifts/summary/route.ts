import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { PayPeriodService } from '@/lib/services/pay-period-service';

interface PeriodSummary {
  totalHours: number;
  totalPay: number;
  shiftCount: number;
}

interface ShiftsSummaryResponse {
  currentPeriod: {
    id: string;
    startDate: Date;
    endDate: Date;
    name: string;
    summary: PeriodSummary;
  };
  allTimeSummary: PeriodSummary;
  recentPeriods: Array<{
    id: string;
    startDate: Date;
    endDate: Date;
    name: string;
    summary: PeriodSummary;
  }>;
  averagePeriod: PeriodSummary;
}

export async function GET() {
  try {
    // Get the first user (single-user application)
    const user = await prisma.user.findFirst();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get current pay period using centralized service
    const currentPayPeriod = await PayPeriodService.getCurrentPayPeriod(user.id);

    // Get shifts for current pay period
    const currentPeriodShifts = await prisma.shift.findMany({
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

    // Calculate current period summary
    const currentPeriodSummary = calculatePeriodSummary(currentPeriodShifts);

    // Get all completed shifts for all-time totals
    const allShifts = await prisma.shift.findMany({
      where: {
        userId: user.id,
        status: 'COMPLETED'
      }
    });

    const allTimeSummary = calculatePeriodSummary(allShifts);

    // Get recent pay periods for average calculation (last 4 periods including current)
    const recentPeriods: Array<{
      id: string;
      startDate: Date;
      endDate: Date;
      name: string;
      summary: PeriodSummary;
    }> = [];

    // Generate last 4 pay periods including current
    let periodDate = new Date(currentPayPeriod.endDate);
    for (let i = 0; i < 4; i++) {
      let period;
      if (i === 0) {
        // Current period
        period = currentPayPeriod;
      } else {
        // Previous periods
        const previousPeriod = await PayPeriodService.getPayPeriodForDate(periodDate, user.id);
        period = {
          id: `generated-${i}`,
          startDate: previousPeriod.startDate,
          endDate: previousPeriod.endDate,
          status: 'COMPLETED'
        };
        // Move to previous period
        periodDate = new Date(previousPeriod.startDate);
        periodDate.setDate(periodDate.getDate() - 1);
      }

      // Get shifts for this period
      const periodShifts = await prisma.shift.findMany({
        where: {
          userId: user.id,
          status: 'COMPLETED',
          startTime: {
            gte: period.startDate,
            lte: period.endDate
          }
        }
      });

      const summary = calculatePeriodSummary(periodShifts);
      const periodName = PayPeriodService.formatPayPeriod({
        startDate: period.startDate,
        endDate: period.endDate,
        payDate: null
      });

      recentPeriods.push({
        id: period.id,
        startDate: period.startDate,
        endDate: period.endDate,
        name: periodName,
        summary
      });
    }

    // Calculate average from periods with actual shifts
    const periodsWithShifts = recentPeriods.filter(p => p.summary.shiftCount > 0);
    const averagePeriod: PeriodSummary = {
      totalHours: periodsWithShifts.length > 0 
        ? periodsWithShifts.reduce((sum, p) => sum + p.summary.totalHours, 0) / periodsWithShifts.length
        : 0,
      totalPay: periodsWithShifts.length > 0
        ? periodsWithShifts.reduce((sum, p) => sum + p.summary.totalPay, 0) / periodsWithShifts.length
        : 0,
      shiftCount: periodsWithShifts.length > 0
        ? periodsWithShifts.reduce((sum, p) => sum + p.summary.shiftCount, 0) / periodsWithShifts.length
        : 0
    };

    const response: ShiftsSummaryResponse = {
      currentPeriod: {
        id: currentPayPeriod.id,
        startDate: currentPayPeriod.startDate,
        endDate: currentPayPeriod.endDate,
        name: PayPeriodService.formatPayPeriod(currentPayPeriod),
        summary: currentPeriodSummary
      },
      allTimeSummary,
      recentPeriods,
      averagePeriod
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Shifts summary API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Calculate period summary using stored values (for historical data)
function calculatePeriodSummary(shifts: Array<{
  regularHours?: { toNumber(): number } | null;
  overtimeHours?: { toNumber(): number } | null;
  penaltyHours?: { toNumber(): number } | null;
  grossPay?: { toNumber(): number } | null;
}>): PeriodSummary {
  return {
    totalHours: shifts.reduce((sum, shift) => {
      const regularHours = shift.regularHours?.toNumber() || 0;
      const overtimeHours = shift.overtimeHours?.toNumber() || 0;
      const penaltyHours = shift.penaltyHours?.toNumber() || 0;
      return sum + regularHours + overtimeHours + penaltyHours;
    }, 0),
    totalPay: shifts.reduce((sum, shift) => sum + (shift.grossPay?.toNumber() || 0), 0),
    shiftCount: shifts.length
  };
}

