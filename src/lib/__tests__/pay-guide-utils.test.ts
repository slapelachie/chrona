import { describe, it, expect, beforeEach, vi } from 'vitest'
import Decimal from 'decimal.js'
import { prisma } from '@/lib/db'
import {
  generateUniquePayGuideName,
  checkPayGuideNameUniqueness,
  buildPayGuideUpdateData,
  createPayGuideData,
} from '@/lib/pay-guide-utils'
import { UpdatePayGuideRequest } from '@/types'

vi.mock('@/lib/db', () => ({
  prisma: {
    payGuide: {
      findUnique: vi.fn(),
    },
  },
}))

describe('pay-guide-utils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateUniquePayGuideName', () => {
    it('returns the trimmed base name when unused', async () => {
      ;(prisma.payGuide.findUnique as vi.Mock).mockResolvedValueOnce(null)

      const result = await generateUniquePayGuideName(' Retail Guide ')

      expect(result).toBe('Retail Guide')
      expect(prisma.payGuide.findUnique).toHaveBeenCalledWith({ where: { name: 'Retail Guide' } })
    })

    it('increments suffix until an unused name is found', async () => {
      ;(prisma.payGuide.findUnique as vi.Mock)
        .mockResolvedValueOnce({ id: 'existing-1' })
        .mockResolvedValueOnce({ id: 'existing-2' })
        .mockResolvedValueOnce(null)

      const result = await generateUniquePayGuideName('Retail Guide')

      expect(result).toBe('Retail Guide (3)')
      expect((prisma.payGuide.findUnique as vi.Mock).mock.calls).toEqual([
        [{ where: { name: 'Retail Guide' } }],
        [{ where: { name: 'Retail Guide (2)' } }],
        [{ where: { name: 'Retail Guide (3)' } }],
      ])
    })

    it('throws when the base name is empty after trimming', async () => {
      await expect(generateUniquePayGuideName('   ')).rejects.toThrow(
        'Base name is required to generate pay guide name'
      )
      expect(prisma.payGuide.findUnique).not.toHaveBeenCalled()
    })

    it('throws after exhausting the retry budget', async () => {
      const collision = { id: 'existing' }
      ;(prisma.payGuide.findUnique as vi.Mock).mockImplementation(() => Promise.resolve(collision))

      await expect(generateUniquePayGuideName('Retail Guide')).rejects.toThrow(
        'Unable to generate unique pay guide name'
      )
      expect((prisma.payGuide.findUnique as vi.Mock).mock.calls.length).toBeGreaterThanOrEqual(1000)
    })
  })

  describe('checkPayGuideNameUniqueness', () => {
    it('returns true when no pay guide exists', async () => {
      ;(prisma.payGuide.findUnique as vi.Mock).mockResolvedValueOnce(null)

      await expect(checkPayGuideNameUniqueness('Retail Guide')).resolves.toBe(true)
    })

    it('returns false when a different guide already uses the name', async () => {
      ;(prisma.payGuide.findUnique as vi.Mock).mockResolvedValueOnce({ id: 'existing' })

      await expect(checkPayGuideNameUniqueness('Retail Guide')).resolves.toBe(false)
    })

    it('returns true when the matching guide is the one being updated', async () => {
      ;(prisma.payGuide.findUnique as vi.Mock).mockResolvedValueOnce({ id: 'existing' })

      await expect(checkPayGuideNameUniqueness('Retail Guide', 'existing')).resolves.toBe(true)
    })
  })

  describe('buildPayGuideUpdateData', () => {
    it('converts fields to the correct types', () => {
      const body: UpdatePayGuideRequest = {
        name: 'Retail Guide',
        baseRate: '29.95',
        minimumShiftHours: 3,
        maximumShiftHours: 9,
        description: 'Updated guide',
        effectiveFrom: '2024-01-01T00:00:00Z',
        effectiveTo: '2024-06-30T00:00:00Z',
        timezone: 'Australia/Sydney',
        isActive: false,
      }

      const result = buildPayGuideUpdateData(body)

      expect(result.name).toBe('Retail Guide')
      expect(Decimal.isDecimal(result.baseRate)).toBe(true)
      expect(result.baseRate.toString()).toBe('29.95')
      expect(result.minimumShiftHours).toBe(3)
      expect(result.maximumShiftHours).toBe(9)
      expect(result.description).toBe('Updated guide')
      expect(result.effectiveFrom).toBeInstanceOf(Date)
      expect(result.effectiveTo).toBeInstanceOf(Date)
      expect(result.timezone).toBe('Australia/Sydney')
      expect(result.isActive).toBe(false)
    })

    it('omits fields that are undefined', () => {
      const result = buildPayGuideUpdateData({})
      expect(Object.keys(result)).toHaveLength(0)
    })
  })

  describe('createPayGuideData', () => {
    it('builds a create payload with Decimal and Date values', () => {
      const now = '2024-02-01T00:00:00Z'
      const result = createPayGuideData({
        name: 'Retail Guide',
        baseRate: '30.00',
        minimumShiftHours: 3,
        maximumShiftHours: 10,
        description: 'Brand new guide',
        effectiveFrom: now,
        effectiveTo: null,
        timezone: 'Australia/Perth',
        isActive: true,
      })

      expect(result.name).toBe('Retail Guide')
      expect(Decimal.isDecimal(result.baseRate)).toBe(true)
      expect(result.baseRate.toString()).toBe('30')
      expect(result.effectiveFrom).toBeInstanceOf(Date)
      expect(result.effectiveTo).toBeNull()
      expect(result.timezone).toBe('Australia/Perth')
      expect(result.isActive).toBe(true)
    })

    it('defaults isActive to true when omitted', () => {
      const result = createPayGuideData({
        name: 'Retail Guide',
        baseRate: '30.00',
        effectiveFrom: '2024-02-01T00:00:00Z',
        timezone: 'Australia/Perth',
      })

      expect(result.isActive).toBe(true)
    })
  })
})

