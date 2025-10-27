/**
 * Individual Shift Route Tests
 *
 * Tests for the /api/shifts/[id] endpoint covering GET, PUT, and DELETE operations
 * with pay calculation integration, validation, and error handling.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'
import { Decimal } from 'decimal.js'
import {
  UpdateShiftRequest,
  ShiftResponse,
  ApiValidationResponse,
} from '@/types'

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

class MockResponse {
  private _status: number = 200
  private _body: any
  private _headers: Record<string, string> = {}

  static json(data: any, options: { status?: number } = {}) {
    const response = new MockResponse()
    response._body = data
    response._status = options.status || 200
    return response
  }

  get status() {
    return this._status
  }
  get body() {
    return this._body
  }

  async json() {
    return this._body
  }
}

// Setup test database connection
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./shifts-id-route-test.db',
    },
  },
})

describe('Individual Shift Route API', () => {
  let testUserId: string
  let testPayGuideId: string
  let testShiftId: string

  beforeAll(async () => {
    // Set up test database
    process.env.DATABASE_URL = 'file:./shifts-id-route-test.db'
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

    // Create test pay guide with penalty time frames
    const testPayGuide = await prisma.payGuide.create({
      data: {
        name: 'Test Retail Award',
        baseRate: new Decimal('25.00'),
        minimumShiftHours: 3,
        maximumShiftHours: 11,
        effectiveFrom: new Date('2024-01-01'),
        timezone: 'Australia/Sydney',
        isActive: true,
      },
    })
    testPayGuideId = testPayGuide.id

    // Create a casual loading penalty time frame (25% extra)
    await prisma.penaltyTimeFrame.create({
      data: {
        payGuideId: testPayGuideId,
        name: 'Casual Loading',
        multiplier: new Decimal('1.25'), // 25% extra
        description: 'Standard casual loading',
        isActive: true,
      },
    })

    // Create an evening penalty time frame
    await prisma.penaltyTimeFrame.create({
      data: {
        payGuideId: testPayGuideId,
        name: 'Evening Penalty',
        multiplier: new Decimal('1.75'), // 75% extra
        startTime: '18:00',
        endTime: '22:00',
        description: 'Evening penalty 6pm-10pm',
        isActive: true,
      },
    })

    // Create an overtime time frame
    await prisma.overtimeTimeFrame.create({
      data: {
        payGuideId: testPayGuideId,
        name: 'Daily Overtime',
        firstThreeHoursMult: new Decimal('1.5'), // 50% extra for first 3 hours
        afterThreeHoursMult: new Decimal('2.0'), // 100% extra after 3 hours
        description: 'Daily overtime after 11 hours',
        isActive: true,
      },
    })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    // Clean up shifts and break periods before each test, then create a test shift
    await prisma.breakPeriod.deleteMany()
    await prisma.shift.deleteMany()

    // Create a test shift for each test
    const testShift = await prisma.shift.create({
      data: {
        userId: testUserId,
        payGuideId: testPayGuideId,
        startTime: new Date('2024-01-15T09:00:00Z'),
        endTime: new Date('2024-01-15T17:00:00Z'),
        notes: 'Test shift',
        totalHours: new Decimal('7.5'),
        basePay: new Decimal('187.50'),
        penaltyPay: new Decimal('46.88'),
        totalPay: new Decimal('234.38'),
      },
    })
    testShiftId = testShift.id

    // Create some break periods for the test shift
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
  })

  describe('GET /api/shifts/[id]', () => {
    describe('Successful Retrieval', () => {
      it('should retrieve shift with all details including break periods', async () => {
        const { GET } = await import('@/app/api/shifts/[id]/route')
        const request = new MockRequest(`http://localhost/api/shifts/${testShiftId}`)
        const params = Promise.resolve({ id: testShiftId })

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data).toBeTruthy()
        expect(result.data.id).toBe(testShiftId)
        expect(result.data.userId).toBe(testUserId)
        expect(result.data.payGuideId).toBe(testPayGuideId)
        expect(result.data.startTime).toBe('2024-01-15T09:00:00.000Z')
        expect(result.data.endTime).toBe('2024-01-15T17:00:00.000Z')
        expect(result.data.notes).toBe('Test shift')

        // Check calculated pay fields
        expect(result.data.totalHours).toBe('7.5')
        expect(result.data.basePay).toBe('187.5')
        expect(result.data.penaltyPay).toBe('46.88')
        expect(result.data.totalPay).toBe('234.38')

        // Check break periods are included
        expect(result.data.breakPeriods).toBeInstanceOf(Array)
        expect(result.data.breakPeriods).toHaveLength(2)
        expect(result.data.breakPeriods[0].shiftId).toBe(testShiftId)
        expect(result.data.breakPeriods[0].startTime).toBe('2024-01-15T12:00:00.000Z')
        expect(result.data.breakPeriods[0].endTime).toBe('2024-01-15T12:30:00.000Z')
        expect(result.data.breakPeriods[1].startTime).toBe('2024-01-15T15:00:00.000Z')

        // Check payGuide is included with new structure (no casualLoading/overtimeRules)
        expect(result.data.payGuide).toBeTruthy()
        expect(result.data.payGuide.baseRate).toBe('25')
        expect(result.data.payGuide.minimumShiftHours).toBe(3)
        expect(result.data.payGuide.maximumShiftHours).toBe(11)
        expect(result.data.payGuide.timezone).toBe('Australia/Sydney')
        expect(result.data.payGuide.casualLoading).toBeUndefined()
        expect(result.data.payGuide.overtimeRules).toBeUndefined()
      })
    })

    describe('Validation and Error Handling', () => {
      it('should reject invalid shift ID format', async () => {
        const { GET } = await import('@/app/api/shifts/[id]/route')
        const invalidId = 'invalid-id'
        const request = new MockRequest(`http://localhost/api/shifts/${invalidId}`)
        const params = Promise.resolve({ id: invalidId })

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(result.message).toBe('Invalid shift ID')
      })

      it('should return 404 for non-existent shift', async () => {
        const { GET } = await import('@/app/api/shifts/[id]/route')
        const nonExistentId = 'cltmv8r5v0000l508whbz1234'
        const request = new MockRequest(`http://localhost/api/shifts/${nonExistentId}`)
        const params = Promise.resolve({ id: nonExistentId })

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Shift not found')
      })
    })
  })

  describe('PUT /api/shifts/[id]', () => {
    describe('Successful Updates with Pay Recalculation', () => {
      it('should update shift details and recalculate pay', async () => {
        const updateData: UpdateShiftRequest = {
          startTime: '2024-01-15T08:00:00Z', // Earlier start
          endTime: '2024-01-15T18:00:00Z',   // Later end
          notes: 'Updated test shift',
        }

        const { PUT } = await import('@/app/api/shifts/[id]/route')
        const request = new MockRequest(`http://localhost/api/shifts/${testShiftId}`, {
          method: 'PUT',
          body: updateData,
        })
        const params = Promise.resolve({ id: testShiftId })

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data.id).toBe(testShiftId)
        expect(result.data.startTime).toBe('2024-01-15T08:00:00.000Z')
        expect(result.data.endTime).toBe('2024-01-15T18:00:00.000Z')
        expect(result.data.notes).toBe('Updated test shift')
        expect(result.message).toBe('Shift updated successfully')

        // Check that pay was recalculated
        expect(result.data.totalHours).toBeTruthy()
        expect(result.data.totalPay).toBeTruthy()
        
        // Hours should be different from original (9 hours instead of 7.5)
        const totalHours = parseFloat(result.data.totalHours)
        expect(totalHours).toBeGreaterThan(8) // 10 hours - 1 hour break = 9 hours

        // Break periods should still be included
        expect(result.data.breakPeriods).toBeInstanceOf(Array)
        expect(result.data.breakPeriods).toHaveLength(2)

        // Verify changes were persisted
        const updated = await prisma.shift.findUnique({
          where: { id: testShiftId }
        })
        expect(updated!.startTime.toISOString()).toBe('2024-01-15T08:00:00.000Z')
        expect(updated!.endTime.toISOString()).toBe('2024-01-15T18:00:00.000Z')
        expect(updated!.totalHours).toBeTruthy()
      })

      it('should not recalculate pay when only notes are updated', async () => {
        const originalTotalPay = '234.38'
        
        const updateData: UpdateShiftRequest = {
          notes: 'Only notes updated, no recalculation needed',
        }

        const { PUT } = await import('@/app/api/shifts/[id]/route')
        const request = new MockRequest(`http://localhost/api/shifts/${testShiftId}`, {
          method: 'PUT',
          body: updateData,
        })
        const params = Promise.resolve({ id: testShiftId })

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data.notes).toBe('Only notes updated, no recalculation needed')
        
        // Pay values should remain the same since only notes changed
        expect(result.data.totalPay).toBe(originalTotalPay)
      })
    })

    describe('Validation and Error Handling', () => {
      it('should reject invalid shift ID', async () => {
        const updateData: UpdateShiftRequest = {
          notes: 'Test update',
        }

        const { PUT } = await import('@/app/api/shifts/[id]/route')
        const invalidId = 'invalid-id'
        const request = new MockRequest(`http://localhost/api/shifts/${invalidId}`, {
          method: 'PUT',
          body: updateData,
        })
        const params = Promise.resolve({ id: invalidId })

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.message).toBe('Invalid shift ID')
      })

      it('should return 404 for non-existent shift', async () => {
        const updateData: UpdateShiftRequest = {
          notes: 'Test update',
        }

        const { PUT } = await import('@/app/api/shifts/[id]/route')
        const nonExistentId = 'cltmv8r5v0000l508whbz1234'
        const request = new MockRequest(`http://localhost/api/shifts/${nonExistentId}`, {
          method: 'PUT',
          body: updateData,
        })
        const params = Promise.resolve({ id: nonExistentId })

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Shift not found')
      })

      it('should validate date range when updating times', async () => {
        const updateData: UpdateShiftRequest = {
          startTime: '2024-01-15T18:00:00Z',
          endTime: '2024-01-15T09:00:00Z', // End before start
        }

        const { PUT } = await import('@/app/api/shifts/[id]/route')
        const request = new MockRequest(`http://localhost/api/shifts/${testShiftId}`, {
          method: 'PUT',
          body: updateData,
        })
        const params = Promise.resolve({ id: testShiftId })

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(result.message).toBe('Invalid shift data')
      })

      it('should return 400 for non-existent pay guide', async () => {
        const updateData: UpdateShiftRequest = {
          payGuideId: 'cltmv8r5v0000l508whbz1234', // Non-existent
        }

        const { PUT } = await import('@/app/api/shifts/[id]/route')
        const request = new MockRequest(`http://localhost/api/shifts/${testShiftId}`, {
          method: 'PUT',
          body: updateData,
        })
        const params = Promise.resolve({ id: testShiftId })

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.message).toBe('Invalid pay guide')
        expect(result.errors[0].field).toBe('payGuideId')
        expect(result.errors[0].message).toBe('Pay guide not found')
      })
    })
  })

  describe('DELETE /api/shifts/[id]', () => {
    describe('Successful Deletion', () => {
      it('should delete shift and all related break periods', async () => {
        // Verify shift and break periods exist before deletion
        const existingShift = await prisma.shift.findUnique({
          where: { id: testShiftId },
          include: { breakPeriods: true }
        })
        expect(existingShift).toBeTruthy()
        expect(existingShift!.breakPeriods).toHaveLength(2)

        const { DELETE } = await import('@/app/api/shifts/[id]/route')
        const request = new MockRequest(`http://localhost/api/shifts/${testShiftId}`, {
          method: 'DELETE',
        })
        const params = Promise.resolve({ id: testShiftId })

        const response = await DELETE(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.message).toBe('Shift deleted successfully')

        // Verify shift and break periods were deleted
        const deletedShift = await prisma.shift.findUnique({
          where: { id: testShiftId }
        })
        expect(deletedShift).toBeNull()

        const remainingBreakPeriods = await prisma.breakPeriod.findMany({
          where: { shiftId: testShiftId }
        })
        expect(remainingBreakPeriods).toHaveLength(0)
      })
    })

    describe('Validation and Error Handling', () => {
      it('should reject invalid shift ID', async () => {
        const { DELETE } = await import('@/app/api/shifts/[id]/route')
        const invalidId = 'invalid-id'
        const request = new MockRequest(`http://localhost/api/shifts/${invalidId}`, {
          method: 'DELETE',
        })
        const params = Promise.resolve({ id: invalidId })

        const response = await DELETE(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.message).toBe('Invalid shift ID')
      })

      it('should return 404 for non-existent shift', async () => {
        const { DELETE } = await import('@/app/api/shifts/[id]/route')
        const nonExistentId = 'cltmv8r5v0000l508whbz1234'
        const request = new MockRequest(`http://localhost/api/shifts/${nonExistentId}`, {
          method: 'DELETE',
        })
        const params = Promise.resolve({ id: nonExistentId })

        const response = await DELETE(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Shift not found')
      })
    })
  })
})