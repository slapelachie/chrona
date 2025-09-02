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
  minimumShiftHours?: number // e.g., 3 for 3 hours minimum shift
  maximumShiftHours?: number // e.g., 11 for 11 hours maximum shift
  description?: string
  effectiveFrom: Date
  effectiveTo?: Date // null means ongoing
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
  dayOfWeek?: number // 0=Sunday, 1=Monday, ..., 6=Saturday
  startTime?: string // "HH:MM" local (half-open)
  endTime?: string // "HH:MM" local (exclusive)
  description?: string
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
  dayOfWeek?: number // 0=Sunday, 1=Monday, ..., 6=Saturday
  isPublicHoliday?: boolean
  startTime?: string // "HH:MM" local (half-open)
  endTime?: string // "HH:MM" local (exclusive)
  description?: string
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
  description?: string
  effectiveFrom: string // ISO string
}

export interface UpdatePayGuideRequest {
  name?: string
  baseRate?: string
  description?: string
  effectiveFrom?: string
  effectiveTo?: string
  isActive?: boolean
}

export interface PayGuideResponse extends Omit<PayGuide, 'baseRate'> {
  baseRate: string
  penaltyTimeFrames?: PenaltyTimeFrameResponse[]
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
  payGuideId: string
  name: string
  multiplier: string // Decimal as string
  dayOfWeek?: number
  startTime?: string
  endTime?: string
  description?: string
}

export interface UpdatePenaltyTimeFrameRequest {
  name?: string
  multiplier?: string
  dayOfWeek?: number
  startTime?: string
  endTime?: string
  description?: string
  isActive?: boolean
}

export interface PenaltyTimeFrameResponse
  extends Omit<PenaltyTimeFrame, 'multiplier'> {
  multiplier: string
  payGuide?: PayGuideResponse
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
// TIMEZONE TYPES
// =============================================================================

export type AustralianTimezone =
  | 'Australia/Sydney'
  | 'Australia/Melbourne'
  | 'Australia/Brisbane'
  | 'Australia/Adelaide'
  | 'Australia/Perth'
  | 'Australia/Hobart'
  | 'Australia/Darwin'

export interface TimezoneInfo {
  timezone: AustralianTimezone
  displayName: string
  offset: string
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
  startTime: Date
  endTime: Date
}

export interface RuleTimeFrame {
  id: string
  name: string
  dayOfWeek?: number
  startTime?: string
  endTime?: string
  isPublicHoliday?: boolean
}

export interface AppliedOvertime {
  timeFrameId: string
  name: string
  multiplier: Decimal
  hours: Decimal
  pay: Decimal
  startTime: Date
  endTime: Date
}
