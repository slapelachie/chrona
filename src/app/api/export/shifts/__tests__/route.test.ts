import { GET } from '../route'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { Decimal } from 'decimal.js'

jest.mock('@/lib/db', () => ({
  prisma: {
    shift: {
      findMany: jest.fn()
    }
  }
}))

const mockShifts = [
  {
    id: 'shift1',
    payGuideId: 'guide1',
    startTime: new Date('2023-12-01T09:00:00Z'),
    endTime: new Date('2023-12-01T17:00:00Z'),
    totalHours: new Decimal('8.0'),
    basePay: new Decimal('200.00'),
    overtimePay: new Decimal('0.00'),
    penaltyPay: new Decimal('50.00'),
    totalPay: new Decimal('250.00'),
    notes: 'Test shift',
    payGuide: {
      name: 'Test Guide',
      isActive: true
    },
    breakPeriods: [
      {
        startTime: new Date('2023-12-01T12:00:00Z'),
        endTime: new Date('2023-12-01T13:00:00Z')
      }
    ],
    penaltySegments: [
      {
        name: 'Weekend',
        multiplier: new Decimal('1.5'),
        hours: new Decimal('2.0'),
        pay: new Decimal('50.00'),
        startTime: new Date('2023-12-01T15:00:00Z'),
        endTime: new Date('2023-12-01T17:00:00Z')
      }
    ],
    overtimeSegments: []
  }
]

describe('/api/export/shifts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET', () => {
    it('should export shifts successfully', async () => {
      ;(prisma.shift.findMany as jest.Mock).mockResolvedValue(mockShifts)

      const request = new NextRequest('http://localhost:3000/api/export/shifts')
      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('application/json')
      expect(response.headers.get('Content-Disposition')).toContain('attachment')

      const responseText = await response.text()
      const exportData = JSON.parse(responseText)

      expect(exportData.shifts).toHaveLength(1)
      expect(exportData.shifts[0]).toMatchObject({
        id: 'shift1',
        payGuideId: 'guide1',
        payGuideName: 'Test Guide',
        startTime: '2023-12-01T09:00:00.000Z',
        endTime: '2023-12-01T17:00:00.000Z',
        totalHours: '8',
        basePay: '200',
        overtimePay: '0',
        penaltyPay: '50',
        totalPay: '250',
        notes: 'Test shift'
      })

      expect(exportData.shifts[0].breakPeriods).toHaveLength(1)
      expect(exportData.shifts[0].penaltySegments).toHaveLength(1)
      expect(exportData.shifts[0].overtimeSegments).toHaveLength(0)

      expect(exportData.metadata).toMatchObject({
        totalShifts: 1,
        dateRange: {
          earliest: '2023-12-01T09:00:00.000Z',
          latest: '2023-12-01T09:00:00.000Z'
        }
      })
    })

    it('should filter shifts by date range', async () => {
      ;(prisma.shift.findMany as jest.Mock).mockResolvedValue([])

      const url = new URL('http://localhost:3000/api/export/shifts')
      url.searchParams.set('startDate', '2023-12-01T00:00:00Z')
      url.searchParams.set('endDate', '2023-12-31T23:59:59Z')

      const request = new NextRequest(url)
      await GET(request)

      expect(prisma.shift.findMany).toHaveBeenCalledWith({
        where: {
          startTime: {
            gte: new Date('2023-12-01T00:00:00Z'),
            lte: new Date('2023-12-31T23:59:59Z')
          }
        },
        include: {
          payGuide: { select: { name: true, isActive: true } },
          breakPeriods: { orderBy: { startTime: 'asc' } },
          penaltySegments: { orderBy: { startTime: 'asc' } },
          overtimeSegments: { orderBy: { startTime: 'asc' } }
        },
        orderBy: { startTime: 'desc' }
      })
    })

    it('should filter shifts by pay guide', async () => {
      ;(prisma.shift.findMany as jest.Mock).mockResolvedValue([])

      const url = new URL('http://localhost:3000/api/export/shifts')
      url.searchParams.set('payGuideId', 'guide123')

      const request = new NextRequest(url)
      await GET(request)

      expect(prisma.shift.findMany).toHaveBeenCalledWith({
        where: {
          payGuideId: 'guide123'
        },
        include: {
          payGuide: { select: { name: true, isActive: true } },
          breakPeriods: { orderBy: { startTime: 'asc' } },
          penaltySegments: { orderBy: { startTime: 'asc' } },
          overtimeSegments: { orderBy: { startTime: 'asc' } }
        },
        orderBy: { startTime: 'desc' }
      })
    })

    it('should include inactive pay guides when requested', async () => {
      ;(prisma.shift.findMany as jest.Mock).mockResolvedValue([])

      const url = new URL('http://localhost:3000/api/export/shifts')
      url.searchParams.set('includeInactive', 'true')

      const request = new NextRequest(url)
      await GET(request)

      expect(prisma.shift.findMany).toHaveBeenCalledWith({
        where: {},
        include: {
          payGuide: { select: { name: true, isActive: true } },
          breakPeriods: { orderBy: { startTime: 'asc' } },
          penaltySegments: { orderBy: { startTime: 'asc' } },
          overtimeSegments: { orderBy: { startTime: 'asc' } }
        },
        orderBy: { startTime: 'desc' }
      })
    })

    it('should handle empty shifts array', async () => {
      ;(prisma.shift.findMany as jest.Mock).mockResolvedValue([])

      const request = new NextRequest('http://localhost:3000/api/export/shifts')
      const response = await GET(request)

      expect(response.status).toBe(200)

      const responseText = await response.text()
      const exportData = JSON.parse(responseText)

      expect(exportData.shifts).toHaveLength(0)
      expect(exportData.metadata.totalShifts).toBe(0)
    })

    it('should handle database errors', async () => {
      ;(prisma.shift.findMany as jest.Mock).mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/export/shifts')
      const response = await GET(request)

      expect(response.status).toBe(500)

      const responseJson = await response.json()
      expect(responseJson.error).toBe('Failed to export shifts')
    })
  })
})