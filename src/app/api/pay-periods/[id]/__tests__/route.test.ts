import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { GET, PUT, DELETE } from '../route'
import { NextRequest } from 'next/server'

// Test data setup
const mockUser = {
  id: 'test-user-id',
  name: 'Test User',
  email: 'test@example.com',
  timezone: 'Australia/Sydney',
  payPeriodType: 'FORTNIGHTLY' as const,
}

const mockPayGuide = {
  id: 'test-pay-guide-id',
  name: 'Test Award',
  baseRate: 25.0,
  effectiveFrom: new Date('2024-01-01'),
  isActive: true,
  timezone: 'Australia/Sydney',
}

describe('Individual Pay Period API Routes', () => {
  let testPayPeriod: any

  beforeEach(async () => {
    // Clean database
    await prisma.payPeriod.deleteMany()
    await prisma.shift.deleteMany()
    await prisma.user.deleteMany()
    await prisma.payGuide.deleteMany()

    // Create test user and pay guide
    await prisma.user.create({ data: mockUser })
    await prisma.payGuide.create({ data: mockPayGuide })

    // Create test pay period
    testPayPeriod = await prisma.payPeriod.create({
      data: {
        userId: mockUser.id,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-14'),
        status: 'open',
        verified: false,
      }
    })
  })

  afterEach(async () => {
    // Clean up
    await prisma.payPeriod.deleteMany()
    await prisma.shift.deleteMany()
    await prisma.user.deleteMany()
    await prisma.payGuide.deleteMany()
  })

  describe('GET /api/pay-periods/[id]', () => {
    it('should return specific pay period', async () => {
      const request = new NextRequest(`http://localhost:3000/api/pay-periods/${testPayPeriod.id}`)
      const params = Promise.resolve({ id: testPayPeriod.id })
      
      const response = await GET(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.id).toBe(testPayPeriod.id)
      expect(data.data.status).toBe('open')
      expect(data.data.verified).toBe(false)
    })

    it('should include shifts when requested', async () => {
      // Create a shift in the pay period
      await prisma.shift.create({
        data: {
          userId: mockUser.id,
          payGuideId: mockPayGuide.id,
          payPeriodId: testPayPeriod.id,
          startTime: new Date('2024-01-01T09:00:00Z'),
          endTime: new Date('2024-01-01T17:00:00Z'),
        }
      })

      const request = new NextRequest(`http://localhost:3000/api/pay-periods/${testPayPeriod.id}?include=shifts`)
      const params = Promise.resolve({ id: testPayPeriod.id })
      
      const response = await GET(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.shifts).toHaveLength(1)
    })

    it('should return 404 for non-existent pay period', async () => {
      const fakeId = 'fake-pay-period-id'
      const request = new NextRequest(`http://localhost:3000/api/pay-periods/${fakeId}`)
      const params = Promise.resolve({ id: fakeId })
      
      const response = await GET(request, { params })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.errors).toContainEqual(
        expect.objectContaining({ field: 'payPeriodId', message: 'Pay period not found' })
      )
    })
  })

  describe('PUT /api/pay-periods/[id]', () => {
    it('should update pay period status', async () => {
      const requestBody = {
        status: 'processing'
      }

      const request = new NextRequest(`http://localhost:3000/api/pay-periods/${testPayPeriod.id}`, {
        method: 'PUT',
        body: JSON.stringify(requestBody),
      })
      const params = Promise.resolve({ id: testPayPeriod.id })
      
      const response = await PUT(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.status).toBe('processing')
      expect(data.message).toBe('Pay period updated successfully')
    })

    it('should update actual pay amount', async () => {
      const requestBody = {
        actualPay: '1500.50',
        verified: true
      }

      const request = new NextRequest(`http://localhost:3000/api/pay-periods/${testPayPeriod.id}`, {
        method: 'PUT',
        body: JSON.stringify(requestBody),
      })
      const params = Promise.resolve({ id: testPayPeriod.id })
      
      const response = await PUT(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.actualPay).toBe('1500.5') // Decimal.js doesn't preserve trailing zeros
      expect(data.data.verified).toBe(true)
    })

    it('should update date ranges when no shifts exist', async () => {
      const requestBody = {
        startDate: '2024-01-02T00:00:00.000Z',
        endDate: '2024-01-15T23:59:59.999Z',
      }

      const request = new NextRequest(`http://localhost:3000/api/pay-periods/${testPayPeriod.id}`, {
        method: 'PUT',
        body: JSON.stringify(requestBody),
      })
      const params = Promise.resolve({ id: testPayPeriod.id })
      
      const response = await PUT(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(new Date(data.data.startDate)).toEqual(new Date('2024-01-02T00:00:00.000Z'))
      expect(new Date(data.data.endDate)).toEqual(new Date('2024-01-15T23:59:59.999Z'))
    })

    it('should prevent date changes that would conflict with existing shifts', async () => {
      // Create a shift outside the new date range
      await prisma.shift.create({
        data: {
          userId: mockUser.id,
          payGuideId: mockPayGuide.id,
          payPeriodId: testPayPeriod.id,
          startTime: new Date('2024-01-01T09:00:00Z'), // Before new start date
          endTime: new Date('2024-01-01T17:00:00Z'),
        }
      })

      const requestBody = {
        startDate: '2024-01-05T00:00:00.000Z', // Shift would be outside this range
        endDate: '2024-01-15T23:59:59.999Z',
      }

      const request = new NextRequest(`http://localhost:3000/api/pay-periods/${testPayPeriod.id}`, {
        method: 'PUT',
        body: JSON.stringify(requestBody),
      })
      const params = Promise.resolve({ id: testPayPeriod.id })
      
      const response = await PUT(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.errors).toContainEqual(
        expect.objectContaining({ 
          field: 'dateRange', 
          message: 'Cannot change dates - some shifts would fall outside the new period' 
        })
      )
    })

    it('should prevent overlapping with other pay periods', async () => {
      // Create another pay period
      await prisma.payPeriod.create({
        data: {
          userId: mockUser.id,
          startDate: new Date('2024-01-15'),
          endDate: new Date('2024-01-28'),
          status: 'open',
          verified: false,
        }
      })

      const requestBody = {
        endDate: '2024-01-20T23:59:59.999Z', // Would overlap with other period
      }

      const request = new NextRequest(`http://localhost:3000/api/pay-periods/${testPayPeriod.id}`, {
        method: 'PUT',
        body: JSON.stringify(requestBody),
      })
      const params = Promise.resolve({ id: testPayPeriod.id })
      
      const response = await PUT(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.errors).toContainEqual(
        expect.objectContaining({ 
          field: 'dateRange', 
          message: 'Updated dates would overlap with existing pay period' 
        })
      )
    })

    it('should validate status values', async () => {
      const requestBody = {
        status: 'invalid-status'
      }

      const request = new NextRequest(`http://localhost:3000/api/pay-periods/${testPayPeriod.id}`, {
        method: 'PUT',
        body: JSON.stringify(requestBody),
      })
      const params = Promise.resolve({ id: testPayPeriod.id })
      
      const response = await PUT(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.errors).toContainEqual(
        expect.objectContaining({ field: 'status', message: 'Invalid status value' })
      )
    })

    it('should validate actual pay amount', async () => {
      const requestBody = {
        actualPay: '-100.00' // Negative amount
      }

      const request = new NextRequest(`http://localhost:3000/api/pay-periods/${testPayPeriod.id}`, {
        method: 'PUT',
        body: JSON.stringify(requestBody),
      })
      const params = Promise.resolve({ id: testPayPeriod.id })
      
      const response = await PUT(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.errors).toContainEqual(
        expect.objectContaining({ field: 'actualPay' })
      )
    })

    it('should return 404 for non-existent pay period', async () => {
      const fakeId = 'fake-pay-period-id'
      const requestBody = { status: 'processing' }

      const request = new NextRequest(`http://localhost:3000/api/pay-periods/${fakeId}`, {
        method: 'PUT',
        body: JSON.stringify(requestBody),
      })
      const params = Promise.resolve({ id: fakeId })
      
      const response = await PUT(request, { params })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.errors).toContainEqual(
        expect.objectContaining({ field: 'payPeriodId', message: 'Pay period not found' })
      )
    })
  })

  describe('DELETE /api/pay-periods/[id]', () => {
    it('should delete pay period with no shifts', async () => {
      const request = new NextRequest(`http://localhost:3000/api/pay-periods/${testPayPeriod.id}?force=true`)
      const params = Promise.resolve({ id: testPayPeriod.id })
      
      const response = await DELETE(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toContain('Pay period deleted successfully')
      expect(data.metadata.deletedShiftsCount).toBe(0)

      // Verify deletion
      const deletedPayPeriod = await prisma.payPeriod.findUnique({
        where: { id: testPayPeriod.id }
      })
      expect(deletedPayPeriod).toBeNull()
    })

    it('should delete pay period and cascade delete shifts', async () => {
      // Create shifts in the pay period
      await prisma.shift.create({
        data: {
          userId: mockUser.id,
          payGuideId: mockPayGuide.id,
          payPeriodId: testPayPeriod.id,
          startTime: new Date('2024-01-01T09:00:00Z'),
          endTime: new Date('2024-01-01T17:00:00Z'),
        }
      })

      await prisma.shift.create({
        data: {
          userId: mockUser.id,
          payGuideId: mockPayGuide.id,
          payPeriodId: testPayPeriod.id,
          startTime: new Date('2024-01-02T09:00:00Z'),
          endTime: new Date('2024-01-02T17:00:00Z'),
        }
      })

      const request = new NextRequest(`http://localhost:3000/api/pay-periods/${testPayPeriod.id}?force=true`)
      const params = Promise.resolve({ id: testPayPeriod.id })
      
      const response = await DELETE(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toContain('Pay period deleted successfully')
      expect(data.metadata.deletedShiftsCount).toBe(2)

      // Verify cascading deletion
      const remainingShifts = await prisma.shift.count({
        where: { payPeriodId: testPayPeriod.id }
      })
      expect(remainingShifts).toBe(0)
    })

    it('should require force flag when shifts exist', async () => {
      // Create a shift
      await prisma.shift.create({
        data: {
          userId: mockUser.id,
          payGuideId: mockPayGuide.id,
          payPeriodId: testPayPeriod.id,
          startTime: new Date('2024-01-01T09:00:00Z'),
          endTime: new Date('2024-01-01T17:00:00Z'),
        }
      })

      const request = new NextRequest(`http://localhost:3000/api/pay-periods/${testPayPeriod.id}`) // No force flag
      const params = Promise.resolve({ id: testPayPeriod.id })
      
      const response = await DELETE(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.errors).toContainEqual(
        expect.objectContaining({ 
          field: 'shifts', 
          message: 'This will permanently delete 1 shift(s). Use force=true to confirm.' 
        })
      )
      expect(data.metadata.shiftsCount).toBe(1)
      expect(data.metadata.requiresForce).toBe(true)
    })

    it('should require force flag for processed pay periods', async () => {
      // Update pay period to processed status
      await prisma.payPeriod.update({
        where: { id: testPayPeriod.id },
        data: { status: 'paid' }
      })

      const request = new NextRequest(`http://localhost:3000/api/pay-periods/${testPayPeriod.id}`) // No force flag
      const params = Promise.resolve({ id: testPayPeriod.id })
      
      const response = await DELETE(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.errors).toContainEqual(
        expect.objectContaining({ 
          field: 'status', 
          message: 'Cannot delete paid pay period. Use force=true to override.' 
        })
      )
      expect(data.metadata.canForceDelete).toBe(true)
    })

    it('should allow force deletion of processed pay periods', async () => {
      // Update pay period to processed status
      await prisma.payPeriod.update({
        where: { id: testPayPeriod.id },
        data: { status: 'verified' }
      })

      const request = new NextRequest(`http://localhost:3000/api/pay-periods/${testPayPeriod.id}?force=true`)
      const params = Promise.resolve({ id: testPayPeriod.id })
      
      const response = await DELETE(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toContain('Pay period deleted successfully')
    })

    it('should return 404 for non-existent pay period', async () => {
      const fakeId = 'fake-pay-period-id'
      const request = new NextRequest(`http://localhost:3000/api/pay-periods/${fakeId}?force=true`)
      const params = Promise.resolve({ id: fakeId })
      
      const response = await DELETE(request, { params })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.errors).toContainEqual(
        expect.objectContaining({ field: 'payPeriodId', message: 'Pay period not found' })
      )
    })
  })
})