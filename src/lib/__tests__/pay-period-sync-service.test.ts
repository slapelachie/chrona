import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { Decimal } from 'decimal.js'
import { PayPeriodSyncService } from '../pay-period-sync-service'

const prisma = new PrismaClient()

describe('PayPeriodSyncService', () => {
  let userId: string
  let payGuideId: string
  let payPeriodId: string

  beforeEach(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        name: 'Test User',
        email: 'test@example.com',
        timezone: 'Australia/Sydney',
        payPeriodType: 'FORTNIGHTLY',
      },
    })
    userId = user.id

    // Create test pay guide
    const payGuide = await prisma.payGuide.create({
      data: {
        name: 'Test Pay Guide',
        baseRate: new Decimal('25.00'),
        minimumShiftHours: 3,
        maximumShiftHours: 11,
        timezone: 'Australia/Sydney',
        effectiveFrom: new Date('2024-01-01'),
        isActive: true,
      },
    })
    payGuideId = payGuide.id

    // Create test pay period
    const payPeriod = await prisma.payPeriod.create({
      data: {
        userId,
        startDate: new Date('2024-09-01T00:00:00Z'),
        endDate: new Date('2024-09-14T23:59:59Z'),
        status: 'open',
      },
    })
    payPeriodId = payPeriod.id

    // Create tax settings for the user
    await prisma.taxSettings.create({
      data: {
        userId,
        claimedTaxFreeThreshold: true,
        isForeignResident: false,
        hasTaxFileNumber: true,
        medicareExemption: 'none',
        hecsHelpRate: null,
      },
    })
  })

  afterEach(async () => {
    // Clean up test data
    await prisma.breakPeriod.deleteMany()
    await prisma.shift.deleteMany()
    await prisma.yearToDateTax.deleteMany()
    await prisma.taxSettings.deleteMany()
    await prisma.payPeriod.deleteMany()
    await prisma.payGuide.deleteMany()
    await prisma.user.deleteMany()
  })

  describe('syncPayPeriod', () => {
    it('should calculate pay period totals from shifts', async () => {
      // Create test shifts with calculated values
      const shift1 = await prisma.shift.create({
        data: {
          userId,
          payGuideId,
          payPeriodId,
          startTime: new Date('2024-09-02T09:00:00Z'),
          endTime: new Date('2024-09-02T17:00:00Z'),
          totalHours: new Decimal('8.00'),
          totalPay: new Decimal('200.00'),
        },
      })

      const shift2 = await prisma.shift.create({
        data: {
          userId,
          payGuideId,
          payPeriodId,
          startTime: new Date('2024-09-03T10:00:00Z'),
          endTime: new Date('2024-09-03T16:00:00Z'),
          totalHours: new Decimal('6.00'),
          totalPay: new Decimal('150.00'),
        },
      })

      // Sync the pay period
      await PayPeriodSyncService.syncPayPeriod(payPeriodId)

      // Check that pay period totals were updated
      const updatedPayPeriod = await prisma.payPeriod.findUnique({
        where: { id: payPeriodId },
      })

      expect(updatedPayPeriod?.totalHours?.toNumber()).toBe(14.00)
      expect(updatedPayPeriod?.totalPay?.toNumber()).toBe(350.00)
    })

    it('should calculate taxes when pay period has calculated totals', async () => {
      // Create a shift with calculated pay
      await prisma.shift.create({
        data: {
          userId,
          payGuideId,
          payPeriodId,
          startTime: new Date('2024-09-02T09:00:00Z'),
          endTime: new Date('2024-09-02T17:00:00Z'),
          totalHours: new Decimal('8.00'),
          totalPay: new Decimal('800.00'), // High enough to trigger tax
        },
      })

      // Sync the pay period
      await PayPeriodSyncService.syncPayPeriod(payPeriodId)

      // Check that tax calculations were performed
      const updatedPayPeriod = await prisma.payPeriod.findUnique({
        where: { id: payPeriodId },
      })

      expect(updatedPayPeriod?.totalPay?.toNumber()).toBe(800.00)
      expect(updatedPayPeriod?.paygWithholding).toBeDefined()
      expect(updatedPayPeriod?.totalWithholdings).toBeDefined()
      expect(updatedPayPeriod?.netPay).toBeDefined()
    })

    it('should handle pay periods with no shifts', async () => {
      // Sync pay period with no shifts
      await PayPeriodSyncService.syncPayPeriod(payPeriodId)

      // Check that totals are zero
      const updatedPayPeriod = await prisma.payPeriod.findUnique({
        where: { id: payPeriodId },
      })

      expect(updatedPayPeriod?.totalHours?.toNumber()).toBe(0)
      expect(updatedPayPeriod?.totalPay?.toNumber()).toBe(0)
    })
  })

  describe('onShiftCreated', () => {
    it('should sync pay period when shift is created', async () => {
      const shift = await prisma.shift.create({
        data: {
          userId,
          payGuideId,
          payPeriodId,
          startTime: new Date('2024-09-02T09:00:00Z'),
          endTime: new Date('2024-09-02T17:00:00Z'),
          totalHours: new Decimal('8.00'),
          totalPay: new Decimal('200.00'),
        },
      })

      await PayPeriodSyncService.onShiftCreated(shift.id)

      const updatedPayPeriod = await prisma.payPeriod.findUnique({
        where: { id: payPeriodId },
      })

      expect(updatedPayPeriod?.totalHours?.toNumber()).toBe(8.00)
      expect(updatedPayPeriod?.totalPay?.toNumber()).toBe(200.00)
    })
  })

  describe('onShiftUpdated', () => {
    it('should sync both old and new pay periods when shift moves', async () => {
      // Create second pay period
      const payPeriod2 = await prisma.payPeriod.create({
        data: {
          userId,
          startDate: new Date('2024-09-15T00:00:00Z'),
          endDate: new Date('2024-09-28T23:59:59Z'),
          status: 'open',
        },
      })

      // Create shift in first pay period
      const shift = await prisma.shift.create({
        data: {
          userId,
          payGuideId,
          payPeriodId,
          startTime: new Date('2024-09-02T09:00:00Z'),
          endTime: new Date('2024-09-02T17:00:00Z'),
          totalHours: new Decimal('8.00'),
          totalPay: new Decimal('200.00'),
        },
      })

      // Update shift to move to second pay period
      await prisma.shift.update({
        where: { id: shift.id },
        data: { payPeriodId: payPeriod2.id },
      })

      await PayPeriodSyncService.onShiftUpdated(shift.id, payPeriodId)

      // Check both pay periods
      const originalPayPeriod = await prisma.payPeriod.findUnique({
        where: { id: payPeriodId },
      })
      const newPayPeriod = await prisma.payPeriod.findUnique({
        where: { id: payPeriod2.id },
      })

      // Original should have zero totals
      expect(originalPayPeriod?.totalHours?.toNumber()).toBe(0)
      expect(originalPayPeriod?.totalPay?.toNumber()).toBe(0)

      // New should have the shift totals
      expect(newPayPeriod?.totalHours?.toNumber()).toBe(8.00)
      expect(newPayPeriod?.totalPay?.toNumber()).toBe(200.00)
    })
  })

  describe('onShiftDeleted', () => {
    it('should sync pay period when shift is deleted', async () => {
      // Create two shifts
      const shift1 = await prisma.shift.create({
        data: {
          userId,
          payGuideId,
          payPeriodId,
          startTime: new Date('2024-09-02T09:00:00Z'),
          endTime: new Date('2024-09-02T17:00:00Z'),
          totalHours: new Decimal('8.00'),
          totalPay: new Decimal('200.00'),
        },
      })

      const shift2 = await prisma.shift.create({
        data: {
          userId,
          payGuideId,
          payPeriodId,
          startTime: new Date('2024-09-03T10:00:00Z'),
          endTime: new Date('2024-09-03T16:00:00Z'),
          totalHours: new Decimal('6.00'),
          totalPay: new Decimal('150.00'),
        },
      })

      // Sync to get initial totals
      await PayPeriodSyncService.syncPayPeriod(payPeriodId)

      // Delete one shift
      await prisma.shift.delete({ where: { id: shift1.id } })

      // Sync after deletion
      await PayPeriodSyncService.onShiftDeleted(payPeriodId)

      const updatedPayPeriod = await prisma.payPeriod.findUnique({
        where: { id: payPeriodId },
      })

      // Should only have the remaining shift's totals
      expect(updatedPayPeriod?.totalHours?.toNumber()).toBe(6.00)
      expect(updatedPayPeriod?.totalPay?.toNumber()).toBe(150.00)
    })
  })

  describe('validatePayPeriodTotals', () => {
    it('should validate consistent pay period totals', async () => {
      // Create shift and manually set pay period totals
      await prisma.shift.create({
        data: {
          userId,
          payGuideId,
          payPeriodId,
          startTime: new Date('2024-09-02T09:00:00Z'),
          endTime: new Date('2024-09-02T17:00:00Z'),
          totalHours: new Decimal('8.00'),
          totalPay: new Decimal('200.00'),
        },
      })

      await prisma.payPeriod.update({
        where: { id: payPeriodId },
        data: {
          totalHours: new Decimal('8.00'),
          totalPay: new Decimal('200.00'),
        },
      })

      const validation = await PayPeriodSyncService.validatePayPeriodTotals(payPeriodId)

      expect(validation.isValid).toBe(true)
      expect(validation.expected.totalHours.toNumber()).toBe(8.00)
      expect(validation.expected.totalPay.toNumber()).toBe(200.00)
    })

    it('should detect inconsistent pay period totals', async () => {
      // Create shift
      await prisma.shift.create({
        data: {
          userId,
          payGuideId,
          payPeriodId,
          startTime: new Date('2024-09-02T09:00:00Z'),
          endTime: new Date('2024-09-02T17:00:00Z'),
          totalHours: new Decimal('8.00'),
          totalPay: new Decimal('200.00'),
        },
      })

      // Set incorrect pay period totals
      await prisma.payPeriod.update({
        where: { id: payPeriodId },
        data: {
          totalHours: new Decimal('10.00'), // Incorrect
          totalPay: new Decimal('250.00'),  // Incorrect
        },
      })

      const validation = await PayPeriodSyncService.validatePayPeriodTotals(payPeriodId)

      expect(validation.isValid).toBe(false)
      expect(validation.expected.totalHours.toNumber()).toBe(8.00)
      expect(validation.expected.totalPay.toNumber()).toBe(200.00)
      expect(validation.actual.totalHours?.toNumber()).toBe(10.00)
      expect(validation.actual.totalPay?.toNumber()).toBe(250.00)
    })
  })
})