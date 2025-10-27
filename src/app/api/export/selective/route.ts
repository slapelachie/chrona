import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { prisma } from '@/lib/db'
import {
  buildShiftsCsv,
  buildPayGuidesCsv,
  buildPaygTaxCsv,
  buildStslTaxCsv,
  buildPayPeriodsCsv,
  buildPayPeriodExtrasCsv
} from '@/lib/export-csv'
import { serializeCsv } from '@/lib/csv-utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const includeShifts = searchParams.get('includeShifts') === 'true'
    const includePayGuides = searchParams.get('includePayGuides') === 'true'
    const includeTaxData = searchParams.get('includeTaxData') === 'true'
    const includePreferences = searchParams.get('includePreferences') === 'true'
    const includePayPeriods = searchParams.get('includePayPeriods') === 'true'

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

    if (includeTaxData || includePreferences) {
      const user = await prisma.user.findFirst()
      if (!user) {
        return NextResponse.json(
          { error: 'No user found for export' },
          { status: 400 }
        )
      }

      if (includePreferences) {
        const defaultExtras = await prisma.payPeriodExtraTemplate.findMany({
          where: { userId: user.id },
          orderBy: { sortOrder: 'asc' }
        })

        const preferencePayload = {
          version: 1,
          exportedAt,
          user: {
            name: user.name,
            email: user.email,
            timezone: user.timezone,
            payPeriodType: user.payPeriodType,
            defaultShiftLengthMinutes: user.defaultShiftLengthMinutes
          },
          defaultExtras: defaultExtras.map(template => ({
            label: template.label,
            description: template.description ?? undefined,
            amount: template.amount.toString(),
            taxable: template.taxable,
            active: template.active,
            sortOrder: template.sortOrder
          }))
        }

        zip.file('preferences.json', JSON.stringify(preferencePayload, null, 2))
        includedTypes.push('preferences')
      }

      if (includeTaxData) {
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
    }

    if (includePayPeriods) {
      const payPeriods = await prisma.payPeriod.findMany({
        include: {
          extras: true
        },
        orderBy: { startDate: 'desc' }
      })

      const payPeriodsCsv = buildPayPeriodsCsv(
        payPeriods.map(period => ({
          startDate: period.startDate,
          endDate: period.endDate,
          status: period.status,
          totalHours: period.totalHours,
          totalPay: period.totalPay,
          paygWithholding: period.paygWithholding,
          stslAmount: period.stslAmount,
          totalWithholdings: period.totalWithholdings,
          netPay: period.netPay,
          actualPay: period.actualPay
        }))
      )

      zip.file('pay-periods.csv', payPeriodsCsv)
      includedTypes.push('payPeriods')

      const extras = payPeriods.flatMap(period =>
        period.extras.map(extra => ({
          payPeriodStartDate: period.startDate,
          payPeriodEndDate: period.endDate,
          type: extra.type,
          description: extra.description,
          amount: extra.amount,
          taxable: extra.taxable
        }))
      )

      if (extras.length > 0) {
        const extrasCsv = buildPayPeriodExtrasCsv(extras)
        zip.file('pay-period-extras.csv', extrasCsv)
        includedTypes.push('payPeriodExtras')
      }
    }

    const manifestRows: Array<[string, string]> = [
      ['exportedAt', exportedAt],
      ['includeShifts', includeShifts ? 'true' : 'false'],
      ['includePayGuides', includePayGuides ? 'true' : 'false'],
      ['includeTaxData', includeTaxData ? 'true' : 'false'],
      ['includePreferences', includePreferences ? 'true' : 'false'],
      ['includePayPeriods', includePayPeriods ? 'true' : 'false'],
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
