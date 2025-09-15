import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { Decimal } from 'decimal.js'
import { GET, PUT } from '../route'

// Mock Prisma (hoisted)
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    hecsThreshold: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

// Mock validation functions
vi.mock('@/lib/validation', () => ({
  ValidationResult: {
    create: () => ({
      addError: vi.fn(),
      isValid: () => true,
      getErrors: () => ({}),
    }),
  },
  validateString: vi.fn(),
  validateDecimal: vi.fn(),
}))

describe('/api/admin/hecs-thresholds', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET', () => {
    const mockThresholds = [
      {
        id: '1',
        taxYear: '2024-25',
        incomeFrom: new Decimal(51550),
        incomeTo: new Decimal(59518),
        rate: new Decimal(0.01),
        description: '1% repayment rate',
        isActive: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
      {
        id: '2',
        taxYear: '2024-25',
        incomeFrom: new Decimal(59518),
        incomeTo: new Decimal(63090),
        rate: new Decimal(0.02),
        description: '2% repayment rate',
        isActive: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
      {
        id: '3',
        taxYear: '2024-25',
        incomeFrom: new Decimal(156037),
        incomeTo: null,
        rate: new Decimal(0.10),
        description: '10% maximum repayment rate',
        isActive: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
    ]

    it('should return HECS thresholds for default tax year', async () => {
      mockPrisma.hecsThreshold.findMany.mockResolvedValue(mockThresholds)

      const request = new NextRequest('http://localhost:3000/api/admin/hecs-thresholds')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(mockPrisma.hecsThreshold.findMany).toHaveBeenCalledWith({
        where: {
          taxYear: '2024-25',
          isActive: true,
        },
        orderBy: {
          incomeFrom: 'asc',
        },
      })

      expect(data.data).toHaveLength(3)
      expect(data.data[0]).toEqual({
        id: '1',
        taxYear: '2024-25',
        incomeFrom: '51550',
        incomeTo: '59518',
        rate: '0.01',
        description: '1% repayment rate',
        isActive: true,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      })
    })

    it('should filter by tax year when provided', async () => {
      mockPrisma.hecsThreshold.findMany.mockResolvedValue(mockThresholds)

      const request = new NextRequest('http://localhost:3000/api/admin/hecs-thresholds?taxYear=2023-24')
      const response = await GET(request)

      expect(mockPrisma.hecsThreshold.findMany).toHaveBeenCalledWith({
        where: {
          taxYear: '2023-24',
          isActive: true,
        },
        orderBy: {
          incomeFrom: 'asc',
        },
      })
    })

    it('should handle null incomeTo values correctly', async () => {
      mockPrisma.hecsThreshold.findMany.mockResolvedValue(mockThresholds)

      const request = new NextRequest('http://localhost:3000/api/admin/hecs-thresholds')
      const response = await GET(request)
      const data = await response.json()

      expect(data.data[2].incomeTo).toBeNull()
    })

    it('should transform Decimal values to strings', async () => {
      mockPrisma.hecsThreshold.findMany.mockResolvedValue(mockThresholds)

      const request = new NextRequest('http://localhost:3000/api/admin/hecs-thresholds')
      const response = await GET(request)
      const data = await response.json()

      expect(data.data[0].incomeFrom).toBe('51550')
      expect(data.data[0].rate).toBe('0.01')
      expect(data.data[1].rate).toBe('0.02')
      expect(data.data[2].rate).toBe('0.10')
    })

    it('should handle database errors gracefully', async () => {
      mockPrisma.hecsThreshold.findMany.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/admin/hecs-thresholds')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch HECS thresholds')
    })
  })

  describe('PUT', () => {
    const validUpdateData = {
      taxYear: '2024-25',
      thresholds: [
        {
          incomeFrom: '51550',
          incomeTo: '59518',
          rate: '0.01',
          description: '1% repayment rate',
        },
        {
          incomeFrom: '59518',
          incomeTo: '63090',
          rate: '0.02',
          description: '2% repayment rate',
        },
        {
          incomeFrom: '156037',
          incomeTo: null,
          rate: '0.10',
          description: '10% maximum rate',
        },
      ],
    }

    const mockCreatedThresholds = [
      {
        id: '1',
        taxYear: '2024-25',
        incomeFrom: new Decimal(51550),
        incomeTo: new Decimal(59518),
        rate: new Decimal(0.01),
        description: '1% repayment rate',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '2',
        taxYear: '2024-25',
        incomeFrom: new Decimal(59518),
        incomeTo: new Decimal(63090),
        rate: new Decimal(0.02),
        description: '2% repayment rate',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '3',
        taxYear: '2024-25',
        incomeFrom: new Decimal(156037),
        incomeTo: null,
        rate: new Decimal(0.10),
        description: '10% maximum rate',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]

    beforeEach(() => {
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          hecsThreshold: {
            updateMany: vi.fn(),
            create: vi.fn(),
          },
        }
        return await callback(mockTx)
      })
    })

    it('should update HECS thresholds successfully', async () => {
      mockPrisma.$transaction.mockResolvedValue(mockCreatedThresholds)

      const request = new NextRequest('http://localhost:3000/api/admin/hecs-thresholds', {
        method: 'PUT',
        body: JSON.stringify(validUpdateData),
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('Successfully updated 3 HECS thresholds for 2024-25')
      expect(data.data).toHaveLength(3)
    })

    it('should validate required taxYear field', async () => {
      const invalidData = {
        thresholds: validUpdateData.thresholds,
      }

      vi.doMock('@/lib/validation', () => ({
        ValidationResult: {
          create: () => ({
            addError: vi.fn(),
            isValid: () => false,
            getErrors: () => ({ taxYear: 'Tax year is required and must be a string' }),
          }),
        },
        validateString: vi.fn(),
        validateDecimal: vi.fn(),
      }))

      const request = new NextRequest('http://localhost:3000/api/admin/hecs-thresholds', {
        method: 'PUT',
        body: JSON.stringify(invalidData),
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.message).toBe('Invalid request data')
    })

    it('should validate thresholds array', async () => {
      const invalidData = {
        taxYear: '2024-25',
        thresholds: 'not-an-array',
      }

      vi.doMock('@/lib/validation', () => ({
        ValidationResult: {
          create: () => ({
            addError: vi.fn(),
            isValid: () => false,
            getErrors: () => ({ thresholds: 'Thresholds must be an array' }),
          }),
        },
        validateString: vi.fn(),
        validateDecimal: vi.fn(),
      }))

      const request = new NextRequest('http://localhost:3000/api/admin/hecs-thresholds', {
        method: 'PUT',
        body: JSON.stringify(invalidData),
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.message).toBe('Invalid request data')
    })

    it('should validate individual threshold data', async () => {
      const invalidThresholdData = {
        taxYear: '2024-25',
        thresholds: [
          {
            incomeFrom: 'invalid-number',
            incomeTo: '59518',
            rate: '0.01',
          },
        ],
      }

      let validationCallCount = 0
      vi.doMock('@/lib/validation', () => ({
        ValidationResult: {
          create: () => ({
            addError: vi.fn(),
            isValid: () => {
              validationCallCount++
              return validationCallCount === 1 // First call passes, second fails
            },
            getErrors: () => ({ incomeFrom: 'Invalid income from value' }),
          }),
        },
        validateString: vi.fn(),
        validateDecimal: vi.fn(),
      }))

      const request = new NextRequest('http://localhost:3000/api/admin/hecs-thresholds', {
        method: 'PUT',
        body: JSON.stringify(invalidThresholdData),
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.message).toBe('Invalid threshold data at index 0')
    })

    it('should validate that incomeTo is greater than incomeFrom', async () => {
      const overlappingData = {
        taxYear: '2024-25',
        thresholds: [
          {
            incomeFrom: '60000',
            incomeTo: '50000', // Lower than incomeFrom
            rate: '0.01',
          },
        ],
      }

      let validationCallCount = 0
      vi.doMock('@/lib/validation', () => ({
        ValidationResult: {
          create: () => ({
            addError: vi.fn(),
            isValid: () => {
              validationCallCount++
              return validationCallCount === 1
            },
            getErrors: () => ({ incomeTo: 'Income to must be greater than income from' }),
          }),
        },
        validateString: vi.fn(),
        validateDecimal: vi.fn(),
      }))

      const request = new NextRequest('http://localhost:3000/api/admin/hecs-thresholds', {
        method: 'PUT',
        body: JSON.stringify(overlappingData),
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.message).toBe('Invalid threshold data at index 0')
    })

    it('should validate that thresholds do not overlap', async () => {
      const overlappingThresholds = {
        taxYear: '2024-25',
        thresholds: [
          {
            incomeFrom: '50000',
            incomeTo: '60000',
            rate: '0.01',
          },
          {
            incomeFrom: '55000', // Overlaps with previous threshold
            incomeTo: '65000',
            rate: '0.02',
          },
        ],
      }

      const request = new NextRequest('http://localhost:3000/api/admin/hecs-thresholds', {
        method: 'PUT',
        body: JSON.stringify(overlappingThresholds),
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.message).toBe('Threshold validation failed')
      expect(data.errors.thresholds).toBe('Income thresholds cannot overlap')
    })

    it('should handle rates outside valid range (0-100%)', async () => {
      const invalidRateData = {
        taxYear: '2024-25',
        thresholds: [
          {
            incomeFrom: '50000',
            incomeTo: '60000',
            rate: '1.5', // 150% - invalid
          },
        ],
      }

      let validationCallCount = 0
      vi.doMock('@/lib/validation', () => ({
        ValidationResult: {
          create: () => ({
            addError: vi.fn(),
            isValid: () => {
              validationCallCount++
              return validationCallCount === 1
            },
            getErrors: () => ({ rate: 'Rate must be between 0 and 1' }),
          }),
        },
        validateString: vi.fn(),
        validateDecimal: vi.fn(),
      }))

      const request = new NextRequest('http://localhost:3000/api/admin/hecs-thresholds', {
        method: 'PUT',
        body: JSON.stringify(invalidRateData),
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.message).toBe('Invalid threshold data at index 0')
    })

    it('should handle database transaction errors', async () => {
      mockPrisma.$transaction.mockRejectedValue(new Error('Transaction failed'))

      const request = new NextRequest('http://localhost:3000/api/admin/hecs-thresholds', {
        method: 'PUT',
        body: JSON.stringify(validUpdateData),
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to update HECS thresholds')
    })

    it('should transform response data correctly', async () => {
      mockPrisma.$transaction.mockResolvedValue(mockCreatedThresholds)

      const request = new NextRequest('http://localhost:3000/api/admin/hecs-thresholds', {
        method: 'PUT',
        body: JSON.stringify(validUpdateData),
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(data.data[0].incomeFrom).toBe('51550')
      expect(data.data[0].incomeTo).toBe('59518')
      expect(data.data[0].rate).toBe('0.01')
      expect(data.data[2].incomeTo).toBeNull()
    })

    it('should handle valid consecutive thresholds', async () => {
      const consecutiveThresholds = {
        taxYear: '2024-25',
        thresholds: [
          {
            incomeFrom: '50000',
            incomeTo: '60000',
            rate: '0.01',
          },
          {
            incomeFrom: '60000', // Exactly matches previous incomeTo
            incomeTo: '70000',
            rate: '0.02',
          },
        ],
      }

      mockPrisma.$transaction.mockResolvedValue(mockCreatedThresholds.slice(0, 2))

      const request = new NextRequest('http://localhost:3000/api/admin/hecs-thresholds', {
        method: 'PUT',
        body: JSON.stringify(consecutiveThresholds),
      })

      const response = await PUT(request)

      expect(response.status).toBe(200) // Should be valid
    })

    it('should perform atomic transaction', async () => {
      const mockTx = {
        hecsThreshold: {
          updateMany: vi.fn(),
          create: vi.fn().mockResolvedValue(mockCreatedThresholds[0]),
        },
      }

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const result = await callback(mockTx)
        return mockCreatedThresholds
      })

      const request = new NextRequest('http://localhost:3000/api/admin/hecs-thresholds', {
        method: 'PUT',
        body: JSON.stringify(validUpdateData),
      })

      await PUT(request)

      expect(mockPrisma.$transaction).toHaveBeenCalled()
    })
  })
})
