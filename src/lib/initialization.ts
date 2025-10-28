import { prisma } from '@/lib/db'
import { ensureDatabaseMigrated } from '@/lib/database-migration'

export async function isAppInitialized(): Promise<boolean> {
  try {
    await ensureDatabaseMigrated()
    const userCount = await prisma.user.count()
    return userCount > 0
  } catch (e) {
    console.error('Initialization check failed:', e)
    return false
  }
}

export type InitPayload = {
  name: string
  email: string
  timezone?: string
  payPeriodType?: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY'
}

export async function performInitialSetup(payload: InitPayload) {
  await ensureDatabaseMigrated()
  const name = payload.name?.trim() || 'User'
  const email = payload.email?.trim().toLowerCase() || 'user@chrona.app'
  const timezone = payload.timezone || 'Australia/Sydney'
  const payPeriodType = payload.payPeriodType || 'WEEKLY'

  return prisma.$transaction(async (tx) => {
    const existing = await tx.user.findFirst()
    if (existing) {
      return { user: existing, created: false }
    }

    const user = await tx.user.create({
      data: { name, email, timezone, payPeriodType },
    })

    await tx.taxSettings.create({
      data: {
        userId: user.id,
        claimedTaxFreeThreshold: true,
        isForeignResident: false,
        hasTaxFileNumber: true,
        medicareExemption: 'none',
      },
    })

    return { user, created: true }
  })
}
