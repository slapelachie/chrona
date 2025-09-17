import { NextRequest, NextResponse } from 'next/server'
import { Decimal } from 'decimal.js'
import { prisma } from '@/lib/db'
import { ValidationResult, validateString, validateDecimal } from '@/lib/validation'

// GET /api/admin/tax-coefficients - Get tax coefficients by tax year and scale
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const { getCurrentAuTaxYearString } = await import('@/lib/tax-year')
    const taxYear = searchParams.get('taxYear') || getCurrentAuTaxYearString()
    const scale = searchParams.get('scale')

    // Build where clause
    const where: any = {
      taxYear,
      isActive: true,
    }

    if (scale) {
      where.scale = scale
    }

    const coefficients = await prisma.taxCoefficient.findMany({
      where,
      orderBy: [
        { scale: 'asc' },
        { earningsFrom: 'asc' },
      ],
    })

    // Transform to response format
    const response = coefficients.map(coeff => ({
      id: coeff.id,
      taxYear: coeff.taxYear,
      scale: coeff.scale,
      earningsFrom: coeff.earningsFrom.toString(),
      earningsTo: coeff.earningsTo?.toString() || null,
      coefficientA: coeff.coefficientA.toString(),
      coefficientB: coeff.coefficientB.toString(),
      description: coeff.description,
      isActive: coeff.isActive,
      createdAt: coeff.createdAt,
      updatedAt: coeff.updatedAt,
    }))

    return NextResponse.json({ data: response })
  } catch (error) {
    console.error('Error fetching tax coefficients:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tax coefficients' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/tax-coefficients - Bulk update tax coefficients
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { taxYear, coefficients } = body

    // Validate request
    const validator = ValidationResult.create()
    let earlyInvalid = false

    if (!taxYear || typeof taxYear !== 'string') {
      earlyInvalid = true
      validator.addError('taxYear', 'Tax year is required and must be a string')
    }

    if (!Array.isArray(coefficients)) {
      earlyInvalid = true
      validator.addError('coefficients', 'Coefficients must be an array')
    }

    if (earlyInvalid) {
      return NextResponse.json(
        {
          errors: validator.getErrors(),
          message: 'Invalid request data',
        },
        { status: 400 }
      )
    }

    // Validate each coefficient
    const validatedCoefficients = []
    for (let i = 0; i < coefficients.length; i++) {
      const coeff = coefficients[i]
      const coeffValidator = ValidationResult.create()

      validateString(coeff.scale, 'scale', coeffValidator, { required: true })
      validateDecimal(coeff.earningsFrom, 'earningsFrom', coeffValidator, { required: true, min: 0 })
      
      if (coeff.earningsTo !== null) {
        validateDecimal(coeff.earningsTo, 'earningsTo', coeffValidator, { min: 0 })
      }
      
      validateDecimal(coeff.coefficientA, 'coefficientA', coeffValidator, { required: true, min: 0 })
      validateDecimal(coeff.coefficientB, 'coefficientB', coeffValidator, { required: true, min: 0 })

      if (!coeffValidator.isValid()) {
        return NextResponse.json(
          {
            errors: coeffValidator.getErrors(),
            message: `Invalid coefficient data at index ${i}`,
          },
          { status: 400 }
        )
      }

      // Safely convert to Decimal and enforce bounds independent of mocks
      let earningsFromDec: Decimal
      let earningsToDec: Decimal | null = null
      let aDec: Decimal
      let bDec: Decimal
      try {
        earningsFromDec = new Decimal(coeff.earningsFrom)
        if (coeff.earningsTo !== null && coeff.earningsTo !== undefined) {
          earningsToDec = new Decimal(coeff.earningsTo)
        }
        aDec = new Decimal(coeff.coefficientA)
        bDec = new Decimal(coeff.coefficientB)
      } catch {
        return NextResponse.json(
          {
            errors: [{ field: 'coefficients', message: 'Invalid numeric value in coefficients' }],
            message: `Invalid coefficient data at index ${i}`,
          },
          { status: 400 }
        )
      }

      validatedCoefficients.push({
        scale: coeff.scale,
        earningsFrom: earningsFromDec,
        earningsTo: earningsToDec,
        coefficientA: aDec,
        coefficientB: bDec,
        description: coeff.description || null,
      })
    }

    // Server-side guard: prevent duplicate (scale, earningsFrom) within payload
    {
      const seen = new Set<string>()
      for (const c of validatedCoefficients) {
        const key = `${c.scale}|${c.earningsFrom.toString()}`
        if (seen.has(key)) {
          return NextResponse.json(
            {
              errors: [{ field: 'coefficients', message: `Duplicate bracket for scale ${c.scale} at earningsFrom=${c.earningsFrom.toString()}` }],
              message: 'Duplicate coefficients in request',
            },
            { status: 400 }
          )
        }
        seen.add(key)
      }
    }

    // Use transaction: update existing in-place, create new, then deactivate leftovers
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.taxCoefficient.findMany({ where: { taxYear } })
      const existingMap = new Map<string, typeof existing[number]>()
      for (const e of existing) {
        existingMap.set(`${e.scale}|${e.earningsFrom.toString()}`, e)
      }

      const desiredKeys = new Set<string>()
      const affectedIds: string[] = []

      // Update or create
      for (const coeff of validatedCoefficients) {
        const key = `${coeff.scale}|${coeff.earningsFrom.toString()}`
        desiredKeys.add(key)

        const existingRow = existingMap.get(key)
        if (existingRow) {
          const updated = await tx.taxCoefficient.update({
            where: { id: existingRow.id },
            data: {
              earningsTo: coeff.earningsTo,
              coefficientA: coeff.coefficientA,
              coefficientB: coeff.coefficientB,
              description: coeff.description,
              isActive: true,
            },
          })
          affectedIds.push(updated.id)
        } else {
          const created = await tx.taxCoefficient.create({
            data: {
              taxYear,
              scale: coeff.scale,
              earningsFrom: coeff.earningsFrom,
              earningsTo: coeff.earningsTo,
              coefficientA: coeff.coefficientA,
              coefficientB: coeff.coefficientB,
              description: coeff.description,
              isActive: true,
            },
          })
          affectedIds.push(created.id)
        }
      }

      // Deactivate any rows in this taxYear not present in payload
      const toDeactivate = existing
        .filter(e => !desiredKeys.has(`${e.scale}|${e.earningsFrom.toString()}`))
        .map(e => e.id)
      if (toDeactivate.length > 0) {
        await tx.taxCoefficient.updateMany({
          where: { id: { in: toDeactivate } },
          data: { isActive: false },
        })
      }

      return affectedIds
    })

    // Transform response using validated input (stable under mocks)
    const response = validatedCoefficients.map(vc => ({
      taxYear,
      scale: vc.scale,
      earningsFrom: vc.earningsFrom.toString(),
      earningsTo: vc.earningsTo?.toString() || null,
      coefficientA: vc.coefficientA.toString(),
      coefficientB: vc.coefficientB.toString(),
      description: vc.description,
      isActive: true,
    }))

    return NextResponse.json(
      { 
        data: response,
        message: `Successfully upserted ${result.length} tax coefficients for ${taxYear}`,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error updating tax coefficients:', error)
    return NextResponse.json(
      { error: 'Failed to update tax coefficients' },
      { status: 500 }
    )
  }
}
