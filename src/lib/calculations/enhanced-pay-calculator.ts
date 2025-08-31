import Decimal from 'decimal.js';
import { PayGuide, PublicHoliday, PenaltyTimeFrame } from '@prisma/client';
import { PayGuideWithPenalties } from '@/types';

// Time segment for penalty analysis
export interface EnhancedTimeSegment {
  startTime: Date;
  endTime: Date;
  penalties: PenaltyTimeFrame[]; // Penalty time frames that apply to this segment
  durationMinutes: number;
  isRegular: boolean; // True if no penalties apply
}

// Hours breakdown for penalty analysis
export interface EnhancedHoursBreakdown {
  regular: Decimal;
  overtime1_5x: Decimal;
  overtime2x: Decimal;
  // Penalty hours (keyed by penalty ID)
  penalties: Map<string, { penalty: PenaltyTimeFrame; hours: Decimal }>;
  // Combined penalty hours for display
  totalPenalty: Decimal;
}

export interface PenaltyBreakdown {
  id: string;
  name: string;
  hours: Decimal;
  rate: Decimal;
  amount: Decimal;
}

export interface EnhancedPayBreakdown {
  baseRate: Decimal;
  regularHours: { hours: Decimal; rate: Decimal; amount: Decimal };
  overtime1_5x: { hours: Decimal; rate: Decimal; amount: Decimal };
  overtime2x: { hours: Decimal; rate: Decimal; amount: Decimal };
  penalties: PenaltyBreakdown[]; // Penalty breakdowns
  casualLoading: { rate: Decimal; amount: Decimal };
  totalPenaltyPay: Decimal;
  regularPay: Decimal;
  overtimePay: Decimal;
  penaltyPay: Decimal;
}

export interface EnhancedShiftCalculation {
  totalMinutes: number;
  regularHours: Decimal;
  overtimeHours: Decimal;
  penaltyHours: Decimal;
  regularPay: Decimal;
  overtimePay: Decimal;
  penaltyPay: Decimal;
  casualLoading: Decimal;
  grossPay: Decimal;
  breakdown: EnhancedPayBreakdown;
  appliedPenalties: string[]; // Names of applied penalties
}

export class EnhancedPayCalculator {
  constructor(
    private payGuide: PayGuideWithPenalties,
    private publicHolidays: PublicHoliday[] = []
  ) {}

  calculateShift(
    startTime: Date,
    endTime: Date,
    breakMinutes: number = 0
  ): EnhancedShiftCalculation {
    // Calculate total working time
    const totalMinutes = this.calculateWorkingMinutes(startTime, endTime, breakMinutes);
    
    // Break down shift into time segments with penalty detection
    const timeSegments = this.analyzePenalties(startTime, endTime, breakMinutes);
    
    // Calculate different types of hours with overtime logic
    const hoursBreakdown = this.calculateEnhancedHoursBreakdown(timeSegments, totalMinutes, startTime, endTime);
    
    // Calculate pay for each component
    const payBreakdown = this.calculateEnhancedPayBreakdown(hoursBreakdown);
    
    // Casual loading is already handled in payBreakdown
    const casualLoading = payBreakdown.casualLoading.amount;
    
    const grossPay = payBreakdown.regularPay
      .plus(payBreakdown.overtimePay)
      .plus(payBreakdown.penaltyPay)
      .plus(casualLoading);

    // Determine applied penalties
    const appliedPenalties = this.getAppliedPenalties(timeSegments);

    return {
      totalMinutes,
      regularHours: hoursBreakdown.regular,
      overtimeHours: hoursBreakdown.overtime1_5x.plus(hoursBreakdown.overtime2x),
      penaltyHours: hoursBreakdown.totalPenalty,
      regularPay: payBreakdown.regularHours.amount,
      overtimePay: payBreakdown.overtime1_5x.amount.plus(payBreakdown.overtime2x.amount),
      penaltyPay: payBreakdown.totalPenaltyPay,
      casualLoading,
      grossPay,
      breakdown: payBreakdown,
      appliedPenalties
    };
  }

  private calculateWorkingMinutes(startTime: Date, endTime: Date, breakMinutes: number): number {
    const totalMilliseconds = endTime.getTime() - startTime.getTime();
    const totalMinutes = Math.floor(totalMilliseconds / (1000 * 60));
    return Math.max(0, totalMinutes - breakMinutes);
  }

  private analyzePenalties(startTime: Date, endTime: Date, breakMinutes: number): EnhancedTimeSegment[] {
    const segments: EnhancedTimeSegment[] = [];
    const workingEndTime = new Date(endTime.getTime() - (breakMinutes * 60 * 1000));
    
    let currentTime = new Date(startTime);
    
    while (currentTime < workingEndTime) {
      const segmentStart = new Date(currentTime);
      const segmentEnd = this.getNextSegmentBoundary(currentTime, workingEndTime);
      
      if (segmentStart >= segmentEnd) break;
      
      const penalties = this.getApplicablePenalties(segmentStart, segmentEnd);
      const durationMinutes = Math.floor((segmentEnd.getTime() - segmentStart.getTime()) / (1000 * 60));
      
      if (durationMinutes > 0) {
        segments.push({
          startTime: segmentStart,
          endTime: segmentEnd,
          penalties,
          durationMinutes,
          isRegular: penalties.length === 0
        });
      }
      
      currentTime = segmentEnd;
    }
    
    return segments;
  }


  private getApplicablePenalties(startTime: Date, endTime: Date): PenaltyTimeFrame[] {
    const applicablePenalties: PenaltyTimeFrame[] = [];
    
    // Check for public holiday first (highest priority - 250% rate)
    if (this.isPublicHoliday(startTime)) {
      // Create a virtual penalty time frame for public holidays
      const publicHolidayPenalty: PenaltyTimeFrame = {
        id: 'public-holiday',
        payGuideId: this.payGuide.id,
        name: 'Public Holiday Penalty',
        description: 'Public holiday penalty rate (250%)',
        startTime: '00:00',
        endTime: '23:59',
        penaltyRate: new Decimal('2.5'), // 250% rate
        dayOfWeek: null,
        priority: 10, // Highest priority
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      applicablePenalties.push(publicHolidayPenalty);
      // Public holidays override all other penalties
      return applicablePenalties;
    }

    // Check defined penalty time frames
    if (this.payGuide.penaltyTimeFrames) {
      const dayOfWeek = startTime.getDay(); // 0=Sunday, 1=Monday, etc.
      
      for (const penalty of this.payGuide.penaltyTimeFrames) {
        // Skip inactive penalties
        if (!penalty.isActive) {
          continue;
        }
        
        // Check day of week constraint
        if (penalty.dayOfWeek !== null && penalty.dayOfWeek !== dayOfWeek) {
          continue;
        }
        
        // Check if the time segment overlaps with the penalty time frame
        const segmentStartTime = this.formatTime(startTime);
        const segmentEndTime = this.formatTime(endTime);
        
        if (this.segmentOverlapsWith(segmentStartTime, segmentEndTime, penalty.startTime, penalty.endTime)) {
          applicablePenalties.push(penalty);
        }
      }
    }
    
    // Sort by priority (higher priority first)
    return applicablePenalties.sort((a, b) => b.priority - a.priority);
  }

  private isPublicHoliday(date: Date): boolean {
    // For local dates (timezone-converted), use local date string instead of ISO
    const dateStr = date.getFullYear() + '-' + 
                    String(date.getMonth() + 1).padStart(2, '0') + '-' + 
                    String(date.getDate()).padStart(2, '0');
    
    return this.publicHolidays.some(holiday => {
      const holidayStr = holiday.date.toISOString().split('T')[0];
      return holidayStr === dateStr;
    });
  }





  private calculateEnhancedHoursBreakdown(timeSegments: EnhancedTimeSegment[], totalMinutes: number, startTime: Date, endTime: Date): EnhancedHoursBreakdown {
    let regularMinutes = 0;

    // Track penalty minutes
    const penaltyMinutes = new Map<string, { penalty: PenaltyTimeFrame; minutes: number }>();

    timeSegments.forEach(segment => {
      if (segment.isRegular) {
        regularMinutes += segment.durationMinutes;
      }

      // Count penalty minutes
      segment.penalties.forEach(penalty => {
        const key = penalty.id;
        const existing = penaltyMinutes.get(key);
        if (existing) {
          existing.minutes += segment.durationMinutes;
        } else {
          penaltyMinutes.set(key, {
            penalty,
            minutes: segment.durationMinutes
          });
        }
      });
    });

    const totalHours = new Decimal(totalMinutes).div(60);
    
    // Apply Australian retail award overtime logic
    const overtimeResult = this.calculateRetailOvertimeHours(totalHours, startTime, endTime, timeSegments);
    
    let overtime1_5xHours = overtimeResult.overtime1_5x;
    let overtime2xHours = overtimeResult.overtime2x;
    let regularHours = new Decimal(regularMinutes).div(60).sub(overtime1_5xHours).sub(overtime2xHours);
    
    // Ensure regular hours don't go negative
    if (regularHours.lt(0)) {
      regularHours = new Decimal(0);
    }

    // Convert penalty minutes to hours
    const penaltyHours = new Map<string, { penalty: PenaltyTimeFrame; hours: Decimal }>();
    penaltyMinutes.forEach((value, key) => {
      penaltyHours.set(key, {
        penalty: value.penalty,
        hours: new Decimal(value.minutes).div(60)
      });
    });

    // Calculate total penalty hours
    const penaltyMinutesTotal = Array.from(penaltyMinutes.values())
      .reduce((sum, item) => sum + item.minutes, 0);
    const totalPenaltyMinutes = penaltyMinutesTotal;

    return {
      regular: regularHours,
      overtime1_5x: overtime1_5xHours,
      overtime2x: overtime2xHours,
      penalties: penaltyHours,
      totalPenalty: new Decimal(totalPenaltyMinutes).div(60)
    };
  }

  private calculateEnhancedPayBreakdown(hoursBreakdown: EnhancedHoursBreakdown): EnhancedPayBreakdown {
    const baseRate = this.payGuide.baseHourlyRate;
    
    const regularPay = hoursBreakdown.regular.mul(baseRate);
    
    // Use configurable overtime rates from PayGuide
    const overtime1_5xPay = hoursBreakdown.overtime1_5x
      .mul(baseRate)
      .mul(this.payGuide.overtimeRate1_5x); // Configurable rate (default 175% for retail)
      
    const overtime2xPay = hoursBreakdown.overtime2x
      .mul(baseRate)
      .mul(this.payGuide.overtimeRate2x); // Configurable rate (default 225% for retail)
    
    // Calculate penalty pay
    const penaltyBreakdowns: PenaltyBreakdown[] = [];
    let penaltyTotalPay = new Decimal(0);
    
    hoursBreakdown.penalties.forEach((value, key) => {
      const penaltyPay = value.hours
        .mul(baseRate)
        .mul(value.penalty.penaltyRate);
      
      penaltyBreakdowns.push({
        id: value.penalty.id,
        name: value.penalty.name,
        hours: value.hours,
        rate: baseRate.mul(value.penalty.penaltyRate),
        amount: penaltyPay
      });
      
      penaltyTotalPay = penaltyTotalPay.plus(penaltyPay);
    });

    const totalPenaltyPay = penaltyTotalPay;

    // Calculate casual loading from PayGuide
    const casualLoadingRate = this.payGuide.casualLoading || new Decimal(0);
    const casualLoading = casualLoadingRate.greaterThan(0) 
      ? regularPay.plus(overtime1_5xPay).plus(overtime2xPay).plus(totalPenaltyPay).mul(casualLoadingRate)
      : new Decimal(0);

    return {
      baseRate,
      regularHours: {
        hours: hoursBreakdown.regular,
        rate: baseRate,
        amount: regularPay
      },
      overtime1_5x: {
        hours: hoursBreakdown.overtime1_5x,
        rate: baseRate.mul(this.payGuide.overtimeRate1_5x),
        amount: overtime1_5xPay
      },
      overtime2x: {
        hours: hoursBreakdown.overtime2x,
        rate: baseRate.mul(this.payGuide.overtimeRate2x),
        amount: overtime2xPay
      },
      penalties: penaltyBreakdowns,
      casualLoading: {
        rate: casualLoadingRate,
        amount: casualLoading
      },
      totalPenaltyPay,
      regularPay: regularPay,
      overtimePay: overtime1_5xPay.plus(overtime2xPay),
      penaltyPay: totalPenaltyPay
    };
  }

  /**
   * Calculate overtime hours according to Australian retail award rules:
   * 1. Outside span of ordinary hours
   * 2. Over 11 hours on one day (Monday only, once per week)
   * 3. Over 9 hours on other days
   * 4. Over 38 hours per week (weekly check would be done at pay period level)
   */
  private calculateRetailOvertimeHours(
    totalHours: Decimal, 
    startTime: Date, 
    endTime: Date, 
    timeSegments: EnhancedTimeSegment[]
  ): { overtime1_5x: Decimal; overtime2x: Decimal } {
    let overtime1_5x = new Decimal(0);
    let overtime2x = new Decimal(0);

    const dayOfWeek = startTime.getDay();
    
    
    // Check if work extends outside span of ordinary hours (if configured)
    if (this.payGuide.overtimeOnSpanBoundary) {
      const spanStart = this.getSpanStart(dayOfWeek);
      const spanEnd = this.getSpanEnd(dayOfWeek);
      const outsideSpanMinutes = this.calculateOutsideSpanMinutes(startTime, endTime, spanStart, spanEnd);
      
      if (outsideSpanMinutes > 0) {
        const outsideSpanHours = new Decimal(outsideSpanMinutes).div(60);
        
        // Apply overtime rates based on day and PayGuide configuration
        if (dayOfWeek === 0) { // Sunday
          // Sunday OT uses the higher rate (overtime2x)
          overtime2x = overtime2x.plus(outsideSpanHours);
        } else {
          // Monday-Saturday: distribute between rates based on hours
          // First portion goes to overtime1_5x, excess goes to overtime2x
          const firstTierLimit = new Decimal(3); // This could be made configurable
          if (outsideSpanHours.lte(firstTierLimit)) {
            overtime1_5x = overtime1_5x.plus(outsideSpanHours);
          } else {
            overtime1_5x = overtime1_5x.plus(firstTierLimit);
            overtime2x = overtime2x.plus(outsideSpanHours.sub(firstTierLimit));
          }
        }
      }
    }
    
    // Check daily hour limits (if configured)
    if (this.payGuide.overtimeOnDailyLimit) {
      const dailyOvertimeHours = this.calculateDailyOvertimeHours(totalHours, dayOfWeek);
      if (dailyOvertimeHours.gt(0)) {
        // Add to existing overtime (don't double-count)
        const additionalOT = dailyOvertimeHours.sub(overtime1_5x).sub(overtime2x);
        if (additionalOT.gt(0)) {
          if (dayOfWeek === 0) { // Sunday
            overtime2x = overtime2x.plus(additionalOT);
          } else {
            // Add to lower rate first, then higher rate
            overtime1_5x = overtime1_5x.plus(additionalOT);
          }
        }
      }
    }

    return { overtime1_5x, overtime2x };
  }

  private getSpanStart(dayOfWeek: number): string {
    switch (dayOfWeek) {
      case 0: return this.payGuide.sundayStart || '09:00'; // Sunday
      case 1: return this.payGuide.mondayStart || '07:00'; // Monday
      case 2: return this.payGuide.tuesdayStart || '07:00'; // Tuesday
      case 3: return this.payGuide.wednesdayStart || '07:00'; // Wednesday
      case 4: return this.payGuide.thursdayStart || '07:00'; // Thursday
      case 5: return this.payGuide.fridayStart || '07:00'; // Friday
      case 6: return this.payGuide.saturdayStart || '07:00'; // Saturday
      default: return '07:00';
    }
  }

  private getSpanEnd(dayOfWeek: number): string {
    switch (dayOfWeek) {
      case 0: return this.payGuide.sundayEnd || '18:00'; // Sunday
      case 1: return this.payGuide.mondayEnd || '21:00'; // Monday
      case 2: return this.payGuide.tuesdayEnd || '21:00'; // Tuesday
      case 3: return this.payGuide.wednesdayEnd || '21:00'; // Wednesday
      case 4: return this.payGuide.thursdayEnd || '21:00'; // Thursday
      case 5: return this.payGuide.fridayEnd || '21:00'; // Friday
      case 6: return this.payGuide.saturdayEnd || '18:00'; // Saturday
      default: return '21:00';
    }
  }

  private calculateOutsideSpanMinutes(startTime: Date, endTime: Date, spanStart: string, spanEnd: string): number {
    const startTimeStr = this.formatTime(startTime);
    const endTimeStr = this.formatTime(endTime);
    
    const shiftStartMinutes = this.timeStringToMinutes(startTimeStr);
    const shiftEndMinutes = this.timeStringToMinutes(endTimeStr);
    const spanStartMinutes = this.timeStringToMinutes(spanStart);
    const spanEndMinutes = this.timeStringToMinutes(spanEnd);
    
    let outsideMinutes = 0;
    
    // Before span start
    if (shiftStartMinutes < spanStartMinutes) {
      const beforeSpanEnd = Math.min(shiftEndMinutes, spanStartMinutes);
      const beforeSpanMinutes = beforeSpanEnd - shiftStartMinutes;
      outsideMinutes += beforeSpanMinutes;
    }
    
    // After span end
    if (shiftEndMinutes > spanEndMinutes) {
      const afterSpanStart = Math.max(shiftStartMinutes, spanEndMinutes);
      const afterSpanMinutes = shiftEndMinutes - afterSpanStart;
      outsideMinutes += afterSpanMinutes;
    }
    return Math.max(0, outsideMinutes);
  }

  private calculateDailyOvertimeHours(totalHours: Decimal, dayOfWeek: number): Decimal {
    // Use configurable daily limits from PayGuide
    // Check if this day can have extended hours (typically Monday for retail)
    const canHaveExtendedHours = dayOfWeek === 1; // Monday - this could be made configurable too
    const dailyLimit = canHaveExtendedHours 
      ? (this.payGuide.specialDayOvertimeHours || this.payGuide.dailyOvertimeHours)
      : this.payGuide.dailyOvertimeHours;
    
    if (totalHours.gt(dailyLimit)) {
      const overtimeHours = totalHours.sub(dailyLimit);
      return overtimeHours;
    }
    
    return new Decimal(0);
  }

  private getAppliedPenalties(segments: EnhancedTimeSegment[]): string[] {
    const appliedPenalties = new Set<string>();
    
    segments.forEach(segment => {
      // Add penalty names
      segment.penalties.forEach(penalty => {
        appliedPenalties.add(penalty.name);
      });
    });
    
    return Array.from(appliedPenalties).sort();
  }

  // Helper methods (reused from original PayCalculator)
  private getNextSegmentBoundary(currentTime: Date, endTime: Date): Date {
    // Get boundaries on current day - custom penalties only
    const boundaries = [
      // Handle midnight boundary
      new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate() + 1, 0, 0, 0),
      endTime
    ];

    // Add penalty boundaries
    if (this.payGuide.penaltyTimeFrames) {
      const dayOfWeek = currentTime.getDay();
      for (const penalty of this.payGuide.penaltyTimeFrames) {
        if (penalty.isActive && (penalty.dayOfWeek === null || penalty.dayOfWeek === dayOfWeek)) {
          boundaries.push(this.getTimeOnDate(currentTime, penalty.startTime));
          boundaries.push(this.getTimeOnDate(currentTime, penalty.endTime));
          
          // Handle midnight crossing for penalties
          const startMinutes = this.timeStringToMinutes(penalty.startTime);
          const endMinutes = this.timeStringToMinutes(penalty.endTime);
          
          if (endMinutes <= startMinutes) {
            // Penalty crosses midnight
            const nextDay = new Date(currentTime);
            nextDay.setDate(currentTime.getDate() + 1);
            boundaries.push(this.getTimeOnDate(nextDay, penalty.endTime));
          }
        }
      }
    }
    
    // Penalties handle their own midnight crossing logic above

    const validBoundaries = boundaries.filter(boundary => boundary > currentTime);
    const nextBoundary = validBoundaries.sort((a, b) => a.getTime() - b.getTime())[0] || endTime;
    
    return nextBoundary;
  }


  private getTimeOnDate(date: Date, timeStr: string): Date {
    const [hours, minutes] = timeStr.split(':').map(Number);
    
    // Create the date in local time to match input dates
    // Extract the local date components from the input date
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    
    // Create the result date in local time with the specified time
    const result = new Date(year, month, day, hours, minutes, 0);
    return result;
  }

  private formatTime(date: Date): string {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }

  private isTimeBetween(timeStr: string, startStr: string, endStr: string): boolean {
    const time = this.timeStringToMinutes(timeStr);
    const start = this.timeStringToMinutes(startStr);
    const end = this.timeStringToMinutes(endStr);
    
    if (start <= end) {
      return time >= start && time < end;
    } else {
      // Handles overnight periods (e.g., 22:00 - 06:00)
      return time >= start || time < end;
    }
  }

  private timeStringToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Check if a time segment overlaps with a penalty period
   * Handles overnight periods (e.g., night shift 22:00-06:00)
   */
  private segmentOverlapsWith(segmentStart: string, segmentEnd: string, penaltyStart: string, penaltyEnd: string): boolean {
    const segStart = this.timeStringToMinutes(segmentStart);
    let segEnd = this.timeStringToMinutes(segmentEnd);
    const penStart = this.timeStringToMinutes(penaltyStart);
    const penEnd = this.timeStringToMinutes(penaltyEnd);
    
    // Handle segment that crosses midnight (e.g., 22:00-00:00)
    // If segment end is less than start, it crosses midnight
    if (segEnd < segStart) {
      segEnd += 1440; // Add 24 hours in minutes
    }
    
    // Handle normal penalty periods (e.g., evening: 18:00-22:00)
    if (penStart <= penEnd) {
      // For normal penalty periods, check straightforward overlap
      return !(segEnd <= penStart || segStart >= penEnd);
    }
    
    // Handle overnight penalty periods (e.g., night: 22:00-06:00)
    // The penalty period crosses midnight
    else {
      // Check if segment overlaps with either:
      // 1. Late night portion (22:00-24:00)
      // 2. Early morning portion (00:00-06:00)
      
      // For segments that also cross midnight, we need to check both parts
      if (segEnd > 1440) {
        // Segment crosses midnight, split it into two parts
        const lateNightOverlap = !(1440 <= penStart || segStart >= 1440);  // 22:00-24:00
        const earlyMorningOverlap = !((segEnd - 1440) <= 0 || 0 >= penEnd); // 00:00-06:00
        return lateNightOverlap || earlyMorningOverlap;
      } else {
        // Segment doesn't cross midnight
        const overlapsLateNight = !(segEnd <= penStart || segStart >= 1440);  // Check against 22:00-24:00
        const overlapsEarlyMorning = !(segEnd <= 0 || segStart >= penEnd);    // Check against 00:00-06:00
        return overlapsLateNight || overlapsEarlyMorning;
      }
    }
  }

}