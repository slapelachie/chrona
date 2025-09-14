import { Decimal } from 'decimal.js'
import { prismaMock } from '../../../__tests__/setup'
import { PayPeriodTaxService } from '../pay-period-tax-service'
import { PayPeriodType } from '@/types'

// Mock the tax calculator to avoid complex setup
jest.mock('../calculations/tax-calculator', () => ({
  TaxCalculator: jest.fn().mockImplementation(() => ({
    calculatePayPeriodTax: jest.fn().mockReturnValue({
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
  })),
  DEFAULT_TAX_COEFFICIENTS: [],
  DEFAULT_HECS_THRESHOLDS: [],
}))

describe('PayPeriodTaxService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('calculatePayPeriodTax', () => {
    test('should calculate tax for a pay period successfully', async () => {
      // Mock database responses
      const mockPayPeriod = {
        id: 'test-pay-period',
        userId: 'test-user',
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

      prismaMock.payPeriod.findUnique.mockResolvedValue(mockPayPeriod as any)
      prismaMock.taxSettings.findUnique.mockResolvedValue(mockPayPeriod.user.taxSettings as any)
      prismaMock.yearToDateTax.findUnique.mockResolvedValue(mockYearToDateTax as any)
      prismaMock.payPeriod.update.mockResolvedValue(mockPayPeriod as any)
      prismaMock.yearToDateTax.update.mockResolvedValue(mockYearToDateTax as any)

      const result = await PayPeriodTaxService.calculatePayPeriodTax('test-pay-period')

      // Verify the result
      expect(result.breakdown.grossPay.toNumber()).toBe(2000)
      expect(result.breakdown.paygWithholding.toNumber()).toBe(300)
      expect(result.breakdown.medicareLevy.toNumber()).toBe(40)
      expect(result.breakdown.totalWithholdings.toNumber()).toBe(340)
      expect(result.breakdown.netPay.toNumber()).toBe(1660)

      // Verify database updates
      expect(prismaMock.payPeriod.update).toHaveBeenCalledWith({
        where: { id: 'test-pay-period' },
        data: {
          paygWithholding: new Decimal(300),
          medicareLevy: new Decimal(40),
          hecsHelpAmount: new Decimal(0),
          totalWithholdings: new Decimal(340),
          netPay: new Decimal(1660),
        }
      })

      expect(prismaMock.yearToDateTax.update).toHaveBeenCalled()
    })

    test('should throw error if pay period not found', async () => {
      prismaMock.payPeriod.findUnique.mockResolvedValue(null)

      await expect(PayPeriodTaxService.calculatePayPeriodTax('nonexistent'))
        .rejects.toThrow('Pay period not found: nonexistent')
    })

    test('should throw error if pay period has no total pay', async () => {
      const mockPayPeriod = {
        id: 'test-pay-period',
        userId: 'test-user',
        totalPay: null, // No total pay calculated
        user: { payPeriodType: 'FORTNIGHTLY' },
        shifts: []
      }

      prismaMock.payPeriod.findUnique.mockResolvedValue(mockPayPeriod as any)

      await expect(PayPeriodTaxService.calculatePayPeriodTax('test-pay-period'))
        .rejects.toThrow('Pay period test-pay-period has no calculated total pay')
    })
  })

  describe('previewTaxCalculation', () => {
    test('should preview tax calculation without saving', async () => {
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

      prismaMock.taxSettings.findUnique.mockResolvedValue(mockTaxSettings as any)
      prismaMock.yearToDateTax.findUnique.mockResolvedValue(mockYearToDateTax as any)

      const result = await PayPeriodTaxService.previewTaxCalculation(
        'test-user',
        new Decimal(2000),
        'FORTNIGHTLY'
      )

      // Should return calculation result
      expect(result.breakdown.grossPay.toNumber()).toBe(2000)
      expect(result.breakdown.paygWithholding.toNumber()).toBe(300)

      // Should not update database
      expect(prismaMock.payPeriod.update).not.toHaveBeenCalled()
      expect(prismaMock.yearToDateTax.update).not.toHaveBeenCalled()
    })
  })

  describe('processPayPeriod', () => {
    test('should process pay period with tax calculations', async () => {
      const mockPayPeriod = {
        id: 'test-pay-period',
        userId: 'test-user',
        status: 'open',
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
          { totalHours: new Decimal(40), totalPay: new Decimal(1000) },
          { totalHours: new Decimal(38), totalPay: new Decimal(1000) }
        ]
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

      prismaMock.payPeriod.findUnique
        .mockResolvedValueOnce(mockPayPeriod as any) // For calculatePayPeriodTotals
        .mockResolvedValueOnce({ ...mockPayPeriod, totalPay: new Decimal(2000) } as any) // For calculatePayPeriodTax

      prismaMock.payPeriod.update
        .mockResolvedValueOnce({ ...mockPayPeriod, totalPay: new Decimal(2000) } as any) // For calculatePayPeriodTotals
        .mockResolvedValueOnce(mockPayPeriod as any) // For tax calculation update
        .mockResolvedValueOnce({ ...mockPayPeriod, status: 'processing' } as any) // For status update

      prismaMock.taxSettings.findUnique.mockResolvedValue(mockPayPeriod.user.taxSettings as any)
      prismaMock.yearToDateTax.findUnique.mockResolvedValue(mockYearToDateTax as any)
      prismaMock.yearToDateTax.update.mockResolvedValue(mockYearToDateTax as any)

      const result = await PayPeriodTaxService.processPayPeriod('test-pay-period')

      // Should update status to processing
      expect(result.status).toBe('processing')

      // Should update pay period totals
      expect(prismaMock.payPeriod.update).toHaveBeenCalledWith({
        where: { id: 'test-pay-period' },
        data: expect.objectContaining({
          totalHours: expect.any(Decimal),
          totalPay: expect.any(Decimal),
        })
      })

      // Should update status
      expect(prismaMock.payPeriod.update).toHaveBeenCalledWith({
        where: { id: 'test-pay-period' },
        data: {
          status: 'processing',
          updatedAt: expect.any(Date)
        }
      })
    })
  })

  describe('Tax Settings Management', () => {
    test('should get user tax settings', async () => {
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

      prismaMock.taxSettings.findUnique.mockResolvedValue(mockTaxSettings as any)

      const result = await PayPeriodTaxService.getUserTaxSettings('test-user')

      expect(result).toEqual(mockTaxSettings)
    })

    test('should create default tax settings if none exist', async () => {
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

      prismaMock.taxSettings.findUnique.mockResolvedValue(null)
      prismaMock.taxSettings.create.mockResolvedValue(mockTaxSettings as any)

      const result = await PayPeriodTaxService.getUserTaxSettings('test-user')

      expect(prismaMock.taxSettings.create).toHaveBeenCalledWith({
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

    test('should update user tax settings', async () => {
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

      prismaMock.taxSettings.upsert.mockResolvedValue(updatedSettings as any)

      const result = await PayPeriodTaxService.updateUserTaxSettings('test-user', {
        claimedTaxFreeThreshold: false,
        isForeignResident: true,
        medicareExemption: 'full',
        hecsHelpRate: new Decimal(0.02),
      })

      expect(result).toEqual(updatedSettings)
      expect(prismaMock.taxSettings.upsert).toHaveBeenCalledWith({
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
    test('should get year-to-date tax summary', async () => {
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

      prismaMock.yearToDateTax.findUnique.mockResolvedValue(mockYearToDateTax as any)

      const result = await PayPeriodTaxService.getYearToDateTaxSummary('test-user')

      expect(result).toEqual(mockYearToDateTax)
    })

    test('should create year-to-date tax tracking if none exists', async () => {
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

      prismaMock.yearToDateTax.findUnique.mockResolvedValue(null)
      prismaMock.yearToDateTax.create.mockResolvedValue(mockYearToDateTax as any)

      const result = await PayPeriodTaxService.getYearToDateTaxSummary('test-user')

      expect(prismaMock.yearToDateTax.create).toHaveBeenCalledWith({
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
})