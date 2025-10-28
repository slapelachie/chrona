import { Decimal } from 'decimal.js'
import { prisma } from '@/lib/db'
import { PayPeriod } from '@/types'
import { PayPeriodTaxService } from './pay-period-tax-service'
import { TimeCalculations } from './calculations/time-calculations'

/**
 * Pay Period Sync Service
 *
 * Handles automatic synchronization of pay period totals and tax calculations
 * whenever shifts are added, modified, or deleted. This ensures data consistency
 * across all related entities without requiring manual intervention.
 */
export class PayPeriodSyncService {
  /**
   * Synchronizes a pay period after shift changes
   * This is the main entry point for automatic updates
   */
  static async syncPayPeriod(payPeriodId: string): Promise<void> {
    try {
      // Step 1: Recalculate pay period totals from shifts
      await this.updatePayPeriodTotals(payPeriodId)

      // Step 2: Trigger tax calculation if pay period has calculated totals
      await this.updatePayPeriodTaxes(payPeriodId)
    } catch (error) {
      console.error(`❌ Failed to sync pay period ${payPeriodId}:`, error)
      // Don't re-throw to avoid breaking the original operation
      // Log the error and continue
    }
  }

  /**
   * Synchronizes multiple pay periods (used when shift moves between periods)
   */
  static async syncMultiplePayPeriods(payPeriodIds: string[]): Promise<void> {
    const uniqueIds = [...new Set(payPeriodIds.filter(Boolean))]

    for (const payPeriodId of uniqueIds) {
      await this.syncPayPeriod(payPeriodId)
    }
  }

  /**
   * Updates pay period totals by recalculating from all shifts
   */
  private static async updatePayPeriodTotals(
    payPeriodId: string
  ): Promise<PayPeriod> {
    const payPeriod = await prisma.payPeriod.findUnique({
      where: { id: payPeriodId },
      include: { shifts: true, extras: true },
    })

    if (!payPeriod) {
      throw new Error(`Pay period not found: ${payPeriodId}`)
    }

    // Calculate totals from all shifts in the pay period
    const totalHours = payPeriod.shifts.reduce(
      (sum, shift) => sum.plus(shift.totalHours || new Decimal(0)),
      new Decimal(0)
    )

    const shiftsPay = payPeriod.shifts.reduce(
      (sum, shift) => sum.plus(shift.totalPay || new Decimal(0)),
      new Decimal(0)
    )
    const extrasPay = (payPeriod.extras || []).reduce(
      (sum, ex) => sum.plus(ex.amount || new Decimal(0)),
      new Decimal(0)
    )
    const totalPay = shiftsPay.plus(extrasPay)

    // Update pay period with calculated totals
    const updatedPayPeriod = await prisma.payPeriod.update({
      where: { id: payPeriodId },
      data: {
        totalHours: TimeCalculations.roundToHours(totalHours),
        totalPay: TimeCalculations.roundToCents(totalPay),
        updatedAt: new Date(),
      },
    })

    return updatedPayPeriod as PayPeriod
  }

  /**
   * Updates tax calculations for a pay period if it has calculated totals
   */
  private static async updatePayPeriodTaxes(
    payPeriodId: string
  ): Promise<void> {
    const payPeriod = await prisma.payPeriod.findUnique({
      where: { id: payPeriodId },
      select: {
        id: true,
        totalPay: true,
        status: true,
        shifts: { select: { id: true } },
      },
    })

    if (!payPeriod) {
      return
    }

    // Only calculate taxes if:
    // 1. Pay period has calculated total pay
    // 2. Pay period has shifts
    // 3. Pay period is pending verification
    if (!payPeriod.totalPay || payPeriod.totalPay.isZero()) {
      return
    }

    if (payPeriod.shifts.length === 0) {
      return
    }

    if (payPeriod.status !== 'pending') {
      return
    }

    try {
      // Calculate taxes using the existing service
      await PayPeriodTaxService.calculatePayPeriodTax(payPeriodId)
    } catch (error) {
      console.error(
        `❌ Failed to calculate taxes for pay period ${payPeriodId}:`,
        error
      )
      // Don't re-throw - tax calculation failure shouldn't break the sync
    }
  }

  /**
   * Synchronizes pay period after a shift is created
   */
  static async onShiftCreated(shiftId: string): Promise<void> {
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      select: { payPeriodId: true },
    })

    if (shift?.payPeriodId) {
      await this.syncPayPeriod(shift.payPeriodId)
    }
  }

  /**
   * Synchronizes pay periods after a shift is updated
   * Handles cases where shift may have moved between pay periods
   */
  static async onShiftUpdated(
    shiftId: string,
    previousPayPeriodId?: string
  ): Promise<void> {
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      select: { payPeriodId: true },
    })

    // Sync both old and new pay periods if different
    const payPeriodsToSync = [shift?.payPeriodId, previousPayPeriodId].filter(
      Boolean
    ) as string[]
    await this.syncMultiplePayPeriods(payPeriodsToSync)
  }

  /**
   * Synchronizes pay period after a shift is deleted
   */
  static async onShiftDeleted(payPeriodId: string): Promise<void> {
    if (!payPeriodId) return

    try {
      // Check whether the pay period still has any shifts or extras
      const period = await prisma.payPeriod.findUnique({
        where: { id: payPeriodId },
        include: { _count: { select: { shifts: true, extras: true } } },
      })

      if (!period) {
        return
      }

      const hasShifts = period._count.shifts > 0
      const hasExtras = period._count.extras > 0

      // If the final shift was removed and there are no extras, delete the pay period itself
      // Relaxed: delete regardless of status
      if (!hasShifts && !hasExtras) {
        await prisma.payPeriod.delete({ where: { id: payPeriodId } })
        return
      }

      // Otherwise, keep the period and resync totals/taxes
      await this.syncPayPeriod(payPeriodId)
    } catch (err) {
      console.error(
        `Failed handling onShiftDeleted for pay period ${payPeriodId}:`,
        err
      )
    }
  }

  /**
   * Synchronizes pay period after break periods are modified
   * Since break periods affect shift calculations, this triggers pay period sync
   */
  static async onBreakPeriodsChanged(shiftId: string): Promise<void> {
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      select: { payPeriodId: true },
    })

    if (shift?.payPeriodId) {
      await this.syncPayPeriod(shift.payPeriodId)
    }
  }

  /**
   * Synchronizes pay period after extras are modified
   */
  static async onExtrasChanged(payPeriodId: string): Promise<void> {
    if (payPeriodId) {
      await this.syncPayPeriod(payPeriodId)
    }
  }

  /**
   * Validates that a pay period's totals are consistent with its shifts
   * Useful for debugging and data integrity checks
   */
  static async validatePayPeriodTotals(payPeriodId: string): Promise<{
    isValid: boolean
    expected: { totalHours: Decimal; totalPay: Decimal }
    actual: { totalHours: Decimal | null; totalPay: Decimal | null }
    differences: { hours: Decimal; pay: Decimal }
  }> {
    const payPeriod = await prisma.payPeriod.findUnique({
      where: { id: payPeriodId },
      include: { shifts: true },
    })

    if (!payPeriod) {
      throw new Error(`Pay period not found: ${payPeriodId}`)
    }

    // Calculate expected totals from shifts
    const expectedTotalHours = payPeriod.shifts.reduce(
      (sum, shift) => sum.plus(shift.totalHours || new Decimal(0)),
      new Decimal(0)
    )

    const expectedTotalPay = payPeriod.shifts.reduce(
      (sum, shift) => sum.plus(shift.totalPay || new Decimal(0)),
      new Decimal(0)
    )

    const actualTotalHours = payPeriod.totalHours || new Decimal(0)
    const actualTotalPay = payPeriod.totalPay || new Decimal(0)

    const hoursDiff = expectedTotalHours.minus(actualTotalHours).abs()
    const payDiff = expectedTotalPay.minus(actualTotalPay).abs()

    // Allow small rounding differences (1 minute for hours, 1 cent for pay)
    const isValid =
      hoursDiff.lessThanOrEqualTo(new Decimal('0.017')) && // ~1 minute
      payDiff.lessThanOrEqualTo(new Decimal('0.01')) // 1 cent

    return {
      isValid,
      expected: {
        totalHours: TimeCalculations.roundToHours(expectedTotalHours),
        totalPay: TimeCalculations.roundToCents(expectedTotalPay),
      },
      actual: {
        totalHours: payPeriod.totalHours,
        totalPay: payPeriod.totalPay,
      },
      differences: {
        hours: hoursDiff,
        pay: payDiff,
      },
    }
  }
}
