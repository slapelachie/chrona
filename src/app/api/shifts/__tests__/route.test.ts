/**
 * Main Shifts Route Tests
 *
 * Tests for the /api/shifts endpoint covering GET and POST operations
 * with pay calculation integration, validation, and error handling.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'
import { Decimal } from 'decimal.js'
import {
  CreateShiftRequest,
  ShiftResponse,
  ShiftsListResponse,
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
      url: 'file:./shifts-route-test.db',
    },
  },
})

describe('Shifts Route API', () => {
  let testUserId: string
  let testPayGuideId: string

  beforeAll(async () => {
    // Set up test database
    process.env.DATABASE_URL = 'file:./shifts-route-test.db'
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
    // Clean up shifts and break periods before each test
    await prisma.breakPeriod.deleteMany()
    await prisma.shift.deleteMany()
  })

  describe('GET /api/shifts', () => {
    describe('Successful Retrieval', () => {
      it('should retrieve empty list when no shifts exist', async () => {
        const { GET } = await import('@/app/api/shifts/route')
        const request = new MockRequest('http://localhost/api/shifts')

        const response = await GET(request as any)
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data.shifts).toEqual([])
        expect(result.data.pagination.total).toBe(0)
        expect(result.data.pagination.totalPages).toBe(0)
      })

      it('should retrieve existing shifts with pagination', async () => {
        // Create test shifts
        await prisma.shift.create({
          data: {
            userId: testUserId,
            payGuideId: testPayGuideId,
            startTime: new Date('2024-01-15T09:00:00Z'),
            endTime: new Date('2024-01-15T17:00:00Z'),
            breakMinutes: 30,
            notes: 'Test shift 1',
          },
        })

        await prisma.shift.create({
          data: {
            userId: testUserId,
            payGuideId: testPayGuideId,
            startTime: new Date('2024-01-16T10:00:00Z'),
            endTime: new Date('2024-01-16T18:00:00Z'),
            breakMinutes: 60,
            notes: 'Test shift 2',
          },
        })

        const { GET } = await import('@/app/api/shifts/route')
        const request = new MockRequest('http://localhost/api/shifts')

        const response = await GET(request as any)
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data.shifts).toHaveLength(2)
        expect(result.data.pagination.total).toBe(2)
        expect(result.data.pagination.totalPages).toBe(1)

        // Check that shifts include all required fields
        const shift = result.data.shifts[0]
        expect(shift.id).toBeTruthy()
        expect(shift.userId).toBe(testUserId)
        expect(shift.payGuideId).toBe(testPayGuideId)
        expect(shift.breakPeriods).toEqual([]) // Empty array since no break periods
        expect(shift.payGuide).toBeTruthy()
        expect(shift.payGuide.baseRate).toBe('25')
      })

      it('should handle pagination correctly', async () => {
        // Create 5 test shifts
        for (let i = 0; i < 5; i++) {
          await prisma.shift.create({
            data: {
              userId: testUserId,
              payGuideId: testPayGuideId,
              startTime: new Date(`2024-01-${15 + i}T09:00:00Z`),
              endTime: new Date(`2024-01-${15 + i}T17:00:00Z`),
              breakMinutes: 30,
              notes: `Test shift ${i + 1}`,
            },
          })
        }

        const { GET } = await import('@/app/api/shifts/route')
        const request = new MockRequest('http://localhost/api/shifts?page=2&limit=2')

        const response = await GET(request as any)
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data.shifts).toHaveLength(2)
        expect(result.data.pagination.page).toBe(2)
        expect(result.data.pagination.limit).toBe(2)
        expect(result.data.pagination.total).toBe(5)
        expect(result.data.pagination.totalPages).toBe(3)
      })

      it('should handle filtering by date range', async () => {
        // Create shifts on different dates
        await prisma.shift.create({
          data: {
            userId: testUserId,
            payGuideId: testPayGuideId,
            startTime: new Date('2024-01-10T09:00:00Z'),
            endTime: new Date('2024-01-10T17:00:00Z'),
            breakMinutes: 30,
          },
        })

        await prisma.shift.create({
          data: {
            userId: testUserId,
            payGuideId: testPayGuideId,
            startTime: new Date('2024-01-20T09:00:00Z'),
            endTime: new Date('2024-01-20T17:00:00Z'),
            breakMinutes: 30,
          },
        })

        const { GET } = await import('@/app/api/shifts/route')
        const request = new MockRequest(
          'http://localhost/api/shifts?startDate=2024-01-15&endDate=2024-01-25'
        )

        const response = await GET(request as any)
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data.shifts).toHaveLength(1) // Only one shift in range
        expect(result.data.shifts[0].startTime).toContain('2024-01-20')
      })
    })

    describe('Validation and Error Handling', () => {
      it('should validate pagination parameters', async () => {
        const { GET } = await import('@/app/api/shifts/route')
        const request = new MockRequest('http://localhost/api/shifts?page=0&limit=101')

        const response = await GET(request as any)
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(result.message).toBe('Invalid query parameters')

        const errorFields = result.errors.map((err: any) => err.field)
        expect(errorFields).toContain('page')
        expect(errorFields).toContain('limit')
      })

      it('should validate sort parameters', async () => {
        const { GET } = await import('@/app/api/shifts/route')
        const request = new MockRequest('http://localhost/api/shifts?sortBy=invalid&sortOrder=invalid')

        const response = await GET(request as any)
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

  describe('POST /api/shifts', () => {
    describe('Successful Creation with Pay Calculation', () => {
      it('should create shift with valid data and calculate pay', async () => {
        const shiftData: CreateShiftRequest = {
          payGuideId: testPayGuideId,
          startTime: '2024-01-15T09:00:00Z',
          endTime: '2024-01-15T17:00:00Z',
          breakMinutes: 30,
          notes: 'Test shift with pay calculation',
        }

        const { POST } = await import('@/app/api/shifts/route')
        const request = new MockRequest('http://localhost/api/shifts', {
          method: 'POST',
          body: shiftData,
        })

        const response = await POST(request as any)
        const result = await response.json()

        expect(response.status).toBe(201)
        expect(result.data).toBeTruthy()
        expect(result.data.id).toBeTruthy()
        expect(result.data.payGuideId).toBe(testPayGuideId)
        expect(result.data.startTime).toBe('2024-01-15T09:00:00.000Z')
        expect(result.data.endTime).toBe('2024-01-15T17:00:00.000Z')
        expect(result.data.breakMinutes).toBe(30)
        expect(result.data.notes).toBe('Test shift with pay calculation')
        expect(result.data.breakPeriods).toEqual([])
        expect(result.message).toBe('Shift created successfully')

        // Check that pay calculations were performed
        expect(result.data.totalHours).toBeTruthy()
        expect(result.data.totalPay).toBeTruthy()
        expect(result.data.basePay).toBeTruthy()

        // Verify pay calculations are reasonable
        const totalHours = parseFloat(result.data.totalHours)
        const totalPay = parseFloat(result.data.totalPay)
        expect(totalHours).toBeGreaterThan(7) // 8 hours minus 30min break = 7.5 hours
        expect(totalPay).toBeGreaterThan(200) // Should be over $200 for 7.5 hours at $25+

        // Check that payGuide is included without casualLoading/overtimeRules
        expect(result.data.payGuide).toBeTruthy()
        expect(result.data.payGuide.baseRate).toBe('25')
        expect(result.data.payGuide.casualLoading).toBeUndefined()
        expect(result.data.payGuide.overtimeRules).toBeUndefined()
        expect(result.data.payGuide.minimumShiftHours).toBe(3)
        expect(result.data.payGuide.maximumShiftHours).toBe(11)

        // Verify it was saved to database
        const saved = await prisma.shift.findFirst({
          where: { payGuideId: testPayGuideId }
        })
        expect(saved).toBeTruthy()
        expect(saved!.totalHours).toBeTruthy()
        expect(saved!.totalPay).toBeTruthy()
      })

      it('should create shift with evening penalty calculations', async () => {
        const shiftData: CreateShiftRequest = {
          payGuideId: testPayGuideId,
          startTime: '2024-01-15T16:00:00Z', // 4pm local
          endTime: '2024-01-15T21:00:00Z',   // 9pm local (includes evening penalty)
          breakMinutes: 30,
          notes: 'Evening shift with penalties',
        }

        const { POST } = await import('@/app/api/shifts/route')
        const request = new MockRequest('http://localhost/api/shifts', {
          method: 'POST',
          body: shiftData,
        })

        const response = await POST(request as any)
        const result = await response.json()

        expect(response.status).toBe(201)
        expect(result.data.totalHours).toBeTruthy()
        expect(result.data.penaltyPay).toBeTruthy()
        
        // Should have penalty pay due to evening hours
        const penaltyPay = parseFloat(result.data.penaltyPay)
        expect(penaltyPay).toBeGreaterThan(0)
      })

      it('should handle minimum shift hours', async () => {
        const shiftData: CreateShiftRequest = {
          payGuideId: testPayGuideId,
          startTime: '2024-01-15T09:00:00Z',
          endTime: '2024-01-15T10:00:00Z', // Only 1 hour, but minimum is 3
          breakMinutes: 0,
        }

        const { POST } = await import('@/app/api/shifts/route')
        const request = new MockRequest('http://localhost/api/shifts', {
          method: 'POST',
          body: shiftData,
        })

        const response = await POST(request as any)
        const result = await response.json()

        expect(response.status).toBe(201)
        
        // Should be paid for minimum 3 hours
        const totalHours = parseFloat(result.data.totalHours)
        expect(totalHours).toBeGreaterThanOrEqual(3)
      })
    })

    describe('Validation and Error Handling', () => {
      it('should validate required fields', async () => {
        const invalidData = {
          // Missing required fields
          notes: 'Invalid shift data',
        }

        const { POST } = await import('@/app/api/shifts/route')
        const request = new MockRequest('http://localhost/api/shifts', {
          method: 'POST',
          body: invalidData,
        })

        const response = await POST(request as any)
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(result.message).toBe('Invalid shift data')

        const errorFields = result.errors.map((err: any) => err.field)
        expect(errorFields).toContain('payGuideId')
        expect(errorFields).toContain('startTime')
        expect(errorFields).toContain('endTime')
        expect(errorFields).toContain('breakMinutes')
      })

      it('should validate shift duration', async () => {
        const invalidData: CreateShiftRequest = {
          payGuideId: testPayGuideId,
          startTime: '2024-01-15T09:00:00Z',
          endTime: '2024-01-14T17:00:00Z', // End before start
          breakMinutes: 30,
        }

        const { POST } = await import('@/app/api/shifts/route')
        const request = new MockRequest('http://localhost/api/shifts', {
          method: 'POST',
          body: invalidData,
        })

        const response = await POST(request as any)
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(result.message).toBe('Invalid shift data')
      })

      it('should validate break minutes range', async () => {
        const invalidData: CreateShiftRequest = {
          payGuideId: testPayGuideId,
          startTime: '2024-01-15T09:00:00Z',
          endTime: '2024-01-15T17:00:00Z',
          breakMinutes: 500, // Exceeds max of 480
        }

        const { POST } = await import('@/app/api/shifts/route')
        const request = new MockRequest('http://localhost/api/shifts', {
          method: 'POST',
          body: invalidData,
        })

        const response = await POST(request as any)
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(result.message).toBe('Invalid shift data')
      })

      it('should return 400 for non-existent pay guide', async () => {
        const invalidData: CreateShiftRequest = {
          payGuideId: 'cltmv8r5v0000l508whbz1234', // Non-existent ID
          startTime: '2024-01-15T09:00:00Z',
          endTime: '2024-01-15T17:00:00Z',
          breakMinutes: 30,
        }

        const { POST } = await import('@/app/api/shifts/route')
        const request = new MockRequest('http://localhost/api/shifts', {
          method: 'POST',
          body: invalidData,
        })

        const response = await POST(request as any)
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.message).toBe('Invalid pay guide')
        expect(result.errors[0].field).toBe('payGuideId')
        expect(result.errors[0].message).toBe('Pay guide not found')
      })

      it('should validate notes length', async () => {
        const invalidData: CreateShiftRequest = {
          payGuideId: testPayGuideId,
          startTime: '2024-01-15T09:00:00Z',
          endTime: '2024-01-15T17:00:00Z',
          breakMinutes: 30,
          notes: 'x'.repeat(501), // Exceeds max length of 500
        }

        const { POST } = await import('@/app/api/shifts/route')
        const request = new MockRequest('http://localhost/api/shifts', {
          method: 'POST',
          body: invalidData,
        })

        const response = await POST(request as any)
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeInstanceOf(Array)
        expect(result.message).toBe('Invalid shift data')
      })
    })
  })
})