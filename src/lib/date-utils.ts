const DEFAULT_LOCALE = 'en-AU'

/**
 * Formats a date that represents a pay-period boundary. These timestamps are
 * stored as UTC dates at the start/end of the day, so we render them using UTC
 * to avoid accidental timezone shifts on the client (e.g. showing the next day
 * when the viewer is ahead of UTC).
 */
export function formatPayPeriodDate(
  dateInput: Date | string,
  options?: Intl.DateTimeFormatOptions,
  locale: string = DEFAULT_LOCALE
): string {
  const date = new Date(dateInput)
  if (Number.isNaN(date.getTime())) return ''

  const formatOptions: Intl.DateTimeFormatOptions = {
    ...options,
    timeZone: options?.timeZone ?? 'UTC',
  }

  return new Intl.DateTimeFormat(locale, formatOptions).format(date)
}
