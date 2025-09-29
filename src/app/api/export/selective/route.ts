import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { prisma } from '@/lib/db'
import { buildShiftsCsv, buildPayGuidesCsv, buildPaygTaxCsv, buildStslTaxCsv } from '@/lib/export-csv'
import { serializeCsv } from '@/lib/csv-utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const includeShifts = searchParams.get('includeShifts') === 'true'
    const includePayGuides = searchParams.get('includePayGuides') === 'true'
    const includeTaxData = searchParams.get('includeTaxData') === 'true'

    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const exportedAt = new Date().toISOString()
    const zip = new JSZip()
    const includedTypes: string[] = []

    if (includeShifts) {
      const shiftsWhere: any = {}

      if (startDate || endDate) {
        shiftsWhere.startTime = {}
        if (startDate) shiftsWhere.startTime.gte = new Date(startDate)
        if (endDate) shiftsWhere.startTime.lte = new Date(endDate)
      }

      if (!includeInactive) {
        shiftsWhere.payGuide = { isActive: true }
      }

      const shifts = await prisma.shift.findMany({
        where: shiftsWhere,
        include: {
          payGuide: { select: { name: true, isActive: true } },
          breakPeriods: { orderBy: { startTime: 'asc' } },
          penaltySegments: { orderBy: { startTime: 'asc' } },
          overtimeSegments: { orderBy: { startTime: 'asc' } }
        },
        orderBy: { startTime: 'desc' }
      })

      const shiftsCsv = buildShiftsCsv(shifts)
      zip.file('shifts.csv', shiftsCsv)
      includedTypes.push('shifts')
    }

    if (includePayGuides) {
      const payGuidesWhere: any = {}
      if (!includeInactive) {
        payGuidesWhere.isActive = true
      }

      const payGuides = await prisma.payGuide.findMany({
        where: payGuidesWhere,
        include: {
          penaltyTimeFrames: { orderBy: { name: 'asc' } },
          overtimeTimeFrames: { orderBy: { name: 'asc' } },
          publicHolidays: { orderBy: { date: 'asc' } }
        },
        orderBy: { name: 'asc' }
      })

      const payGuidesCsv = buildPayGuidesCsv(payGuides)
      zip.file('pay-guides.csv', payGuidesCsv)
      includedTypes.push('payGuides')
    }

    if (includeTaxData) {
      const user = await prisma.user.findFirst()
      if (!user) {
        return NextResponse.json(
          { error: 'No user found for tax data export' },
          { status: 400 }
        )
      }

      const taxSettings = await prisma.taxSettings.findUnique({
        where: { userId: user.id }
      })

      if (!taxSettings) {
        return NextResponse.json(
          { error: 'No tax settings found for user.' },
          { status: 400 }
        )
      }

      const taxDataWhere: any = {}
      if (!includeInactive) {
        taxDataWhere.isActive = true
      }

      const [taxCoefficients, stslRates, taxRateConfigs] = await Promise.all([
        prisma.taxCoefficient.findMany({
          where: taxDataWhere,
          orderBy: [{ taxYear: 'desc' }, { scale: 'asc' }, { earningsFrom: 'asc' }]
        }),
        prisma.stslRate.findMany({
          where: taxDataWhere,
          orderBy: [{ taxYear: 'desc' }, { scale: 'asc' }, { earningsFrom: 'asc' }]
        }),
        prisma.taxRateConfig.findMany({
          where: taxDataWhere,
          orderBy: { taxYear: 'desc' }
        })
      ])

      const paygCsv = buildPaygTaxCsv(
        {
          claimedTaxFreeThreshold: taxSettings.claimedTaxFreeThreshold,
          isForeignResident: taxSettings.isForeignResident,
          hasTaxFileNumber: taxSettings.hasTaxFileNumber,
          medicareExemption: taxSettings.medicareExemption
        },
        taxCoefficients,
        taxRateConfigs
      )

      const stslCsv = buildStslTaxCsv(stslRates)

      zip.file('tax-data-payg.csv', paygCsv)
      zip.file('tax-data-stsl.csv', stslCsv)
      includedTypes.push('taxDataPayg', 'taxDataStsl')
    }

    const manifestRows: Array<[string, string]> = [
      ['exportedAt', exportedAt],
      ['includeShifts', includeShifts ? 'true' : 'false'],
      ['includePayGuides', includePayGuides ? 'true' : 'false'],
      ['includeTaxData', includeTaxData ? 'true' : 'false'],
      ['startDate', startDate ?? ''],
      ['endDate', endDate ?? ''],
      ['includeInactive', includeInactive ? 'true' : 'false'],
      ['includedTypes', includedTypes.join(';')]
    ]

    zip.file('manifest.csv', serializeCsv([['field', 'value'], ...manifestRows]))

    const buffer = await zip.generateAsync({ type: 'uint8array' })
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
    const filename = `chrona-selective-export-${exportedAt.slice(0, 10)}.zip`

    return new Response(arrayBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })
  } catch (error) {
    console.error('Error in selective export:', error)
    return NextResponse.json(
      { error: 'Failed to export selected data' },
      { status: 500 }
    )
  }
}
