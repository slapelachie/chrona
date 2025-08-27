import { calculateTaxBreakdown, calculateFortnightlyTax, calculateSuperContribution } from './tax-calculations'
import { TaxCalculationInput } from '@/types'

export interface TaxScenario {
  id: string
  name: string
  description: string
  input: TaxCalculationInput & {
    superRate?: number
    payPeriodType?: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY'
  }
}

export interface ScenarioComparison {
  scenario: TaxScenario
  results: {
    annualIncome: number
    totalTax: number
    netIncome: number
    superContribution: number
    effectiveTaxRate: number
    marginalTaxRate: number
    fortnightlyAmounts: {
      grossPay: number
      totalTax: number
      netPay: number
      superContribution: number
    }
  }
}

/**
 * Calculate tax refund or debt based on withholdings vs actual tax owed
 */
export async function calculateTaxRefundOrDebt(
  annualIncome: number,
  totalWithheld: number,
  taxFreeThreshold: boolean = true,
  medicareExemption: boolean = false,
  hecsDebtAmount: number = 0,
  taxYear: string = '2024-25'
): Promise<{
  actualTaxOwed: number
  totalWithheld: number
  refundOrDebt: number
  isRefund: boolean
  breakdown: {
    incomeTax: number
    medicareLevy: number
    hecsDeduction: number
  }
}> {
  const taxBreakdown = await calculateTaxBreakdown({
    annualIncome,
    taxFreeThreshold,
    medicareExemption,
    hecsDebtAmount,
    extraTaxWithheld: 0,
    taxYear
  })

  const actualTaxOwed = taxBreakdown.incomeTax + taxBreakdown.medicareLevy
  const refundOrDebt = totalWithheld - actualTaxOwed
  
  return {
    actualTaxOwed,
    totalWithheld,
    refundOrDebt,
    isRefund: refundOrDebt > 0,
    breakdown: {
      incomeTax: taxBreakdown.incomeTax,
      medicareLevy: taxBreakdown.medicareLevy,
      hecsDeduction: taxBreakdown.hecsDeduction
    }
  }
}

/**
 * Calculate the additional income needed to achieve a target net pay
 */
export async function calculateIncomeForTargetNetPay(
  targetNetPay: number,
  payPeriodType: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' = 'FORTNIGHTLY',
  taxFreeThreshold: boolean = true,
  medicareExemption: boolean = false,
  hecsDebtAmount: number = 0,
  taxYear: string = '2024-25'
): Promise<{
  requiredGrossPay: number
  requiredAnnualIncome: number
  totalTaxRequired: number
  iterations: number
}> {
  const periodsPerYear = {
    WEEKLY: 52,
    FORTNIGHTLY: 26,
    MONTHLY: 12
  }

  const targetAnnualNet = targetNetPay * periodsPerYear[payPeriodType]
  let estimateGrossIncome = targetAnnualNet * 1.3 // Start with rough estimate
  let iterations = 0
  const maxIterations = 20
  const tolerance = 1.0 // Within $1 annual

  while (iterations < maxIterations) {
    const taxBreakdown = await calculateTaxBreakdown({
      annualIncome: estimateGrossIncome,
      taxFreeThreshold,
      medicareExemption,
      hecsDebtAmount,
      extraTaxWithheld: 0,
      taxYear
    })

    const actualNet = taxBreakdown.netIncome
    const difference = actualNet - targetAnnualNet

    if (Math.abs(difference) <= tolerance) {
      return {
        requiredGrossPay: estimateGrossIncome / periodsPerYear[payPeriodType],
        requiredAnnualIncome: estimateGrossIncome,
        totalTaxRequired: taxBreakdown.totalTaxWithheld,
        iterations: iterations + 1
      }
    }

    // Adjust estimate
    if (difference > 0) {
      // Net is too high, reduce gross income
      estimateGrossIncome *= 0.98
    } else {
      // Net is too low, increase gross income
      estimateGrossIncome *= 1.02
    }

    iterations++
  }

  // Return best estimate if we didn't converge
  const finalTaxBreakdown = await calculateTaxBreakdown({
    annualIncome: estimateGrossIncome,
    taxFreeThreshold,
    medicareExemption,
    hecsDebtAmount,
    extraTaxWithheld: 0,
    taxYear
  })

  return {
    requiredGrossPay: estimateGrossIncome / periodsPerYear[payPeriodType],
    requiredAnnualIncome: estimateGrossIncome,
    totalTaxRequired: finalTaxBreakdown.totalTaxWithheld,
    iterations
  }
}

/**
 * Compare multiple tax scenarios side by side
 */
export async function compareScenarios(scenarios: TaxScenario[]): Promise<ScenarioComparison[]> {
  const results = await Promise.all(
    scenarios.map(async (scenario) => {
      const taxBreakdown = await calculateTaxBreakdown(scenario.input)
      const superRate = scenario.input.superRate || 11
      const payPeriodType = scenario.input.payPeriodType || 'FORTNIGHTLY'
      
      const periodsPerYear = {
        WEEKLY: 52,
        FORTNIGHTLY: 26,
        MONTHLY: 12
      }

      const superContribution = calculateSuperContribution(
        scenario.input.annualIncome / periodsPerYear[payPeriodType],
        superRate
      ) * periodsPerYear[payPeriodType]

      const effectiveTaxRate = scenario.input.annualIncome > 0 
        ? (taxBreakdown.totalTaxWithheld / scenario.input.annualIncome) * 100 
        : 0

      return {
        scenario,
        results: {
          annualIncome: scenario.input.annualIncome,
          totalTax: taxBreakdown.totalTaxWithheld + taxBreakdown.hecsDeduction,
          netIncome: taxBreakdown.netIncome,
          superContribution,
          effectiveTaxRate,
          marginalTaxRate: await calculateMarginalTaxRate(scenario.input.annualIncome, scenario.input.taxYear || '2024-25'),
          fortnightlyAmounts: {
            grossPay: scenario.input.annualIncome / 26,
            totalTax: calculateFortnightlyTax(taxBreakdown.totalTaxWithheld + taxBreakdown.hecsDeduction, 'FORTNIGHTLY'),
            netPay: taxBreakdown.netIncome / 26,
            superContribution: superContribution / 26
          }
        }
      }
    })
  )

  return results
}

/**
 * Generate common tax scenarios for comparison
 */
export function getCommonTaxScenarios(baseIncome: number): TaxScenario[] {
  return [
    {
      id: 'current',
      name: 'Current Situation',
      description: 'Your current tax settings',
      input: {
        annualIncome: baseIncome,
        taxFreeThreshold: true,
        medicareExemption: false,
        hecsDebtAmount: 0,
        extraTaxWithheld: 0,
        superRate: 11
      }
    },
    {
      id: 'no-tax-free-threshold',
      name: 'No Tax-Free Threshold',
      description: 'If you don\'t claim the tax-free threshold',
      input: {
        annualIncome: baseIncome,
        taxFreeThreshold: false,
        medicareExemption: false,
        hecsDebtAmount: 0,
        extraTaxWithheld: 0,
        superRate: 11
      }
    },
    {
      id: 'with-hecs',
      name: 'With HECS Debt',
      description: 'Impact of HECS debt repayments',
      input: {
        annualIncome: baseIncome,
        taxFreeThreshold: true,
        medicareExemption: false,
        hecsDebtAmount: 25000, // Average HECS debt
        extraTaxWithheld: 0,
        superRate: 11
      }
    },
    {
      id: 'extra-tax',
      name: 'Extra Tax Withheld',
      description: '5% extra tax withheld per pay',
      input: {
        annualIncome: baseIncome,
        taxFreeThreshold: true,
        medicareExemption: false,
        hecsDebtAmount: 0,
        extraTaxWithheld: baseIncome * 0.05 / 26, // 5% extra per fortnight
        superRate: 11
      }
    },
    {
      id: 'higher-super',
      name: 'Higher Super Rate',
      description: 'Contribute 15% to superannuation',
      input: {
        annualIncome: baseIncome,
        taxFreeThreshold: true,
        medicareExemption: false,
        hecsDebtAmount: 0,
        extraTaxWithheld: 0,
        superRate: 15
      }
    }
  ]
}

/**
 * Calculate tax bracket optimization opportunities
 */
export async function findTaxOptimizationOpportunities(
  currentIncome: number,
  taxYear: string = '2024-25'
): Promise<{
  currentBracket: {
    rate: number
    thresholdMin: number
    thresholdMax: number | null
  }
  nextBracket: {
    rate: number
    thresholdMin: number
    distanceToNext: number
  } | null
  optimizationTips: string[]
}> {
  const { prisma } = await import('./db')
  
  const taxBrackets = await prisma.taxBracket.findMany({
    where: { taxYear },
    orderBy: { minIncome: 'asc' }
  })

  const currentBracket = taxBrackets.find(bracket => {
    const minIncome = Number(bracket.minIncome)
    const maxIncome = bracket.maxIncome ? Number(bracket.maxIncome) : Infinity
    return currentIncome >= minIncome && currentIncome <= maxIncome
  })

  const nextBracket = taxBrackets.find(bracket => {
    const minIncome = Number(bracket.minIncome)
    return minIncome > currentIncome
  })

  const optimizationTips: string[] = []

  if (currentBracket && nextBracket) {
    const distanceToNext = Number(nextBracket.minIncome) - currentIncome
    
    if (distanceToNext < 5000) {
      optimizationTips.push(`You're ${distanceToNext.toLocaleString()} away from the next tax bracket (${Number(nextBracket.taxRate)}%)`)
    }

    if (currentIncome > 45000 && currentIncome < 120000) {
      optimizationTips.push('Consider salary sacrificing to superannuation to reduce taxable income')
    }

    if (currentIncome > 51550) {
      optimizationTips.push('HECS repayments apply above $51,550 - factor this into your planning')
    }
  }

  return {
    currentBracket: currentBracket ? {
      rate: Number(currentBracket.taxRate),
      thresholdMin: Number(currentBracket.minIncome),
      thresholdMax: currentBracket.maxIncome ? Number(currentBracket.maxIncome) : null
    } : {
      rate: 0,
      thresholdMin: 0,
      thresholdMax: null
    },
    nextBracket: nextBracket ? {
      rate: Number(nextBracket.taxRate),
      thresholdMin: Number(nextBracket.minIncome),
      distanceToNext: Number(nextBracket.minIncome) - currentIncome
    } : null,
    optimizationTips
  }
}

// Helper function to calculate marginal tax rate
async function calculateMarginalTaxRate(annualIncome: number, taxYear: string): Promise<number> {
  const { prisma } = await import('./db')
  
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