/**
 * Overtime Time Frame [frameId] Route Tests
 *
 * Tests for the individual /api/pay-rates/[id]/overtime-time-frames/[frameId] endpoint
 * covering GET, PUT, and DELETE operations with validation and error handling.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'
import { Decimal } from 'decimal.js'
import {
  UpdateOvertimeTimeFrameRequest,
  OvertimeTimeFrameResponse,
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
      url: 'file:./overtime-time-frame-id-route-test.db',
    },
  },
})

describe('Overtime Time Frame [frameId] Route API', () => {
  let testPayGuideId: string
  let testOvertimeTimeFrameId: string
  let secondTestOvertimeTimeFrameId: string
  let otherPayGuideId: string
  let otherPayGuideOvertimeFrameId: string

  beforeAll(async () => {
    // Set up test database
    process.env.DATABASE_URL = 'file:./overtime-time-frame-id-route-test.db'
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
    // Clean up overtime time frames before each test
    await prisma.overtimeTimeFrame.deleteMany()

    // Create test overtime time frames
    const testFrame = await prisma.overtimeTimeFrame.create({
      data: {
        payGuideId: testPayGuideId,
        name: 'Daily Overtime',
        firstThreeHoursMult: new Decimal('1.5'),
        afterThreeHoursMult: new Decimal('2.0'),
        startTime: '08:00',
        endTime: '17:00',
        description: 'Daily overtime rates',
        isActive: true,
      },
    })
    testOvertimeTimeFrameId = testFrame.id

    const secondFrame = await prisma.overtimeTimeFrame.create({
      data: {
        payGuideId: testPayGuideId,
        name: 'Sunday Overtime',
        firstThreeHoursMult: new Decimal('1.75'),
        afterThreeHoursMult: new Decimal('2.25'),
        dayOfWeek: 0, // Sunday
        isActive: true,
      },
    })
    secondTestOvertimeTimeFrameId = secondFrame.id

    // Create overtime frame for other pay guide
    const otherFrame = await prisma.overtimeTimeFrame.create({
      data: {
        payGuideId: otherPayGuideId,
        name: 'Other Guide Overtime',
        firstThreeHoursMult: new Decimal('1.8'),
        afterThreeHoursMult: new Decimal('2.3'),
        isActive: true,
      },
    })
    otherPayGuideOvertimeFrameId = otherFrame.id
  })

  describe('GET /api/pay-rates/[id]/overtime-time-frames/[frameId]', () => {
    describe('Successful Retrieval', () => {
      it('should retrieve existing overtime time frame with all fields', async () => {
        const { GET } = await import('@/app/api/pay-rates/[id]/overtime-time-frames/[frameId]/route')
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${testPayGuideId}/overtime-time-frames/${testOvertimeTimeFrameId}`
        )
        const params = Promise.resolve({ id: testPayGuideId, frameId: testOvertimeTimeFrameId })

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data).toBeTruthy()
        expect(result.data.id).toBe(testOvertimeTimeFrameId)
        expect(result.data.name).toBe('Daily Overtime')
        expect(result.data.firstThreeHoursMult).toBe('1.5')
        expect(result.data.afterThreeHoursMult).toBe('2')
        expect(result.data.startTime).toBe('08:00')
        expect(result.data.endTime).toBe('17:00')
        expect(result.data.description).toBe('Daily overtime rates')
        expect(result.data.isActive).toBe(true)
        expect(result.data.payGuideId).toBe(testPayGuideId)
        expect(result.data.createdAt).toBeTruthy()
        expect(result.data.updatedAt).toBeTruthy()

        // Verify data types
        expect(typeof result.data.id).toBe('string')
        expect(typeof result.data.firstThreeHoursMult).toBe('string')
        expect(typeof result.data.afterThreeHoursMult).toBe('string')
        expect(typeof result.data.isActive).toBe('boolean')
      })

      it('should retrieve overtime time frame with null optional fields', async () => {
        const { GET } = await import('@/app/api/pay-rates/[id]/overtime-time-frames/[frameId]/route')
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${testPayGuideId}/overtime-time-frames/${secondTestOvertimeTimeFrameId}`
        )
        const params = Promise.resolve({ id: testPayGuideId, frameId: secondTestOvertimeTimeFrameId })

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data.id).toBe(secondTestOvertimeTimeFrameId)
        expect(result.data.name).toBe('Sunday Overtime')
        expect(result.data.dayOfWeek).toBe(0)
        expect(result.data.startTime).toBeNull()
        expect(result.data.endTime).toBeNull()
        expect(result.data.description).toBeNull()
      })
    })

    describe('Validation and Error Handling', () => {
      it('should reject invalid pay guide ID', async () => {
        const { GET } = await import('@/app/api/pay-rates/[id]/overtime-time-frames/[frameId]/route')
        const invalidId = 'invalid-id'
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${invalidId}/overtime-time-frames/${testOvertimeTimeFrameId}`
        )
        const params = Promise.resolve({ id: invalidId, frameId: testOvertimeTimeFrameId })

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(result.message).toBe('Invalid ID format')
      })

      it('should reject invalid overtime time frame ID', async () => {
        const { GET } = await import('@/app/api/pay-rates/[id]/overtime-time-frames/[frameId]/route')
        const invalidFrameId = 'invalid-frame-id'
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${testPayGuideId}/overtime-time-frames/${invalidFrameId}`
        )
        const params = Promise.resolve({ id: testPayGuideId, frameId: invalidFrameId })

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(result.message).toBe('Invalid ID format')
      })

      it('should return 404 for non-existent pay guide', async () => {
        const { GET } = await import('@/app/api/pay-rates/[id]/overtime-time-frames/[frameId]/route')
        const nonExistentId = 'cl9ebqhxk00000drx6dj2fwmz'
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${nonExistentId}/overtime-time-frames/${testOvertimeTimeFrameId}`
        )
        const params = Promise.resolve({ id: nonExistentId, frameId: testOvertimeTimeFrameId })

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Pay guide not found')
      })

      it('should return 404 for non-existent overtime time frame', async () => {
        const { GET } = await import('@/app/api/pay-rates/[id]/overtime-time-frames/[frameId]/route')
        const nonExistentFrameId = 'cl9ebqhxk00000drx6dj2fwmz'
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${testPayGuideId}/overtime-time-frames/${nonExistentFrameId}`
        )
        const params = Promise.resolve({ id: testPayGuideId, frameId: nonExistentFrameId })

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Overtime time frame not found')
      })

      it('should return 404 when overtime time frame belongs to different pay guide', async () => {
        const { GET } = await import('@/app/api/pay-rates/[id]/overtime-time-frames/[frameId]/route')
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${testPayGuideId}/overtime-time-frames/${otherPayGuideOvertimeFrameId}`
        )
        const params = Promise.resolve({ id: testPayGuideId, frameId: otherPayGuideOvertimeFrameId })

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Overtime time frame does not belong to the specified pay guide')
      })
    })
  })

  describe('PUT /api/pay-rates/[id]/overtime-time-frames/[frameId]', () => {
    describe('Successful Updates', () => {
      it('should update all fields successfully', async () => {
        const updateData: UpdateOvertimeTimeFrameRequest = {
          name: 'Updated Daily Overtime',
          firstThreeHoursMult: '1.65',
          afterThreeHoursMult: '2.1',
          dayOfWeek: 5, // Friday
          startTime: '07:00',
          endTime: '18:00',
          description: 'Updated daily overtime rates',
          isActive: false,
        }

        const { PUT } = await import('@/app/api/pay-rates/[id]/overtime-time-frames/[frameId]/route')
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${testPayGuideId}/overtime-time-frames/${testOvertimeTimeFrameId}`,
          { method: 'PUT', body: updateData }
        )
        const params = Promise.resolve({ id: testPayGuideId, frameId: testOvertimeTimeFrameId })

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data).toBeTruthy()
        expect(result.data.name).toBe('Updated Daily Overtime')
        expect(result.data.firstThreeHoursMult).toBe('1.65')
        expect(result.data.afterThreeHoursMult).toBe('2.1')
        expect(result.data.dayOfWeek).toBe(5)
        expect(result.data.startTime).toBe('07:00')
        expect(result.data.endTime).toBe('18:00')
        expect(result.data.description).toBe('Updated daily overtime rates')
        expect(result.data.isActive).toBe(false)
        expect(result.message).toBe('Overtime time frame updated successfully')

        // Verify it was actually saved in database
        const saved = await prisma.overtimeTimeFrame.findUnique({
          where: { id: testOvertimeTimeFrameId },
        })
        expect(saved!.name).toBe('Updated Daily Overtime')
        expect(saved!.firstThreeHoursMult.toString()).toBe('1.65')
        expect(saved!.afterThreeHoursMult.toString()).toBe('2.1')
      })

      it('should update partial fields only', async () => {
        const updateData: UpdateOvertimeTimeFrameRequest = {
          name: 'Partially Updated Overtime',
          firstThreeHoursMult: '1.6',
        }

        const { PUT } = await import('@/app/api/pay-rates/[id]/overtime-time-frames/[frameId]/route')
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${testPayGuideId}/overtime-time-frames/${testOvertimeTimeFrameId}`,
          { method: 'PUT', body: updateData }
        )
        const params = Promise.resolve({ id: testPayGuideId, frameId: testOvertimeTimeFrameId })

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data.name).toBe('Partially Updated Overtime')
        expect(result.data.firstThreeHoursMult).toBe('1.6')
        // These should remain unchanged
        expect(result.data.afterThreeHoursMult).toBe('2')
        expect(result.data.startTime).toBe('08:00')
        expect(result.data.endTime).toBe('17:00')
        expect(result.data.isActive).toBe(true)
      })
    })

    describe('Validation and Error Handling', () => {
      it('should reject invalid pay guide ID', async () => {
        const updateData: UpdateOvertimeTimeFrameRequest = {
          name: 'Test Update',
        }

        const { PUT } = await import('@/app/api/pay-rates/[id]/overtime-time-frames/[frameId]/route')
        const invalidId = 'invalid-id'
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${invalidId}/overtime-time-frames/${testOvertimeTimeFrameId}`,
          { method: 'PUT', body: updateData }
        )
        const params = Promise.resolve({ id: invalidId, frameId: testOvertimeTimeFrameId })

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(result.message).toBe('Invalid ID format')
      })

      it('should return 404 for non-existent pay guide', async () => {
        const updateData: UpdateOvertimeTimeFrameRequest = {
          name: 'Test Update',
        }

        const { PUT } = await import('@/app/api/pay-rates/[id]/overtime-time-frames/[frameId]/route')
        const nonExistentId = 'cl9ebqhxk00000drx6dj2fwmz'
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${nonExistentId}/overtime-time-frames/${testOvertimeTimeFrameId}`,
          { method: 'PUT', body: updateData }
        )
        const params = Promise.resolve({ id: nonExistentId, frameId: testOvertimeTimeFrameId })

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Pay guide not found')
      })

      it('should return 404 for non-existent overtime time frame', async () => {
        const updateData: UpdateOvertimeTimeFrameRequest = {
          name: 'Test Update',
        }

        const { PUT } = await import('@/app/api/pay-rates/[id]/overtime-time-frames/[frameId]/route')
        const nonExistentFrameId = 'cl9ebqhxk00000drx6dj2fwmz'
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${testPayGuideId}/overtime-time-frames/${nonExistentFrameId}`,
          { method: 'PUT', body: updateData }
        )
        const params = Promise.resolve({ id: testPayGuideId, frameId: nonExistentFrameId })

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Overtime time frame not found')
      })

      it('should validate field constraints', async () => {
        const invalidData = {
          name: 'A', // Too short
          firstThreeHoursMult: '0.5', // Too low
          afterThreeHoursMult: '0.5', // Too low
          dayOfWeek: 7, // Invalid (should be 0-6)
          startTime: '25:00', // Invalid time
          endTime: 'invalid-time', // Invalid format
          description: 'A'.repeat(501), // Too long
        }

        const { PUT } = await import('@/app/api/pay-rates/[id]/overtime-time-frames/[frameId]/route')
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${testPayGuideId}/overtime-time-frames/${testOvertimeTimeFrameId}`,
          { method: 'PUT', body: invalidData }
        )
        const params = Promise.resolve({ id: testPayGuideId, frameId: testOvertimeTimeFrameId })

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(result.errors.length).toBeGreaterThan(1)

        const errorFields = result.errors.map((err: any) => err.field)
        expect(errorFields).toContain('name')
        expect(errorFields).toContain('firstThreeHoursMult')
        expect(errorFields).toContain('afterThreeHoursMult')
        expect(errorFields).toContain('dayOfWeek')
        expect(errorFields).toContain('startTime')
        expect(errorFields).toContain('endTime')
        expect(errorFields).toContain('description')
      })

      it('should return 404 when overtime time frame belongs to different pay guide', async () => {
        const updateData: UpdateOvertimeTimeFrameRequest = {
          name: 'Test Update',
        }

        const { PUT } = await import('@/app/api/pay-rates/[id]/overtime-time-frames/[frameId]/route')
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${testPayGuideId}/overtime-time-frames/${otherPayGuideOvertimeFrameId}`,
          { method: 'PUT', body: updateData }
        )
        const params = Promise.resolve({ id: testPayGuideId, frameId: otherPayGuideOvertimeFrameId })

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Overtime time frame does not belong to the specified pay guide')
      })
    })
  })

  describe('DELETE /api/pay-rates/[id]/overtime-time-frames/[frameId]', () => {
    describe('Successful Deletion', () => {
      it('should delete overtime time frame successfully', async () => {
        const { DELETE } = await import('@/app/api/pay-rates/[id]/overtime-time-frames/[frameId]/route')
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${testPayGuideId}/overtime-time-frames/${testOvertimeTimeFrameId}`
        )
        const params = Promise.resolve({ id: testPayGuideId, frameId: testOvertimeTimeFrameId })

        const response = await DELETE(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.message).toBe('Overtime time frame deleted successfully')

        // Verify it was actually deleted
        const deleted = await prisma.overtimeTimeFrame.findUnique({
          where: { id: testOvertimeTimeFrameId },
        })
        expect(deleted).toBeNull()
      })
    })

    describe('Validation and Error Handling', () => {
      it('should reject invalid pay guide ID', async () => {
        const { DELETE } = await import('@/app/api/pay-rates/[id]/overtime-time-frames/[frameId]/route')
        const invalidId = 'invalid-id'
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${invalidId}/overtime-time-frames/${testOvertimeTimeFrameId}`
        )
        const params = Promise.resolve({ id: invalidId, frameId: testOvertimeTimeFrameId })

        const response = await DELETE(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(result.message).toBe('Invalid ID format')
      })

      it('should return 404 for non-existent pay guide', async () => {
        const { DELETE } = await import('@/app/api/pay-rates/[id]/overtime-time-frames/[frameId]/route')
        const nonExistentId = 'cl9ebqhxk00000drx6dj2fwmz'
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${nonExistentId}/overtime-time-frames/${testOvertimeTimeFrameId}`
        )
        const params = Promise.resolve({ id: nonExistentId, frameId: testOvertimeTimeFrameId })

        const response = await DELETE(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Pay guide not found')
      })

      it('should return 404 for non-existent overtime time frame', async () => {
        const { DELETE } = await import('@/app/api/pay-rates/[id]/overtime-time-frames/[frameId]/route')
        const nonExistentFrameId = 'cl9ebqhxk00000drx6dj2fwmz'
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${testPayGuideId}/overtime-time-frames/${nonExistentFrameId}`
        )
        const params = Promise.resolve({ id: testPayGuideId, frameId: nonExistentFrameId })

        const response = await DELETE(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Overtime time frame not found')
      })

      it('should return 404 when overtime time frame belongs to different pay guide', async () => {
        const { DELETE } = await import('@/app/api/pay-rates/[id]/overtime-time-frames/[frameId]/route')
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${testPayGuideId}/overtime-time-frames/${otherPayGuideOvertimeFrameId}`
        )
        const params = Promise.resolve({ id: testPayGuideId, frameId: otherPayGuideOvertimeFrameId })

        const response = await DELETE(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Overtime time frame does not belong to the specified pay guide')
      })
    })
  })

  describe('Integration Tests', () => {
    it('should handle complete CRUD workflow', async () => {
      // First, retrieve the overtime time frame
      const { GET } = await import('@/app/api/pay-rates/[id]/overtime-time-frames/[frameId]/route')
      const getRequest = new MockRequest(
        `http://localhost/api/pay-rates/${testPayGuideId}/overtime-time-frames/${testOvertimeTimeFrameId}`
      )
      const getParams = Promise.resolve({ id: testPayGuideId, frameId: testOvertimeTimeFrameId })

      const getResponse = await GET(getRequest as any, { params: getParams })
      const getResult = await getResponse.json()

      expect(getResponse.status).toBe(200)
      expect(getResult.data.name).toBe('Daily Overtime')

      // Then, update the overtime time frame
      const { PUT } = await import('@/app/api/pay-rates/[id]/overtime-time-frames/[frameId]/route')
      const updateData: UpdateOvertimeTimeFrameRequest = {
        name: 'Integration Test Overtime',
        firstThreeHoursMult: '1.7',
        afterThreeHoursMult: '2.2',
      }
      const putRequest = new MockRequest(
        `http://localhost/api/pay-rates/${testPayGuideId}/overtime-time-frames/${testOvertimeTimeFrameId}`,
        { method: 'PUT', body: updateData }
      )
      const putParams = Promise.resolve({ id: testPayGuideId, frameId: testOvertimeTimeFrameId })

      const putResponse = await PUT(putRequest as any, { params: putParams })
      const putResult = await putResponse.json()

      expect(putResponse.status).toBe(200)
      expect(putResult.data.name).toBe('Integration Test Overtime')
      expect(putResult.data.firstThreeHoursMult).toBe('1.7')
      expect(putResult.data.afterThreeHoursMult).toBe('2.2')

      // Verify the update with another GET
      const getUpdatedResponse = await GET(getRequest as any, { params: getParams })
      const getUpdatedResult = await getUpdatedResponse.json()

      expect(getUpdatedResponse.status).toBe(200)
      expect(getUpdatedResult.data.name).toBe('Integration Test Overtime')
      expect(getUpdatedResult.data.firstThreeHoursMult).toBe('1.7')
      expect(getUpdatedResult.data.afterThreeHoursMult).toBe('2.2')

      // Finally, delete the overtime time frame
      const { DELETE } = await import('@/app/api/pay-rates/[id]/overtime-time-frames/[frameId]/route')
      const deleteRequest = new MockRequest(
        `http://localhost/api/pay-rates/${testPayGuideId}/overtime-time-frames/${testOvertimeTimeFrameId}`
      )
      const deleteParams = Promise.resolve({ id: testPayGuideId, frameId: testOvertimeTimeFrameId })

      const deleteResponse = await DELETE(deleteRequest as any, { params: deleteParams })
      expect(deleteResponse.status).toBe(200)

      // Verify deletion with GET (should return 404)
      const getFinalResponse = await GET(getRequest as any, { params: getParams })
      expect(getFinalResponse.status).toBe(404)
    })
  })
})