import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { EnhancedPayCalculator } from '@/lib/calculations/enhanced-pay-calculator';
import { PayPeriodService } from '@/lib/services/pay-period-service';
import { Prisma, ShiftStatus, ShiftType } from '@prisma/client';
import { PayGuideWithPenalties } from '@/types';
import { isUTCMidnight, createLocalDateTime } from '@/lib/timezone';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const payPeriodId = searchParams.get('payPeriodId');
    const location = searchParams.get('location');
    const shiftType = searchParams.get('shiftType');
    const search = searchParams.get('search');
    
    // Pagination parameters
    const cursor = searchParams.get('cursor'); // Format: "startTime:id"
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const limit = searchParams.get('limit'); // Backward compatibility
    
    // Group by pay period flag
    const groupByPayPeriod = searchParams.get('groupByPayPeriod') === 'true';

    // Get the first user (single-user application)
    const user = await prisma.user.findFirst();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const whereCondition: Prisma.ShiftWhereInput = { userId: user.id };

    // Status filter
    if (status && Object.values(ShiftStatus).includes(status as ShiftStatus)) {
      whereCondition.status = status as ShiftStatus;
    }

    // Date range filter
    if (startDate || endDate) {
      whereCondition.startTime = {};
      if (startDate) whereCondition.startTime.gte = new Date(startDate);
      if (endDate) whereCondition.startTime.lte = new Date(endDate);
    }

    // Pay period filter
    if (payPeriodId) {
      whereCondition.payPeriodShifts = {
        some: {
          payPeriodId: payPeriodId
        }
      };
    }

    // Location filter
    if (location) {
      whereCondition.location = {
        contains: location
      };
    }

    // Shift type filter
    if (shiftType) {
      whereCondition.shiftType = shiftType as any;
    }

    // Search functionality
    if (search) {
      const searchTerms = search.toLowerCase().split(' ').filter(term => term.length > 0);
      if (searchTerms.length > 0) {
        whereCondition.OR = whereCondition.OR || [];
        whereCondition.OR.push(
          // Search in notes
          {
            notes: {
              contains: search
            }
          },
          // Search in location
          {
            location: {
              contains: search
            }
          }
        );

        // Handle shift type search separately with valid enum values
        const validShiftTypes = Object.values(ShiftType);
        const matchingShiftTypes = validShiftTypes.filter(type => 
          type.toLowerCase().includes(search.toLowerCase()) ||
          type.replace('_', ' ').toLowerCase().includes(search.toLowerCase())
        );
        
        if (matchingShiftTypes.length > 0) {
          whereCondition.OR.push({
            shiftType: {
              in: matchingShiftTypes
            }
          });
        }
      }
    }

    // Cursor-based pagination
    if (cursor) {
      const [cursorStartTime, cursorId] = cursor.split(':');
      whereCondition.OR = [
        {
          startTime: {
            lt: new Date(cursorStartTime)
          }
        },
        {
          AND: [
            {
              startTime: new Date(cursorStartTime)
            },
            {
              id: {
                lt: cursorId
              }
            }
          ]
        }
      ];
    }

    // Determine take limit
    const takeLimit = limit ? parseInt(limit) : pageSize + 1; // +1 to check if there are more items

    const shifts = await prisma.shift.findMany({
      where: whereCondition,
      include: {
        payGuide: true,
        payPeriodShifts: {
          include: {
            payPeriod: true
          }
        }
      },
      orderBy: [
        { startTime: 'desc' },
        { id: 'desc' }
      ],
      take: takeLimit
    });

    // Pagination logic
    let hasMore = false;
    let nextCursor: string | null = null;
    let paginatedShifts = shifts;

    if (!limit && shifts.length > pageSize) {
      hasMore = true;
      paginatedShifts = shifts.slice(0, pageSize);
      const lastShift = paginatedShifts[paginatedShifts.length - 1];
      nextCursor = `${lastShift.startTime.toISOString()}:${lastShift.id}`;
    }

    // Convert Decimal fields to numbers for frontend
    const shiftsWithNumbers = paginatedShifts.map(shift => ({
      ...shift,
      regularHours: shift.regularHours?.toNumber() || null,
      overtimeHours: shift.overtimeHours?.toNumber() || null,
      penaltyHours: shift.penaltyHours?.toNumber() || null,
      grossPay: shift.grossPay?.toNumber() || null,
      superannuation: shift.superannuation?.toNumber() || null,
      payPeriod: shift.payPeriodShifts[0]?.payPeriod || null,
      payGuide: shift.payGuide
    }));

    // If grouping by pay period is requested
    if (groupByPayPeriod) {
      const payPeriodGroups = new Map<string, any>();
      
      shiftsWithNumbers.forEach(shift => {
        if (shift.payPeriod) {
          const periodId = shift.payPeriod.id;
          if (!payPeriodGroups.has(periodId)) {
            payPeriodGroups.set(periodId, {
              id: shift.payPeriod.id,
              startDate: shift.payPeriod.startDate,
              endDate: shift.payPeriod.endDate,
              status: shift.payPeriod.status,
              shifts: [],
              summary: {
                totalHours: 0,
                totalPay: 0,
                shiftCount: 0
              }
            });
          }
          
          const group = payPeriodGroups.get(periodId);
          group.shifts.push({
            ...shift,
            payGuide: shift.payGuide || { name: 'Unknown' }
          });
          group.summary.shiftCount += 1;
          group.summary.totalHours += (shift.regularHours || 0) + (shift.overtimeHours || 0) + (shift.penaltyHours || 0);
          group.summary.totalPay += shift.grossPay || 0;
        }
      });

      return NextResponse.json({
        payPeriods: Array.from(payPeriodGroups.values()),
        pagination: {
          nextCursor,
          hasMore,
          total: shifts.length
        }
      });
    }

    return NextResponse.json({
      shifts: shiftsWithNumbers,
      pagination: {
        nextCursor,
        hasMore,
        total: shifts.length
      }
    });
  } catch (error) {
    console.error('Get shifts error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      startTime,
      endTime,
      breakMinutes = 0,
      shiftType = 'REGULAR',
      notes,
      location,
      payGuideId,
      penaltyOverrides,
      autoCalculatePenalties = true
    } = body;

    // Validation
    if (!startTime || !endTime) {
      return NextResponse.json({ error: 'Start time and end time are required' }, { status: 400 });
    }

    const startTimeDate = new Date(startTime);
    const endTimeDate = new Date(endTime);

    if (startTimeDate >= endTimeDate) {
      return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 });
    }

    // Timezone validation: prevent UTC midnight timestamps which indicate incorrect timezone handling
    if (isUTCMidnight(startTimeDate)) {
      console.warn('⚠️  Shift start time appears to be UTC midnight - this may indicate incorrect timezone handling');
      console.warn('   Original:', startTime, '→', startTimeDate.toISOString());
      console.warn('   Consider using createLocalDateTime for proper timezone handling');
    }

    if (isUTCMidnight(endTimeDate)) {
      console.warn('⚠️  Shift end time appears to be UTC midnight - this may indicate incorrect timezone handling');
      console.warn('   Original:', endTime, '→', endTimeDate.toISOString());  
      console.warn('   Consider using createLocalDateTime for proper timezone handling');
    }

    // Get the first user (single-user application)
    const user = await prisma.user.findFirst();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Determine which pay guide to use
    let selectedPayGuideId = payGuideId;
    
    if (!selectedPayGuideId) {
      // Try to use last used or default pay guide from user preferences
      selectedPayGuideId = user.lastUsedPayGuideId || user.defaultPayGuideId;
      
      if (!selectedPayGuideId) {
        // Fall back to first active pay guide
        const activePayGuide = await prisma.payGuide.findFirst({
          where: { 
            userId: user.id,
            isActive: true 
          }
        });
        
        if (!activePayGuide) {
          return NextResponse.json({ error: 'No active pay guide found' }, { status: 404 });
        }
        
        selectedPayGuideId = activePayGuide.id;
      }
    }

    // Get the selected pay guide
    const payGuide = await prisma.payGuide.findFirst({
      where: { 
        id: selectedPayGuideId,
        userId: user.id,
        isActive: true
      }
    });

    if (!payGuide) {
      return NextResponse.json({ error: 'Selected pay guide not found or inactive' }, { status: 404 });
    }

    // Update user's last used pay guide
    if (selectedPayGuideId !== user.lastUsedPayGuideId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastUsedPayGuideId: selectedPayGuideId }
      });
    }

    // Get penalty time frames for the enhanced calculator
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

    // Calculate shift pay using Enhanced calculator
    const payCalculator = new EnhancedPayCalculator(payGuideWithPenalties, publicHolidays);
    const calculation = payCalculator.calculateShift(
      startTimeDate,
      endTimeDate,
      breakMinutes
    );

    // Create the shift with calculated values
    const shift = await prisma.shift.create({
      data: {
        userId: user.id,
        payGuideId: payGuide.id,
        startTime: startTimeDate,
        endTime: endTimeDate,
        breakMinutes,
        shiftType,
        status: 'COMPLETED', // Assume completed shifts for now
        notes,
        location,
        penaltyOverrides: penaltyOverrides ? JSON.stringify(penaltyOverrides) : null,
        autoCalculatePenalties,
        totalMinutes: calculation.totalMinutes,
        regularHours: calculation.regularHours,
        overtimeHours: calculation.overtimeHours,
        penaltyHours: calculation.penaltyHours,
        grossPay: calculation.grossPay,
        superannuation: calculation.grossPay.mul(0.11) // 11% super
      },
      include: {
        payGuide: true
      }
    });

    // Add shift to current pay period
    await addShiftToPayPeriod(shift.id, user.id, startTimeDate);

    // Helper function to extract penalty by name from penalties array
    const extractPenalty = (name: string) => {
      const penalty = calculation.breakdown.penalties.find(p => 
        p.name.toLowerCase().includes(name.toLowerCase())
      );
      return penalty ? {
        hours: penalty.hours.toNumber(),
        rate: penalty.rate.toNumber(),
        amount: penalty.amount.toNumber()
      } : {
        hours: 0,
        rate: 0,
        amount: 0
      };
    };

    // Convert Decimal fields to numbers for frontend
    const shiftWithNumbers = {
      ...shift,
      regularHours: shift.regularHours?.toNumber() || null,
      overtimeHours: shift.overtimeHours?.toNumber() || null,
      penaltyHours: shift.penaltyHours?.toNumber() || null,
      grossPay: shift.grossPay?.toNumber() || null,
      superannuation: shift.superannuation?.toNumber() || null
    };

    return NextResponse.json({ 
      shift: shiftWithNumbers, 
      calculation: {
        ...calculation,
        breakdown: {
          ...calculation.breakdown,
          regularHours: {
            ...calculation.breakdown.regularHours,
            hours: calculation.breakdown.regularHours.hours.toNumber(),
            rate: calculation.breakdown.regularHours.rate.toNumber(),
            amount: calculation.breakdown.regularHours.amount.toNumber()
          },
          overtime1_5x: {
            ...calculation.breakdown.overtime1_5x,
            hours: calculation.breakdown.overtime1_5x.hours.toNumber(),
            rate: calculation.breakdown.overtime1_5x.rate.toNumber(),
            amount: calculation.breakdown.overtime1_5x.amount.toNumber()
          },
          overtime2x: {
            ...calculation.breakdown.overtime2x,
            hours: calculation.breakdown.overtime2x.hours.toNumber(),
            rate: calculation.breakdown.overtime2x.rate.toNumber(),
            amount: calculation.breakdown.overtime2x.amount.toNumber()
          },
          eveningPenalty: extractPenalty('evening'),
          nightPenalty: extractPenalty('night'),
          saturdayPenalty: extractPenalty('saturday'),
          sundayPenalty: extractPenalty('sunday'),
          publicHolidayPenalty: extractPenalty('holiday'),
          casualLoading: {
            ...calculation.breakdown.casualLoading,
            rate: calculation.breakdown.casualLoading.rate.toNumber(),
            amount: calculation.breakdown.casualLoading.amount.toNumber()
          },
          baseRate: calculation.breakdown.baseRate.toNumber(),
          // Also include the new penalties array structure for future use
          penalties: calculation.breakdown.penalties.map(p => ({
            id: p.id,
            name: p.name,
            hours: p.hours.toNumber(),
            rate: p.rate.toNumber(),
            amount: p.amount.toNumber()
          }))
        }
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Create shift error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function addShiftToPayPeriod(shiftId: string, userId: string, shiftDate: Date) {
  // Get the appropriate pay period for this shift date using PayPeriodService
  const payPeriodDates = await PayPeriodService.getPayPeriodForDate(shiftDate, userId);
  
  // Find or create pay period in database
  let payPeriod = await prisma.payPeriod.findFirst({
    where: {
      userId,
      startDate: payPeriodDates.startDate,
      endDate: payPeriodDates.endDate
    }
  });

  if (!payPeriod) {
    // Create new pay period using PayPeriodService data
    payPeriod = await prisma.payPeriod.create({
      data: {
        userId,
        startDate: payPeriodDates.startDate,
        endDate: payPeriodDates.endDate,
        payDate: payPeriodDates.payDate,
        status: 'OPEN'
      }
    });
  }

  // Add shift to pay period
  await prisma.payPeriodShift.upsert({
    where: {
      payPeriodId_shiftId: {
        payPeriodId: payPeriod.id,
        shiftId
      }
    },
    update: {},
    create: {
      payPeriodId: payPeriod.id,
      shiftId
    }
  });
}