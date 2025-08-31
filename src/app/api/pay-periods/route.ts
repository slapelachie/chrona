import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeEmpty = searchParams.get('includeEmpty') === 'true';
    const status = searchParams.get('status');
    const limit = searchParams.get('limit');

    // Get the first user (single-user application)
    const user = await prisma.user.findFirst();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const whereCondition: any = { userId: user.id };

    // Filter by status if provided
    if (status) {
      whereCondition.status = status;
    }

    const payPeriods = await prisma.payPeriod.findMany({
      where: whereCondition,
      include: {
        shifts: {
          include: {
            shift: true
          }
        }
      },
      orderBy: { startDate: 'desc' },
      take: limit ? parseInt(limit) : undefined
    });

    // Filter out empty pay periods if requested
    const filteredPayPeriods = includeEmpty 
      ? payPeriods 
      : payPeriods.filter(period => period.shifts.length > 0);

    // Calculate summaries for each pay period
    const payPeriodsWithSummary = filteredPayPeriods.map(period => {
      const shifts = period.shifts.map((ps: any) => ps.shift);
      const totalHours = shifts.reduce((sum: number, shift: any) => {
        const regular = shift.regularHours?.toNumber() || 0;
        const overtime = shift.overtimeHours?.toNumber() || 0;
        const penalty = shift.penaltyHours?.toNumber() || 0;
        return sum + regular + overtime + penalty;
      }, 0);
      
      const totalPay = shifts.reduce((sum: number, shift: any) => {
        return sum + (shift.grossPay?.toNumber() || 0);
      }, 0);

      return {
        id: period.id,
        startDate: period.startDate,
        endDate: period.endDate,
        payDate: period.payDate,
        status: period.status,
        shiftCount: period.shifts.length,
        summary: {
          totalHours: Math.round(totalHours * 10) / 10, // Round to 1 decimal
          totalPay: Math.round(totalPay * 100) / 100,   // Round to 2 decimals
          shiftCount: period.shifts.length
        }
      };
    });

    return NextResponse.json({ payPeriods: payPeriodsWithSummary });
  } catch (error) {
    console.error('Get pay periods error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}