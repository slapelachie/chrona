type Maybe<T> = T | null | undefined

export interface TimeFrameEntityBase {
  id: string
  payGuideId: string
  name: string
  dayOfWeek?: Maybe<number>
  isPublicHoliday?: Maybe<boolean>
  startTime?: Maybe<string>
  endTime?: Maybe<string>
  description?: Maybe<string>
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface TimeFrameResponseBase {
  id: string
  payGuideId: string
  name: string
  dayOfWeek?: Maybe<number>
  isPublicHoliday?: Maybe<boolean>
  startTime?: Maybe<string>
  endTime?: Maybe<string>
  description?: Maybe<string>
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export function transformTimeFrameBase(entity: TimeFrameEntityBase): TimeFrameResponseBase {
  return {
    id: entity.id,
    payGuideId: entity.payGuideId,
    name: entity.name,
    dayOfWeek: entity.dayOfWeek,
    isPublicHoliday: entity.isPublicHoliday,
    startTime: entity.startTime,
    endTime: entity.endTime,
    description: entity.description,
    isActive: entity.isActive,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  }
}

export function withAuditFields<T extends { createdAt: Date; updatedAt: Date }, R extends object>(
  entity: T,
  rest: R,
): R & { createdAt: string; updatedAt: string } {
  return {
    ...rest,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  }
}

