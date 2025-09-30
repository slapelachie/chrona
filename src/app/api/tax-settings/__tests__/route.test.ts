import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { GET, POST, PUT } from '../route'
import { NextRequest } from 'next/server'

const ORIGINAL_DB_URL = process.env.DATABASE_URL
const DB_URL = 'file:./tax-settings-test.db'

beforeAll(() => {
  process.env.DATABASE_URL = DB_URL
})

afterAll(() => {
  process.env.DATABASE_URL = ORIGINAL_DB_URL
})

describe('Tax Settings API', () => {
  const user = {
    id: 'tax-user-1',
    name: 'Tax User',
    email: 'tax-user@example.com',
    timezone: 'Australia/Sydney',
    payPeriodType: 'FORTNIGHTLY' as const,
  }

  beforeEach(async () => {
    await prisma.yearToDateTax.deleteMany()
    await prisma.taxSettings.deleteMany()
    await prisma.user.deleteMany()
    await prisma.user.create({ data: user })
  })

  afterEach(async () => {
    await prisma.yearToDateTax.deleteMany()
    await prisma.taxSettings.deleteMany()
    await prisma.user.deleteMany()
  })

  it('GET returns default or existing settings', async () => {
    const req = new NextRequest('http://localhost:3000/api/tax-settings')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.userId).toBe(user.id)
    expect(body.data.claimedTaxFreeThreshold).toBeTypeOf('boolean')
    expect(['none','half','full']).toContain(body.data.medicareExemption)
  })

  it('POST validates and updates settings', async () => {
    const payload = {
      claimedTaxFreeThreshold: false,
      isForeignResident: true,
      hasTaxFileNumber: false,
      medicareExemption: 'half',
      hecsHelpRate: '0.02',
    }
    const req = new NextRequest('http://localhost:3000/api/tax-settings', {
      method: 'POST',
      body: JSON.stringify(payload),
    } as any)

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.userId).toBe(user.id)
    expect(body.data.claimedTaxFreeThreshold).toBe(false)
    expect(body.data.isForeignResident).toBe(true)
    expect(body.data.hasTaxFileNumber).toBe(false)
    expect(body.data.medicareExemption).toBe('half')
    expect(body.data.hecsHelpRate).toBe('0.02')
  })

  it('POST returns validation errors for invalid data', async () => {
    const payload = {
      medicareExemption: 'quarter',
      hecsHelpRate: 'abc',
    }
    const req = new NextRequest('http://localhost:3000/api/tax-settings', {
      method: 'POST',
      body: JSON.stringify(payload),
    } as any)

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    const fields = body.errors.map((e: any) => e.field)
    expect(fields).toContain('medicareExemption')
    expect(fields).toContain('hecsHelpRate')
  })

  it('PUT partially updates settings', async () => {
    // Ensure initial settings exist
    await prisma.taxSettings.create({
      data: {
        userId: user.id,
        claimedTaxFreeThreshold: true,
        isForeignResident: false,
        hasTaxFileNumber: true,
        medicareExemption: 'none',
      },
    })

    const payload = {
      claimedTaxFreeThreshold: false,
    }
    const req = new NextRequest('http://localhost:3000/api/tax-settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    } as any)

    const res = await PUT(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.claimedTaxFreeThreshold).toBe(false)
  })
})
