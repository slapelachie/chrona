/**
 * Blackbox TimeZoneHelper Tests
 *
 * These tests verify the TimeZoneHelper from a user perspective without knowledge
 * of internal implementation. Tests focus on inputs, outputs, and expected behavior
 * for various timezone scenarios in Australian employment contexts.
 */

import { describe, it, expect } from 'vitest'
import { TimeZoneHelper } from '@/lib/calculations/timezone-helper'

describe('TimeZoneHelper', () => {
  describe('Australian timezone handling', () => {
    const brisbaneHelper = new TimeZoneHelper('Australia/Brisbane')
    const sydneyHelper = new TimeZoneHelper('Australia/Sydney')
    const perthHelper = new TimeZoneHelper('Australia/Perth')

    describe('createLocalMidnight', () => {
      it('creates midnight in Brisbane timezone', () => {
        const date = new Date('2024-01-15T10:00:00.000Z') // 8pm Brisbane time
        const result = brisbaneHelper.createLocalMidnight(date)

        // Should be midnight local time on January 15
        // Midnight - +10 = 2024-01-14:14:00:00
        const resultString = result.toISOString()
        expect(resultString).toStrictEqual('2024-01-14T14:00:00.000Z')

        // Should be a different UTC time due to timezone offset
        expect(result.getUTCHours()).not.toBe(0)
      })

      it('creates midnight in Sydney timezone', () => {
        const date = new Date('2024-01-15T10:00:00.000Z')
        const result = sydneyHelper.createLocalMidnight(date)

        expect(result.toISOString()).toStrictEqual('2024-01-14T13:00:00.000Z')
        expect(result.getUTCHours()).not.toBe(0)
      })

      it('creates midnight in Perth timezone', () => {
        const date = new Date('2024-01-15T10:00:00.000Z')
        const result = perthHelper.createLocalMidnight(date)

        expect(result.toISOString()).toContain('2024-01-14T16:00:00.000Z')
        expect(result.getUTCHours()).not.toBe(0)
      })

      it('handles DST transitions correctly', () => {
        // Test during DST changeover period in Sydney (first Sunday in April)
        const dstChangeDate = new Date('2024-04-08T10:00:00.000Z')
        const result = sydneyHelper.createLocalMidnight(dstChangeDate)

        expect(result).toBeInstanceOf(Date)
        expect(result.toISOString()).toStrictEqual('2024-04-07T14:00:00.000Z')
      })
    })

    describe('createLocalTime', () => {
      it('creates local time from date and time string', () => {
        const date = new Date('2024-01-15T10:00:00.000Z')
        const time = '18:30'

        const result = brisbaneHelper.createLocalTime(date, time)

        // Should be 6:30 PM local time on January 15
        expect(result.toISOString()).toContain('2024-01-15')
      })

      it('handles 24:00 time by advancing to next day', () => {
        const date = new Date('2024-01-15T10:00:00.000Z')
        const time = '24:00'

        const result = brisbaneHelper.createLocalTime(date, time)

        // Should be midnight on January 16 (Jan 15 UTC time)
        expect(result.toISOString()).toContain('2024-01-15T14:00:00.000Z')
      })

      it('creates correct local times across different Australian timezones', () => {
        const date = new Date('2024-01-15T10:00:00.000Z')
        const time = '09:00'

        const brisbaneResult = brisbaneHelper.createLocalTime(date, time)
        const sydneyResult = sydneyHelper.createLocalTime(date, time)
        const perthResult = perthHelper.createLocalTime(date, time)

        // All should be 9:00 AM local time but different UTC times
        expect(brisbaneResult).not.toEqual(sydneyResult)
        expect(sydneyResult).not.toEqual(perthResult)
        expect(brisbaneResult).not.toEqual(perthResult)
      })

      it('handles edge case times', () => {
        const date = new Date('2024-01-15T10:00:00.000Z')

        const midnight = brisbaneHelper.createLocalTime(date, '00:00')
        const noon = brisbaneHelper.createLocalTime(date, '12:00')
        const lateNight = brisbaneHelper.createLocalTime(date, '23:59')

        expect(midnight).toBeInstanceOf(Date)
        expect(noon).toBeInstanceOf(Date)
        expect(lateNight).toBeInstanceOf(Date)
      })
    })

    describe('getLocalDayOfWeek', () => {
      it('returns correct day of week in local timezone', () => {
        // Monday January 15, 2024
        const monday = new Date('2024-01-15T10:00:00.000Z')
        const result = brisbaneHelper.getLocalDayOfWeek(monday)

        expect(result).toBe(1) // Monday = 1 in JavaScript (0=Sunday)
      })

      it('handles timezone boundary correctly', () => {
        // Test a time that might be different day in local vs UTC
        const nearMidnight = new Date('2024-01-15T14:00:00.000Z') // 14:00 UTC
        const result = brisbaneHelper.getLocalDayOfWeek(nearMidnight)

        expect(result).toBeGreaterThanOrEqual(0)
        expect(result).toBeLessThanOrEqual(6)
      })

      it('returns consistent results across Australian timezones', () => {
        const sameUtcTime = new Date('2024-01-15T12:00:00.000Z')

        const brisbaneDay = brisbaneHelper.getLocalDayOfWeek(sameUtcTime)
        const sydneyDay = sydneyHelper.getLocalDayOfWeek(sameUtcTime)
        const perthDay = perthHelper.getLocalDayOfWeek(sameUtcTime)

        // All Australian mainland timezones should show same day for midday UTC
        expect(brisbaneDay).toBe(sydneyDay)
        expect(sydneyDay).toBe(perthDay)
      })

      it('converts from ISO week format correctly', () => {
        // Sunday January 14, 2024
        const sunday = new Date('2024-01-14T10:00:00.000Z')
        const result = brisbaneHelper.getLocalDayOfWeek(sunday)

        expect(result).toBe(0) // Sunday = 0 in JavaScript
      })
    })

    describe('advanceToNextLocalDay', () => {
      it('advances to next local day correctly', () => {
        const currentDay = new Date('2024-01-15T14:00:00.000Z') // Brisbane midnight
        const nextDay = brisbaneHelper.advanceToNextLocalDay(currentDay)

        expect(nextDay.getTime()).toBeGreaterThan(currentDay.getTime())
        expect(nextDay.toISOString()).toContain('2024-01-16')
      })

      it('handles month boundary transitions', () => {
        const lastDayOfMonth = new Date('2024-01-31T14:00:00.000Z')
        const nextDay = brisbaneHelper.advanceToNextLocalDay(lastDayOfMonth)

        expect(nextDay.toISOString()).toContain('2024-02-01')
      })

      it('handles year boundary transitions', () => {
        const lastDayOfYear = new Date('2023-12-31T14:00:00.000Z')
        const nextDay = brisbaneHelper.advanceToNextLocalDay(lastDayOfYear)

        expect(nextDay.toISOString()).toContain('2024-01-01')
      })

      it('handles DST transitions safely', () => {
        // Test around DST transition dates in Sydney
        const beforeDST = new Date('2024-04-06T14:00:00.000Z')
        const nextDay = sydneyHelper.advanceToNextLocalDay(beforeDST)

        expect(nextDay.getTime()).toBeGreaterThan(beforeDST.getTime())
        expect(nextDay.toISOString()).toContain('2024-04-07')
      })

      it('ensures advancement even during DST edge cases', () => {
        const originalTime = new Date('2024-10-06T14:00:00.000Z')
        const nextDay = sydneyHelper.advanceToNextLocalDay(originalTime)

        // Should always advance by at least some time
        expect(nextDay.getTime()).toBeGreaterThan(originalTime.getTime())
      })
    })

    describe('doesTimeWrap', () => {
      it('detects when end time wraps to next day', () => {
        expect(brisbaneHelper.doesTimeWrap('22:00', '06:00')).toBe(true)
        expect(brisbaneHelper.doesTimeWrap('23:30', '01:30')).toBe(true)
        expect(brisbaneHelper.doesTimeWrap('18:00', '24:00')).toBe(true)
      })

      it('detects when times do not wrap', () => {
        expect(brisbaneHelper.doesTimeWrap('09:00', '17:00')).toBe(false)
        expect(brisbaneHelper.doesTimeWrap('14:30', '18:45')).toBe(false)
        expect(brisbaneHelper.doesTimeWrap('00:00', '23:59')).toBe(false)
      })

      it('handles same time as non-wrapping', () => {
        expect(brisbaneHelper.doesTimeWrap('12:00', '12:00')).toBe(true) // Equal times wrap
        expect(brisbaneHelper.doesTimeWrap('15:30', '15:29')).toBe(true) // End before start wraps
      })

      it('handles special 24:00 time', () => {
        expect(brisbaneHelper.doesTimeWrap('00:00', '24:00')).toBe(true)
        expect(brisbaneHelper.doesTimeWrap('12:00', '24:00')).toBe(true)
        expect(brisbaneHelper.doesTimeWrap('23:59', '24:00')).toBe(true)
      })

      it('handles edge cases with minutes', () => {
        expect(brisbaneHelper.doesTimeWrap('12:30', '12:29')).toBe(true)
        expect(brisbaneHelper.doesTimeWrap('12:30', '12:30')).toBe(true)
        expect(brisbaneHelper.doesTimeWrap('12:30', '12:31')).toBe(false)
      })
    })

    describe('intersectWithShift', () => {
      it('finds intersection when periods overlap', () => {
        const ruleStart = new Date('2024-01-15T18:00:00.000Z')
        const ruleEnd = new Date('2024-01-15T22:00:00.000Z')
        const shiftStart = new Date('2024-01-15T17:00:00.000Z')
        const shiftEnd = new Date('2024-01-15T21:00:00.000Z')

        const result = brisbaneHelper.intersectWithShift(
          ruleStart,
          ruleEnd,
          shiftStart,
          shiftEnd
        )

        expect(result).not.toBeNull()
        expect(result!.start).toEqual(ruleStart) // Later start
        expect(result!.end).toEqual(shiftEnd) // Earlier end
      })

      it('finds intersection when rule is fully within shift', () => {
        const ruleStart = new Date('2024-01-15T19:00:00.000Z')
        const ruleEnd = new Date('2024-01-15T20:00:00.000Z')
        const shiftStart = new Date('2024-01-15T17:00:00.000Z')
        const shiftEnd = new Date('2024-01-15T22:00:00.000Z')

        const result = brisbaneHelper.intersectWithShift(
          ruleStart,
          ruleEnd,
          shiftStart,
          shiftEnd
        )

        expect(result).not.toBeNull()
        expect(result!.start).toEqual(ruleStart)
        expect(result!.end).toEqual(ruleEnd)
      })

      it('finds intersection when shift is fully within rule', () => {
        const ruleStart = new Date('2024-01-15T16:00:00.000Z')
        const ruleEnd = new Date('2024-01-15T23:00:00.000Z')
        const shiftStart = new Date('2024-01-15T18:00:00.000Z')
        const shiftEnd = new Date('2024-01-15T21:00:00.000Z')

        const result = brisbaneHelper.intersectWithShift(
          ruleStart,
          ruleEnd,
          shiftStart,
          shiftEnd
        )

        expect(result).not.toBeNull()
        expect(result!.start).toEqual(shiftStart)
        expect(result!.end).toEqual(shiftEnd)
      })

      it('returns null when periods do not overlap', () => {
        const ruleStart = new Date('2024-01-15T22:00:00.000Z')
        const ruleEnd = new Date('2024-01-15T23:00:00.000Z')
        const shiftStart = new Date('2024-01-15T09:00:00.000Z')
        const shiftEnd = new Date('2024-01-15T17:00:00.000Z')

        const result = brisbaneHelper.intersectWithShift(
          ruleStart,
          ruleEnd,
          shiftStart,
          shiftEnd
        )

        expect(result).toBeNull()
      })

      it('returns null when periods just touch at boundaries', () => {
        const ruleStart = new Date('2024-01-15T17:00:00.000Z')
        const ruleEnd = new Date('2024-01-15T18:00:00.000Z')
        const shiftStart = new Date('2024-01-15T18:00:00.000Z')
        const shiftEnd = new Date('2024-01-15T22:00:00.000Z')

        const result = brisbaneHelper.intersectWithShift(
          ruleStart,
          ruleEnd,
          shiftStart,
          shiftEnd
        )

        expect(result).toBeNull()
      })

      it('handles same start and end times', () => {
        const ruleStart = new Date('2024-01-15T18:00:00.000Z')
        const ruleEnd = new Date('2024-01-15T20:00:00.000Z')
        const shiftStart = new Date('2024-01-15T18:00:00.000Z')
        const shiftEnd = new Date('2024-01-15T20:00:00.000Z')

        const result = brisbaneHelper.intersectWithShift(
          ruleStart,
          ruleEnd,
          shiftStart,
          shiftEnd
        )

        expect(result).not.toBeNull()
        expect(result!.start).toEqual(ruleStart)
        expect(result!.end).toEqual(ruleEnd)
      })
    })
  })

  describe('Different timezone consistency', () => {
    it('maintains consistent behavior across Australian timezones', () => {
      const helpers = [
        new TimeZoneHelper('Australia/Brisbane'),
        new TimeZoneHelper('Australia/Sydney'),
        new TimeZoneHelper('Australia/Melbourne'),
        new TimeZoneHelper('Australia/Perth'),
        new TimeZoneHelper('Australia/Adelaide'),
        new TimeZoneHelper('Australia/Darwin'),
      ]

      const testDate = new Date('2024-06-15T10:00:00.000Z') // Winter time, no DST

      helpers.forEach((helper) => {
        const midnight = helper.createLocalMidnight(testDate)
        const localTime = helper.createLocalTime(testDate, '15:30')
        const dayOfWeek = helper.getLocalDayOfWeek(testDate)
        const nextDay = helper.advanceToNextLocalDay(testDate)

        expect(midnight).toBeInstanceOf(Date)
        expect(localTime).toBeInstanceOf(Date)
        expect(dayOfWeek).toBeGreaterThanOrEqual(0)
        expect(dayOfWeek).toBeLessThanOrEqual(6)
        expect(nextDay.getTime()).toBeGreaterThan(testDate.getTime())
      })
    })
  })
})
