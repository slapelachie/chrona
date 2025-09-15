import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { GET, POST } from '../route'
import { NextRequest } from 'next/server'

// Test data setup
const mockUser = {
  id: 'test-user-id',
  name: 'Test User',
  email: 'payperiods-test@example.com',
  timezone: 'Australia/Sydney',
  payPeriodType: 'FORTNIGHTLY' as const,
}

const mockPayGuide = {
  id: 'test-pay-guide-id',
  name: `Test Award PPLIST`,
  baseRate: 25.0,
  effectiveFrom: new Date('2024-01-01'),
  isActive: true,
  timezone: 'Australia/Sydney',
}

const originalDbUrl = process.env.DATABASE_URL
const DB_URL = 'file:./pay-periods-route-test.db'

describe('Pay Periods API Routes', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = DB_URL
    const { execSync } = await import('child_process')
    execSync('npx prisma db push --skip-generate', { stdio: 'pipe' })
  })

  afterAll(async () => {
    process.env.DATABASE_URL = originalDbUrl
  })

  beforeEach(async () => {
    process.env.DATABASE_URL = DB_URL
    // Clean database (respect FK constraints)
    await prisma.breakPeriod.deleteMany()
    await prisma.shift.deleteMany()
    await prisma.penaltyTimeFrame.deleteMany()
    await prisma.overtimeTimeFrame.deleteMany()
    await prisma.publicHoliday.deleteMany()
    await prisma.payPeriod.deleteMany()
    await prisma.user.deleteMany()
    await prisma.payGuide.deleteMany()

    // Create test user and pay guide
    await prisma.user.create({ data: mockUser })
    await prisma.payGuide.create({ data: mockPayGuide })
  })

  afterEach(async () => {
    // Clean up (respect FK constraints)
    await prisma.breakPeriod.deleteMany()
    await prisma.shift.deleteMany()
    await prisma.penaltyTimeFrame.deleteMany()
    await prisma.overtimeTimeFrame.deleteMany()
    await prisma.publicHoliday.deleteMany()
    await prisma.payPeriod.deleteMany()
    await prisma.user.deleteMany()
    await prisma.payGuide.deleteMany()
  })

  describe('GET /api/pay-periods', () => {
    it('should return empty list when no pay periods exist', async () => {
      const request = new NextRequest('http://localhost:3000/api/pay-periods')
      
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.payPeriods).toEqual([])
      expect(data.data.pagination.total).toBe(0)
    })

    it('should return list of pay periods with default pagination', async () => {
      // Create test pay periods
      const payPeriod1 = await prisma.payPeriod.create({
        data: {
          userId: mockUser.id,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-14'),
          status: 'open',
          verified: false,
        }
      })

      const payPeriod2 = await prisma.payPeriod.create({
        data: {
          userId: mockUser.id,
          startDate: new Date('2024-01-15'),
          endDate: new Date('2024-01-28'),
          status: 'paid',
          verified: true,
        }
      })

      const request = new NextRequest('http://localhost:3000/api/pay-periods')
      
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.payPeriods).toHaveLength(2)
      expect(data.data.pagination.total).toBe(2)
      expect(data.data.pagination.page).toBe(1)
      expect(data.data.pagination.limit).toBe(10)
    })

    it('should filter pay periods by status', async () => {
      await prisma.payPeriod.create({
        data: {
          userId: mockUser.id,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-14'),
          status: 'open',
          verified: false,
        }
      })

      await prisma.payPeriod.create({
        data: {
          userId: mockUser.id,
          startDate: new Date('2024-01-15'),
          endDate: new Date('2024-01-28'),
          status: 'paid',
          verified: true,
        }
      })

      const request = new NextRequest('http://localhost:3000/api/pay-periods?status=open')
      
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.payPeriods).toHaveLength(1)
      expect(data.data.payPeriods[0].status).toBe('open')
    })

    it('should include shifts when requested', async () => {
      const payPeriod = await prisma.payPeriod.create({
        data: {
          userId: mockUser.id,
          startDate: new Date('2024-02-01'),
          endDate: new Date('2024-02-14'),
          status: 'open',
          verified: false,
        }
      })

      // Create a shift in the pay period
      await prisma.shift.create({
        data: {
          userId: mockUser.id,
          payGuideId: mockPayGuide.id,
          payPeriodId: payPeriod.id,
          startTime: new Date('2024-01-01T09:00:00Z'),
          endTime: new Date('2024-01-01T17:00:00Z'),
        }
      })

      const request = new NextRequest('http://localhost:3000/api/pay-periods?include=shifts')
      
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      // When include=shifts, the route returns an array of PayPeriodResponse
      expect(Array.isArray(data.data)).toBe(true)
      expect(data.data.length).toBe(1)
      expect(Array.isArray(data.data[0].shifts)).toBe(true)
      expect(data.data[0].shifts.length).toBeGreaterThan(0)
    })

    it('should handle pagination correctly', async () => {
      // Create 3 pay periods
      for (let i = 0; i < 3; i++) {
        await prisma.payPeriod.create({
          data: {
            userId: mockUser.id,
            startDate: new Date(2024, 0, (i * 14) + 1), // Use proper Date constructor
            endDate: new Date(2024, 0, (i * 14) + 14),
            status: 'open',
            verified: false,
          }
        })
      }

      const request = new NextRequest('http://localhost:3000/api/pay-periods?page=1&limit=2')
      
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.payPeriods).toHaveLength(2)
      expect(data.data.pagination.page).toBe(1)
      expect(data.data.pagination.limit).toBe(2)
      expect(data.data.pagination.total).toBe(3)
      expect(data.data.pagination.totalPages).toBe(2)
    })

    it('should validate query parameters', async () => {
      const request = new NextRequest('http://localhost:3000/api/pay-periods?page=0&limit=101')
      
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.errors).toContainEqual(
        expect.objectContaining({ field: 'page', message: 'Page must be at least 1' })
      )
      expect(data.errors).toContainEqual(
        expect.objectContaining({ field: 'limit', message: 'Limit must be between 1 and 100' })
      )
    })
  })

  describe('POST /api/pay-periods', () => {
    it('should create a new pay period', async () => {
      const requestBody = {
        startDate: '2024-01-01T00:00:00.000Z',
        endDate: '2024-01-14T23:59:59.999Z',
        status: 'open'
      }

      const request = new NextRequest('http://localhost:3000/api/pay-periods', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      })
      
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.data.startDate).toBe(requestBody.startDate)
      expect(data.data.endDate).toBe(requestBody.endDate)
      expect(data.data.status).toBe('open')
      expect(data.data.verified).toBe(false)
      expect(data.message).toBe('Pay period created successfully')
    })

    it('should default status to open when not provided', async () => {
      const requestBody = {
        startDate: '2024-01-01T00:00:00.000Z',
        endDate: '2024-01-14T23:59:59.999Z',
      }

      const request = new NextRequest('http://localhost:3000/api/pay-periods', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      })
      
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.data.status).toBe('open')
    })

    it('should validate required fields', async () => {
      const requestBody = {
        // Missing startDate and endDate
        status: 'open'
      }

      const request = new NextRequest('http://localhost:3000/api/pay-periods', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      })
      
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.errors).toContainEqual(
        expect.objectContaining({ field: 'startDate', message: 'startDate is required' })
      )
      expect(data.errors).toContainEqual(
        expect.objectContaining({ field: 'endDate', message: 'endDate is required' })
      )
    })

    it('should validate date range', async () => {
      const requestBody = {
        startDate: '2024-01-15T00:00:00.000Z',
        endDate: '2024-01-01T23:59:59.999Z', // End before start
      }

      const request = new NextRequest('http://localhost:3000/api/pay-periods', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      })
      
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.errors).toContainEqual(
        expect.objectContaining({ field: 'endTime', message: 'End time must be after start time' })
      )
    })

    it('should prevent overlapping pay periods', async () => {
      // Create existing pay period
      await prisma.payPeriod.create({
        data: {
          userId: mockUser.id,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-14'),
          status: 'open',
          verified: false,
        }
      })

      // Try to create overlapping period
      const requestBody = {
        startDate: '2024-01-10T00:00:00.000Z', // Overlaps with existing
        endDate: '2024-01-24T23:59:59.999Z',
      }

      const request = new NextRequest('http://localhost:3000/api/pay-periods', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      })
      
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.errors).toContainEqual(
        expect.objectContaining({ 
          field: 'dateRange', 
          message: 'Pay period overlaps with existing period' 
        })
      )
    })

    it('should validate status values', async () => {
      const requestBody = {
        startDate: '2024-01-01T00:00:00.000Z',
        endDate: '2024-01-14T23:59:59.999Z',
        status: 'invalid-status'
      }

      const request = new NextRequest('http://localhost:3000/api/pay-periods', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      })
      
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.errors).toContainEqual(
        expect.objectContaining({ field: 'status', message: 'Invalid status value' })
      )
    })
  })
})
