import { prisma } from '@/lib/db'
import { calculatePayPeriod } from '@/lib/pay-period-utils'
import { PayPeriodType } from '@/types'

type ShiftLike = {
  payGuideName?: string | null
  startTime?: string | null
}

type PayGuideLookupValue = {
  timezone: string | null
}

export async function detectMissingPayPeriods(options: {
  userId: string
  payPeriodType: PayPeriodType | null | undefined
  shifts: ShiftLike[]
  payGuideMap: Map<string, PayGuideLookupValue>
}): Promise<number> {
  const { userId, payPeriodType, shifts, payGuideMap } = options

  if (!payPeriodType || !Array.isArray(shifts) || shifts.length === 0) {
    return 0
  }

  const candidateStarts = new Map<string, Date>()

  for (const shift of shifts) {
    if (!shift?.payGuideName || !shift?.startTime) {
      continue
    }

    const payGuide = payGuideMap.get(shift.payGuideName)
    if (!payGuide) {
      continue
    }

    const startTime = new Date(shift.startTime)
    if (Number.isNaN(startTime.getTime())) {
      continue
    }

    const { startDate } = calculatePayPeriod(startTime, payPeriodType, payGuide.timezone ?? undefined)
    const key = startDate.toISOString()

    if (!candidateStarts.has(key)) {
      candidateStarts.set(key, startDate)
    }
  }

  if (candidateStarts.size === 0) {
    return 0
  }

  const startDates = Array.from(candidateStarts.values())

  const existing = await prisma.payPeriod.findMany({
    where: {
      userId,
      startDate: { in: startDates },
    },
    select: { startDate: true },
  })

  const existingKeys = new Set(existing.map(period => period.startDate.toISOString()))

  let missingCount = 0
  for (const date of startDates) {
    if (!existingKeys.has(date.toISOString())) {
      missingCount++
    }
  }

  return missingCount
}

