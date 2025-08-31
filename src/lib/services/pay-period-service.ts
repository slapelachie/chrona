import { prisma } from '@/lib/db';
import { DateUtils, PayPeriodDates } from '@/lib/utils/date-utils';
import { PayFrequency } from '@/types';

export interface PayPeriodWithUser {
  id: string;
  userId: string;
  startDate: Date;
  endDate: Date;
  payDate: Date | null;
  status: string;
}

export class PayPeriodService {
  private static dateUtils = new DateUtils();

  /**
   * Get current pay period for a user, creating one if it doesn't exist
   */
  static async getCurrentPayPeriod(userId?: string): Promise<PayPeriodWithUser> {
    const now = new Date();
    
    // Get user (or first user if no userId provided - single-user app)
    const user = userId 
      ? await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            payPeriodFrequency: true,
            payPeriodStartDay: true
          }
        })
      : await prisma.user.findFirst({
          select: {
            id: true,
            payPeriodFrequency: true,
            payPeriodStartDay: true
          }
        });

    if (!user) {
      throw new Error('User not found');
    }

    // Look for existing pay period that includes today
    const existing = await prisma.payPeriod.findFirst({
      where: {
        userId: user.id,
        startDate: { lte: now },
        endDate: { gte: now }
      }
    });

    // If existing pay period found, validate it matches current user preferences
    if (existing) {
      const frequency = user.payPeriodFrequency as PayFrequency || 'fortnightly';
      const startDay = user.payPeriodStartDay || 1;

      // Calculate what the pay period should be based on current preferences
      const expectedPayPeriod = this.dateUtils.getCurrentPayPeriod(frequency, startDay);
      
      // Check if existing pay period matches expected dates (within 1 day tolerance for rounding)
      const startDateMatch = Math.abs(existing.startDate.getTime() - expectedPayPeriod.startDate.getTime()) < (24 * 60 * 60 * 1000);
      const endDateMatch = Math.abs(existing.endDate.getTime() - expectedPayPeriod.endDate.getTime()) < (24 * 60 * 60 * 1000);
      
      // If existing pay period matches current preferences, return it
      if (startDateMatch && endDateMatch) {
        return existing;
      }
      
      // If preferences have changed, update the existing pay period with correct dates
      const updatedPayPeriod = await prisma.payPeriod.update({
        where: { id: existing.id },
        data: {
          startDate: expectedPayPeriod.startDate,
          endDate: expectedPayPeriod.endDate,
          payDate: expectedPayPeriod.payDate,
          status: 'OPEN'
        }
      });
      
      return updatedPayPeriod;
    }

    // Create new pay period using user preferences
    const frequency = user.payPeriodFrequency as PayFrequency || 'fortnightly';
    const startDay = user.payPeriodStartDay || 1; // Default to Monday

    const payPeriodDates = this.dateUtils.getCurrentPayPeriod(frequency, startDay);

    const newPayPeriod = await prisma.payPeriod.create({
      data: {
        userId: user.id,
        startDate: payPeriodDates.startDate,
        endDate: payPeriodDates.endDate,
        payDate: payPeriodDates.payDate,
        status: 'OPEN'
      }
    });

    return newPayPeriod;
  }

  /**
   * Get pay period dates for a specific user using their preferences
   */
  static async getPayPeriodDates(userId?: string): Promise<PayPeriodDates> {
    // Get user preferences
    const user = userId 
      ? await prisma.user.findUnique({
          where: { id: userId },
          select: {
            payPeriodFrequency: true,
            payPeriodStartDay: true
          }
        })
      : await prisma.user.findFirst({
          select: {
            payPeriodFrequency: true,
            payPeriodStartDay: true
          }
        });

    if (!user) {
      throw new Error('User not found');
    }

    const frequency = user.payPeriodFrequency as PayFrequency || 'fortnightly';
    const startDay = user.payPeriodStartDay || 1;

    return this.dateUtils.getCurrentPayPeriod(frequency, startDay);
  }

  /**
   * Get next pay period dates for a user
   */
  static async getNextPayPeriod(userId?: string): Promise<PayPeriodDates> {
    const currentPeriod = await this.getPayPeriodDates(userId);
    
    const user = userId 
      ? await prisma.user.findUnique({
          where: { id: userId },
          select: { payPeriodFrequency: true }
        })
      : await prisma.user.findFirst({
          select: { payPeriodFrequency: true }
        });

    if (!user) {
      throw new Error('User not found');
    }

    const frequency = user.payPeriodFrequency as PayFrequency || 'fortnightly';
    
    return this.dateUtils.getNextPayPeriod(currentPeriod, frequency);
  }

  /**
   * Get previous pay period dates for a user
   */
  static async getPreviousPayPeriod(userId?: string): Promise<PayPeriodDates> {
    const currentPeriod = await this.getPayPeriodDates(userId);
    
    const user = userId 
      ? await prisma.user.findUnique({
          where: { id: userId },
          select: { payPeriodFrequency: true }
        })
      : await prisma.user.findFirst({
          select: { payPeriodFrequency: true }
        });

    if (!user) {
      throw new Error('User not found');
    }

    const frequency = user.payPeriodFrequency as PayFrequency || 'fortnightly';
    
    return this.dateUtils.getPreviousPayPeriod(currentPeriod, frequency);
  }

  /**
   * Generate multiple pay periods for a user within a date range
   */
  static async generatePayPeriods(
    startDate: Date,
    endDate: Date,
    userId?: string
  ): Promise<PayPeriodDates[]> {
    const user = userId 
      ? await prisma.user.findUnique({
          where: { id: userId },
          select: { payPeriodFrequency: true }
        })
      : await prisma.user.findFirst({
          select: { payPeriodFrequency: true }
        });

    if (!user) {
      throw new Error('User not found');
    }

    const frequency = user.payPeriodFrequency as PayFrequency || 'fortnightly';
    
    return this.dateUtils.generatePayPeriods(startDate, endDate, frequency);
  }

  /**
   * Get the number of pay periods per year for a user
   */
  static async getPayPeriodsPerYear(userId?: string): Promise<number> {
    const user = userId 
      ? await prisma.user.findUnique({
          where: { id: userId },
          select: { payPeriodFrequency: true }
        })
      : await prisma.user.findFirst({
          select: { payPeriodFrequency: true }
        });

    if (!user) {
      throw new Error('User not found');
    }

    const frequency = user.payPeriodFrequency as PayFrequency || 'fortnightly';
    
    switch (frequency) {
      case 'weekly': return 52;
      case 'fortnightly': return 26;
      case 'monthly': return 12;
      default: return 26;
    }
  }

  /**
   * Check if a date falls within the current pay period for a user
   */
  static async isDateInCurrentPayPeriod(date: Date, userId?: string): Promise<boolean> {
    const currentPayPeriod = await this.getCurrentPayPeriod(userId);
    return date >= currentPayPeriod.startDate && date <= currentPayPeriod.endDate;
  }

  /**
   * Get pay period that contains a specific date for a user
   */
  static async getPayPeriodForDate(date: Date, userId?: string): Promise<PayPeriodDates> {
    const user = userId 
      ? await prisma.user.findUnique({
          where: { id: userId },
          select: {
            payPeriodFrequency: true,
            payPeriodStartDay: true
          }
        })
      : await prisma.user.findFirst({
          select: {
            payPeriodFrequency: true,
            payPeriodStartDay: true
          }
        });

    if (!user) {
      throw new Error('User not found');
    }

    const frequency = user.payPeriodFrequency as PayFrequency || 'fortnightly';
    const startDay = user.payPeriodStartDay || 1;

    // Use DateUtils private method logic - we need to implement this properly
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    
    if (frequency === 'weekly') {
      const daysDiff = (start.getDay() - startDay + 7) % 7;
      start.setDate(start.getDate() - daysDiff);
    } else if (frequency === 'fortnightly') {
      const daysDiff = (start.getDay() - startDay + 7) % 7;
      start.setDate(start.getDate() - daysDiff);
      
      const weeksSinceEpoch = Math.floor(start.getTime() / (1000 * 60 * 60 * 24 * 7));
      if (weeksSinceEpoch % 2 === 1) {
        start.setDate(start.getDate() - 7);
      }
    } else if (frequency === 'monthly') {
      start.setDate(1);
    }
    
    const end = new Date(start);
    switch (frequency) {
      case 'weekly':
        end.setDate(end.getDate() + 6);
        break;
      case 'fortnightly':
        end.setDate(end.getDate() + 13);
        break;
      case 'monthly':
        end.setMonth(end.getMonth() + 1, 0);
        break;
    }
    end.setHours(23, 59, 59, 999);
    
    const payDate = new Date(end);
    payDate.setDate(payDate.getDate() + 7);
    payDate.setHours(9, 0, 0, 0);
    
    // Adjust pay date if it falls on weekend
    const dayOfWeek = payDate.getDay();
    if (dayOfWeek === 0) { // Sunday
      payDate.setDate(payDate.getDate() + 1);
    } else if (dayOfWeek === 6) { // Saturday
      payDate.setDate(payDate.getDate() + 2);
    }

    const periodNumber = Math.floor(
      (start.getTime() - new Date(start.getFullYear(), 0, 1).getTime()) 
      / (1000 * 60 * 60 * 24 * (frequency === 'weekly' ? 7 : frequency === 'fortnightly' ? 14 : 30))
    ) + 1;

    return {
      startDate: start,
      endDate: end,
      payDate,
      periodNumber,
      year: start.getFullYear()
    };
  }

  /**
   * Format pay period for display
   */
  static formatPayPeriod(payPeriod: PayPeriodDates | PayPeriodWithUser): string {
    const start = payPeriod.startDate;
    const end = payPeriod.endDate;
    
    return `${start.toLocaleDateString('en-AU', { 
      day: 'numeric', 
      month: 'short' 
    })} - ${end.toLocaleDateString('en-AU', { 
      day: 'numeric', 
      month: 'short',
      year: 'numeric' 
    })}`;
  }

  /**
   * Calculate days until next pay date
   */
  static getDaysUntilPay(payPeriod: PayPeriodDates | PayPeriodWithUser): number {
    const payDate = payPeriod.payDate;
    if (!payDate) return 0;
    
    const today = new Date();
    const timeDiff = payDate.getTime() - today.getTime();
    return Math.max(0, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)));
  }
}