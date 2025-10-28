import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/database-migration', () => ({
  ensureDatabaseMigrated: vi.fn().mockResolvedValue(undefined),
}))

interface MockUser {
  id: string
  name: string
  email: string
  timezone: string
  payPeriodType: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY'
}

interface MockTaxSettings {
  id: string
  userId: string
  claimedTaxFreeThreshold: boolean
  isForeignResident: boolean
  hasTaxFileNumber: boolean
  medicareExemption: string
}

const state: { user: MockUser | null; taxSettings: MockTaxSettings[]; userCounter: number; taxSettingsCounter: number } = {
  user: null,
  taxSettings: [],
  userCounter: 1,
  taxSettingsCounter: 1,
}

vi.mock('@/lib/db', () => {
  const prisma = {
    user: {
      findFirst: vi.fn(async () => state.user),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => (state.user && state.user.id === where.id ? state.user : null)),
      count: vi.fn(async () => (state.user ? 1 : 0)),
      create: vi.fn(async ({ data }: { data: Omit<MockUser, 'id'> }) => {
        const created: MockUser = { id: `user_${state.userCounter++}`, ...data }
        state.user = created
        return created
      }),
      deleteMany: vi.fn(async () => {
        state.user = null
        return { count: 1 }
      }),
    },
    taxSettings: {
      create: vi.fn(async ({ data }: { data: Omit<MockTaxSettings, 'id'> }) => {
        const created: MockTaxSettings = { id: `tax_${state.taxSettingsCounter++}`, ...data }
        state.taxSettings.push(created)
        return created
      }),
      findFirst: vi.fn(async ({ where }: { where: { userId: string } }) =>
        state.taxSettings.find((item) => item.userId === where.userId) ?? null,
      ),
      deleteMany: vi.fn(async () => {
        const count = state.taxSettings.length
        state.taxSettings = []
        return { count }
      }),
    },
    $transaction: async <T>(callback: (tx: any) => Promise<T>) => callback(prisma),
  }

  return { prisma }
})

import { prisma } from '@/lib/db'
import { isAppInitialized, performInitialSetup } from '@/lib/initialization'
import { ensureDatabaseMigrated } from '@/lib/database-migration'

describe('initialization flow', () => {
  beforeEach(async () => {
    state.user = null
    state.taxSettings = []
    state.userCounter = 1
    state.taxSettingsCounter = 1
    await prisma.taxSettings.deleteMany()
    await prisma.user.deleteMany()
    vi.mocked(ensureDatabaseMigrated).mockClear()
  })

  it('creates a user and supporting records when no user exists', async () => {
    const result = await performInitialSetup({
      name: 'Test User',
      email: 'test@example.com',
      timezone: 'Australia/Sydney',
      payPeriodType: 'FORTNIGHTLY',
    })

    expect(result.created).toBe(true)
    expect(result.user.email).toBe('test@example.com')

    const stored = await prisma.user.findUnique({ where: { id: result.user.id } })
    expect(stored).not.toBeNull()

    const taxSettings = await prisma.taxSettings.findFirst({ where: { userId: result.user.id } })
    expect(taxSettings).not.toBeNull()
  })

  it('is idempotent when a user already exists', async () => {
    const first = await performInitialSetup({
      name: 'Original',
      email: 'existing@example.com',
      timezone: 'Australia/Sydney',
      payPeriodType: 'WEEKLY',
    })

    expect(first.created).toBe(true)

    const second = await performInitialSetup({
      name: 'Another',
      email: 'another@example.com',
      timezone: 'Australia/Sydney',
      payPeriodType: 'MONTHLY',
    })

    expect(second.created).toBe(false)
    expect(second.user.id).toBe(first.user.id)

    const userCount = await prisma.user.count()
    expect(userCount).toBe(1)

    expect(ensureDatabaseMigrated).toHaveBeenCalled()
  })

  it('reflects initialization state correctly', async () => {
    const before = await isAppInitialized()
    expect(before).toBe(false)

    await performInitialSetup({
      name: 'State Check',
      email: 'state@example.com',
      timezone: 'Australia/Sydney',
      payPeriodType: 'WEEKLY',
    })

    const after = await isAppInitialized()
    expect(after).toBe(true)
  })
})
