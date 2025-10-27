/**
 * Penalty Time Frame [frameId] Route Tests
 *
 * Tests for the individual /api/pay-rates/[id]/penalty-time-frames/[frameId] endpoint
 * covering GET, PUT, and DELETE operations with validation and error handling.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'
import { Decimal } from 'decimal.js'
import {
  UpdatePenaltyTimeFrameRequest,
  PenaltyTimeFrameResponse,
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
      url: 'file:./penalty-time-frame-id-route-test.db',
    },
  },
})

describe('Penalty Time Frame [frameId] Route API', () => {
  let testPayGuideId: string
  let testPenaltyTimeFrameId: string
  let secondTestPenaltyTimeFrameId: string
  let otherPayGuideId: string
  let otherPayGuidePenaltyFrameId: string

  beforeAll(async () => {
    // Set up test database
    process.env.DATABASE_URL = 'file:./penalty-time-frame-id-route-test.db'
    execSync('npx prisma migrate dev --name init', { stdio: 'pipe' })

    // Clean any existing data first
    await prisma.shift.deleteMany()
    await prisma.penaltyTimeFrame.deleteMany()
    await prisma.overtimeTimeFrame.deleteMany()
    await prisma.publicHoliday.deleteMany()
    await prisma.payPeriod.deleteMany()
    await prisma.payGuide.deleteMany()
    await prisma.user.deleteMany()

    // Create test user
    await prisma.user.create({
      data: {
        name: 'Test User',
        email: 'test@example.com',
        timezone: 'Australia/Sydney',
      },
    })

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

    // Create second pay guide to test cross-guide validation
    const otherPayGuide = await prisma.payGuide.create({
      data: {
        name: 'Test Hospitality Award',
        baseRate: new Decimal('28.50'),
        effectiveFrom: new Date('2024-02-01'),
        timezone: 'Australia/Melbourne',
        isActive: true,
      },
    })
    otherPayGuideId = otherPayGuide.id
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    // Clean up penalty time frames before each test
    await prisma.penaltyTimeFrame.deleteMany()

    // Create test penalty time frames
    const testFrame = await prisma.penaltyTimeFrame.create({
      data: {
        payGuideId: testPayGuideId,
        name: 'Evening Penalty',
        multiplier: new Decimal('1.25'),
        startTime: '18:00',
        endTime: '22:00',
        description: 'Evening penalty rate',
        isActive: true,
      },
    })
    testPenaltyTimeFrameId = testFrame.id

    const secondFrame = await prisma.penaltyTimeFrame.create({
      data: {
        payGuideId: testPayGuideId,
        name: 'Weekend Penalty',
        multiplier: new Decimal('1.5'),
        dayOfWeek: 0, // Sunday
        isActive: true,
      },
    })
    secondTestPenaltyTimeFrameId = secondFrame.id

    // Create penalty frame for other pay guide
    const otherFrame = await prisma.penaltyTimeFrame.create({
      data: {
        payGuideId: otherPayGuideId,
        name: 'Other Guide Penalty',
        multiplier: new Decimal('1.75'),
        isActive: true,
      },
    })
    otherPayGuidePenaltyFrameId = otherFrame.id
  })

  describe('GET /api/pay-rates/[id]/penalty-time-frames/[frameId]', () => {
    describe('Successful Retrieval', () => {
      it('should retrieve existing penalty time frame with all fields', async () => {
        const { GET } = await import('@/app/api/pay-rates/[id]/penalty-time-frames/[frameId]/route')
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${testPayGuideId}/penalty-time-frames/${testPenaltyTimeFrameId}`
        )
        const params = Promise.resolve({ id: testPayGuideId, frameId: testPenaltyTimeFrameId })

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data).toBeTruthy()
        expect(result.data.id).toBe(testPenaltyTimeFrameId)
        expect(result.data.name).toBe('Evening Penalty')
        expect(result.data.multiplier).toBe('1.25')
        expect(result.data.startTime).toBe('18:00')
        expect(result.data.endTime).toBe('22:00')
        expect(result.data.description).toBe('Evening penalty rate')
        expect(result.data.isActive).toBe(true)
        expect(result.data.payGuideId).toBe(testPayGuideId)
        expect(result.data.createdAt).toBeTruthy()
        expect(result.data.updatedAt).toBeTruthy()

        // Verify data types
        expect(typeof result.data.id).toBe('string')
        expect(typeof result.data.multiplier).toBe('string')
        expect(typeof result.data.isActive).toBe('boolean')
      })

      it('should retrieve penalty time frame with null optional fields', async () => {
        const { GET } = await import('@/app/api/pay-rates/[id]/penalty-time-frames/[frameId]/route')
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${testPayGuideId}/penalty-time-frames/${secondTestPenaltyTimeFrameId}`
        )
        const params = Promise.resolve({ id: testPayGuideId, frameId: secondTestPenaltyTimeFrameId })

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data.id).toBe(secondTestPenaltyTimeFrameId)
        expect(result.data.name).toBe('Weekend Penalty')
        expect(result.data.dayOfWeek).toBe(0)
        expect(result.data.startTime).toBeNull()
        expect(result.data.endTime).toBeNull()
        expect(result.data.description).toBeNull()
      })
    })

    describe('Validation and Error Handling', () => {
      it('should reject invalid pay guide ID', async () => {
        const { GET } = await import('@/app/api/pay-rates/[id]/penalty-time-frames/[frameId]/route')
        const invalidId = 'invalid-id'
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${invalidId}/penalty-time-frames/${testPenaltyTimeFrameId}`
        )
        const params = Promise.resolve({ id: invalidId, frameId: testPenaltyTimeFrameId })

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(result.message).toBe('Invalid ID format')
      })

      it('should reject invalid penalty time frame ID', async () => {
        const { GET } = await import('@/app/api/pay-rates/[id]/penalty-time-frames/[frameId]/route')
        const invalidFrameId = 'invalid-frame-id'
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${testPayGuideId}/penalty-time-frames/${invalidFrameId}`
        )
        const params = Promise.resolve({ id: testPayGuideId, frameId: invalidFrameId })

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(result.message).toBe('Invalid ID format')
      })

      it('should return 404 for non-existent pay guide', async () => {
        const { GET } = await import('@/app/api/pay-rates/[id]/penalty-time-frames/[frameId]/route')
        const nonExistentId = 'cl9ebqhxk00000drx6dj2fwmz'
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${nonExistentId}/penalty-time-frames/${testPenaltyTimeFrameId}`
        )
        const params = Promise.resolve({ id: nonExistentId, frameId: testPenaltyTimeFrameId })

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Pay guide not found')
      })

      it('should return 404 for non-existent penalty time frame', async () => {
        const { GET } = await import('@/app/api/pay-rates/[id]/penalty-time-frames/[frameId]/route')
        const nonExistentFrameId = 'cl9ebqhxk00000drx6dj2fwmz'
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${testPayGuideId}/penalty-time-frames/${nonExistentFrameId}`
        )
        const params = Promise.resolve({ id: testPayGuideId, frameId: nonExistentFrameId })

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Penalty time frame not found')
      })

      it('should return 404 when penalty time frame belongs to different pay guide', async () => {
        const { GET } = await import('@/app/api/pay-rates/[id]/penalty-time-frames/[frameId]/route')
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${testPayGuideId}/penalty-time-frames/${otherPayGuidePenaltyFrameId}`
        )
        const params = Promise.resolve({ id: testPayGuideId, frameId: otherPayGuidePenaltyFrameId })

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Penalty time frame does not belong to the specified pay guide')
      })
    })
  })

  describe('PUT /api/pay-rates/[id]/penalty-time-frames/[frameId]', () => {
    describe('Successful Updates', () => {
      it('should update all fields successfully', async () => {
        const updateData: UpdatePenaltyTimeFrameRequest = {
          name: 'Updated Evening Penalty',
          multiplier: '1.35',
          dayOfWeek: 5, // Friday
          startTime: '17:00',
          endTime: '23:00',
          description: 'Updated evening penalty rate',
          isActive: false,
        }

        const { PUT } = await import('@/app/api/pay-rates/[id]/penalty-time-frames/[frameId]/route')
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${testPayGuideId}/penalty-time-frames/${testPenaltyTimeFrameId}`,
          { method: 'PUT', body: updateData }
        )
        const params = Promise.resolve({ id: testPayGuideId, frameId: testPenaltyTimeFrameId })

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data).toBeTruthy()
        expect(result.data.name).toBe('Updated Evening Penalty')
        expect(result.data.multiplier).toBe('1.35')
        expect(result.data.dayOfWeek).toBe(5)
        expect(result.data.startTime).toBe('17:00')
        expect(result.data.endTime).toBe('23:00')
        expect(result.data.description).toBe('Updated evening penalty rate')
        expect(result.data.isActive).toBe(false)
        expect(result.message).toBe('Penalty time frame updated successfully')

        // Verify it was actually saved in database
        const saved = await prisma.penaltyTimeFrame.findUnique({
          where: { id: testPenaltyTimeFrameId },
        })
        expect(saved!.name).toBe('Updated Evening Penalty')
        expect(saved!.multiplier.toString()).toBe('1.35')
      })

      it('should update partial fields only', async () => {
        const updateData: UpdatePenaltyTimeFrameRequest = {
          name: 'Partially Updated Penalty',
          multiplier: '1.3',
        }

        const { PUT } = await import('@/app/api/pay-rates/[id]/penalty-time-frames/[frameId]/route')
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${testPayGuideId}/penalty-time-frames/${testPenaltyTimeFrameId}`,
          { method: 'PUT', body: updateData }
        )
        const params = Promise.resolve({ id: testPayGuideId, frameId: testPenaltyTimeFrameId })

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data.name).toBe('Partially Updated Penalty')
        expect(result.data.multiplier).toBe('1.3')
        // These should remain unchanged
        expect(result.data.startTime).toBe('18:00')
        expect(result.data.endTime).toBe('22:00')
        expect(result.data.isActive).toBe(true)
      })
    })

    describe('Validation and Error Handling', () => {
      it('should reject invalid pay guide ID', async () => {
        const updateData: UpdatePenaltyTimeFrameRequest = {
          name: 'Test Update',
        }

        const { PUT } = await import('@/app/api/pay-rates/[id]/penalty-time-frames/[frameId]/route')
        const invalidId = 'invalid-id'
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${invalidId}/penalty-time-frames/${testPenaltyTimeFrameId}`,
          { method: 'PUT', body: updateData }
        )
        const params = Promise.resolve({ id: invalidId, frameId: testPenaltyTimeFrameId })

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(result.message).toBe('Invalid ID format')
      })

      it('should return 404 for non-existent pay guide', async () => {
        const updateData: UpdatePenaltyTimeFrameRequest = {
          name: 'Test Update',
        }

        const { PUT } = await import('@/app/api/pay-rates/[id]/penalty-time-frames/[frameId]/route')
        const nonExistentId = 'cl9ebqhxk00000drx6dj2fwmz'
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${nonExistentId}/penalty-time-frames/${testPenaltyTimeFrameId}`,
          { method: 'PUT', body: updateData }
        )
        const params = Promise.resolve({ id: nonExistentId, frameId: testPenaltyTimeFrameId })

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Pay guide not found')
      })

      it('should return 404 for non-existent penalty time frame', async () => {
        const updateData: UpdatePenaltyTimeFrameRequest = {
          name: 'Test Update',
        }

        const { PUT } = await import('@/app/api/pay-rates/[id]/penalty-time-frames/[frameId]/route')
        const nonExistentFrameId = 'cl9ebqhxk00000drx6dj2fwmz'
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${testPayGuideId}/penalty-time-frames/${nonExistentFrameId}`,
          { method: 'PUT', body: updateData }
        )
        const params = Promise.resolve({ id: testPayGuideId, frameId: nonExistentFrameId })

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Penalty time frame not found')
      })

      it('should validate field constraints', async () => {
        const invalidData = {
          name: 'A', // Too short
          multiplier: '0.5', // Too low
          dayOfWeek: 7, // Invalid (should be 0-6)
          startTime: '25:00', // Invalid time
          endTime: 'invalid-time', // Invalid format
          description: 'A'.repeat(501), // Too long
        }

        const { PUT } = await import('@/app/api/pay-rates/[id]/penalty-time-frames/[frameId]/route')
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${testPayGuideId}/penalty-time-frames/${testPenaltyTimeFrameId}`,
          { method: 'PUT', body: invalidData }
        )
        const params = Promise.resolve({ id: testPayGuideId, frameId: testPenaltyTimeFrameId })

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(result.errors.length).toBeGreaterThan(1)

        const errorFields = result.errors.map((err: any) => err.field)
        expect(errorFields).toContain('name')
        expect(errorFields).toContain('multiplier')
        expect(errorFields).toContain('dayOfWeek')
        expect(errorFields).toContain('startTime')
        expect(errorFields).toContain('endTime')
        expect(errorFields).toContain('description')
      })

      it('should return 404 when penalty time frame belongs to different pay guide', async () => {
        const updateData: UpdatePenaltyTimeFrameRequest = {
          name: 'Test Update',
        }

        const { PUT } = await import('@/app/api/pay-rates/[id]/penalty-time-frames/[frameId]/route')
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${testPayGuideId}/penalty-time-frames/${otherPayGuidePenaltyFrameId}`,
          { method: 'PUT', body: updateData }
        )
        const params = Promise.resolve({ id: testPayGuideId, frameId: otherPayGuidePenaltyFrameId })

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Penalty time frame does not belong to the specified pay guide')
      })
    })
  })

  describe('DELETE /api/pay-rates/[id]/penalty-time-frames/[frameId]', () => {
    describe('Successful Deletion', () => {
      it('should delete penalty time frame successfully', async () => {
        const { DELETE } = await import('@/app/api/pay-rates/[id]/penalty-time-frames/[frameId]/route')
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${testPayGuideId}/penalty-time-frames/${testPenaltyTimeFrameId}`
        )
        const params = Promise.resolve({ id: testPayGuideId, frameId: testPenaltyTimeFrameId })

        const response = await DELETE(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.message).toBe('Penalty time frame deleted successfully')

        // Verify it was actually deleted
        const deleted = await prisma.penaltyTimeFrame.findUnique({
          where: { id: testPenaltyTimeFrameId },
        })
        expect(deleted).toBeNull()
      })
    })

    describe('Validation and Error Handling', () => {
      it('should reject invalid pay guide ID', async () => {
        const { DELETE } = await import('@/app/api/pay-rates/[id]/penalty-time-frames/[frameId]/route')
        const invalidId = 'invalid-id'
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${invalidId}/penalty-time-frames/${testPenaltyTimeFrameId}`
        )
        const params = Promise.resolve({ id: invalidId, frameId: testPenaltyTimeFrameId })

        const response = await DELETE(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(result.message).toBe('Invalid ID format')
      })

      it('should return 404 for non-existent pay guide', async () => {
        const { DELETE } = await import('@/app/api/pay-rates/[id]/penalty-time-frames/[frameId]/route')
        const nonExistentId = 'cl9ebqhxk00000drx6dj2fwmz'
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${nonExistentId}/penalty-time-frames/${testPenaltyTimeFrameId}`
        )
        const params = Promise.resolve({ id: nonExistentId, frameId: testPenaltyTimeFrameId })

        const response = await DELETE(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Pay guide not found')
      })

      it('should return 404 for non-existent penalty time frame', async () => {
        const { DELETE } = await import('@/app/api/pay-rates/[id]/penalty-time-frames/[frameId]/route')
        const nonExistentFrameId = 'cl9ebqhxk00000drx6dj2fwmz'
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${testPayGuideId}/penalty-time-frames/${nonExistentFrameId}`
        )
        const params = Promise.resolve({ id: testPayGuideId, frameId: nonExistentFrameId })

        const response = await DELETE(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Penalty time frame not found')
      })

      it('should return 404 when penalty time frame belongs to different pay guide', async () => {
        const { DELETE } = await import('@/app/api/pay-rates/[id]/penalty-time-frames/[frameId]/route')
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${testPayGuideId}/penalty-time-frames/${otherPayGuidePenaltyFrameId}`
        )
        const params = Promise.resolve({ id: testPayGuideId, frameId: otherPayGuidePenaltyFrameId })

        const response = await DELETE(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Penalty time frame does not belong to the specified pay guide')
      })
    })
  })

  describe('Integration Tests', () => {
    it('should handle complete CRUD workflow', async () => {
      // First, retrieve the penalty time frame
      const { GET } = await import('@/app/api/pay-rates/[id]/penalty-time-frames/[frameId]/route')
      const getRequest = new MockRequest(
        `http://localhost/api/pay-rates/${testPayGuideId}/penalty-time-frames/${testPenaltyTimeFrameId}`
      )
      const getParams = Promise.resolve({ id: testPayGuideId, frameId: testPenaltyTimeFrameId })

      const getResponse = await GET(getRequest as any, { params: getParams })
      const getResult = await getResponse.json()

      expect(getResponse.status).toBe(200)
      expect(getResult.data.name).toBe('Evening Penalty')

      // Then, update the penalty time frame
      const { PUT } = await import('@/app/api/pay-rates/[id]/penalty-time-frames/[frameId]/route')
      const updateData: UpdatePenaltyTimeFrameRequest = {
        name: 'Integration Test Penalty',
        multiplier: '1.4',
      }
      const putRequest = new MockRequest(
        `http://localhost/api/pay-rates/${testPayGuideId}/penalty-time-frames/${testPenaltyTimeFrameId}`,
        { method: 'PUT', body: updateData }
      )
      const putParams = Promise.resolve({ id: testPayGuideId, frameId: testPenaltyTimeFrameId })

      const putResponse = await PUT(putRequest as any, { params: putParams })
      const putResult = await putResponse.json()

      expect(putResponse.status).toBe(200)
      expect(putResult.data.name).toBe('Integration Test Penalty')
      expect(putResult.data.multiplier).toBe('1.4')

      // Verify the update with another GET
      const getUpdatedResponse = await GET(getRequest as any, { params: getParams })
      const getUpdatedResult = await getUpdatedResponse.json()

      expect(getUpdatedResponse.status).toBe(200)
      expect(getUpdatedResult.data.name).toBe('Integration Test Penalty')
      expect(getUpdatedResult.data.multiplier).toBe('1.4')

      // Finally, delete the penalty time frame
      const { DELETE } = await import('@/app/api/pay-rates/[id]/penalty-time-frames/[frameId]/route')
      const deleteRequest = new MockRequest(
        `http://localhost/api/pay-rates/${testPayGuideId}/penalty-time-frames/${testPenaltyTimeFrameId}`
      )
      const deleteParams = Promise.resolve({ id: testPayGuideId, frameId: testPenaltyTimeFrameId })

      const deleteResponse = await DELETE(deleteRequest as any, { params: deleteParams })
      expect(deleteResponse.status).toBe(200)

      // Verify deletion with GET (should return 404)
      const getFinalResponse = await GET(getRequest as any, { params: getParams })
      expect(getFinalResponse.status).toBe(404)
    })
  })
})