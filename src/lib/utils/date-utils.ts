import { PublicHoliday } from '@prisma/client';

export interface PayPeriodDates {
  startDate: Date;
  endDate: Date;
  payDate: Date;
  periodNumber: number;
  year: number;
}

export interface BusinessDay {
  date: Date;
  isBusinessDay: boolean;
  isPublicHoliday: boolean;
  holidayName?: string;
}

export type PayFrequency = 'weekly' | 'fortnightly' | 'monthly';
export type AustralianState = 'NSW' | 'VIC' | 'QLD' | 'WA' | 'SA' | 'TAS' | 'ACT' | 'NT' | 'NATIONAL';

export class DateUtils {
  constructor(private publicHolidays: PublicHoliday[] = []) {}

  // Public Holiday Detection
  isPublicHoliday(date: Date, state?: AustralianState): boolean {
    const dateStr = this.formatDateForComparison(date);
    
    return this.publicHolidays.some(holiday => {
      const holidayStr = this.formatDateForComparison(holiday.date);
      const isDateMatch = holidayStr === dateStr;
      const isStateMatch = !holiday.state || // National holiday
                          !state || // No state specified
                          holiday.state === state || // State match
                          holiday.state === 'NATIONAL'; // National holiday
      
      return isDateMatch && isStateMatch;
    });
  }

  getPublicHolidayInfo(date: Date, state?: AustralianState): PublicHoliday | null {
    const dateStr = this.formatDateForComparison(date);
    
    return this.publicHolidays.find(holiday => {
      const holidayStr = this.formatDateForComparison(holiday.date);
      const isDateMatch = holidayStr === dateStr;
      const isStateMatch = !holiday.state ||
                          !state ||
                          holiday.state === state ||
                          holiday.state === 'NATIONAL';
      
      return isDateMatch && isStateMatch;
    }) || null;
  }

  getPublicHolidaysInRange(
    startDate: Date, 
    endDate: Date, 
    state?: AustralianState
  ): PublicHoliday[] {
    return this.publicHolidays.filter(holiday => {
      const holidayDate = new Date(holiday.date);
      const isInRange = holidayDate >= startDate && holidayDate <= endDate;
      const isStateMatch = !holiday.state ||
                          !state ||
                          holiday.state === state ||
                          holiday.state === 'NATIONAL';
      
      return isInRange && isStateMatch;
    });
  }

  // Business Day Calculations
  isBusinessDay(date: Date, state?: AustralianState): boolean {
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
    
    if (isWeekend) return false;
    
    return !this.isPublicHoliday(date, state);
  }

  getBusinessDaysInRange(
    startDate: Date, 
    endDate: Date, 
    state?: AustralianState
  ): BusinessDay[] {
    const businessDays: BusinessDay[] = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const isPublicHoliday = this.isPublicHoliday(currentDate, state);
      const holidayInfo = isPublicHoliday ? this.getPublicHolidayInfo(currentDate, state) : null;
      
      businessDays.push({
        date: new Date(currentDate),
        isBusinessDay: this.isBusinessDay(currentDate, state),
        isPublicHoliday,
        holidayName: holidayInfo?.name
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return businessDays;
  }

  countBusinessDays(startDate: Date, endDate: Date, state?: AustralianState): number {
    return this.getBusinessDaysInRange(startDate, endDate, state)
      .filter(day => day.isBusinessDay).length;
  }

  // Pay Period Date Generation
  generatePayPeriods(
    startDate: Date,
    endDate: Date,
    frequency: PayFrequency = 'fortnightly'
  ): PayPeriodDates[] {
    const periods: PayPeriodDates[] = [];
    const currentDate = new Date(startDate);
    let periodNumber = 1;
    
    while (currentDate <= endDate) {
      const periodStart = new Date(currentDate);
      const periodEnd = this.calculatePeriodEnd(periodStart, frequency);
      const payDate = this.calculatePayDate(periodEnd);
      
      if (periodEnd > endDate) {
        break;
      }
      
      periods.push({
        startDate: new Date(periodStart),
        endDate: new Date(periodEnd),
        payDate: new Date(payDate),
        periodNumber,
        year: periodStart.getFullYear()
      });
      
      currentDate.setTime(periodEnd.getTime() + 24 * 60 * 60 * 1000); // Next day
      periodNumber++;
    }
    
    return periods;
  }

  getCurrentPayPeriod(
    frequency: PayFrequency = 'fortnightly',
    payPeriodStartDay: number = 1 // Monday = 1, Sunday = 0
  ): PayPeriodDates {
    const today = new Date();
    const startDate = this.findPeriodStart(today, frequency, payPeriodStartDay);
    const endDate = this.calculatePeriodEnd(startDate, frequency);
    const payDate = this.calculatePayDate(endDate);
    
    return {
      startDate,
      endDate,
      payDate,
      periodNumber: this.calculatePeriodNumber(startDate),
      year: startDate.getFullYear()
    };
  }

  getNextPayPeriod(
    currentPeriod: PayPeriodDates,
    frequency: PayFrequency = 'fortnightly'
  ): PayPeriodDates {
    const nextStart = new Date(currentPeriod.endDate);
    nextStart.setDate(nextStart.getDate() + 1);
    
    const endDate = this.calculatePeriodEnd(nextStart, frequency);
    const payDate = this.calculatePayDate(endDate);
    
    return {
      startDate: nextStart,
      endDate,
      payDate,
      periodNumber: currentPeriod.periodNumber + 1,
      year: nextStart.getFullYear()
    };
  }

  getPreviousPayPeriod(
    currentPeriod: PayPeriodDates,
    frequency: PayFrequency = 'fortnightly'
  ): PayPeriodDates {
    const daysInPeriod = frequency === 'weekly' ? 7 : 
                        frequency === 'fortnightly' ? 14 : 30;
    
    const prevEnd = new Date(currentPeriod.startDate);
    prevEnd.setDate(prevEnd.getDate() - 1);
    
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - daysInPeriod + 1);
    
    const payDate = this.calculatePayDate(prevEnd);
    
    return {
      startDate: prevStart,
      endDate: prevEnd,
      payDate,
      periodNumber: Math.max(1, currentPeriod.periodNumber - 1),
      year: prevStart.getFullYear()
    };
  }

  // Time Utility Methods
  isTimeBetween(time: Date, startTime: string, endTime: string): boolean {
    const timeStr = this.formatTimeString(time);
    const start = this.parseTimeString(startTime);
    const end = this.parseTimeString(endTime);
    const current = this.parseTimeString(timeStr);
    
    if (start <= end) {
      return current >= start && current < end;
    } else {
      // Handles overnight periods (e.g., 22:00 - 06:00)
      return current >= start || current < end;
    }
  }

  calculateDuration(startTime: Date, endTime: Date, excludeBreakMinutes: number = 0): {
    totalMinutes: number;
    workingMinutes: number;
    hours: number;
    workingHours: number;
  } {
    const totalMilliseconds = endTime.getTime() - startTime.getTime();
    const totalMinutes = Math.floor(totalMilliseconds / (1000 * 60));
    const workingMinutes = Math.max(0, totalMinutes - excludeBreakMinutes);
    
    return {
      totalMinutes,
      workingMinutes,
      hours: Number((totalMinutes / 60).toFixed(2)),
      workingHours: Number((workingMinutes / 60).toFixed(2))
    };
  }

  formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours === 0) {
      return `${mins}m`;
    } else if (mins === 0) {
      return `${hours}h`;
    } else {
      return `${hours}h ${mins}m`;
    }
  }

  // Date Formatting and Parsing
  formatDateForComparison(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  formatTimeString(date: Date): string {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }

  parseTimeString(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  formatDisplayDate(date: Date): string {
    return date.toLocaleDateString('en-AU', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  formatDisplayDateTime(date: Date): string {
    return date.toLocaleString('en-AU', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  // Financial Year Utilities
  getFinancialYear(date: Date): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // getMonth() returns 0-11
    
    if (month >= 7) {
      // July onwards is current financial year
      return `${year}-${(year + 1).toString().slice(-2)}`;
    } else {
      // Before July is previous financial year
      return `${year - 1}-${year.toString().slice(-2)}`;
    }
  }

  getFinancialYearDates(financialYear: string): { startDate: Date; endDate: Date } {
    const [startYear] = financialYear.split('-');
    const startDate = new Date(parseInt(startYear), 6, 1); // July 1st
    const endDate = new Date(parseInt(startYear) + 1, 5, 30); // June 30th next year
    
    return { startDate, endDate };
  }

  // Private Helper Methods
  private findPeriodStart(
    date: Date, 
    frequency: PayFrequency, 
    startDay: number
  ): Date {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    
    if (frequency === 'weekly') {
      // Find the most recent start day
      const daysDiff = (start.getDay() - startDay + 7) % 7;
      start.setDate(start.getDate() - daysDiff);
    } else if (frequency === 'fortnightly') {
      // For fortnightly, we need to determine which fortnight we're in
      const daysDiff = (start.getDay() - startDay + 7) % 7;
      start.setDate(start.getDate() - daysDiff);
      
      // Determine if we need to go back another week for fortnight alignment
      const weeksSinceEpoch = Math.floor(start.getTime() / (1000 * 60 * 60 * 24 * 7));
      if (weeksSinceEpoch % 2 === 1) {
        start.setDate(start.getDate() - 7);
      }
    } else if (frequency === 'monthly') {
      // First day of the month
      start.setDate(1);
    }
    
    return start;
  }

  private calculatePeriodEnd(startDate: Date, frequency: PayFrequency): Date {
    const end = new Date(startDate);
    
    switch (frequency) {
      case 'weekly':
        end.setDate(end.getDate() + 6);
        break;
      case 'fortnightly':
        end.setDate(end.getDate() + 13);
        break;
      case 'monthly':
        end.setMonth(end.getMonth() + 1);
        end.setDate(end.getDate() - 1);
        break;
    }
    
    end.setHours(23, 59, 59, 999);
    return end;
  }

  private calculatePayDate(periodEnd: Date, daysAfter: number = 7): Date {
    const payDate = new Date(periodEnd);
    payDate.setDate(payDate.getDate() + daysAfter);
    payDate.setHours(9, 0, 0, 0); // 9 AM on pay day
    
    // If pay date falls on weekend, move to Monday
    const dayOfWeek = payDate.getDay();
    if (dayOfWeek === 0) { // Sunday
      payDate.setDate(payDate.getDate() + 1);
    } else if (dayOfWeek === 6) { // Saturday
      payDate.setDate(payDate.getDate() + 2);
    }
    
    return payDate;
  }

  private calculatePeriodNumber(date: Date): number {
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const daysDiff = Math.floor((date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
    return Math.floor(daysDiff / 14) + 1; // Assuming fortnightly periods
  }
}