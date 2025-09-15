/**
 * Overtime Time Frames Route Tests
 *
 * Tests for the /api/pay-rates/[id]/overtime-time-frames endpoint
 * covering GET and POST operations with validation and error handling.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { execSync } from 'child_process'
import { Decimal } from 'decimal.js'
import {
  CreateOvertimeTimeFrameRequest,
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

// Preserve original DATABASE_URL to avoid leaking into other suites
const originalDbUrl = process.env.DATABASE_URL

describe('Overtime Time Frames Route API', () => {
  let testPayGuideId: string

  beforeAll(async () => {
    // Set up isolated test database (push schema without regenerating client)
    process.env.DATABASE_URL = 'file:./overtime-time-frames-test.db'
    execSync('npx prisma db push --skip-generate', { stdio: 'pipe' })

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
    // Restore original DATABASE_URL to prevent cross-suite interference
    process.env.DATABASE_URL = originalDbUrl
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    // Clean up overtime time frames before each test
    await prisma.overtimeTimeFrame.deleteMany()
  })

  describe('GET /api/pay-rates/[id]/overtime-time-frames', () => {
    describe('Successful Retrieval', () => {
      it('should retrieve empty list when no overtime time frames exist', async () => {
        const { GET } = await import('@/app/api/pay-rates/[id]/overtime-time-frames/route')
        const request = new MockRequest(`http://localhost/api/pay-rates/${testPayGuideId}/overtime-time-frames`)
        const params = Promise.resolve({ id: testPayGuideId })

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data).toEqual([])
        expect(result.message).toBe('Found 0 overtime time frames')
      })

      it('should retrieve existing overtime time frames', async () => {
        // Create test overtime time frames
        await prisma.overtimeTimeFrame.create({
          data: {
            payGuideId: testPayGuideId,
            name: 'Daily Overtime',
            firstThreeHoursMult: new Decimal('1.5'),
            afterThreeHoursMult: new Decimal('2.0'),
            isActive: true,
          },
        })

        await prisma.overtimeTimeFrame.create({
          data: {
            payGuideId: testPayGuideId,
            name: 'Sunday Overtime',
            firstThreeHoursMult: new Decimal('1.75'),
            afterThreeHoursMult: new Decimal('2.25'),
            dayOfWeek: 0, // Sunday
            isActive: true,
          },
        })

        const { GET } = await import('@/app/api/pay-rates/[id]/overtime-time-frames/route')
        const request = new MockRequest(`http://localhost/api/pay-rates/${testPayGuideId}/overtime-time-frames`)
        const params = Promise.resolve({ id: testPayGuideId })

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data).toHaveLength(2)
        expect(result.message).toBe('Found 2 overtime time frames')
        
        const dailyOvertime = result.data.find((otf: OvertimeTimeFrameResponse) => otf.name === 'Daily Overtime')
        expect(dailyOvertime).toBeTruthy()
        expect(dailyOvertime.firstThreeHoursMult).toBe('1.5')
        expect(dailyOvertime.afterThreeHoursMult).toBe('2')
        
        const sundayOvertime = result.data.find((otf: OvertimeTimeFrameResponse) => otf.name === 'Sunday Overtime')
        expect(sundayOvertime).toBeTruthy()
        expect(sundayOvertime.firstThreeHoursMult).toBe('1.75')
        expect(sundayOvertime.afterThreeHoursMult).toBe('2.25')
        expect(sundayOvertime.dayOfWeek).toBe(0)
      })
    })

    describe('Validation and Error Handling', () => {
      it('should reject invalid pay guide ID', async () => {
        const { GET } = await import('@/app/api/pay-rates/[id]/overtime-time-frames/route')
        const invalidId = 'invalid-id'
        const request = new MockRequest(`http://localhost/api/pay-rates/${invalidId}/overtime-time-frames`)
        const params = Promise.resolve({ id: invalidId })

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(result.message).toBe('Invalid pay guide ID')
      })

      it('should return 404 for non-existent pay guide', async () => {
        const { GET } = await import('@/app/api/pay-rates/[id]/overtime-time-frames/route')
        const nonExistentId = 'cl9ebqhxk00000drx6dj2fwmz'
        const request = new MockRequest(`http://localhost/api/pay-rates/${nonExistentId}/overtime-time-frames`)
        const params = Promise.resolve({ id: nonExistentId })

        const response = await GET(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Pay guide not found')
      })
    })
  })

  describe('POST /api/pay-rates/[id]/overtime-time-frames', () => {
    describe('Successful Creation', () => {
      it('should create overtime time frame with all fields', async () => {
        const overtimeData: CreateOvertimeTimeFrameRequest = {
          name: 'Night Overtime',
          firstThreeHoursMult: '1.75',
          afterThreeHoursMult: '2.5',
          dayOfWeek: 1, // Monday
          startTime: '22:00',
          endTime: '06:00',
          description: 'Night shift overtime rates',
          isActive: true,
        }

        const { POST } = await import('@/app/api/pay-rates/[id]/overtime-time-frames/route')
        const request = new MockRequest(`http://localhost/api/pay-rates/${testPayGuideId}/overtime-time-frames`, {
          method: 'POST',
          body: overtimeData,
        })
        const params = Promise.resolve({ id: testPayGuideId })

        const response = await POST(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(201)
        expect(result.data).toBeTruthy()
        expect(result.data.name).toBe('Night Overtime')
        expect(result.data.firstThreeHoursMult).toBe('1.75')
        expect(result.data.afterThreeHoursMult).toBe('2.5')
        expect(result.data.dayOfWeek).toBe(1)
        expect(result.data.startTime).toBe('22:00')
        expect(result.data.endTime).toBe('06:00')
        expect(result.data.description).toBe('Night shift overtime rates')
        expect(result.data.isActive).toBe(true)
        expect(result.data.payGuideId).toBe(testPayGuideId)
        expect(result.message).toBe('Overtime time frame created successfully')

        // Verify it was saved to database
        const saved = await prisma.overtimeTimeFrame.findFirst({
          where: { name: 'Night Overtime' }
        })
        expect(saved).toBeTruthy()
        expect(saved!.firstThreeHoursMult.toString()).toBe('1.75')
        expect(saved!.afterThreeHoursMult.toString()).toBe('2.5')
      })

      it('should create overtime time frame with minimal fields', async () => {
        const overtimeData: CreateOvertimeTimeFrameRequest = {
          name: 'Basic Overtime',
          firstThreeHoursMult: '1.5',
          afterThreeHoursMult: '2.0',
        }

        const { POST } = await import('@/app/api/pay-rates/[id]/overtime-time-frames/route')
        const request = new MockRequest(`http://localhost/api/pay-rates/${testPayGuideId}/overtime-time-frames`, {
          method: 'POST',
          body: overtimeData,
        })
        const params = Promise.resolve({ id: testPayGuideId })

        const response = await POST(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(201)
        expect(result.data.name).toBe('Basic Overtime')
        expect(result.data.firstThreeHoursMult).toBe('1.5')
        expect(result.data.afterThreeHoursMult).toBe('2')
        expect(result.data.dayOfWeek).toBeNull()
        expect(result.data.startTime).toBeNull()
        expect(result.data.endTime).toBeNull()
        expect(result.data.description).toBeNull()
        expect(result.data.isActive).toBe(true) // Default value
      })
    })

    describe('Validation and Error Handling', () => {
      it('should reject invalid pay guide ID', async () => {
        const overtimeData: CreateOvertimeTimeFrameRequest = {
          name: 'Test Overtime',
          firstThreeHoursMult: '1.5',
          afterThreeHoursMult: '2.0',
        }

        const { POST } = await import('@/app/api/pay-rates/[id]/overtime-time-frames/route')
        const invalidId = 'invalid-id'
        const request = new MockRequest(`http://localhost/api/pay-rates/${invalidId}/overtime-time-frames`, {
          method: 'POST',
          body: overtimeData,
        })
        const params = Promise.resolve({ id: invalidId })

        const response = await POST(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.message).toBe('Invalid pay guide ID')
      })

      it('should return 404 for non-existent pay guide', async () => {
        const overtimeData: CreateOvertimeTimeFrameRequest = {
          name: 'Test Overtime',
          firstThreeHoursMult: '1.5',
          afterThreeHoursMult: '2.0',
        }

        const { POST } = await import('@/app/api/pay-rates/[id]/overtime-time-frames/route')
        const nonExistentId = 'cl9ebqhxk00000drx6dj2fwmz'
        const request = new MockRequest(`http://localhost/api/pay-rates/${nonExistentId}/overtime-time-frames`, {
          method: 'POST',
          body: overtimeData,
        })
        const params = Promise.resolve({ id: nonExistentId })

        const response = await POST(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Pay guide not found')
      })

      it('should validate required fields', async () => {
        const invalidData = {
          // Missing name, firstThreeHoursMult, and afterThreeHoursMult
          startTime: '18:00',
        }

        const { POST } = await import('@/app/api/pay-rates/[id]/overtime-time-frames/route')
        const request = new MockRequest(`http://localhost/api/pay-rates/${testPayGuideId}/overtime-time-frames`, {
          method: 'POST',
          body: invalidData,
        })
        const params = Promise.resolve({ id: testPayGuideId })

        const response = await POST(request as any, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(result.message).toBe('Invalid overtime time frame data')

        const errorFields = result.errors.map((err: any) => err.field)
        expect(errorFields).toContain('name')
        expect(errorFields).toContain('firstThreeHoursMult')
        expect(errorFields).toContain('afterThreeHoursMult')
      })

      it('should validate field constraints', async () => {
        const invalidData = {
          name: 'A', // Too short
          firstThreeHoursMult: '0.5', // Too low
          afterThreeHoursMult: '0.25', // Too low and less than first
          dayOfWeek: 7, // Invalid (should be 0-6)
          startTime: '25:00', // Invalid time
          endTime: 'invalid-time', // Invalid format
          description: 'A'.repeat(501), // Too long
        }

        const { POST } = await import('@/app/api/pay-rates/[id]/overtime-time-frames/route')
        const request = new MockRequest(`http://localhost/api/pay-rates/${testPayGuideId}/overtime-time-frames`, {
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
        expect(errorFields).toContain('firstThreeHoursMult')
        expect(errorFields).toContain('afterThreeHoursMult')
        expect(errorFields).toContain('dayOfWeek')
        expect(errorFields).toContain('startTime')
        expect(errorFields).toContain('endTime')
        expect(errorFields).toContain('description')
      })
    })
  })
})
