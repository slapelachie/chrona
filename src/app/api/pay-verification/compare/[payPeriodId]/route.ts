import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { PayPeriodCalculator } from '@/lib/calculations/pay-period-calculator';

const prisma = new PrismaClient();

// GET /api/pay-verification/compare/[payPeriodId] - Compare calculated vs actual pay for a pay period
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ payPeriodId: string }> }
) {
  try {
    const { payPeriodId } = await params;

    // Get the first user (single-user app)
    const user = await prisma.user.findFirst();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get pay period with all related data
    const payPeriod = await prisma.payPeriod.findFirst({
      where: {
        id: payPeriodId,
        userId: user.id
      },
      include: {
        shifts: {
          include: {
            shift: {
              include: {
                payGuide: true
              }
            }
          }
        },
        payVerifications: {
          orderBy: {
            verificationDate: 'desc'
          },
          take: 1
        }
      }
    });

    if (!payPeriod) {
      return NextResponse.json({ error: 'Pay period not found' }, { status: 404 });
    }

    // Calculate or get cached pay period totals
    let calculatedGross = payPeriod.totalGrossPay?.toNumber();
    let calculatedTax = payPeriod.totalTax?.toNumber();
    let calculatedNet = payPeriod.totalNetPay?.toNumber();
    let calculatedSuper = payPeriod.superannuation?.toNumber();
    let calculatedHECS = payPeriod.hecsRepayment?.toNumber();
    let calculatedMedicare = payPeriod.medicareLevy?.toNumber();

    // If not calculated yet, calculate now
    if (!calculatedGross) {
      // Get required data for calculator
      const payGuide = await prisma.payGuide.findFirst({ where: { userId: user.id, isActive: true } });
      const taxBrackets = await prisma.taxBracket.findMany({ where: { year: '2024-25' } });
      const hecsThresholds = await prisma.hECSThreshold.findMany({ where: { year: '2024-25' } });
      const publicHolidays = await prisma.publicHoliday.findMany();
      
      if (!payGuide) {
        throw new Error('Pay guide not found');
      }
      
      // Get penalty time frames for this pay guide
      const penaltyTimeFrames = await prisma.penaltyTimeFrame.findMany({
        where: { 
          payGuideId: payGuide.id, 
          isActive: true 
        }
      });

      const payGuideWithPenalties = {
        ...payGuide,
        penaltyTimeFrames
      };

      const calculator = new PayPeriodCalculator(payGuideWithPenalties, taxBrackets, hecsThresholds, publicHolidays, user);
      const shifts = payPeriod.shifts.map(ps => ps.shift);
      const calculation = calculator.calculatePayPeriod(shifts, payPeriod.startDate, payPeriod.endDate);
      
      calculatedGross = calculation.grossPay.toNumber();
      calculatedTax = calculation.incomeTax.plus(calculation.medicareLevy).plus(calculation.hecsRepayment).toNumber();
      calculatedNet = calculation.netPay.toNumber();
      calculatedSuper = calculation.superannuation.toNumber();
      calculatedHECS = calculation.hecsRepayment.toNumber();
      calculatedMedicare = calculation.medicareLevy.toNumber();

      // Update pay period with calculated values
      await prisma.payPeriod.update({
        where: { id: payPeriodId },
        data: {
          totalGrossPay: calculatedGross,
          totalTax: calculatedTax,
          totalNetPay: calculatedNet,
          superannuation: calculatedSuper,
          hecsRepayment: calculatedHECS,
          medicareLevy: calculatedMedicare
        }
      });
    }

    // Get the latest verification if exists
    const latestVerification = payPeriod.payVerifications[0] || null;

    // Build detailed breakdown
    const shiftsBreakdown = payPeriod.shifts.map(ps => {
      const shift = ps.shift;
      return {
        id: shift.id,
        date: shift.startTime.toISOString().split('T')[0],
        startTime: shift.startTime,
        endTime: shift.endTime,
        totalMinutes: shift.totalMinutes,
        regularHours: shift.regularHours?.toNumber() || 0,
        overtimeHours: shift.overtimeHours?.toNumber() || 0,
        penaltyHours: shift.penaltyHours?.toNumber() || 0,
        grossPay: shift.grossPay?.toNumber() || 0,
        superannuation: shift.superannuation?.toNumber() || 0,
        shiftType: shift.shiftType,
        baseRate: shift.payGuide.baseHourlyRate.toNumber(),
        casualLoading: shift.payGuide.casualLoading.toNumber(),
        notes: shift.notes
      };
    });

    // Calculate totals from shifts
    const totalHours = shiftsBreakdown.reduce((sum, shift) => 
      sum + shift.regularHours + shift.overtimeHours + shift.penaltyHours, 0
    );

    const response = {
      payPeriod: {
        id: payPeriod.id,
        startDate: payPeriod.startDate,
        endDate: payPeriod.endDate,
        payDate: payPeriod.payDate,
        status: payPeriod.status
      },
      calculated: {
        grossPay: calculatedGross,
        tax: calculatedTax,
        netPay: calculatedNet,
        superannuation: calculatedSuper,
        hecsRepayment: calculatedHECS || 0,
        medicareLevy: calculatedMedicare || 0,
        totalHours,
        shiftsCount: shiftsBreakdown.length,
        breakdown: {
          incomeTax: (calculatedTax || 0) - (calculatedMedicare || 0) - (calculatedHECS || 0),
          medicareLevy: calculatedMedicare || 0,
          hecsRepayment: calculatedHECS || 0
        }
      },
      actual: latestVerification ? {
        grossPay: latestVerification.actualGrossPay.toNumber(),
        tax: latestVerification.actualTax.toNumber(),
        netPay: latestVerification.actualNetPay.toNumber(),
        superannuation: latestVerification.actualSuper?.toNumber() || 0,
        hecsRepayment: latestVerification.actualHECS?.toNumber() || 0,
        paySlipReference: latestVerification.paySlipReference,
        verificationDate: latestVerification.verificationDate
      } : null,
      differences: latestVerification ? {
        grossPay: latestVerification.actualGrossPay.toNumber() - (calculatedGross || 0),
        tax: latestVerification.actualTax.toNumber() - (calculatedTax || 0),
        netPay: latestVerification.actualNetPay.toNumber() - (calculatedNet || 0),
        superannuation: (latestVerification.actualSuper?.toNumber() || 0) - (calculatedSuper || 0),
        hecsRepayment: (latestVerification.actualHECS?.toNumber() || 0) - (calculatedHECS || 0)
      } : null,
      shifts: shiftsBreakdown,
      hasVerification: !!latestVerification,
      verificationStatus: latestVerification?.status || 'PENDING',
      tolerance: 1.0 // $1 tolerance for discrepancy detection
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error comparing pay data:', error);
    return NextResponse.json(
      { error: 'Failed to compare pay data' },
      { status: 500 }
    );
  }
}