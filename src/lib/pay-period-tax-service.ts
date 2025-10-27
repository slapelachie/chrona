import { Decimal } from 'decimal.js'
import { prisma } from '@/lib/db'
import { 
  PayPeriod,
  TaxSettings,
  YearToDateTax,
  TaxCalculationResult,
  PayPeriodType
} from '@/types'
// TaxCalculator is imported dynamically inside methods to play nicely with test mocks

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
    const { createTaxCalculator } = await import('@/lib/create-tax-calculator')
    const taxCalculator = await createTaxCalculator(taxSettings, taxYear)

    // Calculate tax breakdown
    const taxCalculation = taxCalculator.calculatePayPeriodTax(
      payPeriodId,
      payPeriod.totalPay,
      payPeriod.user.payPeriodType,
      yearToDateTax,
      { taxYear }
    )

    // Update pay period with tax calculations
    await prisma.payPeriod.update({
      where: { id: payPeriodId },
      data: {
        paygWithholding: taxCalculation.breakdown.paygWithholding,
        stslAmount: taxCalculation.breakdown.stslAmount,
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
        stslAmount: yearToDateTax.stslAmount.plus(taxCalculation.breakdown.stslAmount),
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
    let yearToDateTax: YearToDateTax
    try {
      yearToDateTax = await this.getOrCreateYearToDateTax(userId, currentTaxYear)
    } catch (err) {
      // For previews, fall back to an in-memory zeroed YTD if DB is unavailable
      console.error('Failed to load YTD from database, using zeroed preview YTD:', err)
      yearToDateTax = {
        id: 'preview',
        userId,
        taxYear: currentTaxYear,
        grossIncome: new Decimal(0),
        payGWithholding: new Decimal(0),
        stslAmount: new Decimal(0),
        totalWithholdings: new Decimal(0),
        lastUpdated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as YearToDateTax
    }

    // Initialize tax calculator using database coefficients
    const { createTaxCalculator } = await import('@/lib/create-tax-calculator')
    const taxCalculator = await createTaxCalculator(taxSettings, currentTaxYear)

    // Calculate tax breakdown (preview only)
    return taxCalculator.calculatePayPeriodTax(
      'preview',
      grossPay,
      payPeriodType,
      yearToDateTax,
      { taxYear: currentTaxYear }
    )
  }

  /**
   * Recalculate pay totals and taxes without mutating status.
   */
  static async recalculatePayPeriod(payPeriodId: string): Promise<PayPeriod> {
    const { PayPeriodSyncService } = await import('./pay-period-sync-service')

    await PayPeriodSyncService.syncPayPeriod(payPeriodId)
    await this.calculatePayPeriodTax(payPeriodId)

    const refreshed = await prisma.payPeriod.findUnique({
      where: { id: payPeriodId },
      include: {
        shifts: {
          orderBy: { startTime: 'asc' },
        },
      },
    })

    if (!refreshed) {
      throw new Error('Failed to load pay period after recalculation')
    }

    return refreshed as PayPeriod
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
      return existingYtd as YearToDateTax
    }

    // Create new year-to-date tracking
    return await prisma.yearToDateTax.create({
      data: {
        userId,
        taxYear,
        grossIncome: new Decimal(0),
        payGWithholding: new Decimal(0),
        stslAmount: new Decimal(0),
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
