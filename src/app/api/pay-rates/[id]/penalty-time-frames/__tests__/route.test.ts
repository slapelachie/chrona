/**
 * Penalty Time Frames Route Tests
 *
 * Tests for the /api/pay-rates/[id]/penalty-time-frames endpoint
 * covering GET and POST operations with validation and error handling.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'
import { Decimal } from 'decimal.js'
import {
  CreatePenaltyTimeFrameRequest,
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
      url: 'file:./penalty-time-frames-test.db',
    },
  },
})

describe('Penalty Time Frames Route API', () => {
  let testPayGuideId: string

  beforeAll(async () => {
    // Set up test database
    process.env.DATABASE_URL = 'file:./penalty-time-frames-test.db'
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
    // Clean up penalty time frames before each test
    await prisma.penaltyTimeFrame.deleteMany()
  })

  describe('GET /api/pay-rates/[id]/penalty-time-frames', () => {
    describe('Successful Retrieval', () => {
      it('should retrieve empty list when no penalty time frames exist', async () => {
        const { GET } = await import('@/app/api/pay-rates/[id]/penalty-time-frames/route')
        const request = new MockRequest(`http://localhost/api/pay-rates/${testPayGuideId}/penalty-time-frames`)
        const params = Promise.resolve({ id: testPayGuideId })

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data).toEqual([])
        expect(result.message).toBe('Found 0 penalty time frames')
      })

      it('should retrieve existing penalty time frames', async () => {
        // Create test penalty time frames
        await prisma.penaltyTimeFrame.create({
          data: {
            payGuideId: testPayGuideId,
            name: 'Evening Penalty',
            multiplier: new Decimal('1.25'),
            startTime: '18:00',
            endTime: '22:00',
            isActive: true,
          },
        })

        await prisma.penaltyTimeFrame.create({
          data: {
            payGuideId: testPayGuideId,
            name: 'Weekend Penalty',
            multiplier: new Decimal('1.5'),
            dayOfWeek: 0, // Sunday
            isActive: true,
          },
        })

        const { GET } = await import('@/app/api/pay-rates/[id]/penalty-time-frames/route')
        const request = new MockRequest(`http://localhost/api/pay-rates/${testPayGuideId}/penalty-time-frames`)
        const params = Promise.resolve({ id: testPayGuideId })

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data).toHaveLength(2)
        expect(result.message).toBe('Found 2 penalty time frames')
        
        const eveningPenalty = result.data.find((ptf: PenaltyTimeFrameResponse) => ptf.name === 'Evening Penalty')
        expect(eveningPenalty).toBeTruthy()
        expect(eveningPenalty.multiplier).toBe('1.25')
        expect(eveningPenalty.startTime).toBe('18:00')
        expect(eveningPenalty.endTime).toBe('22:00')
        
        const weekendPenalty = result.data.find((ptf: PenaltyTimeFrameResponse) => ptf.name === 'Weekend Penalty')
        expect(weekendPenalty).toBeTruthy()
        expect(weekendPenalty.multiplier).toBe('1.5')
        expect(weekendPenalty.dayOfWeek).toBe(0)
      })
    })

    describe('Validation and Error Handling', () => {
      it('should reject invalid pay guide ID', async () => {
        const { GET } = await import('@/app/api/pay-rates/[id]/penalty-time-frames/route')
        const invalidId = 'invalid-id'
        const request = new MockRequest(`http://localhost/api/pay-rates/${invalidId}/penalty-time-frames`)
        const params = Promise.resolve({ id: invalidId })

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(result.message).toBe('Invalid pay guide ID')
      })

      it('should return 404 for non-existent pay guide', async () => {
        const { GET } = await import('@/app/api/pay-rates/[id]/penalty-time-frames/route')
        const nonExistentId = 'cl9ebqhxk00000drx6dj2fwmz'
        const request = new MockRequest(`http://localhost/api/pay-rates/${nonExistentId}/penalty-time-frames`)
        const params = Promise.resolve({ id: nonExistentId })

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Pay guide not found')
      })
    })
  })

  describe('POST /api/pay-rates/[id]/penalty-time-frames', () => {
    describe('Successful Creation', () => {
      it('should create penalty time frame with all fields', async () => {
        const penaltyData: CreatePenaltyTimeFrameRequest = {
          name: 'Night Penalty',
          multiplier: '1.75',
          dayOfWeek: 1, // Monday
          startTime: '22:00',
          endTime: '06:00',
          description: 'Night shift penalty rate',
          isActive: true,
        }

        const { POST } = await import('@/app/api/pay-rates/[id]/penalty-time-frames/route')
        const request = new MockRequest(`http://localhost/api/pay-rates/${testPayGuideId}/penalty-time-frames`, {
          method: 'POST',
          body: penaltyData,
        })
        const params = Promise.resolve({ id: testPayGuideId })

        const response = await POST(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(201)
        expect(result.data).toBeTruthy()
        expect(result.data.name).toBe('Night Penalty')
        expect(result.data.multiplier).toBe('1.75')
        expect(result.data.dayOfWeek).toBe(1)
        expect(result.data.startTime).toBe('22:00')
        expect(result.data.endTime).toBe('06:00')
        expect(result.data.description).toBe('Night shift penalty rate')
        expect(result.data.isActive).toBe(true)
        expect(result.data.payGuideId).toBe(testPayGuideId)
        expect(result.message).toBe('Penalty time frame created successfully')

        // Verify it was saved to database
        const saved = await prisma.penaltyTimeFrame.findFirst({
          where: { name: 'Night Penalty' }
        })
        expect(saved).toBeTruthy()
        expect(saved!.multiplier.toString()).toBe('1.75')
      })

      it('should create penalty time frame with minimal fields', async () => {
        const penaltyData: CreatePenaltyTimeFrameRequest = {
          name: 'Basic Penalty',
          multiplier: '1.25',
        }

        const { POST } = await import('@/app/api/pay-rates/[id]/penalty-time-frames/route')
        const request = new MockRequest(`http://localhost/api/pay-rates/${testPayGuideId}/penalty-time-frames`, {
          method: 'POST',
          body: penaltyData,
        })
        const params = Promise.resolve({ id: testPayGuideId })

        const response = await POST(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(201)
        expect(result.data.name).toBe('Basic Penalty')
        expect(result.data.multiplier).toBe('1.25')
        expect(result.data.dayOfWeek).toBeNull()
        expect(result.data.startTime).toBeNull()
        expect(result.data.endTime).toBeNull()
        expect(result.data.description).toBeNull()
        expect(result.data.isActive).toBe(true) // Default value
      })
    })

    describe('Validation and Error Handling', () => {
      it('should reject invalid pay guide ID', async () => {
        const penaltyData: CreatePenaltyTimeFrameRequest = {
          name: 'Test Penalty',
          multiplier: '1.25',
        }

        const { POST } = await import('@/app/api/pay-rates/[id]/penalty-time-frames/route')
        const invalidId = 'invalid-id'
        const request = new MockRequest(`http://localhost/api/pay-rates/${invalidId}/penalty-time-frames`, {
          method: 'POST',
          body: penaltyData,
        })
        const params = Promise.resolve({ id: invalidId })

        const response = await POST(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.message).toBe('Invalid pay guide ID')
      })

      it('should return 404 for non-existent pay guide', async () => {
        const penaltyData: CreatePenaltyTimeFrameRequest = {
          name: 'Test Penalty',
          multiplier: '1.25',
        }

        const { POST } = await import('@/app/api/pay-rates/[id]/penalty-time-frames/route')
        const nonExistentId = 'cl9ebqhxk00000drx6dj2fwmz'
        const request = new MockRequest(`http://localhost/api/pay-rates/${nonExistentId}/penalty-time-frames`, {
          method: 'POST',
          body: penaltyData,
        })
        const params = Promise.resolve({ id: nonExistentId })

        const response = await POST(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Pay guide not found')
      })

      it('should validate required fields', async () => {
        const invalidData = {
          // Missing name and multiplier
          startTime: '18:00',
        }

        const { POST } = await import('@/app/api/pay-rates/[id]/penalty-time-frames/route')
        const request = new MockRequest(`http://localhost/api/pay-rates/${testPayGuideId}/penalty-time-frames`, {
          method: 'POST',
          body: invalidData,
        })
        const params = Promise.resolve({ id: testPayGuideId })

        const response = await POST(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(result.message).toBe('Invalid penalty time frame data')

        const errorFields = result.errors.map((err: any) => err.field)
        expect(errorFields).toContain('name')
        expect(errorFields).toContain('multiplier')
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

        const { POST } = await import('@/app/api/pay-rates/[id]/penalty-time-frames/route')
        const request = new MockRequest(`http://localhost/api/pay-rates/${testPayGuideId}/penalty-time-frames`, {
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
        expect(errorFields).toContain('multiplier')
        expect(errorFields).toContain('dayOfWeek')
        expect(errorFields).toContain('startTime')
        expect(errorFields).toContain('endTime')
        expect(errorFields).toContain('description')
      })
    })
  })
})