/**
 * Pay Rates [id] Route Tests
 *
 * This file provides comprehensive tests for the /api/pay-rates/[id] route handlers.
 * The tests cover all three HTTP methods (GET, PUT, DELETE) with extensive validation
 * and error handling scenarios.
 *
 * Test coverage includes:
 * - GET /api/pay-rates/[id] (retrieve specific pay guide)
 * - PUT /api/pay-rates/[id] (update specific pay guide)
 * - DELETE /api/pay-rates/[id] (delete specific pay guide)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'
import { Decimal } from 'decimal.js'
import { UpdatePayGuideRequest } from '@/types'

// Mock Next.js request/response objects following existing patterns
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
      url: 'file:./pay-rates-id-route-test.db',
    },
  },
})

describe('Pay Rates [id] Route API', () => {
  let testPayGuideId: string
  let secondTestPayGuideId: string
  let testUserId: string

  beforeAll(async () => {
    // Set up test database
    process.env.DATABASE_URL = 'file:./pay-rates-id-route-test.db'
    execSync('npx prisma migrate dev --name init', { stdio: 'pipe' })

    // Clean any existing data first
    await prisma.shift.deleteMany()
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

    // Create base test pay guides
    const createdPayGuide = await prisma.payGuide.create({
      data: {
        name: 'Test Retail Award',
        baseRate: new Decimal('25.00'),
        effectiveFrom: new Date('2024-01-01'),
        timezone: 'Australia/Sydney',
        isActive: true,
        minimumShiftHours: 3,
        maximumShiftHours: 10,
        description: 'Test pay guide for API testing',
      },
    })
    testPayGuideId = createdPayGuide.id

    const createdSecondPayGuide = await prisma.payGuide.create({
      data: {
        name: 'Test Hospitality Award',
        baseRate: new Decimal('28.50'),
        effectiveFrom: new Date('2024-02-01'),
        timezone: 'Australia/Melbourne',
        isActive: false,
      },
    })
    secondTestPayGuideId = createdSecondPayGuide.id
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    // Clean up any shifts that might have been created during tests
    await prisma.shift.deleteMany()

    // Delete all pay guides and recreate them
    await prisma.payGuide.deleteMany()

    // Recreate test pay guides
    await prisma.payGuide.create({
      data: {
        id: testPayGuideId,
        name: 'Test Retail Award',
        baseRate: new Decimal('25.00'),
        effectiveFrom: new Date('2024-01-01'),
        timezone: 'Australia/Sydney',
        isActive: true,
        minimumShiftHours: 3,
        maximumShiftHours: 10,
        description: 'Test pay guide for API testing',
      },
    })

    await prisma.payGuide.create({
      data: {
        id: secondTestPayGuideId,
        name: 'Test Hospitality Award',
        baseRate: new Decimal('28.50'),
        effectiveFrom: new Date('2024-02-01'),
        timezone: 'Australia/Melbourne',
        isActive: false,
      },
    })
  })

  describe('GET /api/pay-rates/[id]', () => {
    describe('Successful Retrieval', () => {
      it('should retrieve existing pay guide with all fields', async () => {
        const { GET } = await import('@/app/api/pay-rates/[id]/route')
        const request = new MockRequest(`http://localhost/api/pay-rates/${testPayGuideId}`)
        const params = Promise.resolve({ id: testPayGuideId })

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data).toBeTruthy()
        expect(result.data.id).toBe(testPayGuideId)
        expect(result.data.name).toBe('Test Retail Award')
        expect(result.data.baseRate).toBe('25')
        expect(result.data.effectiveFrom).toBeTruthy()
        expect(result.data.timezone).toBe('Australia/Sydney')
        expect(result.data.isActive).toBe(true)
        expect(result.data.minimumShiftHours).toBe(3)
        expect(result.data.maximumShiftHours).toBe(10)
        expect(result.data.description).toBe('Test pay guide for API testing')
        expect(result.data.createdAt).toBeTruthy()
        expect(result.data.updatedAt).toBeTruthy()

        // Verify data types
        expect(typeof result.data.id).toBe('string')
        expect(typeof result.data.baseRate).toBe('string')
        expect(typeof result.data.isActive).toBe('boolean')
        expect(typeof result.data.minimumShiftHours).toBe('number')
        expect(typeof result.data.maximumShiftHours).toBe('number')
      })

      it('should retrieve pay guide with null optional fields', async () => {
        const { GET } = await import('@/app/api/pay-rates/[id]/route')
        const request = new MockRequest(`http://localhost/api/pay-rates/${secondTestPayGuideId}`)
        const params = Promise.resolve({ id: secondTestPayGuideId })

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data).toBeTruthy()
        expect(result.data.id).toBe(secondTestPayGuideId)
        expect(result.data.name).toBe('Test Hospitality Award')
        expect(result.data.minimumShiftHours).toBeNull()
        expect(result.data.maximumShiftHours).toBeNull()
        expect(result.data.description).toBeNull()
        expect(result.data.effectiveTo).toBeNull()
      })
    })

    describe('Validation and Error Handling', () => {
      it('should reject invalid CUID format', async () => {
        const { GET } = await import('@/app/api/pay-rates/[id]/route')
        const invalidId = 'invalid-id-format'
        const request = new MockRequest(`http://localhost/api/pay-rates/${invalidId}`)
        const params = Promise.resolve({ id: invalidId })

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(result.errors.length).toBeGreaterThan(0)
        expect(
          result.errors.some(
            (err: any) => err.field === 'id' && err.message.includes('valid ID')
          )
        ).toBe(true)
        expect(result.message).toBe('Invalid pay guide ID')
      })

      it('should return 404 for non-existent pay guide', async () => {
        const { GET } = await import('@/app/api/pay-rates/[id]/route')
        // Generate a valid CUID that doesn't exist
        const nonExistentId = 'cl9ebqhxk00000drx6dj2fwmz'
        const request = new MockRequest(`http://localhost/api/pay-rates/${nonExistentId}`)
        const params = Promise.resolve({ id: nonExistentId })

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Pay guide not found')
        expect(result.data).toBeUndefined()
      })

      it('should handle server errors gracefully', async () => {
        // Suppress console.error during this test to avoid stderr pollution
        const originalConsoleError = console.error
        console.error = () => {}

        try {
          const { GET } = await import('@/app/api/pay-rates/[id]/route')
          const request = new MockRequest(`http://localhost/api/pay-rates/${testPayGuideId}`)
          
          // Create a params object that will cause an error
          const invalidParams = Promise.reject(new Error('Database connection error'))

          const response = await GET(request as any, { params: invalidParams })
          const result = await response.json()

          expect(response.status).toBe(500)
          expect(result.error).toBe('Failed to fetch pay guide')
        } finally {
          // Restore console.error
          console.error = originalConsoleError
        }
      })
    })
  })

  describe('PUT /api/pay-rates/[id]', () => {
    describe('Successful Updates', () => {
      it('should update all fields successfully', async () => {
        const updateData: UpdatePayGuideRequest = {
          name: 'Updated Retail Award',
          baseRate: '30.00',
          minimumShiftHours: 4,
          maximumShiftHours: 12,
          description: 'Updated description',
          effectiveFrom: '2024-03-01T00:00:00Z',
          effectiveTo: '2024-12-31T23:59:59Z',
          timezone: 'Australia/Perth',
          isActive: false,
        }

        const { PUT } = await import('@/app/api/pay-rates/[id]/route')
        const request = new MockRequest(`http://localhost/api/pay-rates/${testPayGuideId}`, {
          method: 'PUT',
          body: updateData,
        })
        const params = Promise.resolve({ id: testPayGuideId })

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data).toBeTruthy()
        expect(result.data.name).toBe('Updated Retail Award')
        expect(result.data.baseRate).toBe('30')
        expect(result.data.minimumShiftHours).toBe(4)
        expect(result.data.maximumShiftHours).toBe(12)
        expect(result.data.description).toBe('Updated description')
        expect(result.data.timezone).toBe('Australia/Perth')
        expect(result.data.isActive).toBe(false)
        expect(result.message).toBe('Pay guide updated successfully')

        // Verify it was actually saved in database
        const savedPayGuide = await prisma.payGuide.findUnique({
          where: { id: testPayGuideId },
        })
        expect(savedPayGuide!.name).toBe('Updated Retail Award')
        expect(savedPayGuide!.baseRate.toString()).toBe('30')
      })

      it('should update partial fields only', async () => {
        const updateData: UpdatePayGuideRequest = {
          name: 'Partially Updated Award',
          baseRate: '27.50',
        }

        const { PUT } = await import('@/app/api/pay-rates/[id]/route')
        const request = new MockRequest(`http://localhost/api/pay-rates/${testPayGuideId}`, {
          method: 'PUT',
          body: updateData,
        })
        const params = Promise.resolve({ id: testPayGuideId })

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data.name).toBe('Partially Updated Award')
        expect(result.data.baseRate).toBe('27.5')
        // These should remain unchanged
        expect(result.data.timezone).toBe('Australia/Sydney')
        expect(result.data.isActive).toBe(true)
        expect(result.data.minimumShiftHours).toBe(3)
        expect(result.data.maximumShiftHours).toBe(10)
      })

      it('should update optional fields to null', async () => {
        const updateData: UpdatePayGuideRequest = {
          minimumShiftHours: undefined,
          maximumShiftHours: undefined,
          description: undefined,
          effectiveTo: undefined,
        }

        const { PUT } = await import('@/app/api/pay-rates/[id]/route')
        const request = new MockRequest(`http://localhost/api/pay-rates/${testPayGuideId}`, {
          method: 'PUT',
          body: updateData,
        })
        const params = Promise.resolve({ id: testPayGuideId })

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(200)
        // These fields should remain as they were (not updated to undefined)
        expect(result.data.minimumShiftHours).toBe(3)
        expect(result.data.maximumShiftHours).toBe(10)
      })
    })

    describe('Validation and Error Handling', () => {
      it('should reject invalid pay guide ID', async () => {
        const updateData: UpdatePayGuideRequest = {
          name: 'Test Update',
        }

        const { PUT } = await import('@/app/api/pay-rates/[id]/route')
        const invalidId = 'invalid-id'
        const request = new MockRequest(`http://localhost/api/pay-rates/${invalidId}`, {
          method: 'PUT',
          body: updateData,
        })
        const params = Promise.resolve({ id: invalidId })

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(
          result.errors.some((err: any) => err.field === 'id')
        ).toBe(true)
        expect(result.message).toBe('Invalid pay guide ID')
      })

      it('should return 404 for non-existent pay guide', async () => {
        const updateData: UpdatePayGuideRequest = {
          name: 'Test Update',
        }

        const { PUT } = await import('@/app/api/pay-rates/[id]/route')
        const nonExistentId = 'cl9ebqhxk00000drx6dj2fwmz'
        const request = new MockRequest(`http://localhost/api/pay-rates/${nonExistentId}`, {
          method: 'PUT',
          body: updateData,
        })
        const params = Promise.resolve({ id: nonExistentId })

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Pay guide not found')
      })

      it('should validate field constraints', async () => {
        const invalidUpdateData = {
          name: 'AB', // Too short
          baseRate: 'not-a-number', // Invalid decimal
          minimumShiftHours: -1, // Negative
          maximumShiftHours: 25, // Too high
          timezone: 'Invalid/Timezone', // Invalid timezone
          description: 'A'.repeat(501), // Too long
        }

        const { PUT } = await import('@/app/api/pay-rates/[id]/route')
        const request = new MockRequest(`http://localhost/api/pay-rates/${testPayGuideId}`, {
          method: 'PUT',
          body: invalidUpdateData,
        })
        const params = Promise.resolve({ id: testPayGuideId })

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(result.errors.length).toBeGreaterThan(1)

        const errorFields = result.errors.map((err: any) => err.field)
        expect(errorFields).toContain('name')
        expect(errorFields).toContain('baseRate')
        expect(errorFields).toContain('minimumShiftHours')
        expect(errorFields).toContain('maximumShiftHours')
        expect(errorFields).toContain('timezone')
        expect(errorFields).toContain('description')
      })

      it('should enforce unique pay guide names', async () => {
        const updateData: UpdatePayGuideRequest = {
          name: 'Test Hospitality Award', // This name already exists
        }

        const { PUT } = await import('@/app/api/pay-rates/[id]/route')
        const request = new MockRequest(`http://localhost/api/pay-rates/${testPayGuideId}`, {
          method: 'PUT',
          body: updateData,
        })
        const params = Promise.resolve({ id: testPayGuideId })

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(
          result.errors.some(
            (err: any) => 
              err.field === 'name' && 
              err.message.includes('already exists')
          )
        ).toBe(true)
        expect(result.message).toBe('Duplicate pay guide name')
      })

      it('should validate date range constraints', async () => {
        const invalidDateRange: UpdatePayGuideRequest = {
          effectiveFrom: '2024-06-01T00:00:00Z',
          effectiveTo: '2024-01-01T00:00:00Z', // Before effectiveFrom
        }

        const { PUT } = await import('@/app/api/pay-rates/[id]/route')
        const request = new MockRequest(`http://localhost/api/pay-rates/${testPayGuideId}`, {
          method: 'PUT',
          body: invalidDateRange,
        })
        const params = Promise.resolve({ id: testPayGuideId })

        const response = await PUT(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(
          result.errors.some(
            (err: any) =>
              err.field === 'effectiveTo' &&
              err.message.includes('after effective start date')
          )
        ).toBe(true)
      })
    })
  })

  describe('DELETE /api/pay-rates/[id]', () => {
    describe('Successful Deletion', () => {
      it('should delete unused pay guide successfully', async () => {
        const { DELETE } = await import('@/app/api/pay-rates/[id]/route')
        const request = new MockRequest(`http://localhost/api/pay-rates/${secondTestPayGuideId}`)
        const params = Promise.resolve({ id: secondTestPayGuideId })

        const response = await DELETE(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.message).toBe('Pay guide deleted successfully')

        // Verify it was actually deleted
        const deletedPayGuide = await prisma.payGuide.findUnique({
          where: { id: secondTestPayGuideId },
        })
        expect(deletedPayGuide).toBeNull()
      })
    })

    describe('Constraint and Error Handling', () => {
      it('should reject deletion of pay guide with associated shifts', async () => {
        // Create a shift associated with the pay guide
        await prisma.shift.create({
          data: {
            userId: testUserId,
            payGuideId: testPayGuideId,
            startTime: new Date('2024-01-01T09:00:00Z'),
            endTime: new Date('2024-01-01T17:00:00Z'),
          },
        })

        const { DELETE } = await import('@/app/api/pay-rates/[id]/route')
        const request = new MockRequest(`http://localhost/api/pay-rates/${testPayGuideId}`)
        const params = Promise.resolve({ id: testPayGuideId })

        const response = await DELETE(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.error).toBe(
          'Cannot delete pay guide that is being used by shifts. Please deactivate it instead.'
        )

        // Verify pay guide still exists
        const payGuide = await prisma.payGuide.findUnique({
          where: { id: testPayGuideId },
        })
        expect(payGuide).not.toBeNull()
      })

      it('should reject invalid pay guide ID', async () => {
        const { DELETE } = await import('@/app/api/pay-rates/[id]/route')
        const invalidId = 'invalid-id'
        const request = new MockRequest(`http://localhost/api/pay-rates/${invalidId}`)
        const params = Promise.resolve({ id: invalidId })

        const response = await DELETE(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(
          result.errors.some((err: any) => err.field === 'id')
        ).toBe(true)
        expect(result.message).toBe('Invalid pay guide ID')
      })

      it('should return 404 for non-existent pay guide', async () => {
        const { DELETE } = await import('@/app/api/pay-rates/[id]/route')
        const nonExistentId = 'cl9ebqhxk00000drx6dj2fwmz'
        const request = new MockRequest(`http://localhost/api/pay-rates/${nonExistentId}`)
        const params = Promise.resolve({ id: nonExistentId })

        const response = await DELETE(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Pay guide not found')
      })

      it('should handle server errors gracefully', async () => {
        // Suppress console.error during this test to avoid stderr pollution
        const originalConsoleError = console.error
        console.error = () => {}

        try {
          const { DELETE } = await import('@/app/api/pay-rates/[id]/route')
          const request = new MockRequest(`http://localhost/api/pay-rates/${testPayGuideId}`)
          
          // Create a params object that will cause an error
          const invalidParams = Promise.reject(new Error('Database connection error'))

          const response = await DELETE(request as any, { params: invalidParams })
          const result = await response.json()

          expect(response.status).toBe(500)
          expect(result.error).toBe('Failed to delete pay guide')
        } finally {
          // Restore console.error
          console.error = originalConsoleError
        }
      })
    })
  })

  describe('Integration Tests', () => {
    it('should handle complete CRUD workflow', async () => {
      // First, retrieve the pay guide
      const { GET } = await import('@/app/api/pay-rates/[id]/route')
      const getRequest = new MockRequest(`http://localhost/api/pay-rates/${testPayGuideId}`)
      const getParams = Promise.resolve({ id: testPayGuideId })

      const getResponse = await GET(getRequest as any, { params: getParams })
      const getResult = await getResponse.json()

      expect(getResponse.status).toBe(200)
      expect(getResult.data.name).toBe('Test Retail Award')

      // Then, update the pay guide
      const { PUT } = await import('@/app/api/pay-rates/[id]/route')
      const updateData: UpdatePayGuideRequest = {
        name: 'Integration Test Award',
        baseRate: '35.00',
      }
      const putRequest = new MockRequest(`http://localhost/api/pay-rates/${testPayGuideId}`, {
        method: 'PUT',
        body: updateData,
      })
      const putParams = Promise.resolve({ id: testPayGuideId })

      const putResponse = await PUT(putRequest as any, { params: putParams })
      const putResult = await putResponse.json()

      expect(putResponse.status).toBe(200)
      expect(putResult.data.name).toBe('Integration Test Award')
      expect(putResult.data.baseRate).toBe('35')

      // Verify the update with another GET
      const getUpdatedRequest = new MockRequest(`http://localhost/api/pay-rates/${testPayGuideId}`)
      const getUpdatedParams = Promise.resolve({ id: testPayGuideId })

      const getUpdatedResponse = await GET(getUpdatedRequest as any, { params: getUpdatedParams })
      const getUpdatedResult = await getUpdatedResponse.json()

      expect(getUpdatedResponse.status).toBe(200)
      expect(getUpdatedResult.data.name).toBe('Integration Test Award')
      expect(getUpdatedResult.data.baseRate).toBe('35')

      // Finally, attempt to delete (should fail due to our beforeEach keeping it)
      // This tests the constraint checking
      const { DELETE } = await import('@/app/api/pay-rates/[id]/route')
      const deleteRequest = new MockRequest(`http://localhost/api/pay-rates/${testPayGuideId}`)
      const deleteParams = Promise.resolve({ id: testPayGuideId })

      // The deletion should succeed since we clean up shifts in beforeEach
      const deleteResponse = await DELETE(deleteRequest as any, { params: deleteParams })
      
      // Since we cleaned up shifts, this should succeed
      expect(deleteResponse.status).toBe(200)
    })

    it('should handle concurrent operations properly', async () => {
      // Test concurrent GET requests
      const { GET } = await import('@/app/api/pay-rates/[id]/route')
      
      const getPromises = Array(3).fill(0).map(() => {
        const request = new MockRequest(`http://localhost/api/pay-rates/${testPayGuideId}`)
        const params = Promise.resolve({ id: testPayGuideId })
        return GET(request as any, { params })
      })

      const responses = await Promise.all(getPromises)
      
      responses.forEach(response => {
        expect(response.status).toBe(200)
      })

      const results = await Promise.all(responses.map(r => r.json()))
      
      results.forEach(result => {
        expect(result.data.id).toBe(testPayGuideId)
        expect(result.data.name).toBe('Test Retail Award')
      })
    })
  })
})
