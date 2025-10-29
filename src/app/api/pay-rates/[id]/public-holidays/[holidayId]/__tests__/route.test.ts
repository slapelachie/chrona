/**
 * Public Holiday [holidayId] Route Tests
 *
 * Tests for the individual /api/pay-rates/[id]/public-holidays/[holidayId] endpoint
 * covering GET, PUT, and DELETE operations with validation and error handling.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'
import { Decimal } from 'decimal.js'
import { UpdatePublicHolidayRequest } from '@/types'

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
      url: 'file:./public-holiday-id-route-test.db',
    },
  },
})

describe('Public Holiday [holidayId] Route API', () => {
  let testPayGuideId: string
  let testPublicHolidayId: string
  let secondTestPublicHolidayId: string
  let otherPayGuideId: string
  let otherPayGuidePublicHolidayId: string

  beforeAll(async () => {
    // Set up test database
    process.env.DATABASE_URL = 'file:./public-holiday-id-route-test.db'
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
    // Clean up public holidays before each test
    await prisma.publicHoliday.deleteMany()

    // Create test public holidays
    const testHoliday = await prisma.publicHoliday.create({
      data: {
        payGuideId: testPayGuideId,
        name: 'Christmas Day',
        date: new Date('2024-12-25'),
        isActive: true,
      },
    })
    testPublicHolidayId = testHoliday.id

    const secondHoliday = await prisma.publicHoliday.create({
      data: {
        payGuideId: testPayGuideId,
        name: 'Boxing Day',
        date: new Date('2024-12-26'),
        isActive: true,
      },
    })
    secondTestPublicHolidayId = secondHoliday.id

    // Create public holiday for other pay guide
    const otherHoliday = await prisma.publicHoliday.create({
      data: {
        payGuideId: otherPayGuideId,
        name: 'Other Guide Holiday',
        date: new Date('2024-12-31'),
        isActive: true,
      },
    })
    otherPayGuidePublicHolidayId = otherHoliday.id
  })

  describe('GET /api/pay-rates/[id]/public-holidays/[holidayId]', () => {
    describe('Successful Retrieval', () => {
      it('should retrieve existing public holiday with all fields', async () => {
        const { GET } = await import('@/app/api/pay-rates/[id]/public-holidays/[holidayId]/route')
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${testPayGuideId}/public-holidays/${testPublicHolidayId}`
        )
        const params = Promise.resolve({ id: testPayGuideId, holidayId: testPublicHolidayId })

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data).toBeTruthy()
        expect(result.data.id).toBe(testPublicHolidayId)
        expect(result.data.name).toBe('Christmas Day')
        expect(result.data.date).toBe('2024-12-25T00:00:00.000Z')
        expect(result.data.isActive).toBe(true)
        expect(result.data.payGuideId).toBe(testPayGuideId)
        expect(result.data.createdAt).toBeTruthy()
        expect(result.data.updatedAt).toBeTruthy()

        // Verify data types
        expect(typeof result.data.id).toBe('string')
        expect(typeof result.data.name).toBe('string')
        expect(typeof result.data.date).toBe('string')
        expect(typeof result.data.isActive).toBe('boolean')
      })

      it('should retrieve second public holiday correctly', async () => {
        const { GET } = await import('@/app/api/pay-rates/[id]/public-holidays/[holidayId]/route')
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${testPayGuideId}/public-holidays/${secondTestPublicHolidayId}`
        )
        const params = Promise.resolve({ id: testPayGuideId, holidayId: secondTestPublicHolidayId })

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data.id).toBe(secondTestPublicHolidayId)
        expect(result.data.name).toBe('Boxing Day')
        expect(result.data.date).toBe('2024-12-26T00:00:00.000Z')
      })
    })

    describe('Validation and Error Handling', () => {
      it('should reject invalid pay guide ID', async () => {
        const { GET } = await import('@/app/api/pay-rates/[id]/public-holidays/[holidayId]/route')
        const invalidId = 'invalid-id'
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${invalidId}/public-holidays/${testPublicHolidayId}`
        )
        const params = Promise.resolve({ id: invalidId, holidayId: testPublicHolidayId })

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(result.message).toBe('Invalid ID format')
      })

      it('should reject invalid public holiday ID', async () => {
        const { GET } = await import('@/app/api/pay-rates/[id]/public-holidays/[holidayId]/route')
        const invalidHolidayId = 'invalid-holiday-id'
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${testPayGuideId}/public-holidays/${invalidHolidayId}`
        )
        const params = Promise.resolve({ id: testPayGuideId, holidayId: invalidHolidayId })

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(result.message).toBe('Invalid ID format')
      })

      it('should return 404 for non-existent pay guide', async () => {
        const { GET } = await import('@/app/api/pay-rates/[id]/public-holidays/[holidayId]/route')
        const nonExistentId = 'cl9ebqhxk00000drx6dj2fwmz'
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${nonExistentId}/public-holidays/${testPublicHolidayId}`
        )
        const params = Promise.resolve({ id: nonExistentId, holidayId: testPublicHolidayId })

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Pay guide not found')
      })

      it('should return 404 for non-existent public holiday', async () => {
        const { GET } = await import('@/app/api/pay-rates/[id]/public-holidays/[holidayId]/route')
        const nonExistentHolidayId = 'cl9ebqhxk00000drx6dj2fwmz'
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${testPayGuideId}/public-holidays/${nonExistentHolidayId}`
        )
        const params = Promise.resolve({ id: testPayGuideId, holidayId: nonExistentHolidayId })

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Public holiday not found')
      })

      it('should return 404 when public holiday belongs to different pay guide', async () => {
        const { GET } = await import('@/app/api/pay-rates/[id]/public-holidays/[holidayId]/route')
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${testPayGuideId}/public-holidays/${otherPayGuidePublicHolidayId}`
        )
        const params = Promise.resolve({ id: testPayGuideId, holidayId: otherPayGuidePublicHolidayId })

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Public holiday does not belong to the specified pay guide')
      })
    })
  })

  describe('PUT /api/pay-rates/[id]/public-holidays/[holidayId]', () => {
    describe('Successful Updates', () => {
      it('should update all fields successfully', async () => {
        const updateData: UpdatePublicHolidayRequest = {
          name: 'Updated Christmas Day',
          date: '2024-12-24',
          isActive: false,
        }

        const { PUT } = await import('@/app/api/pay-rates/[id]/public-holidays/[holidayId]/route')
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${testPayGuideId}/public-holidays/${testPublicHolidayId}`,
          { method: 'PUT', body: updateData }
        )
        const params = Promise.resolve({ id: testPayGuideId, holidayId: testPublicHolidayId })

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data).toBeTruthy()
        expect(result.data.name).toBe('Updated Christmas Day')
        expect(result.data.date).toBe('2024-12-24T00:00:00.000Z')
        expect(result.data.isActive).toBe(false)
        expect(result.message).toBe('Public holiday updated successfully')

        // Verify it was actually saved in database
        const saved = await prisma.publicHoliday.findUnique({
          where: { id: testPublicHolidayId },
        })
        expect(saved!.name).toBe('Updated Christmas Day')
        expect(saved!.date.toISOString().split('T')[0]).toBe('2024-12-24')
        expect(saved!.isActive).toBe(false)
      })

      it('should update partial fields only', async () => {
        const updateData: UpdatePublicHolidayRequest = {
          name: 'Partially Updated Holiday',
        }

        const { PUT } = await import('@/app/api/pay-rates/[id]/public-holidays/[holidayId]/route')
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${testPayGuideId}/public-holidays/${testPublicHolidayId}`,
          { method: 'PUT', body: updateData }
        )
        const params = Promise.resolve({ id: testPayGuideId, holidayId: testPublicHolidayId })

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data.name).toBe('Partially Updated Holiday')
        // These should remain unchanged
        expect(result.data.date).toBe('2024-12-25T00:00:00.000Z')
        expect(result.data.isActive).toBe(true)
      })

      it('should update date field only', async () => {
        const updateData: UpdatePublicHolidayRequest = {
          date: '2024-12-23',
        }

        const { PUT } = await import('@/app/api/pay-rates/[id]/public-holidays/[holidayId]/route')
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${testPayGuideId}/public-holidays/${testPublicHolidayId}`,
          { method: 'PUT', body: updateData }
        )
        const params = Promise.resolve({ id: testPayGuideId, holidayId: testPublicHolidayId })

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data.date).toBe('2024-12-23T00:00:00.000Z')
        // These should remain unchanged
        expect(result.data.name).toBe('Christmas Day')
        expect(result.data.isActive).toBe(true)
      })
    })

    describe('Validation and Error Handling', () => {
      it('should reject invalid pay guide ID', async () => {
        const updateData: UpdatePublicHolidayRequest = {
          name: 'Test Update',
        }

        const { PUT } = await import('@/app/api/pay-rates/[id]/public-holidays/[holidayId]/route')
        const invalidId = 'invalid-id'
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${invalidId}/public-holidays/${testPublicHolidayId}`,
          { method: 'PUT', body: updateData }
        )
        const params = Promise.resolve({ id: invalidId, holidayId: testPublicHolidayId })

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(result.message).toBe('Invalid ID format')
      })

      it('should return 404 for non-existent pay guide', async () => {
        const updateData: UpdatePublicHolidayRequest = {
          name: 'Test Update',
        }

        const { PUT } = await import('@/app/api/pay-rates/[id]/public-holidays/[holidayId]/route')
        const nonExistentId = 'cl9ebqhxk00000drx6dj2fwmz'
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${nonExistentId}/public-holidays/${testPublicHolidayId}`,
          { method: 'PUT', body: updateData }
        )
        const params = Promise.resolve({ id: nonExistentId, holidayId: testPublicHolidayId })

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Pay guide not found')
      })

      it('should return 404 for non-existent public holiday', async () => {
        const updateData: UpdatePublicHolidayRequest = {
          name: 'Test Update',
        }

        const { PUT } = await import('@/app/api/pay-rates/[id]/public-holidays/[holidayId]/route')
        const nonExistentHolidayId = 'cl9ebqhxk00000drx6dj2fwmz'
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${testPayGuideId}/public-holidays/${nonExistentHolidayId}`,
          { method: 'PUT', body: updateData }
        )
        const params = Promise.resolve({ id: testPayGuideId, holidayId: nonExistentHolidayId })

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Public holiday not found')
      })

      it('should validate field constraints', async () => {
        const invalidData = {
          name: 'A', // Too short
          date: 'invalid-date', // Invalid date format
        }

        const { PUT } = await import('@/app/api/pay-rates/[id]/public-holidays/[holidayId]/route')
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${testPayGuideId}/public-holidays/${testPublicHolidayId}`,
          { method: 'PUT', body: invalidData }
        )
        const params = Promise.resolve({ id: testPayGuideId, holidayId: testPublicHolidayId })

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(result.errors.length).toBeGreaterThan(0)

        const errorFields = result.errors.map((err: any) => err.field)
        expect(errorFields).toContain('name')
        expect(errorFields).toContain('date')
      })

      it('should prevent duplicate dates on same pay guide', async () => {
        const updateData: UpdatePublicHolidayRequest = {
          date: '2024-12-26', // This date already exists (Boxing Day)
        }

        const { PUT } = await import('@/app/api/pay-rates/[id]/public-holidays/[holidayId]/route')
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${testPayGuideId}/public-holidays/${testPublicHolidayId}`,
          { method: 'PUT', body: updateData }
        )
        const params = Promise.resolve({ id: testPayGuideId, holidayId: testPublicHolidayId })

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(
          result.errors.some(
            (err: any) => 
              err.field === 'date' && 
              err.message.includes('already exists')
          )
        ).toBe(true)
        expect(result.message).toBe('Duplicate public holiday')
      })

      it('should return 404 when public holiday belongs to different pay guide', async () => {
        const updateData: UpdatePublicHolidayRequest = {
          name: 'Test Update',
        }

        const { PUT } = await import('@/app/api/pay-rates/[id]/public-holidays/[holidayId]/route')
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${testPayGuideId}/public-holidays/${otherPayGuidePublicHolidayId}`,
          { method: 'PUT', body: updateData }
        )
        const params = Promise.resolve({ id: testPayGuideId, holidayId: otherPayGuidePublicHolidayId })

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Public holiday does not belong to the specified pay guide')
      })
    })
  })

  describe('DELETE /api/pay-rates/[id]/public-holidays/[holidayId]', () => {
    describe('Successful Deletion', () => {
      it('should delete public holiday successfully', async () => {
        const { DELETE } = await import('@/app/api/pay-rates/[id]/public-holidays/[holidayId]/route')
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${testPayGuideId}/public-holidays/${testPublicHolidayId}`
        )
        const params = Promise.resolve({ id: testPayGuideId, holidayId: testPublicHolidayId })

        const response = await DELETE(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.message).toBe('Public holiday deleted successfully')

        // Verify it was actually deleted
        const deleted = await prisma.publicHoliday.findUnique({
          where: { id: testPublicHolidayId },
        })
        expect(deleted).toBeNull()
      })
    })

    describe('Validation and Error Handling', () => {
      it('should reject invalid pay guide ID', async () => {
        const { DELETE } = await import('@/app/api/pay-rates/[id]/public-holidays/[holidayId]/route')
        const invalidId = 'invalid-id'
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${invalidId}/public-holidays/${testPublicHolidayId}`
        )
        const params = Promise.resolve({ id: invalidId, holidayId: testPublicHolidayId })

        const response = await DELETE(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(result.message).toBe('Invalid ID format')
      })

      it('should return 404 for non-existent pay guide', async () => {
        const { DELETE } = await import('@/app/api/pay-rates/[id]/public-holidays/[holidayId]/route')
        const nonExistentId = 'cl9ebqhxk00000drx6dj2fwmz'
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${nonExistentId}/public-holidays/${testPublicHolidayId}`
        )
        const params = Promise.resolve({ id: nonExistentId, holidayId: testPublicHolidayId })

        const response = await DELETE(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Pay guide not found')
      })

      it('should return 404 for non-existent public holiday', async () => {
        const { DELETE } = await import('@/app/api/pay-rates/[id]/public-holidays/[holidayId]/route')
        const nonExistentHolidayId = 'cl9ebqhxk00000drx6dj2fwmz'
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${testPayGuideId}/public-holidays/${nonExistentHolidayId}`
        )
        const params = Promise.resolve({ id: testPayGuideId, holidayId: nonExistentHolidayId })

        const response = await DELETE(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Public holiday not found')
      })

      it('should return 404 when public holiday belongs to different pay guide', async () => {
        const { DELETE } = await import('@/app/api/pay-rates/[id]/public-holidays/[holidayId]/route')
        const request = new MockRequest(
          `http://localhost/api/pay-rates/${testPayGuideId}/public-holidays/${otherPayGuidePublicHolidayId}`
        )
        const params = Promise.resolve({ id: testPayGuideId, holidayId: otherPayGuidePublicHolidayId })

        const response = await DELETE(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Public holiday does not belong to the specified pay guide')
      })
    })
  })

  describe('Integration Tests', () => {
    it('should handle complete CRUD workflow', async () => {
      // First, retrieve the public holiday
      const { GET } = await import('@/app/api/pay-rates/[id]/public-holidays/[holidayId]/route')
      const getRequest = new MockRequest(
        `http://localhost/api/pay-rates/${testPayGuideId}/public-holidays/${testPublicHolidayId}`
      )
      const getParams = Promise.resolve({ id: testPayGuideId, holidayId: testPublicHolidayId })

      const getResponse = await GET(getRequest as any, { params: getParams })
      const getResult = await getResponse.json()

      expect(getResponse.status).toBe(200)
      expect(getResult.data.name).toBe('Christmas Day')

      // Then, update the public holiday
      const { PUT } = await import('@/app/api/pay-rates/[id]/public-holidays/[holidayId]/route')
      const updateData: UpdatePublicHolidayRequest = {
        name: 'Integration Test Holiday',
        date: '2024-12-23',
        isActive: false,
      }
      const putRequest = new MockRequest(
        `http://localhost/api/pay-rates/${testPayGuideId}/public-holidays/${testPublicHolidayId}`,
        { method: 'PUT', body: updateData }
      )
      const putParams = Promise.resolve({ id: testPayGuideId, holidayId: testPublicHolidayId })

      const putResponse = await PUT(putRequest as any, { params: putParams })
      const putResult = await putResponse.json()

      expect(putResponse.status).toBe(200)
      expect(putResult.data.name).toBe('Integration Test Holiday')
      expect(putResult.data.date).toBe('2024-12-23T00:00:00.000Z')
      expect(putResult.data.isActive).toBe(false)

      // Verify the update with another GET
      const getUpdatedResponse = await GET(getRequest as any, { params: getParams })
      const getUpdatedResult = await getUpdatedResponse.json()

      expect(getUpdatedResponse.status).toBe(200)
      expect(getUpdatedResult.data.name).toBe('Integration Test Holiday')
      expect(getUpdatedResult.data.date).toBe('2024-12-23T00:00:00.000Z')
      expect(getUpdatedResult.data.isActive).toBe(false)

      // Finally, delete the public holiday
      const { DELETE } = await import('@/app/api/pay-rates/[id]/public-holidays/[holidayId]/route')
      const deleteRequest = new MockRequest(
        `http://localhost/api/pay-rates/${testPayGuideId}/public-holidays/${testPublicHolidayId}`
      )
      const deleteParams = Promise.resolve({ id: testPayGuideId, holidayId: testPublicHolidayId })

      const deleteResponse = await DELETE(deleteRequest as any, { params: deleteParams })
      expect(deleteResponse.status).toBe(200)

      // Verify deletion with GET (should return 404)
      const getFinalResponse = await GET(getRequest as any, { params: getParams })
      expect(getFinalResponse.status).toBe(404)
    })
  })
})
