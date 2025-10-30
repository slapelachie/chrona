import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  ImportResult,
  ConflictResolution,
  ImportTaxDataRequest,
  ImportPayPeriodsRequest,
  ImportPreferencesRequest,
} from '@/types'
import {
  validateShiftsImport,
  validatePayGuidesImport,
  validatePayPeriodsImport,
  validatePreferencesImport,
  validateTaxDataImport,
} from '@/lib/import-validation'
import {
  calculateAndUpdateShift,
  fetchShiftBreakPeriods,
  updateShiftWithCalculation,
} from '@/lib/shift-calculation'
import { findOrCreatePayPeriod } from '@/lib/pay-period-utils'
import { PayPeriodSyncService } from '@/lib/pay-period-sync-service'
import { Decimal } from 'decimal.js'
import { detectMissingPayPeriods } from '@/lib/import-pay-period-warning'

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
      skipped: [],
    }

    const { data, options } = body
    const { selectedTypes, conflictResolution, importSettings = {} } = options

    // Get the default user (single user app)
    const user = await prisma.user.findFirst({
      select: { id: true, payPeriodType: true },
    })
    if (!user) {
      return NextResponse.json(
        { error: 'No user found. Please seed the database first.' },
        { status: 400 }
      )
    }

    // Import pay guides first if selected so dependent data can reference them
    if (selectedTypes.includes('payGuides') && data.payGuides?.payGuides) {
      try {
        const payGuidesRequest = {
          payGuides: data.payGuides.payGuides,
          options: {
            conflictResolution,
            activateImported: importSettings.activateImported ?? true,
          },
        }

        const validator = await validatePayGuidesImport(payGuidesRequest)
        if (validator.hasErrors()) {
          result.errors.push(...validator.getErrors())
          result.summary.failed += payGuidesRequest.payGuides.length
        } else {
          const existingPayGuides = await prisma.payGuide.findMany({
            select: { id: true, name: true, isActive: true },
          })
          const existingNames = new Map(
            existingPayGuides.map((pg) => [pg.name, pg])
          )

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
                  result.skipped.push(
                    `Pay guide "${guideData.name}": already exists`
                  )
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
              effectiveTo: guideData.effectiveTo
                ? new Date(guideData.effectiveTo)
                : null,
              timezone: guideData.timezone || 'Australia/Sydney',
              isActive: importSettings.activateImported ?? true,
            }

            let payGuide: any

            if (shouldUpdate && existingGuideId) {
              payGuide = await prisma.payGuide.update({
                where: { id: existingGuideId },
                data: payGuideData,
              })

              await Promise.all([
                prisma.penaltyTimeFrame.deleteMany({
                  where: { payGuideId: existingGuideId },
                }),
                prisma.overtimeTimeFrame.deleteMany({
                  where: { payGuideId: existingGuideId },
                }),
                prisma.publicHoliday.deleteMany({
                  where: { payGuideId: existingGuideId },
                }),
              ])

              result.updated.push(`Pay guide "${finalName}"`)
            } else {
              payGuide = await prisma.payGuide.create({
                data: payGuideData,
              })

              result.created.push(`Pay guide "${finalName}"`)
            }

            existingNames.set(finalName, {
              id: payGuide.id,
              name: finalName,
              isActive: payGuide.isActive,
            })

            // Create related data
            if (
              guideData.penaltyTimeFrames &&
              guideData.penaltyTimeFrames.length > 0
            ) {
              await prisma.penaltyTimeFrame.createMany({
                data: guideData.penaltyTimeFrames.map((ptf: any) => ({
                  payGuideId: payGuide.id,
                  name: ptf.name,
                  multiplier: new Decimal(ptf.multiplier),
                  dayOfWeek: ptf.dayOfWeek ?? null,
                  startTime: ptf.startTime || null,
                  endTime: ptf.endTime || null,
                  isPublicHoliday: ptf.isPublicHoliday || false,
                  description: ptf.description || null,
                  isActive: true,
                })),
              })
            }

            if (
              guideData.overtimeTimeFrames &&
              guideData.overtimeTimeFrames.length > 0
            ) {
              await prisma.overtimeTimeFrame.createMany({
                data: guideData.overtimeTimeFrames.map((otf: any) => ({
                  payGuideId: payGuide.id,
                  name: otf.name,
                  firstThreeHoursMult: new Decimal(otf.firstThreeHoursMult),
                  afterThreeHoursMult: new Decimal(otf.afterThreeHoursMult),
                  dayOfWeek: otf.dayOfWeek ?? null,
                  startTime: otf.startTime || null,
                  endTime: otf.endTime || null,
                  isPublicHoliday: otf.isPublicHoliday || false,
                  description: otf.description || null,
                  isActive: true,
                })),
              })
            }

            if (
              guideData.publicHolidays &&
              guideData.publicHolidays.length > 0
            ) {
              await prisma.publicHoliday.createMany({
                data: guideData.publicHolidays.map((ph: any) => ({
                  payGuideId: payGuide.id,
                  name: ph.name,
                  date: new Date(ph.date),
                  isActive: true,
                })),
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
          message: `Failed to import pay guides: ${error instanceof Error ? error.message : 'Unknown error'}`,
        })
        result.success = false
      }
    }

    if (selectedTypes.includes('preferences') && data.preferences) {
      try {
        const preferencesRequest: ImportPreferencesRequest = {
          user: data.preferences.user,
          defaultExtras: data.preferences.defaultExtras,
          options: {
            conflictResolution,
          },
        }

        const validator = await validatePreferencesImport(preferencesRequest)
        if (validator.hasErrors()) {
          result.errors.push(...validator.getErrors())
          result.summary.failed += 1
        } else {
          const user = await prisma.user.findFirst()
          if (!user) {
            result.errors.push({
              type: 'validation',
              field: 'preferences',
              message: 'No user found. Please seed the database first.',
            })
            result.success = false
          } else {
            if (preferencesRequest.user) {
              const updatePayload: Record<string, unknown> = {}
              const source = preferencesRequest.user

              if (source.name !== undefined) updatePayload.name = source.name
              if (source.email !== undefined) updatePayload.email = source.email
              if (source.timezone !== undefined)
                updatePayload.timezone = source.timezone
              if (source.payPeriodType !== undefined)
                updatePayload.payPeriodType = source.payPeriodType
              if (source.defaultShiftLengthMinutes !== undefined) {
                updatePayload.defaultShiftLengthMinutes = Number(
                  source.defaultShiftLengthMinutes
                )
              }

              if (Object.keys(updatePayload).length > 0) {
                await prisma.user.update({
                  where: { id: user.id },
                  data: updatePayload,
                })
                result.updated.push('User preferences')
                result.summary.totalProcessed++
                result.summary.successful++
              }
            }

            if (preferencesRequest.defaultExtras) {
              const existingExtras =
                await prisma.payPeriodExtraTemplate.findMany({
                  where: { userId: user.id },
                  select: { id: true },
                })

              if (
                existingExtras.length > 0 &&
                conflictResolution !== 'overwrite'
              ) {
                result.skipped.push(
                  'Default pay period extras: existing templates preserved (use overwrite to replace)'
                )
                result.summary.totalProcessed +=
                  preferencesRequest.defaultExtras.length
                result.summary.skipped +=
                  preferencesRequest.defaultExtras.length
              } else {
                if (existingExtras.length > 0) {
                  await prisma.payPeriodExtraTemplate.deleteMany({
                    where: { userId: user.id },
                  })
                }

                if (preferencesRequest.defaultExtras.length > 0) {
                  await prisma.payPeriodExtraTemplate.createMany({
                    data: preferencesRequest.defaultExtras.map(
                      (extra, index) => ({
                        userId: user.id,
                        label: extra.label,
                        description: extra.description ?? null,
                        amount: new Decimal(extra.amount),
                        taxable: extra.taxable,
                        active: extra.active ?? true,
                        sortOrder: extra.sortOrder ?? index,
                      })
                    ),
                  })
                  result.summary.totalProcessed +=
                    preferencesRequest.defaultExtras.length
                  result.summary.successful +=
                    preferencesRequest.defaultExtras.length
                  result.created.push(
                    `Default pay period extras (${preferencesRequest.defaultExtras.length})`
                  )
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Error importing preferences:', error)
        result.errors.push({
          type: 'validation',
          field: 'preferences',
          message: `Failed to import preferences: ${error instanceof Error ? error.message : 'Unknown error'}`,
        })
        result.success = false
      }
    }

    // Import pay periods before shifts so totals and extras exist
    if (selectedTypes.includes('payPeriods') && data.payPeriods?.payPeriods) {
      try {
        const payPeriodsRequest = {
          payPeriods: data.payPeriods.payPeriods,
          extras: data.payPeriods.extras,
          options: {
            conflictResolution,
          },
        }

        const validator = await validatePayPeriodsImport(payPeriodsRequest, {
          userId: user.id,
        })
        if (validator.hasErrors()) {
          result.errors.push(...validator.getErrors())
          result.summary.failed += payPeriodsRequest.payPeriods.length
        } else {
          type PayPeriodExtraImport = NonNullable<
            ImportPayPeriodsRequest['extras']
          >[number]
          const extrasByStart = new Map<string, PayPeriodExtraImport[]>()

          if (payPeriodsRequest.extras) {
            payPeriodsRequest.extras.forEach((extra: PayPeriodExtraImport) => {
              const normalized = new Date(extra.periodStartDate).toISOString()
              const group = extrasByStart.get(normalized) ?? []
              group.push(extra)
              extrasByStart.set(normalized, group)
            })
          }

          for (const payPeriodData of payPeriodsRequest.payPeriods) {
            result.summary.totalProcessed++

            let startDate: Date
            let endDate: Date
            try {
              startDate = new Date(payPeriodData.startDate)
              endDate = new Date(payPeriodData.endDate)
              if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                throw new Error('Invalid date')
              }
            } catch {
              result.errors.push({
                type: 'validation',
                field: 'payPeriods',
                message: `Invalid dates for pay period starting ${payPeriodData.startDate}`,
              })
              result.summary.failed++
              continue
            }

            const normalizedStart = startDate.toISOString()
            const existing = await prisma.payPeriod.findUnique({
              where: {
                userId_startDate: {
                  userId: user.id,
                  startDate,
                },
              },
              include: { extras: true },
            })

            if (existing && conflictResolution !== 'overwrite') {
              const reason =
                conflictResolution === 'rename'
                  ? 'Rename is not supported for pay periods; skipping existing period'
                  : 'Pay period already exists and will be skipped'
              result.skipped.push(
                `Pay period starting ${payPeriodData.startDate}: ${reason}`
              )
              result.summary.skipped++
              continue
            }

            const payload = {
              startDate,
              endDate,
              status: payPeriodData.status,
              totalHours: payPeriodData.totalHours
                ? new Decimal(payPeriodData.totalHours)
                : null,
              totalPay: payPeriodData.totalPay
                ? new Decimal(payPeriodData.totalPay)
                : null,
              paygWithholding: payPeriodData.paygWithholding
                ? new Decimal(payPeriodData.paygWithholding)
                : null,
              stslAmount: payPeriodData.stslAmount
                ? new Decimal(payPeriodData.stslAmount)
                : null,
              totalWithholdings: payPeriodData.totalWithholdings
                ? new Decimal(payPeriodData.totalWithholdings)
                : null,
              netPay: payPeriodData.netPay
                ? new Decimal(payPeriodData.netPay)
                : null,
              actualPay: payPeriodData.actualPay
                ? new Decimal(payPeriodData.actualPay)
                : null,
            }

            let payPeriodId: string

            if (existing) {
              const updated = await prisma.payPeriod.update({
                where: { id: existing.id },
                data: payload,
              })
              payPeriodId = updated.id
              result.updated.push(
                `Pay period starting ${payPeriodData.startDate}`
              )
              await prisma.payPeriodExtra.deleteMany({ where: { payPeriodId } })
            } else {
              const created = await prisma.payPeriod.create({
                data: {
                  userId: user.id,
                  ...payload,
                },
              })
              payPeriodId = created.id
              result.created.push(
                `Pay period starting ${payPeriodData.startDate}`
              )
            }

            const extrasForPeriod = extrasByStart.get(normalizedStart)
            if (extrasForPeriod && extrasForPeriod.length > 0) {
              await prisma.payPeriodExtra.createMany({
                data: extrasForPeriod.map((extra) => ({
                  payPeriodId,
                  type: extra.type,
                  description: extra.description ?? null,
                  amount: new Decimal(extra.amount),
                  taxable: !!extra.taxable,
                })),
              })
            }

            result.summary.successful++
          }
        }
      } catch (error) {
        console.error('Error importing pay periods:', error)
        result.errors.push({
          type: 'validation',
          field: 'payPeriods',
          message: `Failed to import pay periods: ${error instanceof Error ? error.message : 'Unknown error'}`,
        })
        result.success = false
      }
    }

    // Import shifts after pay guides so references resolve correctly
    if (selectedTypes.includes('shifts') && data.shifts?.shifts) {
      try {
        const shiftsRequest = {
          shifts: data.shifts.shifts.map((shift: any) => ({
            payGuideName: shift.payGuideName,
            startTime: shift.startTime,
            endTime: shift.endTime,
            notes: shift.notes,
            breakPeriods: shift.breakPeriods,
          })),
          options: {
            conflictResolution,
            validatePayGuides: importSettings.validatePayGuides ?? true,
          },
        }

        const validator = await validateShiftsImport(shiftsRequest, {
          userId: user.id,
        })
        if (validator.hasErrors()) {
          result.errors.push(...validator.getErrors())
          result.summary.failed += shiftsRequest.shifts.length
        } else {
          const payGuides = await prisma.payGuide.findMany({
            select: { id: true, name: true, isActive: true, timezone: true },
          })
          const payGuideMap = new Map(payGuides.map((pg) => [pg.name, pg]))

          const defaultExtrasCount = await prisma.payPeriodExtraTemplate.count({
            where: { userId: user.id, active: true },
          })

          if (defaultExtrasCount > 0) {
            const missingPayPeriods = await detectMissingPayPeriods({
              userId: user.id,
              payPeriodType: user.payPeriodType,
              shifts: shiftsRequest.shifts,
              payGuideMap,
            })

            if (missingPayPeriods > 0) {
              const plural = missingPayPeriods === 1 ? '' : 's'
              result.warnings.push({
                type: 'dependency',
                field: 'payPeriods',
                message: `Import will create ${missingPayPeriods} new pay period${plural}. Configure default extras in Settings before importing if they should apply.`,
              })
            }
          }

          for (const shiftData of shiftsRequest.shifts) {
            result.summary.totalProcessed++

            const payGuide = payGuideMap.get(shiftData.payGuideName)
            if (!payGuide) {
              result.errors.push({
                type: 'dependency',
                field: 'payGuideName',
                message: `Pay guide "${shiftData.payGuideName}" not found`,
              })
              result.summary.failed++
              continue
            }

            const startTime = new Date(shiftData.startTime)
            const endTime = new Date(shiftData.endTime)

            if (conflictResolution === 'skip') {
              const overlappingShifts = await prisma.shift.findMany({
                where: {
                  userId: user.id,
                  OR: [
                    {
                      startTime: { lte: startTime },
                      endTime: { gte: startTime },
                    },
                    { startTime: { lte: endTime }, endTime: { gte: endTime } },
                    {
                      startTime: { gte: startTime },
                      endTime: { lte: endTime },
                    },
                  ],
                },
              })

              if (overlappingShifts.length > 0) {
                result.skipped.push(`Shift: overlaps with existing shift`)
                result.summary.skipped++
                continue
              }
            }

            const payPeriod = await findOrCreatePayPeriod(
              user.id,
              startTime,
              payGuide.timezone
            )

            const shift = await prisma.shift.create({
              data: {
                userId: user.id,
                payGuideId: payGuide.id,
                startTime,
                endTime,
                notes: shiftData.notes || null,
                payPeriodId: payPeriod.id,
              },
            })

            if (shiftData.breakPeriods && shiftData.breakPeriods.length > 0) {
              await prisma.breakPeriod.createMany({
                data: shiftData.breakPeriods.map((bp: any) => ({
                  shiftId: shift.id,
                  startTime: new Date(bp.startTime),
                  endTime: new Date(bp.endTime),
                })),
              })
            }

            const breakPeriods = await fetchShiftBreakPeriods(shift.id)
            const calculation = await calculateAndUpdateShift({
              payGuideId: payGuide.id,
              startTime,
              endTime,
              breakPeriods,
            })

            if (calculation) {
              await updateShiftWithCalculation(shift.id, calculation)
            }

            await PayPeriodSyncService.onShiftCreated(shift.id)

            result.created.push(
              `Shift: ${shiftData.startTime} to ${shiftData.endTime}`
            )
            result.summary.successful++
          }
        }
      } catch (error) {
        console.error('Error importing shifts:', error)
        result.errors.push({
          type: 'validation',
          field: 'shifts',
          message: `Failed to import shifts: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
          stslRates: data.taxData.stslRates,
          taxRateConfigs: data.taxData.taxRateConfigs,
          options: {
            conflictResolution,
            replaceExisting: importSettings.replaceExisting ?? false,
          },
        }

        const validator = await validateTaxDataImport(taxDataRequest)
        if (validator.hasErrors()) {
          result.errors.push(...validator.getErrors())
        } else {
          await importTaxDataPayload(user.id, taxDataRequest, result)
        }
      } catch (error) {
        console.error('Error importing tax data:', error)
        result.errors.push({
          type: 'validation',
          field: 'taxData',
          message: `Failed to import tax data: ${error instanceof Error ? error.message : 'Unknown error'}`,
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

async function importTaxDataPayload(
  userId: string,
  payload: ImportTaxDataRequest,
  result: ImportResult
) {
  const options = payload.options ?? {
    conflictResolution: 'skip',
    replaceExisting: false,
  }

  // Import tax settings
  if (payload.taxSettings) {
    try {
      result.summary.totalProcessed++

      const updateData: any = {}
      if (payload.taxSettings.claimedTaxFreeThreshold !== undefined) {
        updateData.claimedTaxFreeThreshold =
          payload.taxSettings.claimedTaxFreeThreshold
      }
      if (payload.taxSettings.isForeignResident !== undefined) {
        updateData.isForeignResident = payload.taxSettings.isForeignResident
      }
      if (payload.taxSettings.hasTaxFileNumber !== undefined) {
        updateData.hasTaxFileNumber = payload.taxSettings.hasTaxFileNumber
      }
      if (payload.taxSettings.medicareExemption !== undefined) {
        updateData.medicareExemption = payload.taxSettings.medicareExemption
      }

      await prisma.taxSettings.upsert({
        where: { userId },
        update: updateData,
        create: {
          userId,
          ...updateData,
        },
      })

      result.updated.push('Tax settings')
      result.summary.successful++
    } catch (error) {
      console.error('Error importing tax settings (selective):', error)
      result.errors.push({
        type: 'validation',
        field: 'taxSettings',
        message: `Failed to import tax settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
      result.summary.failed++
      result.success = false
    }
  }

  if (payload.taxCoefficients && payload.taxCoefficients.length > 0) {
    for (let i = 0; i < payload.taxCoefficients.length; i++) {
      const coeff = payload.taxCoefficients[i]
      result.summary.totalProcessed++

      try {
        const coeffData = {
          taxYear: coeff.taxYear,
          scale: coeff.scale,
          earningsFrom: new Decimal(coeff.earningsFrom),
          earningsTo: coeff.earningsTo ? new Decimal(coeff.earningsTo) : null,
          coefficientA: new Decimal(coeff.coefficientA),
          coefficientB: new Decimal(coeff.coefficientB),
          description: coeff.description || null,
          isActive: true,
        }

        if (options.replaceExisting) {
          await prisma.taxCoefficient.upsert({
            where: {
              taxYear_scale_earningsFrom: {
                taxYear: coeff.taxYear,
                scale: coeff.scale,
                earningsFrom: new Decimal(coeff.earningsFrom),
              },
            },
            update: coeffData,
            create: coeffData,
          })
          result.updated.push(
            `Tax coefficient ${coeff.taxYear} ${coeff.scale} ${coeff.earningsFrom}`
          )
        } else {
          const existing = await prisma.taxCoefficient.findUnique({
            where: {
              taxYear_scale_earningsFrom: {
                taxYear: coeff.taxYear,
                scale: coeff.scale,
                earningsFrom: new Decimal(coeff.earningsFrom),
              },
            },
          })

          if (existing) {
            if (options.conflictResolution === 'skip') {
              result.skipped.push(
                `Tax coefficient ${coeff.taxYear} ${coeff.scale} ${coeff.earningsFrom}: already exists`
              )
              result.summary.skipped++
              continue
            } else if (options.conflictResolution === 'overwrite') {
              await prisma.taxCoefficient.update({
                where: { id: existing.id },
                data: coeffData,
              })
              result.updated.push(
                `Tax coefficient ${coeff.taxYear} ${coeff.scale} ${coeff.earningsFrom}`
              )
            }
          } else {
            await prisma.taxCoefficient.create({ data: coeffData })
            result.created.push(
              `Tax coefficient ${coeff.taxYear} ${coeff.scale} ${coeff.earningsFrom}`
            )
          }
        }

        result.summary.successful++
      } catch (error) {
        console.error(
          `Error importing tax coefficient (selective) ${i}:`,
          error
        )
        result.errors.push({
          type: 'validation',
          field: 'taxCoefficients',
          message: `Failed to import tax coefficient: ${error instanceof Error ? error.message : 'Unknown error'}`,
          index: i,
        })
        result.summary.failed++
        result.success = false
      }
    }
  }

  if (payload.stslRates && payload.stslRates.length > 0) {
    for (let i = 0; i < payload.stslRates.length; i++) {
      const rate = payload.stslRates[i]
      result.summary.totalProcessed++

      try {
        const rateData = {
          taxYear: rate.taxYear,
          scale: rate.scale,
          earningsFrom: new Decimal(rate.earningsFrom),
          earningsTo: rate.earningsTo ? new Decimal(rate.earningsTo) : null,
          coefficientA: new Decimal(rate.coefficientA),
          coefficientB: new Decimal(rate.coefficientB),
          description: rate.description || null,
          isActive: true,
        }

        if (options.replaceExisting) {
          await prisma.stslRate.upsert({
            where: {
              taxYear_scale_earningsFrom: {
                taxYear: rate.taxYear,
                scale: rate.scale,
                earningsFrom: new Decimal(rate.earningsFrom),
              },
            },
            update: rateData,
            create: rateData,
          })
          result.updated.push(
            `STSL rate ${rate.taxYear} ${rate.scale} ${rate.earningsFrom}`
          )
        } else {
          const existing = await prisma.stslRate.findUnique({
            where: {
              taxYear_scale_earningsFrom: {
                taxYear: rate.taxYear,
                scale: rate.scale,
                earningsFrom: new Decimal(rate.earningsFrom),
              },
            },
          })

          if (existing) {
            if (options.conflictResolution === 'skip') {
              result.skipped.push(
                `STSL rate ${rate.taxYear} ${rate.scale} ${rate.earningsFrom}: already exists`
              )
              result.summary.skipped++
              continue
            } else if (options.conflictResolution === 'overwrite') {
              await prisma.stslRate.update({
                where: { id: existing.id },
                data: rateData,
              })
              result.updated.push(
                `STSL rate ${rate.taxYear} ${rate.scale} ${rate.earningsFrom}`
              )
            }
          } else {
            await prisma.stslRate.create({ data: rateData })
            result.created.push(
              `STSL rate ${rate.taxYear} ${rate.scale} ${rate.earningsFrom}`
            )
          }
        }

        result.summary.successful++
      } catch (error) {
        console.error(`Error importing STSL rate (selective) ${i}:`, error)
        result.errors.push({
          type: 'validation',
          field: 'stslRates',
          message: `Failed to import STSL rate: ${error instanceof Error ? error.message : 'Unknown error'}`,
          index: i,
        })
        result.summary.failed++
        result.success = false
      }
    }
  }

  if (payload.taxRateConfigs && payload.taxRateConfigs.length > 0) {
    for (let i = 0; i < payload.taxRateConfigs.length; i++) {
      const config = payload.taxRateConfigs[i]
      result.summary.totalProcessed++

      try {
        const existing = await prisma.taxRateConfig.findFirst({
          where: {
            taxYear: config.taxYear,
            description: config.description || undefined,
          },
        })

        if (existing) {
          if (options.conflictResolution === 'skip') {
            result.skipped.push(
              `Tax rate config ${config.taxYear}: already exists`
            )
            result.summary.skipped++
            continue
          } else if (
            options.conflictResolution === 'overwrite' ||
            options.replaceExisting
          ) {
            await prisma.taxRateConfig.update({
              where: { id: existing.id },
              data: {
                description: config.description || null,
                isActive: true,
              },
            })
            result.updated.push(`Tax rate config ${config.taxYear}`)
          }
        } else {
          await prisma.taxRateConfig.create({
            data: {
              taxYear: config.taxYear,
              description: config.description || null,
              isActive: true,
            },
          })
          result.created.push(`Tax rate config ${config.taxYear}`)
        }

        result.summary.successful++
      } catch (error) {
        console.error(
          `Error importing tax rate config (selective) ${i}:`,
          error
        )
        result.errors.push({
          type: 'validation',
          field: 'taxRateConfigs',
          message: `Failed to import tax rate config: ${error instanceof Error ? error.message : 'Unknown error'}`,
          index: i,
        })
        result.summary.failed++
        result.success = false
      }
    }
  }
}
