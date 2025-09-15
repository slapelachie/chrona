import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'
import { Decimal } from 'decimal.js'

// We'll import these dynamically after mocking the DB module.
let TaxCoefficientService: typeof import('../tax-coefficient-service').TaxCoefficientService
let TaxCalculator: typeof import('../calculations/tax-calculator').TaxCalculator
let PayPeriodTaxService: typeof import('../pay-period-tax-service').PayPeriodTaxService

/**
 * Integration tests for the complete tax coefficient workflow
 * 
 * Tests the end-to-end flow:
 * 1. Database coefficients seeded
 * 2. API updates to coefficients
 * 3. Cache invalidation
 * 4. Tax calculations using updated coefficients
 * 5. Pay period processing with new rates
 */

describe('Tax Coefficient Integration Tests', () => {
  let prisma: PrismaClient

  beforeAll(async () => {
    // Use test database
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: 'file:./test-integration.db',
        },
      },
    })

    // Point the application Prisma to the same DB for the duration of these tests
    process.env.DATABASE_URL = 'file:./test-integration.db'

    // Reset and apply migrations
    try {
      execSync('npx prisma migrate reset --force --skip-seed', {
        env: { ...process.env, DATABASE_URL: 'file:./test-integration.db' },
        stdio: 'ignore',
      })
    } catch {
      // Ignore errors - database might not exist yet
    }

    execSync('npx prisma migrate dev --skip-seed', {
      env: { ...process.env, DATABASE_URL: 'file:./test-integration.db' },
      stdio: 'ignore',
    })

    // Mock the app's prisma to use our local test instance
    vi.doMock('@/lib/db', () => ({ prisma }))
    ;({ TaxCoefficientService } = await import('../tax-coefficient-service'))
    ;({ TaxCalculator } = await import('../calculations/tax-calculator'))
    ;({ PayPeriodTaxService } = await import('../pay-period-tax-service'))
  })

  afterAll(async () => {
    await prisma.$disconnect()
    
    // Cleanup test database
    try {
      execSync('rm -f ./test-integration.db*')
    } catch {
      // Ignore cleanup errors
    }
  })

  beforeEach(async () => {
    // Clear all tables
    await prisma.taxCoefficient.deleteMany()
    await prisma.hecsThreshold.deleteMany()
    await prisma.taxRateConfig.deleteMany()
    await prisma.yearToDateTax.deleteMany()
    await prisma.taxSettings.deleteMany()
    await prisma.payPeriod.deleteMany()
    await prisma.user.deleteMany()

    // Clear service cache
    TaxCoefficientService.clearCache()
  })

  describe('End-to-End Tax Coefficient Workflow', () => {
    it('should complete full workflow: seed → update → calculate', async () => {
      const taxYear = '2024-25'

      // Step 1: Seed initial tax configuration
      await prisma.taxRateConfig.create({
        data: {
          taxYear,
          medicareRate: new Decimal(0.02),
          medicareLowIncomeThreshold: new Decimal(26000),
          medicareHighIncomeThreshold: new Decimal(32500),
          description: 'Initial configuration',
          isActive: true,
        },
      })

      // Seed initial coefficients
      const initialCoefficients = [
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
          description: '19% tax bracket',
          isActive: true,
        },
      ]

      for (const coeff of initialCoefficients) {
        await prisma.taxCoefficient.create({ data: coeff })
      }

      // Seed HECS thresholds
      await prisma.hecsThreshold.create({
        data: {
          taxYear,
          incomeFrom: new Decimal(51550),
          incomeTo: new Decimal(59518),
          rate: new Decimal(0.01),
          description: '1% HECS rate',
          isActive: true,
        },
      })

      // Step 2: Create test user and tax settings
      const user = await prisma.user.create({
        data: {
          name: 'Test User',
          email: 'test@example.com',
          timezone: 'Australia/Sydney',
          payPeriodType: 'FORTNIGHTLY',
        },
      })

      const taxSettings = await prisma.taxSettings.create({
        data: {
          userId: user.id,
          claimedTaxFreeThreshold: true,
          isForeignResident: false,
          hasTaxFileNumber: true,
          medicareExemption: 'none',
          hecsHelpRate: null,
        },
      })

      const yearToDateTax = await prisma.yearToDateTax.create({
        data: {
          userId: user.id,
          taxYear,
          grossIncome: new Decimal(10000),
          payGWithholding: new Decimal(1000),
          medicareLevy: new Decimal(200),
          hecsHelpAmount: new Decimal(0),
          totalWithholdings: new Decimal(1200),
          lastUpdated: new Date(),
        },
      })

      // Step 3: Test initial tax calculation
      // Ensure no cached config
      TaxCoefficientService.clearCacheForTaxYear(taxYear)
      const initialCalculator = await TaxCalculator.createFromDatabase(taxSettings, taxYear)
      const initialResult = initialCalculator.calculatePayPeriodTax(
        'test-calculation',
        new Decimal(1000),
        'FORTNIGHTLY',
        yearToDateTax
      )

      expect(initialResult.breakdown.grossPay).toEqual(new Decimal(1000))
      expect(initialResult.breakdown.paygWithholding.toNumber()).toBeGreaterThan(0)

      // Step 4: Update tax coefficients (simulate API update)
      // Update existing coefficients in-place to avoid unique constraint violations
      await prisma.taxCoefficient.updateMany({
        where: { taxYear, scale: 'scale2', earningsFrom: new Decimal(371) },
        data: { coefficientA: new Decimal(0.25), coefficientB: new Decimal(93.0) },
      })

      // Step 5: Clear cache to force reload of updated coefficients
      TaxCoefficientService.clearCacheForTaxYear(taxYear)

      // Step 6: Test calculation with updated coefficients
      const updatedCalculator = await TaxCalculator.createFromDatabase(taxSettings, taxYear)
      const updatedResult = updatedCalculator.calculatePayPeriodTax(
        'test-calculation-updated',
        new Decimal(1000),
        'FORTNIGHTLY',
        yearToDateTax
      )

      // Results should be different due to updated coefficients
      expect(updatedResult.breakdown.grossPay).toEqual(new Decimal(1000))
      expect(updatedResult.breakdown.paygWithholding.toNumber()).not.toEqual(
        initialResult.breakdown.paygWithholding.toNumber()
      )
      expect(updatedResult.breakdown.paygWithholding.toNumber()).toBeGreaterThan(
        initialResult.breakdown.paygWithholding.toNumber()
      )

      // Step 7: Test pay period processing with updated coefficients
      const payPeriod = await prisma.payPeriod.create({
        data: {
          userId: user.id,
          startDate: new Date('2024-08-01'),
          endDate: new Date('2024-08-14'),
          status: 'open',
          totalHours: new Decimal(76),
          totalPay: new Decimal(1000),
        },
      })

      const processedPayPeriod = await PayPeriodTaxService.calculatePayPeriodTax(payPeriod.id)

      expect(processedPayPeriod.breakdown.grossPay.toNumber()).toBeCloseTo(1000, 6)
      expect(processedPayPeriod.breakdown.paygWithholding.toNumber()).toBeGreaterThan(0)
      expect(processedPayPeriod.breakdown.totalWithholdings.toNumber()).toBeGreaterThan(0)
      expect(processedPayPeriod.breakdown.netPay.toNumber()).toBeLessThan(1000)
    })

    it('should handle multiple tax years correctly', async () => {
      // Setup coefficients for multiple tax years
      const taxYears = ['2023-24', '2024-25']
      
      for (const taxYear of taxYears) {
        await prisma.taxRateConfig.create({
          data: {
            taxYear,
            medicareRate: new Decimal(0.02),
            medicareLowIncomeThreshold: new Decimal(taxYear === '2023-24' ? 25000 : 26000),
            medicareHighIncomeThreshold: new Decimal(taxYear === '2023-24' ? 31000 : 32500),
            description: `Configuration for ${taxYear}`,
            isActive: true,
          },
        })

        // Different coefficient rates for each tax year
        const coefficientA = taxYear === '2023-24' ? new Decimal(0.18) : new Decimal(0.19)
        await prisma.taxCoefficient.create({
          data: {
            taxYear,
            scale: 'scale2',
            earningsFrom: new Decimal(371),
            earningsTo: new Decimal(515),
            coefficientA,
            coefficientB: new Decimal(70.5385),
            description: `${taxYear} tax bracket`,
            isActive: true,
          },
        })
      }

      // Create user and settings
      const user = await prisma.user.create({
        data: {
          name: 'Test User',
          email: 'test@example.com',
          timezone: 'Australia/Sydney',
          payPeriodType: 'FORTNIGHTLY',
        },
      })

      const taxSettings = await prisma.taxSettings.create({
        data: {
          userId: user.id,
          claimedTaxFreeThreshold: true,
          isForeignResident: false,
          hasTaxFileNumber: true,
          medicareExemption: 'none',
          hecsHelpRate: null,
        },
      })

      // Create YTD tax for each year
      for (const taxYear of taxYears) {
        await prisma.yearToDateTax.create({
          data: {
            userId: user.id,
            taxYear,
            grossIncome: new Decimal(10000),
            payGWithholding: new Decimal(1000),
            medicareLevy: new Decimal(200),
            hecsHelpAmount: new Decimal(0),
            totalWithholdings: new Decimal(1200),
            lastUpdated: new Date(),
          },
        })
      }

      // Test calculations for each tax year
      const results = []
      for (const taxYear of taxYears) {
        const ytd = await prisma.yearToDateTax.findUnique({
          where: { userId_taxYear: { userId: user.id, taxYear } },
        })

        TaxCoefficientService.clearCacheForTaxYear(taxYear)
        const calculator = await TaxCalculator.createFromDatabase(taxSettings, taxYear)
        const result = calculator.calculatePayPeriodTax(
          `test-${taxYear}`,
          new Decimal(1000),
          'FORTNIGHTLY',
          ytd!
        )
        results.push({ taxYear, result })
      }

      // Results should be different for each tax year
      expect(results[0].result.breakdown.paygWithholding.toNumber()).not.toEqual(
        results[1].result.breakdown.paygWithholding.toNumber()
      )

      // 2023-24 should have lower withholding (18% vs 19% coefficient)
      expect(results[0].result.breakdown.paygWithholding.toNumber()).toBeLessThan(
        results[1].result.breakdown.paygWithholding.toNumber()
      )
    })

    it('should handle cache invalidation correctly', async () => {
      const taxYear = '2024-25'

      // Setup initial configuration
      await prisma.taxRateConfig.create({
        data: {
          taxYear,
          medicareRate: new Decimal(0.02),
          medicareLowIncomeThreshold: new Decimal(26000),
          medicareHighIncomeThreshold: new Decimal(32500),
          description: 'Initial configuration',
          isActive: true,
        },
      })

      await prisma.taxCoefficient.create({
        data: {
          taxYear,
          scale: 'scale2',
          earningsFrom: new Decimal(371),
          earningsTo: new Decimal(515),
          coefficientA: new Decimal(0.19),
          coefficientB: new Decimal(70.5385),
          description: 'Initial coefficient',
          isActive: true,
        },
      })

      // First load - should hit database
      const firstLoad = await TaxCoefficientService.getTaxCoefficients(taxYear, 'scale2')
      expect(firstLoad).toHaveLength(1)
      expect(firstLoad[0].coefficientA.toNumber()).toBeCloseTo(0.19, 6)

      // Second load - should use cache
      const secondLoad = await TaxCoefficientService.getTaxCoefficients(taxYear, 'scale2')
      expect(secondLoad).toEqual(firstLoad)

      // Update coefficient in database
      await prisma.taxCoefficient.updateMany({
        where: { taxYear, scale: 'scale2' },
        data: { coefficientA: new Decimal(0.25) },
      })

      // Third load - should still use cache (stale data)
      const thirdLoad = await TaxCoefficientService.getTaxCoefficients(taxYear, 'scale2')
      expect(thirdLoad[0].coefficientA.toNumber()).toBeCloseTo(0.19, 6) // Still old value

      // Clear cache
      TaxCoefficientService.clearCache()

      // Fourth load - should hit database and get new value
      const fourthLoad = await TaxCoefficientService.getTaxCoefficients(taxYear, 'scale2')
      expect(fourthLoad[0].coefficientA.toNumber()).toBeCloseTo(0.25, 6) // New value
    })

    it('should handle database failures gracefully with fallback', async () => {
      // Setup user and tax settings
      const user = await prisma.user.create({
        data: {
          name: 'Test User',
          email: 'test@example.com',
          timezone: 'Australia/Sydney',
          payPeriodType: 'FORTNIGHTLY',
        },
      })

      const taxSettings = await prisma.taxSettings.create({
        data: {
          userId: user.id,
          claimedTaxFreeThreshold: true,
          isForeignResident: false,
          hasTaxFileNumber: true,
          medicareExemption: 'none',
          hecsHelpRate: null,
        },
      })

      const yearToDateTax = await prisma.yearToDateTax.create({
        data: {
          userId: user.id,
          taxYear: '2024-25',
          grossIncome: new Decimal(10000),
          payGWithholding: new Decimal(1000),
          medicareLevy: new Decimal(200),
          hecsHelpAmount: new Decimal(0),
          totalWithholdings: new Decimal(1200),
          lastUpdated: new Date(),
        },
      })

      // Disconnect database to simulate failure
      await prisma.$disconnect()

      // Tax calculator should still work with fallback coefficients
      const calculator = await TaxCalculator.createFromDatabase(taxSettings, '2024-25')
      const result = calculator.calculatePayPeriodTax(
        'test-fallback',
        new Decimal(1000),
        'FORTNIGHTLY',
        yearToDateTax
      )

      // Should return valid results even with database failure
      expect(result.breakdown.grossPay).toEqual(new Decimal(1000))
      expect(result.breakdown.paygWithholding.toNumber()).toBeGreaterThan(0)
    })

    it('should validate coefficient consistency across scales', async () => {
      const taxYear = '2024-25'

      // Setup tax configuration
      await prisma.taxRateConfig.create({
        data: {
          taxYear,
          medicareRate: new Decimal(0.02),
          medicareLowIncomeThreshold: new Decimal(26000),
          medicareHighIncomeThreshold: new Decimal(32500),
          description: 'Test configuration',
          isActive: true,
        },
      })

      // Setup coefficients for both scale1 and scale2
      const coefficients = [
        // Scale 2 (claimed tax-free threshold)
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
          description: 'Scale 2 - 19% bracket',
          isActive: true,
        },
        // Scale 1 (did not claim tax-free threshold)
        {
          taxYear,
          scale: 'scale1',
          earningsFrom: new Decimal(0),
          earningsTo: new Decimal(88),
          coefficientA: new Decimal(0.19),
          coefficientB: new Decimal(0),
          description: 'Scale 1 - from first dollar',
          isActive: true,
        },
        {
          taxYear,
          scale: 'scale1',
          earningsFrom: new Decimal(88),
          earningsTo: new Decimal(371),
          coefficientA: new Decimal(0.2348),
          coefficientB: new Decimal(12.7692),
          description: 'Scale 1 - higher bracket',
          isActive: true,
        },
      ]

      for (const coeff of coefficients) {
        await prisma.taxCoefficient.create({ data: coeff })
      }

      // Create test users with different tax settings
      const user = await prisma.user.create({
        data: {
          name: 'Test User',
          email: 'test@example.com',
          timezone: 'Australia/Sydney',
          payPeriodType: 'FORTNIGHTLY',
        },
      })

      const taxSettingsWithTaxFree = await prisma.taxSettings.create({
        data: {
          userId: user.id,
          claimedTaxFreeThreshold: true, // Should use scale2
          isForeignResident: false,
          hasTaxFileNumber: true,
          medicareExemption: 'none',
          hecsHelpRate: null,
        },
      })

      const user2 = await prisma.user.create({
        data: {
          name: 'Test User 2',
          email: 'test2@example.com',
          timezone: 'Australia/Sydney',
          payPeriodType: 'FORTNIGHTLY',
        },
      })

      const taxSettingsWithoutTaxFree = await prisma.taxSettings.create({
        data: {
          userId: user2.id,
          claimedTaxFreeThreshold: false, // Should use scale1
          isForeignResident: false,
          hasTaxFileNumber: true,
          medicareExemption: 'none',
          hecsHelpRate: null,
        },
      })

      const yearToDateTax = await prisma.yearToDateTax.create({
        data: {
          userId: user.id,
          taxYear,
          grossIncome: new Decimal(5000),
          payGWithholding: new Decimal(500),
          medicareLevy: new Decimal(100),
          hecsHelpAmount: new Decimal(0),
          totalWithholdings: new Decimal(600),
          lastUpdated: new Date(),
        },
      })

      // Test calculations with different scales
      const calculatorWithTaxFree = await TaxCalculator.createFromDatabase(taxSettingsWithTaxFree, taxYear)
      const calculatorWithoutTaxFree = await TaxCalculator.createFromDatabase(taxSettingsWithoutTaxFree, taxYear)

      const resultWithTaxFree = calculatorWithTaxFree.calculatePayPeriodTax(
        'test-scale2',
        new Decimal(500), // Low income to test tax-free threshold effect
        'FORTNIGHTLY',
        yearToDateTax
      )

      const resultWithoutTaxFree = calculatorWithoutTaxFree.calculatePayPeriodTax(
        'test-scale1',
        new Decimal(500), // Same income
        'FORTNIGHTLY',
        yearToDateTax
      )

      // Scale 1 (no tax-free threshold) should have higher withholding for low income
      expect(resultWithTaxFree.taxScale).toBe('scale2')
      expect(resultWithoutTaxFree.taxScale).toBe('scale1')
      expect(resultWithoutTaxFree.breakdown.paygWithholding.toNumber()).toBeGreaterThan(
        resultWithTaxFree.breakdown.paygWithholding.toNumber()
      )
    })
  })
})
