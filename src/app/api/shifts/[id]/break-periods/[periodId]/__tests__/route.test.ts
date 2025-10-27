/**
 * Individual Break Period Route Tests
 *
 * Tests for the /api/shifts/[id]/break-periods/[periodId] endpoint
 * covering GET, PUT, and DELETE operations with validation and error handling.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'
import { Decimal } from 'decimal.js'
import {
  UpdateBreakPeriodRequest,
  BreakPeriodResponse,
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
      url: 'file:./break-period-individual-test.db',
    },
  },
})

describe('Individual Break Period Route API', () => {
  let testUserId: string
  let testPayGuideId: string
  let testShiftId: string
  let testBreakPeriodId: string

  beforeAll(async () => {
    // Set up test database
    process.env.DATABASE_URL = 'file:./break-period-individual-test.db'
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
    // Clean up break periods and create a fresh test break period
    await prisma.breakPeriod.deleteMany()
    
    const testBreakPeriod = await prisma.breakPeriod.create({
      data: {
        shiftId: testShiftId,
        startTime: new Date('2024-01-15T12:00:00Z'),
        endTime: new Date('2024-01-15T12:30:00Z'),
      },
    })
    testBreakPeriodId = testBreakPeriod.id
  })

  describe('GET /api/shifts/[id]/break-periods/[periodId]', () => {
    describe('Successful Retrieval', () => {
      it('should retrieve existing break period', async () => {
        const { GET } = await import('@/app/api/shifts/[id]/break-periods/[periodId]/route')
        const request = new MockRequest(
          `http://localhost/api/shifts/${testShiftId}/break-periods/${testBreakPeriodId}`
        )
        const params = { id: testShiftId, periodId: testBreakPeriodId }

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data).toBeTruthy()
        expect(result.data.id).toBe(testBreakPeriodId)
        expect(result.data.shiftId).toBe(testShiftId)
        expect(result.data.startTime).toBe('2024-01-15T12:00:00.000Z')
        expect(result.data.endTime).toBe('2024-01-15T12:30:00.000Z')
        expect(result.data.createdAt).toBeTruthy()
        expect(result.data.updatedAt).toBeTruthy()
      })
    })

    describe('Validation and Error Handling', () => {
      it('should reject invalid shift ID', async () => {
        const { GET } = await import('@/app/api/shifts/[id]/break-periods/[periodId]/route')
        const invalidShiftId = 'invalid-id'
        const request = new MockRequest(
          `http://localhost/api/shifts/${invalidShiftId}/break-periods/${testBreakPeriodId}`
        )
        const params = { id: invalidShiftId, periodId: testBreakPeriodId }

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(result.message).toBe('Invalid ID parameters')
      })

      it('should reject invalid period ID', async () => {
        const { GET } = await import('@/app/api/shifts/[id]/break-periods/[periodId]/route')
        const invalidPeriodId = 'invalid-id'
        const request = new MockRequest(
          `http://localhost/api/shifts/${testShiftId}/break-periods/${invalidPeriodId}`
        )
        const params = { id: testShiftId, periodId: invalidPeriodId }

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(result.message).toBe('Invalid ID parameters')
      })

      it('should return 404 for non-existent break period', async () => {
        const { GET } = await import('@/app/api/shifts/[id]/break-periods/[periodId]/route')
        const nonExistentId = 'cltmv8r5v0000l508whbz1234'
        const request = new MockRequest(
          `http://localhost/api/shifts/${testShiftId}/break-periods/${nonExistentId}`
        )
        const params = { id: testShiftId, periodId: nonExistentId }

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Break period not found')
      })

      it('should return 404 when break period belongs to different shift', async () => {
        // Create another shift
        const anotherShift = await prisma.shift.create({
          data: {
            userId: testUserId,
            payGuideId: testPayGuideId,
            startTime: new Date('2024-01-16T09:00:00Z'),
            endTime: new Date('2024-01-16T17:00:00Z'),
          },
        })

        const { GET } = await import('@/app/api/shifts/[id]/break-periods/[periodId]/route')
        const request = new MockRequest(
          `http://localhost/api/shifts/${anotherShift.id}/break-periods/${testBreakPeriodId}`
        )
        const params = { id: anotherShift.id, periodId: testBreakPeriodId }

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Break period not found')

        // Cleanup
        await prisma.shift.delete({ where: { id: anotherShift.id } })
      })
    })
  })

  describe('PUT /api/shifts/[id]/break-periods/[periodId]', () => {
    describe('Successful Updates', () => {
      it('should update break period start time only', async () => {
        const updateData: UpdateBreakPeriodRequest = {
          startTime: '2024-01-15T11:30:00Z', // Before existing end time (12:30)
        }

        const { PUT } = await import('@/app/api/shifts/[id]/break-periods/[periodId]/route')
        const request = new MockRequest(
          `http://localhost/api/shifts/${testShiftId}/break-periods/${testBreakPeriodId}`,
          {
            method: 'PUT',
            body: updateData,
          }
        )
        const params = { id: testShiftId, periodId: testBreakPeriodId }

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data.startTime).toBe('2024-01-15T11:30:00.000Z')
        expect(result.data.endTime).toBe('2024-01-15T12:30:00.000Z') // Unchanged
        expect(result.message).toBe('Break period updated successfully')

        // Verify in database
        const updated = await prisma.breakPeriod.findUnique({
          where: { id: testBreakPeriodId }
        })
        expect(updated!.startTime.toISOString()).toBe('2024-01-15T11:30:00.000Z')
      })

      it('should update break period end time only', async () => {
        const updateData: UpdateBreakPeriodRequest = {
          endTime: '2024-01-15T13:00:00Z',
        }

        const { PUT } = await import('@/app/api/shifts/[id]/break-periods/[periodId]/route')
        const request = new MockRequest(
          `http://localhost/api/shifts/${testShiftId}/break-periods/${testBreakPeriodId}`,
          {
            method: 'PUT',
            body: updateData,
          }
        )
        const params = { id: testShiftId, periodId: testBreakPeriodId }

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data.startTime).toBe('2024-01-15T12:00:00.000Z') // Unchanged
        expect(result.data.endTime).toBe('2024-01-15T13:00:00.000Z')
        expect(result.message).toBe('Break period updated successfully')
      })

      it('should update both start and end times', async () => {
        const updateData: UpdateBreakPeriodRequest = {
          startTime: '2024-01-15T14:00:00Z',
          endTime: '2024-01-15T14:30:00Z',
        }

        const { PUT } = await import('@/app/api/shifts/[id]/break-periods/[periodId]/route')
        const request = new MockRequest(
          `http://localhost/api/shifts/${testShiftId}/break-periods/${testBreakPeriodId}`,
          {
            method: 'PUT',
            body: updateData,
          }
        )
        const params = { id: testShiftId, periodId: testBreakPeriodId }

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data.startTime).toBe('2024-01-15T14:00:00.000Z')
        expect(result.data.endTime).toBe('2024-01-15T14:30:00.000Z')
        expect(result.message).toBe('Break period updated successfully')
      })

      it('should handle empty update (no changes)', async () => {
        const updateData: UpdateBreakPeriodRequest = {}

        const { PUT } = await import('@/app/api/shifts/[id]/break-periods/[periodId]/route')
        const request = new MockRequest(
          `http://localhost/api/shifts/${testShiftId}/break-periods/${testBreakPeriodId}`,
          {
            method: 'PUT',
            body: updateData,
          }
        )
        const params = { id: testShiftId, periodId: testBreakPeriodId }

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data.startTime).toBe('2024-01-15T12:00:00.000Z') // Unchanged
        expect(result.data.endTime).toBe('2024-01-15T12:30:00.000Z') // Unchanged
      })
    })

    describe('Validation and Error Handling', () => {
      it('should reject invalid IDs', async () => {
        const updateData: UpdateBreakPeriodRequest = {
          startTime: '2024-01-15T13:00:00Z',
        }

        const { PUT } = await import('@/app/api/shifts/[id]/break-periods/[periodId]/route')
        const request = new MockRequest(
          'http://localhost/api/shifts/invalid-id/break-periods/also-invalid',
          {
            method: 'PUT',
            body: updateData,
          }
        )
        const params = { id: 'invalid-id', periodId: 'also-invalid' }

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(result.message).toBe('Invalid ID parameters')
      })

      it('should return 404 for non-existent break period', async () => {
        const updateData: UpdateBreakPeriodRequest = {
          startTime: '2024-01-15T13:00:00Z',
        }

        const { PUT } = await import('@/app/api/shifts/[id]/break-periods/[periodId]/route')
        const nonExistentId = 'cltmv8r5v0000l508whbz1234'
        const request = new MockRequest(
          `http://localhost/api/shifts/${testShiftId}/break-periods/${nonExistentId}`,
          {
            method: 'PUT',
            body: updateData,
          }
        )
        const params = { id: testShiftId, periodId: nonExistentId }

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Break period not found')
      })

      it('should validate date format', async () => {
        const updateData = {
          startTime: 'invalid-date',
          endTime: 'also-invalid',
        }

        const { PUT } = await import('@/app/api/shifts/[id]/break-periods/[periodId]/route')
        const request = new MockRequest(
          `http://localhost/api/shifts/${testShiftId}/break-periods/${testBreakPeriodId}`,
          {
            method: 'PUT',
            body: updateData,
          }
        )
        const params = { id: testShiftId, periodId: testBreakPeriodId }

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(result.message).toBe('Invalid break period data')
      })

      it('should validate duration constraints (max 4 hours)', async () => {
        const updateData: UpdateBreakPeriodRequest = {
          startTime: '2024-01-15T10:00:00Z',
          endTime: '2024-01-15T15:00:00Z', // 5 hours
        }

        const { PUT } = await import('@/app/api/shifts/[id]/break-periods/[periodId]/route')
        const request = new MockRequest(
          `http://localhost/api/shifts/${testShiftId}/break-periods/${testBreakPeriodId}`,
          {
            method: 'PUT',
            body: updateData,
          }
        )
        const params = { id: testShiftId, periodId: testBreakPeriodId }

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(result.message).toBe('Invalid break period data')
      })

      it('should reject break period outside shift bounds', async () => {
        const updateData: UpdateBreakPeriodRequest = {
          startTime: '2024-01-15T08:00:00Z', // Before shift start (09:00)
          endTime: '2024-01-15T08:30:00Z',
        }

        const { PUT } = await import('@/app/api/shifts/[id]/break-periods/[periodId]/route')
        const request = new MockRequest(
          `http://localhost/api/shifts/${testShiftId}/break-periods/${testBreakPeriodId}`,
          {
            method: 'PUT',
            body: updateData,
          }
        )
        const params = { id: testShiftId, periodId: testBreakPeriodId }

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.message).toBe('Invalid break timing')
        expect(result.errors[0].message).toBe('Break period must be within shift duration')
      })

      it('should reject overlapping with other break periods', async () => {
        // Create another break period
        await prisma.breakPeriod.create({
          data: {
            shiftId: testShiftId,
            startTime: new Date('2024-01-15T14:00:00Z'),
            endTime: new Date('2024-01-15T14:30:00Z'),
          },
        })

        // Try to update current break to overlap
        const updateData: UpdateBreakPeriodRequest = {
          startTime: '2024-01-15T14:15:00Z', // Overlaps with existing
          endTime: '2024-01-15T14:45:00Z',
        }

        const { PUT } = await import('@/app/api/shifts/[id]/break-periods/[periodId]/route')
        const request = new MockRequest(
          `http://localhost/api/shifts/${testShiftId}/break-periods/${testBreakPeriodId}`,
          {
            method: 'PUT',
            body: updateData,
          }
        )
        const params = { id: testShiftId, periodId: testBreakPeriodId }

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(409)
        expect(result.message).toBe('Overlapping break periods not allowed')
        expect(result.errors[0].message).toBe('Break period overlaps with existing break')
      })
    })
  })

  describe('DELETE /api/shifts/[id]/break-periods/[periodId]', () => {
    describe('Successful Deletion', () => {
      it('should delete existing break period', async () => {
        const { DELETE } = await import('@/app/api/shifts/[id]/break-periods/[periodId]/route')
        const request = new MockRequest(
          `http://localhost/api/shifts/${testShiftId}/break-periods/${testBreakPeriodId}`,
          { method: 'DELETE' }
        )
        const params = { id: testShiftId, periodId: testBreakPeriodId }

        const response = await DELETE(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.message).toBe('Break period deleted successfully')

        // Verify it was deleted from database
        const deleted = await prisma.breakPeriod.findUnique({
          where: { id: testBreakPeriodId }
        })
        expect(deleted).toBeNull()
      })
    })

    describe('Validation and Error Handling', () => {
      it('should reject invalid IDs', async () => {
        const { DELETE } = await import('@/app/api/shifts/[id]/break-periods/[periodId]/route')
        const request = new MockRequest(
          'http://localhost/api/shifts/invalid-id/break-periods/also-invalid',
          { method: 'DELETE' }
        )
        const params = { id: 'invalid-id', periodId: 'also-invalid' }

        const response = await DELETE(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(result.message).toBe('Invalid ID parameters')
      })

      it('should return 404 for non-existent break period', async () => {
        const { DELETE } = await import('@/app/api/shifts/[id]/break-periods/[periodId]/route')
        const nonExistentId = 'cltmv8r5v0000l508whbz1234'
        const request = new MockRequest(
          `http://localhost/api/shifts/${testShiftId}/break-periods/${nonExistentId}`,
          { method: 'DELETE' }
        )
        const params = { id: testShiftId, periodId: nonExistentId }

        const response = await DELETE(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Break period not found')
      })

      it('should return 404 when break period belongs to different shift', async () => {
        // Create another shift
        const anotherShift = await prisma.shift.create({
          data: {
            userId: testUserId,
            payGuideId: testPayGuideId,
            startTime: new Date('2024-01-16T09:00:00Z'),
            endTime: new Date('2024-01-16T17:00:00Z'),
          },
        })

        const { DELETE } = await import('@/app/api/shifts/[id]/break-periods/[periodId]/route')
        const request = new MockRequest(
          `http://localhost/api/shifts/${anotherShift.id}/break-periods/${testBreakPeriodId}`,
          { method: 'DELETE' }
        )
        const params = { id: anotherShift.id, periodId: testBreakPeriodId }

        const response = await DELETE(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Break period not found')

        // Cleanup
        await prisma.shift.delete({ where: { id: anotherShift.id } })
      })

      it('should handle deletion of already deleted break period', async () => {
        // Delete the break period first
        await prisma.breakPeriod.delete({ where: { id: testBreakPeriodId } })

        const { DELETE } = await import('@/app/api/shifts/[id]/break-periods/[periodId]/route')
        const request = new MockRequest(
          `http://localhost/api/shifts/${testShiftId}/break-periods/${testBreakPeriodId}`,
          { method: 'DELETE' }
        )
        const params = { id: testShiftId, periodId: testBreakPeriodId }

        const response = await DELETE(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Break period not found')
      })
    })
  })
})