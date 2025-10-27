import { Decimal } from 'decimal.js'
import { PrismaClient } from '@prisma/client'
import { TaxCoefficientService } from '@/lib/tax-coefficient-service'

export async function seedTaxConfigForYear(prisma: PrismaClient, taxYear = '2024-25') {
  // Basic config
  await prisma.taxRateConfig.upsert({
    where: { taxYear },
    update: {
      isActive: true,
      description: 'Test seed config',
    },
    create: {
      taxYear,
      isActive: true,
      description: 'Test seed config',
    },
  })

  // Minimal coefficients (scale 2 common brackets)
  const baseCoeffs = [
    {
      taxYear,
      scale: 'scale2',
      earningsFrom: new Decimal(0),
      earningsTo: new Decimal(371),
      coefficientA: new Decimal(0),
      coefficientB: new Decimal(0),
      description: 'Tax-free threshold',
      isActive: true,
    },
    {
      taxYear,
      scale: 'scale2',
      earningsFrom: new Decimal(371),
      earningsTo: new Decimal(515),
      coefficientA: new Decimal(0.19),
      coefficientB: new Decimal(70.5385),
      description: '19% bracket',
      isActive: true,
    },
    {
      taxYear,
      scale: 'scale2',
      earningsFrom: new Decimal(515),
      earningsTo: null,
      coefficientA: new Decimal(0.22),
      coefficientB: new Decimal(90),
      description: 'Top bracket (test)'
      ,isActive: true,
    },
  ]

  for (const c of baseCoeffs) {
    await prisma.taxCoefficient.upsert({
      where: { taxYear_scale_earningsFrom: { taxYear, scale: c.scale, earningsFrom: c.earningsFrom } },
      update: {
        earningsTo: c.earningsTo,
        coefficientA: c.coefficientA,
        coefficientB: c.coefficientB,
        description: c.description,
        isActive: c.isActive,
      },
      create: c as any,
    })
  }

  // Minimal STSL component rates to satisfy calculators expecting Schedule 8 data
  const stslRates = [
    {
      taxYear,
      scale: 'WITH_TFT_OR_FR',
      earningsFrom: new Decimal(0),
      earningsTo: new Decimal(770),
      coefficientA: new Decimal(0.02),
      coefficientB: new Decimal(0),
      description: 'Test STSL lower bracket',
      isActive: true,
    },
    {
      taxYear,
      scale: 'WITH_TFT_OR_FR',
      earningsFrom: new Decimal(770),
      earningsTo: null,
      coefficientA: new Decimal(0.03),
      coefficientB: new Decimal(5),
      description: 'Test STSL upper bracket',
      isActive: true,
    },
  ]

  for (const rate of stslRates) {
    await prisma.stslRate.upsert({
      where: {
        taxYear_scale_earningsFrom: {
          taxYear: rate.taxYear,
          scale: rate.scale,
          earningsFrom: rate.earningsFrom,
        },
      },
      update: {
        earningsTo: rate.earningsTo,
        coefficientA: rate.coefficientA,
        coefficientB: rate.coefficientB,
        description: rate.description,
        isActive: rate.isActive,
      },
      create: rate as any,
    })
  }

  // Clear service caches to ensure fresh reads
  TaxCoefficientService.clearCacheForTaxYear(taxYear)
}

export async function clearTaxConfig(prisma: PrismaClient, taxYear = '2024-25') {
  await prisma.taxCoefficient.deleteMany({ where: { taxYear } })
  await prisma.stslRate.deleteMany({ where: { taxYear } })
  await prisma.taxRateConfig.deleteMany({ where: { taxYear } })
  TaxCoefficientService.clearCacheForTaxYear(taxYear)
}
