/**
 * Blackbox Database Seeding Tests
 * 
 * These tests verify that the database seeding process works correctly
 * from a user perspective, ensuring all required data is created properly.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'
import { Decimal } from 'decimal.js'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./seed-test.db'
    }
  }
})

describe('Database Seeding - Blackbox Tests', () => {
  beforeAll(async () => {
    // Set up test database
    process.env.DATABASE_URL = 'file:./seed-test.db'
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

  describe('Complete Seed Process', () => {
    it('should seed all required data successfully', async () => {
      // Run the seed script
      execSync('npx prisma db seed', { stdio: 'pipe' })

      // Verify all data was created
      const users = await prisma.user.findMany()
      const payGuides = await prisma.payGuide.findMany()
      const penaltyTimeFrames = await prisma.penaltyTimeFrame.findMany()
      const shifts = await prisma.shift.findMany()
      const payPeriods = await prisma.payPeriod.findMany()

      expect(users).toHaveLength(1)
      expect(payGuides).toHaveLength(2)
      expect(penaltyTimeFrames).toHaveLength(10)
      expect(shifts).toHaveLength(6)
      expect(payPeriods).toHaveLength(2)
    })

    it('should be idempotent - running seed multiple times should not create duplicates', async () => {
      // Run seed twice
      execSync('npx prisma db seed', { stdio: 'pipe' })
      execSync('npx prisma db seed', { stdio: 'pipe' })

      // Should still have the same number of records
      const users = await prisma.user.findMany()
      const payGuides = await prisma.payGuide.findMany()

      expect(users).toHaveLength(1)
      expect(payGuides).toHaveLength(2)
    })
  })

  describe('Seeded User Data', () => {
    beforeEach(async () => {
      execSync('npx prisma db seed', { stdio: 'pipe' })
    })

    it('should create default user with correct attributes', async () => {
      const user = await prisma.user.findUnique({
        where: { email: 'user@chrona.app' }
      })

      expect(user).toBeTruthy()
      expect(user?.name).toBe('Default User')
      expect(user?.timezone).toBe('Australia/Sydney')
      expect(user?.createdAt).toBeInstanceOf(Date)
    })

    it('should create user with relationships to other models', async () => {
      const user = await prisma.user.findUnique({
        where: { email: 'user@chrona.app' },
        include: {
          shifts: true,
          payPeriods: true
        }
      })

      expect(user?.shifts).toHaveLength(6)
      expect(user?.payPeriods).toHaveLength(2)
    })
  })

  describe('Seeded Pay Guide Data', () => {
    beforeEach(async () => {
      execSync('npx prisma db seed', { stdio: 'pipe' })
    })

    it('should create Australian Retail Award pay guide with correct rates', async () => {
      const retailAward = await prisma.payGuide.findUnique({
        where: { name: 'General Retail Industry Award 2020' }
      })

      expect(retailAward).toBeTruthy()
      expect(retailAward?.baseRate.toString()).toBe('25.41')
      expect(retailAward?.casualLoading.toString()).toBe('0.25')
      expect(retailAward?.description).toContain('Adult casual employee minimum rates')
      expect(retailAward?.isActive).toBe(true)
      expect(retailAward?.effectiveFrom).toEqual(new Date('2024-07-01'))
    })

    it('should create Hospitality Award pay guide with correct attributes', async () => {
      const hospitalityAward = await prisma.payGuide.findUnique({
        where: { name: 'Hospitality Industry (General) Award 2020' }
      })

      expect(hospitalityAward).toBeTruthy()
      expect(hospitalityAward?.baseRate.toString()).toBe('25.41')
      expect(hospitalityAward?.casualLoading.toString()).toBe('0.25')
      expect(hospitalityAward?.description).toContain('Hospitality')
      expect(hospitalityAward?.isActive).toBe(true)
    })

    it('should create pay guides with proper overtime rules structure', async () => {
      const retailAward = await prisma.payGuide.findUnique({
        where: { name: 'General Retail Industry Award 2020' }
      })

      expect(retailAward?.overtimeRules).toEqual({
        daily: {
          regularHours: 8,
          firstOvertimeRate: 1.5,
          firstOvertimeHours: 12,
          secondOvertimeRate: 2.0
        },
        weekly: {
          regularHours: 38,
          overtimeRate: 1.5
        }
      })
    })
  })

  describe('Seeded Penalty Time Frame Data', () => {
    beforeEach(async () => {
      execSync('npx prisma db seed', { stdio: 'pipe' })
    })

    it('should create weekend penalty time frames for retail award', async () => {
      const saturdayPenalty = await prisma.penaltyTimeFrame.findFirst({
        where: { 
          name: 'Saturday Penalty',
          payGuide: { name: 'General Retail Industry Award 2020' }
        },
        include: { payGuide: true }
      })

      const sundayPenalty = await prisma.penaltyTimeFrame.findFirst({
        where: { 
          name: 'Sunday Penalty',
          payGuide: { name: 'General Retail Industry Award 2020' }
        }
      })

      expect(saturdayPenalty).toBeTruthy()
      expect(saturdayPenalty?.multiplier.toString()).toBe('1.5')
      expect(saturdayPenalty?.dayOfWeek).toBe(6)

      expect(sundayPenalty).toBeTruthy()
      expect(sundayPenalty?.multiplier.toString()).toBe('2.0')
      expect(sundayPenalty?.dayOfWeek).toBe(0)
    })

    it('should create time-based penalty time frames', async () => {
      const eveningPenalty = await prisma.penaltyTimeFrame.findFirst({
        where: { 
          name: { contains: 'Evening' },
          payGuide: { name: 'General Retail Industry Award 2020' }
        }
      })

      const nightPenalty = await prisma.penaltyTimeFrame.findFirst({
        where: { 
          name: 'Night Penalty',
          payGuide: { name: 'General Retail Industry Award 2020' }
        }
      })

      expect(eveningPenalty).toBeTruthy()
      expect(eveningPenalty?.startTime).toBe('18:00')
      expect(eveningPenalty?.endTime).toBe('23:59')
      expect(eveningPenalty?.multiplier.toString()).toBe('1.25')

      expect(nightPenalty).toBeTruthy()
      expect(nightPenalty?.startTime).toBe('00:00')
      expect(nightPenalty?.endTime).toBe('06:00')
      expect(nightPenalty?.multiplier.toString()).toBe('1.3')
    })

    it('should create public holiday penalty time frames', async () => {
      const publicHolidayPenalties = await prisma.penaltyTimeFrame.findMany({
        where: { isPublicHoliday: true }
      })

      expect(publicHolidayPenalties).toHaveLength(2) // One for each pay guide

      publicHolidayPenalties.forEach(penalty => {
        expect(penalty.name).toBe('Public Holiday Penalty')
        expect(penalty.multiplier.toString()).toBe('2.5')
        expect(penalty.isPublicHoliday).toBe(true)
      })
    })

    it('should create different penalty structures for different awards', async () => {
      const retailPenalties = await prisma.penaltyTimeFrame.findMany({
        where: {
          payGuide: { name: 'General Retail Industry Award 2020' }
        }
      })

      const hospitalityPenalties = await prisma.penaltyTimeFrame.findMany({
        where: {
          payGuide: { name: 'Hospitality Industry (General) Award 2020' }
        }
      })

      expect(retailPenalties).toHaveLength(5)
      expect(hospitalityPenalties).toHaveLength(5)

      // Verify different rates for Sunday between awards
      const retailSunday = retailPenalties.find(p => p.dayOfWeek === 0)
      const hospitalitySunday = hospitalityPenalties.find(p => p.dayOfWeek === 0)

      expect(retailSunday?.multiplier.toString()).toBe('2.0')
      expect(hospitalitySunday?.multiplier.toString()).toBe('1.75')
    })
  })

  describe('Seeded Pay Period Data', () => {
    beforeEach(async () => {
      execSync('npx prisma db seed', { stdio: 'pipe' })
    })

    it('should create current and previous pay periods', async () => {
      const payPeriods = await prisma.payPeriod.findMany({
        orderBy: { startDate: 'asc' }
      })

      expect(payPeriods).toHaveLength(2)

      const [previousPeriod, currentPeriod] = payPeriods

      // Previous period should be completed
      expect(previousPeriod.status).toBe('paid')
      expect(previousPeriod.verified).toBe(true)
      expect(previousPeriod.totalHours?.toString()).toBe('76.50')
      expect(previousPeriod.totalPay?.toString()).toBe('2145.75')
      expect(previousPeriod.actualPay?.toString()).toBe('2145.75')

      // Current period should be open
      expect(currentPeriod.status).toBe('open')
      expect(currentPeriod.verified).toBe(false)
      expect(currentPeriod.totalHours).toBeNull()
      expect(currentPeriod.totalPay).toBeNull()
    })

    it('should create fortnightly pay periods (14 day duration)', async () => {
      const payPeriods = await prisma.payPeriod.findMany()

      payPeriods.forEach(period => {
        const durationMs = period.endDate.getTime() - period.startDate.getTime()
        const durationDays = Math.floor(durationMs / (1000 * 60 * 60 * 24))
        
        expect(durationDays).toBe(13) // 14 days - 1 (inclusive dates)
      })
    })

    it('should enforce unique pay periods per user', async () => {
      const user = await prisma.user.findFirst()
      const payPeriods = await prisma.payPeriod.findMany({
        where: { userId: user?.id }
      })

      // Should have exactly 2 pay periods for the single user
      expect(payPeriods).toHaveLength(2)

      // Check that start dates are different
      const startDates = payPeriods.map(p => p.startDate.getTime())
      expect(new Set(startDates)).toHaveLength(2)
    })
  })

  describe('Seeded Shift Data', () => {
    beforeEach(async () => {
      execSync('npx prisma db seed', { stdio: 'pipe' })
    })

    it('should create diverse shift scenarios', async () => {
      const shifts = await prisma.shift.findMany({
        include: {
          payGuide: true,
          payPeriod: true
        },
        orderBy: { startTime: 'asc' }
      })

      expect(shifts).toHaveLength(6)

      // Verify shift variety
      const shiftTypes = {
        weekday: shifts.filter(s => {
          const day = s.startTime.getUTCDay()
          return day >= 1 && day <= 5 // Monday to Friday
        }),
        weekend: shifts.filter(s => {
          const day = s.startTime.getUTCDay()
          return day === 0 || day === 6 // Sunday or Saturday
        }),
        evening: shifts.filter(s => {
          const hour = s.startTime.getUTCHours()
          return hour >= 16 // Starts at or after 4pm
        }),
        night: shifts.filter(s => {
          const hour = s.endTime.getUTCHours()
          return hour <= 6 // Ends at or before 6am
        }),
        long: shifts.filter(s => {
          const durationMs = s.endTime.getTime() - s.startTime.getTime()
          const durationHours = durationMs / (1000 * 60 * 60)
          return durationHours > 10 // More than 10 hours
        })
      }

      expect(shiftTypes.weekday.length).toBeGreaterThan(0)
      expect(shiftTypes.weekend.length).toBeGreaterThan(0)
      expect(shiftTypes.evening.length).toBeGreaterThan(0)
      expect(shiftTypes.night.length).toBeGreaterThan(0)
      expect(shiftTypes.long.length).toBeGreaterThan(0)
    })

    it('should create shifts with different pay guides', async () => {
      const shifts = await prisma.shift.findMany({
        include: { payGuide: true }
      })

      const payGuideNames = [...new Set(shifts.map(s => s.payGuide.name))]
      
      expect(payGuideNames).toContain('General Retail Industry Award 2020')
      expect(payGuideNames).toContain('Hospitality Industry (General) Award 2020')
      expect(payGuideNames.length).toBe(2)
    })

    it('should create shifts with realistic break times', async () => {
      const shifts = await prisma.shift.findMany()

      shifts.forEach(shift => {
        expect(shift.breakMinutes).toBeGreaterThanOrEqual(0)
        expect(shift.breakMinutes).toBeLessThanOrEqual(60)
        
        // Most shifts should have 30 minute breaks
        const thirtyMinuteBreaks = shifts.filter(s => s.breakMinutes === 30)
        expect(thirtyMinuteBreaks.length).toBeGreaterThan(shifts.length / 2)
      })
    })

    it('should associate shifts with current pay period', async () => {
      const currentPayPeriod = await prisma.payPeriod.findFirst({
        where: { status: 'open' }
      })

      const shiftsInCurrentPeriod = await prisma.shift.findMany({
        where: { payPeriodId: currentPayPeriod?.id }
      })

      expect(shiftsInCurrentPeriod).toHaveLength(6)

      // Verify all shifts fall within the pay period dates
      shiftsInCurrentPeriod.forEach(shift => {
        expect(shift.startTime.getTime()).toBeGreaterThanOrEqual(currentPayPeriod!.startDate.getTime())
        expect(shift.endTime.getTime()).toBeLessThanOrEqual(currentPayPeriod!.endDate.getTime())
      })
    })

    it('should create shifts with descriptive notes', async () => {
      const shifts = await prisma.shift.findMany()
      
      shifts.forEach(shift => {
        expect(shift.notes).toBeTruthy()
        expect(shift.notes!.length).toBeGreaterThan(5)
      })

      // Check for variety in shift descriptions
      const notes = shifts.map(s => s.notes!)
      expect(notes).toContain('Regular weekday shift')
      expect(notes.some(note => note.includes('penalty'))).toBe(true)
      expect(notes.some(note => note.includes('overtime'))).toBe(true)
    })
  })

  describe('Seeded Data Relationships', () => {
    beforeEach(async () => {
      execSync('npx prisma db seed', { stdio: 'pipe' })
    })

    it('should maintain proper relationships between all models', async () => {
      const user = await prisma.user.findFirst({
        include: {
          shifts: {
            include: {
              payGuide: {
                include: {
                  penaltyTimeFrames: true
                }
              },
              payPeriod: true
            }
          },
          payPeriods: {
            include: {
              shifts: true
            }
          }
        }
      })

      expect(user).toBeTruthy()
      expect(user?.shifts).toHaveLength(6)
      expect(user?.payPeriods).toHaveLength(2)

      // Verify each shift has proper relationships
      user?.shifts.forEach(shift => {
        expect(shift.payGuide).toBeTruthy()
        expect(shift.payGuide.penaltyTimeFrames.length).toBeGreaterThan(0)
        expect(shift.payPeriod).toBeTruthy()
        expect(shift.userId).toBe(user.id)
      })

      // Verify pay periods contain shifts
      user?.payPeriods.forEach(period => {
        if (period.status === 'open') {
          expect(period.shifts).toHaveLength(6)
        } else {
          expect(period.shifts).toHaveLength(0) // Previous period has no shifts
        }
      })
    })

    it('should create penalty time frames for each pay guide', async () => {
      const payGuidesWithPenalties = await prisma.payGuide.findMany({
        include: {
          penaltyTimeFrames: true
        }
      })

      expect(payGuidesWithPenalties).toHaveLength(2)

      payGuidesWithPenalties.forEach(payGuide => {
        expect(payGuide.penaltyTimeFrames).toHaveLength(5)
        
        // Each should have weekend, evening, night, and public holiday penalties
        const penaltyTypes = payGuide.penaltyTimeFrames.map(p => p.name)
        expect(penaltyTypes).toContain('Saturday Penalty')
        expect(penaltyTypes).toContain('Sunday Penalty')
        expect(penaltyTypes.some(name => name.includes('Evening'))).toBe(true)
        expect(penaltyTypes).toContain('Night Penalty')
        expect(penaltyTypes).toContain('Public Holiday Penalty')
      })
    })
  })
})