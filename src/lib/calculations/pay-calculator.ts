import Decimal from 'decimal.js';
import { PayGuide, PublicHoliday } from '@prisma/client';

export interface ShiftCalculation {
  totalMinutes: number;
  regularHours: Decimal;
  overtimeHours: Decimal;
  penaltyHours: Decimal;
  regularPay: Decimal;
  overtimePay: Decimal;
  penaltyPay: Decimal;
  casualLoading: Decimal;
  grossPay: Decimal;
  breakdown: PayBreakdown;
}

export interface PayBreakdown {
  baseRate: Decimal;
  regularHours: { hours: Decimal; rate: Decimal; amount: Decimal };
  overtime1_5x: { hours: Decimal; rate: Decimal; amount: Decimal };
  overtime2x: { hours: Decimal; rate: Decimal; amount: Decimal };
  eveningPenalty: { hours: Decimal; rate: Decimal; amount: Decimal };
  nightPenalty: { hours: Decimal; rate: Decimal; amount: Decimal };
  weekendPenalty: { hours: Decimal; rate: Decimal; amount: Decimal };
  publicHolidayPenalty: { hours: Decimal; rate: Decimal; amount: Decimal };
  casualLoading: { rate: Decimal; amount: Decimal };
}

export interface TimeSegment {
  startTime: Date;
  endTime: Date;
  type: 'regular' | 'evening' | 'night' | 'weekend' | 'public_holiday';
  durationMinutes: number;
}

export class PayCalculator {
  constructor(
    private payGuide: PayGuide,
    private publicHolidays: PublicHoliday[] = []
  ) {}

  calculateShift(
    startTime: Date,
    endTime: Date,
    breakMinutes: number = 0
  ): ShiftCalculation {
    // Calculate total working time
    const totalMinutes = this.calculateWorkingMinutes(startTime, endTime, breakMinutes);
    
    // Break down shift into time segments
    const timeSegments = this.analyzeTimeSegments(startTime, endTime, breakMinutes);
    
    // Calculate different types of hours
    const hoursBreakdown = this.calculateHoursBreakdown(timeSegments, totalMinutes);
    
    // Calculate pay for each component
    const payBreakdown = this.calculatePayBreakdown(hoursBreakdown);
    
    // Apply casual loading
    const casualLoading = payBreakdown.regularPay
      .plus(payBreakdown.overtimePay)
      .plus(payBreakdown.penaltyPay)
      .mul(this.payGuide.casualLoading);
    
    const grossPay = payBreakdown.regularPay
      .plus(payBreakdown.overtimePay)
      .plus(payBreakdown.penaltyPay)
      .plus(casualLoading);

    return {
      totalMinutes,
      regularHours: hoursBreakdown.regular,
      overtimeHours: hoursBreakdown.overtime1_5x.plus(hoursBreakdown.overtime2x),
      penaltyHours: hoursBreakdown.penalty,
      regularPay: payBreakdown.regularPay,
      overtimePay: payBreakdown.overtimePay,
      penaltyPay: payBreakdown.penaltyPay,
      casualLoading,
      grossPay,
      breakdown: this.createDetailedBreakdown(hoursBreakdown, payBreakdown, casualLoading)
    };
  }

  private calculateWorkingMinutes(startTime: Date, endTime: Date, breakMinutes: number): number {
    const totalMilliseconds = endTime.getTime() - startTime.getTime();
    const totalMinutes = Math.floor(totalMilliseconds / (1000 * 60));
    return Math.max(0, totalMinutes - breakMinutes);
  }

  private analyzeTimeSegments(startTime: Date, endTime: Date, breakMinutes: number): TimeSegment[] {
    const segments: TimeSegment[] = [];
    const workingEndTime = new Date(endTime.getTime() - (breakMinutes * 60 * 1000));
    
    let currentTime = new Date(startTime);
    
    while (currentTime < workingEndTime) {
      const segmentStart = new Date(currentTime);
      const segmentEnd = this.getNextSegmentBoundary(currentTime, workingEndTime);
      
      if (segmentStart >= segmentEnd) break;
      
      const segmentType = this.getTimeSegmentType(segmentStart, segmentEnd);
      const durationMinutes = Math.floor((segmentEnd.getTime() - segmentStart.getTime()) / (1000 * 60));
      
      if (durationMinutes > 0) {
        segments.push({
          startTime: segmentStart,
          endTime: segmentEnd,
          type: segmentType,
          durationMinutes
        });
      }
      
      currentTime = segmentEnd;
    }
    
    return segments;
  }

  private getNextSegmentBoundary(currentTime: Date, endTime: Date): Date {
    const boundaries = [
      this.getTimeOnDate(currentTime, this.payGuide.eveningStart),
      this.getTimeOnDate(currentTime, this.payGuide.eveningEnd),
      this.getTimeOnDate(currentTime, this.payGuide.nightStart),
      this.getTimeOnDate(currentTime, this.payGuide.nightEnd),
      // Handle midnight boundary
      new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate() + 1, 0, 0, 0),
      endTime
    ];

    return boundaries
      .filter(boundary => boundary > currentTime)
      .sort((a, b) => a.getTime() - b.getTime())[0] || endTime;
  }

  private getTimeSegmentType(startTime: Date, endTime: Date): TimeSegment['type'] {
    const avgTime = new Date((startTime.getTime() + endTime.getTime()) / 2);
    
    // Check if it's a public holiday
    if (this.isPublicHoliday(avgTime)) {
      return 'public_holiday';
    }
    
    // Check if it's weekend
    const dayOfWeek = avgTime.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday or Saturday
      return 'weekend';
    }
    
    // Check time-based penalties
    const timeStr = this.formatTime(avgTime);
    const eveningStart = this.payGuide.eveningStart;
    const eveningEnd = this.payGuide.eveningEnd;
    const nightStart = this.payGuide.nightStart;
    const nightEnd = this.payGuide.nightEnd;
    
    if (this.isTimeBetween(timeStr, nightStart, nightEnd)) {
      return 'night';
    }
    
    if (this.isTimeBetween(timeStr, eveningStart, eveningEnd)) {
      return 'evening';
    }
    
    return 'regular';
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
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes, 0);
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

  private calculateHoursBreakdown(timeSegments: TimeSegment[], totalMinutes: number) {
    let regularMinutes = 0;
    let eveningMinutes = 0;
    let nightMinutes = 0;
    let weekendMinutes = 0;
    let publicHolidayMinutes = 0;

    timeSegments.forEach(segment => {
      switch (segment.type) {
        case 'regular':
          regularMinutes += segment.durationMinutes;
          break;
        case 'evening':
          eveningMinutes += segment.durationMinutes;
          break;
        case 'night':
          nightMinutes += segment.durationMinutes;
          break;
        case 'weekend':
          weekendMinutes += segment.durationMinutes;
          break;
        case 'public_holiday':
          publicHolidayMinutes += segment.durationMinutes;
          break;
      }
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

    return {
      regular: regularHours,
      overtime1_5x: overtime1_5xHours,
      overtime2x: overtime2xHours,
      evening: new Decimal(eveningMinutes).div(60),
      night: new Decimal(nightMinutes).div(60),
      weekend: new Decimal(weekendMinutes).div(60),
      publicHoliday: new Decimal(publicHolidayMinutes).div(60),
      penalty: new Decimal(eveningMinutes + nightMinutes + weekendMinutes + publicHolidayMinutes).div(60)
    };
  }

  private calculatePayBreakdown(hoursBreakdown: any) {
    const baseRate = this.payGuide.baseHourlyRate;
    
    const regularPay = new Decimal(hoursBreakdown.regular).mul(baseRate);
    
    const overtime1_5xPay = new Decimal(hoursBreakdown.overtime1_5x)
      .mul(baseRate)
      .mul(this.payGuide.overtimeRate1_5x);
      
    const overtime2xPay = new Decimal(hoursBreakdown.overtime2x)
      .mul(baseRate)
      .mul(this.payGuide.overtimeRate2x);
    
    const eveningPay = new Decimal(hoursBreakdown.evening)
      .mul(baseRate)
      .mul(this.payGuide.eveningPenalty);
      
    const nightPay = new Decimal(hoursBreakdown.night)
      .mul(baseRate)
      .mul(this.payGuide.nightPenalty);
      
    const weekendPay = new Decimal(hoursBreakdown.weekend)
      .mul(baseRate)
      .mul(hoursBreakdown.weekend > 0 ? 
        (new Date().getDay() === 0 ? this.payGuide.sundayPenalty : this.payGuide.saturdayPenalty) : 
        new Decimal(1));
        
    const publicHolidayPay = new Decimal(hoursBreakdown.publicHoliday)
      .mul(baseRate)
      .mul(this.payGuide.publicHolidayPenalty);

    return {
      regularPay,
      overtimePay: overtime1_5xPay.plus(overtime2xPay),
      penaltyPay: eveningPay.plus(nightPay).plus(weekendPay).plus(publicHolidayPay),
      breakdown: {
        regular: { hours: hoursBreakdown.regular, pay: regularPay },
        overtime1_5x: { hours: hoursBreakdown.overtime1_5x, pay: overtime1_5xPay },
        overtime2x: { hours: hoursBreakdown.overtime2x, pay: overtime2xPay },
        evening: { hours: hoursBreakdown.evening, pay: eveningPay },
        night: { hours: hoursBreakdown.night, pay: nightPay },
        weekend: { hours: hoursBreakdown.weekend, pay: weekendPay },
        publicHoliday: { hours: hoursBreakdown.publicHoliday, pay: publicHolidayPay }
      }
    };
  }

  private createDetailedBreakdown(hoursBreakdown: any, payBreakdown: any, casualLoading: Decimal): PayBreakdown {
    const baseRate = this.payGuide.baseHourlyRate;
    
    return {
      baseRate,
      regularHours: {
        hours: hoursBreakdown.regular,
        rate: baseRate,
        amount: payBreakdown.breakdown.regular.pay
      },
      overtime1_5x: {
        hours: hoursBreakdown.overtime1_5x,
        rate: baseRate.mul(this.payGuide.overtimeRate1_5x),
        amount: payBreakdown.breakdown.overtime1_5x.pay
      },
      overtime2x: {
        hours: hoursBreakdown.overtime2x,
        rate: baseRate.mul(this.payGuide.overtimeRate2x),
        amount: payBreakdown.breakdown.overtime2x.pay
      },
      eveningPenalty: {
        hours: hoursBreakdown.evening,
        rate: baseRate.mul(this.payGuide.eveningPenalty),
        amount: payBreakdown.breakdown.evening.pay
      },
      nightPenalty: {
        hours: hoursBreakdown.night,
        rate: baseRate.mul(this.payGuide.nightPenalty),
        amount: payBreakdown.breakdown.night.pay
      },
      weekendPenalty: {
        hours: hoursBreakdown.weekend,
        rate: baseRate.mul(new Date().getDay() === 0 ? this.payGuide.sundayPenalty : this.payGuide.saturdayPenalty),
        amount: payBreakdown.breakdown.weekend.pay
      },
      publicHolidayPenalty: {
        hours: hoursBreakdown.publicHoliday,
        rate: baseRate.mul(this.payGuide.publicHolidayPenalty),
        amount: payBreakdown.breakdown.publicHoliday.pay
      },
      casualLoading: {
        rate: this.payGuide.casualLoading,
        amount: casualLoading
      }
    };
  }
}