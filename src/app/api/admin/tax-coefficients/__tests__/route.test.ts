import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { Decimal } from 'decimal.js'
import { GET, PUT } from '../route'

// Mock Prisma (use hoisted factory to avoid hoist errors)
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    taxCoefficient: {
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

describe('/api/admin/tax-coefficients', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET', () => {
    const mockCoefficients = [
      {
        id: '1',
        taxYear: '2024-25',
        scale: 'scale2',
        earningsFrom: new Decimal(0),
        earningsTo: new Decimal(371),
        coefficientA: new Decimal(0),
        coefficientB: new Decimal(0),
        description: 'Tax-free threshold',
        isActive: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
      {
        id: '2',
        taxYear: '2024-25',
        scale: 'scale2',
        earningsFrom: new Decimal(371),
        earningsTo: new Decimal(515),
        coefficientA: new Decimal(0.19),
        coefficientB: new Decimal(70.5385),
        description: '19% tax bracket',
        isActive: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
    ]

    it('should return tax coefficients for default tax year', async () => {
      mockPrisma.taxCoefficient.findMany.mockResolvedValue(mockCoefficients)

      const request = new NextRequest('http://localhost:3000/api/admin/tax-coefficients')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(mockPrisma.taxCoefficient.findMany).toHaveBeenCalledWith({
        where: {
          taxYear: '2024-25',
          isActive: true,
        },
        orderBy: [
          { scale: 'asc' },
          { earningsFrom: 'asc' },
        ],
      })

      expect(data.data).toHaveLength(2)
      expect(data.data[0]).toEqual({
        id: '1',
        taxYear: '2024-25',
        scale: 'scale2',
        earningsFrom: '0',
        earningsTo: '371',
        coefficientA: '0',
        coefficientB: '0',
        description: 'Tax-free threshold',
        isActive: true,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      })
    })

    it('should filter by tax year when provided', async () => {
      mockPrisma.taxCoefficient.findMany.mockResolvedValue(mockCoefficients)

      const request = new NextRequest('http://localhost:3000/api/admin/tax-coefficients?taxYear=2023-24')
      const response = await GET(request)

      expect(mockPrisma.taxCoefficient.findMany).toHaveBeenCalledWith({
        where: {
          taxYear: '2023-24',
          isActive: true,
        },
        orderBy: [
          { scale: 'asc' },
          { earningsFrom: 'asc' },
        ],
      })
    })

    it('should filter by scale when provided', async () => {
      mockPrisma.taxCoefficient.findMany.mockResolvedValue(mockCoefficients)

      const request = new NextRequest('http://localhost:3000/api/admin/tax-coefficients?taxYear=2024-25&scale=scale1')
      const response = await GET(request)

      expect(mockPrisma.taxCoefficient.findMany).toHaveBeenCalledWith({
        where: {
          taxYear: '2024-25',
          scale: 'scale1',
          isActive: true,
        },
        orderBy: [
          { scale: 'asc' },
          { earningsFrom: 'asc' },
        ],
      })
    })

    it('should handle database errors gracefully', async () => {
      mockPrisma.taxCoefficient.findMany.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/admin/tax-coefficients')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch tax coefficients')
    })

    it('should transform Decimal values to strings', async () => {
      mockPrisma.taxCoefficient.findMany.mockResolvedValue(mockCoefficients)

      const request = new NextRequest('http://localhost:3000/api/admin/tax-coefficients')
      const response = await GET(request)
      const data = await response.json()

      expect(data.data[0].earningsFrom).toBe('0')
      expect(data.data[0].earningsTo).toBe('371')
      expect(data.data[0].coefficientA).toBe('0')
      expect(data.data[0].coefficientB).toBe('0')
      expect(data.data[1].coefficientA).toBe('0.19')
      expect(data.data[1].coefficientB).toBe('70.5385')
    })

    it('should handle null earningsTo values', async () => {
      const mockCoefficientsWithNull = [
        {
          ...mockCoefficients[0],
          earningsTo: null,
        },
      ]
      mockPrisma.taxCoefficient.findMany.mockResolvedValue(mockCoefficientsWithNull)

      const request = new NextRequest('http://localhost:3000/api/admin/tax-coefficients')
      const response = await GET(request)
      const data = await response.json()

      expect(data.data[0].earningsTo).toBeNull()
    })
  })

  describe('PUT', () => {
    const validUpdateData = {
      taxYear: '2024-25',
      coefficients: [
        {
          scale: 'scale2',
          earningsFrom: '0',
          earningsTo: '371',
          coefficientA: '0',
          coefficientB: '0',
          description: 'Tax-free threshold',
        },
        {
          scale: 'scale2',
          earningsFrom: '371',
          earningsTo: '515',
          coefficientA: '0.19',
          coefficientB: '70.5385',
          description: '19% tax bracket',
        },
      ],
    }

    const mockCreatedCoefficients = [
      {
        id: '1',
        taxYear: '2024-25',
        scale: 'scale2',
        earningsFrom: new Decimal(0),
        earningsTo: new Decimal(371),
        coefficientA: new Decimal(0),
        coefficientB: new Decimal(0),
        description: 'Tax-free threshold',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '2',
        taxYear: '2024-25',
        scale: 'scale2',
        earningsFrom: new Decimal(371),
        earningsTo: new Decimal(515),
        coefficientA: new Decimal(0.19),
        coefficientB: new Decimal(70.5385),
        description: '19% tax bracket',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]

    beforeEach(() => {
      // Mock transaction to return the created coefficients
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          taxCoefficient: {
            updateMany: vi.fn(),
            create: vi.fn().mockImplementation(() => mockCreatedCoefficients[0]),
          },
        }
        return await callback(mockTx)
      })
    })

    it('should update tax coefficients successfully', async () => {
      mockPrisma.$transaction.mockResolvedValue(mockCreatedCoefficients)

      const request = new NextRequest('http://localhost:3000/api/admin/tax-coefficients', {
        method: 'PUT',
        body: JSON.stringify(validUpdateData),
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('Successfully updated 2 tax coefficients for 2024-25')
      expect(data.data).toHaveLength(2)
    })

    it('should validate required taxYear field', async () => {
      const invalidData = {
        coefficients: validUpdateData.coefficients,
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

      const request = new NextRequest('http://localhost:3000/api/admin/tax-coefficients', {
        method: 'PUT',
        body: JSON.stringify(invalidData),
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.message).toBe('Invalid request data')
      expect(data.errors).toBeDefined()
    })

    it('should validate coefficients array', async () => {
      const invalidData = {
        taxYear: '2024-25',
        coefficients: 'not-an-array',
      }

      vi.doMock('@/lib/validation', () => ({
        ValidationResult: {
          create: () => ({
            addError: vi.fn(),
            isValid: () => false,
            getErrors: () => ({ coefficients: 'Coefficients must be an array' }),
          }),
        },
        validateString: vi.fn(),
        validateDecimal: vi.fn(),
      }))

      const request = new NextRequest('http://localhost:3000/api/admin/tax-coefficients', {
        method: 'PUT',
        body: JSON.stringify(invalidData),
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.message).toBe('Invalid request data')
    })

    it('should validate individual coefficient data', async () => {
      const invalidCoefficientData = {
        taxYear: '2024-25',
        coefficients: [
          {
            scale: 'scale2',
            earningsFrom: 'invalid-number',
            earningsTo: '371',
            coefficientA: '0',
            coefficientB: '0',
          },
        ],
      }

      // Mock validation to fail for the coefficient
      let validationCallCount = 0
      vi.doMock('@/lib/validation', () => ({
        ValidationResult: {
          create: () => ({
            addError: vi.fn(),
            isValid: () => {
              validationCallCount++
              return validationCallCount === 1 // First call (main validation) passes, second fails
            },
            getErrors: () => ({ earningsFrom: 'Invalid earnings from value' }),
          }),
        },
        validateString: vi.fn(),
        validateDecimal: vi.fn(),
      }))

      const request = new NextRequest('http://localhost:3000/api/admin/tax-coefficients', {
        method: 'PUT',
        body: JSON.stringify(invalidCoefficientData),
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.message).toBe('Invalid coefficient data at index 0')
    })

    it('should handle database transaction errors', async () => {
      mockPrisma.$transaction.mockRejectedValue(new Error('Transaction failed'))

      const request = new NextRequest('http://localhost:3000/api/admin/tax-coefficients', {
        method: 'PUT',
        body: JSON.stringify(validUpdateData),
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to update tax coefficients')
    })

    it('should handle null earningsTo values in update', async () => {
      const dataWithNullEarningsTo = {
        taxYear: '2024-25',
        coefficients: [
          {
            scale: 'scale2',
            earningsFrom: '2307',
            earningsTo: null,
            coefficientA: '0.45',
            coefficientB: '482.6731',
            description: 'Top tax bracket',
          },
        ],
      }

      mockPrisma.$transaction.mockResolvedValue([mockCreatedCoefficients[0]])

      const request = new NextRequest('http://localhost:3000/api/admin/tax-coefficients', {
        method: 'PUT',
        body: JSON.stringify(dataWithNullEarningsTo),
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data[0].earningsTo).toBeNull()
    })

    it('should perform atomic transaction (deactivate then create)', async () => {
      const mockTx = {
        taxCoefficient: {
          updateMany: vi.fn(),
          create: vi.fn().mockResolvedValue(mockCreatedCoefficients[0]),
        },
      }

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const result = await callback(mockTx)
        return [mockCreatedCoefficients[0], mockCreatedCoefficients[1]]
      })

      const request = new NextRequest('http://localhost:3000/api/admin/tax-coefficients', {
        method: 'PUT',
        body: JSON.stringify(validUpdateData),
      })

      await PUT(request)

      // Verify transaction was called
      expect(mockPrisma.$transaction).toHaveBeenCalled()
    })

    it('should transform response data to strings', async () => {
      mockPrisma.$transaction.mockResolvedValue(mockCreatedCoefficients)

      const request = new NextRequest('http://localhost:3000/api/admin/tax-coefficients', {
        method: 'PUT',
        body: JSON.stringify(validUpdateData),
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(data.data[0].earningsFrom).toBe('0')
      expect(data.data[0].coefficientA).toBe('0')
      expect(data.data[1].coefficientA).toBe('0.19')
      expect(data.data[1].coefficientB).toBe('70.5385')
    })
  })
})
