import { Shift, ShiftType, ShiftStatus, PayGuide, PublicHoliday } from '@prisma/client';
import { DateUtils } from './date-utils';

export interface ShiftValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ShiftConflict {
  shift: Shift;
  conflictType: 'overlap' | 'adjacent' | 'duplicate';
  conflictingShift: Shift;
  overlapMinutes?: number;
}

export interface ShiftAnalysis {
  duration: {
    totalMinutes: number;
    workingMinutes: number;
    hours: number;
    workingHours: number;
  };
  penaltyPeriods: PenaltyPeriod[];
  shiftType: ShiftType;
  isOvertime: boolean;
  isPublicHoliday: boolean;
  dayOfWeek: number;
  weekendWork: boolean;
}

export interface PenaltyPeriod {
  type: 'evening' | 'night' | 'weekend' | 'public_holiday';
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  rate: number;
}

export interface ShiftTemplate {
  name: string;
  startTime: string; // HH:MM format
  endTime: string;   // HH:MM format
  breakMinutes: number;
  shiftType: ShiftType;
  daysOfWeek: number[]; // 0 = Sunday, 1 = Monday, etc.
}

export class ShiftUtils {
  private dateUtils: DateUtils;

  constructor(
    private payGuide: PayGuide,
    publicHolidays: PublicHoliday[] = []
  ) {
    this.dateUtils = new DateUtils(publicHolidays);
  }

  // Shift Analysis
  analyzeShift(shift: Shift): ShiftAnalysis {
    if (!shift.endTime) {
      throw new Error('Cannot analyze incomplete shift');
    }

    const duration = this.dateUtils.calculateDuration(
      shift.startTime,
      shift.endTime,
      shift.breakMinutes
    );

    const penaltyPeriods = this.identifyPenaltyPeriods(
      shift.startTime,
      shift.endTime,
      shift.breakMinutes
    );

    const shiftType = this.determineShiftType(shift);
    const isOvertime = this.isOvertimeShift(shift);
    const isPublicHoliday = this.dateUtils.isPublicHoliday(shift.startTime);
    const dayOfWeek = shift.startTime.getDay();
    const weekendWork = dayOfWeek === 0 || dayOfWeek === 6;

    return {
      duration,
      penaltyPeriods,
      shiftType,
      isOvertime,
      isPublicHoliday,
      dayOfWeek,
      weekendWork
    };
  }

  // Shift Validation
  validateShift(shift: Shift, existingShifts: Shift[] = []): ShiftValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (!shift.startTime) {
      errors.push('Start time is required');
    }

    if (!shift.endTime) {
      errors.push('End time is required');
    }

    if (shift.startTime && shift.endTime) {
      if (shift.endTime <= shift.startTime) {
        errors.push('End time must be after start time');
      }

      const duration = this.dateUtils.calculateDuration(shift.startTime, shift.endTime, shift.breakMinutes);
      
      // Duration checks
      if (duration.totalMinutes < 30) {
        warnings.push('Shift is very short (less than 30 minutes)');
      }

      if (duration.totalMinutes > 12 * 60) {
        warnings.push('Shift is very long (more than 12 hours)');
      }

      // Break validation
      if (shift.breakMinutes < 0) {
        errors.push('Break time cannot be negative');
      }

      if (shift.breakMinutes >= duration.totalMinutes) {
        errors.push('Break time cannot be longer than shift duration');
      }

      // Mandatory break warnings
      if (duration.workingMinutes > 5 * 60 && shift.breakMinutes < 30) {
        warnings.push('Shifts longer than 5 hours should have at least 30 minutes break');
      }

      if (duration.workingMinutes > 10 * 60 && shift.breakMinutes < 60) {
        warnings.push('Shifts longer than 10 hours should have at least 60 minutes break');
      }
    }

    // Check for conflicts with existing shifts
    const conflicts = this.findShiftConflicts(shift, existingShifts);
    if (conflicts.length > 0) {
      conflicts.forEach(conflict => {
        switch (conflict.conflictType) {
          case 'overlap':
            errors.push(`Shift overlaps with existing shift by ${conflict.overlapMinutes} minutes`);
            break;
          case 'adjacent':
            warnings.push('Shift is immediately adjacent to another shift');
            break;
          case 'duplicate':
            errors.push('Identical shift already exists');
            break;
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Shift Conflicts Detection
  findShiftConflicts(shift: Shift, existingShifts: Shift[]): ShiftConflict[] {
    const conflicts: ShiftConflict[] = [];

    if (!shift.startTime || !shift.endTime) {
      return conflicts;
    }

    for (const existingShift of existingShifts) {
      if (!existingShift.endTime || existingShift.id === shift.id) {
        continue;
      }

      // Check for overlap
      const overlap = this.calculateShiftOverlap(shift, existingShift);
      if (overlap > 0) {
        conflicts.push({
          shift,
          conflictType: 'overlap',
          conflictingShift: existingShift,
          overlapMinutes: overlap
        });
      }

      // Check for adjacency (within 15 minutes)
      const timeBetween = Math.abs(
        shift.startTime.getTime() - existingShift.endTime.getTime()
      ) / (1000 * 60);

      if (timeBetween <= 15 && timeBetween > 0) {
        conflicts.push({
          shift,
          conflictType: 'adjacent',
          conflictingShift: existingShift
        });
      }

      // Check for exact duplicate
      if (
        shift.startTime.getTime() === existingShift.startTime.getTime() &&
        shift.endTime.getTime() === existingShift.endTime.getTime() &&
        shift.breakMinutes === existingShift.breakMinutes
      ) {
        conflicts.push({
          shift,
          conflictType: 'duplicate',
          conflictingShift: existingShift
        });
      }
    }

    return conflicts;
  }

  // Shift Type Determination
  determineShiftType(shift: Shift): ShiftType {
    if (!shift.endTime) return ShiftType.REGULAR;

    const analysis = this.analyzeShiftPenalties(shift.startTime, shift.endTime);

    if (analysis.isPublicHoliday) {
      return ShiftType.PUBLIC_HOLIDAY;
    }

    if (analysis.isWeekend) {
      return ShiftType.WEEKEND;
    }

    const duration = this.dateUtils.calculateDuration(shift.startTime, shift.endTime, shift.breakMinutes);
    const dailyOvertimeThreshold = Number(this.payGuide.dailyOvertimeHours) * 60; // Convert to minutes

    if (duration.workingMinutes > dailyOvertimeThreshold + 2 * 60) { // More than threshold + 2 hours
      return ShiftType.DOUBLE_TIME;
    }

    if (duration.workingMinutes > dailyOvertimeThreshold) {
      return ShiftType.OVERTIME;
    }

    return ShiftType.REGULAR;
  }

  // Penalty Period Identification
  identifyPenaltyPeriods(
    startTime: Date,
    endTime: Date,
    breakMinutes: number = 0
  ): PenaltyPeriod[] {
    const periods: PenaltyPeriod[] = [];
    const workingEndTime = new Date(endTime.getTime() - (breakMinutes * 60 * 1000));
    
    // Public Holiday Check
    if (this.dateUtils.isPublicHoliday(startTime)) {
      periods.push({
        type: 'public_holiday',
        startTime: new Date(startTime),
        endTime: new Date(workingEndTime),
        durationMinutes: (workingEndTime.getTime() - startTime.getTime()) / (1000 * 60),
        rate: Number(this.payGuide.publicHolidayPenalty)
      });
      return periods; // Public holiday overrides other penalties
    }

    // Weekend Check
    const dayOfWeek = startTime.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      const rate = dayOfWeek === 0 ? 
        Number(this.payGuide.sundayPenalty) : 
        Number(this.payGuide.saturdayPenalty);
      
      periods.push({
        type: 'weekend',
        startTime: new Date(startTime),
        endTime: new Date(workingEndTime),
        durationMinutes: (workingEndTime.getTime() - startTime.getTime()) / (1000 * 60),
        rate
      });
      return periods; // Weekend overrides time-based penalties
    }

    // Time-based penalties (evening/night)
    const timeBasedPeriods = this.calculateTimeBasedPenalties(startTime, workingEndTime);
    periods.push(...timeBasedPeriods);

    return periods;
  }

  // Shift Templates
  createShiftFromTemplate(template: ShiftTemplate, date: Date): Omit<Shift, 'id' | 'createdAt' | 'updatedAt'> {
    const startTime = this.parseTimeOnDate(template.startTime, date);
    const endTime = this.parseTimeOnDate(template.endTime, date);
    
    // Handle overnight shifts
    if (endTime <= startTime) {
      endTime.setDate(endTime.getDate() + 1);
    }

    return {
      userId: '', // To be set by caller
      payGuideId: this.payGuide.id,
      startTime,
      endTime,
      breakMinutes: template.breakMinutes,
      shiftType: template.shiftType,
      status: ShiftStatus.SCHEDULED,
      notes: `Created from template: ${template.name}`,
      // Calculated fields will be updated when saved
      totalMinutes: null,
      regularHours: null,
      overtimeHours: null,
      penaltyHours: null,
      grossPay: null,
      superannuation: null
    };
  }

  getCommonShiftTemplates(): ShiftTemplate[] {
    return [
      {
        name: 'Morning Shift',
        startTime: '06:00',
        endTime: '14:30',
        breakMinutes: 30,
        shiftType: ShiftType.REGULAR,
        daysOfWeek: [1, 2, 3, 4, 5] // Monday to Friday
      },
      {
        name: 'Afternoon Shift',
        startTime: '14:00',
        endTime: '22:30',
        breakMinutes: 30,
        shiftType: ShiftType.REGULAR,
        daysOfWeek: [1, 2, 3, 4, 5]
      },
      {
        name: 'Night Shift',
        startTime: '22:00',
        endTime: '06:30',
        breakMinutes: 45,
        shiftType: ShiftType.REGULAR,
        daysOfWeek: [1, 2, 3, 4, 5]
      },
      {
        name: 'Weekend Day',
        startTime: '09:00',
        endTime: '17:30',
        breakMinutes: 30,
        shiftType: ShiftType.WEEKEND,
        daysOfWeek: [0, 6] // Saturday and Sunday
      },
      {
        name: 'Short Shift',
        startTime: '16:00',
        endTime: '20:00',
        breakMinutes: 0,
        shiftType: ShiftType.REGULAR,
        daysOfWeek: [1, 2, 3, 4, 5, 6, 0]
      }
    ];
  }

  // Helper Methods
  private calculateShiftOverlap(shift1: Shift, shift2: Shift): number {
    if (!shift1.endTime || !shift2.endTime) return 0;

    const start1 = shift1.startTime.getTime();
    const end1 = shift1.endTime.getTime();
    const start2 = shift2.startTime.getTime();
    const end2 = shift2.endTime.getTime();

    const overlapStart = Math.max(start1, start2);
    const overlapEnd = Math.min(end1, end2);

    return overlapEnd > overlapStart ? (overlapEnd - overlapStart) / (1000 * 60) : 0;
  }

  private isOvertimeShift(shift: Shift): boolean {
    if (!shift.endTime) return false;
    
    const duration = this.dateUtils.calculateDuration(shift.startTime, shift.endTime, shift.breakMinutes);
    const overtimeThreshold = Number(this.payGuide.dailyOvertimeHours) * 60;
    
    return duration.workingMinutes > overtimeThreshold;
  }

  private analyzeShiftPenalties(startTime: Date, endTime: Date) {
    return {
      isPublicHoliday: this.dateUtils.isPublicHoliday(startTime),
      isWeekend: startTime.getDay() === 0 || startTime.getDay() === 6,
      hasEveningPenalty: this.hasTimePenalty(startTime, endTime, 'evening'),
      hasNightPenalty: this.hasTimePenalty(startTime, endTime, 'night')
    };
  }

  private hasTimePenalty(startTime: Date, endTime: Date, penaltyType: 'evening' | 'night'): boolean {
    const penaltyStart = penaltyType === 'evening' ? this.payGuide.eveningStart : this.payGuide.nightStart;
    const penaltyEnd = penaltyType === 'evening' ? this.payGuide.eveningEnd : this.payGuide.nightEnd;

    return this.dateUtils.isTimeBetween(startTime, penaltyStart, penaltyEnd) ||
           this.dateUtils.isTimeBetween(endTime, penaltyStart, penaltyEnd);
  }

  private calculateTimeBasedPenalties(startTime: Date, endTime: Date): PenaltyPeriod[] {
    const periods: PenaltyPeriod[] = [];
    
    // Evening penalty
    const eveningOverlap = this.calculatePenaltyOverlap(
      startTime, 
      endTime, 
      this.payGuide.eveningStart, 
      this.payGuide.eveningEnd
    );
    
    if (eveningOverlap.minutes > 0) {
      periods.push({
        type: 'evening',
        startTime: eveningOverlap.start,
        endTime: eveningOverlap.end,
        durationMinutes: eveningOverlap.minutes,
        rate: Number(this.payGuide.eveningPenalty)
      });
    }

    // Night penalty
    const nightOverlap = this.calculatePenaltyOverlap(
      startTime,
      endTime,
      this.payGuide.nightStart,
      this.payGuide.nightEnd
    );

    if (nightOverlap.minutes > 0) {
      periods.push({
        type: 'night',
        startTime: nightOverlap.start,
        endTime: nightOverlap.end,
        durationMinutes: nightOverlap.minutes,
        rate: Number(this.payGuide.nightPenalty)
      });
    }

    return periods;
  }

  private calculatePenaltyOverlap(
    shiftStart: Date,
    shiftEnd: Date,
    penaltyStartTime: string,
    penaltyEndTime: string
  ): { start: Date; end: Date; minutes: number } {
    const penaltyStart = this.parseTimeOnDate(penaltyStartTime, shiftStart);
    const penaltyEnd = this.parseTimeOnDate(penaltyEndTime, shiftStart);
    
    // Handle overnight penalty periods
    if (penaltyEnd <= penaltyStart) {
      penaltyEnd.setDate(penaltyEnd.getDate() + 1);
    }

    const overlapStart = new Date(Math.max(shiftStart.getTime(), penaltyStart.getTime()));
    const overlapEnd = new Date(Math.min(shiftEnd.getTime(), penaltyEnd.getTime()));

    const minutes = overlapEnd > overlapStart ? 
      (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60) : 0;

    return {
      start: overlapStart,
      end: overlapEnd,
      minutes
    };
  }

  private parseTimeOnDate(timeStr: string, date: Date): Date {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const result = new Date(date);
    result.setHours(hours, minutes, 0, 0);
    return result;
  }
}