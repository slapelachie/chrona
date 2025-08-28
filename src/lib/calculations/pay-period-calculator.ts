import Decimal from 'decimal.js';
import { PayGuide, Shift, TaxBracket, HECSThreshold, User, PublicHoliday } from '@prisma/client';
import { PayCalculator, ShiftCalculation } from './pay-calculator';
import { TaxCalculator, TaxCalculation } from './tax-calculator';

export interface PayPeriodCalculation {
  totalHours: Decimal;
  regularHours: Decimal;
  overtimeHours: Decimal;
  penaltyHours: Decimal;
  grossPay: Decimal;
  superannuation: Decimal;
  incomeTax: Decimal;
  medicareLevy: Decimal;
  hecsRepayment: Decimal;
  netPay: Decimal;
  shiftCalculations: ShiftCalculationWithId[];
  taxCalculation: TaxCalculation;
  summary: PayPeriodSummary;
}

export interface ShiftCalculationWithId extends ShiftCalculation {
  shiftId: string;
  shift: Shift;
}

export interface PayPeriodSummary {
  totalShifts: number;
  averageHoursPerShift: Decimal;
  hourlyEarningsAverage: Decimal;
  casualLoadingTotal: Decimal;
  overtimePercentage: Decimal;
  penaltyPercentage: Decimal;
  effectiveTaxRate: Decimal;
  breakdown: {
    regularPay: Decimal;
    overtimePay: Decimal;
    penaltyPay: Decimal;
    casualLoading: Decimal;
    superannuation: Decimal;
    totalDeductions: Decimal;
  };
}

export interface WeeklyHours {
  week: number;
  startDate: Date;
  endDate: Date;
  totalHours: Decimal;
  shifts: Shift[];
}

export class PayPeriodCalculator {
  private readonly SUPERANNUATION_RATE = new Decimal(0.115); // 11.5% as of 2024-25
  private readonly SUPER_THRESHOLD = new Decimal(450); // Monthly threshold for super guarantee

  constructor(
    private payGuide: PayGuide,
    private taxBrackets: TaxBracket[],
    private hecsThresholds: HECSThreshold[],
    private publicHolidays: PublicHoliday[],
    private user: User
  ) {}

  calculatePayPeriod(
    shifts: Shift[],
    payPeriodStartDate: Date,
    payPeriodEndDate: Date,
    yearToDateGross: Decimal = new Decimal(0)
  ): PayPeriodCalculation {
    // Filter shifts to pay period
    const payPeriodShifts = this.filterShiftsToPayPeriod(shifts, payPeriodStartDate, payPeriodEndDate);
    
    // Calculate each shift
    const payCalculator = new PayCalculator(this.payGuide, this.publicHolidays);
    const shiftCalculations: ShiftCalculationWithId[] = [];
    
    let totalGrossPay = new Decimal(0);
    let totalRegularHours = new Decimal(0);
    let totalOvertimeHours = new Decimal(0);
    let totalPenaltyHours = new Decimal(0);

    for (const shift of payPeriodShifts) {
      if (!shift.endTime) continue; // Skip incomplete shifts
      
      const calculation = payCalculator.calculateShift(
        shift.startTime,
        shift.endTime,
        shift.breakMinutes
      );
      
      shiftCalculations.push({
        ...calculation,
        shiftId: shift.id,
        shift
      });
      
      totalGrossPay = totalGrossPay.plus(calculation.grossPay);
      totalRegularHours = totalRegularHours.plus(calculation.regularHours);
      totalOvertimeHours = totalOvertimeHours.plus(calculation.overtimeHours);
      totalPenaltyHours = totalPenaltyHours.plus(calculation.penaltyHours);
    }

    const totalHours = totalRegularHours.plus(totalOvertimeHours).plus(totalPenaltyHours);
    
    // Calculate superannuation
    const superannuation = this.calculateSuperannuation(totalGrossPay);
    
    // Calculate tax
    const taxCalculator = new TaxCalculator(this.taxBrackets, this.hecsThresholds, this.user);
    const payPeriodsPerYear = this.calculatePayPeriodsPerYear(payPeriodStartDate, payPeriodEndDate);
    const taxCalculation = taxCalculator.calculatePayPeriodTax(
      totalGrossPay,
      payPeriodsPerYear,
      yearToDateGross
    );
    
    const netPay = totalGrossPay.sub(taxCalculation.totalDeductions);
    
    // Create summary
    const summary = this.createPayPeriodSummary(
      shiftCalculations,
      totalGrossPay,
      totalHours,
      superannuation,
      taxCalculation
    );

    return {
      totalHours,
      regularHours: totalRegularHours,
      overtimeHours: totalOvertimeHours,
      penaltyHours: totalPenaltyHours,
      grossPay: totalGrossPay,
      superannuation,
      incomeTax: taxCalculation.incomeTax,
      medicareLevy: taxCalculation.medicareLevy,
      hecsRepayment: taxCalculation.hecsRepayment,
      netPay,
      shiftCalculations,
      taxCalculation,
      summary
    };
  }

  calculateWeeklyHours(
    shifts: Shift[],
    payPeriodStartDate: Date,
    payPeriodEndDate: Date
  ): WeeklyHours[] {
    const weeks: WeeklyHours[] = [];
    const payPeriodShifts = this.filterShiftsToPayPeriod(shifts, payPeriodStartDate, payPeriodEndDate);
    
    // Group shifts by week
    const shiftsByWeek = new Map<string, Shift[]>();
    
    for (const shift of payPeriodShifts) {
      const weekStart = this.getWeekStart(shift.startTime);
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!shiftsByWeek.has(weekKey)) {
        shiftsByWeek.set(weekKey, []);
      }
      shiftsByWeek.get(weekKey)!.push(shift);
    }
    
    // Calculate hours for each week
    let weekNumber = 1;
    for (const [weekKey, weekShifts] of shiftsByWeek.entries()) {
      const weekStart = new Date(weekKey);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      let totalWeekHours = new Decimal(0);
      
      for (const shift of weekShifts) {
        if (shift.endTime) {
          const duration = shift.endTime.getTime() - shift.startTime.getTime();
          const hours = new Decimal(duration).div(1000 * 60 * 60); // Convert to hours
          const workingHours = hours.sub(new Decimal(shift.breakMinutes).div(60));
          totalWeekHours = totalWeekHours.plus(workingHours);
        }
      }
      
      weeks.push({
        week: weekNumber++,
        startDate: weekStart,
        endDate: weekEnd,
        totalHours: totalWeekHours,
        shifts: weekShifts
      });
    }
    
    return weeks.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }

  checkOvertimeCompliance(
    shifts: Shift[],
    payPeriodStartDate: Date,
    payPeriodEndDate: Date
  ): {
    weeklyOvertimeViolations: Array<{
      week: WeeklyHours;
      excessHours: Decimal;
      threshold: Decimal;
    }>;
    totalOvertimeHours: Decimal;
    complianceStatus: 'compliant' | 'warning' | 'violation';
  } {
    const weeklyHours = this.calculateWeeklyHours(shifts, payPeriodStartDate, payPeriodEndDate);
    const violations = [];
    let totalOvertime = new Decimal(0);
    
    for (const week of weeklyHours) {
      const threshold = this.payGuide.weeklyOvertimeHours;
      if (week.totalHours.gt(threshold)) {
        const excessHours = week.totalHours.sub(threshold);
        violations.push({
          week,
          excessHours,
          threshold
        });
        totalOvertime = totalOvertime.plus(excessHours);
      }
    }
    
    let complianceStatus: 'compliant' | 'warning' | 'violation' = 'compliant';
    
    if (violations.length > 0) {
      complianceStatus = totalOvertime.gt(8) ? 'violation' : 'warning';
    }
    
    return {
      weeklyOvertimeViolations: violations,
      totalOvertimeHours: totalOvertime,
      complianceStatus
    };
  }

  estimateFutureEarnings(
    currentShifts: Shift[],
    upcomingShifts: Shift[],
    payPeriodStartDate: Date,
    payPeriodEndDate: Date
  ): {
    currentEarnings: Decimal;
    projectedEarnings: Decimal;
    remainingShifts: number;
    estimatedGrossPay: Decimal;
    estimatedNetPay: Decimal;
  } {
    const currentCalculation = this.calculatePayPeriod(
      currentShifts,
      payPeriodStartDate,
      payPeriodEndDate
    );
    
    const futureCalculation = this.calculatePayPeriod(
      [...currentShifts, ...upcomingShifts],
      payPeriodStartDate,
      payPeriodEndDate
    );
    
    return {
      currentEarnings: currentCalculation.grossPay,
      projectedEarnings: futureCalculation.grossPay.sub(currentCalculation.grossPay),
      remainingShifts: upcomingShifts.length,
      estimatedGrossPay: futureCalculation.grossPay,
      estimatedNetPay: futureCalculation.netPay
    };
  }

  private filterShiftsToPayPeriod(
    shifts: Shift[],
    startDate: Date,
    endDate: Date
  ): Shift[] {
    return shifts.filter(shift => {
      const shiftDate = new Date(shift.startTime);
      return shiftDate >= startDate && shiftDate <= endDate;
    });
  }

  private calculateSuperannuation(grossPay: Decimal): Decimal {
    // Super is calculated on gross pay above the monthly threshold
    if (grossPay.lt(this.SUPER_THRESHOLD)) {
      return new Decimal(0);
    }
    
    return grossPay.mul(this.SUPERANNUATION_RATE).round();
  }

  private calculatePayPeriodsPerYear(startDate: Date, endDate: Date): number {
    const daysDifference = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysDifference <= 7) return 52; // Weekly
    if (daysDifference <= 14) return 26; // Fortnightly
    if (daysDifference <= 31) return 12; // Monthly
    
    return 26; // Default to fortnightly
  }

  private getWeekStart(date: Date): Date {
    const weekStart = new Date(date);
    const dayOfWeek = weekStart.getDay();
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday as start
    weekStart.setDate(weekStart.getDate() - daysToSubtract);
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  }

  private createPayPeriodSummary(
    shiftCalculations: ShiftCalculationWithId[],
    totalGrossPay: Decimal,
    totalHours: Decimal,
    superannuation: Decimal,
    taxCalculation: TaxCalculation
  ): PayPeriodSummary {
    const totalShifts = shiftCalculations.length;
    
    // Calculate totals for each category
    let regularPayTotal = new Decimal(0);
    let overtimePayTotal = new Decimal(0);
    let penaltyPayTotal = new Decimal(0);
    let casualLoadingTotal = new Decimal(0);
    
    for (const calc of shiftCalculations) {
      regularPayTotal = regularPayTotal.plus(calc.regularPay);
      overtimePayTotal = overtimePayTotal.plus(calc.overtimePay);
      penaltyPayTotal = penaltyPayTotal.plus(calc.penaltyPay);
      casualLoadingTotal = casualLoadingTotal.plus(calc.casualLoading);
    }
    
    const averageHoursPerShift = totalShifts > 0 ? 
      totalHours.div(totalShifts) : new Decimal(0);
    
    const hourlyEarningsAverage = totalHours.gt(0) ? 
      totalGrossPay.div(totalHours) : new Decimal(0);
    
    const overtimePercentage = totalHours.gt(0) ? 
      shiftCalculations.reduce((sum, calc) => sum.plus(calc.overtimeHours), new Decimal(0))
        .div(totalHours).mul(100) : new Decimal(0);
    
    const penaltyPercentage = totalHours.gt(0) ? 
      shiftCalculations.reduce((sum, calc) => sum.plus(calc.penaltyHours), new Decimal(0))
        .div(totalHours).mul(100) : new Decimal(0);
    
    const effectiveTaxRate = totalGrossPay.gt(0) ? 
      taxCalculation.totalDeductions.div(totalGrossPay).mul(100) : new Decimal(0);

    return {
      totalShifts,
      averageHoursPerShift: averageHoursPerShift.round(),
      hourlyEarningsAverage: hourlyEarningsAverage.round(),
      casualLoadingTotal: casualLoadingTotal.round(),
      overtimePercentage: overtimePercentage.round(),
      penaltyPercentage: penaltyPercentage.round(),
      effectiveTaxRate: effectiveTaxRate.round(),
      breakdown: {
        regularPay: regularPayTotal.round(),
        overtimePay: overtimePayTotal.round(),
        penaltyPay: penaltyPayTotal.round(),
        casualLoading: casualLoadingTotal.round(),
        superannuation: superannuation.round(),
        totalDeductions: taxCalculation.totalDeductions.round()
      }
    };
  }

  // Utility method to get current pay period dates
  static getCurrentPayPeriodDates(payFrequency: 'weekly' | 'fortnightly' = 'fortnightly'): {
    startDate: Date;
    endDate: Date;
    payDate: Date;
  } {
    const today = new Date();
    const startDate = new Date(today);
    const endDate = new Date(today);
    
    if (payFrequency === 'weekly') {
      // Current week (Monday to Sunday)
      const dayOfWeek = today.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      startDate.setDate(today.getDate() - daysToMonday);
      endDate.setDate(startDate.getDate() + 6);
    } else {
      // Current fortnight (adjust based on your pay cycle)
      const dayOfWeek = today.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      startDate.setDate(today.getDate() - daysToMonday);
      
      // Determine if this is week 1 or 2 of the fortnight
      const weekNumber = Math.floor(today.getTime() / (1000 * 60 * 60 * 24 * 7)) % 2;
      if (weekNumber === 1) {
        startDate.setDate(startDate.getDate() - 7);
      }
      endDate.setDate(startDate.getDate() + 13);
    }
    
    // Pay date is typically 1-2 weeks after pay period end
    const payDate = new Date(endDate);
    payDate.setDate(payDate.getDate() + 7);
    
    // Set times
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    payDate.setHours(9, 0, 0, 0); // 9 AM on pay day
    
    return { startDate, endDate, payDate };
  }
}