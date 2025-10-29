import { PublicHolidayResponse, PublicHoliday } from '@/types'
import { withAuditFields } from '@/lib/time-frame-response'

export const transformPublicHolidayToResponse = (
  publicHoliday: PublicHoliday & { createdAt: Date; updatedAt: Date },
): PublicHolidayResponse => {
  return withAuditFields(publicHoliday, {
    id: publicHoliday.id,
    payGuideId: publicHoliday.payGuideId,
    name: publicHoliday.name,
    date: publicHoliday.date.toISOString(),
    isActive: publicHoliday.isActive,
  })
}
