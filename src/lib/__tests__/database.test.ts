/**
 * Blackbox Database Tests
 * 
 * These tests verify database operations from a user perspective without knowledge
 * of internal implementation. Tests focus on inputs, outputs, and expected behavior.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'
import { Decimal } from 'decimal.js'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./test.db'
    }
  }
})

describe('Database Models - Blackbox Tests', () => {
  beforeAll(async () => {
    // Set up test database
    process.env.DATABASE_URL = 'file:./test.db'
    execSync('npx prisma migrate dev --name init', { stdio: 'pipe' })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    // Clean database before each test
    await prisma.shift.deleteMany()
    await prisma.payPeriod.deleteMany()
    await prisma.penaltyTimeFrame.deleteMany()
    await prisma.payGuide.deleteMany()
    await prisma.user.deleteMany()
  })

  describe('User Model Operations', () => {
    it('should create a user with valid data', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        timezone: 'Australia/Sydney'
      }

      const user = await prisma.user.create({ data: userData })

      expect(user).toMatchObject({
        name: 'Test User',
        email: 'test@example.com',
        timezone: 'Australia/Sydney'
      })
      expect(user.id).toBeTruthy()
      expect(user.createdAt).toBeInstanceOf(Date)
      expect(user.updatedAt).toBeInstanceOf(Date)
    })

    it('should enforce unique email constraint', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        timezone: 'Australia/Sydney'
      }

      await prisma.user.create({ data: userData })

      await expect(
        prisma.user.create({ 
          data: { ...userData, name: 'Another User' }
        })
      ).rejects.toThrow()
    })

    it('should use default timezone when not provided', async () => {
      const user = await prisma.user.create({
        data: {
          name: 'Test User',
          email: 'test@example.com'
        }
      })

      expect(user.timezone).toBe('Australia/Sydney')
    })
  })

  describe('PayGuide Model Operations', () => {
    it('should create a pay guide with Australian award data', async () => {
      const payGuideData = {
        name: 'General Retail Industry Award 2020',
        baseRate: new Decimal('25.41'),
        casualLoading: new Decimal('0.25'),
        effectiveFrom: new Date('2024-01-01'),
        description: 'Adult casual minimum wage',
        overtimeRules: {
          daily: {
            regularHours: 8,
            firstOvertimeRate: 1.5,
            firstOvertimeHours: 12,
            secondOvertimeRate: 2.0
          }
        }
      }

      const payGuide = await prisma.payGuide.create({ data: payGuideData })

      expect(payGuide.name).toBe('General Retail Industry Award 2020')
      expect(payGuide.baseRate.toString()).toBe('25.41')
      expect(payGuide.casualLoading.toString()).toBe('0.25')
      expect(payGuide.isActive).toBe(true)
      expect(payGuide.overtimeRules).toEqual(payGuideData.overtimeRules)
    })

    it('should enforce unique pay guide names', async () => {
      const payGuideData = {
        name: 'Test Award',
        baseRate: new Decimal('25.00'),
        casualLoading: new Decimal('0.25'),
        effectiveFrom: new Date('2024-01-01'),
        overtimeRules: {}
      }

      await prisma.payGuide.create({ data: payGuideData })

      await expect(
        prisma.payGuide.create({ 
          data: { ...payGuideData, baseRate: new Decimal('30.00') }
        })
      ).rejects.toThrow()
    })

    it('should use default casual loading when not provided', async () => {
      const payGuide = await prisma.payGuide.create({
        data: {
          name: 'Test Award',
          baseRate: new Decimal('25.00'),
          effectiveFrom: new Date('2024-01-01'),
          overtimeRules: {}
        }
      })

      expect(payGuide.casualLoading.toString()).toBe('0.25')
    })
  })

  describe('PenaltyTimeFrame Model Operations', () => {
    let payGuide: any

    beforeEach(async () => {
      payGuide = await prisma.payGuide.create({
        data: {
          name: 'Test Award',
          baseRate: new Decimal('25.00'),
          casualLoading: new Decimal('0.25'),
          effectiveFrom: new Date('2024-01-01'),
          overtimeRules: {}
        }
      })
    })

    it('should create weekend penalty time frame', async () => {
      const penaltyData = {
        payGuideId: payGuide.id,
        name: 'Saturday Penalty',
        multiplier: new Decimal('1.5'),
        dayOfWeek: 6, // Saturday
        description: '150% penalty for Saturday work'
      }

      const penalty = await prisma.penaltyTimeFrame.create({ data: penaltyData })

      expect(penalty.name).toBe('Saturday Penalty')
      expect(penalty.multiplier.toString()).toBe('1.5')
      expect(penalty.dayOfWeek).toBe(6)
      expect(penalty.isActive).toBe(true)
      expect(penalty.isPublicHoliday).toBe(false)
    })

    it('should create time-based penalty time frame', async () => {
      const penaltyData = {
        payGuideId: payGuide.id,
        name: 'Evening Penalty',
        multiplier: new Decimal('1.25'),
        startTime: '18:00',
        endTime: '23:59',
        description: 'Evening penalty rate'
      }

      const penalty = await prisma.penaltyTimeFrame.create({ data: penaltyData })

      expect(penalty.startTime).toBe('18:00')
      expect(penalty.endTime).toBe('23:59')
      expect(penalty.dayOfWeek).toBeNull()
    })

    it('should create public holiday penalty', async () => {
      const penaltyData = {
        payGuideId: payGuide.id,
        name: 'Public Holiday Penalty',
        multiplier: new Decimal('2.5'),
        isPublicHoliday: true,
        description: '250% penalty for public holidays'
      }

      const penalty = await prisma.penaltyTimeFrame.create({ data: penaltyData })

      expect(penalty.isPublicHoliday).toBe(true)
      expect(penalty.multiplier.toString()).toBe('2.5')
    })

    it('should cascade delete penalty time frames when pay guide is deleted', async () => {
      const penalty = await prisma.penaltyTimeFrame.create({
        data: {
          payGuideId: payGuide.id,
          name: 'Test Penalty',
          multiplier: new Decimal('1.5')
        }
      })

      await prisma.payGuide.delete({ where: { id: payGuide.id } })

      const deletedPenalty = await prisma.penaltyTimeFrame.findUnique({
        where: { id: penalty.id }
      })
      expect(deletedPenalty).toBeNull()
    })
  })

  describe('Shift Model Operations', () => {
    let user: any
    let payGuide: any
    let payPeriod: any

    beforeEach(async () => {
      user = await prisma.user.create({
        data: {
          name: 'Test User',
          email: 'test@example.com'
        }
      })

      payGuide = await prisma.payGuide.create({
        data: {
          name: 'Test Award',
          baseRate: new Decimal('25.00'),
          casualLoading: new Decimal('0.25'),
          effectiveFrom: new Date('2024-01-01'),
          overtimeRules: {}
        }
      })

      payPeriod = await prisma.payPeriod.create({
        data: {
          userId: user.id,
          startDate: new Date('2024-01-01T00:00:00Z'),
          endDate: new Date('2024-01-14T23:59:59Z')
        }
      })
    })

    it('should create a shift with required fields', async () => {
      const shiftData = {
        userId: user.id,
        payGuideId: payGuide.id,
        startTime: new Date('2024-01-02T09:00:00Z'),
        endTime: new Date('2024-01-02T17:00:00Z'),
        breakMinutes: 30,
        payPeriodId: payPeriod.id
      }

      const shift = await prisma.shift.create({ data: shiftData })

      expect(shift.userId).toBe(user.id)
      expect(shift.payGuideId).toBe(payGuide.id)
      expect(shift.startTime).toEqual(shiftData.startTime)
      expect(shift.endTime).toEqual(shiftData.endTime)
      expect(shift.breakMinutes).toBe(30)
      expect(shift.payPeriodId).toBe(payPeriod.id)
    })

    it('should use default break minutes when not provided', async () => {
      const shift = await prisma.shift.create({
        data: {
          userId: user.id,
          payGuideId: payGuide.id,
          startTime: new Date('2024-01-02T09:00:00Z'),
          endTime: new Date('2024-01-02T17:00:00Z')
        }
      })

      expect(shift.breakMinutes).toBe(0)
    })

    it('should store calculated pay amounts as decimals', async () => {
      const shift = await prisma.shift.create({
        data: {
          userId: user.id,
          payGuideId: payGuide.id,
          startTime: new Date('2024-01-02T09:00:00Z'),
          endTime: new Date('2024-01-02T17:00:00Z'),
          totalHours: new Decimal('8.0'),
          basePay: new Decimal('200.00'),
          overtimePay: new Decimal('0.00'),
          penaltyPay: new Decimal('0.00'),
          casualPay: new Decimal('50.00'),
          totalPay: new Decimal('250.00')
        }
      })

      expect(shift.totalHours?.toString()).toBe('8.00')
      expect(shift.basePay?.toString()).toBe('200.00')
      expect(shift.totalPay?.toString()).toBe('250.00')
    })

    it('should cascade delete shifts when user is deleted', async () => {
      const shift = await prisma.shift.create({
        data: {
          userId: user.id,
          payGuideId: payGuide.id,
          startTime: new Date('2024-01-02T09:00:00Z'),
          endTime: new Date('2024-01-02T17:00:00Z')
        }
      })

      await prisma.user.delete({ where: { id: user.id } })

      const deletedShift = await prisma.shift.findUnique({
        where: { id: shift.id }
      })
      expect(deletedShift).toBeNull()
    })
  })

  describe('PayPeriod Model Operations', () => {
    let user: any

    beforeEach(async () => {
      user = await prisma.user.create({
        data: {
          name: 'Test User',
          email: 'test@example.com'
        }
      })
    })

    it('should create a fortnightly pay period', async () => {
      const payPeriodData = {
        userId: user.id,
        startDate: new Date('2024-01-01T00:00:00Z'),
        endDate: new Date('2024-01-14T23:59:59Z')
      }

      const payPeriod = await prisma.payPeriod.create({ data: payPeriodData })

      expect(payPeriod.userId).toBe(user.id)
      expect(payPeriod.startDate).toEqual(payPeriodData.startDate)
      expect(payPeriod.endDate).toEqual(payPeriodData.endDate)
      expect(payPeriod.status).toBe('open')
      expect(payPeriod.verified).toBe(false)
    })

    it('should store calculated totals as decimals', async () => {
      const payPeriod = await prisma.payPeriod.create({
        data: {
          userId: user.id,
          startDate: new Date('2024-01-01T00:00:00Z'),
          endDate: new Date('2024-01-14T23:59:59Z'),
          totalHours: new Decimal('76.5'),
          totalPay: new Decimal('2145.75'),
          actualPay: new Decimal('2145.75')
        }
      })

      expect(payPeriod.totalHours?.toString()).toBe('76.50')
      expect(payPeriod.totalPay?.toString()).toBe('2145.75')
      expect(payPeriod.actualPay?.toString()).toBe('2145.75')
    })

    it('should enforce unique pay periods per user and start date', async () => {
      const payPeriodData = {
        userId: user.id,
        startDate: new Date('2024-01-01T00:00:00Z'),
        endDate: new Date('2024-01-14T23:59:59Z')
      }

      await prisma.payPeriod.create({ data: payPeriodData })

      await expect(
        prisma.payPeriod.create({ 
          data: { ...payPeriodData, endDate: new Date('2024-01-15T23:59:59Z') }
        })
      ).rejects.toThrow()
    })

    it('should allow different users to have same start date', async () => {
      const anotherUser = await prisma.user.create({
        data: {
          name: 'Another User',
          email: 'another@example.com'
        }
      })

      const startDate = new Date('2024-01-01T00:00:00Z')
      const endDate = new Date('2024-01-14T23:59:59Z')

      const payPeriod1 = await prisma.payPeriod.create({
        data: {
          userId: user.id,
          startDate,
          endDate
        }
      })

      const payPeriod2 = await prisma.payPeriod.create({
        data: {
          userId: anotherUser.id,
          startDate,
          endDate
        }
      })

      expect(payPeriod1.userId).toBe(user.id)
      expect(payPeriod2.userId).toBe(anotherUser.id)
      expect(payPeriod1.startDate).toEqual(payPeriod2.startDate)
    })
  })

  describe('Relational Operations', () => {
    let user: any
    let payGuide: any
    let payPeriod: any

    beforeEach(async () => {
      user = await prisma.user.create({
        data: {
          name: 'Test User',
          email: 'test@example.com'
        }
      })

      payGuide = await prisma.payGuide.create({
        data: {
          name: 'Test Award',
          baseRate: new Decimal('25.00'),
          casualLoading: new Decimal('0.25'),
          effectiveFrom: new Date('2024-01-01'),
          overtimeRules: {}
        }
      })

      payPeriod = await prisma.payPeriod.create({
        data: {
          userId: user.id,
          startDate: new Date('2024-01-01T00:00:00Z'),
          endDate: new Date('2024-01-14T23:59:59Z')
        }
      })
    })

    it('should retrieve user with their pay periods and shifts', async () => {
      await prisma.shift.create({
        data: {
          userId: user.id,
          payGuideId: payGuide.id,
          startTime: new Date('2024-01-02T09:00:00Z'),
          endTime: new Date('2024-01-02T17:00:00Z'),
          payPeriodId: payPeriod.id
        }
      })

      const userWithRelations = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
          payPeriods: true,
          shifts: {
            include: {
              payGuide: true
            }
          }
        }
      })

      expect(userWithRelations?.payPeriods).toHaveLength(1)
      expect(userWithRelations?.shifts).toHaveLength(1)
      expect(userWithRelations?.shifts[0].payGuide.name).toBe('Test Award')
    })

    it('should retrieve pay guide with penalty time frames', async () => {
      await prisma.penaltyTimeFrame.create({
        data: {
          payGuideId: payGuide.id,
          name: 'Weekend Penalty',
          multiplier: new Decimal('1.5'),
          dayOfWeek: 6
        }
      })

      const payGuideWithPenalties = await prisma.payGuide.findUnique({
        where: { id: payGuide.id },
        include: {
          penaltyTimeFrames: true
        }
      })

      expect(payGuideWithPenalties?.penaltyTimeFrames).toHaveLength(1)
      expect(payGuideWithPenalties?.penaltyTimeFrames[0].name).toBe('Weekend Penalty')
    })

    it('should retrieve pay period with associated shifts', async () => {
      await prisma.shift.createMany({
        data: [
          {
            userId: user.id,
            payGuideId: payGuide.id,
            startTime: new Date('2024-01-02T09:00:00Z'),
            endTime: new Date('2024-01-02T17:00:00Z'),
            payPeriodId: payPeriod.id
          },
          {
            userId: user.id,
            payGuideId: payGuide.id,
            startTime: new Date('2024-01-03T09:00:00Z'),
            endTime: new Date('2024-01-03T17:00:00Z'),
            payPeriodId: payPeriod.id
          }
        ]
      })

      const payPeriodWithShifts = await prisma.payPeriod.findUnique({
        where: { id: payPeriod.id },
        include: {
          shifts: {
            include: {
              payGuide: true
            }
          }
        }
      })

      expect(payPeriodWithShifts?.shifts).toHaveLength(2)
      expect(payPeriodWithShifts?.shifts.every(s => s.payGuide.name === 'Test Award')).toBe(true)
    })
  })
})