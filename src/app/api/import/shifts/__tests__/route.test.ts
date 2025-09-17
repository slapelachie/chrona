import { POST } from '../route'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { ImportShiftsRequest } from '@/types'

jest.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findFirst: jest.fn()
    },
    payGuide: {
      findMany: jest.fn()
    },
    shift: {
      findMany: jest.fn(),
      create: jest.fn()
    },
    breakPeriod: {
      createMany: jest.fn()
    }
  }
}))

jest.mock('@/lib/import-validation', () => ({
  validateShiftsImport: jest.fn()
}))

jest.mock('@/lib/shift-calculation', () => ({
  calculateAndUpdateShift: jest.fn(),
  fetchShiftBreakPeriods: jest.fn(),
  updateShiftWithCalculation: jest.fn()
}))

jest.mock('@/lib/pay-period-utils', () => ({
  findOrCreatePayPeriod: jest.fn()
}))

jest.mock('@/lib/pay-period-sync-service', () => ({
  PayPeriodSyncService: {
    onShiftCreated: jest.fn()
  }
}))

const mockUser = {
  id: 'user1',
  name: 'Test User',
  email: 'test@example.com'
}

const mockPayGuides = [
  {
    id: 'guide1',
    name: 'Retail Award',
    isActive: true
  },
  {
    id: 'guide2',
    name: 'Hospitality Award',
    isActive: true
  }
]

const mockPayPeriod = {
  id: 'period1',
  startDate: new Date('2023-12-01'),
  endDate: new Date('2023-12-07')
}

const mockCreatedShift = {
  id: 'shift1',
  userId: 'user1',
  payGuideId: 'guide1',
  startTime: new Date('2023-12-01T09:00:00Z'),
  endTime: new Date('2023-12-01T17:00:00Z'),
  payPeriodId: 'period1'
}

const validImportRequest: ImportShiftsRequest = {
  shifts: [
    {
      payGuideName: 'Retail Award',
      startTime: '2023-12-01T09:00:00Z',
      endTime: '2023-12-01T17:00:00Z',
      notes: 'Test shift',
      breakPeriods: [
        {
          startTime: '2023-12-01T12:00:00Z',
          endTime: '2023-12-01T13:00:00Z'
        }
      ]
    }
  ],
  options: {
    conflictResolution: 'skip',
    validatePayGuides: true
  }
}

describe('/api/import/shifts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    const { validateShiftsImport } = require('@/lib/import-validation')
    const { findOrCreatePayPeriod } = require('@/lib/pay-period-utils')
    const { calculateAndUpdateShift, fetchShiftBreakPeriods, updateShiftWithCalculation } = require('@/lib/shift-calculation')
    const { PayPeriodSyncService } = require('@/lib/pay-period-sync-service')
    
    validateShiftsImport.mockResolvedValue({
      hasErrors: jest.fn().mockReturnValue(false),
      getErrors: jest.fn().mockReturnValue([]),
      getWarnings: jest.fn().mockReturnValue([])
    })
    
    ;(prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser)
    ;(prisma.payGuide.findMany as jest.Mock).mockResolvedValue(mockPayGuides)
    ;(prisma.shift.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.shift.create as jest.Mock).mockResolvedValue(mockCreatedShift)
    ;(prisma.breakPeriod.createMany as jest.Mock).mockResolvedValue({ count: 1 })
    
    findOrCreatePayPeriod.mockResolvedValue(mockPayPeriod)
    fetchShiftBreakPeriods.mockResolvedValue([])
    calculateAndUpdateShift.mockResolvedValue({
      totalHours: '8.0',
      basePay: '200.00',
      overtimePay: '0.00',
      penaltyPay: '50.00',
      totalPay: '250.00'
    })
    updateShiftWithCalculation.mockResolvedValue(undefined)
    PayPeriodSyncService.onShiftCreated.mockResolvedValue(undefined)
  })

  describe('POST', () => {
    it('should import shifts successfully', async () => {
      const request = new NextRequest('http://localhost:3000/api/import/shifts', {
        method: 'POST',
        body: JSON.stringify(validImportRequest)
      })

      const response = await POST(request)
      expect(response.status).toBe(200)

      const result = await response.json()
      expect(result.success).toBe(true)
      expect(result.summary.totalProcessed).toBe(1)
      expect(result.summary.successful).toBe(1)
      expect(result.summary.failed).toBe(0)
      expect(result.created).toHaveLength(1)

      expect(prisma.shift.create).toHaveBeenCalledWith({
        data: {
          userId: 'user1',
          payGuideId: 'guide1',
          startTime: new Date('2023-12-01T09:00:00Z'),
          endTime: new Date('2023-12-01T17:00:00Z'),
          notes: 'Test shift',
          payPeriodId: 'period1'
        }
      })

      expect(prisma.breakPeriod.createMany).toHaveBeenCalledWith({
        data: [
          {
            shiftId: 'shift1',
            startTime: new Date('2023-12-01T12:00:00Z'),
            endTime: new Date('2023-12-01T13:00:00Z')
          }
        ]
      })
    })

    it('should return validation errors', async () => {
      const { validateShiftsImport } = require('@/lib/import-validation')
      validateShiftsImport.mockResolvedValue({
        hasErrors: jest.fn().mockReturnValue(true),
        getErrors: jest.fn().mockReturnValue([
          { type: 'validation', field: 'startTime', message: 'Invalid date format', index: 0 }
        ]),
        getWarnings: jest.fn().mockReturnValue([])
      })

      const request = new NextRequest('http://localhost:3000/api/import/shifts', {
        method: 'POST',
        body: JSON.stringify(validImportRequest)
      })

      const response = await POST(request)
      expect(response.status).toBe(400)

      const result = await response.json()
      expect(result.success).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].message).toBe('Invalid date format')
    })

    it('should handle missing pay guide', async () => {
      ;(prisma.payGuide.findMany as jest.Mock).mockResolvedValue([
        { id: 'guide2', name: 'Different Award', isActive: true }
      ])

      const request = new NextRequest('http://localhost:3000/api/import/shifts', {
        method: 'POST',
        body: JSON.stringify(validImportRequest)
      })

      const response = await POST(request)
      expect(response.status).toBe(207)

      const result = await response.json()
      expect(result.summary.failed).toBe(1)
      expect(result.errors[0].message).toContain('Pay guide "Retail Award" not found')
    })

    it('should skip overlapping shifts when conflict resolution is skip', async () => {
      ;(prisma.shift.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'existing1',
          startTime: new Date('2023-12-01T08:00:00Z'),
          endTime: new Date('2023-12-01T16:00:00Z')
        }
      ])

      const request = new NextRequest('http://localhost:3000/api/import/shifts', {
        method: 'POST',
        body: JSON.stringify(validImportRequest)
      })

      const response = await POST(request)
      expect(response.status).toBe(200)

      const result = await response.json()
      expect(result.summary.skipped).toBe(1)
      expect(result.skipped[0]).toContain('overlaps with existing shift')
    })

    it('should handle user not found', async () => {
      ;(prisma.user.findFirst as jest.Mock).mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/import/shifts', {
        method: 'POST',
        body: JSON.stringify(validImportRequest)
      })

      const response = await POST(request)
      expect(response.status).toBe(400)

      const result = await response.json()
      expect(result.error).toBe('No user found. Please seed the database first.')
    })

    it('should handle database errors gracefully', async () => {
      ;(prisma.shift.create as jest.Mock).mockRejectedValue(new Error('Database connection failed'))

      const request = new NextRequest('http://localhost:3000/api/import/shifts', {
        method: 'POST',
        body: JSON.stringify(validImportRequest)
      })

      const response = await POST(request)
      expect(response.status).toBe(207)

      const result = await response.json()
      expect(result.success).toBe(false)
      expect(result.summary.failed).toBe(1)
      expect(result.errors[0].message).toContain('Failed to import shift')
    })
  })
})