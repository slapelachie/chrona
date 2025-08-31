import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/user/preferences - Get user preferences
export async function GET() {
  try {
    // In a real app, get userId from authentication
    // For now, get the first user
    const user = await prisma.user.findFirst({
      select: {
        id: true,
        lastUsedPayGuideId: true,
        defaultPayGuideId: true,
        claimsTaxFreeThreshold: true,
        hasHECSDebt: true,
        hasStudentFinancialSupplement: true,
        medicareLevyExemption: true,
        payPeriodFrequency: true,
        payPeriodStartDay: true
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get pay guide names for the IDs
    const payGuideIds = [user.lastUsedPayGuideId, user.defaultPayGuideId].filter(Boolean);
    const payGuides = payGuideIds.length > 0 ? await prisma.payGuide.findMany({
      where: {
        id: {
          in: payGuideIds as string[]
        }
      },
      select: {
        id: true,
        name: true,
        baseHourlyRate: true,
        isActive: true
      }
    }) : [];

    const preferences = {
      userId: user.id,
      lastUsedPayGuideId: user.lastUsedPayGuideId,
      defaultPayGuideId: user.defaultPayGuideId,
      taxSettings: {
        claimsTaxFreeThreshold: user.claimsTaxFreeThreshold,
        hasHECSDebt: user.hasHECSDebt,
        hasStudentFinancialSupplement: user.hasStudentFinancialSupplement,
        medicareLevyExemption: user.medicareLevyExemption
      },
      payPeriodSettings: {
        frequency: user.payPeriodFrequency,
        startDay: user.payPeriodStartDay
      },
      payGuides: payGuides.reduce((acc, guide) => {
        acc[guide.id] = {
          name: guide.name,
          baseHourlyRate: guide.baseHourlyRate,
          isActive: guide.isActive
        };
        return acc;
      }, {} as Record<string, { name: string; baseHourlyRate: unknown; isActive: boolean }>)
    };

    return NextResponse.json(preferences);
  } catch (error) {
    console.error('Error fetching user preferences:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user preferences' },
      { status: 500 }
    );
  }
}

// PUT /api/user/preferences - Update user preferences
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    // In a real app, get userId from authentication
    const user = await prisma.user.findFirst();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Validate pay guide IDs exist if provided
    const payGuideIds = [body.lastUsedPayGuideId, body.defaultPayGuideId].filter(Boolean);
    if (payGuideIds.length > 0) {
      const existingPayGuides = await prisma.payGuide.findMany({
        where: {
          id: { in: payGuideIds },
          userId: user.id
        },
        select: { id: true }
      });

      const existingIds = existingPayGuides.map(pg => pg.id);
      const invalidIds = payGuideIds.filter(id => !existingIds.includes(id));
      
      if (invalidIds.length > 0) {
        return NextResponse.json(
          { error: `Invalid pay guide IDs: ${invalidIds.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};
    
    if (body.lastUsedPayGuideId !== undefined) {
      updateData.lastUsedPayGuideId = body.lastUsedPayGuideId;
    }
    
    if (body.defaultPayGuideId !== undefined) {
      updateData.defaultPayGuideId = body.defaultPayGuideId;
    }

    // Tax settings
    if (body.taxSettings) {
      const { taxSettings } = body;
      if (taxSettings.claimsTaxFreeThreshold !== undefined) {
        updateData.claimsTaxFreeThreshold = taxSettings.claimsTaxFreeThreshold;
      }
      if (taxSettings.hasHECSDebt !== undefined) {
        updateData.hasHECSDebt = taxSettings.hasHECSDebt;
      }
      if (taxSettings.hasStudentFinancialSupplement !== undefined) {
        updateData.hasStudentFinancialSupplement = taxSettings.hasStudentFinancialSupplement;
      }
      if (taxSettings.medicareLevyExemption !== undefined) {
        updateData.medicareLevyExemption = taxSettings.medicareLevyExemption;
      }
    }

    // Pay period settings
    if (body.payPeriodSettings) {
      const { payPeriodSettings } = body;
      if (payPeriodSettings.frequency !== undefined) {
        // Validate frequency value
        const validFrequencies = ['weekly', 'fortnightly', 'monthly'];
        if (validFrequencies.includes(payPeriodSettings.frequency)) {
          updateData.payPeriodFrequency = payPeriodSettings.frequency;
        } else {
          return NextResponse.json(
            { error: 'Invalid pay period frequency. Must be weekly, fortnightly, or monthly' },
            { status: 400 }
          );
        }
      }
      if (payPeriodSettings.startDay !== undefined) {
        // Validate start day (0-6)
        if (payPeriodSettings.startDay >= 0 && payPeriodSettings.startDay <= 6) {
          updateData.payPeriodStartDay = payPeriodSettings.startDay;
        } else {
          return NextResponse.json(
            { error: 'Invalid pay period start day. Must be between 0 (Sunday) and 6 (Saturday)' },
            { status: 400 }
          );
        }
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      select: {
        id: true,
        lastUsedPayGuideId: true,
        defaultPayGuideId: true,
        claimsTaxFreeThreshold: true,
        hasHECSDebt: true,
        hasStudentFinancialSupplement: true,
        medicareLevyExemption: true,
        payPeriodFrequency: true,
        payPeriodStartDay: true
      }
    });

    return NextResponse.json({
      message: 'Preferences updated successfully',
      preferences: {
        userId: updatedUser.id,
        lastUsedPayGuideId: updatedUser.lastUsedPayGuideId,
        defaultPayGuideId: updatedUser.defaultPayGuideId,
        taxSettings: {
          claimsTaxFreeThreshold: updatedUser.claimsTaxFreeThreshold,
          hasHECSDebt: updatedUser.hasHECSDebt,
          hasStudentFinancialSupplement: updatedUser.hasStudentFinancialSupplement,
          medicareLevyExemption: updatedUser.medicareLevyExemption
        },
        payPeriodSettings: {
          frequency: updatedUser.payPeriodFrequency,
          startDay: updatedUser.payPeriodStartDay
        }
      }
    });
  } catch (error) {
    console.error('Error updating user preferences:', error);
    return NextResponse.json(
      { error: 'Failed to update user preferences' },
      { status: 500 }
    );
  }
}