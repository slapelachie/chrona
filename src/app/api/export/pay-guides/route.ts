import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { buildPayGuidesCsv } from '@/lib/export-csv'

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

    const csv = buildPayGuidesCsv(payGuides)

    const filename = `chrona-pay-guides-export-${new Date().toISOString().slice(0, 10)}.csv`
    
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
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
