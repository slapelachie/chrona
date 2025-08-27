import { z } from "zod"

// Prisma-generated types will be available from '@prisma/client'
export type {
  Settings,
  PayRate,
  Shift,
  PayPeriod,
  PayVerification,
  TaxBracket,
  HecsThreshold,
  PayPeriodType,
  RateType,
  PayPeriodStatus
} from "@prisma/client"

// Zod schemas for form validation
export const settingsSchema = z.object({
  taxFreeThreshold: z.boolean(),
  medicareExemption: z.boolean(),
  hecsDebtAmount: z.number().min(0).optional(),
  hecsThreshold: z.number().min(0).optional(),
  hecsRate: z.number().min(0).max(100).optional(),
  extraTaxWithheld: z.number().min(0),
  superRate: z.number().min(0).max(100),
  payPeriodType: z.enum(['WEEKLY', 'FORTNIGHTLY', 'MONTHLY']),
  payPeriodStartDay: z.number().min(1).max(7),
})

export const payRateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  baseRate: z.number().min(0, "Base rate must be positive"),
  effectiveFrom: z.date(),
  effectiveTo: z.date().optional(),
  rateType: z.enum(['BASE', 'OVERTIME', 'PENALTY', 'ALLOWANCE']),
  multiplier: z.number().min(0),
  isDefault: z.boolean(),
  applyWeekend: z.boolean(),
  applyPublicHoliday: z.boolean(),
  applyNight: z.boolean(),
  nightStart: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  nightEnd: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  overtimeThreshold: z.number().min(0).optional(),
  overtimeMultiplier: z.number().min(0).optional(),
})

export const shiftSchema = z.object({
  date: z.date(),
  startTime: z.date(),
  endTime: z.date(),
  breakTime: z.number().min(0),
  payRateId: z.string(),
  isPublicHoliday: z.boolean(),
  notes: z.string().optional(),
})

export const payVerificationSchema = z.object({
  actualGrossPay: z.number().min(0),
  actualTaxWithheld: z.number().min(0),
  actualMedicareLevy: z.number().min(0),
  actualHecsDeduction: z.number().min(0),
  actualSuperContrib: z.number().min(0),
  actualNetPay: z.number(),
  notes: z.string().optional(),
})

// Utility types
export type SettingsFormData = z.infer<typeof settingsSchema>
export type PayRateFormData = z.infer<typeof payRateSchema>
export type ShiftFormData = z.infer<typeof shiftSchema>
export type PayVerificationFormData = z.infer<typeof payVerificationSchema>

// Calculation types
export interface PayCalculation {
  regularHours: number
  overtimeHours: number
  penaltyHours: number
  grossPay: number
  taxWithheld: number
  medicareLevy: number
  hecsDeduction: number
  superContrib: number
  netPay: number
}

export interface TaxCalculationInput {
  annualIncome: number
  taxFreeThreshold: boolean
  medicareExemption: boolean
  hecsDebtAmount?: number
  extraTaxWithheld: number
  taxYear?: string
}

export interface TaxCalculationResult {
  grossPay: number
  payPeriodType: string
  annualIncome: number
  incomeTax: number
  medicareLevy: number
  hecsDeduction: number
  extraTaxWithheld: number
  totalTaxWithheld: number
  superContribution: number
  netPay: number
  takeHomePay: number
  annualProjections: {
    annualIncome: number
    annualIncomeTax: number
    annualMedicareLevy: number
    annualHecsDeduction: number
    annualTotalTax: number
    annualNetIncome: number
    annualSuperContribution: number
  }
  taxRates: {
    effectiveIncomeTaxRate: number
    effectiveTotalTaxRate: number
    medicareRate: number
    hecsRate: number
    superRate: number
    customWithholdingRate?: number
    marginalTaxRate: number
  }
  calculationContext: {
    taxYear: string
    multiJobTaxScale: boolean
    customWithholding: boolean
    includesSuper: boolean
  }
}

export interface PayPeriodSummary {
  startDate: Date
  endDate: Date
  totalHours: number
  totalShifts: number
  grossPay: number
  netPay: number
  status: 'FORECAST' | 'CALCULATED' | 'PAID' | 'VERIFIED'
}