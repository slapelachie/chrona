import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, VerificationStatus } from '@prisma/client';
import { PayPeriodCalculator } from '@/lib/calculations/pay-period-calculator';

const prisma = new PrismaClient();

// GET /api/pay-verification - List all pay verifications
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = searchParams.get('limit');

    // Get the first user (single-user app)
    const user = await prisma.user.findFirst();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Build query filters
    const where: { userId: string; status?: VerificationStatus } = {
      userId: user.id,
    };

    if (status) {
      where.status = status.toUpperCase() as VerificationStatus;
    }

    // Query pay verifications with related data
    const verifications = await prisma.payVerification.findMany({
      where,
      include: {
        payPeriod: true
      },
      orderBy: {
        verificationDate: 'desc'
      },
      take: limit ? parseInt(limit) : undefined
    });

    // Calculate discrepancies for each verification
    const verificationsWithDiscrepancies = verifications.map(verification => {
      // Calculate differences
      const grossPayDifference = verification.actualGrossPay.toNumber() - (verification.payPeriod.totalGrossPay?.toNumber() || 0);
      const taxDifference = verification.actualTax.toNumber() - (verification.payPeriod.totalTax?.toNumber() || 0);
      const netPayDifference = verification.actualNetPay.toNumber() - (verification.payPeriod.totalNetPay?.toNumber() || 0);

      return {
        ...verification,
        calculatedGrossPay: verification.payPeriod.totalGrossPay?.toNumber() || 0,
        calculatedTax: verification.payPeriod.totalTax?.toNumber() || 0,
        calculatedNetPay: verification.payPeriod.totalNetPay?.toNumber() || 0,
        grossPayDifference,
        taxDifference,
        netPayDifference,
        hasDiscrepancy: Math.abs(grossPayDifference) > 1 || Math.abs(taxDifference) > 1 || Math.abs(netPayDifference) > 1
      };
    });

    return NextResponse.json({
      verifications: verificationsWithDiscrepancies,
      summary: {
        total: verifications.length,
        pending: verifications.filter(v => v.status === VerificationStatus.PENDING).length,
        matched: verifications.filter(v => v.status === VerificationStatus.MATCHED).length,
        discrepancies: verifications.filter(v => v.status === VerificationStatus.DISCREPANCY).length,
        resolved: verifications.filter(v => v.status === VerificationStatus.RESOLVED).length,
      }
    });

  } catch (error) {
    console.error('Error fetching pay verifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pay verifications' },
      { status: 500 }
    );
  }
}

// POST /api/pay-verification - Create a new pay verification
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      payPeriodId,
      actualGrossPay,
      actualTax,
      actualNetPay,
      actualSuper,
      actualHECS,
      paySlipReference,
      notes
    } = body;

    // Validate required fields
    if (!payPeriodId || actualGrossPay === undefined || actualTax === undefined || actualNetPay === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: payPeriodId, actualGrossPay, actualTax, actualNetPay' },
        { status: 400 }
      );
    }

    // Get the first user (single-user app)
    const user = await prisma.user.findFirst();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify pay period exists and belongs to user
    const payPeriod = await prisma.payPeriod.findFirst({
      where: {
        id: payPeriodId,
        userId: user.id
      },
      include: {
        shifts: {
          include: {
            shift: true
          }
        }
      }
    });

    if (!payPeriod) {
      return NextResponse.json({ error: 'Pay period not found' }, { status: 404 });
    }

    // Calculate expected values if not already calculated
    let calculatedGross = payPeriod.totalGrossPay?.toNumber() || 0;
    let calculatedTax = payPeriod.totalTax?.toNumber() || 0;
    let calculatedNet = payPeriod.totalNetPay?.toNumber() || 0;

    if (!payPeriod.totalGrossPay) {
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

      // Calculate pay period
      const calculator = new PayPeriodCalculator(payGuideWithPenalties, taxBrackets, hecsThresholds, publicHolidays, user);
      const shifts = payPeriod.shifts.map(ps => ps.shift);
      const calculation = calculator.calculatePayPeriod(shifts, payPeriod.startDate, payPeriod.endDate);
      
      calculatedGross = calculation.grossPay.toNumber();
      calculatedTax = calculation.incomeTax.plus(calculation.medicareLevy).plus(calculation.hecsRepayment).toNumber();
      calculatedNet = calculation.netPay.toNumber();

      // Update pay period with calculated values
      await prisma.payPeriod.update({
        where: { id: payPeriodId },
        data: {
          totalGrossPay: calculatedGross,
          totalTax: calculatedTax,
          totalNetPay: calculatedNet,
          superannuation: calculation.superannuation.toNumber(),
          hecsRepayment: calculation.hecsRepayment.toNumber(),
          medicareLevy: calculation.medicareLevy.toNumber()
        }
      });
    }

    // Calculate discrepancies
    const grossPayDifference = parseFloat(actualGrossPay) - calculatedGross;
    const taxDifference = parseFloat(actualTax) - calculatedTax;
    const netPayDifference = parseFloat(actualNetPay) - calculatedNet;

    // Determine status based on discrepancies (tolerance of $1)
    const tolerance = 1.0;
    const hasDiscrepancy = Math.abs(grossPayDifference) > tolerance || 
                          Math.abs(taxDifference) > tolerance || 
                          Math.abs(netPayDifference) > tolerance;

    const status = hasDiscrepancy ? VerificationStatus.DISCREPANCY : VerificationStatus.MATCHED;

    // Create pay verification record
    const verification = await prisma.payVerification.create({
      data: {
        userId: user.id,
        payPeriodId,
        actualGrossPay: parseFloat(actualGrossPay),
        actualTax: parseFloat(actualTax),
        actualNetPay: parseFloat(actualNetPay),
        actualSuper: actualSuper ? parseFloat(actualSuper) : null,
        actualHECS: actualHECS ? parseFloat(actualHECS) : null,
        paySlipReference: paySlipReference || null,
        notes: notes || null,
        status,
        grossPayDifference,
        taxDifference,
        netPayDifference
      },
      include: {
        payPeriod: true
      }
    });

    return NextResponse.json({
      verification: {
        ...verification,
        calculatedGrossPay: calculatedGross,
        calculatedTax: calculatedTax,
        calculatedNetPay: calculatedNet,
        hasDiscrepancy
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating pay verification:', error);
    return NextResponse.json(
      { error: 'Failed to create pay verification' },
      { status: 500 }
    );
  }
}