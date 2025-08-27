import { prisma } from './db'
import { TaxCalculationInput } from '@/types'

/**
 * Calculate annual income tax based on Australian tax brackets
 */
export async function calculateIncomeTax(
  annualIncome: number, 
  taxFreeThreshold: boolean = true,
  taxYear: string = '2024-25'
): Promise<number> {
  if (annualIncome <= 0) return 0
  
  const taxBrackets = await prisma.taxBracket.findMany({
    where: { taxYear },
    orderBy: { minIncome: 'asc' }
  })

  if (taxBrackets.length === 0) {
    throw new Error(`No tax brackets found for ${taxYear}`)
  }

  // If not claiming tax-free threshold, use no tax-free threshold rates
  // (First bracket becomes 19% from $1)
  if (!taxFreeThreshold && annualIncome > 0) {
    const taxableAmount = annualIncome
    const firstBracket = taxBrackets.find(bracket => 
      Number(bracket.minIncome) <= taxableAmount && 
      (bracket.maxIncome === null || Number(bracket.maxIncome) >= taxableAmount)
    )
    
    if (firstBracket && Number(firstBracket.minIncome) === 0) {
      // Apply 19% tax from $1 (no tax-free threshold)
      return Math.max(0, (taxableAmount * 0.19))
    }
  }

  // Standard progressive tax calculation with tax-free threshold
  let totalTax = 0
  
  for (const bracket of taxBrackets) {
    const minIncome = Number(bracket.minIncome)
    const maxIncome = bracket.maxIncome ? Number(bracket.maxIncome) : Infinity
    const taxRate = Number(bracket.taxRate) / 100
    const baseAmount = Number(bracket.baseAmount)
    
    if (annualIncome > minIncome) {
      const taxableInBracket = Math.min(annualIncome, maxIncome) - minIncome + 1
      const taxInBracket = baseAmount + (taxableInBracket * taxRate)
      totalTax = taxInBracket
    }
    
    if (maxIncome >= annualIncome) break
  }
  
  return Math.max(0, totalTax)
}

/**
 * Calculate Medicare levy (2% of taxable income)
 * Reduced for low income earners, exemptions available
 */
export function calculateMedicareLevy(
  annualIncome: number,
  medicareExemption: boolean = false
): number {
  if (medicareExemption || annualIncome <= 0) return 0
  
  const medicareRate = 0.02 // 2%
  const lowIncomeThreshold = 29207 // 2024-25 threshold for singles
  const shadeOutThreshold = 36456 // Start of shade-out
  
  if (annualIncome <= lowIncomeThreshold) {
    return 0
  }
  
  if (annualIncome <= shadeOutThreshold) {
    // Shade-out calculation: 10% of excess over threshold
    const excess = annualIncome - lowIncomeThreshold
    return Math.min(annualIncome * medicareRate, excess * 0.10)
  }
  
  // Full Medicare levy
  return annualIncome * medicareRate
}

/**
 * Calculate HECS debt repayment based on income thresholds
 */
export async function calculateHecsDeduction(
  annualIncome: number,
  hecsDebtAmount: number = 0,
  taxYear: string = '2024-25'
): Promise<number> {
  if (hecsDebtAmount <= 0 || annualIncome <= 0) return 0
  
  const hecsThresholds = await prisma.hecsThreshold.findMany({
    where: { taxYear },
    orderBy: { minIncome: 'asc' }
  })

  if (hecsThresholds.length === 0) {
    throw new Error(`No HECS thresholds found for ${taxYear}`)
  }
  
  // Find applicable threshold
  const applicableThreshold = hecsThresholds.find(threshold => {
    const minIncome = Number(threshold.minIncome)
    const maxIncome = threshold.maxIncome ? Number(threshold.maxIncome) : Infinity
    return annualIncome >= minIncome && annualIncome <= maxIncome
  })
  
  if (!applicableThreshold) {
    return 0 // Below minimum repayment threshold
  }
  
  const repaymentRate = Number(applicableThreshold.repaymentRate) / 100
  const repaymentAmount = annualIncome * repaymentRate
  
  // Cannot repay more than the debt amount
  return Math.min(repaymentAmount, hecsDebtAmount)
}

/**
 * Calculate comprehensive tax breakdown for a given income
 */
export async function calculateTaxBreakdown(input: TaxCalculationInput) {
  const {
    annualIncome,
    taxFreeThreshold,
    medicareExemption,
    hecsDebtAmount = 0,
    extraTaxWithheld,
    taxYear = '2024-25'
  } = input

  // Calculate each component
  const incomeTax = await calculateIncomeTax(annualIncome, taxFreeThreshold, taxYear)
  const medicareLevy = calculateMedicareLevy(annualIncome, medicareExemption)
  const hecsDeduction = await calculateHecsDeduction(annualIncome, hecsDebtAmount, taxYear)
  
  // Total tax withholding
  const totalTaxWithheld = incomeTax + medicareLevy + extraTaxWithheld
  
  return {
    annualIncome,
    incomeTax,
    medicareLevy,
    hecsDeduction,
    extraTaxWithheld,
    totalTaxWithheld,
    netIncome: annualIncome - totalTaxWithheld - hecsDeduction
  }
}

/**
 * Calculate fortnightly tax withholding from annual amounts
 */
export function calculateFortnightlyTax(
  annualTax: number,
  payPeriodType: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' = 'FORTNIGHTLY'
): number {
  const periodsPerYear = {
    WEEKLY: 52,
    FORTNIGHTLY: 26,
    MONTHLY: 12
  }
  
  return annualTax / periodsPerYear[payPeriodType]
}

/**
 * Calculate superannuation contribution
 */
export function calculateSuperContribution(
  grossPay: number, 
  superRate: number = 11
): number {
  return grossPay * (superRate / 100)
}