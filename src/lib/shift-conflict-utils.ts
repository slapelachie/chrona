import type { Prisma, PrismaClient } from '@prisma/client'

export type IndexedShiftWindow = {
  index: number
  start: Date
  end: Date
}

type PrismaShiftClient = PrismaClient | Prisma.TransactionClient

type ShiftSummary = {
  id: string
  startTime: Date
  endTime: Date
}

export async function findShiftConflicts(
  client: PrismaShiftClient,
  userId: string,
  windows: IndexedShiftWindow[]
): Promise<Map<number, ShiftSummary[]>> {
  if (!userId || windows.length === 0) {
    return new Map()
  }

  const minStart = new Date(Math.min(...windows.map((window) => window.start.getTime())))
  const maxEnd = new Date(Math.max(...windows.map((window) => window.end.getTime())))

  const existingShifts = await client.shift.findMany({
    where: {
      userId,
      startTime: { lt: maxEnd },
      endTime: { gt: minStart },
    },
    select: { id: true, startTime: true, endTime: true },
  })

  if (existingShifts.length === 0) {
    return new Map()
  }

  const conflicts = new Map<number, ShiftSummary[]>()

  for (const window of windows) {
    for (const shift of existingShifts) {
      const overlaps = window.start < shift.endTime && window.end > shift.startTime
      if (!overlaps) continue

      const list = conflicts.get(window.index) ?? []
      list.push(shift)
      conflicts.set(window.index, list)
    }
  }

  return conflicts
}

export async function hasShiftConflict(
  client: PrismaShiftClient,
  userId: string,
  window: { start: Date; end: Date }
): Promise<boolean> {
  const result = await findShiftConflicts(client, userId, [
    { ...window, index: 0 },
  ])
  return (result.get(0)?.length ?? 0) > 0
}
