import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { EnhancedPayCalculator } from '@/lib/calculations/enhanced-pay-calculator';
import { PayGuideWithPenalties } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      date,
      startTime,
      endTime,
      breakMinutes = 0,
      payGuideId
    } = body;

    // Validation
    if (!date || !startTime || !endTime) {
      return NextResponse.json({ error: 'Date, start time and end time are required' }, { status: 400 });
    }

    if (!payGuideId) {
      return NextResponse.json({ error: 'Pay guide is required' }, { status: 400 });
    }

    // Create local DateTime objects directly from date and time strings
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);
    const [year, month, day] = date.split('-').map(Number);
    
    const startTimeDate = new Date(year, month - 1, day, startHours, startMinutes);
    const endTimeDate = new Date(year, month - 1, day, endHours, endMinutes);
    
    // Handle shifts that cross midnight
    if (endTimeDate <= startTimeDate) {
      endTimeDate.setDate(endTimeDate.getDate() + 1);
    }

    if (startTimeDate >= endTimeDate) {
      return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 });
    }

    // Get the selected pay guide
    const payGuide = await prisma.payGuide.findFirst({
      where: { 
        id: payGuideId,
        isActive: true
      }
    });

    if (!payGuide) {
      return NextResponse.json({ error: 'Pay guide not found or inactive' }, { status: 404 });
    }

    // Get penalty time frames separately
    const penaltyTimeFrames = await prisma.penaltyTimeFrame.findMany({
      where: {
        payGuideId: payGuide.id,
        isActive: true
      }
    });

    // Create the pay guide with penalty time frames for the calculator
    const payGuideWithPenalties: PayGuideWithPenalties = {
      ...payGuide,
      penaltyTimeFrames
    };

    // Get public holidays for calculation
    const publicHolidays = await prisma.publicHoliday.findMany({
      where: {
        date: {
          gte: startTimeDate,
          lte: endTimeDate
        }
      }
    });

    // Use the same enhanced calculator as actual shift creation
    const payCalculator = new EnhancedPayCalculator(payGuideWithPenalties, publicHolidays);
    
    const calculation = payCalculator.calculateShift(
      startTimeDate,
      endTimeDate,
      breakMinutes
    );

    // Convert Decimal fields to numbers for frontend consumption
    const response = {
      duration: Math.round((calculation.totalMinutes / 60) * 100) / 100,
      estimatedPay: calculation.grossPay.toNumber(),
      hasWarnings: false,
      warnings: [] as string[],
      breakdown: {
        regularPay: calculation.breakdown.regularHours.amount.toNumber(),
        overtimePay: calculation.breakdown.overtime1_5x.amount.plus(calculation.breakdown.overtime2x.amount).toNumber(),
        penaltyPay: calculation.breakdown.totalPenaltyPay.toNumber(),
        casualLoading: calculation.breakdown.casualLoading.amount.toNumber()
      },
      detailedBreakdown: {
        regularHours: {
          hours: calculation.breakdown.regularHours.hours.toNumber(),
          rate: calculation.breakdown.regularHours.rate.toNumber(),
          amount: calculation.breakdown.regularHours.amount.toNumber()
        },
        overtime1_5x: {
          hours: calculation.breakdown.overtime1_5x.hours.toNumber(),
          rate: calculation.breakdown.overtime1_5x.rate.toNumber(),
          amount: calculation.breakdown.overtime1_5x.amount.toNumber()
        },
        overtime2x: {
          hours: calculation.breakdown.overtime2x.hours.toNumber(),
          rate: calculation.breakdown.overtime2x.rate.toNumber(),
          amount: calculation.breakdown.overtime2x.amount.toNumber()
        },
        penalties: calculation.breakdown.penalties.map(penalty => ({
          name: penalty.name,
          hours: penalty.hours.toNumber(),
          rate: penalty.rate.toNumber(),
          amount: penalty.amount.toNumber()
        })),
        casualLoading: {
          rate: calculation.breakdown.casualLoading.rate.toNumber(),
          amount: calculation.breakdown.casualLoading.amount.toNumber()
        }
      }
    };

    // Generate warnings based on shift characteristics
    const warnings: string[] = [];
    const duration = calculation.totalMinutes / 60;
    
    if (duration < 3) {
      warnings.push('Very short shift (less than 3 hours)');
    }
    
    if (duration > 12) {
      warnings.push('Very long shift (more than 12 hours)');
    }
    
    if (duration > 5 && breakMinutes < 30) {
      warnings.push('Shifts over 5 hours should have at least 30 minutes break');
    }
    
    if (duration > 10 && breakMinutes < 60) {
      warnings.push('Shifts over 10 hours should have at least 60 minutes break');
    }

    // Check for penalties applied
    if (calculation.breakdown.penalties.length > 0) {
      warnings.push('Penalty rates were applied');
    }

    response.warnings = warnings;
    response.hasWarnings = warnings.length > 0;

    return NextResponse.json(response);
  } catch (error) {
    console.error('Shift preview calculation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}