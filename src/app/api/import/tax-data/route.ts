import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { Decimal } from 'decimal.js'
import { prisma } from '@/lib/db'
import { ImportTaxDataRequest, ImportResult } from '@/types'
import { validateTaxDataImport } from '@/lib/import-validation'
import { parseTaxDataFiles } from '@/lib/import-csv'

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') ?? ''
    const url = new URL(request.url)
    let body: ImportTaxDataRequest

    if (contentType.includes('application/json')) {
      body = await request.json()
    } else if (contentType.includes('application/zip')) {
      const buffer = await request.arrayBuffer()
      const zip = await JSZip.loadAsync(buffer)
      const paygMatch = zip.file(/tax-data-payg\.csv$/i)
      const stslMatch = zip.file(/tax-data-stsl\.csv$/i)
      const paygCsv = paygMatch.length > 0 ? await paygMatch[0].async('string') : undefined
      const stslCsv = stslMatch.length > 0 ? await stslMatch[0].async('string') : undefined
      body = parseTaxDataFiles({
        paygCsv,
        stslCsv,
        options: {
          conflictResolution: url.searchParams.get('conflictResolution'),
          replaceExisting: url.searchParams.get('replaceExisting')
        }
      })
    } else {
      body = parseTaxDataFiles({
        paygCsv: await request.text(),
        options: {
          conflictResolution: url.searchParams.get('conflictResolution'),
          replaceExisting: url.searchParams.get('replaceExisting')
        }
      })
    }

    // Validate the import request
    const validator = await validateTaxDataImport(body)
    
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

    // Get the default user (single user app)
    const user = await prisma.user.findFirst()
    if (!user) {
      return NextResponse.json(
        { error: 'No user found. Please seed the database first.' },
        { status: 400 }
      )
    }

    const result: ImportResult = {
      success: true,
      summary: { totalProcessed: 0, successful: 0, skipped: 0, failed: 0 },
      errors: [],
      warnings: validator.getWarnings(),
      created: [],
      updated: [],
      skipped: []
    }

    // Import tax settings
    if (body.taxSettings) {
      try {
        result.summary.totalProcessed++
        
        const updateData: any = {}
        if (body.taxSettings.claimedTaxFreeThreshold !== undefined) {
          updateData.claimedTaxFreeThreshold = body.taxSettings.claimedTaxFreeThreshold
        }
        if (body.taxSettings.isForeignResident !== undefined) {
          updateData.isForeignResident = body.taxSettings.isForeignResident
        }
        if (body.taxSettings.hasTaxFileNumber !== undefined) {
          updateData.hasTaxFileNumber = body.taxSettings.hasTaxFileNumber
        }
        if (body.taxSettings.medicareExemption !== undefined) {
          updateData.medicareExemption = body.taxSettings.medicareExemption
        }
        // hecsHelpRate removed – STSL derived from Schedule 8 rates

        await prisma.taxSettings.upsert({
          where: { userId: user.id },
          update: updateData,
          create: {
            userId: user.id,
            ...updateData
          }
        })

        result.updated.push('Tax settings')
        result.summary.successful++
      } catch (error) {
        console.error('Error importing tax settings:', error)
        result.errors.push({
          type: 'validation',
          field: 'taxSettings',
          message: `Failed to import tax settings: ${error instanceof Error ? error.message : 'Unknown error'}`
        })
        result.summary.failed++
        result.success = false
      }
    }

    // Import tax coefficients
    if (body.taxCoefficients && body.taxCoefficients.length > 0) {
      for (let i = 0; i < body.taxCoefficients.length; i++) {
        const coeff = body.taxCoefficients[i]
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
            isActive: true
          }

          if (body.options.replaceExisting) {
            await prisma.taxCoefficient.upsert({
              where: {
                taxYear_scale_earningsFrom: {
                  taxYear: coeff.taxYear,
                  scale: coeff.scale,
                  earningsFrom: new Decimal(coeff.earningsFrom)
                }
              },
              update: coeffData,
              create: coeffData
            })
            result.updated.push(`Tax coefficient ${coeff.taxYear} ${coeff.scale} ${coeff.earningsFrom}`)
          } else {
            const existing = await prisma.taxCoefficient.findUnique({
              where: {
                taxYear_scale_earningsFrom: {
                  taxYear: coeff.taxYear,
                  scale: coeff.scale,
                  earningsFrom: new Decimal(coeff.earningsFrom)
                }
              }
            })

            if (existing) {
              if (body.options.conflictResolution === 'skip') {
                result.skipped.push(`Tax coefficient ${coeff.taxYear} ${coeff.scale} ${coeff.earningsFrom}: already exists`)
                result.summary.skipped++
                continue
              } else if (body.options.conflictResolution === 'overwrite') {
                await prisma.taxCoefficient.update({
                  where: { id: existing.id },
                  data: coeffData
                })
                result.updated.push(`Tax coefficient ${coeff.taxYear} ${coeff.scale} ${coeff.earningsFrom}`)
              }
            } else {
              await prisma.taxCoefficient.create({ data: coeffData })
              result.created.push(`Tax coefficient ${coeff.taxYear} ${coeff.scale} ${coeff.earningsFrom}`)
            }
          }

          result.summary.successful++
        } catch (error) {
          console.error(`Error importing tax coefficient ${i}:`, error)
          result.errors.push({
            type: 'validation',
            field: 'taxCoefficients',
            message: `Failed to import tax coefficient: ${error instanceof Error ? error.message : 'Unknown error'}`,
            index: i
          })
          result.summary.failed++
          result.success = false
        }
      }
    }

    // HECS thresholds removed – no import supported

    // Import STSL rates
    if (body.stslRates && body.stslRates.length > 0) {
      for (let i = 0; i < body.stslRates.length; i++) {
        const rate = body.stslRates[i]
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
            isActive: true
          }

          if (body.options.replaceExisting) {
            await prisma.stslRate.upsert({
              where: {
                taxYear_scale_earningsFrom: {
                  taxYear: rate.taxYear,
                  scale: rate.scale,
                  earningsFrom: new Decimal(rate.earningsFrom)
                }
              },
              update: rateData,
              create: rateData
            })
            result.updated.push(`STSL rate ${rate.taxYear} ${rate.scale} ${rate.earningsFrom}`)
          } else {
            const existing = await prisma.stslRate.findUnique({
              where: {
                taxYear_scale_earningsFrom: {
                  taxYear: rate.taxYear,
                  scale: rate.scale,
                  earningsFrom: new Decimal(rate.earningsFrom)
                }
              }
            })

            if (existing) {
              if (body.options.conflictResolution === 'skip') {
                result.skipped.push(`STSL rate ${rate.taxYear} ${rate.scale} ${rate.earningsFrom}: already exists`)
                result.summary.skipped++
                continue
              } else if (body.options.conflictResolution === 'overwrite') {
                await prisma.stslRate.update({
                  where: { id: existing.id },
                  data: rateData
                })
                result.updated.push(`STSL rate ${rate.taxYear} ${rate.scale} ${rate.earningsFrom}`)
              }
            } else {
              await prisma.stslRate.create({ data: rateData })
              result.created.push(`STSL rate ${rate.taxYear} ${rate.scale} ${rate.earningsFrom}`)
            }
          }

          result.summary.successful++
        } catch (error) {
          console.error(`Error importing STSL rate ${i}:`, error)
          result.errors.push({
            type: 'validation',
            field: 'stslRates',
            message: `Failed to import STSL rate: ${error instanceof Error ? error.message : 'Unknown error'}`,
            index: i
          })
          result.summary.failed++
          result.success = false
        }
      }
    }

    // Import tax rate configs
    if (body.taxRateConfigs && body.taxRateConfigs.length > 0) {
      for (let i = 0; i < body.taxRateConfigs.length; i++) {
        const config = body.taxRateConfigs[i]
        result.summary.totalProcessed++

        try {
          const configData = {
            taxYear: config.taxYear,
            description: config.description || null,
            isActive: true
          }

          if (body.options.replaceExisting) {
            await prisma.taxRateConfig.upsert({
              where: { taxYear: config.taxYear },
              update: configData,
              create: configData
            })
            result.updated.push(`Tax rate config ${config.taxYear}`)
          } else {
            const existing = await prisma.taxRateConfig.findUnique({
              where: { taxYear: config.taxYear }
            })

            if (existing) {
              if (body.options.conflictResolution === 'skip') {
                result.skipped.push(`Tax rate config ${config.taxYear}: already exists`)
                result.summary.skipped++
                continue
              } else if (body.options.conflictResolution === 'overwrite') {
                await prisma.taxRateConfig.update({
                  where: { id: existing.id },
                  data: configData
                })
                result.updated.push(`Tax rate config ${config.taxYear}`)
              }
            } else {
              await prisma.taxRateConfig.create({ data: configData })
              result.created.push(`Tax rate config ${config.taxYear}`)
            }
          }

          result.summary.successful++
        } catch (error) {
          console.error(`Error importing tax rate config ${i}:`, error)
          result.errors.push({
            type: 'validation',
            field: 'taxRateConfigs',
            message: `Failed to import tax rate config: ${error instanceof Error ? error.message : 'Unknown error'}`,
            index: i
          })
          result.summary.failed++
          result.success = false
        }
      }
    }

    return NextResponse.json(result, { status: result.success ? 200 : 207 }) // 207 = Multi-Status

  } catch (error) {
    console.error('Error importing tax data:', error)
    return NextResponse.json(
      { error: 'Failed to import tax data' },
      { status: 500 }
    )
  }
}
