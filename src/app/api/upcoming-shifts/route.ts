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

    // Get upcoming/scheduled shifts for current pay period and beyond
    const upcomingShifts = await prisma.shift.findMany({
      where: {
        userId: user.id,
        status: 'SCHEDULED',
        startTime: {
          gte: new Date()
        }
      },
      include: {
        payGuide: true
      },
      orderBy: { startTime: 'asc' },
      take: 10 // Limit to next 10 shifts
    });

    // Get unique pay guide IDs for efficient penalty time frame fetching
    const uniquePayGuideIds = [...new Set(upcomingShifts.map(s => s.payGuideId))];
    
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
          gte: new Date(),
          lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Next 30 days
        }
      }
    });

    // Process shifts with calculations
    const processedShifts = upcomingShifts.map(shift => {
      let estimatedPay = 0;
      let duration = 0;
      let shiftType: 'regular' | 'overtime' | 'penalty' | 'weekend' | 'public_holiday' = 'regular';

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

        estimatedPay = calculation.grossPay.toNumber();
        duration = calculation.totalMinutes / 60;

        // Determine shift type based on timing and penalties
        const dayOfWeek = shift.startTime.getDay();
        const hour = shift.startTime.getHours();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isEvening = hour >= 18 || hour < 6;
        const isPublicHoliday = publicHolidays.some(holiday => 
          holiday.date.toDateString() === shift.startTime.toDateString()
        );

        if (isPublicHoliday) {
          shiftType = 'public_holiday';
        } else if (isWeekend) {
          shiftType = 'weekend';
        } else if (isEvening) {
          shiftType = 'penalty';
        } else if (duration > 8) {
          shiftType = 'overtime';
        } else {
          shiftType = 'regular';
        }
      }

      return {
        id: shift.id,
        date: shift.startTime,
        startTime: shift.startTime.toLocaleTimeString('en-AU', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        }),
        endTime: shift.endTime ? shift.endTime.toLocaleTimeString('en-AU', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        }) : null,
        duration: Math.round(duration * 100) / 100,
        estimatedPay: Math.round(estimatedPay * 100) / 100,
        shiftType,
        location: shift.location,
        notes: shift.notes || null
      };
    });

    return NextResponse.json(processedShifts);
  } catch (error) {
    console.error('Upcoming shifts API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

