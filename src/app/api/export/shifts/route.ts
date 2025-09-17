import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ExportShiftsResponse } from '@/types'

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

    const exportData: ExportShiftsResponse = {
      shifts: shifts.map(shift => ({
        id: shift.id,
        payGuideId: shift.payGuideId,
        payGuideName: shift.payGuide.name,
        startTime: shift.startTime.toISOString(),
        endTime: shift.endTime.toISOString(),
        totalHours: shift.totalHours?.toString(),
        basePay: shift.basePay?.toString(),
        overtimePay: shift.overtimePay?.toString(),
        penaltyPay: shift.penaltyPay?.toString(),
        totalPay: shift.totalPay?.toString(),
        notes: shift.notes || undefined,
        breakPeriods: shift.breakPeriods.map(bp => ({
          startTime: bp.startTime.toISOString(),
          endTime: bp.endTime.toISOString()
        })),
        penaltySegments: shift.penaltySegments.map(ps => ({
          name: ps.name,
          multiplier: ps.multiplier.toString(),
          hours: ps.hours.toString(),
          pay: ps.pay.toString(),
          startTime: ps.startTime.toISOString(),
          endTime: ps.endTime.toISOString()
        })),
        overtimeSegments: shift.overtimeSegments.map(os => ({
          name: os.name,
          multiplier: os.multiplier.toString(),
          hours: os.hours.toString(),
          pay: os.pay.toString(),
          startTime: os.startTime.toISOString(),
          endTime: os.endTime.toISOString()
        }))
      })),
      metadata: {
        exportedAt: new Date().toISOString(),
        totalShifts: shifts.length,
        dateRange: shifts.length > 0 ? {
          earliest: shifts[shifts.length - 1].startTime.toISOString(),
          latest: shifts[0].startTime.toISOString()
        } : {
          earliest: new Date().toISOString(),
          latest: new Date().toISOString()
        }
      }
    }

    const filename = `chrona-shifts-export-${new Date().toISOString().slice(0, 10)}.json`
    
    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
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