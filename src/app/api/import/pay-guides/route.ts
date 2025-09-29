import { NextRequest, NextResponse } from 'next/server'
import { Decimal } from 'decimal.js'
import { prisma } from '@/lib/db'
import { ImportPayGuidesRequest, ImportResult } from '@/types'
import {
  validatePayGuidesImport,
  generateRenameSuggestion,
} from '@/lib/import-validation'
import { parsePayGuidesCsv } from '@/lib/import-csv'

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') ?? ''
    const url = new URL(request.url)
    const body: ImportPayGuidesRequest = contentType.includes(
      'application/json'
    )
      ? await request.json()
      : parsePayGuidesCsv(await request.text(), {
          conflictResolution: url.searchParams.get('conflictResolution'),
          activateImported: url.searchParams.get('activateImported'),
        })

    // Validate the import request
    const validator = await validatePayGuidesImport(body)

    if (validator.hasErrors()) {
      return NextResponse.json(
        {
          success: false,
          summary: { totalProcessed: 0, successful: 0, skipped: 0, failed: 0 },
          errors: validator.getErrors(),
          warnings: validator.getWarnings(),
          created: [],
          updated: [],
          skipped: [],
        } as ImportResult,
        { status: 400 }
      )
    }

    // Get existing pay guide names for conflict detection
    const existingPayGuides = await prisma.payGuide.findMany({
      select: { id: true, name: true, isActive: true },
    })
    const existingNames = new Map(existingPayGuides.map((pg) => [pg.name, pg]))

    const result: ImportResult = {
      success: true,
      summary: { totalProcessed: 0, successful: 0, skipped: 0, failed: 0 },
      errors: [],
      warnings: validator.getWarnings(),
      created: [],
      updated: [],
      skipped: [],
    }

    // Process each pay guide
    for (let i = 0; i < body.payGuides.length; i++) {
      const guideData = body.payGuides[i]
      result.summary.totalProcessed++

      try {
        let finalName = guideData.name
        let shouldSkip = false
        let shouldUpdate = false
        let existingGuideId: string | undefined

        // Handle name conflicts
        if (existingNames.has(guideData.name)) {
          const existingGuide = existingNames.get(guideData.name)!

          switch (body.options.conflictResolution) {
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
              result.warnings.push({
                type: 'conflict',
                field: 'name',
                message: `Pay guide "${guideData.name}" will be overwritten`,
                index: i,
              })
              break

            case 'rename':
              finalName = generateRenameSuggestion(
                guideData.name,
                new Set(existingNames.keys())
              )
              result.warnings.push({
                type: 'conflict',
                field: 'name',
                message: `Pay guide renamed from "${guideData.name}" to "${finalName}"`,
                index: i,
              })
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
          isActive: body.options.activateImported,
        }

        let payGuide: any

        if (shouldUpdate && existingGuideId) {
          // Update existing pay guide
          payGuide = await prisma.payGuide.update({
            where: { id: existingGuideId },
            data: payGuideData,
          })

          // Delete existing related data if updating
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
          // Create new pay guide
          payGuide = await prisma.payGuide.create({
            data: payGuideData,
          })

          result.created.push(`Pay guide "${finalName}"`)
        }

        // Create penalty time frames
        if (
          guideData.penaltyTimeFrames &&
          guideData.penaltyTimeFrames.length > 0
        ) {
          await prisma.penaltyTimeFrame.createMany({
            data: guideData.penaltyTimeFrames.map((ptf) => ({
              payGuideId: payGuide.id,
              name: ptf.name,
              multiplier: new Decimal(ptf.multiplier),
              dayOfWeek: ptf.dayOfWeek || null,
              startTime: ptf.startTime || null,
              endTime: ptf.endTime || null,
              isPublicHoliday: ptf.isPublicHoliday || false,
              description: ptf.description || null,
              isActive: true,
            })),
          })
        }

        // Create overtime time frames
        if (
          guideData.overtimeTimeFrames &&
          guideData.overtimeTimeFrames.length > 0
        ) {
          await prisma.overtimeTimeFrame.createMany({
            data: guideData.overtimeTimeFrames.map((otf) => ({
              payGuideId: payGuide.id,
              name: otf.name,
              firstThreeHoursMult: new Decimal(otf.firstThreeHoursMult),
              afterThreeHoursMult: new Decimal(otf.afterThreeHoursMult),
              dayOfWeek: otf.dayOfWeek || null,
              startTime: otf.startTime || null,
              endTime: otf.endTime || null,
              isPublicHoliday: otf.isPublicHoliday || false,
              description: otf.description || null,
              isActive: true,
            })),
          })
        }

        // Create public holidays
        if (guideData.publicHolidays && guideData.publicHolidays.length > 0) {
          await prisma.publicHoliday.createMany({
            data: guideData.publicHolidays.map((ph) => ({
              payGuideId: payGuide.id,
              name: ph.name,
              date: new Date(ph.date),
              isActive: true,
            })),
          })
        }

        result.summary.successful++
      } catch (error) {
        console.error(`Error importing pay guide ${i}:`, error)
        result.errors.push({
          type: 'validation',
          field: 'payGuide',
          message: `Failed to import pay guide: ${error instanceof Error ? error.message : 'Unknown error'}`,
          index: i,
        })
        result.summary.failed++
        result.success = false
      }
    }

    return NextResponse.json(result, { status: result.success ? 200 : 207 }) // 207 = Multi-Status
  } catch (error) {
    console.error('Error importing pay guides:', error)
    return NextResponse.json(
      { error: 'Failed to import pay guides' },
      { status: 500 }
    )
  }
}
