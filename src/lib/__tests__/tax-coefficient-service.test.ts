import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import { TaxCoefficientService } from '../tax-coefficient-service'
import { TaxCoefficient, HecsThreshold, TaxRateConfig } from '@/types'

// Mock Prisma (use vi.hoisted to avoid hoisting issues with vi.mock)
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    taxCoefficient: {
      findMany: vi.fn(),
    },
    hecsThreshold: {
      findMany: vi.fn(),
    },
    taxRateConfig: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

describe('TaxCoefficientService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear cache before each test
    TaxCoefficientService.clearCache()
  })

  afterEach(() => {
    // Clear cache after each test to prevent interference
    TaxCoefficientService.clearCache()
  })

  describe('getTaxCoefficients', () => {
    const mockDbCoefficients = [
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

    it('should load tax coefficients from database successfully', async () => {
      mockPrisma.taxCoefficient.findMany.mockResolvedValue(mockDbCoefficients)

      const result = await TaxCoefficientService.getTaxCoefficients('2024-25', 'scale2')

      expect(mockPrisma.taxCoefficient.findMany).toHaveBeenCalledWith({
        where: {
          taxYear: '2024-25',
          scale: 'scale2',
          isActive: true,
        },
        orderBy: [
          { scale: 'asc' },
          { earningsFrom: 'asc' },
        ],
      })

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        scale: 'scale2',
        earningsFrom: new Decimal(0),
        earningsTo: new Decimal(371),
        coefficientA: new Decimal(0),
        coefficientB: new Decimal(0),
      })
      expect(result[1]).toEqual({
        scale: 'scale2',
        earningsFrom: new Decimal(371),
        earningsTo: new Decimal(515),
        coefficientA: new Decimal(0.19),
        coefficientB: new Decimal(70.5385),
      })
    })

    it('should load all scales when no scale specified', async () => {
      mockPrisma.taxCoefficient.findMany.mockResolvedValue(mockDbCoefficients)

      await TaxCoefficientService.getTaxCoefficients('2024-25')

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
    })

    it('should cache results and return cached data on subsequent calls', async () => {
      mockPrisma.taxCoefficient.findMany.mockResolvedValue(mockDbCoefficients)

      // First call
      const result1 = await TaxCoefficientService.getTaxCoefficients('2024-25', 'scale2')
      // Second call (should use cache)
      const result2 = await TaxCoefficientService.getTaxCoefficients('2024-25', 'scale2')

      // Database should only be called once
      expect(mockPrisma.taxCoefficient.findMany).toHaveBeenCalledTimes(1)
      expect(result1).toEqual(result2)
    })

    it('should fallback to hardcoded coefficients when database fails', async () => {
      mockPrisma.taxCoefficient.findMany.mockRejectedValue(new Error('Database connection failed'))

      const result = await TaxCoefficientService.getTaxCoefficients('2024-25', 'scale2')

      // Should return fallback coefficients (we know there are 6 scale2 coefficients)
      expect(result).toHaveLength(6)
      expect(result[0].scale).toBe('scale2')
      expect(result[0].earningsFrom).toEqual(new Decimal(0))
    })

    it('should return appropriate fallback for scale1', async () => {
      mockPrisma.taxCoefficient.findMany.mockRejectedValue(new Error('Database error'))

      const result = await TaxCoefficientService.getTaxCoefficients('2024-25', 'scale1')

      // Should return scale1 fallback coefficients
      expect(result).toHaveLength(6)
      expect(result.every(coeff => coeff.scale === 'scale1')).toBe(true)
    })

    it('should return all scales in fallback when no scale specified', async () => {
      mockPrisma.taxCoefficient.findMany.mockRejectedValue(new Error('Database error'))

      const result = await TaxCoefficientService.getTaxCoefficients('2024-25')

      // Should return both scale1 and scale2 coefficients
      expect(result.length).toBeGreaterThan(6)
      const scales = [...new Set(result.map(c => c.scale))]
      expect(scales).toContain('scale1')
      expect(scales).toContain('scale2')
    })
  })

  describe('getHecsThresholds', () => {
    const mockDbThresholds = [
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
    ]

    it('should load HECS thresholds from database successfully', async () => {
      mockPrisma.hecsThreshold.findMany.mockResolvedValue(mockDbThresholds)

      const result = await TaxCoefficientService.getHecsThresholds('2024-25')

      expect(mockPrisma.hecsThreshold.findMany).toHaveBeenCalledWith({
        where: {
          taxYear: '2024-25',
          isActive: true,
        },
        orderBy: {
          incomeFrom: 'asc',
        },
      })

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        incomeFrom: new Decimal(51550),
        incomeTo: new Decimal(59518),
        rate: new Decimal(0.01),
      })
    })

    it('should cache HECS thresholds', async () => {
      mockPrisma.hecsThreshold.findMany.mockResolvedValue(mockDbThresholds)

      // First call
      await TaxCoefficientService.getHecsThresholds('2024-25')
      // Second call (should use cache)
      await TaxCoefficientService.getHecsThresholds('2024-25')

      expect(mockPrisma.hecsThreshold.findMany).toHaveBeenCalledTimes(1)
    })

    it('should fallback to hardcoded thresholds when database fails', async () => {
      mockPrisma.hecsThreshold.findMany.mockRejectedValue(new Error('Database error'))

      const result = await TaxCoefficientService.getHecsThresholds('2024-25')

      // Should return fallback thresholds (18 thresholds in our fallback)
      expect(result).toHaveLength(18)
      expect(result[0].incomeFrom).toEqual(new Decimal(51550))
      expect(result[0].rate).toEqual(new Decimal(0.01))
    })
  })

  describe('getTaxRateConfig', () => {
    const mockDbConfig = {
      id: '1',
      taxYear: '2024-25',
      medicareRate: new Decimal(0.02),
      medicareLowIncomeThreshold: new Decimal(26000),
      medicareHighIncomeThreshold: new Decimal(32500),
      description: 'Medicare configuration',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    it('should load tax rate configuration successfully', async () => {
      mockPrisma.taxRateConfig.findUnique.mockResolvedValue(mockDbConfig)
      mockPrisma.taxCoefficient.findMany.mockResolvedValue([])
      mockPrisma.hecsThreshold.findMany.mockResolvedValue([])

      const result = await TaxCoefficientService.getTaxRateConfig('2024-25')

      expect(mockPrisma.taxRateConfig.findUnique).toHaveBeenCalledWith({
        where: { taxYear: '2024-25' },
      })

      expect(result).toEqual({
        taxYear: '2024-25',
        medicareRate: new Decimal(0.02),
        medicareLowIncomeThreshold: new Decimal(26000),
        medicareHighIncomeThreshold: new Decimal(32500),
        hecsHelpThresholds: [],
        coefficients: [],
      })
    })

    it('should cache tax rate configuration', async () => {
      mockPrisma.taxRateConfig.findUnique.mockResolvedValue(mockDbConfig)
      mockPrisma.taxCoefficient.findMany.mockResolvedValue([])
      mockPrisma.hecsThreshold.findMany.mockResolvedValue([])

      // First call
      await TaxCoefficientService.getTaxRateConfig('2024-25')
      // Second call (should use cache)
      await TaxCoefficientService.getTaxRateConfig('2024-25')

      expect(mockPrisma.taxRateConfig.findUnique).toHaveBeenCalledTimes(1)
    })

    it('should throw error when tax configuration not found', async () => {
      mockPrisma.taxRateConfig.findUnique.mockResolvedValue(null)

      await expect(TaxCoefficientService.getTaxRateConfig('2099-00')).rejects.toThrow(
        'No tax configuration found for tax year 2099-00'
      )
    })

    it('should fallback to hardcoded configuration when database fails', async () => {
      mockPrisma.taxRateConfig.findUnique.mockRejectedValue(new Error('Database error'))

      const result = await TaxCoefficientService.getTaxRateConfig('2024-25')

      expect(result).toEqual({
        taxYear: '2024-25',
        medicareRate: new Decimal(0.02),
        medicareLowIncomeThreshold: new Decimal(26000),
        medicareHighIncomeThreshold: new Decimal(32500),
        hecsHelpThresholds: expect.any(Array),
        coefficients: expect.any(Array),
      })
    })
  })

  describe('cache management', () => {
    it('should clear all caches', async () => {
      mockPrisma.taxCoefficient.findMany.mockResolvedValue([])
      mockPrisma.hecsThreshold.findMany.mockResolvedValue([])
      mockPrisma.taxRateConfig.findUnique.mockResolvedValue({
        id: '1',
        taxYear: '2024-25',
        medicareRate: new Decimal(0.02),
        medicareLowIncomeThreshold: new Decimal(26000),
        medicareHighIncomeThreshold: new Decimal(32500),
        description: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      // Populate caches
      await TaxCoefficientService.getTaxCoefficients('2024-25')
      await TaxCoefficientService.getHecsThresholds('2024-25')
      await TaxCoefficientService.getTaxRateConfig('2024-25')

      // Clear all caches
      TaxCoefficientService.clearCache()

      // Next calls should hit database again
      await TaxCoefficientService.getTaxCoefficients('2024-25')
      await TaxCoefficientService.getHecsThresholds('2024-25')

      // Database should be called twice for each (once before clear, once after)
      expect(mockPrisma.taxCoefficient.findMany).toHaveBeenCalledTimes(2)
      expect(mockPrisma.hecsThreshold.findMany).toHaveBeenCalledTimes(2)
    })

    it('should clear cache for specific tax year', async () => {
      mockPrisma.taxCoefficient.findMany.mockResolvedValue([])

      // Populate caches for different tax years
      await TaxCoefficientService.getTaxCoefficients('2024-25')
      await TaxCoefficientService.getTaxCoefficients('2023-24')

      // Clear cache for specific tax year
      TaxCoefficientService.clearCacheForTaxYear('2024-25')

      // Call for 2024-25 should hit database, 2023-24 should use cache
      await TaxCoefficientService.getTaxCoefficients('2024-25')
      await TaxCoefficientService.getTaxCoefficients('2023-24')

      // Should be called 3 times total (initial 2024-25, initial 2023-24, post-clear 2024-25)
      expect(mockPrisma.taxCoefficient.findMany).toHaveBeenCalledTimes(3)
    })

    it('should expire cache after TTL', async () => {
      // Mock Date.now to control time
      const originalDateNow = Date.now
      let mockTime = 1000000

      vi.spyOn(Date, 'now').mockImplementation(() => mockTime)

      mockPrisma.taxCoefficient.findMany.mockResolvedValue([])

      // First call
      await TaxCoefficientService.getTaxCoefficients('2024-25')

      // Advance time by more than 1 hour (3600000ms)
      mockTime += 3600001

      // Second call should hit database again due to cache expiry
      await TaxCoefficientService.getTaxCoefficients('2024-25')

      expect(mockPrisma.taxCoefficient.findMany).toHaveBeenCalledTimes(2)

      // Restore original Date.now
      Date.now = originalDateNow
    })
  })
})
