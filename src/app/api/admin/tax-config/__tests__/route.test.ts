import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { Decimal } from 'decimal.js'
import { GET, PUT, POST } from '../route'

// Mock Prisma (hoisted)
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    taxRateConfig: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      create: vi.fn(),
    },
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

describe('/api/admin/tax-config', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET', () => {
    const mockConfig = {
      id: '1',
      taxYear: '2024-25',
      medicareRate: new Decimal(0.02),
      medicareLowIncomeThreshold: new Decimal(26000),
      medicareHighIncomeThreshold: new Decimal(32500),
      description: 'Medicare configuration for 2024-25',
      isActive: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    }

    it('should return tax configuration for default tax year', async () => {
      mockPrisma.taxRateConfig.findUnique.mockResolvedValue(mockConfig)

      const request = new NextRequest('http://localhost:3000/api/admin/tax-config')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(mockPrisma.taxRateConfig.findUnique).toHaveBeenCalledWith({
        where: { taxYear: '2024-25' },
      })

      expect(data.data).toEqual({
        id: '1',
        taxYear: '2024-25',
        medicareRate: '0.02',
        medicareLowIncomeThreshold: '26000',
        medicareHighIncomeThreshold: '32500',
        description: 'Medicare configuration for 2024-25',
        isActive: true,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      })
    })

    it('should return tax configuration for specified tax year', async () => {
      mockPrisma.taxRateConfig.findUnique.mockResolvedValue(mockConfig)

      const request = new NextRequest('http://localhost:3000/api/admin/tax-config?taxYear=2023-24')
      const response = await GET(request)

      expect(mockPrisma.taxRateConfig.findUnique).toHaveBeenCalledWith({
        where: { taxYear: '2023-24' },
      })
    })

    it('should return 404 when configuration not found', async () => {
      mockPrisma.taxRateConfig.findUnique.mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/admin/tax-config?taxYear=2099-00')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Tax configuration not found for the specified tax year')
    })

    it('should transform Decimal values to strings', async () => {
      mockPrisma.taxRateConfig.findUnique.mockResolvedValue(mockConfig)

      const request = new NextRequest('http://localhost:3000/api/admin/tax-config')
      const response = await GET(request)
      const data = await response.json()

      expect(data.data.medicareRate).toBe('0.02')
      expect(data.data.medicareLowIncomeThreshold).toBe('26000')
      expect(data.data.medicareHighIncomeThreshold).toBe('32500')
    })

    it('should handle database errors gracefully', async () => {
      mockPrisma.taxRateConfig.findUnique.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/admin/tax-config')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch tax configuration')
    })
  })

  describe('PUT', () => {
    const validUpdateData = {
      taxYear: '2024-25',
      medicareRate: '0.025',
      medicareLowIncomeThreshold: '27000',
      medicareHighIncomeThreshold: '35000',
      description: 'Updated Medicare configuration',
    }

    const mockUpdatedConfig = {
      id: '1',
      taxYear: '2024-25',
      medicareRate: new Decimal(0.025),
      medicareLowIncomeThreshold: new Decimal(27000),
      medicareHighIncomeThreshold: new Decimal(35000),
      description: 'Updated Medicare configuration',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    it('should update tax configuration successfully', async () => {
      mockPrisma.taxRateConfig.upsert.mockResolvedValue(mockUpdatedConfig)

      const request = new NextRequest('http://localhost:3000/api/admin/tax-config', {
        method: 'PUT',
        body: JSON.stringify(validUpdateData),
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('Successfully updated tax configuration for 2024-25')
      expect(data.data).toEqual({
        id: '1',
        taxYear: '2024-25',
        medicareRate: '0.025',
        medicareLowIncomeThreshold: '27000',
        medicareHighIncomeThreshold: '35000',
        description: 'Updated Medicare configuration',
        isActive: true,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      })
    })

    it('should validate required fields', async () => {
      const invalidData = {
        medicareRate: '0.02',
        // Missing required fields
      }

      vi.doMock('@/lib/validation', () => ({
        ValidationResult: {
          create: () => ({
            addError: vi.fn(),
            isValid: () => false,
            getErrors: () => ({ 
              taxYear: 'Tax year is required',
              medicareLowIncomeThreshold: 'Medicare low income threshold is required',
            }),
          }),
        },
        validateString: vi.fn(),
        validateDecimal: vi.fn(),
      }))

      const request = new NextRequest('http://localhost:3000/api/admin/tax-config', {
        method: 'PUT',
        body: JSON.stringify(invalidData),
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.message).toBe('Invalid tax configuration data')
    })

    it('should validate Medicare rate range (0-100%)', async () => {
      const invalidRateData = {
        ...validUpdateData,
        medicareRate: '1.5', // 150% - invalid
      }

      let validationCallCount = 0
      vi.doMock('@/lib/validation', () => ({
        ValidationResult: {
          create: () => ({
            addError: vi.fn(),
            isValid: () => {
              validationCallCount++
              return validationCallCount <= 4 // First 4 validations pass, 5th fails
            },
            getErrors: () => ({ medicareRate: 'Medicare rate must be between 0 and 1' }),
          }),
        },
        validateString: vi.fn(),
        validateDecimal: vi.fn(),
      }))

      const request = new NextRequest('http://localhost:3000/api/admin/tax-config', {
        method: 'PUT',
        body: JSON.stringify(invalidRateData),
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.message).toBe('Invalid tax configuration data')
    })

    it('should validate that high threshold is greater than low threshold', async () => {
      const invalidThresholdData = {
        ...validUpdateData,
        medicareLowIncomeThreshold: '35000',
        medicareHighIncomeThreshold: '30000', // Lower than low threshold
      }

      const request = new NextRequest('http://localhost:3000/api/admin/tax-config', {
        method: 'PUT',
        body: JSON.stringify(invalidThresholdData),
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.message).toBe('Invalid tax configuration data')
      expect(data.errors.medicareHighIncomeThreshold).toBe(
        'High income threshold must be greater than low income threshold'
      )
    })

    it('should handle negative threshold values', async () => {
      const negativeThresholdData = {
        ...validUpdateData,
        medicareLowIncomeThreshold: '-1000',
      }

      let validationCallCount = 0
      vi.doMock('@/lib/validation', () => ({
        ValidationResult: {
          create: () => ({
            addError: vi.fn(),
            isValid: () => {
              validationCallCount++
              return validationCallCount <= 2 // First 2 pass, 3rd fails
            },
            getErrors: () => ({ medicareLowIncomeThreshold: 'Value must be non-negative' }),
          }),
        },
        validateString: vi.fn(),
        validateDecimal: vi.fn(),
      }))

      const request = new NextRequest('http://localhost:3000/api/admin/tax-config', {
        method: 'PUT',
        body: JSON.stringify(negativeThresholdData),
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.message).toBe('Invalid tax configuration data')
    })

    it('should call upsert with correct parameters', async () => {
      mockPrisma.taxRateConfig.upsert.mockResolvedValue(mockUpdatedConfig)

      const request = new NextRequest('http://localhost:3000/api/admin/tax-config', {
        method: 'PUT',
        body: JSON.stringify(validUpdateData),
      })

      await PUT(request)

      expect(mockPrisma.taxRateConfig.upsert).toHaveBeenCalledWith({
        where: { taxYear: '2024-25' },
        update: {
          medicareRate: new Decimal('0.025'),
          medicareLowIncomeThreshold: new Decimal('27000'),
          medicareHighIncomeThreshold: new Decimal('35000'),
          description: 'Updated Medicare configuration',
          isActive: true,
        },
        create: {
          taxYear: '2024-25',
          medicareRate: new Decimal('0.025'),
          medicareLowIncomeThreshold: new Decimal('27000'),
          medicareHighIncomeThreshold: new Decimal('35000'),
          description: 'Updated Medicare configuration',
          isActive: true,
        },
      })
    })

    it('should handle database errors gracefully', async () => {
      mockPrisma.taxRateConfig.upsert.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/admin/tax-config', {
        method: 'PUT',
        body: JSON.stringify(validUpdateData),
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to update tax configuration')
    })
  })

  describe('POST', () => {
    const validCreateData = {
      taxYear: '2025-26',
      medicareRate: '0.02',
      medicareLowIncomeThreshold: '26000',
      medicareHighIncomeThreshold: '32500',
      description: 'New tax year configuration',
    }

    const mockCreatedConfig = {
      id: '2',
      taxYear: '2025-26',
      medicareRate: new Decimal(0.02),
      medicareLowIncomeThreshold: new Decimal(26000),
      medicareHighIncomeThreshold: new Decimal(32500),
      description: 'New tax year configuration',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    it('should create new tax configuration successfully', async () => {
      mockPrisma.taxRateConfig.findUnique.mockResolvedValue(null) // No existing config
      mockPrisma.taxRateConfig.create.mockResolvedValue(mockCreatedConfig)

      const request = new NextRequest('http://localhost:3000/api/admin/tax-config', {
        method: 'POST',
        body: JSON.stringify(validCreateData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.message).toBe('Successfully created tax configuration for 2025-26')
      expect(data.data.taxYear).toBe('2025-26')
    })

    it('should return 409 if configuration already exists', async () => {
      mockPrisma.taxRateConfig.findUnique.mockResolvedValue(mockCreatedConfig) // Existing config

      const request = new NextRequest('http://localhost:3000/api/admin/tax-config', {
        method: 'POST',
        body: JSON.stringify(validCreateData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data.error).toBe('Tax configuration for 2025-26 already exists. Use PUT to update.')
    })

    it('should validate required fields for creation', async () => {
      const invalidCreateData = {
        medicareRate: '0.02',
        // Missing required fields
      }

      vi.doMock('@/lib/validation', () => ({
        ValidationResult: {
          create: () => ({
            addError: vi.fn(),
            isValid: () => false,
            getErrors: () => ({ 
              taxYear: 'Tax year is required',
              medicareLowIncomeThreshold: 'Medicare low income threshold is required',
            }),
          }),
        },
        validateString: vi.fn(),
        validateDecimal: vi.fn(),
      }))

      const request = new NextRequest('http://localhost:3000/api/admin/tax-config', {
        method: 'POST',
        body: JSON.stringify(invalidCreateData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.message).toBe('Invalid tax configuration data')
    })

    it('should validate threshold ordering for creation', async () => {
      const invalidThresholdData = {
        ...validCreateData,
        medicareLowIncomeThreshold: '35000',
        medicareHighIncomeThreshold: '30000', // Invalid ordering
      }

      const request = new NextRequest('http://localhost:3000/api/admin/tax-config', {
        method: 'POST',
        body: JSON.stringify(invalidThresholdData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.errors.medicareHighIncomeThreshold).toBe(
        'High income threshold must be greater than low income threshold'
      )
    })

    it('should call create with correct parameters', async () => {
      mockPrisma.taxRateConfig.findUnique.mockResolvedValue(null)
      mockPrisma.taxRateConfig.create.mockResolvedValue(mockCreatedConfig)

      const request = new NextRequest('http://localhost:3000/api/admin/tax-config', {
        method: 'POST',
        body: JSON.stringify(validCreateData),
      })

      await POST(request)

      expect(mockPrisma.taxRateConfig.create).toHaveBeenCalledWith({
        data: {
          taxYear: '2025-26',
          medicareRate: new Decimal('0.02'),
          medicareLowIncomeThreshold: new Decimal('26000'),
          medicareHighIncomeThreshold: new Decimal('32500'),
          description: 'New tax year configuration',
          isActive: true,
        },
      })
    })

    it('should handle database creation errors', async () => {
      mockPrisma.taxRateConfig.findUnique.mockResolvedValue(null)
      mockPrisma.taxRateConfig.create.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/admin/tax-config', {
        method: 'POST',
        body: JSON.stringify(validCreateData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to create tax configuration')
    })

    it('should transform response data correctly', async () => {
      mockPrisma.taxRateConfig.findUnique.mockResolvedValue(null)
      mockPrisma.taxRateConfig.create.mockResolvedValue(mockCreatedConfig)

      const request = new NextRequest('http://localhost:3000/api/admin/tax-config', {
        method: 'POST',
        body: JSON.stringify(validCreateData),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data.data.medicareRate).toBe('0.02')
      expect(data.data.medicareLowIncomeThreshold).toBe('26000')
      expect(data.data.medicareHighIncomeThreshold).toBe('32500')
    })
  })
})
