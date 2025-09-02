/**
 * Blackbox API Endpoints Tests
 * 
 * These tests verify API endpoints from a user perspective without knowledge
 * of internal implementation. Tests focus on request/response cycles and expected behavior.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'
import { Decimal } from 'decimal.js'
import { 
  CreateShiftRequest, 
  UpdateShiftRequest, 
  ShiftPreviewRequest,
  CreatePayGuideRequest,
  UpdatePayGuideRequest
} from '@/types'

// Mock Next.js request/response objects
class MockRequest {
  private _url: string
  private _method: string
  private _body: any
  private _headers: Record<string, string> = {}

  constructor(url: string, options: { method?: string, body?: any, headers?: Record<string, string> } = {}) {
    this._url = url
    this._method = options.method || 'GET'
    this._body = options.body
    this._headers = options.headers || {}
  }

  get url() { return this._url }
  get method() { return this._method }
  
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

  get status() { return this._status }
  get body() { return this._body }
}

// Mock Next.js modules
const mockNextResponse = {
  json: (data: any, options?: { status?: number }) => MockResponse.json(data, options)
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./api-test.db'
    }
  }
})

describe('API Endpoints - Blackbox Tests', () => {
  let testPayGuideId: string
  let testShiftId: string
  let testUserId: string

  beforeAll(async () => {
    // Set up test database
    process.env.DATABASE_URL = 'file:./api-test.db'
    execSync('npx prisma migrate dev --name init', { stdio: 'pipe' })
    
    // Create test data
    const user = await prisma.user.create({
      data: {
        name: 'Test User',
        email: 'test@example.com',
        timezone: 'Australia/Sydney'
      }
    })
    testUserId = user.id

    const payGuide = await prisma.payGuide.create({
      data: {
        name: 'Test Retail Award',
        baseRate: new Decimal('25.00'),
        casualLoading: new Decimal('0.25'),
        effectiveFrom: new Date('2024-01-01'),
        overtimeRules: {
          daily: {
            regularHours: 8,
            firstOvertimeRate: 1.5,
            firstOvertimeHours: 12,
            secondOvertimeRate: 2.0
          }
        }
      }
    })
    testPayGuideId = payGuide.id

    // Create penalty time frames
    await prisma.penaltyTimeFrame.create({
      data: {
        payGuideId: testPayGuideId,
        name: 'Weekend Penalty',
        multiplier: new Decimal('1.5'),
        dayOfWeek: 6 // Saturday
      }
    })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    // Clean up shifts before each test
    await prisma.shift.deleteMany()
  })

  describe('Shifts API Endpoints', () => {
    describe('POST /api/shifts', () => {
      it('should create a shift with valid data', async () => {
        const shiftData: CreateShiftRequest = {
          payGuideId: testPayGuideId,
          startTime: '2024-01-15T09:00:00Z',
          endTime: '2024-01-15T17:00:00Z',
          breakMinutes: 30,
          notes: 'Test shift'
        }

        // Simulate API call
        const { POST } = await import('@/app/api/shifts/route')
        const request = new MockRequest('http://localhost/api/shifts', {
          method: 'POST',
          body: shiftData
        })

        const response = await POST(request as any)
        const result = await response.json()

        expect(response.status).toBe(201)
        expect(result.data).toBeTruthy()
        expect(result.data.payGuideId).toBe(testPayGuideId)
        expect(result.data.breakMinutes).toBe(30)
        expect(result.data.notes).toBe('Test shift')
        expect(result.message).toBe('Shift created successfully')

        testShiftId = result.data.id
      })

      it('should reject shift creation with invalid data', async () => {
        const invalidShiftData = {
          payGuideId: 'invalid-id',
          startTime: 'invalid-date',
          endTime: '2024-01-15T17:00:00Z',
          breakMinutes: -10
        }

        const { POST } = await import('@/app/api/shifts/route')
        const request = new MockRequest('http://localhost/api/shifts', {
          method: 'POST',
          body: invalidShiftData
        })

        const response = await POST(request as any)
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeTruthy()
        expect(result.errors.length).toBeGreaterThan(0)
      })

      it('should reject shift with end time before start time', async () => {
        const invalidShiftData: CreateShiftRequest = {
          payGuideId: testPayGuideId,
          startTime: '2024-01-15T17:00:00Z',
          endTime: '2024-01-15T09:00:00Z', // Before start time
          breakMinutes: 30
        }

        const { POST } = await import('@/app/api/shifts/route')
        const request = new MockRequest('http://localhost/api/shifts', {
          method: 'POST',
          body: invalidShiftData
        })

        const response = await POST(request as any)
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors.some((e: any) => e.field === 'endTime')).toBe(true)
      })

      it('should reject shift with non-existent pay guide', async () => {
        const shiftData: CreateShiftRequest = {
          payGuideId: 'non-existent-id',
          startTime: '2024-01-15T09:00:00Z',
          endTime: '2024-01-15T17:00:00Z',
          breakMinutes: 30
        }

        const { POST } = await import('@/app/api/shifts/route')
        const request = new MockRequest('http://localhost/api/shifts', {
          method: 'POST',
          body: shiftData
        })

        const response = await POST(request as any)
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors.some((e: any) => e.field === 'payGuideId')).toBe(true)
      })
    })

    describe('GET /api/shifts', () => {
      beforeEach(async () => {
        // Create test shifts
        await prisma.shift.createMany({
          data: [
            {
              userId: testUserId,
              payGuideId: testPayGuideId,
              startTime: new Date('2024-01-15T09:00:00Z'),
              endTime: new Date('2024-01-15T17:00:00Z'),
              breakMinutes: 30
            },
            {
              userId: testUserId,
              payGuideId: testPayGuideId,
              startTime: new Date('2024-01-16T10:00:00Z'),
              endTime: new Date('2024-01-16T18:00:00Z'),
              breakMinutes: 60
            }
          ]
        })
      })

      it('should return paginated list of shifts', async () => {
        const { GET } = await import('@/app/api/shifts/route')
        const request = new MockRequest('http://localhost/api/shifts?page=1&limit=10')

        const response = await GET(request as any)
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data).toBeTruthy()
        expect(result.data.shifts).toHaveLength(2)
        expect(result.data.pagination.total).toBe(2)
        expect(result.data.pagination.page).toBe(1)
        expect(result.data.pagination.limit).toBe(10)
      })

      it('should filter shifts by date range', async () => {
        const { GET } = await import('@/app/api/shifts/route')
        const request = new MockRequest(
          'http://localhost/api/shifts?startDate=2024-01-16T00:00:00Z&endDate=2024-01-16T23:59:59Z'
        )

        const response = await GET(request as any)
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data.shifts).toHaveLength(1)
        expect(new Date(result.data.shifts[0].startTime).getDate()).toBe(16)
      })

      it('should sort shifts by specified field', async () => {
        const { GET } = await import('@/app/api/shifts/route')
        const request = new MockRequest('http://localhost/api/shifts?sortBy=startTime&sortOrder=asc')

        const response = await GET(request as any)
        const result = await response.json()

        expect(response.status).toBe(200)
        const shifts = result.data.shifts
        expect(new Date(shifts[0].startTime).getTime()).toBeLessThan(
          new Date(shifts[1].startTime).getTime()
        )
      })

      it('should reject invalid pagination parameters', async () => {
        const { GET } = await import('@/app/api/shifts/route')
        const request = new MockRequest('http://localhost/api/shifts?page=0&limit=101')

        const response = await GET(request as any)
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeTruthy()
      })
    })

    describe('GET /api/shifts/[id]', () => {
      beforeEach(async () => {
        const shift = await prisma.shift.create({
          data: {
            userId: testUserId,
            payGuideId: testPayGuideId,
            startTime: new Date('2024-01-15T09:00:00Z'),
            endTime: new Date('2024-01-15T17:00:00Z'),
            breakMinutes: 30,
            notes: 'Individual shift test'
          }
        })
        testShiftId = shift.id
      })

      it('should return specific shift with relations', async () => {
        const { GET } = await import('@/app/api/shifts/[id]/route')
        const request = new MockRequest(`http://localhost/api/shifts/${testShiftId}`)

        const response = await GET(request as any, { params: { id: testShiftId } })
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data.id).toBe(testShiftId)
        expect(result.data.payGuide).toBeTruthy()
        expect(result.data.payGuide.name).toBe('Test Retail Award')
        expect(result.data.notes).toBe('Individual shift test')
      })

      it('should return 404 for non-existent shift', async () => {
        const { GET } = await import('@/app/api/shifts/[id]/route')
        const nonExistentId = 'cm4a5b6c7d8e9f0a1b2c3d4e5'
        const request = new MockRequest(`http://localhost/api/shifts/${nonExistentId}`)

        const response = await GET(request as any, { params: { id: nonExistentId } })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Shift not found')
      })

      it('should reject invalid shift ID format', async () => {
        const { GET } = await import('@/app/api/shifts/[id]/route')
        const invalidId = 'invalid-id-format'
        const request = new MockRequest(`http://localhost/api/shifts/${invalidId}`)

        const response = await GET(request as any, { params: { id: invalidId } })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors.some((e: any) => e.field === 'id')).toBe(true)
      })
    })

    describe('PUT /api/shifts/[id]', () => {
      beforeEach(async () => {
        const shift = await prisma.shift.create({
          data: {
            userId: testUserId,
            payGuideId: testPayGuideId,
            startTime: new Date('2024-01-15T09:00:00Z'),
            endTime: new Date('2024-01-15T17:00:00Z'),
            breakMinutes: 30,
            notes: 'Original notes'
          }
        })
        testShiftId = shift.id
      })

      it('should update shift with valid data', async () => {
        const updateData: UpdateShiftRequest = {
          breakMinutes: 60,
          notes: 'Updated notes'
        }

        const { PUT } = await import('@/app/api/shifts/[id]/route')
        const request = new MockRequest(`http://localhost/api/shifts/${testShiftId}`, {
          method: 'PUT',
          body: updateData
        })

        const response = await PUT(request as any, { params: { id: testShiftId } })
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data.breakMinutes).toBe(60)
        expect(result.data.notes).toBe('Updated notes')
        expect(result.message).toBe('Shift updated successfully')
      })

      it('should update shift times and clear calculated fields', async () => {
        // First, add some calculated values
        await prisma.shift.update({
          where: { id: testShiftId },
          data: {
            totalHours: new Decimal('8.0'),
            totalPay: new Decimal('250.00')
          }
        })

        const updateData: UpdateShiftRequest = {
          startTime: '2024-01-15T08:00:00Z', // Change start time
          endTime: '2024-01-15T16:30:00Z'    // Change end time
        }

        const { PUT } = await import('@/app/api/shifts/[id]/route')
        const request = new MockRequest(`http://localhost/api/shifts/${testShiftId}`, {
          method: 'PUT',
          body: updateData
        })

        const response = await PUT(request as any, { params: { id: testShiftId } })
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data.totalHours).toBeNull()
        expect(result.data.totalPay).toBeNull()
      })

      it('should reject update with invalid data', async () => {
        const invalidUpdateData = {
          breakMinutes: -10, // Invalid negative break
          endTime: '2024-01-15T08:00:00Z' // Before existing start time
        }

        const { PUT } = await import('@/app/api/shifts/[id]/route')
        const request = new MockRequest(`http://localhost/api/shifts/${testShiftId}`, {
          method: 'PUT',
          body: invalidUpdateData
        })

        const response = await PUT(request as any, { params: { id: testShiftId } })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeTruthy()
      })
    })

    describe('DELETE /api/shifts/[id]', () => {
      beforeEach(async () => {
        const shift = await prisma.shift.create({
          data: {
            userId: testUserId,
            payGuideId: testPayGuideId,
            startTime: new Date('2024-01-15T09:00:00Z'),
            endTime: new Date('2024-01-15T17:00:00Z'),
            breakMinutes: 30
          }
        })
        testShiftId = shift.id
      })

      it('should delete shift successfully', async () => {
        const { DELETE } = await import('@/app/api/shifts/[id]/route')
        const request = new MockRequest(`http://localhost/api/shifts/${testShiftId}`)

        const response = await DELETE(request as any, { params: { id: testShiftId } })
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.message).toBe('Shift deleted successfully')

        // Verify shift is deleted
        const deletedShift = await prisma.shift.findUnique({ where: { id: testShiftId } })
        expect(deletedShift).toBeNull()
      })

      it('should return 404 when trying to delete non-existent shift', async () => {
        const { DELETE } = await import('@/app/api/shifts/[id]/route')
        const nonExistentId = 'cm4a5b6c7d8e9f0a1b2c3d4e5'
        const request = new MockRequest(`http://localhost/api/shifts/${nonExistentId}`)

        const response = await DELETE(request as any, { params: { id: nonExistentId } })
        const result = await response.json()

        expect(response.status).toBe(404)
        expect(result.error).toBe('Shift not found')
      })
    })
  })

  describe('Shift Preview API Endpoint', () => {
    describe('POST /api/shifts/preview', () => {
      it('should calculate pay for regular weekday shift', async () => {
        const previewData: ShiftPreviewRequest = {
          payGuideId: testPayGuideId,
          startTime: '2024-01-15T09:00:00Z', // Monday
          endTime: '2024-01-15T17:00:00Z',   // 8 hours
          breakMinutes: 30
        }

        const { POST } = await import('@/app/api/shifts/preview/route')
        const request = new MockRequest('http://localhost/api/shifts/preview', {
          method: 'POST',
          body: previewData
        })

        const response = await POST(request as any)
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data.calculation).toBeTruthy()
        expect(result.data.calculation.breakdown.totalHours).toBe('7.50') // 8 hours - 0.5 break
        expect(result.data.calculation.breakdown.basePay).toBeTruthy()
        expect(result.data.calculation.breakdown.casualPay).toBeTruthy()
        expect(result.data.calculation.payGuide.name).toBe('Test Retail Award')
      })

      it('should calculate pay for weekend shift with penalties', async () => {
        const previewData: ShiftPreviewRequest = {
          payGuideId: testPayGuideId,
          startTime: '2024-01-13T10:00:00Z', // Saturday
          endTime: '2024-01-13T18:00:00Z',   // 8 hours
          breakMinutes: 30
        }

        const { POST } = await import('@/app/api/shifts/preview/route')
        const request = new MockRequest('http://localhost/api/shifts/preview', {
          method: 'POST',
          body: previewData
        })

        const response = await POST(request as any)
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data.calculation.penalties).toBeTruthy()
        expect(result.data.calculation.penalties.length).toBeGreaterThan(0)
        expect(result.data.calculation.breakdown.penaltyPay).toBeTruthy()
        
        const penaltyPay = parseFloat(result.data.calculation.breakdown.penaltyPay)
        expect(penaltyPay).toBeGreaterThan(0)
      })

      it('should calculate pay for long shift with overtime', async () => {
        const previewData: ShiftPreviewRequest = {
          payGuideId: testPayGuideId,
          startTime: '2024-01-15T08:00:00Z',
          endTime: '2024-01-15T19:00:00Z', // 11 hours
          breakMinutes: 60
        }

        const { POST } = await import('@/app/api/shifts/preview/route')
        const request = new MockRequest('http://localhost/api/shifts/preview', {
          method: 'POST',
          body: previewData
        })

        const response = await POST(request as any)
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data.calculation.breakdown.overtimeHours).toBeTruthy()
        expect(parseFloat(result.data.calculation.breakdown.overtimeHours)).toBeGreaterThan(0)
        expect(result.data.calculation.breakdown.overtimePay).toBeTruthy()
        expect(parseFloat(result.data.calculation.breakdown.overtimePay)).toBeGreaterThan(0)
      })

      it('should reject preview with invalid data', async () => {
        const invalidPreviewData = {
          payGuideId: 'invalid-id',
          startTime: 'invalid-date',
          endTime: '2024-01-15T17:00:00Z',
          breakMinutes: -10
        }

        const { POST } = await import('@/app/api/shifts/preview/route')
        const request = new MockRequest('http://localhost/api/shifts/preview', {
          method: 'POST',
          body: invalidPreviewData
        })

        const response = await POST(request as any)
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeTruthy()
        expect(result.errors.length).toBeGreaterThan(0)
      })

      it('should return error for non-existent pay guide', async () => {
        const previewData: ShiftPreviewRequest = {
          payGuideId: 'non-existent-id',
          startTime: '2024-01-15T09:00:00Z',
          endTime: '2024-01-15T17:00:00Z',
          breakMinutes: 30
        }

        const { POST } = await import('@/app/api/shifts/preview/route')
        const request = new MockRequest('http://localhost/api/shifts/preview', {
          method: 'POST',
          body: previewData
        })

        const response = await POST(request as any)
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors.some((e: any) => e.field === 'payGuideId')).toBe(true)
      })

      it('should complete calculation within performance target', async () => {
        const previewData: ShiftPreviewRequest = {
          payGuideId: testPayGuideId,
          startTime: '2024-01-15T09:00:00Z',
          endTime: '2024-01-15T17:00:00Z',
          breakMinutes: 30
        }

        const startTime = Date.now()
        
        const { POST } = await import('@/app/api/shifts/preview/route')
        const request = new MockRequest('http://localhost/api/shifts/preview', {
          method: 'POST',
          body: previewData
        })

        const response = await POST(request as any)
        const result = await response.json()
        
        const endTime = Date.now()
        const calculationTime = endTime - startTime

        expect(response.status).toBe(200)
        expect(calculationTime).toBeLessThan(1000) // Should complete within 1 second
        expect(result.meta?.calculationTime).toBeTruthy()
      })
    })
  })

  describe('Pay Rates API Endpoints', () => {
    describe('POST /api/pay-rates', () => {
      it('should create pay guide with valid data', async () => {
        const payGuideData: CreatePayGuideRequest = {
          name: 'New Hospitality Award',
          baseRate: '26.50',
          casualLoading: '0.25',
          description: 'New hospitality award rates',
          effectiveFrom: '2024-01-01T00:00:00Z',
          overtimeRules: {
            daily: {
              regularHours: 8,
              firstOvertimeRate: 1.5,
              firstOvertimeHours: 12,
              secondOvertimeRate: 2.0
            }
          }
        }

        const { POST } = await import('@/app/api/pay-rates/route')
        const request = new MockRequest('http://localhost/api/pay-rates', {
          method: 'POST',
          body: payGuideData
        })

        const response = await POST(request as any)
        const result = await response.json()

        expect(response.status).toBe(201)
        expect(result.data.name).toBe('New Hospitality Award')
        expect(result.data.baseRate).toBe('26.50')
        expect(result.data.casualLoading).toBe('0.25')
        expect(result.data.isActive).toBe(true)
      })

      it('should reject duplicate pay guide names', async () => {
        const duplicateData: CreatePayGuideRequest = {
          name: 'Test Retail Award', // Same as existing
          baseRate: '25.00',
          casualLoading: '0.25',
          effectiveFrom: '2024-01-01T00:00:00Z',
          overtimeRules: {}
        }

        const { POST } = await import('@/app/api/pay-rates/route')
        const request = new MockRequest('http://localhost/api/pay-rates', {
          method: 'POST',
          body: duplicateData
        })

        const response = await POST(request as any)
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors.some((e: any) => e.field === 'name')).toBe(true)
      })

      it('should reject invalid overtime rules structure', async () => {
        const invalidData: CreatePayGuideRequest = {
          name: 'Invalid Overtime Award',
          baseRate: '25.00',
          casualLoading: '0.25',
          effectiveFrom: '2024-01-01T00:00:00Z',
          overtimeRules: {
            daily: {
              regularHours: -5, // Invalid negative hours
              firstOvertimeRate: 0.5, // Invalid rate less than 1
              firstOvertimeHours: 12,
              secondOvertimeRate: 2.0
            }
          }
        }

        const { POST } = await import('@/app/api/pay-rates/route')
        const request = new MockRequest('http://localhost/api/pay-rates', {
          method: 'POST',
          body: invalidData
        })

        const response = await POST(request as any)
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.errors).toBeTruthy()
      })
    })

    describe('GET /api/pay-rates', () => {
      it('should return list of pay guides with penalty time frames', async () => {
        const { GET } = await import('@/app/api/pay-rates/route')
        const request = new MockRequest('http://localhost/api/pay-rates')

        const response = await GET(request as any)
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data.payGuides).toBeTruthy()
        expect(result.data.payGuides.length).toBeGreaterThan(0)
        expect(result.data.payGuides[0].penaltyTimeFrames).toBeTruthy()
        expect(result.data.pagination).toBeTruthy()
      })

      it('should filter active pay guides', async () => {
        // Create an inactive pay guide
        await prisma.payGuide.create({
          data: {
            name: 'Inactive Award',
            baseRate: new Decimal('20.00'),
            casualLoading: new Decimal('0.25'),
            effectiveFrom: new Date('2020-01-01'),
            isActive: false,
            overtimeRules: {}
          }
        })

        const { GET } = await import('@/app/api/pay-rates/route')
        const request = new MockRequest('http://localhost/api/pay-rates?active=true')

        const response = await GET(request as any)
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.data.payGuides.every((pg: any) => pg.isActive)).toBe(true)
      })
    })
  })
})