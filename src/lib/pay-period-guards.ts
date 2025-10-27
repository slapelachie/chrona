import { prisma } from '@/lib/db'

export class PayPeriodLockedError extends Error {
  constructor(message = 'Pay period is verified and locked') {
    super(message)
    this.name = 'PayPeriodLockedError'
  }
}

export async function requirePayPeriodEditable(payPeriodId?: string | null): Promise<void> {
  if (!payPeriodId) return

  const payPeriod = await prisma.payPeriod.findUnique({
    where: { id: payPeriodId },
    select: { status: true },
  })

  if (payPeriod?.status === 'verified') {
    throw new PayPeriodLockedError()
  }
}

