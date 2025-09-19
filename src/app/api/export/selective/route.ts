import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parse what data types to include
    const includeUser = searchParams.get('includeUser') === 'true'
    const includeShifts = searchParams.get('includeShifts') === 'true'
    const includePayGuides = searchParams.get('includePayGuides') === 'true'
    const includePayPeriods = searchParams.get('includePayPeriods') === 'true'
    const includeTaxData = searchParams.get('includeTaxData') === 'true'
    
    // Parse filtering options
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const includeInactive = searchParams.get('includeInactive') === 'true'
    
    const exportData: any = {
      metadata: {
        exportedAt: new Date().toISOString(),
        exportType: 'selective',
        includedTypes: []
      }
    }

    // Export user data if requested
    if (includeUser) {
      const user = await prisma.user.findFirst()
      if (user) {
        exportData.user = {
          id: user.id,
          name: user.name,
          email: user.email,
          timezone: user.timezone,
          payPeriodType: user.payPeriodType,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString()
        }
        exportData.metadata.includedTypes.push('user')
      }
    }

    // Export shifts if requested
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

      exportData.shifts = {
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
          totalShifts: shifts.length,
          dateRange: shifts.length > 0 ? {
            earliest: shifts[shifts.length - 1].startTime.toISOString(),
            latest: shifts[0].startTime.toISOString()
          } : null
        }
      }
      exportData.metadata.includedTypes.push('shifts')
    }

    // Export pay guides if requested
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

      exportData.payGuides = {
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
          totalPayGuides: payGuides.length
        }
      }
      exportData.metadata.includedTypes.push('payGuides')
    }

    // Export pay periods if requested
    if (includePayPeriods) {
      const payPeriodsWhere: any = {}
      
      if (startDate || endDate) {
        payPeriodsWhere.OR = []
        if (startDate) payPeriodsWhere.OR.push({ startDate: { gte: new Date(startDate) } })
        if (endDate) payPeriodsWhere.OR.push({ endDate: { lte: new Date(endDate) } })
      }

      const payPeriods = await prisma.payPeriod.findMany({
        where: payPeriodsWhere,
        include: {
          shifts: {
            select: {
              id: true,
              startTime: true,
              endTime: true,
              totalPay: true
            }
          },
          extras: true
        },
        orderBy: { startDate: 'desc' }
      })

      exportData.payPeriods = {
        payPeriods: payPeriods.map(period => ({
          id: period.id,
          startDate: period.startDate.toISOString(),
          endDate: period.endDate.toISOString(),
          status: period.status,
          totalHours: period.totalHours?.toString(),
          totalPay: period.totalPay?.toString(),
          paygWithholding: period.paygWithholding?.toString(),
          stslAmount: period.stslAmount?.toString(),
          totalWithholdings: period.totalWithholdings?.toString(),
          netPay: period.netPay?.toString(),
          actualPay: period.actualPay?.toString(),
          shifts: period.shifts.map(shift => ({
            id: shift.id,
            startTime: shift.startTime.toISOString(),
            endTime: shift.endTime.toISOString(),
            totalPay: shift.totalPay?.toString()
          })),
          extras: period.extras.map(extra => ({
            type: extra.type,
            description: extra.description,
            amount: extra.amount.toString(),
            taxable: extra.taxable
          }))
        })),
        metadata: {
          totalPayPeriods: payPeriods.length
        }
      }
      exportData.metadata.includedTypes.push('payPeriods')
    }

    // Export tax data if requested
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

      if (taxSettings) {
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

        exportData.taxData = {
          taxSettings: {
            claimedTaxFreeThreshold: taxSettings.claimedTaxFreeThreshold,
            isForeignResident: taxSettings.isForeignResident,
            hasTaxFileNumber: taxSettings.hasTaxFileNumber,
            medicareExemption: taxSettings.medicareExemption,
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
            description: trc.description || undefined,
            isActive: trc.isActive
          })),
          metadata: {
            includedTaxYears: Array.from(new Set([
              ...taxCoefficients.map(tc => tc.taxYear),
              ...stslRates.map(sr => sr.taxYear),
              ...taxRateConfigs.map(trc => trc.taxYear)
            ])).sort().reverse()
          }
        }
        exportData.metadata.includedTypes.push('taxData')
      }
    }

    const filename = `chrona-selective-export-${new Date().toISOString().slice(0, 10)}.json`
    
    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
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