import { OvertimeTimeFrameResponse, OvertimeTimeFrame } from '@/types'
import { transformTimeFrameBase } from '@/lib/time-frame-response'

export const transformOvertimeTimeFrameToResponse = (
  overtimeTimeFrame: OvertimeTimeFrame & { createdAt: Date; updatedAt: Date },
): OvertimeTimeFrameResponse => {
  const base = transformTimeFrameBase(overtimeTimeFrame)

  return {
    ...base,
    firstThreeHoursMult: overtimeTimeFrame.firstThreeHoursMult.toString(),
    afterThreeHoursMult: overtimeTimeFrame.afterThreeHoursMult.toString(),
  }
}
