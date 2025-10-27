import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { GET, POST } from '../route'
import { NextRequest } from 'next/server'
import { seedTaxConfigForYear, clearTaxConfig } from '@/lib/__tests__/helpers/tax-config'

const originalDbUrl = process.env.DATABASE_URL
const DB_URL = 'file:./tax-preview-route-test.db'

describe('Tax Preview API', () => {
  const user = {
    id: 'tax-prev-user-1',
    name: 'Prev User',
    email: 'prev-user@example.com',
    timezone: 'Australia/Sydney',
    payPeriodType: 'FORTNIGHTLY' as const,
  }
  const taxYear = (() => {
    const now = new Date()
    const y = now.getFullYear()
    return now.getMonth() >= 6 ? `${y}-${(y + 1) % 100}` : `${y - 1}-${y % 100}`
  })()

  beforeAll(async () => {
    process.env.DATABASE_URL = DB_URL
    // Ensure schema exists without regenerating client
    const { execSync } = await import('child_process')
    execSync('npx prisma db push --skip-generate', { stdio: 'pipe' })
  })

  afterAll(async () => {
    process.env.DATABASE_URL = originalDbUrl
  })

  beforeEach(async () => {
    process.env.DATABASE_URL = DB_URL
    await prisma.yearToDateTax.deleteMany()
    await prisma.taxSettings.deleteMany()
    await prisma.payPeriod.deleteMany()
    await prisma.shift.deleteMany()
    await prisma.user.deleteMany()
    await clearTaxConfig(prisma, taxYear)
    await prisma.user.create({ data: user })
    await seedTaxConfigForYear(prisma, taxYear)
  })

  afterEach(async () => {
    await prisma.yearToDateTax.deleteMany()
    await prisma.taxSettings.deleteMany()
    await prisma.payPeriod.deleteMany()
    await prisma.shift.deleteMany()
    await prisma.user.deleteMany()
    await clearTaxConfig(prisma, taxYear)
  })

  it('POST calculates preview for valid request', async () => {
    const payload = {
      grossPay: '2000',
      payPeriodType: 'FORTNIGHTLY',
    }
    const req = new NextRequest('http://localhost:3000/api/tax/preview', {
      method: 'POST',
      body: JSON.stringify(payload),
    } as any)

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.message).toContain('Tax preview calculated successfully')
    expect(body.data.preview.breakdown.grossPay).toBeDefined()
    expect(Number(body.data.preview.breakdown.totalWithholdings)).toBeGreaterThan(0)
  })

  it('POST validates input', async () => {
    const payload = { grossPay: '-1' }
    const req = new NextRequest('http://localhost:3000/api/tax/preview', {
      method: 'POST',
      body: JSON.stringify(payload),
    } as any)

    const res = await POST(req)
    const body = await res.json()
    expect(res.status).toBe(400)
    const fields = body.errors.map((e: any) => e.field)
    expect(fields).toContain('grossPay')
  })

  it('GET calculates preview from query params', async () => {
    const req = new NextRequest('http://localhost:3000/api/tax/preview?grossPay=1500&payPeriodType=WEEKLY')
    const res = await GET(req)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(Number(body.data.preview.breakdown.grossPay)).toBeCloseTo(1500, 2)
  })
})
