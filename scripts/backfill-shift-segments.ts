/*
  Backfill persisted penalty and overtime segments for existing shifts.

  Usage (dev):
    npx tsx scripts/backfill-shift-segments.ts --batch 200

  Notes:
    - Safe to re-run; it replaces segments per shift transactionally.
    - Make a backup of your SQLite DB file before running in prod.
*/

import { prisma } from '@/lib/db'
import { fetchCalculationData, calculateShiftPay, updateShiftWithCalculation, fetchShiftBreakPeriods } from '@/lib/shift-calculation'

async function backfill(batchSize = 200) {
  let offset = 0
  let processed = 0
  for (;;) {
    const shifts = await prisma.shift.findMany({
      skip: offset,
      take: batchSize,
      orderBy: { createdAt: 'asc' },
      select: { id: true, payGuideId: true, startTime: true, endTime: true },
    })

    if (shifts.length === 0) break

    for (const s of shifts) {
      try {
        const calcData = await fetchCalculationData(s.payGuideId)
        if (!calcData) continue
        const breakPeriods = await fetchShiftBreakPeriods(s.id)
        const calc = calculateShiftPay(calcData, {
          payGuideId: s.payGuideId,
          startTime: s.startTime,
          endTime: s.endTime,
          breakPeriods,
        })
        await updateShiftWithCalculation(s.id, calc)
        processed++
      } catch (e) {
        console.warn(`Backfill failed for shift ${s.id}:`, e)
      }
    }

    offset += shifts.length
  }
  console.log(`Backfill complete. Shifts processed: ${processed}`)
}

const argBatch = process.argv.indexOf('--batch') >= 0 ? Number(process.argv[process.argv.indexOf('--batch') + 1]) : undefined
backfill(argBatch || 200).then(() => prisma.$disconnect())

