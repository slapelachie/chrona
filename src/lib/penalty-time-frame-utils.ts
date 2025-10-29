import { PenaltyTimeFrameResponse, PenaltyTimeFrame } from '@/types'
import { transformTimeFrameBase } from '@/lib/time-frame-response'

export const transformPenaltyTimeFrameToResponse = (
  penaltyTimeFrame: PenaltyTimeFrame & { createdAt: Date; updatedAt: Date },
): PenaltyTimeFrameResponse => {
  const base = transformTimeFrameBase(penaltyTimeFrame)

  return {
    ...base,
    multiplier: penaltyTimeFrame.multiplier.toString(),
  }
}
