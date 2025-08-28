/**
 * Utility functions for the Chrona application
 */

/**
 * Combines class names with conditional logic
 * @param classes - Array of class names or conditional objects
 * @returns Combined class string
 */
export function classNames(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

/**
 * Format currency for Australian dollars
 * @param amount - Amount in dollars
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(amount)
}

/**
 * Format hours with one decimal place
 * @param hours - Hours as number
 * @returns Formatted hours string
 */
export function formatHours(hours: number): string {
  return `${hours.toFixed(1)}h`
}

/**
 * Format date for Australian locale
 * @param date - Date to format
 * @returns Formatted date string
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

/**
 * Format time for Australian locale
 * @param date - Date to format
 * @returns Formatted time string
 */
export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}