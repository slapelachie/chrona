import Decimal from 'decimal.js';
import { TaxBracket, HECSThreshold, User } from '@prisma/client';

export interface TaxCalculation {
  grossPay: Decimal;
  incomeTax: Decimal;
  medicareLevy: Decimal;
  hecsRepayment: Decimal;
  totalDeductions: Decimal;
  netPay: Decimal;
  breakdown: TaxBreakdown;
}

export interface TaxBreakdown {
  taxableIncome: Decimal;
  taxFreeThreshold: Decimal;
  taxBrackets: TaxBracketCalculation[];
  medicareLevy: {
    rate: Decimal;
    amount: Decimal;
    exemption: boolean;
  };
  hecsRepayment: {
    threshold: Decimal;
    rate: Decimal;
    amount: Decimal;
    applicable: boolean;
  };
  yearToDateTotals?: {
    grossIncome: Decimal;
    incomeTax: Decimal;
    medicareLevy: Decimal;
    hecsRepayment: Decimal;
  };
}

export interface TaxBracketCalculation {
  minIncome: Decimal;
  maxIncome: Decimal | null;
  taxRate: Decimal;
  baseTax: Decimal;
  taxableAmountInBracket: Decimal;
  taxOnBracket: Decimal;
}

export class TaxCalculator {
  private readonly MEDICARE_LEVY_RATE = new Decimal(0.02); // 2%
  private readonly TAX_FREE_THRESHOLD = new Decimal(18200);
  
  constructor(
    private taxBrackets: TaxBracket[],
    private hecsThresholds: HECSThreshold[],
    private user: User
  ) {}

  calculatePayPeriodTax(
    grossPay: Decimal,
    payPeriodsPerYear: number = 26, // Fortnightly by default
    yearToDateGross: Decimal = new Decimal(0)
  ): TaxCalculation {
    // Annualize the income for tax calculation
    const annualizedIncome = grossPay.mul(payPeriodsPerYear);
    const projectedAnnualIncome = yearToDateGross.plus(annualizedIncome);
    
    // Calculate annual tax
    const annualTaxCalculation = this.calculateAnnualTax(projectedAnnualIncome);
    
    // Prorate tax for this pay period
    const periodIncomeTax = annualTaxCalculation.incomeTax.div(payPeriodsPerYear);
    const periodMedicareLevy = annualTaxCalculation.medicareLevy.div(payPeriodsPerYear);
    const periodHecsRepayment = annualTaxCalculation.hecsRepayment.div(payPeriodsPerYear);
    
    const totalDeductions = periodIncomeTax.plus(periodMedicareLevy).plus(periodHecsRepayment);
    const netPay = grossPay.sub(totalDeductions);

    return {
      grossPay,
      incomeTax: periodIncomeTax,
      medicareLevy: periodMedicareLevy,
      hecsRepayment: periodHecsRepayment,
      totalDeductions,
      netPay,
      breakdown: {
        ...annualTaxCalculation.breakdown,
        yearToDateTotals: {
          grossIncome: yearToDateGross.plus(grossPay),
          incomeTax: periodIncomeTax,
          medicareLevy: periodMedicareLevy,
          hecsRepayment: periodHecsRepayment
        }
      }
    };
  }

  calculateAnnualTax(annualIncome: Decimal): TaxCalculation {
    const taxableIncome = this.calculateTaxableIncome(annualIncome);
    const incomeTax = this.calculateIncomeTax(taxableIncome);
    const medicareLevy = this.calculateMedicareLevy(taxableIncome);
    const hecsRepayment = this.calculateHECSRepayment(taxableIncome);
    
    const totalDeductions = incomeTax.plus(medicareLevy).plus(hecsRepayment);
    const netPay = annualIncome.sub(totalDeductions);

    const taxBracketCalculations = this.calculateTaxBracketBreakdown(taxableIncome);

    return {
      grossPay: annualIncome,
      incomeTax,
      medicareLevy,
      hecsRepayment,
      totalDeductions,
      netPay,
      breakdown: {
        taxableIncome,
        taxFreeThreshold: this.user.claimsTaxFreeThreshold ? this.TAX_FREE_THRESHOLD : new Decimal(0),
        taxBrackets: taxBracketCalculations,
        medicareLevy: {
          rate: this.MEDICARE_LEVY_RATE,
          amount: medicareLevy,
          exemption: this.user.medicareLevyExemption
        },
        hecsRepayment: {
          threshold: this.getHECSThreshold(taxableIncome),
          rate: this.getHECSRate(taxableIncome),
          amount: hecsRepayment,
          applicable: this.user.hasHECSDebt
        }
      }
    };
  }

  private calculateTaxableIncome(grossIncome: Decimal): Decimal {
    // For employees, taxable income equals gross income
    // This could be extended later for deductions
    return grossIncome;
  }

  private calculateIncomeTax(taxableIncome: Decimal): Decimal {
    if (!this.user.claimsTaxFreeThreshold || taxableIncome.lte(this.TAX_FREE_THRESHOLD)) {
      return new Decimal(0);
    }

    let tax = new Decimal(0);
    const remainingIncome = taxableIncome;

    // Sort tax brackets by minimum income
    const sortedBrackets = [...this.taxBrackets].sort((a, b) => 
      new Decimal(a.minIncome).sub(new Decimal(b.minIncome)).toNumber()
    );

    for (const bracket of sortedBrackets) {
      const bracketMin = new Decimal(bracket.minIncome);
      const bracketMax = bracket.maxIncome ? new Decimal(bracket.maxIncome) : null;
      const taxRate = new Decimal(bracket.taxRate);
      const baseTax = new Decimal(bracket.baseTax);

      if (remainingIncome.lte(bracketMin)) {
        break;
      }

      if (bracketMax && remainingIncome.lte(bracketMax)) {
        // Income falls within this bracket
        const taxableInBracket = remainingIncome.sub(bracketMin);
        tax = baseTax.plus(taxableInBracket.mul(taxRate));
        break;
      } else if (!bracketMax) {
        // Highest bracket (no upper limit)
        const taxableInBracket = remainingIncome.sub(bracketMin);
        tax = baseTax.plus(taxableInBracket.mul(taxRate));
        break;
      }
    }

    return tax.round(); // Round to nearest cent
  }

  private calculateTaxBracketBreakdown(taxableIncome: Decimal): TaxBracketCalculation[] {
    const breakdown: TaxBracketCalculation[] = [];
    const remainingIncome = taxableIncome;

    const sortedBrackets = [...this.taxBrackets].sort((a, b) => 
      new Decimal(a.minIncome).sub(new Decimal(b.minIncome)).toNumber()
    );

    for (const bracket of sortedBrackets) {
      const bracketMin = new Decimal(bracket.minIncome);
      const bracketMax = bracket.maxIncome ? new Decimal(bracket.maxIncome) : null;
      const taxRate = new Decimal(bracket.taxRate);
      const baseTax = new Decimal(bracket.baseTax);

      if (remainingIncome.lte(bracketMin)) {
        // No income in this bracket
        breakdown.push({
          minIncome: bracketMin,
          maxIncome: bracketMax,
          taxRate,
          baseTax,
          taxableAmountInBracket: new Decimal(0),
          taxOnBracket: new Decimal(0)
        });
        continue;
      }

      let taxableInBracket: Decimal;
      if (bracketMax && remainingIncome.lte(bracketMax)) {
        taxableInBracket = remainingIncome.sub(bracketMin);
      } else if (bracketMax) {
        taxableInBracket = bracketMax.sub(bracketMin);
      } else {
        taxableInBracket = remainingIncome.sub(bracketMin);
      }

      const taxOnBracket = taxableInBracket.mul(taxRate);

      breakdown.push({
        minIncome: bracketMin,
        maxIncome: bracketMax,
        taxRate,
        baseTax,
        taxableAmountInBracket: taxableInBracket,
        taxOnBracket
      });

      if (!bracketMax || remainingIncome.lte(bracketMax)) {
        break;
      }
    }

    return breakdown;
  }

  private calculateMedicareLevy(taxableIncome: Decimal): Decimal {
    if (this.user.medicareLevyExemption) {
      return new Decimal(0);
    }

    // Medicare levy is 2% of taxable income
    // There are income thresholds below which no levy applies, but for simplicity
    // we'll apply it to all income above the tax-free threshold
    if (taxableIncome.lte(this.TAX_FREE_THRESHOLD)) {
      return new Decimal(0);
    }

    return taxableIncome.mul(this.MEDICARE_LEVY_RATE).round();
  }

  private calculateHECSRepayment(taxableIncome: Decimal): Decimal {
    if (!this.user.hasHECSDebt) {
      return new Decimal(0);
    }

    const applicableThreshold = this.hecsThresholds.find(threshold => {
      const minIncome = new Decimal(threshold.minIncome);
      const maxIncome = threshold.maxIncome ? new Decimal(threshold.maxIncome) : null;
      
      return taxableIncome.gte(minIncome) && 
             (maxIncome === null || taxableIncome.lte(maxIncome));
    });

    if (!applicableThreshold) {
      return new Decimal(0);
    }

    const repaymentRate = new Decimal(applicableThreshold.repaymentRate);
    return taxableIncome.mul(repaymentRate).round();
  }

  private getHECSThreshold(taxableIncome: Decimal): Decimal {
    const threshold = this.hecsThresholds.find(t => {
      const minIncome = new Decimal(t.minIncome);
      const maxIncome = t.maxIncome ? new Decimal(t.maxIncome) : null;
      
      return taxableIncome.gte(minIncome) && 
             (maxIncome === null || taxableIncome.lte(maxIncome));
    });

    return threshold ? new Decimal(threshold.minIncome) : new Decimal(0);
  }

  private getHECSRate(taxableIncome: Decimal): Decimal {
    const threshold = this.hecsThresholds.find(t => {
      const minIncome = new Decimal(t.minIncome);
      const maxIncome = t.maxIncome ? new Decimal(t.maxIncome) : null;
      
      return taxableIncome.gte(minIncome) && 
             (maxIncome === null || taxableIncome.lte(maxIncome));
    });

    return threshold ? new Decimal(threshold.repaymentRate) : new Decimal(0);
  }

  // Utility method to estimate tax for a given gross amount
  estimatePayPeriodTax(grossPay: Decimal, payPeriodsPerYear: number = 26): Decimal {
    const calculation = this.calculatePayPeriodTax(grossPay, payPeriodsPerYear);
    return calculation.totalDeductions;
  }

  // Method to calculate effective tax rate
  calculateEffectiveTaxRate(grossIncome: Decimal): Decimal {
    const taxCalculation = this.calculateAnnualTax(grossIncome);
    
    if (grossIncome.eq(0)) {
      return new Decimal(0);
    }
    
    return taxCalculation.totalDeductions.div(grossIncome).mul(100).round(); // Return as percentage
  }

  // Method to calculate marginal tax rate
  calculateMarginalTaxRate(taxableIncome: Decimal): Decimal {
    const applicableBracket = this.taxBrackets.find(bracket => {
      const bracketMin = new Decimal(bracket.minIncome);
      const bracketMax = bracket.maxIncome ? new Decimal(bracket.maxIncome) : null;
      
      return taxableIncome.gte(bracketMin) && 
             (bracketMax === null || taxableIncome.lte(bracketMax));
    });

    if (!applicableBracket) {
      return new Decimal(0);
    }

    let marginalRate = new Decimal(applicableBracket.taxRate);
    
    // Add Medicare levy if applicable
    if (!this.user.medicareLevyExemption && taxableIncome.gt(this.TAX_FREE_THRESHOLD)) {
      marginalRate = marginalRate.plus(this.MEDICARE_LEVY_RATE);
    }

    // Add HECS rate if applicable
    if (this.user.hasHECSDebt) {
      const hecsRate = this.getHECSRate(taxableIncome);
      marginalRate = marginalRate.plus(hecsRate);
    }

    return marginalRate.mul(100).round(); // Return as percentage
  }
}