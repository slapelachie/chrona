import { Decimal } from 'decimal.js'
import { differenceInMinutes } from 'date-fns'
import { PayGuide, BreakPeriod } from '@/types'

export class ValidationHelpers {
  static validatePositiveValue(
    value: number | null | undefined,
    fieldName: string
  ): void {
    if (value != null && value < 0) {
      throw new Error(`${fieldName} cannot be negative`)
    }
  }

  static validatePositiveDecimal(
    value: Decimal,
    fieldName: string
  ): void {
    if (value.lessThanOrEqualTo(0)) {
      throw new Error(`${fieldName} must be greater than zero`)
    }
  }

  static validateRange(
    min: number | null | undefined,
    max: number | null | undefined,
    minFieldName: string,
    maxFieldName: string
  ): void {
    if (
      min != null &&
      max != null &&
      min > max
    ) {
      throw new Error(`${minFieldName} cannot exceed ${maxFieldName}`)
    }
  }

  static validatePayGuide(payGuide: PayGuide): void {
    this.validatePositiveDecimal(payGuide.baseRate, 'Base rate')
    this.validatePositiveValue(payGuide.minimumShiftHours, 'Minimum shift hours')
    this.validatePositiveValue(payGuide.maximumShiftHours, 'Maximum shift hours')
    this.validateRange(
      payGuide.minimumShiftHours,
      payGuide.maximumShiftHours,
      'Minimum shift hours',
      'maximum shift hours'
    )
  }

  static validateShiftTimes(
    startTime: Date,
    endTime: Date,
    breakPeriods: BreakPeriod[]
  ): void {
    if (endTime.getTime() === startTime.getTime()) {
      throw new Error('Shift must be at least 1 minute long')
    }
    if (endTime < startTime) {
      throw new Error('End time must be after start time')
    }

    const totalMinutes = differenceInMinutes(endTime, startTime)
    let totalBreakMinutes = 0

    for (const breakPeriod of breakPeriods) {
      if (breakPeriod.endTime <= breakPeriod.startTime) {
        throw new Error('Break end time must be after break start time')
      }

      if (breakPeriod.startTime < startTime || breakPeriod.endTime > endTime) {
        throw new Error('Break periods must be within shift duration')
      }

      totalBreakMinutes += differenceInMinutes(
        breakPeriod.endTime,
        breakPeriod.startTime
      )
    }

    if (totalBreakMinutes >= totalMinutes) {
      throw new Error('Total break time cannot exceed shift duration')
    }
  }
}
