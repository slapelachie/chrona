import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest'
// Use the app's prisma proxy so tests and services share the same client/DB
import { prisma as appPrisma } from '@/lib/db'
import { execSync } from 'child_process'
import { Decimal } from 'decimal.js'
import { PayPeriodSyncService } from '../pay-period-sync-service'

const DB_URL = 'file:./pay-period-sync-service-test.db'
const originalDbUrl = process.env.DATABASE_URL

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('PayPeriodSyncService', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = DB_URL
    // Push schema for isolated sqlite DB without regenerating client
    execSync('npx prisma db push --skip-generate', { stdio: 'pipe' })
  })
  let userId: string
  let payGuideId: string
  let payPeriodId: string

  beforeEach(async () => {
    // Ensure isolated DB is used by app code
    process.env.DATABASE_URL = DB_URL
    // Pre-clean potential collisions
    await appPrisma.breakPeriod.deleteMany()
    await appPrisma.shift.deleteMany()
    await appPrisma.yearToDateTax.deleteMany()
    await appPrisma.taxSettings.deleteMany()
    await appPrisma.payPeriod.deleteMany()
    await appPrisma.payGuide.deleteMany()
    await appPrisma.user.deleteMany()
    // Create test user
    const user = await appPrisma.user.create({
      data: {
        name: 'Test User',
        email: `pps-${Date.now()}@example.com`,
        timezone: 'Australia/Sydney',
        payPeriodType: 'FORTNIGHTLY',
      },
    })
    userId = user.id

    // Create test pay guide
    const payGuide = await appPrisma.payGuide.create({
      data: {
        name: `Test Pay Guide ${Date.now()}`,
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
    const payPeriod = await appPrisma.payPeriod.create({
      data: {
        userId,
        startDate: new Date('2024-09-01T00:00:00Z'),
        endDate: new Date('2024-09-14T23:59:59Z'),
        status: 'pending',
      },
    })
    payPeriodId = payPeriod.id

    // Create tax settings for the user
    await appPrisma.taxSettings.create({
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
    await appPrisma.breakPeriod.deleteMany()
    await appPrisma.shift.deleteMany()
    await appPrisma.yearToDateTax.deleteMany()
    await appPrisma.taxSettings.deleteMany()
    await appPrisma.payPeriod.deleteMany()
    await appPrisma.payGuide.deleteMany()
    await appPrisma.user.deleteMany()
  })

  afterAll(async () => {
    process.env.DATABASE_URL = originalDbUrl
  })

  describe('syncPayPeriod', () => {
    it('should calculate pay period totals from shifts', async () => {
      // Create test shifts with calculated values
      const shift1 = await appPrisma.shift.create({
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

      const shift2 = await appPrisma.shift.create({
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

      // Check that pay period totals were updated (allow brief async)
      let updatedPayPeriod = await appPrisma.payPeriod.findUnique({ where: { id: payPeriodId } })
      let tries1 = 0
      while (tries1 < 20 && (!updatedPayPeriod?.totalHours || !updatedPayPeriod?.totalPay)) {
        await sleep(50)
        tries1++
        updatedPayPeriod = await appPrisma.payPeriod.findUnique({ where: { id: payPeriodId } })
      }

      expect(updatedPayPeriod?.totalHours?.toNumber()).toBe(14.00)
      expect(updatedPayPeriod?.totalPay?.toNumber()).toBe(350.00)
    })

    it('should calculate taxes when pay period has calculated totals', async () => {
      // Create a shift with calculated pay
      await appPrisma.shift.create({
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

      // Check that tax calculations were performed (allow brief async)
      const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
      let updatedPayPeriod = await appPrisma.payPeriod.findUnique({ where: { id: payPeriodId } })
      let tries = 0
      while (tries < 10 && !updatedPayPeriod?.totalPay) {
        await wait(50)
        tries++
        updatedPayPeriod = await appPrisma.payPeriod.findUnique({ where: { id: payPeriodId } })
      }

      expect(updatedPayPeriod?.totalPay?.toNumber()).toBe(800.00)
      expect(updatedPayPeriod?.paygWithholding).toBeDefined()
      expect(updatedPayPeriod?.totalWithholdings).toBeDefined()
      expect(updatedPayPeriod?.netPay).toBeDefined()
    })

    it('should handle pay periods with no shifts', async () => {
      // Sync pay period with no shifts
      await PayPeriodSyncService.syncPayPeriod(payPeriodId)

      // Check that totals are zero
      const updatedPayPeriod = await appPrisma.payPeriod.findUnique({
        where: { id: payPeriodId },
      })

      expect(updatedPayPeriod?.totalHours?.toNumber()).toBe(0)
      expect(updatedPayPeriod?.totalPay?.toNumber()).toBe(0)
    })
  })

  describe('onShiftCreated', () => {
    it('should sync pay period when shift is created', async () => {
      const shift = await appPrisma.shift.create({
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

      let updatedPayPeriod = await appPrisma.payPeriod.findUnique({ where: { id: payPeriodId } })
      let tries2 = 0
      while (tries2 < 20 && (!updatedPayPeriod?.totalHours || !updatedPayPeriod?.totalPay)) {
        await sleep(50)
        tries2++
        updatedPayPeriod = await appPrisma.payPeriod.findUnique({ where: { id: payPeriodId } })
      }
      expect(updatedPayPeriod?.totalHours?.toNumber()).toBe(8.00)
      expect(updatedPayPeriod?.totalPay?.toNumber()).toBe(200.00)
    })
  })

  describe('onShiftUpdated', () => {
    it('should sync both old and new pay periods when shift moves', async () => {
      // Create second pay period
      const payPeriod2 = await appPrisma.payPeriod.create({
        data: {
          userId,
          startDate: new Date('2024-09-15T00:00:00Z'),
          endDate: new Date('2024-09-28T23:59:59Z'),
          status: 'pending',
        },
      })

      // Create shift in first pay period
      const shift = await appPrisma.shift.create({
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
      await appPrisma.shift.update({
        where: { id: shift.id },
        data: { payPeriodId: payPeriod2.id },
      })

      await PayPeriodSyncService.onShiftUpdated(shift.id, payPeriodId)

      // Check both pay periods
      const originalPayPeriod = await appPrisma.payPeriod.findUnique({
        where: { id: payPeriodId },
      })
      const newPayPeriod = await appPrisma.payPeriod.findUnique({
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
      const shift1 = await appPrisma.shift.create({
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

      const shift2 = await appPrisma.shift.create({
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
      await appPrisma.shift.delete({ where: { id: shift1.id } })

      // Sync after deletion
      await PayPeriodSyncService.onShiftDeleted(payPeriodId)

      const updatedPayPeriod = await appPrisma.payPeriod.findUnique({
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
      await appPrisma.shift.create({
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

      await appPrisma.payPeriod.update({
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
      await appPrisma.shift.create({
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
      await appPrisma.payPeriod.update({
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
