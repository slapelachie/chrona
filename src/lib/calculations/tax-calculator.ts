import { Decimal } from 'decimal.js'
import {
  TaxSettings,
  TaxCalculationResult,
  TaxScale,
  PayPeriodType,
  TaxCoefficient,
  StslRate,
  YearToDateTax,
  TaxRateConfig,
} from '@/types'
import { TimeCalculations } from './time-calculations'
import { TaxCoefficientService } from '@/lib/tax-coefficient-service'

/**
 * Australian Tax Calculator - ATO Compliant PAYG Withholding
 * 
 * Implements official ATO withholding formulas using coefficients from Schedule 1.
 * Handles PAYG withholding and HECS-HELP calculations.
 */
export class TaxCalculator {
  private taxSettings: TaxSettings
  private coefficients: TaxCoefficient[]
  // STSL coefficients (Schedule 8) – using formula A/B only (no versioning/threshold tables)
  private stslRates: StslRate[]
  private medicareRate: Decimal
  private medicareLowIncomeThreshold: Decimal
  private medicareHighIncomeThreshold: Decimal

  constructor(
    taxSettings: TaxSettings,
    coefficients: TaxCoefficient[],
    stslRates: StslRate[] = [],
    medicareRate: Decimal = new Decimal(0.02), // 2%
    medicareLowIncomeThreshold: Decimal = new Decimal(26000),
    medicareHighIncomeThreshold: Decimal = new Decimal(32500)
  ) {
    this.taxSettings = taxSettings
    this.coefficients = coefficients
    this.stslRates = stslRates
    this.medicareRate = medicareRate
    this.medicareLowIncomeThreshold = medicareLowIncomeThreshold
    this.medicareHighIncomeThreshold = medicareHighIncomeThreshold
  }

  /**
   * Create TaxCalculator instance using database coefficients for specified tax year
   */
  static async createFromDatabase(
    taxSettings: TaxSettings,
    taxYear: string = '2024-25'
  ): Promise<TaxCalculator> {
    try {
      const taxConfig = await TaxCoefficientService.getTaxRateConfig(taxYear)
      
      return new TaxCalculator(
        taxSettings,
        taxConfig.coefficients,
        (taxConfig.stslRates || []).filter(r => r.coefficientA && r.coefficientB),
        taxConfig.medicareRate,
        taxConfig.medicareLowIncomeThreshold,
        taxConfig.medicareHighIncomeThreshold
      )
    } catch (error) {
      console.error('Failed to load tax configuration from database, using fallback:', error)
      
      // Fallback to hardcoded values if database fails
      return new TaxCalculator(
        taxSettings,
        DEFAULT_TAX_COEFFICIENTS,
        []
      )
    }
  }

  /**
   * Calculate complete tax breakdown for a pay period
   */
  calculatePayPeriodTax(
    payPeriodId: string,
    grossPay: Decimal,
    payPeriodType: PayPeriodType,
    yearToDateTax: YearToDateTax,
    opts?: { taxYear?: string; onDate?: Date }
  ): TaxCalculationResult {
    // Convert gross pay to weekly equivalent for ATO calculations
    const weeklyGrossPay = this.convertToWeeklyPay(grossPay, payPeriodType)
    
    // Determine appropriate tax scale
    const taxScale = this.determineTaxScale()
    
    // Calculate PAYG withholding using ATO coefficients
    const weeklyPaygWithholding = this.calculatePaygWithholding(weeklyGrossPay, taxScale)
    const paygWithholdingRaw = this.convertFromWeeklyPay(weeklyPaygWithholding, payPeriodType)
    
    // Calculate Medicare levy
    // Medicare levy is included in PAYG for this product; set to zero
    const medicareLevyRaw = new Decimal(0)
    
    // Calculate HECS-HELP amount
    const hecsHelpAmountRaw = this.calculateHecsHelp(grossPay, payPeriodType, yearToDateTax)
    
    const hecsHelpAmount = TimeCalculations.roundDownToDollar(hecsHelpAmountRaw)
    const totalWithholdings = paygWithholding.plus(hecsHelpAmount)
    const netPay = grossPay.minus(totalWithholdings)
    
    // Update year-to-date tracking
    const updatedYtd = this.updateYearToDate(
      yearToDateTax,
      grossPay,
      paygWithholding,
      medicareLevy,
      hecsHelpAmount
    )
    
    return {
      payPeriod: {
        id: payPeriodId,
        grossPay,
        payPeriodType,
      },
      breakdown: {
        grossPay: TimeCalculations.roundToCents(grossPay),
        // Taxes are whole dollars (floored)
        paygWithholding,
        medicareLevy,
        hecsHelpAmount,
        totalWithholdings,
        // Net pay keeps cents and is rounded to two decimals for display
        netPay: TimeCalculations.roundToCents(netPay),
      },
      taxScale,
      yearToDate: {
        grossIncome: updatedYtd.grossIncome,
        totalWithholdings: updatedYtd.totalWithholdings,
      },
    }
  }

  async calculatePayPeriodTaxAsync(
    payPeriodId: string,
    grossPay: Decimal,
    payPeriodType: PayPeriodType,
    yearToDateTax: YearToDateTax,
    opts?: { taxYear?: string; onDate?: Date }
  ): Promise<TaxCalculationResult> {
    const weeklyGrossPay = this.convertToWeeklyPay(grossPay, payPeriodType)
    const taxScale = this.determineTaxScale()
    const weeklyPaygWithholding = this.calculatePaygWithholding(weeklyGrossPay, taxScale)
    const paygWithholdingRaw = this.convertFromWeeklyPay(weeklyPaygWithholding, payPeriodType)
    const medicareLevyRaw = new Decimal(0)
    const hecsHelpAmountRaw = await this.calculateHecsHelpAsync(
      grossPay,
      payPeriodType,
      { taxYear: opts?.taxYear ?? this.getCurrentTaxYear(), onDate: opts?.onDate ?? new Date() }
    )

    const paygWithholding = TimeCalculations.roundDownToDollar(paygWithholdingRaw)
    const medicareLevy = TimeCalculations.roundDownToDollar(medicareLevyRaw)
    const hecsHelpAmount = TimeCalculations.roundDownToDollar(hecsHelpAmountRaw)
    const totalWithholdings = paygWithholding.plus(hecsHelpAmount)
    const netPay = grossPay.minus(totalWithholdings)

    const updatedYtd = this.updateYearToDate(
      yearToDateTax,
      grossPay,
      paygWithholding,
      medicareLevy,
      hecsHelpAmount
    )

    return {
      payPeriod: { id: payPeriodId, grossPay, payPeriodType },
      breakdown: {
        grossPay: TimeCalculations.roundToCents(grossPay),
        paygWithholding,
        medicareLevy,
        hecsHelpAmount,
        totalWithholdings,
        netPay: TimeCalculations.roundToCents(netPay),
      },
      taxScale,
      yearToDate: {
        grossIncome: updatedYtd.grossIncome,
        totalWithholdings: updatedYtd.totalWithholdings,
      },
    }
  }

  /**
   * Calculate PAYG withholding using ATO coefficients
   * Formula: Withholding = (a × weekly earnings) - b
   */
  private calculatePaygWithholding(weeklyGrossPay: Decimal, taxScale: TaxScale): Decimal {
    // Find appropriate coefficient bracket
    const coefficient = this.findTaxCoefficient(weeklyGrossPay, taxScale)
    
    if (!coefficient) {
      return new Decimal(0)
    }

    // Apply ATO formula: (a × weekly earnings) - b
    const withholding = weeklyGrossPay.times(coefficient.coefficientA).minus(coefficient.coefficientB)
    
    // Ensure non-negative result
    return Decimal.max(0, withholding)
  }

  /**
   * Calculate Medicare levy based on annual income thresholds
   */
  private calculateMedicareLevy(
    _grossPay: Decimal,
    _payPeriodType: PayPeriodType,
    _yearToDateTax: YearToDateTax
  ): Decimal {
    // Medicare levy not calculated separately; included in PAYG withholding
    return new Decimal(0)
  }

  /**
   * Calculate HECS-HELP repayment amount
   */
  private calculateHecsHelp(
    grossPay: Decimal,
    payPeriodType: PayPeriodType,
    _yearToDateTax: YearToDateTax
  ): Decimal {
    // Determine STSL scale per Schedule 8
    const stslScale = (this.taxSettings.claimedTaxFreeThreshold || this.taxSettings.isForeignResident)
      ? 'WITH_TFT_OR_FR'
      : 'NO_TFT'

    // Convert to weekly equivalent per Schedule 8 (exact factors)
    let weeklyEquivalent: Decimal
    switch (payPeriodType) {
      case 'WEEKLY':
        weeklyEquivalent = grossPay
        break
      case 'FORTNIGHTLY':
        weeklyEquivalent = grossPay.div(2)
        break
      case 'MONTHLY':
        weeklyEquivalent = grossPay.times(3).div(13)
        break
      default:
        throw new Error(`Unsupported pay period type: ${payPeriodType}`)
    }

    // x: ignore cents and add 99 cents
    const x = weeklyEquivalent.floor().plus(0.99)

    // Find A/B bracket from in-memory STSL set (formula-only)
    const row = this.stslRates.find(r => r.scale === stslScale && r.coefficientA && r.coefficientB && x.gte(r.earningsFrom) && (r.earningsTo === null || x.lt(r.earningsTo)))
    if (!row) return new Decimal(0)
    const weekly = Decimal.max(new Decimal(0), x.times(row.coefficientA!).minus(row.coefficientB!))

    switch (payPeriodType) {
      case 'WEEKLY': return weekly
      case 'FORTNIGHTLY': return weekly.times(2)
      case 'MONTHLY': return weekly.times(13).div(3)
      default: throw new Error(`Unsupported pay period type: ${payPeriodType}`)
    }
  }

  /**
   * Determine appropriate tax scale based on user settings
   */
  private determineTaxScale(): TaxScale {
    if (!this.taxSettings.hasTaxFileNumber) {
      return 'scale4' // No TFN provided
    }

    if (this.taxSettings.isForeignResident) {
      return 'scale3' // Foreign resident
    }

    if (this.taxSettings.medicareExemption === 'full') {
      return 'scale5' // Full Medicare exemption
    }

    if (this.taxSettings.medicareExemption === 'half') {
      return 'scale6' // Half Medicare exemption
    }

    if (this.taxSettings.claimedTaxFreeThreshold) {
      return 'scale2' // Claimed tax-free threshold
    }

    return 'scale1' // Did not claim tax-free threshold
  }

  /**
   * Find appropriate tax coefficient for earnings and scale
   */
  private findTaxCoefficient(weeklyEarnings: Decimal, scale: TaxScale): TaxCoefficient | undefined {
    return this.coefficients.find(coeff => 
      coeff.scale === scale &&
      weeklyEarnings.gte(coeff.earningsFrom) &&
      (coeff.earningsTo === null || weeklyEarnings.lt(coeff.earningsTo))
    )
  }

  /**
   * Convert pay to weekly equivalent for ATO calculations
   */
  private convertToWeeklyPay(amount: Decimal, payPeriodType: PayPeriodType): Decimal {
    switch (payPeriodType) {
      case 'WEEKLY':
        return amount
      case 'FORTNIGHTLY':
        return amount.div(2)
      case 'MONTHLY':
        return amount.times(12).div(52.18) // More precise monthly-to-weekly conversion
      default:
        throw new Error(`Unsupported pay period type: ${payPeriodType}`)
    }
  }

  /**
   * Convert weekly amount back to pay period equivalent
   */
  private convertFromWeeklyPay(weeklyAmount: Decimal, payPeriodType: PayPeriodType): Decimal {
    switch (payPeriodType) {
      case 'WEEKLY':
        return weeklyAmount
      case 'FORTNIGHTLY':
        return weeklyAmount.times(2)
      case 'MONTHLY':
        return weeklyAmount.times(52.18).div(12) // More precise weekly-to-monthly conversion
      default:
        throw new Error(`Unsupported pay period type: ${payPeriodType}`)
    }
  }

  /**
   * Get number of pay periods per year
   */
  private getPeriodsPerYear(payPeriodType: PayPeriodType): Decimal {
    switch (payPeriodType) {
      case 'WEEKLY':
        return new Decimal(52.18)
      case 'FORTNIGHTLY':
        return new Decimal(26.09)
      case 'MONTHLY':
        return new Decimal(12)
      default:
        throw new Error(`Unsupported pay period type: ${payPeriodType}`)
    }
  }

  /**
   * Update year-to-date tax tracking
   */
  private updateYearToDate(
    yearToDateTax: YearToDateTax,
    grossPay: Decimal,
    paygWithholding: Decimal,
    medicareLevy: Decimal,
    hecsHelpAmount: Decimal
  ): YearToDateTax {
    return {
      ...yearToDateTax,
      grossIncome: yearToDateTax.grossIncome.plus(grossPay),
      payGWithholding: yearToDateTax.payGWithholding.plus(paygWithholding),
      medicareLevy: yearToDateTax.medicareLevy.plus(medicareLevy),
      hecsHelpAmount: yearToDateTax.hecsHelpAmount.plus(hecsHelpAmount),
      totalWithholdings: yearToDateTax.totalWithholdings
        .plus(paygWithholding)
        .plus(medicareLevy)
        .plus(hecsHelpAmount),
      lastUpdated: new Date(),
    }
  }
}

/**
 * Default ATO tax coefficients for 2024-25 tax year (example values)
 * These should be loaded from a configuration file or database
 */
export const DEFAULT_TAX_COEFFICIENTS: TaxCoefficient[] = [
  // Scale 2 - Claimed tax-free threshold (most common for employees)
  { scale: 'scale2', earningsFrom: new Decimal(0), earningsTo: new Decimal(371), coefficientA: new Decimal(0), coefficientB: new Decimal(0) },
  { scale: 'scale2', earningsFrom: new Decimal(371), earningsTo: new Decimal(515), coefficientA: new Decimal(0.19), coefficientB: new Decimal(70.5385) },
  { scale: 'scale2', earningsFrom: new Decimal(515), earningsTo: new Decimal(721), coefficientA: new Decimal(0.2348), coefficientB: new Decimal(93.4615) },
  { scale: 'scale2', earningsFrom: new Decimal(721), earningsTo: new Decimal(1282), coefficientA: new Decimal(0.219), coefficientB: new Decimal(82.1154) },
  { scale: 'scale2', earningsFrom: new Decimal(1282), earningsTo: new Decimal(2307), coefficientA: new Decimal(0.3477), coefficientB: new Decimal(247.1154) },
  { scale: 'scale2', earningsFrom: new Decimal(2307), earningsTo: null, coefficientA: new Decimal(0.45), coefficientB: new Decimal(482.6731) },
  
  // Scale 1 - Did not claim tax-free threshold
  { scale: 'scale1', earningsFrom: new Decimal(0), earningsTo: new Decimal(88), coefficientA: new Decimal(0.19), coefficientB: new Decimal(0) },
  { scale: 'scale1', earningsFrom: new Decimal(88), earningsTo: new Decimal(371), coefficientA: new Decimal(0.2348), coefficientB: new Decimal(12.7692) },
  { scale: 'scale1', earningsFrom: new Decimal(371), earningsTo: new Decimal(515), coefficientA: new Decimal(0.219), coefficientB: new Decimal(6.5385) },
  { scale: 'scale1', earningsFrom: new Decimal(515), earningsTo: new Decimal(721), coefficientA: new Decimal(0.3477), coefficientB: new Decimal(72.5385) },
  { scale: 'scale1', earningsFrom: new Decimal(721), earningsTo: new Decimal(1282), coefficientA: new Decimal(0.45), coefficientB: new Decimal(146.0769) },
  { scale: 'scale1', earningsFrom: new Decimal(1282), earningsTo: null, coefficientA: new Decimal(0.45), coefficientB: new Decimal(146.0769) },
]

/**
 * Default HECS-HELP thresholds for 2024-25 tax year
 */
export const DEFAULT_HECS_THRESHOLDS: HecsThreshold[] = [
  { incomeFrom: new Decimal(51550), incomeTo: new Decimal(59518), rate: new Decimal(0.01) }, // 1%
  { incomeFrom: new Decimal(59518), incomeTo: new Decimal(63090), rate: new Decimal(0.02) }, // 2%
  { incomeFrom: new Decimal(63090), incomeTo: new Decimal(66662), rate: new Decimal(0.025) }, // 2.5%
  { incomeFrom: new Decimal(66662), incomeTo: new Decimal(70235), rate: new Decimal(0.03) }, // 3%
  { incomeFrom: new Decimal(70235), incomeTo: new Decimal(74808), rate: new Decimal(0.035) }, // 3.5%
  { incomeFrom: new Decimal(74808), incomeTo: new Decimal(79381), rate: new Decimal(0.04) }, // 4%
  { incomeFrom: new Decimal(79381), incomeTo: new Decimal(84981), rate: new Decimal(0.045) }, // 4.5%
  { incomeFrom: new Decimal(84981), incomeTo: new Decimal(90554), rate: new Decimal(0.05) }, // 5%
  { incomeFrom: new Decimal(90554), incomeTo: new Decimal(96127), rate: new Decimal(0.055) }, // 5.5%
  { incomeFrom: new Decimal(96127), incomeTo: new Decimal(101700), rate: new Decimal(0.06) }, // 6%
  { incomeFrom: new Decimal(101700), incomeTo: new Decimal(109177), rate: new Decimal(0.065) }, // 6.5%
  { incomeFrom: new Decimal(109177), incomeTo: new Decimal(116653), rate: new Decimal(0.07) }, // 7%
  { incomeFrom: new Decimal(116653), incomeTo: new Decimal(124130), rate: new Decimal(0.075) }, // 7.5%
  { incomeFrom: new Decimal(124130), incomeTo: new Decimal(131607), rate: new Decimal(0.08) }, // 8%
  { incomeFrom: new Decimal(131607), incomeTo: new Decimal(139083), rate: new Decimal(0.085) }, // 8.5%
  { incomeFrom: new Decimal(139083), incomeTo: new Decimal(147560), rate: new Decimal(0.09) }, // 9%
  { incomeFrom: new Decimal(147560), incomeTo: new Decimal(156037), rate: new Decimal(0.095) }, // 9.5%
  { incomeFrom: new Decimal(156037), incomeTo: null, rate: new Decimal(0.10) }, // 10%
]
