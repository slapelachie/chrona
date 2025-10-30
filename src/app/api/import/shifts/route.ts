import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ImportShiftsRequest, ImportResult } from '@/types'
import { validateShiftsImport } from '@/lib/import-validation'
import { calculateAndUpdateShift, fetchShiftBreakPeriods, updateShiftWithCalculation } from '@/lib/shift-calculation'
import { findOrCreatePayPeriod } from '@/lib/pay-period-utils'
import { PayPeriodSyncService } from '@/lib/pay-period-sync-service'
import { parseShiftsCsv } from '@/lib/import-csv'
import { detectMissingPayPeriods } from '@/lib/import-pay-period-warning'
import { hasShiftConflict } from '@/lib/shift-conflict-utils'

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') ?? ''
    const url = new URL(request.url)
    const body: ImportShiftsRequest = contentType.includes('application/json')
      ? await request.json()
      : parseShiftsCsv(await request.text(), {
          conflictResolution: url.searchParams.get('conflictResolution'),
          validatePayGuides: url.searchParams.get('validatePayGuides')
        })

    // Get the default user (single user app)
    const user = await prisma.user.findFirst({
      select: { id: true, payPeriodType: true }
    })
    if (!user) {
      return NextResponse.json(
        { error: 'No user found. Please seed the database first.' },
        { status: 400 }
      )
    }

    // Validate the import request
    const validator = await validateShiftsImport(body, { userId: user.id })
    
    if (validator.hasErrors()) {
      return NextResponse.json(
        {
          success: false,
          summary: { totalProcessed: 0, successful: 0, skipped: 0, failed: 0 },
          errors: validator.getErrors(),
          warnings: validator.getWarnings(),
          created: [],
          updated: [],
          skipped: []
        } as ImportResult,
        { status: 400 }
      )
    }

    // Get all pay guides for lookup
    const payGuides = await prisma.payGuide.findMany({
      select: { id: true, name: true, isActive: true, timezone: true }
    })
    const payGuideMap = new Map(payGuides.map(pg => [pg.name, pg]))

    const baseWarnings = [...validator.getWarnings()]

    const defaultExtrasCount = await prisma.payPeriodExtraTemplate.count({
      where: { userId: user.id, active: true },
    })

    if (defaultExtrasCount > 0) {
      const missingPayPeriods = await detectMissingPayPeriods({
        userId: user.id,
        payPeriodType: user.payPeriodType,
        shifts: body.shifts,
        payGuideMap,
      })

      if (missingPayPeriods > 0) {
        const plural = missingPayPeriods === 1 ? '' : 's'
        baseWarnings.push({
          type: 'dependency',
          field: 'payPeriods',
          message: `Import will create ${missingPayPeriods} new pay period${plural}. Configure default extras in Settings before importing if they should apply.`,
        })
      }
    }

    const result: ImportResult = {
      success: true,
      summary: { totalProcessed: 0, successful: 0, skipped: 0, failed: 0 },
      errors: [],
      warnings: baseWarnings,
      created: [],
      updated: [],
      skipped: []
    }

    // Process each shift
    for (let i = 0; i < body.shifts.length; i++) {
      const shiftData = body.shifts[i]
      result.summary.totalProcessed++

      try {
        // Find the pay guide
        const payGuide = payGuideMap.get(shiftData.payGuideName)
        if (!payGuide) {
          result.errors.push({
            type: 'dependency',
            field: 'payGuideName',
            message: `Pay guide "${shiftData.payGuideName}" not found`,
            index: i
          })
          result.summary.failed++
          continue
        }

        if (!payGuide.isActive && body.options.validatePayGuides) {
          result.errors.push({
            type: 'dependency',
            field: 'payGuideName',
            message: `Pay guide "${shiftData.payGuideName}" is inactive`,
            index: i
          })
          result.summary.failed++
          continue
        }

        const startTime = new Date(shiftData.startTime)
        const endTime = new Date(shiftData.endTime)

        // Check for conflicts if not overwriting
        if (body.options.conflictResolution === 'skip') {
          const hasConflict = await hasShiftConflict(prisma, user.id, {
            start: startTime,
            end: endTime,
          })

          if (hasConflict) {
            result.skipped.push(`Shift ${i + 1}: overlaps with existing shift`)
            result.summary.skipped++
            continue
          }
        }

        // Find or create appropriate pay period for the shift using pay guide timezone
        const payPeriod = await findOrCreatePayPeriod(user.id, startTime, payGuide.timezone)

        // Create the shift
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

        // Create break periods if provided
        if (shiftData.breakPeriods && shiftData.breakPeriods.length > 0) {
          await prisma.breakPeriod.createMany({
            data: shiftData.breakPeriods.map(bp => ({
              shiftId: shift.id,
              startTime: new Date(bp.startTime),
              endTime: new Date(bp.endTime)
            }))
          })
        }

        // Calculate pay for the shift
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

        // Trigger automatic pay period sync
        await PayPeriodSyncService.onShiftCreated(shift.id)

        result.created.push(`Shift ${i + 1}: ${shiftData.startTime} to ${shiftData.endTime}`)
        result.summary.successful++

      } catch (error) {
        console.error(`Error importing shift ${i}:`, error)
        result.errors.push({
          type: 'validation',
          field: 'shift',
          message: `Failed to import shift: ${error instanceof Error ? error.message : 'Unknown error'}`,
          index: i
        })
        result.summary.failed++
        result.success = false
      }
    }

    return NextResponse.json(result, { status: result.success ? 200 : 207 }) // 207 = Multi-Status

  } catch (error) {
    console.error('Error importing shifts:', error)
    return NextResponse.json(
      { error: 'Failed to import shifts' },
      { status: 500 }
    )
  }
}
