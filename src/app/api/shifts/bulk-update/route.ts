import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface BulkUpdateRequest {
  shiftIds: string[];
  updates: {
    status?: string;
    location?: string;
    notes?: string;
  };
  notesMode?: 'replace' | 'append' | 'prepend';
}

export async function PUT(request: NextRequest) {
  try {
    const body: BulkUpdateRequest = await request.json();
    const { shiftIds, updates, notesMode = 'replace' } = body;

    if (!shiftIds || !Array.isArray(shiftIds) || shiftIds.length === 0) {
      return NextResponse.json(
        { error: 'shiftIds array is required and cannot be empty' },
        { status: 400 }
      );
    }

    if (!updates || Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'updates object is required and cannot be empty' },
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

    // Validate status values
    const validStatuses = ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
    if (updates.status && !validStatuses.includes(updates.status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
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
        id: true,
        notes: true
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

    // Handle notes update with different modes
    let finalUpdates: any = { ...updates };
    
    if (updates.notes !== undefined && notesMode !== 'replace') {
      // For append/prepend modes, we need to update each shift individually
      const updatePromises = existingShifts.map(shift => {
        const existingNotes = shift.notes || '';
        let newNotes = updates.notes!;
        
        if (notesMode === 'append') {
          newNotes = existingNotes ? `${existingNotes} ${newNotes}` : newNotes;
        } else if (notesMode === 'prepend') {
          newNotes = existingNotes ? `${newNotes} ${existingNotes}` : newNotes;
        }

        return prisma.shift.update({
          where: { id: shift.id },
          data: {
            ...finalUpdates,
            notes: newNotes
          }
        });
      });

      await Promise.all(updatePromises);
      
      return NextResponse.json({
        message: `Successfully updated ${existingShifts.length} shift${existingShifts.length !== 1 ? 's' : ''}`,
        updatedCount: existingShifts.length
      });
    } else {
      // For simple updates or replace mode, use updateMany
      const result = await prisma.shift.updateMany({
        where: {
          id: {
            in: shiftIds
          },
          userId: 'default-user' // TODO: Replace with actual user ID from auth
        },
        data: finalUpdates
      });

      return NextResponse.json({
        message: `Successfully updated ${result.count} shift${result.count !== 1 ? 's' : ''}`,
        updatedCount: result.count
      });
    }

  } catch (error) {
    console.error('Error updating shifts:', error);
    return NextResponse.json(
      { error: 'Failed to update shifts' },
      { status: 500 }
    );
  }
}