import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { buildShiftsCsv } from '@/lib/export-csv'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const payGuideId = searchParams.get('payGuideId')
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const where: any = {}

    if (startDate || endDate) {
      where.startTime = {}
      if (startDate) where.startTime.gte = new Date(startDate)
      if (endDate) where.startTime.lte = new Date(endDate)
    }

    if (payGuideId) {
      where.payGuideId = payGuideId
    }

    if (!includeInactive) {
      where.payGuide = {
        isActive: true
      }
    }

    const shifts = await prisma.shift.findMany({
      where,
      include: {
        payGuide: {
          select: {
            name: true,
            isActive: true
          }
        },
        breakPeriods: {
          orderBy: { startTime: 'asc' }
        },
        penaltySegments: {
          orderBy: { startTime: 'asc' }
        },
        overtimeSegments: {
          orderBy: { startTime: 'asc' }
        }
      },
      orderBy: { startTime: 'desc' }
    })

    const csv = buildShiftsCsv(shifts)

    const filename = `chrona-shifts-export-${new Date().toISOString().slice(0, 10)}.csv`
    
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })

  } catch (error) {
    console.error('Error exporting shifts:', error)
    return NextResponse.json(
      { error: 'Failed to export shifts' },
      { status: 500 }
    )
  }
}
