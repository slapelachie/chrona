/**
 * Break Periods Route Tests
 *
 * Tests for the /api/shifts/[id]/break-periods endpoint
 * covering GET and POST operations with validation and error handling.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'
import { Decimal } from 'decimal.js'
import { CreateBreakPeriodRequest } from '@/types'

// Mock Next.js request/response objects
class MockRequest {
  private _url: string
  private _method: string
  private _body: any
  private _headers: Record<string, string> = {}

  constructor(
    url: string,
    options: {
      method?: string
      body?: any
      headers?: Record<string, string>
    } = {}
  ) {
    this._url = url
    this._method = options.method || 'GET'
    this._body = options.body
    this._headers = options.headers || {}
  }

  get url() {
    return this._url
  }
  get method() {
    return this._method
  }

  async json() {
    return typeof this._body === 'string' ? JSON.parse(this._body) : this._body
  }
}

// Setup test database connection
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./break-periods-collection-test.db',
    },
  },
})

describe('Break Periods Collection Route API', () => {
  let testUserId: string
  let testPayGuideId: string
  let testShiftId: string

  beforeAll(async () => {
    // Set up test database
    process.env.DATABASE_URL = 'file:./break-periods-collection-test.db'
    execSync('npx prisma migrate dev --name init', { stdio: 'pipe' })

    // Clean any existing data first (order matters due to foreign keys)
    await prisma.breakPeriod.deleteMany()
    await prisma.shift.deleteMany()
    await prisma.penaltyTimeFrame.deleteMany()
    await prisma.overtimeTimeFrame.deleteMany()
    await prisma.publicHoliday.deleteMany()
    await prisma.payPeriod.deleteMany()
    await prisma.payGuide.deleteMany()
    await prisma.user.deleteMany()

    // Create test user
    const testUser = await prisma.user.create({
      data: {
        name: 'Test User',
        email: 'test@example.com',
        timezone: 'Australia/Sydney',
      },
    })
    testUserId = testUser.id

    // Create test pay guide
    const testPayGuide = await prisma.payGuide.create({
      data: {
        name: 'Test Retail Award',
        baseRate: new Decimal('25.00'),
        effectiveFrom: new Date('2024-01-01'),
        timezone: 'Australia/Sydney',
        isActive: true,
      },
    })
    testPayGuideId = testPayGuide.id

    // Create test shift
    const testShift = await prisma.shift.create({
      data: {
        userId: testUserId,
        payGuideId: testPayGuideId,
        startTime: new Date('2024-01-15T09:00:00Z'),
        endTime: new Date('2024-01-15T17:00:00Z'),
              },
    })
    testShiftId = testShift.id
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    // Clean up break periods before each test
    await prisma.breakPeriod.deleteMany()
  })

  describe('GET /api/shifts/[id]/break-periods', () => {
    describe('Successful Retrieval', () => {
      it('should retrieve empty list when no break periods exist', async () => {
        const { GET } = await import('@/app/api/shifts/[id]/break-periods/route')
        const request = new MockRequest(`http://localhost/api/shifts/${testShiftId}/break-periods`)
        const params = { id: testShiftId }

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data.breakPeriods).toEqual([])
        expect(result.data.shiftId).toBe(testShiftId)
        expect(result.data.pagination.total).toBe(0)
        expect(result.data.pagination.totalPages).toBe(0)
      })

      it('should retrieve existing break periods with default pagination', async () => {
        // Create test break periods
        await prisma.breakPeriod.create({
          data: {
            shiftId: testShiftId,
            startTime: new Date('2024-01-15T12:00:00Z'),
            endTime: new Date('2024-01-15T12:30:00Z'),
          },
        })

        await prisma.breakPeriod.create({
          data: {
            shiftId: testShiftId,
            startTime: new Date('2024-01-15T15:00:00Z'),
            endTime: new Date('2024-01-15T15:15:00Z'),
          },
        })

        const { GET } = await import('@/app/api/shifts/[id]/break-periods/route')
        const request = new MockRequest(`http://localhost/api/shifts/${testShiftId}/break-periods`)
        const params = { id: testShiftId }

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data.breakPeriods).toHaveLength(2)
        expect(result.data.shiftId).toBe(testShiftId)
        expect(result.data.pagination.total).toBe(2)
        expect(result.data.pagination.totalPages).toBe(1)
        expect(result.data.pagination.page).toBe(1)
        expect(result.data.pagination.limit).toBe(10)

        // Check break periods are sorted by startTime (default)
        const breakPeriods = result.data.breakPeriods
        expect(new Date(breakPeriods[0].startTime).getTime())
          .toBeLessThan(new Date(breakPeriods[1].startTime).getTime())
      })

      it('should handle pagination correctly', async () => {
        // Create 3 break periods
        for (let i = 0; i < 3; i++) {
          await prisma.breakPeriod.create({
            data: {
              shiftId: testShiftId,
              startTime: new Date(`2024-01-15T${10 + i}:00:00Z`),
              endTime: new Date(`2024-01-15T${10 + i}:15:00Z`),
            },
          })
        }

        const { GET } = await import('@/app/api/shifts/[id]/break-periods/route')
        const request = new MockRequest(`http://localhost/api/shifts/${testShiftId}/break-periods?page=2&limit=2`)
        const params = { id: testShiftId }

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data.breakPeriods).toHaveLength(1) // Only 1 item on page 2
        expect(result.data.pagination.page).toBe(2)
        expect(result.data.pagination.limit).toBe(2)
        expect(result.data.pagination.total).toBe(3)
        expect(result.data.pagination.totalPages).toBe(2)
      })

      it('should handle sorting correctly', async () => {
        // Create break periods with different times
        await prisma.breakPeriod.create({
          data: {
            shiftId: testShiftId,
            startTime: new Date('2024-01-15T15:00:00Z'),
            endTime: new Date('2024-01-15T15:15:00Z'),
          },
        })

        await prisma.breakPeriod.create({
          data: {
            shiftId: testShiftId,
            startTime: new Date('2024-01-15T12:00:00Z'),
            endTime: new Date('2024-01-15T12:15:00Z'),
          },
        })

        const { GET } = await import('@/app/api/shifts/[id]/break-periods/route')
        const request = new MockRequest(`http://localhost/api/shifts/${testShiftId}/break-periods?sortBy=startTime&sortOrder=desc`)
        const params = { id: testShiftId }

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(200)
        const breakPeriods = result.data.breakPeriods
        expect(new Date(breakPeriods[0].startTime).getTime())
          .toBeGreaterThan(new Date(breakPeriods[1].startTime).getTime())
      })
    })

    describe('Validation and Error Handling', () => {
      it('should reject invalid shift ID', async () => {
        const { GET } = await import('@/app/api/shifts/[id]/break-periods/route')
        const invalidId = 'invalid-id'
        const request = new MockRequest(`http://localhost/api/shifts/${invalidId}/break-periods`)
        const params = { id: invalidId }

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(result.message).toBe('Invalid query parameters')
      })

      it('should return 404 for non-existent shift', async () => {
        const { GET } = await import('@/app/api/shifts/[id]/break-periods/route')
        const nonExistentId = 'cltmv8r5v0000l508whbz1234'
        const request = new MockRequest(`http://localhost/api/shifts/${nonExistentId}/break-periods`)
        const params = { id: nonExistentId }

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Shift not found')
      })

      it('should validate pagination parameters', async () => {
        const { GET } = await import('@/app/api/shifts/[id]/break-periods/route')
        const request = new MockRequest(`http://localhost/api/shifts/${testShiftId}/break-periods?page=0&limit=101`)
        const params = { id: testShiftId }

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(result.message).toBe('Invalid query parameters')

        const errorFields = result.errors.map((err: any) => err.field)
        expect(errorFields).toContain('page')
        expect(errorFields).toContain('limit')
      })

      it('should validate sort parameters', async () => {
        const { GET } = await import('@/app/api/shifts/[id]/break-periods/route')
        const request = new MockRequest(`http://localhost/api/shifts/${testShiftId}/break-periods?sortBy=invalid&sortOrder=invalid`)
        const params = { id: testShiftId }

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(result.message).toBe('Invalid query parameters')

        const errorFields = result.errors.map((err: any) => err.field)
        expect(errorFields).toContain('sortBy')
        expect(errorFields).toContain('sortOrder')
      })
    })
  })

  describe('POST /api/shifts/[id]/break-periods', () => {
    describe('Successful Creation', () => {
      it('should create break period with valid data', async () => {
        const breakData: CreateBreakPeriodRequest = {
          startTime: '2024-01-15T12:00:00Z',
          endTime: '2024-01-15T12:30:00Z',
        }

        const { POST } = await import('@/app/api/shifts/[id]/break-periods/route')
        const request = new MockRequest(`http://localhost/api/shifts/${testShiftId}/break-periods`, {
          method: 'POST',
          body: breakData,
        })
        const params = { id: testShiftId }

        const response = await POST(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(201)
        expect(result.data).toBeTruthy()
        expect(result.data.shiftId).toBe(testShiftId)
        expect(result.data.startTime).toBe('2024-01-15T12:00:00.000Z')
        expect(result.data.endTime).toBe('2024-01-15T12:30:00.000Z')
        expect(result.message).toBe('Break period created successfully')

        // Verify it was saved to database
        const saved = await prisma.breakPeriod.findFirst({
          where: { shiftId: testShiftId }
        })
        expect(saved).toBeTruthy()
        expect(saved!.startTime.toISOString()).toBe('2024-01-15T12:00:00.000Z')
      })

      it('should create multiple non-overlapping break periods', async () => {
        // Create first break period
        await prisma.breakPeriod.create({
          data: {
            shiftId: testShiftId,
            startTime: new Date('2024-01-15T10:00:00Z'),
            endTime: new Date('2024-01-15T10:15:00Z'),
          },
        })

        // Create second break period that doesn't overlap
        const breakData: CreateBreakPeriodRequest = {
          startTime: '2024-01-15T14:00:00Z',
          endTime: '2024-01-15T14:15:00Z',
        }

        const { POST } = await import('@/app/api/shifts/[id]/break-periods/route')
        const request = new MockRequest(`http://localhost/api/shifts/${testShiftId}/break-periods`, {
          method: 'POST',
          body: breakData,
        })
        const params = { id: testShiftId }

        const response = await POST(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(201)
        expect(result.data.startTime).toBe('2024-01-15T14:00:00.000Z')

        // Verify both exist in database
        const count = await prisma.breakPeriod.count({
          where: { shiftId: testShiftId }
        })
        expect(count).toBe(2)
      })
    })

    describe('Validation and Error Handling', () => {
      it('should reject invalid shift ID', async () => {
        const breakData: CreateBreakPeriodRequest = {
          startTime: '2024-01-15T12:00:00Z',
          endTime: '2024-01-15T12:30:00Z',
        }

        const { POST } = await import('@/app/api/shifts/[id]/break-periods/route')
        const invalidId = 'invalid-id'
        const request = new MockRequest(`http://localhost/api/shifts/${invalidId}/break-periods`, {
          method: 'POST',
          body: breakData,
        })
        const params = { id: invalidId }

        const response = await POST(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.message).toBe('Invalid shift ID')
      })

      it('should return 404 for non-existent shift', async () => {
        const breakData: CreateBreakPeriodRequest = {
          startTime: '2024-01-15T12:00:00Z',
          endTime: '2024-01-15T12:30:00Z',
        }

        const { POST } = await import('@/app/api/shifts/[id]/break-periods/route')
        const nonExistentId = 'cltmv8r5v0000l508whbz1234'
        const request = new MockRequest(`http://localhost/api/shifts/${nonExistentId}/break-periods`, {
          method: 'POST',
          body: breakData,
        })
        const params = { id: nonExistentId }

        const response = await POST(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.message).toBe('Invalid shift')
      })

      it('should validate required fields', async () => {
        const invalidData = {
          // Missing startTime and endTime
          someField: 'value',
        }

        const { POST } = await import('@/app/api/shifts/[id]/break-periods/route')
        const request = new MockRequest(`http://localhost/api/shifts/${testShiftId}/break-periods`, {
          method: 'POST',
          body: invalidData,
        })
        const params = { id: testShiftId }

        const response = await POST(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(result.message).toBe('Invalid break period data')

        const errorFields = result.errors.map((err: any) => err.field)
        expect(errorFields).toContain('startTime')
        expect(errorFields).toContain('endTime')
      })

      it('should validate break period duration (max 4 hours)', async () => {
        const invalidData: CreateBreakPeriodRequest = {
          startTime: '2024-01-15T10:00:00Z',
          endTime: '2024-01-15T15:00:00Z', // 5 hours
        }

        const { POST } = await import('@/app/api/shifts/[id]/break-periods/route')
        const request = new MockRequest(`http://localhost/api/shifts/${testShiftId}/break-periods`, {
          method: 'POST',
          body: invalidData,
        })
        const params = { id: testShiftId }

        const response = await POST(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(result.message).toBe('Invalid break period data')
      })

      it('should reject break period outside shift bounds', async () => {
        const invalidData: CreateBreakPeriodRequest = {
          startTime: '2024-01-15T08:00:00Z', // Before shift start (09:00)
          endTime: '2024-01-15T08:30:00Z',
        }

        const { POST } = await import('@/app/api/shifts/[id]/break-periods/route')
        const request = new MockRequest(`http://localhost/api/shifts/${testShiftId}/break-periods`, {
          method: 'POST',
          body: invalidData,
        })
        const params = { id: testShiftId }

        const response = await POST(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.message).toBe('Invalid break timing')
        expect(result.errors[0].message).toBe('Break period must be within shift duration')
      })

      it('should reject overlapping break periods', async () => {
        // Create existing break period
        await prisma.breakPeriod.create({
          data: {
            shiftId: testShiftId,
            startTime: new Date('2024-01-15T12:00:00Z'),
            endTime: new Date('2024-01-15T12:30:00Z'),
          },
        })

        // Try to create overlapping break period
        const overlappingData: CreateBreakPeriodRequest = {
          startTime: '2024-01-15T12:15:00Z', // Overlaps with existing
          endTime: '2024-01-15T12:45:00Z',
        }

        const { POST } = await import('@/app/api/shifts/[id]/break-periods/route')
        const request = new MockRequest(`http://localhost/api/shifts/${testShiftId}/break-periods`, {
          method: 'POST',
          body: overlappingData,
        })
        const params = { id: testShiftId }

        const response = await POST(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(409)
        expect(result.message).toBe('Overlapping break periods not allowed')
        expect(result.errors[0].message).toBe('Break period overlaps with existing break')
      })

      it('should validate date format', async () => {
        const invalidData = {
          startTime: 'invalid-date',
          endTime: 'also-invalid',
        }

        const { POST } = await import('@/app/api/shifts/[id]/break-periods/route')
        const request = new MockRequest(`http://localhost/api/shifts/${testShiftId}/break-periods`, {
          method: 'POST',
          body: invalidData,
        })
        const params = { id: testShiftId }

        const response = await POST(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(result.message).toBe('Invalid break period data')
      })
    })

    describe('Pay Recalculation Integration', () => {
      it('should recalculate shift pay when break period is created', async () => {
        // First, get the shift's initial pay
        const initialShift = await prisma.shift.findUnique({
          where: { id: testShiftId }
        })
        const initialTotalPay = initialShift?.totalPay

        // Create a break period
        const breakData: CreateBreakPeriodRequest = {
          startTime: '2024-01-15T12:00:00Z',
          endTime: '2024-01-15T13:00:00Z', // 1 hour break
        }

        const { POST } = await import('@/app/api/shifts/[id]/break-periods/route')
        const request = new MockRequest(`http://localhost/api/shifts/${testShiftId}/break-periods`, {
          method: 'POST',
          body: breakData,
        })
        const params = { id: testShiftId }

        const response = await POST(request as any, { params })
        expect(response.status).toBe(201)

        // Verify that shift pay was recalculated
        const updatedShift = await prisma.shift.findUnique({
          where: { id: testShiftId }
        })
        
        expect(updatedShift?.totalPay).toBeTruthy()
        expect(updatedShift?.totalHours).toBeTruthy()
        
        // With a 1-hour break, total hours should be reduced, affecting pay
        if (initialTotalPay && updatedShift?.totalPay) {
          // The pay should be different due to reduced working hours
          expect(updatedShift.totalPay.equals(initialTotalPay)).toBe(false)
        }
      })
    })
  })
})
