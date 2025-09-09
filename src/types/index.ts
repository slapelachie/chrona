import { Decimal } from 'decimal.js'

// =============================================================================
// DATABASE MODEL TYPES
// =============================================================================

export interface User {
  id: string
  name: string
  email: string
  timezone: string
  createdAt: Date
  updatedAt: Date
}

export interface PayGuide {
  id: string
  name: string
  baseRate: Decimal // Hourly base rate (e.g., 30)
  minimumShiftHours?: number | null // e.g., 3 for 3 hours minimum shift
  maximumShiftHours?: number | null // e.g., 11 for 11 hours maximum shift
  description?: string | null
  effectiveFrom: Date
  effectiveTo?: Date | null // null means ongoing
  timezone: string // IANA timezone string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface PenaltyTimeFrame {
  id: string
  payGuideId: string
  name: string
  multiplier: Decimal // e.g., 1.25 for 25% extra
  dayOfWeek?: number | null // 0=Sunday, 1=Monday, ..., 6=Saturday
  isPublicHoliday?: boolean | null
  startTime?: string | null // "HH:MM" local (half-open)
  endTime?: string | null // "HH:MM" local (exclusive)
  description?: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface OvertimeTimeFrame {
  id: string
  payGuideId: string
  name: string
  firstThreeHoursMult: Decimal // e.g., 1.25 for 25% extra (first 3 hours)
  afterThreeHoursMult: Decimal // e.g., 1.5 for 50% extra (beyond 3 hours)
  dayOfWeek?: number | null // 0=Sunday, 1=Monday, ..., 6=Saturday
  isPublicHoliday?: boolean | null
  startTime?: string | null // "HH:MM" local (half-open)
  endTime?: string | null // "HH:MM" local (exclusive)
  description?: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface PublicHoliday {
  id: string
  payGuideId: string
  name: string
  date: Date
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Shift {
  id: string
  userId: string
  payGuideId: string
  startTime: Date
  endTime: Date
  breakMinutes: number
  totalHours?: Decimal
  basePay?: Decimal
  overtimePay?: Decimal
  penaltyPay?: Decimal
  totalPay?: Decimal
  notes?: string
  payPeriodId?: string
  createdAt: Date
  updatedAt: Date
}

export interface PayPeriod {
  id: string
  userId: string
  startDate: Date
  endDate: Date
  status: PayPeriodStatus
  totalHours?: Decimal
  totalPay?: Decimal
  actualPay?: Decimal
  verified: boolean
  createdAt: Date
  updatedAt: Date
}

// =============================================================================
// BUSINESS LOGIC TYPES
// =============================================================================

export type PayPeriodStatus = 'open' | 'processing' | 'paid' | 'verified'

export interface PayCalculationResult {
  shift: {
    id?: string
    startTime: Date
    endTime: Date
    breakPeriods: BreakPeriod[]
    totalHours: Decimal
  }
  breakdown: {
    baseHours: Decimal
    basePay: Decimal
    overtimeHours: Decimal
    overtimePay: Decimal
    penaltyHours: Decimal
    penaltyPay: Decimal
    totalPay: Decimal
  }
  penalties: AppliedPenalty[]
  overtimes: AppliedOvertime[]
  payGuide: {
    name: string
    baseRate: Decimal
  }
}

export interface AppliedPenalty {
  timeFrameId: string
  name: string
  multiplier: Decimal
  hours: Decimal
  pay: Decimal
  startTime: Date
  endTime: Date
}

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

// Shift API Types
export interface CreateShiftRequest {
  payGuideId: string
  startTime: string // ISO string
  endTime: string // ISO string
  breakMinutes: number
  notes?: string
}

export interface UpdateShiftRequest {
  payGuideId?: string
  startTime?: string
  endTime?: string
  breakMinutes?: number
  notes?: string
}

export interface ShiftResponse
  extends Omit<
    Shift,
    'totalHours' | 'basePay' | 'overtimePay' | 'penaltyPay' | 'totalPay'
  > {
  totalHours?: string
  basePay?: string
  overtimePay?: string
  penaltyPay?: string
  totalPay?: string
  payGuide?: PayGuideResponse
  payPeriod?: PayPeriodResponse
}

export interface ShiftPreviewRequest {
  payGuideId: string
  startTime: string
  endTime: string
  breakMinutes: number
}

export interface ShiftPreviewResponse {
  calculation: PayCalculationResult
  errors?: string[]
}

export interface ShiftsListResponse {
  shifts: ShiftResponse[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Pay Guide API Types
export interface CreatePayGuideRequest {
  name: string
  baseRate: string // Decimal as string
  minimumShiftHours?: number
  maximumShiftHours?: number
  description?: string
  effectiveFrom: string // ISO string
  effectiveTo?: string
  timezone: string
  isActive?: boolean
}

export interface UpdatePayGuideRequest {
  name?: string
  baseRate?: string
  minimumShiftHours?: number
  maximumShiftHours?: number
  description?: string
  effectiveFrom?: string
  effectiveTo?: string
  timezone?: string
  isActive?: boolean
}

export interface PayGuideResponse extends Omit<PayGuide, 'baseRate'> {
  baseRate: string
}

export interface PayGuidesListResponse {
  payGuides: PayGuideResponse[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Penalty Time Frame API Types
export interface CreatePenaltyTimeFrameRequest {
  name: string
  multiplier: string // Decimal as string
  dayOfWeek?: number
  isPublicHoliday?: boolean
  startTime?: string
  endTime?: string
  description?: string
  isActive?: boolean
}

export interface UpdatePenaltyTimeFrameRequest {
  name?: string
  multiplier?: string
  dayOfWeek?: number
  isPublicHoliday?: boolean
  startTime?: string
  endTime?: string
  description?: string
  isActive?: boolean
}

export interface PenaltyTimeFrameResponse
  extends Omit<PenaltyTimeFrame, 'multiplier' | 'createdAt' | 'updatedAt'> {
  multiplier: string
  createdAt: string
  updatedAt: string
}

// Overtime Time Frame API Types
export interface CreateOvertimeTimeFrameRequest {
  name: string
  firstThreeHoursMult: string // Decimal as string
  afterThreeHoursMult: string // Decimal as string
  dayOfWeek?: number
  isPublicHoliday?: boolean
  startTime?: string
  endTime?: string
  description?: string
  isActive?: boolean
}

export interface UpdateOvertimeTimeFrameRequest {
  name?: string
  firstThreeHoursMult?: string
  afterThreeHoursMult?: string
  dayOfWeek?: number
  isPublicHoliday?: boolean
  startTime?: string
  endTime?: string
  description?: string
  isActive?: boolean
}

export interface OvertimeTimeFrameResponse
  extends Omit<
    OvertimeTimeFrame,
    'firstThreeHoursMult' | 'afterThreeHoursMult' | 'createdAt' | 'updatedAt'
  > {
  firstThreeHoursMult: string
  afterThreeHoursMult: string
  createdAt: string
  updatedAt: string
}

// Break Period API Types
export interface CreateBreakPeriodRequest {
  startTime: string // ISO string
  endTime: string // ISO string
}

export interface UpdateBreakPeriodRequest {
  startTime?: string // ISO string
  endTime?: string // ISO string
}

export interface BreakPeriodResponse extends Omit<BreakPeriod, 'startTime' | 'endTime' | 'createdAt' | 'updatedAt'> {
  startTime: string // ISO string
  endTime: string // ISO string
  createdAt: string // ISO string
  updatedAt: string // ISO string
}

export interface BreakPeriodsListResponse {
  breakPeriods: BreakPeriodResponse[]
  shiftId: string
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Public Holiday API Types
export interface CreatePublicHolidayRequest {
  name: string
  date: string // ISO string
  isActive?: boolean
}

export interface UpdatePublicHolidayRequest {
  name?: string
  date?: string // ISO string
  isActive?: boolean
}

export interface PublicHolidayResponse
  extends Omit<PublicHoliday, 'date' | 'createdAt' | 'updatedAt'> {
  date: string // ISO string
  createdAt: string
  updatedAt: string
}

// Pay Period API Types
export interface PayPeriodResponse
  extends Omit<PayPeriod, 'totalHours' | 'totalPay' | 'actualPay'> {
  totalHours?: string
  totalPay?: string
  actualPay?: string
  shifts?: ShiftResponse[]
}

// =============================================================================
// FORM TYPES
// =============================================================================

export interface ShiftFormData {
  payGuideId: string
  startTime: string
  endTime: string
  breakMinutes: number
  notes: string
}

export interface PayGuideFormData {
  name: string
  baseRate: string
  description: string
  effectiveFrom: string
  overtimeRules: {
    dailyRegularHours: string
    dailyFirstOvertimeRate: string
    dailyFirstOvertimeHours: string
    dailySecondOvertimeRate: string
    weeklyRegularHours: string
    weeklyOvertimeRate: string
  }
}

export interface PenaltyTimeFrameFormData {
  name: string
  multiplier: string
  dayOfWeek: string
  startTime: string
  endTime: string
  description: string
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

export interface PaginationParams {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface ShiftFilters extends PaginationParams {
  startDate?: string
  endDate?: string
  payGuideId?: string
  payPeriodId?: string
}

export interface ValidationError {
  field: string
  message: string
}

export interface ApiValidationResponse {
  errors: ValidationError[]
  message: string
}

// =============================================================================
// CURRENCY TYPES
// =============================================================================

export interface CurrencyAmount {
  amount: Decimal
  formatted: string // "$25.50"
}

export interface PayBreakdownDisplay {
  baseHours: string
  basePay: CurrencyAmount
  overtimeHours: string
  overtimePay: CurrencyAmount
  penaltyHours: string
  penaltyPay: CurrencyAmount
  totalHours: string
  totalPay: CurrencyAmount
}

export interface Period {
  start: Date
  end: Date
}

export interface BreakPeriod {
  id: string
  shiftId: string
  startTime: Date
  endTime: Date
  createdAt: Date
  updatedAt: Date
}

export interface RuleTimeFrame {
  id: string
  name: string
  dayOfWeek?: number
  startTime?: string
  endTime?: string
  isPublicHoliday?: boolean
}

export type RateRuleType = 'penalty' | 'overtime'

export interface BaseRateRule {
  period: Period
  timeFrame: PenaltyTimeFrame | OvertimeTimeFrame
  multiplier: Decimal
}

export interface PenaltyRateRule extends BaseRateRule {
  type: 'penalty'
  timeFrame: PenaltyTimeFrame
}

export interface OvertimeRateRule extends BaseRateRule {
  type: 'overtime'
  timeFrame: OvertimeTimeFrame
}

export type RateRule = PenaltyRateRule | OvertimeRateRule

export interface AppliedOvertime {
  timeFrameId: string
  name: string
  multiplier: Decimal
  hours: Decimal
  pay: Decimal
  startTime: Date
  endTime: Date
}
