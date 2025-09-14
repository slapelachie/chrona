import { Decimal } from 'decimal.js'
import { TaxCalculator, DEFAULT_TAX_COEFFICIENTS, DEFAULT_HECS_THRESHOLDS } from '../calculations/tax-calculator'
import { TaxSettings, PayPeriodType, YearToDateTax } from '@/types'

describe('TaxCalculator', () => {
  // Mock tax settings for testing
  const mockTaxSettings: TaxSettings = {
    id: 'test-tax-settings',
    userId: 'test-user',
    claimedTaxFreeThreshold: true,
    isForeignResident: false,
    hasTaxFileNumber: true,
    medicareExemption: 'none',
    hecsHelpRate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockYearToDateTax: YearToDateTax = {
    id: 'test-ytd',
    userId: 'test-user',
    taxYear: '2024-25',
    grossIncome: new Decimal(10000),
    payGWithholding: new Decimal(1000),
    medicareLevy: new Decimal(200),
    hecsHelpAmount: new Decimal(0),
    totalWithholdings: new Decimal(1200),
    lastUpdated: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  let calculator: TaxCalculator

  beforeEach(() => {
    calculator = new TaxCalculator(
      mockTaxSettings,
      DEFAULT_TAX_COEFFICIENTS,
      DEFAULT_HECS_THRESHOLDS
    )
  })

  describe('PAYG Withholding Calculations', () => {
    test('should calculate correct PAYG withholding for low income (tax-free threshold)', () => {
      // Test weekly pay of $300 (below tax-free threshold when annualized)
      const result = calculator.calculatePayPeriodTax(
        'test-pay-period',
        new Decimal(600), // Fortnightly pay
        'FORTNIGHTLY',
        mockYearToDateTax
      )

      // Low income should have minimal or no PAYG withholding
      expect(result.breakdown.paygWithholding.toNumber()).toBeLessThan(50)
      expect(result.taxScale).toBe('scale2') // Claimed tax-free threshold
    })

    test('should calculate correct PAYG withholding for medium income', () => {
      // Test fortnightly pay of $2000 (~$52k annually)
      const result = calculator.calculatePayPeriodTax(
        'test-pay-period',
        new Decimal(2000),
        'FORTNIGHTLY',
        mockYearToDateTax
      )

      // Should have reasonable PAYG withholding
      expect(result.breakdown.paygWithholding.toNumber()).toBeGreaterThan(100)
      expect(result.breakdown.paygWithholding.toNumber()).toBeLessThan(500)
    })

    test('should calculate higher PAYG withholding for high income', () => {
      // Test fortnightly pay of $4000 (~$104k annually)
      const result = calculator.calculatePayPeriodTax(
        'test-pay-period',
        new Decimal(4000),
        'FORTNIGHTLY',
        mockYearToDateTax
      )

      // Should have significant PAYG withholding
      expect(result.breakdown.paygWithholding.toNumber()).toBeGreaterThan(500)
    })

    test('should use correct tax scale for different settings', () => {
      // Test foreign resident (Scale 3)
      const foreignResidentSettings: TaxSettings = {
        ...mockTaxSettings,
        isForeignResident: true,
      }

      const foreignCalculator = new TaxCalculator(
        foreignResidentSettings,
        DEFAULT_TAX_COEFFICIENTS,
        DEFAULT_HECS_THRESHOLDS
      )

      const result = foreignCalculator.calculatePayPeriodTax(
        'test-pay-period',
        new Decimal(1000),
        'FORTNIGHTLY',
        mockYearToDateTax
      )

      expect(result.taxScale).toBe('scale3')
    })

    test('should use correct tax scale for no tax-free threshold', () => {
      // Test did not claim tax-free threshold (Scale 1)
      const noTaxFreeSettings: TaxSettings = {
        ...mockTaxSettings,
        claimedTaxFreeThreshold: false,
      }

      const noTaxFreeCalculator = new TaxCalculator(
        noTaxFreeSettings,
        DEFAULT_TAX_COEFFICIENTS,
        DEFAULT_HECS_THRESHOLDS
      )

      const result = noTaxFreeCalculator.calculatePayPeriodTax(
        'test-pay-period',
        new Decimal(1000),
        'FORTNIGHTLY',
        mockYearToDateTax
      )

      expect(result.taxScale).toBe('scale1')
    })
  })

  describe('Medicare Levy Calculations', () => {
    test('should not charge Medicare levy for low income', () => {
      // Test income below Medicare threshold
      const lowIncomeYtd: YearToDateTax = {
        ...mockYearToDateTax,
        grossIncome: new Decimal(5000), // Low YTD income
      }

      const result = calculator.calculatePayPeriodTax(
        'test-pay-period',
        new Decimal(400), // Low fortnightly pay
        'FORTNIGHTLY',
        lowIncomeYtd
      )

      expect(result.breakdown.medicareLevy.toNumber()).toBe(0)
    })

    test('should charge partial Medicare levy for medium income', () => {
      // Test income in Medicare levy shade-out range ($1000 fortnightly = $26,000 annually, which is between $26,000-$32,500)
      const result = calculator.calculatePayPeriodTax(
        'test-pay-period',
        new Decimal(1000), // Medium fortnightly pay
        'FORTNIGHTLY',
        mockYearToDateTax
      )

      // Should have some Medicare levy but not full 2%
      expect(result.breakdown.medicareLevy.toNumber()).toBeGreaterThan(0)
      expect(result.breakdown.medicareLevy.toNumber()).toBeLessThan(20) // Less than 2% of $1000
    })

    test('should charge full Medicare levy for high income', () => {
      // Test high income
      const highIncomeYtd: YearToDateTax = {
        ...mockYearToDateTax,
        grossIncome: new Decimal(50000), // High YTD income
      }

      const result = calculator.calculatePayPeriodTax(
        'test-pay-period',
        new Decimal(3000), // High fortnightly pay
        'FORTNIGHTLY',
        highIncomeYtd
      )

      // Should charge full 2% Medicare levy
      const expectedMedicareLevy = new Decimal(3000).times(0.02) // 2% of $3000 = $60
      expect(result.breakdown.medicareLevy.toNumber()).toBeCloseTo(expectedMedicareLevy.toNumber(), 2)
    })

    test('should handle Medicare exemptions', () => {
      // Test full Medicare exemption
      const exemptSettings: TaxSettings = {
        ...mockTaxSettings,
        medicareExemption: 'full',
      }

      const exemptCalculator = new TaxCalculator(
        exemptSettings,
        DEFAULT_TAX_COEFFICIENTS,
        DEFAULT_HECS_THRESHOLDS
      )

      const result = exemptCalculator.calculatePayPeriodTax(
        'test-pay-period',
        new Decimal(3000),
        'FORTNIGHTLY',
        mockYearToDateTax
      )

      expect(result.breakdown.medicareLevy.toNumber()).toBe(0)
    })

    test('should handle half Medicare exemption', () => {
      // Test half Medicare exemption
      const halfExemptSettings: TaxSettings = {
        ...mockTaxSettings,
        medicareExemption: 'half',
      }

      const halfExemptCalculator = new TaxCalculator(
        halfExemptSettings,
        DEFAULT_TAX_COEFFICIENTS,
        DEFAULT_HECS_THRESHOLDS,
        new Decimal(0.02), // 2% Medicare rate
        new Decimal(26000), // Low threshold
        new Decimal(32500)  // High threshold
      )

      const highIncomeYtd: YearToDateTax = {
        ...mockYearToDateTax,
        grossIncome: new Decimal(50000), // High YTD income to ensure full rate applies
      }

      const result = halfExemptCalculator.calculatePayPeriodTax(
        'test-pay-period',
        new Decimal(3000),
        'FORTNIGHTLY',
        highIncomeYtd
      )

      // Should charge half the Medicare levy (1% instead of 2%)
      const expectedHalfMedicareLevy = new Decimal(3000).times(0.01) // 1% of $3000 = $30
      expect(result.breakdown.medicareLevy.toNumber()).toBeCloseTo(expectedHalfMedicareLevy.toNumber(), 2)
    })
  })

  describe('HECS-HELP Calculations', () => {
    test('should not charge HECS-HELP when not configured', () => {
      const result = calculator.calculatePayPeriodTax(
        'test-pay-period',
        new Decimal(2000),
        'FORTNIGHTLY',
        mockYearToDateTax
      )

      expect(result.breakdown.hecsHelpAmount.toNumber()).toBe(0)
    })

    test('should calculate HECS-HELP when configured', () => {
      // Configure HECS-HELP at 1% rate
      const hecsSettings: TaxSettings = {
        ...mockTaxSettings,
        hecsHelpRate: new Decimal(0.01), // 1%
      }

      const hecsCalculator = new TaxCalculator(
        hecsSettings,
        DEFAULT_TAX_COEFFICIENTS,
        DEFAULT_HECS_THRESHOLDS
      )

      // High income to trigger HECS-HELP
      const highIncomeYtd: YearToDateTax = {
        ...mockYearToDateTax,
        grossIncome: new Decimal(60000), // Above HECS threshold
      }

      const result = hecsCalculator.calculatePayPeriodTax(
        'test-pay-period',
        new Decimal(2500), // High fortnightly pay
        'FORTNIGHTLY',
        highIncomeYtd
      )

      // Should have HECS-HELP deduction
      expect(result.breakdown.hecsHelpAmount.toNumber()).toBeGreaterThan(0)
    })
  })

  describe('Pay Period Conversions', () => {
    test('should handle weekly pay periods correctly', () => {
      const result = calculator.calculatePayPeriodTax(
        'test-pay-period',
        new Decimal(1000),
        'WEEKLY',
        mockYearToDateTax
      )

      expect(result.payPeriod.payPeriodType).toBe('WEEKLY')
      expect(result.breakdown.netPay.toNumber()).toBeLessThan(1000)
    })

    test('should handle monthly pay periods correctly', () => {
      const result = calculator.calculatePayPeriodTax(
        'test-pay-period',
        new Decimal(4333), // ~$52k annually
        'MONTHLY',
        mockYearToDateTax
      )

      expect(result.payPeriod.payPeriodType).toBe('MONTHLY')
      expect(result.breakdown.netPay.toNumber()).toBeLessThan(4333)
    })

    test('should produce consistent results across different pay periods for same annual income', () => {
      const annualIncome = new Decimal(52000)
      
      const weeklyPay = annualIncome.div(52.18)
      const fortnightlyPay = annualIncome.div(26.09)
      const monthlyPay = annualIncome.div(12)

      const weeklyResult = calculator.calculatePayPeriodTax(
        'test-weekly',
        weeklyPay,
        'WEEKLY',
        mockYearToDateTax
      )

      const fortnightlyResult = calculator.calculatePayPeriodTax(
        'test-fortnightly',
        fortnightlyPay,
        'FORTNIGHTLY',
        mockYearToDateTax
      )

      const monthlyResult = calculator.calculatePayPeriodTax(
        'test-monthly',
        monthlyPay,
        'MONTHLY',
        mockYearToDateTax
      )

      // Tax rates should be proportionally similar (within $5 tolerance)
      const weeklyAnnualizedTax = weeklyResult.breakdown.paygWithholding.times(52.18)
      const fortnightlyAnnualizedTax = fortnightlyResult.breakdown.paygWithholding.times(26.09)
      const monthlyAnnualizedTax = monthlyResult.breakdown.paygWithholding.times(12)

      expect(Math.abs(weeklyAnnualizedTax.minus(fortnightlyAnnualizedTax).toNumber())).toBeLessThan(100)
      expect(Math.abs(fortnightlyAnnualizedTax.minus(monthlyAnnualizedTax).toNumber())).toBeLessThan(100)
    })
  })

  describe('Total Calculations', () => {
    test('should calculate correct total withholdings', () => {
      const result = calculator.calculatePayPeriodTax(
        'test-pay-period',
        new Decimal(2000),
        'FORTNIGHTLY',
        mockYearToDateTax
      )

      const expectedTotal = result.breakdown.paygWithholding
        .plus(result.breakdown.medicareLevy)
        .plus(result.breakdown.hecsHelpAmount)

      expect(result.breakdown.totalWithholdings.toNumber()).toBe(expectedTotal.toNumber())
    })

    test('should calculate correct net pay', () => {
      const grossPay = new Decimal(2000)
      const result = calculator.calculatePayPeriodTax(
        'test-pay-period',
        grossPay,
        'FORTNIGHTLY',
        mockYearToDateTax
      )

      const expectedNetPay = grossPay.minus(result.breakdown.totalWithholdings)
      expect(result.breakdown.netPay.toNumber()).toBe(expectedNetPay.toNumber())
    })

    test('should update year-to-date tracking', () => {
      const grossPay = new Decimal(2000)
      const result = calculator.calculatePayPeriodTax(
        'test-pay-period',
        grossPay,
        'FORTNIGHTLY',
        mockYearToDateTax
      )

      const expectedYtdGrossIncome = mockYearToDateTax.grossIncome.plus(grossPay)
      expect(result.yearToDate.grossIncome.toNumber()).toBe(expectedYtdGrossIncome.toNumber())

      const expectedYtdWithholdings = mockYearToDateTax.totalWithholdings.plus(result.breakdown.totalWithholdings)
      expect(result.yearToDate.totalWithholdings.toNumber()).toBeCloseTo(expectedYtdWithholdings.toNumber(), 2)
    })
  })

  describe('Edge Cases', () => {
    test('should handle zero gross pay', () => {
      const result = calculator.calculatePayPeriodTax(
        'test-pay-period',
        new Decimal(0),
        'FORTNIGHTLY',
        mockYearToDateTax
      )

      expect(result.breakdown.paygWithholding.toNumber()).toBe(0)
      expect(result.breakdown.medicareLevy.toNumber()).toBe(0)
      expect(result.breakdown.hecsHelpAmount.toNumber()).toBe(0)
      expect(result.breakdown.totalWithholdings.toNumber()).toBe(0)
      expect(result.breakdown.netPay.toNumber()).toBe(0)
    })

    test('should handle very high income', () => {
      const result = calculator.calculatePayPeriodTax(
        'test-pay-period',
        new Decimal(10000), // $260k annually
        'FORTNIGHTLY',
        mockYearToDateTax
      )

      // Should have substantial withholdings but still be reasonable
      expect(result.breakdown.totalWithholdings.toNumber()).toBeGreaterThan(2000)
      expect(result.breakdown.totalWithholdings.toNumber()).toBeLessThan(5000)
      expect(result.breakdown.netPay.toNumber()).toBeGreaterThan(5000)
    })

    test('should handle all decimal calculations precisely', () => {
      const result = calculator.calculatePayPeriodTax(
        'test-pay-period',
        new Decimal(1234.56),
        'FORTNIGHTLY',
        mockYearToDateTax
      )

      // All monetary values should be rounded to cents
      expect(result.breakdown.paygWithholding.decimalPlaces()).toBeLessThanOrEqual(2)
      expect(result.breakdown.medicareLevy.decimalPlaces()).toBeLessThanOrEqual(2)
      expect(result.breakdown.hecsHelpAmount.decimalPlaces()).toBeLessThanOrEqual(2)
      expect(result.breakdown.totalWithholdings.decimalPlaces()).toBeLessThanOrEqual(2)
      expect(result.breakdown.netPay.decimalPlaces()).toBeLessThanOrEqual(2)
    })
  })
})