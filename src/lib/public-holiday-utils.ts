import { PublicHolidayResponse, PublicHoliday } from '@/types'

export const transformPublicHolidayToResponse = (publicHoliday: PublicHoliday & { createdAt: Date, updatedAt: Date }): PublicHolidayResponse => {
  return {
    id: publicHoliday.id,
    payGuideId: publicHoliday.payGuideId,
    name: publicHoliday.name,
    date: publicHoliday.date.toISOString(),
    isActive: publicHoliday.isActive,
    createdAt: publicHoliday.createdAt.toISOString(),
    updatedAt: publicHoliday.updatedAt.toISOString(),
  }
}