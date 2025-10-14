import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Decimal } from 'decimal.js'
let PayPeriodTaxService: any
import { PayPeriodStatus, PayPeriodType } from '@/types'

// Mock the database (use vi.hoisted to avoid hoisting issues)
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    payPeriod: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    taxSettings: {
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
    yearToDateTax: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

const { mockPayPeriodSyncService } = vi.hoisted(() => ({
  mockPayPeriodSyncService: {
    syncPayPeriod: vi.fn(),
  },
}))

vi.mock('@/lib/pay-period-sync-service', () => ({
  PayPeriodSyncService: mockPayPeriodSyncService,
}))

// Mock the tax calculator
const mockTaxCalculator = {
  calculatePayPeriodTax: vi.fn().mockReturnValue({
    payPeriod: {
      id: 'test-pay-period',
      grossPay: new Decimal(2000),
      payPeriodType: 'FORTNIGHTLY' as PayPeriodType,
    },
    breakdown: {
      grossPay: new Decimal(2000),
      paygWithholding: new Decimal(300),
      medicareLevy: new Decimal(40),
      hecsHelpAmount: new Decimal(0),
      totalWithholdings: new Decimal(340),
      netPay: new Decimal(1660),
    },
    taxScale: 'scale2' as const,
    yearToDate: {
      grossIncome: new Decimal(12000),
      totalWithholdings: new Decimal(1540),
    },
  })
}

// Mock the factory used by the service to create a TaxCalculator (hoisted)
const { createTaxCalculatorMock } = vi.hoisted(() => ({
  createTaxCalculatorMock: vi.fn(),
}))
vi.mock('@/lib/create-tax-calculator', () => ({
  createTaxCalculator: createTaxCalculatorMock,
}))

describe('PayPeriodTaxService', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    // Freeze time for deterministic tax year (2024-25)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-08-15T00:00:00.000Z'))
    // Ensure factory mock returns calculator by default
    createTaxCalculatorMock.mockReset().mockResolvedValue(mockTaxCalculator)
    // Reapply calculator method behavior (mockReset clears implementations when global setting is on)
    mockTaxCalculator.calculatePayPeriodTax = vi.fn().mockReturnValue({
      payPeriod: {
        id: 'test-pay-period',
        grossPay: new Decimal(2000),
        payPeriodType: 'FORTNIGHTLY' as PayPeriodType,
      },
      breakdown: {
        grossPay: new Decimal(2000),
        paygWithholding: new Decimal(300),
        medicareLevy: new Decimal(40),
        hecsHelpAmount: new Decimal(0),
        totalWithholdings: new Decimal(340),
        netPay: new Decimal(1660),
      },
      taxScale: 'scale2' as const,
      yearToDate: {
        grossIncome: new Decimal(12000),
        totalWithholdings: new Decimal(1540),
      },
    })
    // Import service after mocks are in place
    const mod = await import('../pay-period-tax-service')
    PayPeriodTaxService = mod.PayPeriodTaxService
    mockPayPeriodSyncService.syncPayPeriod.mockReset()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('calculatePayPeriodTax', () => {
    it('should calculate tax for a pay period successfully', async () => {
      // Mock database responses
      const mockPayPeriod = {
        id: 'test-pay-period',
        userId: 'test-user',
        startDate: new Date('2024-08-01'),
        totalPay: new Decimal(2000),
        user: {
          payPeriodType: 'FORTNIGHTLY' as PayPeriodType,
          taxSettings: {
            id: 'test-tax-settings',
            userId: 'test-user',
            claimedTaxFreeThreshold: true,
            isForeignResident: false,
            hasTaxFileNumber: true,
            medicareExemption: 'none',
            hecsHelpRate: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
        },
        shifts: []
      }

      const mockYearToDateTax = {
        id: 'test-ytd',
        userId: 'test-user',
        taxYear: '2024-25',
        grossIncome: new Decimal(10000),
        payGWithholding: new Decimal(1000),
        medicareLevy: new Decimal(200),
        hecsHelpAmount: new Decimal(0),
        totalWithholdings: new Decimal(1200),
        lastUpdated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrisma.payPeriod.findUnique.mockResolvedValue(mockPayPeriod as any)
      mockPrisma.taxSettings.findUnique.mockResolvedValue(mockPayPeriod.user.taxSettings as any)
      mockPrisma.yearToDateTax.findUnique.mockResolvedValue(mockYearToDateTax as any)
      mockPrisma.payPeriod.update.mockResolvedValue(mockPayPeriod as any)
      mockPrisma.yearToDateTax.update.mockResolvedValue(mockYearToDateTax as any)

      const result = await PayPeriodTaxService.calculatePayPeriodTax('test-pay-period')

      // Verify the result
      expect(result.breakdown.grossPay.toNumber()).toBe(2000)
      expect(result.breakdown.paygWithholding.toNumber()).toBe(300)
      expect(result.breakdown.medicareLevy.toNumber()).toBe(40)
      expect(result.breakdown.totalWithholdings.toNumber()).toBe(340)
      expect(result.breakdown.netPay.toNumber()).toBe(1660)

      // Verify database updates
      expect(mockPrisma.payPeriod.update).toHaveBeenCalledWith({
        where: { id: 'test-pay-period' },
        data: {
          paygWithholding: new Decimal(300),
          medicareLevy: new Decimal(40),
          hecsHelpAmount: new Decimal(0),
          totalWithholdings: new Decimal(340),
          netPay: new Decimal(1660),
        }
      })

      expect(mockPrisma.yearToDateTax.update).toHaveBeenCalled()
    })

    it('should throw error if pay period not found', async () => {
      mockPrisma.payPeriod.findUnique.mockResolvedValue(null)

      await expect(PayPeriodTaxService.calculatePayPeriodTax('nonexistent'))
        .rejects.toThrow('Pay period not found: nonexistent')
    })

    it('should throw error if pay period has no total pay', async () => {
      const mockPayPeriod = {
        id: 'test-pay-period',
        userId: 'test-user',
        totalPay: null, // No total pay calculated
        user: { payPeriodType: 'FORTNIGHTLY' },
        shifts: []
      }

      mockPrisma.payPeriod.findUnique.mockResolvedValue(mockPayPeriod as any)

      await expect(PayPeriodTaxService.calculatePayPeriodTax('test-pay-period'))
        .rejects.toThrow('Pay period test-pay-period has no calculated total pay')
    })
  })

  describe('previewTaxCalculation', () => {
    it('should preview tax calculation without saving', async () => {
      const mockTaxSettings = {
        id: 'test-tax-settings',
        userId: 'test-user',
        claimedTaxFreeThreshold: true,
        isForeignResident: false,
        hasTaxFileNumber: true,
        medicareExemption: 'none',
        hecsHelpRate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const mockYearToDateTax = {
        id: 'test-ytd',
        userId: 'test-user',
        taxYear: '2024-25',
        grossIncome: new Decimal(10000),
        payGWithholding: new Decimal(1000),
        medicareLevy: new Decimal(200),
        hecsHelpAmount: new Decimal(0),
        totalWithholdings: new Decimal(1200),
        lastUpdated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrisma.taxSettings.findUnique.mockResolvedValue(mockTaxSettings as any)
      mockPrisma.yearToDateTax.findUnique.mockResolvedValue(mockYearToDateTax as any)

      const result = await PayPeriodTaxService.previewTaxCalculation(
        'test-user',
        new Decimal(2000),
        'FORTNIGHTLY'
      )

      // Should return calculation result
      expect(result.breakdown.grossPay.toNumber()).toBe(2000)
      expect(result.breakdown.paygWithholding.toNumber()).toBe(300)

      // Should not update database
      expect(mockPrisma.payPeriod.update).not.toHaveBeenCalled()
      expect(mockPrisma.yearToDateTax.update).not.toHaveBeenCalled()
    })
  })

  describe('recalculatePayPeriod', () => {
    it('recalculates totals and returns refreshed pay period', async () => {
      const mockPayPeriod = {
        id: 'test-pay-period',
        userId: 'test-user',
        startDate: new Date('2024-08-01'),
        status: 'pending' as PayPeriodStatus,
        totalPay: new Decimal(2000),
        user: {
          payPeriodType: 'FORTNIGHTLY' as PayPeriodType,
          taxSettings: {
            id: 'test-tax-settings',
            userId: 'test-user',
            claimedTaxFreeThreshold: true,
            isForeignResident: false,
            hasTaxFileNumber: true,
            medicareExemption: 'none',
            hecsHelpRate: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
        },
        shifts: [
          { id: 'shift-1', totalHours: new Decimal(40), totalPay: new Decimal(1000) },
          { id: 'shift-2', totalHours: new Decimal(38), totalPay: new Decimal(1000) }
        ]
      }

      const mockYearToDateTax = {
        id: 'test-ytd',
        userId: 'test-user',
        taxYear: '2024-25',
        grossIncome: new Decimal(10000),
        payGWithholding: new Decimal(1000),
        stslAmount: new Decimal(0),
        totalWithholdings: new Decimal(1200),
        lastUpdated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPayPeriodSyncService.syncPayPeriod.mockResolvedValue(undefined)

      mockPrisma.payPeriod.findUnique
        .mockResolvedValueOnce(mockPayPeriod as any) // For calculatePayPeriodTax
        .mockResolvedValueOnce({ ...mockPayPeriod, paygWithholding: new Decimal(300) } as any)

      mockPrisma.payPeriod.update
        .mockResolvedValueOnce({ ...mockPayPeriod, paygWithholding: new Decimal(300) } as any)

      mockPrisma.taxSettings.findUnique.mockResolvedValue(mockPayPeriod.user.taxSettings as any)
      mockPrisma.yearToDateTax.findUnique.mockResolvedValue(mockYearToDateTax as any)
      mockPrisma.yearToDateTax.update.mockResolvedValue(mockYearToDateTax as any)

      const result = await PayPeriodTaxService.recalculatePayPeriod('test-pay-period')

      expect(mockPayPeriodSyncService.syncPayPeriod).toHaveBeenCalledWith('test-pay-period')
      expect(mockPrisma.payPeriod.update).toHaveBeenCalled()
      expect(result.id).toBe('test-pay-period')
      expect(result.shifts?.length).toBe(2)
      expect(result.status).toBe('pending')
    })
  })

  describe('Tax Settings Management', () => {
    it('should get user tax settings', async () => {
      const mockTaxSettings = {
        id: 'test-tax-settings',
        userId: 'test-user',
        claimedTaxFreeThreshold: true,
        isForeignResident: false,
        hasTaxFileNumber: true,
        medicareExemption: 'none',
        hecsHelpRate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrisma.taxSettings.findUnique.mockResolvedValue(mockTaxSettings as any)

      const result = await PayPeriodTaxService.getUserTaxSettings('test-user')

      expect(result).toEqual(mockTaxSettings)
    })

    it('should create default tax settings if none exist', async () => {
      const mockTaxSettings = {
        id: 'new-tax-settings',
        userId: 'test-user',
        claimedTaxFreeThreshold: true,
        isForeignResident: false,
        hasTaxFileNumber: true,
        medicareExemption: 'none',
        hecsHelpRate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrisma.taxSettings.findUnique.mockResolvedValue(null)
      mockPrisma.taxSettings.create.mockResolvedValue(mockTaxSettings as any)

      const result = await PayPeriodTaxService.getUserTaxSettings('test-user')

      expect(mockPrisma.taxSettings.create).toHaveBeenCalledWith({
        data: {
          userId: 'test-user',
          claimedTaxFreeThreshold: true,
          isForeignResident: false,
          hasTaxFileNumber: true,
          medicareExemption: 'none',
          hecsHelpRate: null,
        }
      })
    })

    it('should update user tax settings', async () => {
      const updatedSettings = {
        id: 'test-tax-settings',
        userId: 'test-user',
        claimedTaxFreeThreshold: false,
        isForeignResident: true,
        hasTaxFileNumber: true,
        medicareExemption: 'full',
        hecsHelpRate: new Decimal(0.02),
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrisma.taxSettings.upsert.mockResolvedValue(updatedSettings as any)

      const result = await PayPeriodTaxService.updateUserTaxSettings('test-user', {
        claimedTaxFreeThreshold: false,
        isForeignResident: true,
        medicareExemption: 'full',
        hecsHelpRate: new Decimal(0.02),
      })

      expect(result).toEqual(updatedSettings)
      expect(mockPrisma.taxSettings.upsert).toHaveBeenCalledWith({
        where: { userId: 'test-user' },
        update: expect.objectContaining({
          claimedTaxFreeThreshold: false,
          isForeignResident: true,
          medicareExemption: 'full',
          hecsHelpRate: new Decimal(0.02),
          updatedAt: expect.any(Date)
        }),
        create: expect.objectContaining({
          userId: 'test-user',
          claimedTaxFreeThreshold: false,
          isForeignResident: true,
          medicareExemption: 'full',
          hecsHelpRate: new Decimal(0.02),
        })
      })
    })
  })

  describe('Year-to-Date Tax Tracking', () => {
    it('should get year-to-date tax summary', async () => {
      const mockYearToDateTax = {
        id: 'test-ytd',
        userId: 'test-user',
        taxYear: '2024-25',
        grossIncome: new Decimal(15000),
        payGWithholding: new Decimal(1500),
        medicareLevy: new Decimal(300),
        hecsHelpAmount: new Decimal(150),
        totalWithholdings: new Decimal(1950),
        lastUpdated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrisma.yearToDateTax.findUnique.mockResolvedValue(mockYearToDateTax as any)

      const result = await PayPeriodTaxService.getYearToDateTaxSummary('test-user')

      expect(result).toEqual(mockYearToDateTax)
    })

    it('should create year-to-date tax tracking if none exists', async () => {
      const mockYearToDateTax = {
        id: 'new-ytd',
        userId: 'test-user',
        taxYear: '2024-25',
        grossIncome: new Decimal(0),
        payGWithholding: new Decimal(0),
        medicareLevy: new Decimal(0),
        hecsHelpAmount: new Decimal(0),
        totalWithholdings: new Decimal(0),
        lastUpdated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrisma.yearToDateTax.findUnique.mockResolvedValue(null)
      mockPrisma.yearToDateTax.create.mockResolvedValue(mockYearToDateTax as any)

      const result = await PayPeriodTaxService.getYearToDateTaxSummary('test-user')

      expect(mockPrisma.yearToDateTax.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'test-user',
          taxYear: '2024-25',
          grossIncome: new Decimal(0),
          payGWithholding: new Decimal(0),
          medicareLevy: new Decimal(0),
          hecsHelpAmount: new Decimal(0),
          totalWithholdings: new Decimal(0),
        })
      })
    })
  })

  describe('Database Integration and Tax Year Logic', () => {
    it('should use tax year from pay period start date, not current date', async () => {
      const mockPayPeriod = {
        id: 'test-pay-period',
        userId: 'test-user',
        startDate: new Date('2023-08-15'), // Should use 2023-24 tax year
        totalPay: new Decimal(2000),
        user: {
          payPeriodType: 'FORTNIGHTLY' as PayPeriodType,
          taxSettings: {
            id: 'test-tax-settings',
            userId: 'test-user',
            claimedTaxFreeThreshold: true,
            isForeignResident: false,
            hasTaxFileNumber: true,
            medicareExemption: 'none',
            hecsHelpRate: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
        },
        shifts: []
      }

      const mockYearToDateTax = {
        id: 'test-ytd',
        userId: 'test-user',
        taxYear: '2023-24',
        grossIncome: new Decimal(10000),
        payGWithholding: new Decimal(1000),
        medicareLevy: new Decimal(200),
        hecsHelpAmount: new Decimal(0),
        totalWithholdings: new Decimal(1200),
        lastUpdated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrisma.payPeriod.findUnique.mockResolvedValue(mockPayPeriod as any)
      mockPrisma.taxSettings.findUnique.mockResolvedValue(mockPayPeriod.user.taxSettings as any)
      mockPrisma.yearToDateTax.findUnique.mockResolvedValue(mockYearToDateTax as any)
      mockPrisma.payPeriod.update.mockResolvedValue(mockPayPeriod as any)
      mockPrisma.yearToDateTax.update.mockResolvedValue(mockYearToDateTax as any)

      await PayPeriodTaxService.calculatePayPeriodTax('test-pay-period')

      // Should have called TaxCalculator.createFromDatabase with 2023-24 tax year
      expect(createTaxCalculatorMock)
        .toHaveBeenCalledWith(
          expect.any(Object),
          '2023-24'
        )
    })

    it('should determine correct tax year for dates around financial year boundary', async () => {
      // Test cases for Australian financial year (July 1 - June 30)
      const testCases = [
        { date: new Date('2024-06-30'), expectedTaxYear: '2023-24' }, // Last day of 2023-24
        { date: new Date('2024-07-01'), expectedTaxYear: '2024-25' }, // First day of 2024-25
        { date: new Date('2024-12-31'), expectedTaxYear: '2024-25' }, // Middle of 2024-25
        { date: new Date('2025-01-01'), expectedTaxYear: '2024-25' }, // Start of calendar year
        { date: new Date('2025-06-30'), expectedTaxYear: '2024-25' }, // Last day of 2024-25
      ]

      for (const testCase of testCases) {
        vi.clearAllMocks()

        const mockPayPeriod = {
          id: 'test-pay-period',
          userId: 'test-user',
          startDate: testCase.date,
          totalPay: new Decimal(2000),
          user: {
            payPeriodType: 'FORTNIGHTLY' as PayPeriodType,
            taxSettings: {
              id: 'test-tax-settings',
              userId: 'test-user',
              claimedTaxFreeThreshold: true,
              isForeignResident: false,
              hasTaxFileNumber: true,
              medicareExemption: 'none',
              hecsHelpRate: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            }
          },
          shifts: []
        }

        const mockYearToDateTax = {
          id: 'test-ytd',
          userId: 'test-user',
          taxYear: testCase.expectedTaxYear,
          grossIncome: new Decimal(10000),
          payGWithholding: new Decimal(1000),
          medicareLevy: new Decimal(200),
          hecsHelpAmount: new Decimal(0),
          totalWithholdings: new Decimal(1200),
          lastUpdated: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        mockPrisma.payPeriod.findUnique.mockResolvedValue(mockPayPeriod as any)
        mockPrisma.taxSettings.findUnique.mockResolvedValue(mockPayPeriod.user.taxSettings as any)
        mockPrisma.yearToDateTax.findUnique.mockResolvedValue(mockYearToDateTax as any)
        mockPrisma.payPeriod.update.mockResolvedValue(mockPayPeriod as any)
        mockPrisma.yearToDateTax.update.mockResolvedValue(mockYearToDateTax as any)

        await PayPeriodTaxService.calculatePayPeriodTax('test-pay-period')

        expect(createTaxCalculatorMock)
          .toHaveBeenCalledWith(
            expect.any(Object),
            testCase.expectedTaxYear
          )
      }
    })

    it('should use database-backed TaxCalculator instead of hardcoded coefficients', async () => {
      const mockPayPeriod = {
        id: 'test-pay-period',
        userId: 'test-user',
        startDate: new Date('2024-08-01'),
        totalPay: new Decimal(2000),
        user: {
          payPeriodType: 'FORTNIGHTLY' as PayPeriodType,
          taxSettings: {
            id: 'test-tax-settings',
            userId: 'test-user',
            claimedTaxFreeThreshold: true,
            isForeignResident: false,
            hasTaxFileNumber: true,
            medicareExemption: 'none',
            hecsHelpRate: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
        },
        shifts: []
      }

      const mockYearToDateTax = {
        id: 'test-ytd',
        userId: 'test-user',
        taxYear: '2024-25',
        grossIncome: new Decimal(10000),
        payGWithholding: new Decimal(1000),
        medicareLevy: new Decimal(200),
        hecsHelpAmount: new Decimal(0),
        totalWithholdings: new Decimal(1200),
        lastUpdated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrisma.payPeriod.findUnique.mockResolvedValue(mockPayPeriod as any)
      mockPrisma.taxSettings.findUnique.mockResolvedValue(mockPayPeriod.user.taxSettings as any)
      mockPrisma.yearToDateTax.findUnique.mockResolvedValue(mockYearToDateTax as any)
      mockPrisma.payPeriod.update.mockResolvedValue(mockPayPeriod as any)
      mockPrisma.yearToDateTax.update.mockResolvedValue(mockYearToDateTax as any)

      await PayPeriodTaxService.calculatePayPeriodTax('test-pay-period')

      // Verify TaxCalculator.createFromDatabase was called (not constructor with hardcoded values)
      expect(createTaxCalculatorMock)
        .toHaveBeenCalledWith(
          expect.objectContaining({
            claimedTaxFreeThreshold: true,
            isForeignResident: false,
            hasTaxFileNumber: true,
            medicareExemption: 'none',
          }),
          '2024-25'
        )

      // Verify the database-backed calculator's method was called
      expect(mockTaxCalculator.calculatePayPeriodTax).toHaveBeenCalledWith(
        'test-pay-period',
        new Decimal(2000),
        'FORTNIGHTLY',
        mockYearToDateTax
      )
    })

    it('should use specified tax year in preview calculation', async () => {
      const mockTaxSettings = {
        id: 'test-tax-settings',
        userId: 'test-user',
        claimedTaxFreeThreshold: true,
        isForeignResident: false,
        hasTaxFileNumber: true,
        medicareExemption: 'none',
        hecsHelpRate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const mockYearToDateTax = {
        id: 'test-ytd',
        userId: 'test-user',
        taxYear: '2023-24',
        grossIncome: new Decimal(10000),
        payGWithholding: new Decimal(1000),
        medicareLevy: new Decimal(200),
        hecsHelpAmount: new Decimal(0),
        totalWithholdings: new Decimal(1200),
        lastUpdated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrisma.taxSettings.findUnique.mockResolvedValue(mockTaxSettings as any)
      mockPrisma.yearToDateTax.findUnique.mockResolvedValue(mockYearToDateTax as any)

      await PayPeriodTaxService.previewTaxCalculation(
        'test-user',
        new Decimal(2000),
        'FORTNIGHTLY',
        '2023-24' // Specify historical tax year
      )

      // Should use the specified tax year
      expect(createTaxCalculatorMock)
        .toHaveBeenCalledWith(
          expect.any(Object),
          '2023-24'
        )
    })

    it('should perform tax calculation successfully (simulated stable factory)', async () => {
      const mockPayPeriod = {
        id: 'test-pay-period',
        userId: 'test-user',
        startDate: new Date('2024-08-01'),
        totalPay: new Decimal(2000),
        user: {
          payPeriodType: 'FORTNIGHTLY' as PayPeriodType,
          taxSettings: {
            id: 'test-tax-settings',
            userId: 'test-user',
            claimedTaxFreeThreshold: true,
            isForeignResident: false,
            hasTaxFileNumber: true,
            medicareExemption: 'none',
            hecsHelpRate: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
        },
        shifts: []
      }

      const mockYearToDateTax = {
        id: 'test-ytd',
        userId: 'test-user',
        taxYear: '2024-25',
        grossIncome: new Decimal(10000),
        payGWithholding: new Decimal(1000),
        medicareLevy: new Decimal(200),
        hecsHelpAmount: new Decimal(0),
        totalWithholdings: new Decimal(1200),
        lastUpdated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      // Factory returns calculator successfully in this architecture
      createTaxCalculatorMock.mockResolvedValue(mockTaxCalculator)

      mockPrisma.payPeriod.findUnique.mockResolvedValue(mockPayPeriod as any)
      mockPrisma.taxSettings.findUnique.mockResolvedValue(mockPayPeriod.user.taxSettings as any)
      mockPrisma.yearToDateTax.findUnique.mockResolvedValue(mockYearToDateTax as any)
      mockPrisma.payPeriod.update.mockResolvedValue(mockPayPeriod as any)
      mockPrisma.yearToDateTax.update.mockResolvedValue(mockYearToDateTax as any)

      const result = await PayPeriodTaxService.calculatePayPeriodTax('test-pay-period')

      // Should return valid results
      expect(result.breakdown.grossPay.toNumber()).toBe(2000)
      expect(result.breakdown.paygWithholding.toNumber()).toBe(300)
    })
  })
})
