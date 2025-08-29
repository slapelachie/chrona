import Decimal from 'decimal.js';
import { PayGuide, PublicHoliday } from '@prisma/client';

// Enhanced interfaces for multiple penalty support
export interface PenaltyOverride {
  evening?: boolean | null; // null = auto, true/false = override
  night?: boolean | null;
  weekend?: boolean | null;
  publicHoliday?: boolean | null;
  overrideReason?: string;
  overrideTimestamp?: Date;
}

export interface EnhancedTimeSegment {
  startTime: Date;
  endTime: Date;
  penaltyTypes: ('evening' | 'night' | 'weekend' | 'public_holiday')[];
  durationMinutes: number;
  isRegular: boolean;
}

export interface EnhancedHoursBreakdown {
  regular: Decimal;
  overtime1_5x: Decimal;
  overtime2x: Decimal;
  // Individual penalty hours (can overlap)
  evening: Decimal;
  night: Decimal;
  saturday: Decimal;
  sunday: Decimal;
  publicHoliday: Decimal;
  // Combined penalty hours for display
  totalPenalty: Decimal;
}

export interface EnhancedPayBreakdown {
  baseRate: Decimal;
  regularHours: { hours: Decimal; rate: Decimal; amount: Decimal };
  overtime1_5x: { hours: Decimal; rate: Decimal; amount: Decimal };
  overtime2x: { hours: Decimal; rate: Decimal; amount: Decimal };
  eveningPenalty: { hours: Decimal; rate: Decimal; amount: Decimal };
  nightPenalty: { hours: Decimal; rate: Decimal; amount: Decimal };
  saturdayPenalty: { hours: Decimal; rate: Decimal; amount: Decimal };
  sundayPenalty: { hours: Decimal; rate: Decimal; amount: Decimal };
  publicHolidayPenalty: { hours: Decimal; rate: Decimal; amount: Decimal };
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
  appliedPenalties: string[];
  penaltyOverridesApplied: boolean;
}

export interface PenaltyCombinationRules {
  allowCombinations: boolean;
  combinationMatrix: {
    [key: string]: {
      canCombineWith: string[];
      calculation: 'additive' | 'highest' | 'multiplicative';
      priority: number;
    };
  };
}

export class EnhancedPayCalculator {
  private defaultCombinationRules: PenaltyCombinationRules = {
    allowCombinations: true,
    combinationMatrix: {
      evening: {
        canCombineWith: ['weekend', 'public_holiday'],
        calculation: 'additive',
        priority: 1
      },
      night: {
        canCombineWith: ['weekend', 'public_holiday'],
        calculation: 'additive',
        priority: 2
      },
      weekend: {
        canCombineWith: ['evening', 'night'],
        calculation: 'additive',
        priority: 3
      },
      public_holiday: {
        canCombineWith: ['evening', 'night'],
        calculation: 'highest', // Public holiday usually takes precedence
        priority: 4
      }
    }
  };

  constructor(
    private payGuide: PayGuide,
    private publicHolidays: PublicHoliday[] = []
  ) {}

  calculateShift(
    startTime: Date,
    endTime: Date,
    breakMinutes: number = 0,
    penaltyOverrides?: PenaltyOverride
  ): EnhancedShiftCalculation {
    // Calculate total working time
    const totalMinutes = this.calculateWorkingMinutes(startTime, endTime, breakMinutes);
    
    // Break down shift into time segments with multiple penalty detection
    const timeSegments = this.analyzeMultiplePenalties(startTime, endTime, breakMinutes);
    
    // Apply penalty overrides if provided
    const adjustedSegments = penaltyOverrides 
      ? this.applyPenaltyOverrides(timeSegments, penaltyOverrides)
      : timeSegments;
    
    // Calculate different types of hours
    const hoursBreakdown = this.calculateEnhancedHoursBreakdown(adjustedSegments, totalMinutes);
    
    // Calculate pay for each component
    const payBreakdown = this.calculateEnhancedPayBreakdown(hoursBreakdown);
    
    // Apply casual loading
    const casualLoading = payBreakdown.regularPay
      .plus(payBreakdown.overtimePay)
      .plus(payBreakdown.penaltyPay)
      .mul(this.payGuide.casualLoading);
    
    const grossPay = payBreakdown.regularPay
      .plus(payBreakdown.overtimePay)
      .plus(payBreakdown.penaltyPay)
      .plus(casualLoading);

    // Determine applied penalties
    const appliedPenalties = this.getAppliedPenalties(adjustedSegments);

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
      appliedPenalties,
      penaltyOverridesApplied: !!penaltyOverrides
    };
  }

  private calculateWorkingMinutes(startTime: Date, endTime: Date, breakMinutes: number): number {
    const totalMilliseconds = endTime.getTime() - startTime.getTime();
    const totalMinutes = Math.floor(totalMilliseconds / (1000 * 60));
    return Math.max(0, totalMinutes - breakMinutes);
  }

  private analyzeMultiplePenalties(startTime: Date, endTime: Date, breakMinutes: number): EnhancedTimeSegment[] {
    const segments: EnhancedTimeSegment[] = [];
    const workingEndTime = new Date(endTime.getTime() - (breakMinutes * 60 * 1000));
    
    let currentTime = new Date(startTime);
    
    while (currentTime < workingEndTime) {
      const segmentStart = new Date(currentTime);
      const segmentEnd = this.getNextSegmentBoundary(currentTime, workingEndTime);
      
      if (segmentStart >= segmentEnd) break;
      
      const penaltyTypes = this.getAllApplicablePenalties(segmentStart, segmentEnd);
      const durationMinutes = Math.floor((segmentEnd.getTime() - segmentStart.getTime()) / (1000 * 60));
      
      if (durationMinutes > 0) {
        segments.push({
          startTime: segmentStart,
          endTime: segmentEnd,
          penaltyTypes,
          durationMinutes,
          isRegular: penaltyTypes.length === 0
        });
      }
      
      currentTime = segmentEnd;
    }
    
    return segments;
  }

  private getAllApplicablePenalties(startTime: Date, endTime: Date): ('evening' | 'night' | 'weekend' | 'public_holiday')[] {
    const penalties: ('evening' | 'night' | 'weekend' | 'public_holiday')[] = [];
    
    // For time segments, we need to check the actual time period, not the average
    // We'll check both start and end times to capture any penalties that apply during this segment
    
    // Check for public holiday - use start time to determine the date
    if (this.isPublicHoliday(startTime)) {
      penalties.push('public_holiday');
    }
    
    // Check for weekend penalties - check both start and end dates for segments that cross midnight
    const startDayOfWeek = startTime.getDay();
    const endDayOfWeek = endTime.getDay();
    
    // If this segment includes weekend time, mark as weekend
    if (startDayOfWeek === 0 || startDayOfWeek === 6 || endDayOfWeek === 0 || endDayOfWeek === 6) {
      penalties.push('weekend');
    }
    
    // Check time-based penalties for the entire segment duration
    const startTimeStr = this.formatTime(startTime);
    const endTimeStr = this.formatTime(endTime);
    const eveningStart = this.payGuide.eveningStart;
    const eveningEnd = this.payGuide.eveningEnd;
    const nightStart = this.payGuide.nightStart;
    const nightEnd = this.payGuide.nightEnd;
    
    // Check if any part of this segment falls within evening hours
    const hasEvening = this.segmentOverlapsWith(startTimeStr, endTimeStr, eveningStart, eveningEnd);
    if (hasEvening) {
      penalties.push('evening');
    }
    
    // Check if any part of this segment falls within night hours  
    const hasNight = this.segmentOverlapsWith(startTimeStr, endTimeStr, nightStart, nightEnd);
    if (hasNight) {
      penalties.push('night');
    }
    
    
    // Apply combination rules if configured
    if (!this.payGuide.allowPenaltyCombination && penalties.length > 1) {
      return this.applyPenaltyCombinationRules(penalties);
    }
    
    return penalties;
  }

  private applyPenaltyCombinationRules(penalties: string[]): ('evening' | 'night' | 'weekend' | 'public_holiday')[] {
    const rules = this.getCombinationRules();
    
    if (!rules.allowCombinations) {
      // Return the highest priority penalty
      return [penalties.sort((a, b) => 
        (rules.combinationMatrix[b]?.priority || 0) - (rules.combinationMatrix[a]?.priority || 0)
      )[0]] as ('evening' | 'night' | 'weekend' | 'public_holiday')[];
    }
    
    // Apply combination matrix rules
    const allowedCombinations: string[] = [];
    
    for (const penalty of penalties) {
      const penaltyRules = rules.combinationMatrix[penalty];
      if (!penaltyRules) {
        allowedCombinations.push(penalty);
        continue;
      }
      
      const canCombine = penalties.every(otherPenalty => 
        otherPenalty === penalty || penaltyRules.canCombineWith.includes(otherPenalty)
      );
      
      if (canCombine) {
        allowedCombinations.push(penalty);
      }
    }
    
    return allowedCombinations as ('evening' | 'night' | 'weekend' | 'public_holiday')[];
  }

  private getCombinationRules(): PenaltyCombinationRules {
    if (this.payGuide.penaltyCombinationRules) {
      try {
        return JSON.parse(this.payGuide.penaltyCombinationRules);
      } catch {
        console.warn('Failed to parse penalty combination rules, using defaults');
      }
    }
    return this.defaultCombinationRules;
  }

  private applyPenaltyOverrides(segments: EnhancedTimeSegment[], overrides: PenaltyOverride): EnhancedTimeSegment[] {
    return segments.map(segment => {
      const modifiedPenalties = [...segment.penaltyTypes];
      
      // Apply overrides
      Object.entries(overrides).forEach(([penaltyType, override]) => {
        if (override === null) return; // Auto calculation
        
        const penaltyName = penaltyType as keyof PenaltyOverride;
        if (penaltyName === 'overrideReason' || penaltyName === 'overrideTimestamp') return;
        
        const penaltyKey = penaltyName === 'weekend' ? 'weekend' : penaltyName;
        const currentlyHasPenalty = modifiedPenalties.includes(penaltyKey as 'evening' | 'night' | 'weekend' | 'public_holiday');
        
        if (override && !currentlyHasPenalty) {
          // Force add penalty
          modifiedPenalties.push(penaltyKey as 'evening' | 'night' | 'weekend' | 'public_holiday');
        } else if (!override && currentlyHasPenalty) {
          // Force remove penalty
          const index = modifiedPenalties.indexOf(penaltyKey as 'evening' | 'night' | 'weekend' | 'public_holiday');
          if (index > -1) {
            modifiedPenalties.splice(index, 1);
          }
        }
      });
      
      return {
        ...segment,
        penaltyTypes: modifiedPenalties,
        isRegular: modifiedPenalties.length === 0
      };
    });
  }

  private calculateEnhancedHoursBreakdown(timeSegments: EnhancedTimeSegment[], totalMinutes: number): EnhancedHoursBreakdown {
    let regularMinutes = 0;
    let eveningMinutes = 0;
    let nightMinutes = 0;
    let saturdayMinutes = 0;
    let sundayMinutes = 0;
    let publicHolidayMinutes = 0;

    timeSegments.forEach(segment => {
      if (segment.isRegular) {
        regularMinutes += segment.durationMinutes;
      }
      
      // Count penalty minutes (can overlap)
      segment.penaltyTypes.forEach(penaltyType => {
        switch (penaltyType) {
          case 'evening':
            eveningMinutes += segment.durationMinutes;
            break;
          case 'night':
            nightMinutes += segment.durationMinutes;
            break;
          case 'weekend':
            const avgTime = new Date((segment.startTime.getTime() + segment.endTime.getTime()) / 2);
            if (avgTime.getDay() === 0) { // Sunday
              sundayMinutes += segment.durationMinutes;
            } else { // Saturday
              saturdayMinutes += segment.durationMinutes;
            }
            break;
          case 'public_holiday':
            publicHolidayMinutes += segment.durationMinutes;
            break;
        }
      });
    });

    const totalHours = new Decimal(totalMinutes).div(60);
    const dailyOvertimeThreshold = this.payGuide.dailyOvertimeHours;
    
    // Calculate overtime
    let overtime1_5xHours = new Decimal(0);
    let overtime2xHours = new Decimal(0);
    let regularHours = new Decimal(regularMinutes).div(60);
    
    if (totalHours.gt(dailyOvertimeThreshold)) {
      const overtimeHours = totalHours.sub(dailyOvertimeThreshold);
      
      if (overtimeHours.gt(2)) {
        // First 2 hours at 1.5x, rest at 2x
        overtime1_5xHours = new Decimal(2);
        overtime2xHours = overtimeHours.sub(2);
      } else {
        // All overtime at 1.5x
        overtime1_5xHours = overtimeHours;
      }
      
      // Reduce regular hours by overtime amount
      regularHours = dailyOvertimeThreshold;
    }

    // Calculate total penalty hours (unique, not overlapping for display)
    const totalPenaltyMinutes = eveningMinutes + nightMinutes + saturdayMinutes + sundayMinutes + publicHolidayMinutes;

    return {
      regular: regularHours,
      overtime1_5x: overtime1_5xHours,
      overtime2x: overtime2xHours,
      evening: new Decimal(eveningMinutes).div(60),
      night: new Decimal(nightMinutes).div(60),
      saturday: new Decimal(saturdayMinutes).div(60),
      sunday: new Decimal(sundayMinutes).div(60),
      publicHoliday: new Decimal(publicHolidayMinutes).div(60),
      totalPenalty: new Decimal(totalPenaltyMinutes).div(60)
    };
  }

  private calculateEnhancedPayBreakdown(hoursBreakdown: EnhancedHoursBreakdown): EnhancedPayBreakdown {
    const baseRate = this.payGuide.baseHourlyRate;
    
    const regularPay = hoursBreakdown.regular.mul(baseRate);
    
    const overtime1_5xPay = hoursBreakdown.overtime1_5x
      .mul(baseRate)
      .mul(this.payGuide.overtimeRate1_5x);
      
    const overtime2xPay = hoursBreakdown.overtime2x
      .mul(baseRate)
      .mul(this.payGuide.overtimeRate2x);
    
    // Calculate penalty pay for each type
    const eveningPay = hoursBreakdown.evening
      .mul(baseRate)
      .mul(this.payGuide.eveningPenalty);
      
    const nightPay = hoursBreakdown.night
      .mul(baseRate)
      .mul(this.payGuide.nightPenalty);
      
    const saturdayPay = hoursBreakdown.saturday
      .mul(baseRate)
      .mul(this.payGuide.saturdayPenalty);

    const sundayPay = hoursBreakdown.sunday
      .mul(baseRate)
      .mul(this.payGuide.sundayPenalty);
        
    const publicHolidayPay = hoursBreakdown.publicHoliday
      .mul(baseRate)
      .mul(this.payGuide.publicHolidayPenalty);

    const totalPenaltyPay = eveningPay.plus(nightPay).plus(saturdayPay).plus(sundayPay).plus(publicHolidayPay);

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
      eveningPenalty: {
        hours: hoursBreakdown.evening,
        rate: baseRate.mul(this.payGuide.eveningPenalty),
        amount: eveningPay
      },
      nightPenalty: {
        hours: hoursBreakdown.night,
        rate: baseRate.mul(this.payGuide.nightPenalty),
        amount: nightPay
      },
      saturdayPenalty: {
        hours: hoursBreakdown.saturday,
        rate: baseRate.mul(this.payGuide.saturdayPenalty),
        amount: saturdayPay
      },
      sundayPenalty: {
        hours: hoursBreakdown.sunday,
        rate: baseRate.mul(this.payGuide.sundayPenalty),
        amount: sundayPay
      },
      publicHolidayPenalty: {
        hours: hoursBreakdown.publicHoliday,
        rate: baseRate.mul(this.payGuide.publicHolidayPenalty),
        amount: publicHolidayPay
      },
      casualLoading: {
        rate: this.payGuide.casualLoading,
        amount: regularPay.plus(overtime1_5xPay).plus(overtime2xPay).plus(totalPenaltyPay).mul(this.payGuide.casualLoading)
      },
      totalPenaltyPay,
      regularPay: regularPay,
      overtimePay: overtime1_5xPay.plus(overtime2xPay),
      penaltyPay: totalPenaltyPay
    };
  }

  private getAppliedPenalties(segments: EnhancedTimeSegment[]): string[] {
    const appliedPenalties = new Set<string>();
    
    segments.forEach(segment => {
      segment.penaltyTypes.forEach(penaltyType => {
        switch (penaltyType) {
          case 'evening':
            appliedPenalties.add('Evening');
            break;
          case 'night':
            appliedPenalties.add('Night');
            break;
          case 'weekend':
            const avgTime = new Date((segment.startTime.getTime() + segment.endTime.getTime()) / 2);
            appliedPenalties.add(avgTime.getDay() === 0 ? 'Sunday' : 'Saturday');
            break;
          case 'public_holiday':
            appliedPenalties.add('Public Holiday');
            break;
        }
      });
    });
    
    return Array.from(appliedPenalties).sort();
  }

  // Helper methods (reused from original PayCalculator)
  private getNextSegmentBoundary(currentTime: Date, endTime: Date): Date {
    // Get boundaries on current day
    const boundaries = [
      this.getTimeOnDate(currentTime, this.payGuide.eveningStart),
      this.getTimeOnDate(currentTime, this.payGuide.eveningEnd),
      this.getTimeOnDate(currentTime, this.payGuide.nightStart),
      // Handle midnight boundary
      new Date(Date.UTC(currentTime.getUTCFullYear(), currentTime.getUTCMonth(), currentTime.getUTCDate() + 1, 0, 0, 0)),
      endTime
    ];
    
    // For night end time, we need to check if it should be next day
    // Night periods that cross midnight (e.g., 22:00-06:00) need special handling
    const nightStartMinutes = this.timeStringToMinutes(this.payGuide.nightStart);
    const nightEndMinutes = this.timeStringToMinutes(this.payGuide.nightEnd);
    
    if (nightEndMinutes <= nightStartMinutes) {
      // Night period crosses midnight, so night end is on the next day
      const nextDay = new Date(currentTime);
      nextDay.setUTCDate(currentTime.getUTCDate() + 1);
      boundaries.push(this.getTimeOnDate(nextDay, this.payGuide.nightEnd));
    } else {
      // Night period is on same day
      boundaries.push(this.getTimeOnDate(currentTime, this.payGuide.nightEnd));
    }

    const validBoundaries = boundaries.filter(boundary => boundary > currentTime);
    const nextBoundary = validBoundaries.sort((a, b) => a.getTime() - b.getTime())[0] || endTime;
    
    return nextBoundary;
  }

  private isPublicHoliday(date: Date): boolean {
    const dateStr = date.toISOString().split('T')[0];
    return this.publicHolidays.some(holiday => {
      const holidayStr = holiday.date.toISOString().split('T')[0];
      return holidayStr === dateStr;
    });
  }

  private getTimeOnDate(date: Date, timeStr: string): Date {
    const [hours, minutes] = timeStr.split(':').map(Number);
    
    // Create the date in UTC to avoid timezone conversion issues
    // Extract the UTC date components from the input date
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const day = date.getUTCDate();
    
    // Create the result date in UTC with the specified time
    const result = new Date(Date.UTC(year, month, day, hours, minutes, 0));
    return result;
  }

  private formatTime(date: Date): string {
    return `${date.getUTCHours().toString().padStart(2, '0')}:${date.getUTCMinutes().toString().padStart(2, '0')}`;
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