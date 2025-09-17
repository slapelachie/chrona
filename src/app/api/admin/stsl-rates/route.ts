import { NextRequest, NextResponse } from 'next/server'
import { Decimal } from 'decimal.js'
import { prisma } from '@/lib/db'
import { ValidationResult, validateString, validateDecimal } from '@/lib/validation'
import { TaxCoefficientService } from '@/lib/tax-coefficient-service'

// GET /api/admin/stsl-rates - Get STSL component rates by tax year and scale
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const { getCurrentAuTaxYearString } = await import('@/lib/tax-year')
    const taxYear = searchParams.get('taxYear') || getCurrentAuTaxYearString()
    const scale = searchParams.get('scale') // WITH_TFT_OR_FR | NO_TFT
    const where: any = { taxYear, isActive: true }
    if (scale) where.scale = scale
    const rates = await prisma.stslRate.findMany({
      where,
      orderBy: [{ scale: 'asc' }, { earningsFrom: 'asc' }],
    })

    return NextResponse.json({
      data: rates.map(r => ({
        id: r.id,
        taxYear: r.taxYear,
        scale: r.scale,
        earningsFrom: r.earningsFrom.toString(),
        earningsTo: r.earningsTo?.toString() ?? null,
        coefficientA: r.coefficientA.toString(),
        coefficientB: r.coefficientB.toString(),
        description: r.description,
        isActive: r.isActive,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }))
    })
  } catch (error) {
    console.error('Error fetching STSL rates:', error)
    return NextResponse.json({ error: 'Failed to fetch STSL rates' }, { status: 500 })
  }
}

// PUT /api/admin/stsl-rates - Bulk upsert STSL component rates for a tax year
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { taxYear, rates } = body

    const validator = ValidationResult.create()
    if (!taxYear || typeof taxYear !== 'string') {
      validator.addError('taxYear', 'Tax year is required')
    }
    if (!Array.isArray(rates)) {
      validator.addError('rates', 'Rates must be an array')
    }
    if (!validator.isValid()) {
      return NextResponse.json({ errors: validator.getErrors(), message: 'Invalid request data' }, { status: 400 })
    }

    const parsed = [] as Array<{
      scale: string
      earningsFrom: Decimal
      earningsTo: Decimal | null
      coefficientA: Decimal
      coefficientB: Decimal
      description: string | null
    }>

    for (let i = 0; i < rates.length; i++) {
      const r = rates[i]
      const v = ValidationResult.create()
      validateString(r.scale, 'scale', v, { required: true })
      validateDecimal(r.earningsFrom, 'earningsFrom', v, { required: true, min: 0 })
      if (r.earningsTo !== null && r.earningsTo !== undefined) validateDecimal(r.earningsTo, 'earningsTo', v, { min: 0 })
      validateDecimal(r.coefficientA, 'coefficientA', v, { required: true, min: 0 })
      validateDecimal(r.coefficientB, 'coefficientB', v, { required: true, min: 0 })
      if (!v.isValid()) {
        return NextResponse.json({ errors: v.getErrors(), message: `Invalid rate at index ${i}` }, { status: 400 })
      }
      parsed.push({
        scale: r.scale,
        earningsFrom: new Decimal(r.earningsFrom),
        earningsTo: r.earningsTo === null || r.earningsTo === undefined ? null : new Decimal(r.earningsTo),
        coefficientA: new Decimal(r.coefficientA),
        coefficientB: new Decimal(r.coefficientB),
        description: r.description || null,
      })
    }

    // Server-side duplicate guard
    {
      const seen = new Set<string>()
      for (const c of parsed) {
        const key = `${c.scale}|${c.earningsFrom.toString()}`
        if (seen.has(key)) {
          return NextResponse.json({ message: 'Duplicate entries', errors: [{ field: 'rates', message: `Duplicate for ${key}` }] }, { status: 400 })
        }
        seen.add(key)
      }
    }

    const affected = await prisma.$transaction(async (tx) => {
      const existing = await tx.stslRate.findMany({ where: { taxYear } })
      const map = new Map(existing.map(e => [`${e.scale}|${e.earningsFrom.toString()}`, e] as const))
      const desired = new Set<string>()
      const affectedIds: string[] = []

      for (const r of parsed) {
        const k = `${r.scale}|${r.earningsFrom.toString()}`
        desired.add(k)
        const row = map.get(k)
        if (row) {
          const u = await tx.stslRate.update({ where: { id: row.id }, data: { earningsTo: r.earningsTo, coefficientA: r.coefficientA, coefficientB: r.coefficientB, description: r.description, isActive: true } })
          affectedIds.push(u.id)
        } else {
          const c = await tx.stslRate.create({ data: { taxYear, scale: r.scale, earningsFrom: r.earningsFrom, earningsTo: r.earningsTo, coefficientA: r.coefficientA, coefficientB: r.coefficientB, description: r.description, isActive: true } })
          affectedIds.push(c.id)
        }
      }

      const toDeactivate = existing.filter(e => !desired.has(`${e.scale}|${e.earningsFrom.toString()}`)).map(e => e.id)
      if (toDeactivate.length) {
        await tx.stslRate.updateMany({ where: { id: { in: toDeactivate } }, data: { isActive: false } })
      }

      return affectedIds
    })

    // Invalidate caches so the calculator sees the new A/B rows immediately
    try { TaxCoefficientService.clearCacheForTaxYear(taxYear) } catch (e) { console.warn('Failed to clear tax cache after STSL update:', e) }

    return NextResponse.json({ data: parsed.map(p => ({ taxYear, scale: p.scale, earningsFrom: p.earningsFrom.toString(), earningsTo: p.earningsTo?.toString() ?? null, coefficientA: p.coefficientA.toString(), coefficientB: p.coefficientB.toString(), description: p.description, isActive: true })), message: `Successfully upserted ${affected.length} STSL rates for ${taxYear}` })
  } catch (error) {
    console.error('Error updating STSL rates:', error)
    return NextResponse.json({ error: 'Failed to update STSL rates' }, { status: 500 })
  }
}
