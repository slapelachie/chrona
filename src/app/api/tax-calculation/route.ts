import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { calculateTaxBreakdown, calculateFortnightlyTax, calculateSuperContribution } from '@/lib/tax-calculations'
import { prisma } from '@/lib/db'

// Helper function to calculate marginal tax rate
async function calculateMarginalTaxRate(annualIncome: number, taxYear: string): Promise<number> {
  const taxBrackets = await prisma.taxBracket.findMany({
    where: { taxYear },
    orderBy: { minIncome: 'asc' }
  })
  
  const applicableBracket = taxBrackets.find(bracket => {
    const minIncome = Number(bracket.minIncome)
    const maxIncome = bracket.maxIncome ? Number(bracket.maxIncome) : Infinity
    return annualIncome >= minIncome && annualIncome <= maxIncome
  })
  
  return applicableBracket ? Number(applicableBracket.taxRate) : 0
}

// Validation schema for tax calculation request
const taxCalculationRequestSchema = z.object({
  grossPay: z.number().min(0, 'Gross pay must be non-negative'),
  payPeriodType: z.enum(['WEEKLY', 'FORTNIGHTLY', 'MONTHLY']).optional().default('FORTNIGHTLY'),
  taxFreeThreshold: z.boolean().optional().default(true),
  medicareExemption: z.boolean().optional().default(false),
  hecsDebtAmount: z.number().min(0).optional().default(0),
  extraTaxWithheld: z.number().min(0).optional().default(0),
  superRate: z.number().min(0).max(100).optional().default(11),
  taxYear: z.string().optional().default('2024-25'),
  customWithholdingRate: z.number().min(0).max(100).optional(),
  includeSuper: z.boolean().optional().default(true),
  multiJobTaxScale: z.boolean().optional().default(false),
})

// POST /api/tax-calculation - Calculate tax breakdown for given gross pay
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = taxCalculationRequestSchema.parse(body)
    
    const {
      grossPay,
      payPeriodType,
      taxFreeThreshold,
      medicareExemption,
      hecsDebtAmount = 0,
      extraTaxWithheld,
      superRate,
      taxYear,
      customWithholdingRate,
      includeSuper,
      multiJobTaxScale
    } = validatedData

    // Calculate annual income from pay period amount
    const periodsPerYear = {
      WEEKLY: 52,
      FORTNIGHTLY: 26,
      MONTHLY: 12
    }
    
    const annualIncome = grossPay * periodsPerYear[payPeriodType]
    
    // Adjust tax-free threshold for multi-job scenario
    const effectiveTaxFreeThreshold = multiJobTaxScale ? false : taxFreeThreshold;
    
    // Get tax breakdown for annual income
    const taxBreakdown = await calculateTaxBreakdown({
      annualIncome,
      taxFreeThreshold: effectiveTaxFreeThreshold,
      medicareExemption,
      hecsDebtAmount,
      extraTaxWithheld: extraTaxWithheld * periodsPerYear[payPeriodType],
      taxYear
    })
    
    // Convert annual amounts to pay period amounts
    let periodIncomeTax = calculateFortnightlyTax(taxBreakdown.incomeTax, payPeriodType)
    const periodMedicareLevy = calculateFortnightlyTax(taxBreakdown.medicareLevy, payPeriodType)
    const periodHecsDeduction = calculateFortnightlyTax(taxBreakdown.hecsDeduction, payPeriodType)
    const periodExtraTax = extraTaxWithheld
    
    // Apply custom withholding rate if specified
    if (customWithholdingRate !== undefined) {
      periodIncomeTax = grossPay * (customWithholdingRate / 100)
    }
    
    const periodTotalTax = periodIncomeTax + periodMedicareLevy + periodExtraTax
    
    // Calculate superannuation (if included)
    const superContribution = includeSuper ? calculateSuperContribution(grossPay, superRate) : 0
    
    // Calculate net pay
    const netPay = grossPay - periodTotalTax - periodHecsDeduction
    
    const result = {
      // Input values
      grossPay,
      payPeriodType,
      annualIncome,
      
      // Tax breakdown for this pay period
      incomeTax: periodIncomeTax,
      medicareLevy: periodMedicareLevy,
      hecsDeduction: periodHecsDeduction,
      extraTaxWithheld: periodExtraTax,
      totalTaxWithheld: periodTotalTax,
      
      // Other deductions
      superContribution,
      
      // Final amounts
      netPay,
      takeHomePay: netPay, // Same as netPay for casual workers
      
      // Annual projections
      annualProjections: {
        annualIncome: taxBreakdown.annualIncome,
        annualIncomeTax: taxBreakdown.incomeTax,
        annualMedicareLevy: taxBreakdown.medicareLevy,
        annualHecsDeduction: taxBreakdown.hecsDeduction,
        annualTotalTax: taxBreakdown.totalTaxWithheld,
        annualNetIncome: taxBreakdown.netIncome,
        annualSuperContribution: superContribution * periodsPerYear[payPeriodType]
      },
      
      // Tax rates applied
      taxRates: {
        effectiveIncomeTaxRate: annualIncome > 0 ? (taxBreakdown.incomeTax / annualIncome) * 100 : 0,
        effectiveTotalTaxRate: annualIncome > 0 ? (taxBreakdown.totalTaxWithheld / annualIncome) * 100 : 0,
        medicareRate: medicareExemption ? 0 : 2,
        hecsRate: hecsDebtAmount > 0 && annualIncome > 51550 ? (taxBreakdown.hecsDeduction / annualIncome) * 100 : 0,
        superRate: includeSuper ? superRate : 0,
        customWithholdingRate: customWithholdingRate,
        marginalTaxRate: await calculateMarginalTaxRate(annualIncome, taxYear)
      },
      
      // Additional calculation context
      calculationContext: {
        taxYear,
        multiJobTaxScale,
        customWithholding: customWithholdingRate !== undefined,
        includesSuper: includeSuper
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to calculate tax:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to calculate tax breakdown' },
      { status: 500 }
    )
  }
}