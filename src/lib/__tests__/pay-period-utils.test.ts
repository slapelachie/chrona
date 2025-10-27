/**
 * Pay Period Utilities Tests
 * 
 * Tests all pay period calculation functions for weekly, fortnightly, and monthly periods
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'
import {
  calculateWeeklyPeriod,
  calculateFortnightlyPeriod,
  calculateMonthlyPeriod,
  calculatePayPeriod,
  findOrCreatePayPeriod,
} from '../pay-period-utils'
import type { PayPeriodType } from '@/types'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./test-pay-period-utils.db',
    },
  },
})

describe('Pay Period Utilities', () => {
  beforeAll(async () => {
    // Set up test database
    process.env.DATABASE_URL = 'file:./test-pay-period-utils.db'
    execSync('npx prisma db push --skip-generate', { stdio: 'pipe' })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    // Clean database before each test
    await prisma.shift.deleteMany()
    await prisma.payPeriod.deleteMany()
    await prisma.user.deleteMany()
  })

  describe('calculateWeeklyPeriod', () => {
    it('should calculate correct weekly period for Monday', () => {
      const monday = new Date('2024-01-01T10:00:00Z') // Monday
      const { startDate, endDate } = calculateWeeklyPeriod(monday)

      expect(startDate).toEqual(new Date('2024-01-01T00:00:00.000Z'))
      expect(endDate).toEqual(new Date('2024-01-07T23:59:59.999Z'))
    })

    it('should calculate correct weekly period for Wednesday', () => {
      const wednesday = new Date('2024-01-03T10:00:00Z') // Wednesday
      const { startDate, endDate } = calculateWeeklyPeriod(wednesday)

      expect(startDate).toEqual(new Date('2024-01-01T00:00:00.000Z'))
      expect(endDate).toEqual(new Date('2024-01-07T23:59:59.999Z'))
    })

    it('should calculate correct weekly period for Sunday', () => {
      const sunday = new Date('2024-01-07T10:00:00Z') // Sunday
      const { startDate, endDate } = calculateWeeklyPeriod(sunday)

      expect(startDate).toEqual(new Date('2024-01-01T00:00:00.000Z'))
      expect(endDate).toEqual(new Date('2024-01-07T23:59:59.999Z'))
    })
  })

  describe('calculateFortnightlyPeriod', () => {
    it('should calculate correct fortnightly period', () => {
      const date = new Date('2024-01-03T10:00:00Z')
      const { startDate, endDate } = calculateFortnightlyPeriod(date)

      // Should be a 14-day period
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      expect(daysDiff).toBe(14)
      
      expect(startDate.getUTCHours()).toBe(0)
      expect(startDate.getUTCMinutes()).toBe(0)
      expect(endDate.getUTCHours()).toBe(23)
      expect(endDate.getUTCMinutes()).toBe(59)
    })

    it('should be consistent for dates within same fortnight', () => {
      const date1 = new Date('2024-01-01T10:00:00Z') // Monday  
      const date2 = new Date('2024-01-03T15:00:00Z') // Wednesday - should be in same fortnight
      
      const period1 = calculateFortnightlyPeriod(date1)
      const period2 = calculateFortnightlyPeriod(date2)

      expect(period1.startDate).toEqual(period2.startDate)
      expect(period1.endDate).toEqual(period2.endDate)
    })
  })

  describe('calculateMonthlyPeriod', () => {
    it('should calculate correct monthly period for January', () => {
      const date = new Date('2024-01-15T10:00:00Z')
      const { startDate, endDate } = calculateMonthlyPeriod(date)

      expect(startDate).toEqual(new Date('2024-01-01T00:00:00.000Z'))
      expect(endDate).toEqual(new Date('2024-01-31T23:59:59.999Z'))
    })

    it('should calculate correct monthly period for February (leap year)', () => {
      const date = new Date('2024-02-15T10:00:00Z')
      const { startDate, endDate } = calculateMonthlyPeriod(date)

      expect(startDate).toEqual(new Date('2024-02-01T00:00:00.000Z'))
      expect(endDate).toEqual(new Date('2024-02-29T23:59:59.999Z'))
    })

    it('should calculate correct monthly period for February (non-leap year)', () => {
      const date = new Date('2023-02-15T10:00:00Z')
      const { startDate, endDate } = calculateMonthlyPeriod(date)

      expect(startDate).toEqual(new Date('2023-02-01T00:00:00.000Z'))
      expect(endDate).toEqual(new Date('2023-02-28T23:59:59.999Z'))
    })

    it('should be consistent for dates within same month', () => {
      const date1 = new Date('2024-03-01T10:00:00Z')
      const date2 = new Date('2024-03-31T15:00:00Z')
      
      const period1 = calculateMonthlyPeriod(date1)
      const period2 = calculateMonthlyPeriod(date2)

      expect(period1.startDate).toEqual(period2.startDate)
      expect(period1.endDate).toEqual(period2.endDate)
    })
  })

  describe('calculatePayPeriod', () => {
    it('should delegate to weekly calculation', () => {
      const date = new Date('2024-01-03T10:00:00Z')
      const weeklyResult = calculatePayPeriod(date, 'WEEKLY')
      const directWeeklyResult = calculateWeeklyPeriod(date)

      expect(weeklyResult).toEqual(directWeeklyResult)
    })

    it('should delegate to fortnightly calculation', () => {
      const date = new Date('2024-01-03T10:00:00Z')
      const fortnightlyResult = calculatePayPeriod(date, 'FORTNIGHTLY')
      const directFortnightlyResult = calculateFortnightlyPeriod(date)

      expect(fortnightlyResult).toEqual(directFortnightlyResult)
    })

    it('should delegate to monthly calculation', () => {
      const date = new Date('2024-01-15T10:00:00Z')
      const monthlyResult = calculatePayPeriod(date, 'MONTHLY')
      const directMonthlyResult = calculateMonthlyPeriod(date)

      expect(monthlyResult).toEqual(directMonthlyResult)
    })

    it('should throw error for invalid pay period type', () => {
      const date = new Date('2024-01-03T10:00:00Z')
      expect(() => 
        calculatePayPeriod(date, 'INVALID' as PayPeriodType)
      ).toThrow('Unsupported pay period type: INVALID')
    })
  })

  describe('findOrCreatePayPeriod', () => {
    let user: any

    beforeEach(async () => {
      user = await prisma.user.create({
        data: {
          name: 'Test User',
          email: 'test@example.com',
          payPeriodType: 'FORTNIGHTLY',
        },
      })
    })

    it('should create pay period with fortnightly type for user', async () => {
      const shiftDate = new Date('2024-01-03T10:00:00Z')
      const payPeriod = await findOrCreatePayPeriod(user.id, shiftDate)

      expect(payPeriod.userId).toBe(user.id)
      expect(payPeriod.status).toBe('pending')
      
      // Verify it's a fortnightly period
      const daysDiff = Math.ceil((payPeriod.endDate.getTime() - payPeriod.startDate.getTime()) / (1000 * 60 * 60 * 24))
      expect(daysDiff).toBe(14)
    })

    it('should create pay period with weekly type for user', async () => {
      await prisma.user.update({
        where: { id: user.id },
        data: { payPeriodType: 'WEEKLY' },
      })

      const shiftDate = new Date('2024-01-03T10:00:00Z')
      const payPeriod = await findOrCreatePayPeriod(user.id, shiftDate)

      expect(payPeriod.userId).toBe(user.id)
      
      // Verify it's a weekly period
      const daysDiff = Math.ceil((payPeriod.endDate.getTime() - payPeriod.startDate.getTime()) / (1000 * 60 * 60 * 24))
      expect(daysDiff).toBe(7)
    })

    it('should create pay period with monthly type for user', async () => {
      await prisma.user.update({
        where: { id: user.id },
        data: { payPeriodType: 'MONTHLY' },
      })

      const shiftDate = new Date('2024-01-15T10:00:00Z')
      const payPeriod = await findOrCreatePayPeriod(user.id, shiftDate)

      expect(payPeriod.userId).toBe(user.id)
      expect(payPeriod.startDate.toISOString()).toBe('2023-12-31T13:00:00.000Z')
      expect(payPeriod.endDate.toISOString()).toBe('2024-01-31T12:59:59.999Z')
    })

    it('should return existing pay period if already exists', async () => {
      const shiftDate = new Date('2024-01-03T10:00:00Z')
      
      const payPeriod1 = await findOrCreatePayPeriod(user.id, shiftDate)
      const payPeriod2 = await findOrCreatePayPeriod(user.id, shiftDate)

      expect(payPeriod1.id).toBe(payPeriod2.id)
    })

    it('should throw error for non-existent user', async () => {
      const shiftDate = new Date('2024-01-03T10:00:00Z')
      
      await expect(
        findOrCreatePayPeriod('non-existent-user', shiftDate)
      ).rejects.toThrow('User not found: non-existent-user')
    })
  })
})
