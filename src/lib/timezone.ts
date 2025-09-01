/**
 * Browser timezone utilities for handling local time conversions
 * Uses the user's browser timezone for all conversions
 */

/**
 * Convert UTC date to browser's local time
 */
export function utcToLocal(utcDate: Date): Date {
  return new Date(utcDate.getTime() - (utcDate.getTimezoneOffset() * 60 * 1000));
}

/**
 * Convert browser's local time to UTC
 */
export function localToUtc(localDate: Date): Date {
  return new Date(localDate.getTime() + (localDate.getTimezoneOffset() * 60 * 1000));
}

/**
 * Format date and time for local timezone display
 */
export function formatLocalDateTime(date: Date, options?: Intl.DateTimeFormatOptions): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...options
  };
  
  return date.toLocaleDateString(undefined, defaultOptions);
}

/**
 * Format time only for local timezone display
 */
export function formatLocalTime(date: Date, options?: Intl.DateTimeFormatOptions): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...options
  };
  
  return date.toLocaleTimeString(undefined, defaultOptions);
}

/**
 * Format date only for local timezone display
 */
export function formatLocalDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...options
  };
  
  return date.toLocaleDateString(undefined, defaultOptions);
}

/**
 * Convert date to local timezone and format for HTML input (YYYY-MM-DD)
 */
export function toLocalDateInputValue(date: Date): string {
  const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60 * 1000));
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Convert date to local timezone and format for HTML time input (HH:MM)
 */
export function toLocalTimeInputValue(date: Date): string {
  const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60 * 1000));
  const hours = String(localDate.getHours()).padStart(2, '0');
  const minutes = String(localDate.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Create UTC date from local date and time strings
 */
export function fromLocalDateTime(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  
  // Create date in local timezone (this interprets the date/time as local time)
  const localDate = new Date(year, month - 1, day, hours, minutes);
  
  // Convert to UTC by subtracting the timezone offset
  // getTimezoneOffset() returns offset in minutes (negative for timezones ahead of UTC)
  return new Date(localDate.getTime() - (localDate.getTimezoneOffset() * 60 * 1000));
}

/**
 * Get timezone abbreviation (e.g., EST, PST, AEST, etc.)
 */
export function getTimezoneAbbr(date?: Date): string {
  const checkDate = date || new Date();
  
  // Try to get timezone abbreviation from Intl.DateTimeFormat
  try {
    const formatter = new Intl.DateTimeFormat('en', {
      timeZoneName: 'short'
    });
    const parts = formatter.formatToParts(checkDate);
    const timeZoneName = parts.find(part => part.type === 'timeZoneName')?.value;
    
    if (timeZoneName) {
      return timeZoneName;
    }
  } catch {
    // Fallback if Intl.DateTimeFormat fails
  }
  
  // Fallback: calculate offset and return generic format
  const offset = -checkDate.getTimezoneOffset();
  const hours = Math.floor(Math.abs(offset) / 60);
  const minutes = Math.abs(offset) % 60;
  const sign = offset >= 0 ? '+' : '-';
  return `UTC${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Get timezone offset string (+10:00, -05:00, etc.)
 */
export function getTimezoneOffset(date?: Date): string {
  const checkDate = date || new Date();
  const offset = -checkDate.getTimezoneOffset();
  const hours = Math.floor(Math.abs(offset) / 60);
  const minutes = Math.abs(offset) % 60;
  const sign = offset >= 0 ? '+' : '-';
  return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Check if a date is in daylight saving time
 */
export function isDST(date: Date): boolean {
  const january = new Date(date.getFullYear(), 0, 1);
  const july = new Date(date.getFullYear(), 6, 1);
  
  const janOffset = january.getTimezoneOffset();
  const julOffset = july.getTimezoneOffset();
  const currentOffset = date.getTimezoneOffset();
  
  return currentOffset === Math.min(janOffset, julOffset);
}

/**
 * Get the user's timezone (e.g., "America/New_York", "Australia/Sydney")
 */
export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

// ============================================================================
// Browser-Timezone-Aware Functions for Chrona Application
// ============================================================================

/**
 * Create a Date object representing midnight in the user's local timezone
 * This ensures consistent handling of date-only inputs
 */
export function createLocalMidnight(dateStr: string): Date {
  // Parse date components (YYYY-MM-DD format expected)
  const [year, month, day] = dateStr.split('-').map(Number);
  
  // Create date at midnight in local timezone (uses browser's timezone)
  const localMidnight = new Date(year, month - 1, day, 0, 0, 0, 0);
  
  return localMidnight;
}

/**
 * Create a Date object from date and time strings, interpreted in local timezone
 * This is the primary function for creating shift start/end times
 */
export function createLocalDateTime(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  
  // Create date in local timezone (uses browser's timezone)
  const localDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
  
  return localDateTime;
}

/**
 * Convert UTC timestamp to local timezone and check if it represents the expected local time
 * Used for validation and debugging timezone issues
 */
export function validateLocalTime(utcDate: Date, expectedLocalHour: number, expectedLocalMinute: number = 0): boolean {
  const actualLocalHour = utcDate.getHours();
  const actualLocalMinute = utcDate.getMinutes();
  
  return actualLocalHour === expectedLocalHour && actualLocalMinute === expectedLocalMinute;
}

/**
 * Check if a UTC timestamp represents midnight in the user's local timezone
 */
export function isLocalMidnight(utcDate: Date): boolean {
  return validateLocalTime(utcDate, 0, 0);
}

/**
 * Check if a UTC timestamp represents UTC midnight (problematic for timezone consistency)
 * This detects when dates were created without proper timezone consideration
 */
export function isUTCMidnight(utcDate: Date): boolean {
  return utcDate.getUTCHours() === 0 && utcDate.getUTCMinutes() === 0;
}

/**
 * Convert date from database to display format, using user's local timezone
 */
export function formatDatabaseDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

/**
 * Convert datetime from database to display format, using user's local timezone
 */
export function formatDatabaseDateTime(date: Date): string {
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}


// ============================================================================
// Backward Compatibility Functions (Deprecated)
// ============================================================================

/**
 * @deprecated Use createLocalMidnight instead
 */
export function createAESTMidnight(dateStr: string): Date {
  console.warn('createAESTMidnight is deprecated. Use createLocalMidnight instead.');
  return createLocalMidnight(dateStr);
}

/**
 * @deprecated Use createLocalDateTime instead
 */
export function createAESTDateTime(dateStr: string, timeStr: string): Date {
  console.warn('createAESTDateTime is deprecated. Use createLocalDateTime instead.');
  return createLocalDateTime(dateStr, timeStr);
}