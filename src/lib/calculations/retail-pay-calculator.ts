import Decimal from 'decimal.js';
import { PayGuide, PublicHoliday } from '@prisma/client';

export interface RetailPayComponent {
  type: 'ordinary' | 'penalty' | 'overtime';
  when: string;
  hours: Decimal;
  multiplier: Decimal;
  rate_used: Decimal;
  amount: Decimal;
  refs: string[];
}

export interface RetailShiftCalculation {
  id: string;
  employee_type: 'casual';
  classification: string;
  day: string;
  start: string;
  end: string;
  hours_total: Decimal;
  explanation: string;
  components: RetailPayComponent[];
  total_pay: Decimal;
  assumption?: string;
}

/**
 * Australian Retail Award Pay Calculator
 * Implements the exact logic from General Retail Industry Award 2020
 * as demonstrated in the example.json test cases
 */
export class RetailPayCalculator {
  constructor(
    private payGuide: PayGuide,
    private publicHolidays: PublicHoliday[] = []
  ) {}

  calculateShift(
    startTime: Date,
    endTime: Date,
    breakMinutes: number = 0
  ): RetailShiftCalculation {
    const totalMinutes = this.calculateWorkingMinutes(startTime, endTime, breakMinutes);
    const totalHours = new Decimal(totalMinutes).div(60);
    
    const dayOfWeek = startTime.getDay();
    const dayName = this.getDayName(dayOfWeek);
    
    // Create components based on retail award rules
    const components: RetailPayComponent[] = [];
    
    if (this.isPublicHoliday(startTime)) {
      // Public holiday: all hours at 250%
      components.push({
        type: 'penalty',
        when: 'Public holiday ordinary',
        hours: totalHours,
        multiplier: this.payGuide.publicHolidayPenalty,
        rate_used: this.payGuide.baseHourlyRate,
        amount: totalHours.mul(this.payGuide.baseHourlyRate).mul(this.payGuide.publicHolidayPenalty).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
        refs: ['Table 12']
      });
    } else if (dayOfWeek === 0) {
      // Sunday logic
      this.calculateSundayComponents(startTime, endTime, totalHours, components);
    } else if (dayOfWeek === 6) {
      // Saturday logic  
      this.calculateSaturdayComponents(startTime, endTime, totalHours, components);
    } else {
      // Weekday logic (Monday-Friday)
      this.calculateWeekdayComponents(startTime, endTime, totalHours, components, dayOfWeek);
    }
    
    const totalPay = components.reduce((sum, comp) => sum.plus(comp.amount), new Decimal(0));
    
    return {
      id: `shift-${startTime.getTime()}`,
      employee_type: 'casual',
      classification: this.payGuide.name.includes('Level 2') ? 'Retail Employee Level 2' : 'Retail Employee Level 1',
      day: dayName,
      start: this.formatTime(startTime),
      end: this.formatTime(endTime),
      hours_total: totalHours,
      explanation: this.generateExplanation(components, startTime, endTime),
      components,
      total_pay: totalPay
    };
  }

  private calculateWeekdayComponents(
    startTime: Date,
    endTime: Date,
    totalHours: Decimal,
    components: RetailPayComponent[],
    dayOfWeek: number
  ): void {
    const spanStart = this.getSpanStart(dayOfWeek);
    const spanEnd = this.getSpanEnd(dayOfWeek);
    
    // Break down the shift into time segments
    const segments = this.analyzeWeekdaySegments(startTime, endTime, spanStart, spanEnd);
    
    let totalRegularHours = new Decimal(0);
    let totalOvertimeHours = new Decimal(0);
    
    for (const segment of segments) {
      if (segment.type === 'ordinary') {
        totalRegularHours = totalRegularHours.plus(segment.hours);
        components.push({
          type: 'ordinary',
          when: 'Mon–Fri before 6pm',
          hours: segment.hours,
          multiplier: new Decimal(1.25), // Casual loading multiplier for display
          rate_used: this.payGuide.baseHourlyRate,
          amount: segment.hours.mul(this.payGuide.baseHourlyRate).mul(new Decimal(1.25)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
          refs: ['cl 11.1', 'Table 2']
        });
      } else if (segment.type === 'evening') {
        components.push({
          type: 'penalty',
          when: 'Mon–Fri after 6pm',
          hours: segment.hours,
          multiplier: this.payGuide.eveningPenalty,
          rate_used: this.payGuide.baseHourlyRate,
          amount: segment.hours.mul(this.payGuide.baseHourlyRate).mul(this.payGuide.eveningPenalty).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
          refs: ['Table 12']
        });
      } else if (segment.type === 'overtime') {
        totalOvertimeHours = totalOvertimeHours.plus(segment.hours);
        const isFirstTier = totalOvertimeHours.lte(3);
        const rate = isFirstTier ? this.payGuide.overtimeRate1_5x : this.payGuide.overtimeRate2x;
        const when = isFirstTier ? 'Mon–Sat first 3 hours' : 'Mon–Sat after 3 hours';
        
        components.push({
          type: 'overtime',
          when,
          hours: segment.hours,
          multiplier: rate,
          rate_used: this.payGuide.baseHourlyRate,
          amount: segment.hours.mul(this.payGuide.baseHourlyRate).mul(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
          refs: ['Table 10', 'Table 11']
        });
      }
    }
  }

  private calculateSaturdayComponents(
    startTime: Date,
    endTime: Date,
    totalHours: Decimal,
    components: RetailPayComponent[]
  ): void {
    const spanEnd = this.getSpanEnd(6); // Saturday span ends at 18:00
    
    if (endTime.getHours() <= 18) {
      // All within Saturday span
      components.push({
        type: 'penalty',
        when: 'Saturday ordinary',
        hours: totalHours,
        multiplier: this.payGuide.saturdayPenalty,
        rate_used: this.payGuide.baseHourlyRate,
        amount: totalHours.mul(this.payGuide.baseHourlyRate).mul(this.payGuide.saturdayPenalty).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
        refs: ['Table 12']
      });
    } else {
      // Some hours are overtime (after 18:00)
      const ordinaryEnd = new Date(startTime);
      ordinaryEnd.setHours(18, 0, 0, 0);
      
      const ordinaryMinutes = Math.max(0, ordinaryEnd.getTime() - startTime.getTime()) / (1000 * 60);
      const overtimeMinutes = Math.max(0, endTime.getTime() - ordinaryEnd.getTime()) / (1000 * 60);
      
      const ordinaryHours = new Decimal(ordinaryMinutes).div(60);
      const overtimeHours = new Decimal(overtimeMinutes).div(60);
      
      if (ordinaryHours.gt(0)) {
        components.push({
          type: 'penalty',
          when: 'Saturday ordinary',
          hours: ordinaryHours,
          multiplier: this.payGuide.saturdayPenalty,
          rate_used: this.payGuide.baseHourlyRate,
          amount: ordinaryHours.mul(this.payGuide.baseHourlyRate).mul(this.payGuide.saturdayPenalty).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
          refs: ['Table 12']
        });
      }
      
      if (overtimeHours.gt(0)) {
        components.push({
          type: 'overtime',
          when: 'Mon–Sat first 3 hours',
          hours: overtimeHours,
          multiplier: this.payGuide.overtimeRate1_5x,
          rate_used: this.payGuide.baseHourlyRate,
          amount: overtimeHours.mul(this.payGuide.baseHourlyRate).mul(this.payGuide.overtimeRate1_5x).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
          refs: ['Table 10', 'Table 11']
        });
      }
    }
  }

  private calculateSundayComponents(
    startTime: Date,
    endTime: Date,
    totalHours: Decimal,
    components: RetailPayComponent[]
  ): void {
    const spanEnd = this.getSpanEnd(0); // Sunday span ends at 18:00
    
    if (endTime.getHours() <= 18) {
      // All within Sunday span
      components.push({
        type: 'penalty',
        when: 'Sunday ordinary',
        hours: totalHours,
        multiplier: this.payGuide.sundayPenalty,
        rate_used: this.payGuide.baseHourlyRate,
        amount: totalHours.mul(this.payGuide.baseHourlyRate).mul(this.payGuide.sundayPenalty).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
        refs: ['Table 12']
      });
    } else {
      // Some hours are overtime (after 18:00)
      const ordinaryEnd = new Date(startTime);
      ordinaryEnd.setHours(18, 0, 0, 0);
      
      const ordinaryMinutes = Math.max(0, ordinaryEnd.getTime() - startTime.getTime()) / (1000 * 60);
      const overtimeMinutes = Math.max(0, endTime.getTime() - ordinaryEnd.getTime()) / (1000 * 60);
      
      const ordinaryHours = new Decimal(ordinaryMinutes).div(60);
      const overtimeHours = new Decimal(overtimeMinutes).div(60);
      
      if (ordinaryHours.gt(0)) {
        components.push({
          type: 'penalty',
          when: 'Sunday ordinary',
          hours: ordinaryHours,
          multiplier: this.payGuide.sundayPenalty,
          rate_used: this.payGuide.baseHourlyRate,
          amount: ordinaryHours.mul(this.payGuide.baseHourlyRate).mul(this.payGuide.sundayPenalty).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
          refs: ['Table 12', 'Table 2']
        });
      }
      
      if (overtimeHours.gt(0)) {
        components.push({
          type: 'overtime',
          when: 'Sunday OT',
          hours: overtimeHours,
          multiplier: this.payGuide.overtimeRate2x, // Sunday OT is at higher rate
          rate_used: this.payGuide.baseHourlyRate,
          amount: overtimeHours.mul(this.payGuide.baseHourlyRate).mul(this.payGuide.overtimeRate2x).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
          refs: ['Table 10', 'Table 11']
        });
      }
    }
  }

  private analyzeWeekdaySegments(
    startTime: Date,
    endTime: Date,
    spanStart: string,
    spanEnd: string
  ): Array<{ type: 'ordinary' | 'evening' | 'overtime'; hours: Decimal }> {
    const segments: Array<{ type: 'ordinary' | 'evening' | 'overtime'; hours: Decimal }> = [];
    
    const startMinutes = startTime.getHours() * 60 + startTime.getMinutes();
    const endMinutes = endTime.getHours() * 60 + endTime.getMinutes();
    const spanEndMinutes = this.timeStringToMinutes(spanEnd); // 21:00 = 1260 minutes
    const eveningStart = 18 * 60; // 18:00 = 1080 minutes
    
    // Segment 1: Before 18:00 (ordinary time)
    if (startMinutes < eveningStart) {
      const ordinaryEnd = Math.min(endMinutes, eveningStart);
      const ordinaryMinutes = ordinaryEnd - startMinutes;
      if (ordinaryMinutes > 0) {
        segments.push({
          type: 'ordinary',
          hours: new Decimal(ordinaryMinutes).div(60)
        });
      }
    }
    
    // Segment 2: 18:00-21:00 (evening penalty within span)
    if (endMinutes > eveningStart && startMinutes < spanEndMinutes) {
      const eveningStartActual = Math.max(startMinutes, eveningStart);
      const eveningEnd = Math.min(endMinutes, spanEndMinutes);
      const eveningMinutes = eveningEnd - eveningStartActual;
      if (eveningMinutes > 0) {
        segments.push({
          type: 'evening',
          hours: new Decimal(eveningMinutes).div(60)
        });
      }
    }
    
    // Segment 3: After 21:00 (overtime - outside span)
    if (endMinutes > spanEndMinutes) {
      const overtimeStart = Math.max(startMinutes, spanEndMinutes);
      const overtimeMinutes = endMinutes - overtimeStart;
      if (overtimeMinutes > 0) {
        segments.push({
          type: 'overtime',
          hours: new Decimal(overtimeMinutes).div(60)
        });
      }
    }
    
    return segments;
  }

  // Helper methods
  private calculateWorkingMinutes(startTime: Date, endTime: Date, breakMinutes: number): number {
    const totalMilliseconds = endTime.getTime() - startTime.getTime();
    const totalMinutes = Math.floor(totalMilliseconds / (1000 * 60));
    return Math.max(0, totalMinutes - breakMinutes);
  }

  private isPublicHoliday(date: Date): boolean {
    const dateStr = date.getFullYear() + '-' + 
                    String(date.getMonth() + 1).padStart(2, '0') + '-' + 
                    String(date.getDate()).padStart(2, '0');
    
    return this.publicHolidays.some(holiday => {
      const holidayStr = holiday.date.toISOString().split('T')[0];
      return holidayStr === dateStr;
    });
  }

  private getSpanStart(dayOfWeek: number): string {
    switch (dayOfWeek) {
      case 0: return this.payGuide.sundayStart || '09:00';
      case 1: return this.payGuide.mondayStart || '07:00';
      case 2: return this.payGuide.tuesdayStart || '07:00';
      case 3: return this.payGuide.wednesdayStart || '07:00';
      case 4: return this.payGuide.thursdayStart || '07:00';
      case 5: return this.payGuide.fridayStart || '07:00';
      case 6: return this.payGuide.saturdayStart || '07:00';
      default: return '07:00';
    }
  }

  private getSpanEnd(dayOfWeek: number): string {
    switch (dayOfWeek) {
      case 0: return this.payGuide.sundayEnd || '18:00';
      case 1: return this.payGuide.mondayEnd || '21:00';
      case 2: return this.payGuide.tuesdayEnd || '21:00';
      case 3: return this.payGuide.wednesdayEnd || '21:00';
      case 4: return this.payGuide.thursdayEnd || '21:00';
      case 5: return this.payGuide.fridayEnd || '21:00';
      case 6: return this.payGuide.saturdayEnd || '18:00';
      default: return '21:00';
    }
  }

  private formatTime(date: Date): string {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }

  private timeStringToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private getDayName(dayOfWeek: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayOfWeek];
  }

  private generateExplanation(components: RetailPayComponent[], startTime: Date, endTime: Date): string {
    return components.map(comp => 
      `${comp.hours.toFixed(1)}h ${comp.when} at ${comp.multiplier.toFixed(2)}x = $${comp.amount.toFixed(2)}`
    ).join('. ') + '.';
  }
}