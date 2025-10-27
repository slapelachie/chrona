import { GET } from '../route'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { Decimal } from 'decimal.js'
import { parseCsv } from '@/lib/csv-utils'
import { vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    shift: {
      findMany: vi.fn()
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
    vi.clearAllMocks()
  })

  describe('GET', () => {
    it('should export shifts successfully', async () => {
      ;(prisma.shift.findMany as vi.Mock).mockResolvedValue(mockShifts)

      const request = new NextRequest('http://localhost:3000/api/export/shifts')
      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toContain('text/csv')
      expect(response.headers.get('Content-Disposition')).toContain('attachment')

      const responseText = await response.text()
      const rows = parseCsv(responseText)

      expect(rows).toHaveLength(2)
      expect(rows[0]).toEqual([
        'pay_guide_name',
        'start_time',
        'end_time',
        'notes',
        'breaks',
        'total_hours',
        'base_pay',
        'overtime_pay',
        'penalty_pay',
        'total_pay'
      ])

      expect(rows[1]).toEqual([
        'Test Guide',
        '2023-12-01T09:00:00.000Z',
        '2023-12-01T17:00:00.000Z',
        'Test shift',
        '2023-12-01T12:00:00.000Z|2023-12-01T13:00:00.000Z',
        '8',
        '200',
        '0',
        '50',
        '250'
      ])
    })

    it('should filter shifts by date range', async () => {
      ;(prisma.shift.findMany as vi.Mock).mockResolvedValue([])

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
          },
          payGuide: { isActive: true }
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
      ;(prisma.shift.findMany as vi.Mock).mockResolvedValue([])

      const url = new URL('http://localhost:3000/api/export/shifts')
      url.searchParams.set('payGuideId', 'guide123')

      const request = new NextRequest(url)
      await GET(request)

      expect(prisma.shift.findMany).toHaveBeenCalledWith({
        where: {
          payGuideId: 'guide123',
          payGuide: { isActive: true }
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
      ;(prisma.shift.findMany as vi.Mock).mockResolvedValue([])

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
      ;(prisma.shift.findMany as vi.Mock).mockResolvedValue([])

      const request = new NextRequest('http://localhost:3000/api/export/shifts')
      const response = await GET(request)

      expect(response.status).toBe(200)

      const responseText = await response.text()
      const rows = parseCsv(responseText)

      expect(rows).toHaveLength(1)
    })

    it('should handle database errors', async () => {
      ;(prisma.shift.findMany as vi.Mock).mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/export/shifts')
      const response = await GET(request)

      expect(response.status).toBe(500)

      const responseJson = await response.json()
      expect(responseJson.error).toBe('Failed to export shifts')
    })
  })
})
