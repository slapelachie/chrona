import {
  ShiftListItem,
  PayGuideListItem,
  PayGuideSummary,
  PayPeriodSummary,
  PayPeriodResponse,
  ShiftResponse,
  PayGuideResponse,
} from '@/types'

// Utility function to parse include parameters
export function parseIncludeParams(include?: string): Set<string> {
  if (!include) return new Set()
  return new Set(include.split(',').map((item) => item.trim()))
}

// Utility function to parse field selection parameters
export function parseFieldParams(fields?: string): Set<string> | null {
  if (!fields) return null
  return new Set(fields.split(',').map((field) => field.trim()))
}

// Transform full shift response to lightweight list item
export function transformShiftToListItem(
  shift: any, // Prisma shift with includes
  includes: Set<string> = new Set()
): ShiftListItem {
  const listItem: ShiftListItem = {
    id: shift.id,
    userId: shift.userId,
    payGuideId: shift.payGuideId,
    startTime: shift.startTime,
    endTime: shift.endTime,
    totalHours: shift.totalHours?.toString(),
    totalPay: shift.totalPay?.toString(),
    notes: shift.notes ?? undefined,
    payPeriodId: shift.payPeriodId,
  }

  // Include breakPeriods only when specifically requested
  if (includes.has('breakPeriods') && shift.breakPeriods) {
    ;(listItem as any).breakPeriods = shift.breakPeriods.map((bp: any) => ({
      id: bp.id,
      shiftId: bp.shiftId,
      startTime: bp.startTime.toISOString(),
      endTime: bp.endTime.toISOString(),
      createdAt: bp.createdAt.toISOString(),
      updatedAt: bp.updatedAt.toISOString(),
    }))
  }

  // Include payGuide summary when requested
  if (includes.has('payGuide') && shift.payGuide) {
    ;(listItem as any).payGuide = {
      id: shift.payGuide.id,
      name: shift.payGuide.name,
      baseRate: shift.payGuide.baseRate.toString(),
      minimumShiftHours: shift.payGuide.minimumShiftHours ?? undefined,
      maximumShiftHours: shift.payGuide.maximumShiftHours ?? undefined,
    }
  }

  return listItem
}

// Transform full pay guide response to lightweight list item
export function transformPayGuideToListItem(
  payGuide: any, // Prisma pay guide
  includeMetadata: boolean = false
): PayGuideListItem {
  const listItem: PayGuideListItem = {
    id: payGuide.id,
    name: payGuide.name,
    baseRate: payGuide.baseRate.toString(),
    effectiveFrom: payGuide.effectiveFrom,
    effectiveTo: payGuide.effectiveTo ?? undefined,
    isActive: payGuide.isActive,
  }

  // Add metadata fields if requested
  if (includeMetadata) {
    ;(listItem as any).minimumShiftHours =
      payGuide.minimumShiftHours ?? undefined
    ;(listItem as any).maximumShiftHours =
      payGuide.maximumShiftHours ?? undefined
    ;(listItem as any).description = payGuide.description ?? undefined
    ;(listItem as any).timezone = payGuide.timezone
    ;(listItem as any).createdAt = payGuide.createdAt
    ;(listItem as any).updatedAt = payGuide.updatedAt
  }

  return listItem
}

// Transform pay guide to summary for nested relationships
export function transformPayGuideToSummary(payGuide: any): PayGuideSummary {
  return {
    id: payGuide.id,
    name: payGuide.name,
    baseRate: payGuide.baseRate.toString(),
  }
}

// Transform pay period to summary for nested relationships
export function transformPayPeriodToSummary(payPeriod: any): PayPeriodSummary {
  return {
    id: payPeriod.id,
    startDate: payPeriod.startDate,
    endDate: payPeriod.endDate,
    status: payPeriod.status,
    totalPay: payPeriod.totalPay?.toString(),
  }
}

export function transformPayPeriodToResponse(payPeriod: any): PayPeriodResponse {
  return {
    id: payPeriod.id,
    userId: payPeriod.userId,
    startDate: payPeriod.startDate,
    endDate: payPeriod.endDate,
    status: payPeriod.status,
    totalHours: payPeriod.totalHours?.toString(),
    totalPay: payPeriod.totalPay?.toString(),
    paygWithholding: payPeriod.paygWithholding?.toString(),
    stslAmount: payPeriod.stslAmount?.toString(),
    totalWithholdings: payPeriod.totalWithholdings?.toString(),
    netPay: payPeriod.netPay?.toString(),
    actualPay: payPeriod.actualPay?.toString(),
    createdAt: payPeriod.createdAt,
    updatedAt: payPeriod.updatedAt,
    shifts: (payPeriod.shifts ?? []).map((shift: any) => ({
      id: shift.id,
      userId: shift.userId,
      payGuideId: shift.payGuideId,
      startTime: shift.startTime,
      endTime: shift.endTime,
      totalHours: shift.totalHours?.toString(),
      basePay: shift.basePay?.toString(),
      overtimePay: shift.overtimePay?.toString(),
      penaltyPay: shift.penaltyPay?.toString(),
      totalPay: shift.totalPay?.toString(),
      notes: shift.notes || undefined,
      payPeriodId: shift.payPeriodId || '',
      createdAt: shift.createdAt,
      updatedAt: shift.updatedAt,
    })),
  }
}

// Apply field selection to response object
export function applyFieldSelection<T extends Record<string, any>>(
  object: T,
  fields: Set<string> | null
): Partial<T> {
  if (!fields) return object

  const filtered: Partial<T> = {}
  for (const field of fields) {
    if (field in object) {
      filtered[field as keyof T] = object[field]
    }
  }
  return filtered
}
