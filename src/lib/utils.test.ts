import { describe, it, expect } from 'vitest'

// Example utility functions for testing setup
export function formatAustralianCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
  }).format(amount)
}

export function calculateHoursFromMinutes(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100 // Round to 2 decimal places
}

export function isValidTime(timeString: string): boolean {
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
  return timeRegex.test(timeString)
}

describe('Utility Functions', () => {
  describe('formatAustralianCurrency', () => {
    it('should format currency with AUD symbol', () => {
      expect(formatAustralianCurrency(25.50)).toBe('$25.50')
      expect(formatAustralianCurrency(100)).toBe('$100.00')
      expect(formatAustralianCurrency(0)).toBe('$0.00')
    })

    it('should handle decimal places correctly', () => {
      expect(formatAustralianCurrency(25.555)).toBe('$25.56') // Rounds up
      expect(formatAustralianCurrency(25.554)).toBe('$25.55') // Rounds down
    })

    it('should handle large amounts', () => {
      expect(formatAustralianCurrency(1000000)).toBe('$1,000,000.00')
      expect(formatAustralianCurrency(12345.67)).toBe('$12,345.67')
    })
  })

  describe('calculateHoursFromMinutes', () => {
    it('should convert minutes to hours correctly', () => {
      expect(calculateHoursFromMinutes(60)).toBe(1)
      expect(calculateHoursFromMinutes(30)).toBe(0.5)
      expect(calculateHoursFromMinutes(90)).toBe(1.5)
      expect(calculateHoursFromMinutes(0)).toBe(0)
    })

    it('should round to 2 decimal places', () => {
      expect(calculateHoursFromMinutes(100)).toBe(1.67) // 1.666... rounded
      expect(calculateHoursFromMinutes(25)).toBe(0.42)  // 0.416... rounded
    })
  })

  describe('isValidTime', () => {
    it('should validate correct time formats', () => {
      expect(isValidTime('09:00')).toBe(true)
      expect(isValidTime('17:30')).toBe(true)
      expect(isValidTime('23:59')).toBe(true)
      expect(isValidTime('00:00')).toBe(true)
      expect(isValidTime('5:30')).toBe(true) // Single digit hour
    })

    it('should reject invalid time formats', () => {
      expect(isValidTime('25:00')).toBe(false) // Invalid hour
      expect(isValidTime('12:60')).toBe(false) // Invalid minute
      expect(isValidTime('abc')).toBe(false)   // Non-numeric
      expect(isValidTime('12:3')).toBe(false)  // Single digit minute
      expect(isValidTime('')).toBe(false)      // Empty string
    })
  })
})