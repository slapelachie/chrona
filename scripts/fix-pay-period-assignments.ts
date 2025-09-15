/*
  Reassign shifts to the correct pay periods using the corrected fortnightly
  boundary calculation (anchor Monday UTC). Also sync affected pay periods.

  Usage (dev):
    npx tsx scripts/fix-pay-period-assignments.ts

  Notes:
    - Safe to re-run; idempotent.
    - Make a backup of your SQLite DB before running in prod.
*/

import { prisma } from '@/lib/db'
import { findOrCreatePayPeriod } from '@/lib/pay-period-utils'
import { PayPeriodSyncService } from '@/lib/pay-period-sync-service'

async function run() {
  console.log('🔧 Fixing pay period assignments for all shifts...')
  const shifts = await prisma.shift.findMany({
    select: { id: true, userId: true, startTime: true, payPeriodId: true },
    orderBy: { startTime: 'asc' },
  })

  const touchedPayPeriods = new Set<string>()
  let moved = 0

  for (const s of shifts) {
    const pp = await findOrCreatePayPeriod(s.userId, s.startTime)
    if (s.payPeriodId !== pp.id) {
      await prisma.shift.update({ where: { id: s.id }, data: { payPeriodId: pp.id } })
      if (s.payPeriodId) touchedPayPeriods.add(s.payPeriodId)
      touchedPayPeriods.add(pp.id)
      moved++
    }
  }

  if (touchedPayPeriods.size > 0) {
    console.log(`🔄 Syncing ${touchedPayPeriods.size} affected pay periods...`)
    await PayPeriodSyncService.syncMultiplePayPeriods(Array.from(touchedPayPeriods))
  }

  console.log(`✅ Done. Shifts moved: ${moved}`)
}

run().then(() => prisma.$disconnect())

