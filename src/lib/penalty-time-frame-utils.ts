import { PenaltyTimeFrameResponse, PenaltyTimeFrame } from '@/types'

export const transformPenaltyTimeFrameToResponse = (penaltyTimeFrame: PenaltyTimeFrame & { createdAt: Date, updatedAt: Date }): PenaltyTimeFrameResponse => {
  return {
    id: penaltyTimeFrame.id,
    payGuideId: penaltyTimeFrame.payGuideId,
    name: penaltyTimeFrame.name,
    multiplier: penaltyTimeFrame.multiplier.toString(),
    dayOfWeek: penaltyTimeFrame.dayOfWeek,
    isPublicHoliday: penaltyTimeFrame.isPublicHoliday,
    startTime: penaltyTimeFrame.startTime,
    endTime: penaltyTimeFrame.endTime,
    description: penaltyTimeFrame.description,
    isActive: penaltyTimeFrame.isActive,
    createdAt: penaltyTimeFrame.createdAt.toISOString(),
    updatedAt: penaltyTimeFrame.updatedAt.toISOString(),
  }
}