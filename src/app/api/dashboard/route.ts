import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { EnhancedPayCalculator } from '@/lib/calculations/enhanced-pay-calculator';
import { TaxCalculator } from '@/lib/calculations/tax-calculator';
import { PayGuideWithPenalties } from '@/types';
import Decimal from 'decimal.js';

export async function GET() {
  try {
    // For now, get the first user (single-user application)
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

    // Get shifts for current pay period
    const shifts = await prisma.shift.findMany({
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

    // Get unique pay guide IDs for efficient penalty time frame fetching
    const uniquePayGuideIds = [...new Set(shifts.map(s => s.payGuideId))];
    
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

    // Calculate pay period summary

    let totalMinutes = 0;
    let totalGrossPay = 0;

    for (const shift of shifts) {
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
        totalMinutes += calculation.totalMinutes;
        totalGrossPay += calculation.grossPay.toNumber();
      }
    }

    // Get tax brackets and HECS thresholds for proper tax calculation
    const taxBrackets = await prisma.taxBracket.findMany({
      orderBy: { minIncome: 'asc' }
    });
    
    const hecsThresholds = await prisma.hECSThreshold.findMany({
      orderBy: { minIncome: 'asc' }
    });

    // Initialize tax calculator
    const taxCalculator = new TaxCalculator(taxBrackets, hecsThresholds, user);
    
    // Calculate proper tax for this pay period
    const grossPayDecimal = new Decimal(totalGrossPay);
    const taxCalculation = taxCalculator.calculatePayPeriodTax(grossPayDecimal, 26); // Fortnightly (26 periods per year)
    
    const estimatedNet = taxCalculation.netPay.toNumber();

    // Get upcoming shifts
    const upcomingShifts = await prisma.shift.findMany({
      where: {
        userId: user.id,
        status: 'SCHEDULED',
        startTime: {
          gte: new Date(),
          lte: currentPayPeriod.endDate
        }
      },
      orderBy: { startTime: 'asc' },
      take: 5
    });

    // Calculate metrics
    const hoursWorked = totalMinutes / 60;
    const shiftsRemaining = upcomingShifts.length;
    const daysUntilPay = currentPayPeriod.payDate ? 
      Math.max(0, Math.ceil((currentPayPeriod.payDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))) : 0;

    // Calculate key metrics
    const averageHourlyEarnings = hoursWorked > 0 ? totalGrossPay / hoursWorked : 0;
    
    // Count upcoming penalty shifts
    const upcomingPenaltyShifts = upcomingShifts.filter(shift => {
      const dayOfWeek = shift.startTime.getDay();
      const hour = shift.startTime.getHours();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isEvening = hour >= 18 || hour < 6;
      const isPublicHoliday = publicHolidays.some(holiday => 
        holiday.date.toDateString() === shift.startTime.toDateString()
      );
      return isWeekend || isEvening || isPublicHoliday;
    }).length;

    // Get verification status for current period
    const verification = await prisma.payVerification.findFirst({
      where: {
        userId: user.id,
        payPeriodId: currentPayPeriod.id
      }
    });

    const verificationStatus = verification ? 
      (verification.status === 'MATCHED' ? 'verified' : 
       verification.status === 'DISCREPANCY' ? 'discrepancy' : 'pending') : 'pending';

    // Calculate superannuation (11% of gross pay)
    const superannuation = new Decimal(totalGrossPay).mul(0.11);

    const response = {
      payPeriodSummary: {
        startDate: currentPayPeriod.startDate,
        endDate: currentPayPeriod.endDate,
        payDate: currentPayPeriod.payDate,
        hoursWorked: Math.round(hoursWorked * 10) / 10, // Round to 1 decimal
        estimatedGross: Math.round(totalGrossPay * 100) / 100, // Round to cents
        estimatedNet: Math.round(estimatedNet * 100) / 100,
        estimatedTax: Math.round(taxCalculation.totalDeductions.toNumber() * 100) / 100,
        estimatedSuper: Math.round(superannuation.toNumber() * 100) / 100,
        shiftsRemaining,
        daysUntilPay,
        taxBreakdown: {
          incomeTax: Math.round(taxCalculation.incomeTax.toNumber() * 100) / 100,
          medicareLevy: Math.round(taxCalculation.medicareLevy.toNumber() * 100) / 100,
          hecsRepayment: Math.round(taxCalculation.hecsRepayment.toNumber() * 100) / 100
        }
      },
      keyMetrics: {
        weeklyHoursTrend: 0, // TODO: Calculate vs previous period
        averageHourlyEarnings: Math.round(averageHourlyEarnings * 100) / 100,
        upcomingPenaltyShifts,
        verificationStatus
      },
      upcomingShifts: upcomingShifts.map(shift => ({
        id: shift.id,
        startTime: shift.startTime,
        endTime: shift.endTime,
        shiftType: shift.shiftType,
        notes: shift.notes
      }))
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Dashboard API error:', error);
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