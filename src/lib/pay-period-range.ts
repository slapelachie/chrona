import { PayPeriodType } from '@/types'
import { calculatePayPeriod } from '@/lib/pay-period-utils'

export type DateRange = { startDate: Date; endDate: Date }

export function calculatePayPeriodRange(
  date: Date,
  payPeriodType: PayPeriodType,
  timeZone?: string,
): DateRange {
  return calculatePayPeriod(date, payPeriodType, timeZone)
}

