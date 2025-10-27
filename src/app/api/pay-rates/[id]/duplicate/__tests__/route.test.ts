import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'
import { Decimal } from 'decimal.js'
import { POST } from '../route'

class HeadersMock {
  private readonly map: Record<string, string>

  constructor(init: Record<string, string> = {}) {
    this.map = Object.fromEntries(
      Object.entries(init).map(([key, value]) => [key.toLowerCase(), value])
    )
  }

  get(name: string) {
    return this.map[name.toLowerCase()] ?? null
  }
}

class MockRequest {
  private readonly body?: any
  readonly headers: HeadersMock

  constructor(body?: any) {
    this.body = body

    if (body === undefined) {
      this.headers = new HeadersMock()
      return
    }

    const json = typeof body === 'string' ? body : JSON.stringify(body)
    this.headers = new HeadersMock({
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(json).toString(),
    })
  }

  async json() {
    if (typeof this.body === 'string') {
      return JSON.parse(this.body)
    }
    return this.body
  }
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./pay-rates-duplicate-route-test.db',
    },
  },
})

const params = (id: string) => ({ params: Promise.resolve({ id }) })

async function resetDatabase() {
  await prisma.penaltyTimeFrame.deleteMany()
  await prisma.overtimeTimeFrame.deleteMany()
  await prisma.publicHoliday.deleteMany()
  await prisma.payGuide.deleteMany()
}

async function seedPayGuideWithRelations() {
  const payGuide = await prisma.payGuide.create({
    data: {
      name: 'General Retail Award',
      baseRate: new Decimal('26.55'),
      effectiveFrom: new Date('2024-01-01T00:00:00Z'),
      effectiveTo: new Date('2024-12-31T00:00:00Z'),
      timezone: 'Australia/Sydney',
      isActive: true,
      minimumShiftHours: 3,
      maximumShiftHours: 10,
      description: 'Retail level 1',
    },
  })

  await prisma.penaltyTimeFrame.create({
    data: {
      name: 'Saturday loading',
      multiplier: new Decimal('1.25'),
      dayOfWeek: 6,
      isPublicHoliday: false,
      startTime: '13:00',
      endTime: '21:00',
      payGuideId: payGuide.id,
      isActive: true,
    },
  })

  await prisma.overtimeTimeFrame.create({
    data: {
      name: 'Daily overtime',
      firstThreeHoursMult: new Decimal('1.5'),
      afterThreeHoursMult: new Decimal('2'),
      dayOfWeek: 1,
      isPublicHoliday: false,
      startTime: '18:00',
      endTime: '23:00',
      description: 'Weekday overtime',
      payGuideId: payGuide.id,
      isActive: true,
    },
  })

  await prisma.publicHoliday.create({
    data: {
      date: new Date('2024-12-25T00:00:00Z'),
      name: 'Christmas Day',
      stateTerritory: 'NSW',
      multiplier: new Decimal('2.5'),
      payGuideId: payGuide.id,
      isActive: true,
    },
  })

  return payGuide
}

describe('Pay guide duplicate route', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = 'file:./pay-rates-duplicate-route-test.db'
    execSync('npx prisma db push --skip-generate', { stdio: 'pipe' })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    await resetDatabase()
  })

  it('duplicates a pay guide with related records and defaults to inactive', async () => {
    const source = await seedPayGuideWithRelations()

    const response = await POST(new MockRequest() as any, params(source.id) as any)
    expect(response.status).toBe(201)

    const payload = await response.json()
    const duplicated = payload.data

    expect(duplicated.id).not.toBe(source.id)
    expect(duplicated.name).toContain('Copy')
    expect(duplicated.isActive).toBe(false)

    const created = await prisma.payGuide.findUnique({
      where: { id: duplicated.id },
      include: {
        penaltyTimeFrames: true,
        overtimeTimeFrames: true,
        publicHolidays: true,
      },
    })

    expect(created).not.toBeNull()
    expect(created?.penaltyTimeFrames).toHaveLength(1)
    expect(created?.overtimeTimeFrames).toHaveLength(1)
    expect(created?.publicHolidays).toHaveLength(1)
    expect(created?.penaltyTimeFrames[0].name).toBe('Saturday loading')
    expect(created?.overtimeTimeFrames[0].firstThreeHoursMult.toString()).toBe('1.5')
    expect(created?.publicHolidays[0].date.toISOString()).toContain('2024-12-25')
  })

  it('returns 400 when provided effective dates are invalid', async () => {
    const source = await seedPayGuideWithRelations()

    const request = new MockRequest({
      effectiveFrom: '2024-05-10T00:00:00Z',
      effectiveTo: '2024-05-01T00:00:00Z',
    })

    const response = await POST(request as any, params(source.id) as any)
    expect(response.status).toBe(400)

    const payload = await response.json()
    expect(payload.message).toBe('Invalid effective date range')
    expect(Array.isArray(payload.errors)).toBe(true)
    expect(
      payload.errors.some(
        (err: any) => err.field === 'effectiveTo'
      )
    ).toBe(true)

    const count = await prisma.payGuide.count()
    expect(count).toBe(1)
  })

  it('returns 404 when source pay guide is missing', async () => {
    const response = await POST(new MockRequest() as any, params('cl00000000000000000000000') as any)
    expect(response.status).toBe(404)

    const payload = await response.json()
    expect(payload.error).toBe('Pay guide not found')
  })
})

