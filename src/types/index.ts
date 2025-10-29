import { Decimal } from 'decimal.js'

// =============================================================================
// DATABASE MODEL TYPES
// =============================================================================

export type PayPeriodType = 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY'

export interface User {
  id: string
  name: string
  email: string
  timezone: string
  payPeriodType: PayPeriodType
  defaultShiftLengthMinutes: number
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
  totalHours?: Decimal
  basePay?: Decimal
  overtimePay?: Decimal
  penaltyPay?: Decimal
  totalPay?: Decimal
  notes?: string | null
  payPeriodId?: string | null
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
  paygWithholding?: Decimal
  stslAmount?: Decimal
  totalWithholdings?: Decimal
  netPay?: Decimal
  actualPay?: Decimal
  createdAt: Date
  updatedAt: Date
}

export interface PayPeriodExtra {
  id: string
  payPeriodId: string
  type: string
  description?: string | null
  amount: Decimal
  taxable: boolean
  createdAt: Date
  updatedAt: Date
}

export interface PayPeriodExtraTemplate {
  id: string
  userId: string
  label: string
  description?: string | null
  amount: Decimal
  taxable: boolean
  active: boolean
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

// =============================================================================
// BUSINESS LOGIC TYPES
// =============================================================================

export type PayPeriodStatus = 'pending' | 'verified'

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
  notes?: string
}

export interface UpdateShiftRequest {
  payGuideId?: string
  startTime?: string
  endTime?: string
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
  breakPeriods?: BreakPeriodResponse[]
}

export interface ShiftPreviewRequest {
  payGuideId: string
  startTime: string
  endTime: string
  breakPeriods?: Array<{
    startTime: string
    endTime: string
  }>
}

export interface ShiftPreviewResponse {
  calculation: PayCalculationResult
  errors?: string[]
}

export interface ShiftsListResponse {
  shifts: ShiftListItem[]
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

export interface DuplicatePayGuideRequest {
  name?: string
  effectiveFrom?: string
  effectiveTo?: string | null
  isActive?: boolean
}

export interface PayGuideResponse extends Omit<PayGuide, 'baseRate'> {
  baseRate: string
}

export interface PayGuidesListResponse {
  payGuides: PayGuideListItem[]
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

export interface BreakPeriodResponse
  extends Omit<
    BreakPeriod,
    'startTime' | 'endTime' | 'createdAt' | 'updatedAt'
  > {
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
  extends Omit<
    PayPeriod,
    | 'totalHours'
    | 'totalPay'
    | 'paygWithholding'
    | 'stslAmount'
    | 'totalWithholdings'
    | 'netPay'
    | 'actualPay'
  > {
  totalHours?: string
  totalPay?: string
  paygWithholding?: string
  stslAmount?: string
  totalWithholdings?: string
  netPay?: string
  actualPay?: string
  shifts?: ShiftResponse[]
  extras?: PayPeriodExtraResponse[]
}

export interface PayPeriodExtraResponse
  extends Omit<PayPeriodExtra, 'amount' | 'createdAt' | 'updatedAt'> {
  amount: string
  createdAt: string
  updatedAt: string
}

export interface PayPeriodExtraTemplateResponse
  extends Omit<
    PayPeriodExtraTemplate,
    'amount' | 'createdAt' | 'updatedAt'
  > {
  amount: string
  createdAt: string
  updatedAt: string
}

export interface CreatePayPeriodExtraTemplateRequest {
  label: string
  description?: string | null
  amount: string
  taxable?: boolean
  active?: boolean
  sortOrder?: number
}

export interface UpdatePayPeriodExtraTemplateRequest {
  label?: string
  description?: string | null
  amount?: string
  taxable?: boolean
  active?: boolean
  sortOrder?: number
}

export interface CreatePayPeriodRequest {
  startDate: string // ISO string
  endDate: string // ISO string
  status?: PayPeriodStatus // Optional, defaults to "open"
}

export interface UpdatePayPeriodRequest {
  startDate?: string // ISO string - Allow date corrections
  endDate?: string // ISO string - Allow date corrections
  status?: PayPeriodStatus // Allow status transitions
  actualPay?: string // For pay verification (Decimal as string)
}

export interface PayPeriodListItem {
  id: string
  startDate: Date
  endDate: Date
  status: PayPeriodStatus
  totalHours?: string
  totalPay?: string
  netPay?: string
  actualPay?: string
  shiftsCount?: number // Count of shifts in period
}

export interface PayPeriodsListResponse {
  payPeriods: PayPeriodListItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Tax Settings API Types
export interface CreateTaxSettingsRequest {
  claimedTaxFreeThreshold?: boolean
  isForeignResident?: boolean
  hasTaxFileNumber?: boolean
  medicareExemption?: 'none' | 'half' | 'full'
}

export interface UpdateTaxSettingsRequest {
  claimedTaxFreeThreshold?: boolean
  isForeignResident?: boolean
  hasTaxFileNumber?: boolean
  medicareExemption?: 'none' | 'half' | 'full'
}

export type TaxSettingsResponse = TaxSettings

// Tax Calculation API Types
export interface TaxCalculationRequest {
  payPeriodId: string
}

export interface TaxCalculationResponse {
  taxCalculation: TaxCalculationResult
  success: boolean
}

export interface TaxPreviewRequest {
  grossPay: string // Decimal as string
  payPeriodType: PayPeriodType
}

export interface TaxPreviewResponse {
  preview: TaxCalculationResult
  errors?: string[]
}

// =============================================================================
// FORM TYPES
// =============================================================================

export interface ShiftFormData {
  payGuideId: string
  startTime: string
  endTime: string
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

export interface FieldSelectionParams {
  fields?: string // Comma-separated list of fields
  include?: string // Comma-separated list of related data to include
}

export interface ShiftFilters extends PaginationParams, FieldSelectionParams {
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
// LIGHTWEIGHT DTO TYPES
// =============================================================================

// Summary DTOs for nested relationships
export interface PayGuideSummary {
  id: string
  name: string
  baseRate: string
}

export interface PayPeriodSummary {
  id: string
  startDate: Date
  endDate: Date
  status: PayPeriodStatus
  totalPay?: string
}

export interface FinancialYearPayPeriodStat {
  id: string
  startDate: string
  endDate: string
  status: PayPeriodStatus
  totals: {
    gross: string
    rosteredGross: string
    net: string
    actual: string
    variance: string
    withholdings: string
    payg: string
    stsl: string
    extrasTaxable: string
    extrasNonTaxable: string
    extrasPositive: string
    extrasNegative: string
  }
  hours: {
    total: string
    overtime: string
    penalty: string
    ordinary: string
  }
  breakdown: {
    basePay: string
    overtimePay: string
    penaltyPay: string
    averageRate: string
  }
}

export interface FinancialYearComparisonSnapshot {
  scope: 'financialYear' | 'quarter'
  label: string
  periodLabel: string
  taxYear: string
  quarter: number | null
  totals: {
    gross: string
    net: string
    actual: string
    variance: string
    withholdings: string
    payg: string
    stsl: string
    extrasTaxable: string
    extrasNonTaxable: string
    extrasPositive: string
    extrasNegative: string
    basePay: string
    overtimePay: string
    penaltyPay: string
  }
  hours: {
    total: string
    overtime: string
    penalty: string
    ordinary: string
    averagePerPeriod: string
  }
  averages: {
    grossPerPeriod: string
    netPerPeriod: string
    actualPerPeriod: string
    payRate: string
    medianPayRate: string
    medianGrossPerPeriod: string
  }
}

export interface FinancialYearStatisticsResponse {
  taxYear: string
  quarter: number | null
  availableTaxYears: string[]
  range: {
    start: string
    end: string
    currentDate: string
  }
  user: {
    id: string
    name: string | null
    payPeriodType: PayPeriodType
  }
  totals: {
    gross: string
    net: string
    actual: string
    variance: string
    withholdings: string
    payg: string
    stsl: string
    extrasTaxable: string
    extrasNonTaxable: string
    extrasPositive: string
    extrasNegative: string
    basePay: string
    overtimePay: string
    penaltyPay: string
  }
  hours: {
    total: string
    overtime: string
    penalty: string
    ordinary: string
    averagePerPeriod: string
  }
  averages: {
    grossPerPeriod: string
    netPerPeriod: string
    actualPerPeriod: string
    payRate: string
    medianPayRate: string
    medianGrossPerPeriod: string
  }
  statusCounts: Record<PayPeriodStatus, number>
  payPeriods: FinancialYearPayPeriodStat[]
  comparison: FinancialYearComparisonSnapshot | null
}

// Lightweight response types for list views
export interface ShiftListItem {
  id: string
  userId: string
  payGuideId: string
  payPeriodId?: string | null
  startTime: Date
  endTime: Date
  totalHours?: string | null
  totalPay?: string | null
  notes?: string | null
  payGuide?: {
    id: string
    name: string
    baseRate?: string
    minimumShiftHours?: number | null
    maximumShiftHours?: number | null
  }
}

export interface PayGuideListItem {
  id: string
  name: string
  baseRate: string
  effectiveFrom: Date
  effectiveTo?: Date
  isActive: boolean
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

// =============================================================================
// TAX CALCULATION TYPES
// =============================================================================

export type TaxScale =
  | 'scale1'
  | 'scale2'
  | 'scale3'
  | 'scale4'
  | 'scale5'
  | 'scale6'

export interface TaxSettings {
  id: string
  userId: string
  claimedTaxFreeThreshold: boolean
  isForeignResident: boolean
  hasTaxFileNumber: boolean
  medicareExemption: 'none' | 'half' | 'full'
  createdAt: Date
  updatedAt: Date
}

export interface TaxCoefficient {
  scale: TaxScale
  earningsFrom: Decimal // Weekly earnings threshold
  earningsTo: Decimal | null // null for highest bracket
  coefficientA: Decimal // Multiplier
  coefficientB: Decimal // Constant adjustment
}

export interface TaxCalculationResult {
  payPeriod: {
    id: string
    grossPay: Decimal
    payPeriodType: PayPeriodType
  }
  breakdown: {
    grossPay: Decimal
    paygWithholding: Decimal
    stslAmount: Decimal
    totalWithholdings: Decimal
    netPay: Decimal
  }
  taxScale: TaxScale
  yearToDate: {
    grossIncome: Decimal
    totalWithholdings: Decimal
  }
}

export interface YearToDateTax {
  id: string
  userId: string
  taxYear: string // e.g., "2024-25"
  grossIncome: Decimal
  payGWithholding: Decimal
  stslAmount: Decimal
  totalWithholdings: Decimal
  lastUpdated: Date
  createdAt: Date
  updatedAt: Date
}

// Tax rate configuration for ATO compliance
export interface TaxRateConfig {
  taxYear: string
  stslRates?: StslRate[]
  coefficients: TaxCoefficient[]
}

// STSL component rates (Schedule 8), two scales:
//  - WITH_TFT_OR_FR: claimed tax-free threshold OR foreign resident
//  - NO_TFT: did not claim tax-free threshold
export type StslScale = 'WITH_TFT_OR_FR' | 'NO_TFT'
export interface StslRate {
  scale: StslScale
  earningsFrom: Decimal
  earningsTo: Decimal | null
  coefficientA: Decimal
  coefficientB: Decimal
  description?: string
}

// =============================================================================
// EXPORT/IMPORT TYPES
// =============================================================================

export type ConflictResolution = 'skip' | 'overwrite' | 'rename'

export interface ImportShiftsRequest {
  shifts: Array<{
    payGuideName: string
    startTime: string
    endTime: string
    notes?: string
    breakPeriods?: Array<{
      startTime: string
      endTime: string
    }>
  }>
  options: {
    conflictResolution: ConflictResolution
    validatePayGuides: boolean
  }
}

export interface ImportPayGuidesRequest {
  payGuides: Array<{
    name: string
    baseRate: string
    minimumShiftHours?: number
    maximumShiftHours?: number
    description?: string
    effectiveFrom: string
    effectiveTo?: string
    timezone?: string
    penaltyTimeFrames?: Array<{
      name: string
      multiplier: string
      dayOfWeek?: number
      startTime?: string
      endTime?: string
      isPublicHoliday?: boolean
      description?: string
    }>
    overtimeTimeFrames?: Array<{
      name: string
      firstThreeHoursMult: string
      afterThreeHoursMult: string
      dayOfWeek?: number
      startTime?: string
      endTime?: string
      isPublicHoliday?: boolean
      description?: string
    }>
    publicHolidays?: Array<{
      name: string
      date: string
    }>
  }>
  options: {
    conflictResolution: ConflictResolution
    activateImported: boolean
  }
}

export interface ImportPayPeriodsRequest {
  payPeriods: Array<{
    startDate: string
    endDate: string
    status: PayPeriodStatus
    totalHours?: string
    totalPay?: string
    paygWithholding?: string
    stslAmount?: string
    totalWithholdings?: string
    netPay?: string
    actualPay?: string
  }>
  extras?: Array<{
    periodStartDate: string
    periodEndDate?: string
    type: string
    description?: string
    amount: string
    taxable: boolean
  }>
  options: {
    conflictResolution: ConflictResolution
  }
}

export interface ImportPreferencesRequest {
  user?: {
    name?: string
    email?: string
    timezone?: string
    payPeriodType?: PayPeriodType
    defaultShiftLengthMinutes?: number
  }
  defaultExtras?: Array<{
    label: string
    description?: string
    amount: string
    taxable: boolean
    active?: boolean
    sortOrder?: number
  }>
  options: {
    conflictResolution: ConflictResolution
  }
}

export interface ImportTaxDataRequest {
  taxSettings?: {
    claimedTaxFreeThreshold?: boolean
    isForeignResident?: boolean
    hasTaxFileNumber?: boolean
    medicareExemption?: 'none' | 'half' | 'full'
  }
  taxCoefficients?: Array<{
    taxYear: string
    scale: string
    earningsFrom: string
    earningsTo?: string
    coefficientA: string
    coefficientB: string
    description?: string
  }>
  stslRates?: Array<{
    taxYear: string
    scale: string
    earningsFrom: string
    earningsTo?: string
    coefficientA: string
    coefficientB: string
    description?: string
  }>
  taxRateConfigs?: Array<{
    taxYear: string
    description?: string
  }>
  options: {
    conflictResolution: ConflictResolution
    replaceExisting: boolean
  }
}

export interface ImportValidationError {
  type: 'validation' | 'conflict' | 'dependency'
  field: string
  message: string
  index?: number
  conflictWith?: string
}

export interface ImportResult {
  success: boolean
  summary: {
    totalProcessed: number
    successful: number
    skipped: number
    failed: number
  }
  errors: ImportValidationError[]
  warnings: ImportValidationError[]
  created: string[]
  updated: string[]
  skipped: string[]
}
