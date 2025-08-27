import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { calculateTaxBreakdown, calculateFortnightlyTax, calculateSuperContribution } from '@/lib/tax-calculations'

// Validation schema for tax estimation scenarios
const taxEstimationRequestSchema = z.object({
  scenarios: z.array(z.object({
    id: z.string(),
    name: z.string(),
    annualIncome: z.number().min(0),
    taxFreeThreshold: z.boolean().optional().default(true),
    medicareExemption: z.boolean().optional().default(false),
    hecsDebtAmount: z.number().min(0).optional().default(0),
    extraTaxWithheld: z.number().min(0).optional().default(0),
    superRate: z.number().min(0).max(100).optional().default(11),
    taxYear: z.string().optional().default('2024-25'),
  })),
  compareToActual: z.boolean().optional().default(false),
  actualIncome: z.number().min(0).optional(),
})

// POST /api/tax-estimation - Calculate and compare multiple tax scenarios
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = taxEstimationRequestSchema.parse(body)
    
    const { scenarios, compareToActual, actualIncome } = validatedData

    // Calculate tax breakdown for each scenario
    const results = await Promise.all(
      scenarios.map(async (scenario) => {
        const taxBreakdown = await calculateTaxBreakdown({
          annualIncome: scenario.annualIncome,
          taxFreeThreshold: scenario.taxFreeThreshold,
          medicareExemption: scenario.medicareExemption,
          hecsDebtAmount: scenario.hecsDebtAmount,
          extraTaxWithheld: scenario.extraTaxWithheld,
          taxYear: scenario.taxYear
        })

        const superContribution = calculateSuperContribution(
          scenario.annualIncome / 26, // Convert to fortnightly for super calc
          scenario.superRate
        ) * 26 // Convert back to annual

        return {
          id: scenario.id,
          name: scenario.name,
          scenario,
          results: {
            annualIncome: scenario.annualIncome,
            incomeTax: taxBreakdown.incomeTax,
            medicareLevy: taxBreakdown.medicareLevy,
            hecsDeduction: taxBreakdown.hecsDeduction,
            totalTaxAndDeductions: taxBreakdown.totalTaxWithheld + taxBreakdown.hecsDeduction,
            superContribution,
            netIncome: taxBreakdown.netIncome,
            takeHomeAfterSuper: taxBreakdown.netIncome,
            
            // Fortnightly amounts
            fortnightly: {
              grossPay: scenario.annualIncome / 26,
              incomeTax: calculateFortnightlyTax(taxBreakdown.incomeTax, 'FORTNIGHTLY'),
              medicareLevy: calculateFortnightlyTax(taxBreakdown.medicareLevy, 'FORTNIGHTLY'),
              hecsDeduction: calculateFortnightlyTax(taxBreakdown.hecsDeduction, 'FORTNIGHTLY'),
              totalTax: calculateFortnightlyTax(taxBreakdown.totalTaxWithheld, 'FORTNIGHTLY'),
              superContribution: superContribution / 26,
              netPay: taxBreakdown.netIncome / 26
            },

            // Tax rates
            taxRates: {
              effectiveIncomeTaxRate: scenario.annualIncome > 0 ? (taxBreakdown.incomeTax / scenario.annualIncome) * 100 : 0,
              effectiveTotalTaxRate: scenario.annualIncome > 0 ? (taxBreakdown.totalTaxWithheld / scenario.annualIncome) * 100 : 0,
              medicareRate: scenario.medicareExemption ? 0 : 2,
              hecsRate: scenario.hecsDebtAmount > 0 && scenario.annualIncome > 51550 ? (taxBreakdown.hecsDeduction / scenario.annualIncome) * 100 : 0,
              superRate: scenario.superRate
            }
          }
        }
      })
    )

    // Calculate comparison if requested
    let comparison = null
    if (compareToActual && actualIncome) {
      const actualTaxBreakdown = await calculateTaxBreakdown({
        annualIncome: actualIncome,
        taxFreeThreshold: true,
        medicareExemption: false,
        hecsDebtAmount: 0,
        extraTaxWithheld: 0
      })

      comparison = {
        actualIncome,
        actualTax: actualTaxBreakdown.totalTaxWithheld,
        scenarios: results.map(result => ({
          id: result.id,
          name: result.name,
          incomeDifference: result.results.annualIncome - actualIncome,
          taxDifference: result.results.totalTaxAndDeductions - actualTaxBreakdown.totalTaxWithheld,
          netIncomeDifference: result.results.netIncome - actualTaxBreakdown.netIncome,
          percentageDifference: {
            income: actualIncome > 0 ? ((result.results.annualIncome - actualIncome) / actualIncome) * 100 : 0,
            tax: actualTaxBreakdown.totalTaxWithheld > 0 ? ((result.results.totalTaxAndDeductions - actualTaxBreakdown.totalTaxWithheld) / actualTaxBreakdown.totalTaxWithheld) * 100 : 0,
            netIncome: actualTaxBreakdown.netIncome > 0 ? ((result.results.netIncome - actualTaxBreakdown.netIncome) / actualTaxBreakdown.netIncome) * 100 : 0
          }
        }))
      }
    }

    // Summary statistics
    const summary = {
      scenarioCount: results.length,
      incomeRange: {
        min: Math.min(...results.map(r => r.results.annualIncome)),
        max: Math.max(...results.map(r => r.results.annualIncome)),
        average: results.reduce((sum, r) => sum + r.results.annualIncome, 0) / results.length
      },
      taxRange: {
        min: Math.min(...results.map(r => r.results.totalTaxAndDeductions)),
        max: Math.max(...results.map(r => r.results.totalTaxAndDeductions)),
        average: results.reduce((sum, r) => sum + r.results.totalTaxAndDeductions, 0) / results.length
      },
      netIncomeRange: {
        min: Math.min(...results.map(r => r.results.netIncome)),
        max: Math.max(...results.map(r => r.results.netIncome)),
        average: results.reduce((sum, r) => sum + r.results.netIncome, 0) / results.length
      }
    }

    return NextResponse.json({
      scenarios: results,
      comparison,
      summary
    })
  } catch (error) {
    console.error('Failed to calculate tax estimation:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to calculate tax estimation' },
      { status: 500 }
    )
  }
}