import { Decimal } from 'decimal.js'
import { prisma } from '@/lib/db'
import { 
  PayPeriod,
  TaxSettings,
  YearToDateTax,
  TaxCalculationResult,
  PayPeriodType
} from '@/types'
import { TaxCalculator } from './calculations/tax-calculator'
import { TimeCalculations } from './calculations/time-calculations'

/**
 * Pay Period Tax Service
 * 
 * Handles tax calculations and processing for Australian pay periods.
 * Integrates with existing pay period management and adds tax calculations.
 */
export class PayPeriodTaxService {
  
  /**
   * Calculate and save tax information for a pay period
   */
  static async calculatePayPeriodTax(payPeriodId: string): Promise<TaxCalculationResult> {
    // Get pay period with related data
    const payPeriod = await prisma.payPeriod.findUnique({
      where: { id: payPeriodId },
      include: {
        user: {
          include: {
            taxSettings: true,
          }
        },
        shifts: true,
      }
    })

    if (!payPeriod) {
      throw new Error(`Pay period not found: ${payPeriodId}`)
    }

    if (!payPeriod.totalPay) {
      throw new Error(`Pay period ${payPeriodId} has no calculated total pay`)
    }

    // Get or create user tax settings
    const taxSettings = await this.getOrCreateTaxSettings(payPeriod.userId)
    
    // Get tax year from pay period dates (not current date)
    const taxYear = this.getTaxYearFromDate(payPeriod.startDate)
    const yearToDateTax = await this.getOrCreateYearToDateTax(payPeriod.userId, taxYear)

    // Initialize tax calculator using database coefficients for the pay period's tax year
    const taxCalculator = await TaxCalculator.createFromDatabase(
      taxSettings,
      taxYear
    )

    // Calculate tax breakdown
    const taxCalculation = taxCalculator.calculatePayPeriodTax(
      payPeriodId,
      payPeriod.totalPay,
      payPeriod.user.payPeriodType,
      yearToDateTax
    )

    // Update pay period with tax calculations
    await prisma.payPeriod.update({
      where: { id: payPeriodId },
      data: {
        paygWithholding: taxCalculation.breakdown.paygWithholding,
        medicareLevy: taxCalculation.breakdown.medicareLevy,
        hecsHelpAmount: taxCalculation.breakdown.hecsHelpAmount,
        totalWithholdings: taxCalculation.breakdown.totalWithholdings,
        netPay: taxCalculation.breakdown.netPay,
      }
    })

    // Update year-to-date tax tracking
    await prisma.yearToDateTax.update({
      where: { 
        userId_taxYear: {
          userId: payPeriod.userId,
          taxYear: taxYear
        }
      },
      data: {
        grossIncome: taxCalculation.yearToDate.grossIncome,
        payGWithholding: yearToDateTax.payGWithholding.plus(taxCalculation.breakdown.paygWithholding),
        medicareLevy: yearToDateTax.medicareLevy.plus(taxCalculation.breakdown.medicareLevy),
        hecsHelpAmount: yearToDateTax.hecsHelpAmount.plus(taxCalculation.breakdown.hecsHelpAmount),
        totalWithholdings: taxCalculation.yearToDate.totalWithholdings,
        lastUpdated: new Date(),
      }
    })

    return taxCalculation
  }

  /**
   * Preview tax calculation without saving to database
   */
  static async previewTaxCalculation(
    userId: string,
    grossPay: Decimal,
    payPeriodType: PayPeriodType,
    taxYear?: string
  ): Promise<TaxCalculationResult> {
    // Get user tax settings
    const taxSettings = await this.getOrCreateTaxSettings(userId)
    
    // Get year-to-date tax tracking
    const currentTaxYear = taxYear || this.getCurrentTaxYear()
    const yearToDateTax = await this.getOrCreateYearToDateTax(userId, currentTaxYear)

    // Initialize tax calculator using database coefficients
    const taxCalculator = await TaxCalculator.createFromDatabase(
      taxSettings,
      currentTaxYear
    )

    // Calculate tax breakdown (preview only)
    return taxCalculator.calculatePayPeriodTax(
      'preview',
      grossPay,
      payPeriodType,
      yearToDateTax
    )
  }

  /**
   * Process pay period when status changes to 'processing'
   * This is the main entry point for tax calculations
   */
  static async processPayPeriod(payPeriodId: string): Promise<PayPeriod> {
    // First calculate/recalculate pay totals from shifts
    const updatedPayPeriod = await this.calculatePayPeriodTotals(payPeriodId)
    
    // Then calculate taxes
    await this.calculatePayPeriodTax(payPeriodId)
    
    // Update status to processing
    const processedPayPeriod = await prisma.payPeriod.update({
      where: { id: payPeriodId },
      data: { 
        status: 'processing',
        updatedAt: new Date()
      }
    })

    return processedPayPeriod as PayPeriod
  }

  /**
   * Calculate total hours and pay for a pay period from its shifts
   */
  private static async calculatePayPeriodTotals(payPeriodId: string): Promise<PayPeriod> {
    const payPeriod = await prisma.payPeriod.findUnique({
      where: { id: payPeriodId },
      include: { shifts: true }
    })

    if (!payPeriod) {
      throw new Error(`Pay period not found: ${payPeriodId}`)
    }

    // Calculate totals from shifts
    const totalHours = payPeriod.shifts.reduce(
      (sum, shift) => sum.plus(shift.totalHours || new Decimal(0)), 
      new Decimal(0)
    )
    
    const totalPay = payPeriod.shifts.reduce(
      (sum, shift) => sum.plus(shift.totalPay || new Decimal(0)), 
      new Decimal(0)
    )

    // Update pay period with calculated totals
    return await prisma.payPeriod.update({
      where: { id: payPeriodId },
      data: {
        totalHours: TimeCalculations.roundToHours(totalHours),
        totalPay: TimeCalculations.roundToCents(totalPay),
      }
    }) as PayPeriod
  }

  /**
   * Get or create user tax settings with sensible defaults
   */
  private static async getOrCreateTaxSettings(userId: string): Promise<TaxSettings> {
    const existingSettings = await prisma.taxSettings.findUnique({
      where: { userId }
    })

    if (existingSettings) {
      return existingSettings as TaxSettings
    }

    // Create default tax settings for Australian employees
    return await prisma.taxSettings.create({
      data: {
        userId,
        claimedTaxFreeThreshold: true, // Most employees claim tax-free threshold
        isForeignResident: false,
        hasTaxFileNumber: true,
        medicareExemption: 'none',
        hecsHelpRate: null, // No HECS-HELP by default
      }
    }) as TaxSettings
  }

  /**
   * Get or create year-to-date tax tracking
   */
  private static async getOrCreateYearToDateTax(userId: string, taxYear: string): Promise<YearToDateTax> {
    const existingYtd = await prisma.yearToDateTax.findUnique({
      where: { 
        userId_taxYear: {
          userId,
          taxYear
        }
      }
    })

    if (existingYtd) {
      return existingYtd
    }

    // Create new year-to-date tracking
    return await prisma.yearToDateTax.create({
      data: {
        userId,
        taxYear,
        grossIncome: new Decimal(0),
        payGWithholding: new Decimal(0),
        medicareLevy: new Decimal(0),
        hecsHelpAmount: new Decimal(0),
        totalWithholdings: new Decimal(0),
        lastUpdated: new Date(),
      }
    })
  }

  /**
   * Get Australian tax year from a specific date (July 1 - June 30)
   */
  private static getTaxYearFromDate(date: Date): string {
    const year = date.getFullYear()
    
    // Australian tax year runs from July 1 to June 30
    if (date.getMonth() >= 6) { // July (6) onwards
      return `${year}-${(year + 1) % 100}`
    } else {
      return `${year - 1}-${year % 100}`
    }
  }

  /**
   * Get current Australian tax year (July 1 - June 30)
   */
  private static getCurrentTaxYear(): string {
    return this.getTaxYearFromDate(new Date())
  }

  /**
   * Get user's tax settings
   */
  static async getUserTaxSettings(userId: string): Promise<TaxSettings> {
    return await this.getOrCreateTaxSettings(userId)
  }

  /**
   * Update user's tax settings
   */
  static async updateUserTaxSettings(
    userId: string, 
    updates: Partial<Omit<TaxSettings, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
  ): Promise<TaxSettings> {
    return await prisma.taxSettings.upsert({
      where: { userId },
      update: {
        ...updates,
        updatedAt: new Date()
      },
      create: {
        userId,
        claimedTaxFreeThreshold: updates.claimedTaxFreeThreshold ?? true,
        isForeignResident: updates.isForeignResident ?? false,
        hasTaxFileNumber: updates.hasTaxFileNumber ?? true,
        medicareExemption: updates.medicareExemption ?? 'none',
        hecsHelpRate: updates.hecsHelpRate ?? null,
      }
    }) as TaxSettings
  }

  /**
   * Get year-to-date tax summary for a user
   */
  static async getYearToDateTaxSummary(userId: string, taxYear?: string): Promise<YearToDateTax> {
    const currentTaxYear = taxYear || this.getCurrentTaxYear()
    return await this.getOrCreateYearToDateTax(userId, currentTaxYear)
  }
}