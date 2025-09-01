import { Prisma } from '@prisma/client'
import Decimal from 'decimal.js'

// Re-export Prisma types for convenience
export type User = Prisma.UserGetPayload<Record<string, never>>
export type PayGuide = Prisma.PayGuideGetPayload<Record<string, never>>
export type PenaltyTimeFrame = Prisma.PenaltyTimeFrameGetPayload<Record<string, never>>
export type TaxBracket = Prisma.TaxBracketGetPayload<Record<string, never>>
export type HECSThreshold = Prisma.HECSThresholdGetPayload<Record<string, never>>
export type PublicHoliday = Prisma.PublicHolidayGetPayload<Record<string, never>>
export type Shift = Prisma.ShiftGetPayload<Record<string, never>>
export type PayPeriod = Prisma.PayPeriodGetPayload<Record<string, never>>
export type PayVerification = Prisma.PayVerificationGetPayload<Record<string, never>>

// Extended types with relations
export type PayGuideWithPenalties = Prisma.PayGuideGetPayload<{
  include: {
    penaltyTimeFrames: true
  }
}>

export type ShiftWithRelations = Prisma.ShiftGetPayload<{
  include: {
    user: true
    payGuide: {
      include: {
        penaltyTimeFrames: true
      }
    }
  }
}>

export type PayPeriodWithShifts = Prisma.PayPeriodGetPayload<{
  include: {
    shifts: {
      include: {
        shift: {
          include: {
            payGuide: true
          }
        }
      }
    }
    payVerifications: true
  }
}>

// Form types
export interface ShiftFormData {
  startTime: Date
  endTime: Date
  breakMinutes: number
  shiftType: 'REGULAR' | 'OVERTIME' | 'DOUBLE_TIME' | 'PUBLIC_HOLIDAY' | 'WEEKEND'
  notes?: string
}

export interface PayVerificationFormData {
  actualGrossPay: number
  actualTax: number
  actualNetPay: number
  actualSuper?: number
  actualHECS?: number
  paySlipReference?: string
  notes?: string
}

export interface PenaltyTimeFrameFormData {
  name: string
  description?: string
  startTime: string  // HH:MM format
  endTime: string    // HH:MM format
  penaltyRate: string // Decimal as string for form handling
  dayOfWeek?: number  // 0=Sunday, 1=Monday, etc. null=all days
  priority: number
  isActive: boolean
}

// Enhanced Calculation Types with Decimal.js
export interface ShiftCalculation {
  totalMinutes: number
  regularHours: Decimal
  overtimeHours: Decimal
  penaltyHours: Decimal
  regularPay: Decimal
  overtimePay: Decimal
  penaltyPay: Decimal
  casualLoading: Decimal
  grossPay: Decimal
  breakdown: PayBreakdown
}

export interface CustomPenaltyBreakdown {
  id: string
  name: string
  hours: Decimal
  rate: Decimal
  amount: Decimal
}

export interface PayBreakdown {
  baseRate: Decimal
  regularHours: { hours: Decimal; rate: Decimal; amount: Decimal }
  overtime1_5x: { hours: Decimal; rate: Decimal; amount: Decimal }
  overtime2x: { hours: Decimal; rate: Decimal; amount: Decimal }
  customPenalties: CustomPenaltyBreakdown[]
  casualLoading: { rate: Decimal; amount: Decimal }
}

export interface TaxCalculation {
  grossPay: Decimal
  incomeTax: Decimal
  medicareLevy: Decimal
  hecsRepayment: Decimal
  totalDeductions: Decimal
  netPay: Decimal
  breakdown: TaxBreakdown
}

export interface TaxBreakdown {
  taxableIncome: Decimal
  taxFreeThreshold: Decimal
  taxBrackets: TaxBracketCalculation[]
  medicareLevy: {
    rate: Decimal
    amount: Decimal
    exemption: boolean
  }
  hecsRepayment: {
    threshold: Decimal
    rate: Decimal
    amount: Decimal
    applicable: boolean
  }
  yearToDateTotals?: {
    grossIncome: Decimal
    incomeTax: Decimal
    medicareLevy: Decimal
    hecsRepayment: Decimal
  }
}

export interface TaxBracketCalculation {
  minIncome: Decimal
  maxIncome: Decimal | null
  taxRate: Decimal
  baseTax: Decimal
  taxableAmountInBracket: Decimal
  taxOnBracket: Decimal
}

export interface PayPeriodCalculation {
  totalHours: Decimal
  regularHours: Decimal
  overtimeHours: Decimal
  penaltyHours: Decimal
  grossPay: Decimal
  superannuation: Decimal
  incomeTax: Decimal
  medicareLevy: Decimal
  hecsRepayment: Decimal
  netPay: Decimal
  shiftCalculations: ShiftCalculationWithId[]
  taxCalculation: TaxCalculation
  summary: PayPeriodSummary
}

export interface ShiftCalculationWithId extends ShiftCalculation {
  shiftId: string
  shift: Shift
}

export interface PayPeriodSummary {
  totalShifts: number
  averageHoursPerShift: Decimal
  hourlyEarningsAverage: Decimal
  casualLoadingTotal: Decimal
  overtimePercentage: Decimal
  penaltyPercentage: Decimal
  effectiveTaxRate: Decimal
  breakdown: {
    regularPay: Decimal
    overtimePay: Decimal
    penaltyPay: Decimal
    casualLoading: Decimal
    superannuation: Decimal
    totalDeductions: Decimal
  }
}

export interface TaxCalculationInput {
  grossAnnualIncome: number
  claimsTaxFreeThreshold: boolean
  hasHECSDebt: boolean
  hasStudentFinancialSupplement: boolean
  medicareLevyExemption: boolean
}

// Dashboard types
export interface DashboardStats {
  currentWeekHours: number
  currentPayPeriodEarnings: number
  upcomingShifts: number
  pendingVerifications: number
}

// Date and Shift Utility Types
export interface PayPeriodDates {
  startDate: Date
  endDate: Date
  payDate: Date
  periodNumber: number
  year: number
}

export interface BusinessDay {
  date: Date
  isBusinessDay: boolean
  isPublicHoliday: boolean
  holidayName?: string
}

export interface WeeklyHours {
  week: number
  startDate: Date
  endDate: Date
  totalHours: Decimal
  shifts: Shift[]
}

export interface ShiftValidation {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export interface ShiftConflict {
  shift: Shift
  conflictType: 'overlap' | 'adjacent' | 'duplicate'
  conflictingShift: Shift
  overlapMinutes?: number
}

export interface ShiftAnalysis {
  duration: {
    totalMinutes: number
    workingMinutes: number
    breakMinutes: number
    hours: number
    workingHours: number
  }
  penaltyPeriods: PenaltyPeriod[]
  shiftType: 'REGULAR' | 'OVERTIME' | 'DOUBLE_TIME' | 'PUBLIC_HOLIDAY' | 'WEEKEND'
  isOvertime: boolean
  isPublicHoliday: boolean
  dayOfWeek: number
  weekendWork: boolean
}

export interface PenaltyPeriod {
  id: string
  name: string
  startTime: Date
  endTime: Date
  durationMinutes: number
  rate: Decimal
}

export interface ShiftTemplate {
  name: string
  startTime: string
  endTime: string
  breakMinutes: number
  shiftType: 'REGULAR' | 'OVERTIME' | 'DOUBLE_TIME' | 'PUBLIC_HOLIDAY' | 'WEEKEND'
  daysOfWeek: number[]
}

export type PayFrequency = 'weekly' | 'fortnightly' | 'monthly'
export type AustralianState = 'NSW' | 'VIC' | 'QLD' | 'WA' | 'SA' | 'TAS' | 'ACT' | 'NT' | 'NATIONAL'

// New API response types for pagination and grouping
export interface ShiftsResponse {
  shifts: Shift[]
  pagination: {
    nextCursor: string | null
    hasMore: boolean
    total: number
  }
}

export interface PayPeriodsResponse {
  payPeriods: PayPeriodGroup[]
  pagination?: {
    nextCursor: string | null
    hasMore: boolean
    total: number
  }
}

export interface ShiftForDisplay {
  id: string
  startTime: string
  endTime: string | null
  breakMinutes: number
  shiftType: string
  status: string
  notes: string | null
  location: string | null
  penaltyOverrides: string | null
  autoCalculatePenalties: boolean
  totalMinutes: number | null
  regularHours: number | null
  overtimeHours: number | null
  penaltyHours: number | null
  grossPay: number | null
  superannuation: number | null
  payGuide: {
    name: string
  }
}

export interface PayPeriodGroup {
  id: string
  startDate: string
  endDate: string
  status: string
  shifts: ShiftForDisplay[]
  summary: {
    totalHours: number
    totalPay: number
    shiftCount: number
  }
}

export interface PayPeriodSummaryItem {
  id: string
  startDate: string
  endDate: string
  payDate: string
  status: string
  shiftCount: number
  summary: {
    totalHours: number
    totalPay: number
    shiftCount: number
  }
}

export interface ShiftFilters {
  status?: string
  startDate?: string
  endDate?: string
  payPeriodId?: string
  location?: string
  shiftType?: string
  search?: string
}