import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ExportTaxDataResponse } from '@/types'

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
    const [taxCoefficients, hecsThresholds, stslRates, taxRateConfigs] = await Promise.all([
      prisma.taxCoefficient.findMany({
        where: taxDataWhere,
        orderBy: [
          { taxYear: 'desc' },
          { scale: 'asc' },
          { earningsFrom: 'asc' }
        ]
      }),
      prisma.hecsThreshold.findMany({
        where: taxDataWhere,
        orderBy: [
          { taxYear: 'desc' },
          { incomeFrom: 'asc' }
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

    const includedTaxYears = Array.from(new Set([
      ...taxCoefficients.map(tc => tc.taxYear),
      ...hecsThresholds.map(ht => ht.taxYear),
      ...stslRates.map(sr => sr.taxYear),
      ...taxRateConfigs.map(trc => trc.taxYear)
    ])).sort().reverse()

    const exportData: ExportTaxDataResponse = {
      taxSettings: {
        claimedTaxFreeThreshold: taxSettings.claimedTaxFreeThreshold,
        isForeignResident: taxSettings.isForeignResident,
        hasTaxFileNumber: taxSettings.hasTaxFileNumber,
        medicareExemption: taxSettings.medicareExemption,
        hecsHelpRate: taxSettings.hecsHelpRate?.toString()
      },
      taxCoefficients: taxCoefficients.map(tc => ({
        taxYear: tc.taxYear,
        scale: tc.scale,
        earningsFrom: tc.earningsFrom.toString(),
        earningsTo: tc.earningsTo?.toString(),
        coefficientA: tc.coefficientA.toString(),
        coefficientB: tc.coefficientB.toString(),
        description: tc.description || undefined,
        isActive: tc.isActive
      })),
      hecsThresholds: hecsThresholds.map(ht => ({
        taxYear: ht.taxYear,
        incomeFrom: ht.incomeFrom.toString(),
        incomeTo: ht.incomeTo?.toString(),
        rate: ht.rate.toString(),
        description: ht.description || undefined,
        isActive: ht.isActive
      })),
      stslRates: stslRates.map(sr => ({
        taxYear: sr.taxYear,
        scale: sr.scale,
        earningsFrom: sr.earningsFrom.toString(),
        earningsTo: sr.earningsTo?.toString(),
        coefficientA: sr.coefficientA.toString(),
        coefficientB: sr.coefficientB.toString(),
        description: sr.description || undefined,
        isActive: sr.isActive
      })),
      taxRateConfigs: taxRateConfigs.map(trc => ({
        taxYear: trc.taxYear,
        medicareRate: trc.medicareRate.toString(),
        medicareLowIncomeThreshold: trc.medicareLowIncomeThreshold.toString(),
        medicareHighIncomeThreshold: trc.medicareHighIncomeThreshold.toString(),
        description: trc.description || undefined,
        isActive: trc.isActive
      })),
      metadata: {
        exportedAt: new Date().toISOString(),
        includedTaxYears
      }
    }

    const filename = `chrona-tax-data-export-${new Date().toISOString().slice(0, 10)}.json`
    
    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
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