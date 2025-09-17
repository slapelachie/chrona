import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ExportPayGuidesResponse } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const includeInactive = searchParams.get('includeInactive') === 'true'
    const includeExpired = searchParams.get('includeExpired') === 'true'

    const where: any = {}

    if (!includeInactive) {
      where.isActive = true
    }

    if (!includeExpired) {
      where.OR = [
        { effectiveTo: null },
        { effectiveTo: { gte: new Date() } }
      ]
    }

    const payGuides = await prisma.payGuide.findMany({
      where,
      include: {
        penaltyTimeFrames: {
          orderBy: { name: 'asc' }
        },
        overtimeTimeFrames: {
          orderBy: { name: 'asc' }
        },
        publicHolidays: {
          orderBy: { date: 'asc' }
        }
      },
      orderBy: { name: 'asc' }
    })

    const exportData: ExportPayGuidesResponse = {
      payGuides: payGuides.map(guide => ({
        id: guide.id,
        name: guide.name,
        baseRate: guide.baseRate.toString(),
        minimumShiftHours: guide.minimumShiftHours || undefined,
        maximumShiftHours: guide.maximumShiftHours || undefined,
        description: guide.description || undefined,
        effectiveFrom: guide.effectiveFrom.toISOString(),
        effectiveTo: guide.effectiveTo?.toISOString(),
        timezone: guide.timezone,
        isActive: guide.isActive,
        penaltyTimeFrames: guide.penaltyTimeFrames.map(ptf => ({
          name: ptf.name,
          multiplier: ptf.multiplier.toString(),
          dayOfWeek: ptf.dayOfWeek || undefined,
          startTime: ptf.startTime || undefined,
          endTime: ptf.endTime || undefined,
          isPublicHoliday: ptf.isPublicHoliday,
          description: ptf.description || undefined,
          isActive: ptf.isActive
        })),
        overtimeTimeFrames: guide.overtimeTimeFrames.map(otf => ({
          name: otf.name,
          firstThreeHoursMult: otf.firstThreeHoursMult.toString(),
          afterThreeHoursMult: otf.afterThreeHoursMult.toString(),
          dayOfWeek: otf.dayOfWeek || undefined,
          startTime: otf.startTime || undefined,
          endTime: otf.endTime || undefined,
          isPublicHoliday: otf.isPublicHoliday,
          description: otf.description || undefined,
          isActive: otf.isActive
        })),
        publicHolidays: guide.publicHolidays.map(ph => ({
          name: ph.name,
          date: ph.date.toISOString().split('T')[0],
          isActive: ph.isActive
        }))
      })),
      metadata: {
        exportedAt: new Date().toISOString(),
        totalPayGuides: payGuides.length
      }
    }

    const filename = `chrona-pay-guides-export-${new Date().toISOString().slice(0, 10)}.json`
    
    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })

  } catch (error) {
    console.error('Error exporting pay guides:', error)
    return NextResponse.json(
      { error: 'Failed to export pay guides' },
      { status: 500 }
    )
  }
}