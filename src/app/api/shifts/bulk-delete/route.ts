import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { shiftIds } = body;

    if (!shiftIds || !Array.isArray(shiftIds) || shiftIds.length === 0) {
      return NextResponse.json(
        { error: 'shiftIds array is required and cannot be empty' },
        { status: 400 }
      );
    }

    // Validate that all shiftIds are strings
    if (!shiftIds.every(id => typeof id === 'string')) {
      return NextResponse.json(
        { error: 'All shift IDs must be valid strings' },
        { status: 400 }
      );
    }

    // First, check if all shifts exist and belong to the user
    const existingShifts = await prisma.shift.findMany({
      where: {
        id: {
          in: shiftIds
        },
        userId: 'default-user' // TODO: Replace with actual user ID from auth
      },
      select: {
        id: true
      }
    });

    if (existingShifts.length !== shiftIds.length) {
      const foundIds = existingShifts.map(shift => shift.id);
      const notFoundIds = shiftIds.filter(id => !foundIds.includes(id));
      
      return NextResponse.json(
        { 
          error: 'Some shifts were not found or do not belong to you',
          notFound: notFoundIds
        },
        { status: 404 }
      );
    }

    // Delete all shifts in a transaction
    const result = await prisma.shift.deleteMany({
      where: {
        id: {
          in: shiftIds
        },
        userId: 'default-user' // TODO: Replace with actual user ID from auth
      }
    });

    return NextResponse.json({
      message: `Successfully deleted ${result.count} shift${result.count !== 1 ? 's' : ''}`,
      deletedCount: result.count
    });

  } catch (error) {
    console.error('Error deleting shifts:', error);
    return NextResponse.json(
      { error: 'Failed to delete shifts' },
      { status: 500 }
    );
  }
}