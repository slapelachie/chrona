import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { EnhancedPayCalculator, PenaltyOverride } from '@/lib/calculations/enhanced-pay-calculator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      startTime,
      endTime,
      breakMinutes = 0,
      payGuideId,
      penaltyOverrides,
      autoCalculatePenalties = true
    } = body;

    // Validation
    if (!startTime || !endTime) {
      return NextResponse.json({ error: 'Start time and end time are required' }, { status: 400 });
    }

    if (!payGuideId) {
      return NextResponse.json({ error: 'Pay guide is required' }, { status: 400 });
    }

    const startTimeDate = new Date(startTime);
    const endTimeDate = new Date(endTime);

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
    const payCalculator = new EnhancedPayCalculator(payGuide, publicHolidays);
    
    // Apply penalty overrides if provided and auto-calculate is disabled
    const finalPenaltyOverrides = !autoCalculatePenalties && penaltyOverrides ? penaltyOverrides : undefined;
    
    const calculation = payCalculator.calculateShift(
      startTimeDate,
      endTimeDate,
      breakMinutes,
      finalPenaltyOverrides
    );

    // Convert Decimal fields to numbers for frontend consumption
    const response = {
      duration: Math.round((calculation.totalMinutes / 60) * 100) / 100,
      estimatedPay: calculation.grossPay.toNumber(),
      hasWarnings: false,
      warnings: [] as string[],
      appliedPenalties: calculation.appliedPenalties,
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
        eveningPenalty: {
          hours: calculation.breakdown.eveningPenalty.hours.toNumber(),
          rate: calculation.breakdown.eveningPenalty.rate.toNumber(),
          amount: calculation.breakdown.eveningPenalty.amount.toNumber()
        },
        nightPenalty: {
          hours: calculation.breakdown.nightPenalty.hours.toNumber(),
          rate: calculation.breakdown.nightPenalty.rate.toNumber(),
          amount: calculation.breakdown.nightPenalty.amount.toNumber()
        },
        saturdayPenalty: {
          hours: calculation.breakdown.saturdayPenalty.hours.toNumber(),
          rate: calculation.breakdown.saturdayPenalty.rate.toNumber(),
          amount: calculation.breakdown.saturdayPenalty.amount.toNumber()
        },
        sundayPenalty: {
          hours: calculation.breakdown.sundayPenalty.hours.toNumber(),
          rate: calculation.breakdown.sundayPenalty.rate.toNumber(),
          amount: calculation.breakdown.sundayPenalty.amount.toNumber()
        },
        publicHolidayPenalty: {
          hours: calculation.breakdown.publicHolidayPenalty.hours.toNumber(),
          rate: calculation.breakdown.publicHolidayPenalty.rate.toNumber(),
          amount: calculation.breakdown.publicHolidayPenalty.amount.toNumber()
        },
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

    // Check for penalty overrides
    if (calculation.penaltyOverridesApplied) {
      warnings.push('Manual penalty overrides are active');
    }

    response.warnings = warnings;
    response.hasWarnings = warnings.length > 0;

    return NextResponse.json(response);
  } catch (error) {
    console.error('Shift preview calculation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}