import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ImportResult, ConflictResolution } from '@/types'
import { validateShiftsImport, validatePayGuidesImport, validateTaxDataImport } from '@/lib/import-validation'
import { calculateAndUpdateShift, fetchShiftBreakPeriods, updateShiftWithCalculation } from '@/lib/shift-calculation'
import { findOrCreatePayPeriod } from '@/lib/pay-period-utils'
import { PayPeriodSyncService } from '@/lib/pay-period-sync-service'
import { Decimal } from 'decimal.js'

interface SelectiveImportRequest {
  data: any // The exported data object
  options: {
    conflictResolution: ConflictResolution
    selectedTypes: string[] // Array of data types to import
    importSettings?: {
      validatePayGuides?: boolean
      activateImported?: boolean
      replaceExisting?: boolean
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: SelectiveImportRequest = await request.json()

    const result: ImportResult = {
      success: true,
      summary: { totalProcessed: 0, successful: 0, skipped: 0, failed: 0 },
      errors: [],
      warnings: [],
      created: [],
      updated: [],
      skipped: []
    }

    const { data, options } = body
    const { selectedTypes, conflictResolution, importSettings = {} } = options

    // Get the default user (single user app)
    const user = await prisma.user.findFirst()
    if (!user) {
      return NextResponse.json(
        { error: 'No user found. Please seed the database first.' },
        { status: 400 }
      )
    }

    // Import shifts if selected and present
    if (selectedTypes.includes('shifts') && data.shifts?.shifts) {
      try {
        const shiftsRequest = {
          shifts: data.shifts.shifts.map((shift: any) => ({
            payGuideName: shift.payGuideName,
            startTime: shift.startTime,
            endTime: shift.endTime,
            notes: shift.notes,
            breakPeriods: shift.breakPeriods
          })),
          options: {
            conflictResolution,
            validatePayGuides: importSettings.validatePayGuides ?? true
          }
        }

        const validator = await validateShiftsImport(shiftsRequest)
        if (validator.hasErrors()) {
          result.errors.push(...validator.getErrors())
          result.summary.failed += shiftsRequest.shifts.length
        } else {
          // Process shifts import (simplified version of the full logic)
          const payGuides = await prisma.payGuide.findMany({
            select: { id: true, name: true, isActive: true, timezone: true }
          })
          const payGuideMap = new Map(payGuides.map(pg => [pg.name, pg]))

          for (const shiftData of shiftsRequest.shifts) {
            result.summary.totalProcessed++
            
            const payGuide = payGuideMap.get(shiftData.payGuideName)
            if (!payGuide) {
              result.errors.push({
                type: 'dependency',
                field: 'payGuideName',
                message: `Pay guide "${shiftData.payGuideName}" not found`
              })
              result.summary.failed++
              continue
            }

            const startTime = new Date(shiftData.startTime)
            const endTime = new Date(shiftData.endTime)
            
            // Check for conflicts if not overwriting
            if (conflictResolution === 'skip') {
              const overlappingShifts = await prisma.shift.findMany({
                where: {
                  userId: user.id,
                  OR: [
                    { startTime: { lte: startTime }, endTime: { gte: startTime } },
                    { startTime: { lte: endTime }, endTime: { gte: endTime } },
                    { startTime: { gte: startTime }, endTime: { lte: endTime } }
                  ]
                }
              })

              if (overlappingShifts.length > 0) {
                result.skipped.push(`Shift: overlaps with existing shift`)
                result.summary.skipped++
                continue
              }
            }

            const payPeriod = await findOrCreatePayPeriod(user.id, startTime, payGuide.timezone)
            
            const shift = await prisma.shift.create({
              data: {
                userId: user.id,
                payGuideId: payGuide.id,
                startTime,
                endTime,
                notes: shiftData.notes || null,
                payPeriodId: payPeriod.id
              }
            })

            if (shiftData.breakPeriods && shiftData.breakPeriods.length > 0) {
              await prisma.breakPeriod.createMany({
                data: shiftData.breakPeriods.map((bp: any) => ({
                  shiftId: shift.id,
                  startTime: new Date(bp.startTime),
                  endTime: new Date(bp.endTime)
                }))
              })
            }

            const breakPeriods = await fetchShiftBreakPeriods(shift.id)
            const calculation = await calculateAndUpdateShift({
              payGuideId: payGuide.id,
              startTime,
              endTime,
              breakPeriods
            })

            if (calculation) {
              await updateShiftWithCalculation(shift.id, calculation)
            }

            await PayPeriodSyncService.onShiftCreated(shift.id)
            
            result.created.push(`Shift: ${shiftData.startTime} to ${shiftData.endTime}`)
            result.summary.successful++
          }
        }
      } catch (error) {
        console.error('Error importing shifts:', error)
        result.errors.push({
          type: 'validation',
          field: 'shifts',
          message: `Failed to import shifts: ${error instanceof Error ? error.message : 'Unknown error'}`
        })
        result.success = false
      }
    }

    // Import pay guides if selected and present
    if (selectedTypes.includes('payGuides') && data.payGuides?.payGuides) {
      try {
        const payGuidesRequest = {
          payGuides: data.payGuides.payGuides,
          options: {
            conflictResolution,
            activateImported: importSettings.activateImported ?? true
          }
        }

        const validator = await validatePayGuidesImport(payGuidesRequest)
        if (validator.hasErrors()) {
          result.errors.push(...validator.getErrors())
          result.summary.failed += payGuidesRequest.payGuides.length
        } else {
          const existingPayGuides = await prisma.payGuide.findMany({
            select: { id: true, name: true, isActive: true }
          })
          const existingNames = new Map(existingPayGuides.map(pg => [pg.name, pg]))

          for (const guideData of payGuidesRequest.payGuides) {
            result.summary.totalProcessed++
            
            let finalName = guideData.name
            let shouldSkip = false
            let shouldUpdate = false
            let existingGuideId: string | undefined

            if (existingNames.has(guideData.name)) {
              const existingGuide = existingNames.get(guideData.name)!
              
              switch (conflictResolution) {
                case 'skip':
                  result.skipped.push(`Pay guide "${guideData.name}": already exists`)
                  result.summary.skipped++
                  shouldSkip = true
                  break
                case 'overwrite':
                  shouldUpdate = true
                  existingGuideId = existingGuide.id
                  break
                case 'rename':
                  let counter = 1
                  let suggestion = `${guideData.name} (imported)`
                  while (existingNames.has(suggestion)) {
                    counter++
                    suggestion = `${guideData.name} (imported ${counter})`
                  }
                  finalName = suggestion
                  break
              }
            }

            if (shouldSkip) continue

            const payGuideData = {
              name: finalName,
              baseRate: new Decimal(guideData.baseRate),
              minimumShiftHours: guideData.minimumShiftHours || null,
              maximumShiftHours: guideData.maximumShiftHours || null,
              description: guideData.description || null,
              effectiveFrom: new Date(guideData.effectiveFrom),
              effectiveTo: guideData.effectiveTo ? new Date(guideData.effectiveTo) : null,
              timezone: guideData.timezone || 'Australia/Sydney',
              isActive: importSettings.activateImported ?? true
            }

            let payGuide: any

            if (shouldUpdate && existingGuideId) {
              payGuide = await prisma.payGuide.update({
                where: { id: existingGuideId },
                data: payGuideData
              })
              
              await Promise.all([
                prisma.penaltyTimeFrame.deleteMany({ where: { payGuideId: existingGuideId } }),
                prisma.overtimeTimeFrame.deleteMany({ where: { payGuideId: existingGuideId } }),
                prisma.publicHoliday.deleteMany({ where: { payGuideId: existingGuideId } })
              ])
              
              result.updated.push(`Pay guide "${finalName}"`)
            } else {
              payGuide = await prisma.payGuide.create({
                data: payGuideData
              })
              
              result.created.push(`Pay guide "${finalName}"`)
            }

            // Create related data
            if (guideData.penaltyTimeFrames && guideData.penaltyTimeFrames.length > 0) {
              await prisma.penaltyTimeFrame.createMany({
                data: guideData.penaltyTimeFrames.map((ptf: any) => ({
                  payGuideId: payGuide.id,
                  name: ptf.name,
                  multiplier: new Decimal(ptf.multiplier),
                  dayOfWeek: ptf.dayOfWeek || null,
                  startTime: ptf.startTime || null,
                  endTime: ptf.endTime || null,
                  isPublicHoliday: ptf.isPublicHoliday || false,
                  description: ptf.description || null,
                  isActive: true
                }))
              })
            }

            if (guideData.overtimeTimeFrames && guideData.overtimeTimeFrames.length > 0) {
              await prisma.overtimeTimeFrame.createMany({
                data: guideData.overtimeTimeFrames.map((otf: any) => ({
                  payGuideId: payGuide.id,
                  name: otf.name,
                  firstThreeHoursMult: new Decimal(otf.firstThreeHoursMult),
                  afterThreeHoursMult: new Decimal(otf.afterThreeHoursMult),
                  dayOfWeek: otf.dayOfWeek || null,
                  startTime: otf.startTime || null,
                  endTime: otf.endTime || null,
                  isPublicHoliday: otf.isPublicHoliday || false,
                  description: otf.description || null,
                  isActive: true
                }))
              })
            }

            if (guideData.publicHolidays && guideData.publicHolidays.length > 0) {
              await prisma.publicHoliday.createMany({
                data: guideData.publicHolidays.map((ph: any) => ({
                  payGuideId: payGuide.id,
                  name: ph.name,
                  date: new Date(ph.date),
                  isActive: true
                }))
              })
            }

            result.summary.successful++
          }
        }
      } catch (error) {
        console.error('Error importing pay guides:', error)
        result.errors.push({
          type: 'validation',
          field: 'payGuides',
          message: `Failed to import pay guides: ${error instanceof Error ? error.message : 'Unknown error'}`
        })
        result.success = false
      }
    }

    // Import tax data if selected and present
    if (selectedTypes.includes('taxData') && data.taxData) {
      try {
        const taxDataRequest = {
          taxSettings: data.taxData.taxSettings,
          taxCoefficients: data.taxData.taxCoefficients,
          hecsThresholds: data.taxData.hecsThresholds,
          stslRates: data.taxData.stslRates,
          taxRateConfigs: data.taxData.taxRateConfigs,
          options: {
            conflictResolution,
            replaceExisting: importSettings.replaceExisting ?? false
          }
        }

        const validator = await validateTaxDataImport(taxDataRequest)
        if (validator.hasErrors()) {
          result.errors.push(...validator.getErrors())
        } else {
          // Import tax settings
          if (taxDataRequest.taxSettings) {
            result.summary.totalProcessed++
            
            const updateData: any = {}
            Object.keys(taxDataRequest.taxSettings).forEach(key => {
              if (taxDataRequest.taxSettings[key] !== undefined) {
                if (key === 'hecsHelpRate') {
                  updateData[key] = taxDataRequest.taxSettings[key] ? new Decimal(taxDataRequest.taxSettings[key]) : null
                } else {
                  updateData[key] = taxDataRequest.taxSettings[key]
                }
              }
            })

            await prisma.taxSettings.upsert({
              where: { userId: user.id },
              update: updateData,
              create: { userId: user.id, ...updateData }
            })

            result.updated.push('Tax settings')
            result.summary.successful++
          }

          // Import other tax data types...
          // (Implementation similar to the individual import endpoints)
        }
      } catch (error) {
        console.error('Error importing tax data:', error)
        result.errors.push({
          type: 'validation',
          field: 'taxData',
          message: `Failed to import tax data: ${error instanceof Error ? error.message : 'Unknown error'}`
        })
        result.success = false
      }
    }

    return NextResponse.json(result, { status: result.success ? 200 : 207 })

  } catch (error) {
    console.error('Error in selective import:', error)
    return NextResponse.json(
      { error: 'Failed to import selected data' },
      { status: 500 }
    )
  }
}