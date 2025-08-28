import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// POST /api/pay-rates/[id]/duplicate - Duplicate pay guide
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  try {
    const body = await request.json();

    // Get the original pay guide
    const originalPayGuide = await prisma.payGuide.findUnique({
      where: { id: params.id }
    });

    if (!originalPayGuide) {
      return NextResponse.json({ error: 'Pay guide not found' }, { status: 404 });
    }

    // Create duplicate with new name
    const duplicateName = body.name || `${originalPayGuide.name} (Copy)`;
    
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...payGuideData } = originalPayGuide;
    
    const duplicatePayGuide = await prisma.payGuide.create({
      data: {
        ...payGuideData,
        name: duplicateName,
        isActive: false, // New duplicates start as inactive
        effectiveFrom: new Date(), // Set to current date
        effectiveTo: null // Clear end date
      }
    });

    return NextResponse.json(duplicatePayGuide, { status: 201 });
  } catch (error) {
    console.error('Error duplicating pay guide:', error);
    return NextResponse.json(
      { error: 'Failed to duplicate pay guide' },
      { status: 500 }
    );
  }
}