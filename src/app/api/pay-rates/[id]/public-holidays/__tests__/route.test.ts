/**
 * Public Holidays Route Tests
 *
 * Tests for the /api/pay-rates/[id]/public-holidays endpoint
 * covering GET and POST operations with validation and error handling.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'
import { Decimal } from 'decimal.js'
import {
  CreatePublicHolidayRequest,
  PublicHolidayResponse,
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
      url: 'file:./public-holidays-test.db',
    },
  },
})

describe('Public Holidays Route API', () => {
  let testPayGuideId: string

  beforeAll(async () => {
    // Set up test database
    process.env.DATABASE_URL = 'file:./public-holidays-test.db'
    execSync('npx prisma migrate dev --name init', { stdio: 'pipe' })

    // Clean any existing data first (order matters due to foreign keys)
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
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    // Clean up public holidays before each test
    await prisma.publicHoliday.deleteMany()
  })

  describe('GET /api/pay-rates/[id]/public-holidays', () => {
    describe('Successful Retrieval', () => {
      it('should retrieve empty list when no public holidays exist', async () => {
        const { GET } = await import('@/app/api/pay-rates/[id]/public-holidays/route')
        const request = new MockRequest(`http://localhost/api/pay-rates/${testPayGuideId}/public-holidays`)
        const params = Promise.resolve({ id: testPayGuideId })

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data).toEqual([])
        expect(result.message).toBe('Found 0 public holidays')
      })

      it('should retrieve existing public holidays ordered by date', async () => {
        // Create test public holidays
        await prisma.publicHoliday.create({
          data: {
            payGuideId: testPayGuideId,
            name: 'Christmas Day',
            date: new Date('2024-12-25'),
            isActive: true,
          },
        })

        await prisma.publicHoliday.create({
          data: {
            payGuideId: testPayGuideId,
            name: 'New Year\'s Day',
            date: new Date('2024-01-01'),
            isActive: true,
          },
        })

        await prisma.publicHoliday.create({
          data: {
            payGuideId: testPayGuideId,
            name: 'Boxing Day',
            date: new Date('2024-12-26'),
            isActive: false,
          },
        })

        const { GET } = await import('@/app/api/pay-rates/[id]/public-holidays/route')
        const request = new MockRequest(`http://localhost/api/pay-rates/${testPayGuideId}/public-holidays`)
        const params = Promise.resolve({ id: testPayGuideId })

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data).toHaveLength(3)
        expect(result.message).toBe('Found 3 public holidays')
        
        // Should be ordered by date (ascending)
        const dates = result.data.map((ph: PublicHolidayResponse) => new Date(ph.date))
        expect(dates[0] < dates[1]).toBe(true) // New Year's Day before Christmas
        expect(dates[1] < dates[2]).toBe(true) // Christmas before Boxing Day
        
        const newYearsDay = result.data.find((ph: PublicHolidayResponse) => ph.name === 'New Year\'s Day')
        expect(newYearsDay).toBeTruthy()
        expect(newYearsDay.date).toBe('2024-01-01T00:00:00.000Z')
        expect(newYearsDay.isActive).toBe(true)
        
        const boxingDay = result.data.find((ph: PublicHolidayResponse) => ph.name === 'Boxing Day')
        expect(boxingDay).toBeTruthy()
        expect(boxingDay.isActive).toBe(false)
      })
    })

    describe('Validation and Error Handling', () => {
      it('should reject invalid pay guide ID', async () => {
        const { GET } = await import('@/app/api/pay-rates/[id]/public-holidays/route')
        const invalidId = 'invalid-id'
        const request = new MockRequest(`http://localhost/api/pay-rates/${invalidId}/public-holidays`)
        const params = Promise.resolve({ id: invalidId })

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(result.message).toBe('Invalid pay guide ID')
      })

      it('should return 404 for non-existent pay guide', async () => {
        const { GET } = await import('@/app/api/pay-rates/[id]/public-holidays/route')
        const nonExistentId = 'cl9ebqhxk00000drx6dj2fwmz'
        const request = new MockRequest(`http://localhost/api/pay-rates/${nonExistentId}/public-holidays`)
        const params = Promise.resolve({ id: nonExistentId })

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Pay guide not found')
      })
    })
  })

  describe('POST /api/pay-rates/[id]/public-holidays', () => {
    describe('Successful Creation', () => {
      it('should create public holiday with all fields', async () => {
        const holidayData: CreatePublicHolidayRequest = {
          name: 'Australia Day',
          date: '2024-01-26T00:00:00.000Z',
          isActive: true,
        }

        const { POST } = await import('@/app/api/pay-rates/[id]/public-holidays/route')
        const request = new MockRequest(`http://localhost/api/pay-rates/${testPayGuideId}/public-holidays`, {
          method: 'POST',
          body: holidayData,
        })
        const params = Promise.resolve({ id: testPayGuideId })

        const response = await POST(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(201)
        expect(result.data).toBeTruthy()
        expect(result.data.name).toBe('Australia Day')
        expect(result.data.date).toBe('2024-01-26T00:00:00.000Z')
        expect(result.data.isActive).toBe(true)
        expect(result.data.payGuideId).toBe(testPayGuideId)
        expect(result.message).toBe('Public holiday created successfully')

        // Verify it was saved to database
        const saved = await prisma.publicHoliday.findFirst({
          where: { name: 'Australia Day' }
        })
        expect(saved).toBeTruthy()
        expect(saved!.date).toEqual(new Date('2024-01-26T00:00:00.000Z'))
      })

      it('should create public holiday with minimal fields', async () => {
        const holidayData: CreatePublicHolidayRequest = {
          name: 'Labour Day',
          date: '2024-05-06T00:00:00.000Z',
        }

        const { POST } = await import('@/app/api/pay-rates/[id]/public-holidays/route')
        const request = new MockRequest(`http://localhost/api/pay-rates/${testPayGuideId}/public-holidays`, {
          method: 'POST',
          body: holidayData,
        })
        const params = Promise.resolve({ id: testPayGuideId })

        const response = await POST(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(201)
        expect(result.data.name).toBe('Labour Day')
        expect(result.data.date).toBe('2024-05-06T00:00:00.000Z')
        expect(result.data.isActive).toBe(true) // Default value
      })
    })

    describe('Validation and Error Handling', () => {
      it('should reject invalid pay guide ID', async () => {
        const holidayData: CreatePublicHolidayRequest = {
          name: 'Test Holiday',
          date: '2024-01-01T00:00:00.000Z',
        }

        const { POST } = await import('@/app/api/pay-rates/[id]/public-holidays/route')
        const invalidId = 'invalid-id'
        const request = new MockRequest(`http://localhost/api/pay-rates/${invalidId}/public-holidays`, {
          method: 'POST',
          body: holidayData,
        })
        const params = Promise.resolve({ id: invalidId })

        const response = await POST(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.message).toBe('Invalid pay guide ID')
      })

      it('should return 404 for non-existent pay guide', async () => {
        const holidayData: CreatePublicHolidayRequest = {
          name: 'Test Holiday',
          date: '2024-01-01T00:00:00.000Z',
        }

        const { POST } = await import('@/app/api/pay-rates/[id]/public-holidays/route')
        const nonExistentId = 'cl9ebqhxk00000drx6dj2fwmz'
        const request = new MockRequest(`http://localhost/api/pay-rates/${nonExistentId}/public-holidays`, {
          method: 'POST',
          body: holidayData,
        })
        const params = Promise.resolve({ id: nonExistentId })

        const response = await POST(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Pay guide not found')
      })

      it('should validate required fields', async () => {
        const invalidData = {
          // Missing name and date
          isActive: true,
        }

        const { POST } = await import('@/app/api/pay-rates/[id]/public-holidays/route')
        const request = new MockRequest(`http://localhost/api/pay-rates/${testPayGuideId}/public-holidays`, {
          method: 'POST',
          body: invalidData,
        })
        const params = Promise.resolve({ id: testPayGuideId })

        const response = await POST(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(result.message).toBe('Invalid public holiday data')

        const errorFields = result.errors.map((err: any) => err.field)
        expect(errorFields).toContain('name')
        expect(errorFields).toContain('date')
      })

      it('should validate field constraints', async () => {
        const invalidData = {
          name: 'A', // Too short
          date: 'invalid-date', // Invalid date format
        }

        const { POST } = await import('@/app/api/pay-rates/[id]/public-holidays/route')
        const request = new MockRequest(`http://localhost/api/pay-rates/${testPayGuideId}/public-holidays`, {
          method: 'POST',
          body: invalidData,
        })
        const params = Promise.resolve({ id: testPayGuideId })

        const response = await POST(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(result.errors.length).toBeGreaterThan(1)

        const errorFields = result.errors.map((err: any) => err.field)
        expect(errorFields).toContain('name')
        expect(errorFields).toContain('date')
      })

      it('should prevent duplicate holidays on same date for same pay guide', async () => {
        // First, create a holiday
        await prisma.publicHoliday.create({
          data: {
            payGuideId: testPayGuideId,
            name: 'Christmas Day',
            date: new Date('2024-12-25'),
            isActive: true,
          },
        })

        // Try to create another holiday on the same date
        const duplicateData: CreatePublicHolidayRequest = {
          name: 'Christmas Holiday', // Different name, same date
          date: '2024-12-25T00:00:00.000Z',
        }

        const { POST } = await import('@/app/api/pay-rates/[id]/public-holidays/route')
        const request = new MockRequest(`http://localhost/api/pay-rates/${testPayGuideId}/public-holidays`, {
          method: 'POST',
          body: duplicateData,
        })
        const params = Promise.resolve({ id: testPayGuideId })

        const response = await POST(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(result.message).toBe('Duplicate public holiday')
        
        const dateError = result.errors.find((err: any) => err.field === 'date')
        expect(dateError).toBeTruthy()
        expect(dateError.message).toBe('A public holiday already exists for this date on this pay guide')
      })
    })
  })
})