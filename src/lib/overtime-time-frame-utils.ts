import { OvertimeTimeFrameResponse, OvertimeTimeFrame } from '@/types'

export const transformOvertimeTimeFrameToResponse = (overtimeTimeFrame: OvertimeTimeFrame & { createdAt: Date, updatedAt: Date }): OvertimeTimeFrameResponse => {
  return {
    id: overtimeTimeFrame.id,
    payGuideId: overtimeTimeFrame.payGuideId,
    name: overtimeTimeFrame.name,
    firstThreeHoursMult: overtimeTimeFrame.firstThreeHoursMult.toString(),
    afterThreeHoursMult: overtimeTimeFrame.afterThreeHoursMult.toString(),
    dayOfWeek: overtimeTimeFrame.dayOfWeek,
    isPublicHoliday: overtimeTimeFrame.isPublicHoliday,
    startTime: overtimeTimeFrame.startTime,
    endTime: overtimeTimeFrame.endTime,
    description: overtimeTimeFrame.description,
    isActive: overtimeTimeFrame.isActive,
    createdAt: overtimeTimeFrame.createdAt.toISOString(),
    updatedAt: overtimeTimeFrame.updatedAt.toISOString(),
  }
}