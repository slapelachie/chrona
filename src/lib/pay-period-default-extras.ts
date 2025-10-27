import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/db'

export async function applyDefaultExtrasToPayPeriod(
  userId: string,
  payPeriodId: string,
  client: PrismaClient | Prisma.TransactionClient = prisma,
) {
  const existingExtras = await client.payPeriodExtra.count({ where: { payPeriodId } })
  if (existingExtras > 0) {
    return 0
  }

  const templates = await client.payPeriodExtraTemplate.findMany({
    where: { userId, active: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })

  if (templates.length === 0) {
    return 0
  }

  await client.payPeriodExtra.createMany({
    data: templates.map((template) => ({
      payPeriodId,
      type: template.label,
      description: template.description ?? null,
      amount: template.amount,
      taxable: template.taxable,
    })),
  })

  return templates.length
}
