import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/pay-verification/[id] - Get individual pay verification
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get the first user (single-user app)
    const user = await prisma.user.findFirst();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Find verification with related data
    const verification = await prisma.payVerification.findFirst({
      where: {
        id,
        userId: user.id
      },
      include: {
        payPeriod: {
          include: {
            shifts: {
              include: {
                shift: {
                  include: {
                    payGuide: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!verification) {
      return NextResponse.json({ error: 'Pay verification not found' }, { status: 404 });
    }

    // Calculate detailed breakdown
    const calculatedGrossPay = verification.payPeriod.totalGrossPay?.toNumber() || 0;
    const calculatedTax = verification.payPeriod.totalTax?.toNumber() || 0;
    const calculatedNetPay = verification.payPeriod.totalNetPay?.toNumber() || 0;
    const calculatedSuper = verification.payPeriod.superannuation?.toNumber() || 0;

    const response = {
      ...verification,
      calculatedGrossPay,
      calculatedTax,
      calculatedNetPay,
      calculatedSuper,
      grossPayDifference: verification.actualGrossPay.toNumber() - calculatedGrossPay,
      taxDifference: verification.actualTax.toNumber() - calculatedTax,
      netPayDifference: verification.actualNetPay.toNumber() - calculatedNetPay,
      superDifference: (verification.actualSuper?.toNumber() || 0) - calculatedSuper,
      hasDiscrepancy: verification.status === 'DISCREPANCY',
      shifts: verification.payPeriod.shifts.map(ps => ({
        id: ps.shift.id,
        startTime: ps.shift.startTime,
        endTime: ps.shift.endTime,
        totalMinutes: ps.shift.totalMinutes,
        regularHours: ps.shift.regularHours?.toNumber(),
        overtimeHours: ps.shift.overtimeHours?.toNumber(),
        penaltyHours: ps.shift.penaltyHours?.toNumber(),
        grossPay: ps.shift.grossPay?.toNumber(),
        shiftType: ps.shift.shiftType,
        baseRate: ps.shift.payGuide.baseHourlyRate.toNumber()
      }))
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching pay verification:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pay verification' },
      { status: 500 }
    );
  }
}

// PUT /api/pay-verification/[id] - Update pay verification
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      actualGrossPay,
      actualTax,
      actualNetPay,
      actualSuper,
      actualHECS,
      paySlipReference,
      notes,
      status
    } = body;

    // Get the first user (single-user app)
    const user = await prisma.user.findFirst();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify verification exists and belongs to user
    const existingVerification = await prisma.payVerification.findFirst({
      where: {
        id,
        userId: user.id
      },
      include: {
        payPeriod: true
      }
    });

    if (!existingVerification) {
      return NextResponse.json({ error: 'Pay verification not found' }, { status: 404 });
    }

    // Calculate new discrepancies if amounts changed
    let updateData: {
      paySlipReference?: string | null;
      notes?: string | null;
      actualGrossPay?: number;
      actualTax?: number;
      actualNetPay?: number;
      actualSuper?: number | null;
      actualHECS?: number | null;
      grossPayDifference?: number;
      taxDifference?: number;
      netPayDifference?: number;
      status?: string;
    } = {
      paySlipReference: paySlipReference || null,
      notes: notes || null
    };

    if (actualGrossPay !== undefined || actualTax !== undefined || actualNetPay !== undefined) {
      const newGross = actualGrossPay !== undefined ? parseFloat(actualGrossPay) : existingVerification.actualGrossPay.toNumber();
      const newTax = actualTax !== undefined ? parseFloat(actualTax) : existingVerification.actualTax.toNumber();
      const newNet = actualNetPay !== undefined ? parseFloat(actualNetPay) : existingVerification.actualNetPay.toNumber();

      const calculatedGross = existingVerification.payPeriod.totalGrossPay?.toNumber() || 0;
      const calculatedTax = existingVerification.payPeriod.totalTax?.toNumber() || 0;
      const calculatedNet = existingVerification.payPeriod.totalNetPay?.toNumber() || 0;

      const grossPayDifference = newGross - calculatedGross;
      const taxDifference = newTax - calculatedTax;
      const netPayDifference = newNet - calculatedNet;

      // Determine new status if not explicitly provided
      const tolerance = 1.0;
      const hasDiscrepancy = Math.abs(grossPayDifference) > tolerance || 
                            Math.abs(taxDifference) > tolerance || 
                            Math.abs(netPayDifference) > tolerance;

      updateData = {
        ...updateData,
        actualGrossPay: newGross,
        actualTax: newTax,
        actualNetPay: newNet,
        actualSuper: actualSuper !== undefined ? parseFloat(actualSuper) : existingVerification.actualSuper,
        actualHECS: actualHECS !== undefined ? parseFloat(actualHECS) : existingVerification.actualHECS,
        grossPayDifference,
        taxDifference,
        netPayDifference,
        status: status || (hasDiscrepancy ? 'DISCREPANCY' : 'MATCHED')
      };
    } else if (status) {
      updateData.status = status;
    }

    // Update verification
    const updatedVerification = await prisma.payVerification.update({
      where: { id },
      data: updateData,
      include: {
        payPeriod: true
      }
    });

    return NextResponse.json({
      verification: {
        ...updatedVerification,
        calculatedGrossPay: existingVerification.payPeriod.totalGrossPay?.toNumber() || 0,
        calculatedTax: existingVerification.payPeriod.totalTax?.toNumber() || 0,
        calculatedNetPay: existingVerification.payPeriod.totalNetPay?.toNumber() || 0,
        hasDiscrepancy: updatedVerification.status === 'DISCREPANCY'
      }
    });

  } catch (error) {
    console.error('Error updating pay verification:', error);
    return NextResponse.json(
      { error: 'Failed to update pay verification' },
      { status: 500 }
    );
  }
}

// DELETE /api/pay-verification/[id] - Delete pay verification
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get the first user (single-user app)
    const user = await prisma.user.findFirst();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify verification exists and belongs to user
    const verification = await prisma.payVerification.findFirst({
      where: {
        id,
        userId: user.id
      }
    });

    if (!verification) {
      return NextResponse.json({ error: 'Pay verification not found' }, { status: 404 });
    }

    // Delete verification
    await prisma.payVerification.delete({
      where: { id }
    });

    return NextResponse.json({ message: 'Pay verification deleted successfully' });

  } catch (error) {
    console.error('Error deleting pay verification:', error);
    return NextResponse.json(
      { error: 'Failed to delete pay verification' },
      { status: 500 }
    );
  }
}