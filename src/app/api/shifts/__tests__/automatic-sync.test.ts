import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { Decimal } from 'decimal.js'
import { POST as createShift } from '../route'
import { PUT as updateShift, DELETE as deleteShift } from '../[id]/route'
import { NextRequest } from 'next/server'

const prisma = new PrismaClient()

describe('Shift API Automatic Sync Integration Tests', () => {
  let userId: string
  let payGuideId: string
  let payPeriodId: string

  beforeEach(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        name: 'Test User',
        email: 'test@example.com',
        timezone: 'Australia/Sydney',
        payPeriodType: 'FORTNIGHTLY',
      },
    })
    userId = user.id

    // Create test pay guide
    const payGuide = await prisma.payGuide.create({
      data: {
        name: 'Test Pay Guide',
        baseRate: new Decimal('25.00'),
        minimumShiftHours: 3,
        maximumShiftHours: 11,
        timezone: 'Australia/Sydney',
        effectiveFrom: new Date('2024-01-01'),
        isActive: true,
      },
    })
    payGuideId = payGuide.id

    // Create test pay period
    const payPeriod = await prisma.payPeriod.create({
      data: {
        userId,
        startDate: new Date('2024-09-01T00:00:00Z'),
        endDate: new Date('2024-09-14T23:59:59Z'),
        status: 'open',
      },
    })
    payPeriodId = payPeriod.id

    // Create tax settings for the user
    await prisma.taxSettings.create({
      data: {
        userId,
        claimedTaxFreeThreshold: true,
        isForeignResident: false,
        hasTaxFileNumber: true,
        medicareExemption: 'none',
        hecsHelpRate: null,
      },
    })
  })

  afterEach(async () => {
    // Clean up test data
    await prisma.breakPeriod.deleteMany()
    await prisma.shift.deleteMany()
    await prisma.yearToDateTax.deleteMany()
    await prisma.taxSettings.deleteMany()
    await prisma.payPeriod.deleteMany()
    await prisma.payGuide.deleteMany()
    await prisma.user.deleteMany()
  })

  describe('POST /api/shifts', () => {
    it('should automatically update pay period totals and taxes when creating shift', async () => {
      const request = new NextRequest('http://localhost:3000/api/shifts', {
        method: 'POST',
        body: JSON.stringify({
          payGuideId,
          startTime: '2024-09-02T09:00:00Z',
          endTime: '2024-09-02T17:00:00Z',
          notes: 'Test shift',
        }),
      })

      const response = await createShift(request)
      expect(response.status).toBe(201)

      const responseData = await response.json()
      const shiftId = responseData.data.id

      // Check that pay period was automatically updated
      const updatedPayPeriod = await prisma.payPeriod.findUnique({
        where: { id: payPeriodId },
      })

      expect(updatedPayPeriod?.totalHours).toBeDefined()
      expect(updatedPayPeriod?.totalHours?.toNumber()).toBeGreaterThan(0)
      expect(updatedPayPeriod?.totalPay).toBeDefined()
      expect(updatedPayPeriod?.totalPay?.toNumber()).toBeGreaterThan(0)

      // Check that tax calculations were triggered (if gross pay is high enough)
      if (updatedPayPeriod?.totalPay && updatedPayPeriod.totalPay.toNumber() > 500) {
        expect(updatedPayPeriod?.paygWithholding).toBeDefined()
        expect(updatedPayPeriod?.netPay).toBeDefined()
      }
    })
  })

  describe('PUT /api/shifts/[id]', () => {
    it('should automatically update pay period totals when updating shift', async () => {
      // First create a shift
      const shift = await prisma.shift.create({
        data: {
          userId,
          payGuideId,
          payPeriodId,
          startTime: new Date('2024-09-02T09:00:00Z'),
          endTime: new Date('2024-09-02T17:00:00Z'),
          totalHours: new Decimal('8.00'),
          totalPay: new Decimal('200.00'),
        },
      })

      // Sync initial state
      await prisma.payPeriod.update({
        where: { id: payPeriodId },
        data: {
          totalHours: new Decimal('8.00'),
          totalPay: new Decimal('200.00'),
        },
      })

      // Update the shift to extend hours
      const request = new NextRequest(`http://localhost:3000/api/shifts/${shift.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          endTime: '2024-09-02T19:00:00Z', // Extend by 2 hours
        }),
      })

      const response = await updateShift(request, { 
        params: Promise.resolve({ id: shift.id }) 
      })
      expect(response.status).toBe(200)

      // Check that pay period totals were automatically recalculated
      const updatedPayPeriod = await prisma.payPeriod.findUnique({
        where: { id: payPeriodId },
      })

      // Should have more hours and pay due to the extended shift
      expect(updatedPayPeriod?.totalHours?.toNumber()).toBeGreaterThan(8.00)
      expect(updatedPayPeriod?.totalPay?.toNumber()).toBeGreaterThan(200.00)
    })
  })

  describe('DELETE /api/shifts/[id]', () => {
    it('should automatically update pay period totals when deleting shift', async () => {
      // Create two shifts
      const shift1 = await prisma.shift.create({
        data: {
          userId,
          payGuideId,
          payPeriodId,
          startTime: new Date('2024-09-02T09:00:00Z'),
          endTime: new Date('2024-09-02T17:00:00Z'),
          totalHours: new Decimal('8.00'),
          totalPay: new Decimal('200.00'),
        },
      })

      const shift2 = await prisma.shift.create({
        data: {
          userId,
          payGuideId,
          payPeriodId,
          startTime: new Date('2024-09-03T10:00:00Z'),
          endTime: new Date('2024-09-03T16:00:00Z'),
          totalHours: new Decimal('6.00'),
          totalPay: new Decimal('150.00'),
        },
      })

      // Set initial pay period totals
      await prisma.payPeriod.update({
        where: { id: payPeriodId },
        data: {
          totalHours: new Decimal('14.00'),
          totalPay: new Decimal('350.00'),
        },
      })

      // Delete one shift
      const request = new NextRequest(`http://localhost:3000/api/shifts/${shift1.id}`, {
        method: 'DELETE',
      })

      const response = await deleteShift(request, { 
        params: Promise.resolve({ id: shift1.id }) 
      })
      expect(response.status).toBe(200)

      // Check that pay period totals were automatically recalculated
      const updatedPayPeriod = await prisma.payPeriod.findUnique({
        where: { id: payPeriodId },
      })

      // Should only have the remaining shift's totals
      expect(updatedPayPeriod?.totalHours?.toNumber()).toBe(6.00)
      expect(updatedPayPeriod?.totalPay?.toNumber()).toBe(150.00)
    })
  })

  describe('Multiple shift operations', () => {
    it('should maintain accurate totals through multiple operations', async () => {
      // Create first shift
      const createRequest1 = new NextRequest('http://localhost:3000/api/shifts', {
        method: 'POST',
        body: JSON.stringify({
          payGuideId,
          startTime: '2024-09-02T09:00:00Z',
          endTime: '2024-09-02T17:00:00Z',
          notes: 'First shift',
        }),
      })

      const response1 = await createShift(createRequest1)
      const shift1Data = await response1.json()
      const shift1Id = shift1Data.data.id

      // Create second shift
      const createRequest2 = new NextRequest('http://localhost:3000/api/shifts', {
        method: 'POST',
        body: JSON.stringify({
          payGuideId,
          startTime: '2024-09-03T10:00:00Z',
          endTime: '2024-09-03T16:00:00Z',
          notes: 'Second shift',
        }),
      })

      const response2 = await createShift(createRequest2)
      const shift2Data = await response2.json()
      const shift2Id = shift2Data.data.id

      // Check totals after two shifts
      let payPeriod = await prisma.payPeriod.findUnique({
        where: { id: payPeriodId },
      })

      const totalHoursAfterTwo = payPeriod?.totalHours?.toNumber() || 0
      const totalPayAfterTwo = payPeriod?.totalPay?.toNumber() || 0

      expect(totalHoursAfterTwo).toBeGreaterThan(0)
      expect(totalPayAfterTwo).toBeGreaterThan(0)

      // Update first shift to extend hours
      const updateRequest = new NextRequest(`http://localhost:3000/api/shifts/${shift1Id}`, {
        method: 'PUT',
        body: JSON.stringify({
          endTime: '2024-09-02T19:00:00Z',
        }),
      })

      await updateShift(updateRequest, { 
        params: Promise.resolve({ id: shift1Id }) 
      })

      // Check totals after update
      payPeriod = await prisma.payPeriod.findUnique({
        where: { id: payPeriodId },
      })

      const totalHoursAfterUpdate = payPeriod?.totalHours?.toNumber() || 0
      const totalPayAfterUpdate = payPeriod?.totalPay?.toNumber() || 0

      expect(totalHoursAfterUpdate).toBeGreaterThan(totalHoursAfterTwo)
      expect(totalPayAfterUpdate).toBeGreaterThan(totalPayAfterTwo)

      // Delete second shift
      const deleteRequest = new NextRequest(`http://localhost:3000/api/shifts/${shift2Id}`, {
        method: 'DELETE',
      })

      await deleteShift(deleteRequest, { 
        params: Promise.resolve({ id: shift2Id }) 
      })

      // Check final totals
      payPeriod = await prisma.payPeriod.findUnique({
        where: { id: payPeriodId },
      })

      const finalTotalHours = payPeriod?.totalHours?.toNumber() || 0
      const finalTotalPay = payPeriod?.totalPay?.toNumber() || 0

      // Should be less than after update but still positive (only first shift remains)
      expect(finalTotalHours).toBeLessThan(totalHoursAfterUpdate)
      expect(finalTotalHours).toBeGreaterThan(0)
      expect(finalTotalPay).toBeLessThan(totalPayAfterUpdate)
      expect(finalTotalPay).toBeGreaterThan(0)
    })
  })
})