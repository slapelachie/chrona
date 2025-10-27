import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { prisma } from '@/lib/db'
import { buildPaygTaxCsv, buildStslTaxCsv } from '@/lib/export-csv'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const taxYear = searchParams.get('taxYear')
    const includeInactive = searchParams.get('includeInactive') === 'true'

    // Get the default user (single user app)
    const user = await prisma.user.findFirst()
    if (!user) {
      return NextResponse.json(
        { error: 'No user found. Please seed the database first.' },
        { status: 400 }
      )
    }

    // Get user's tax settings
    const taxSettings = await prisma.taxSettings.findUnique({
      where: { userId: user.id }
    })

    if (!taxSettings) {
      return NextResponse.json(
        { error: 'No tax settings found for user.' },
        { status: 400 }
      )
    }

    // Build where clause for tax data
    const taxDataWhere: any = {}
    if (taxYear) {
      taxDataWhere.taxYear = taxYear
    }
    if (!includeInactive) {
      taxDataWhere.isActive = true
    }

    // Fetch all tax-related data
    const [taxCoefficients, stslRates, taxRateConfigs] = await Promise.all([
      prisma.taxCoefficient.findMany({
        where: taxDataWhere,
        orderBy: [
          { taxYear: 'desc' },
          { scale: 'asc' },
          { earningsFrom: 'asc' }
        ]
      }),
      prisma.stslRate.findMany({
        where: taxDataWhere,
        orderBy: [
          { taxYear: 'desc' },
          { scale: 'asc' },
          { earningsFrom: 'asc' }
        ]
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

    const zip = new JSZip()
    zip.file('tax-data-payg.csv', paygCsv)
    zip.file('tax-data-stsl.csv', stslCsv)

    const buffer = await zip.generateAsync({ type: 'uint8array' })
    const filename = `chrona-tax-data-export-${new Date().toISOString().slice(0, 10)}.zip`
    
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer

    return new Response(arrayBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })

  } catch (error) {
    console.error('Error exporting tax data:', error)
    return NextResponse.json(
      { error: 'Failed to export tax data' },
      { status: 500 }
    )
  }
}
