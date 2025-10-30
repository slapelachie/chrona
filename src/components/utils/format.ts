const DEFAULT_LOCALE = 'en-AU'
const DEFAULT_CURRENCY = 'AUD'

type NumericInput =
  | number
  | string
  | bigint
  | { toString(): string }
  | null
  | undefined
type DateInput = Date | string | number | null | undefined

const isFiniteNumber = (value: number) => Number.isFinite(value)

export const toNumber = (value: NumericInput): number | null => {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return isFiniteNumber(value) ? value : null
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = Number(trimmed)
    return isFiniteNumber(parsed) ? parsed : null
  }
  if (typeof value === 'object') {
    const stringValue = value.toString()
    if (!stringValue) return null
    const parsed = Number(stringValue)
    return isFiniteNumber(parsed) ? parsed : null
  }
  return null
}

export const formatDecimal = (
  value: NumericInput,
  options: {
    minimumFractionDigits?: number
    maximumFractionDigits?: number
    fallback?: string
    locale?: string
  } = {}
): string => {
  const {
    minimumFractionDigits = 2,
    maximumFractionDigits = minimumFractionDigits,
    fallback = '0.00',
    locale = DEFAULT_LOCALE,
  } = options

  const numeric = toNumber(value)
  if (numeric === null) return fallback

  return numeric.toLocaleString(locale, {
    minimumFractionDigits,
    maximumFractionDigits,
  })
}

export const formatCurrencyValue = (
  value: NumericInput,
  options: {
    fallback?: string
    locale?: string
  } = {}
): string => formatDecimal(value, { ...options })

export const formatCurrencyAmount = (
  value: NumericInput,
  options: {
    currency?: string
    locale?: string
    fallback?: string
  } = {}
): string => {
  const {
    currency = DEFAULT_CURRENCY,
    locale = DEFAULT_LOCALE,
    fallback = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(0),
  } = options

  const numeric = toNumber(value)
  if (numeric === null) return fallback

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric)
}

export const formatHours = (
  value: NumericInput,
  options: { digits?: number; fallback?: string } = {}
): string => {
  const { digits = 2, fallback = '0.00' } = options
  const numeric = toNumber(value)
  if (numeric === null) return fallback
  return numeric.toFixed(digits)
}

export const formatDurationFromHours = (
  value: NumericInput,
  options: { fallback?: string } = {}
): string => {
  const { fallback = 'N/A' } = options
  const numeric = toNumber(value)
  if (numeric === null) return fallback

  const wholeHours = Math.floor(numeric)
  const minutes = Math.round((numeric - wholeHours) * 60)

  if (minutes === 0) return `${wholeHours}h`
  if (wholeHours === 0) return `${minutes}m`
  return `${wholeHours}h ${minutes}m`
}

const toDateOrNull = (value: DateInput): Date | null => {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const converted = new Date(value)
  return Number.isNaN(converted.getTime()) ? null : converted
}

export const formatTime = (
  value: DateInput,
  options: {
    locale?: string
    timeOptions?: Intl.DateTimeFormatOptions
  } = {}
): string => {
  const { locale = DEFAULT_LOCALE, timeOptions } = options
  const date = toDateOrNull(value)
  if (!date) return ''

  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...timeOptions,
  }).format(date)
}

export const formatDateLabel = (
  value: DateInput,
  options: {
    locale?: string
    dateOptions?: Intl.DateTimeFormatOptions
  } = {}
): string => {
  const { locale = DEFAULT_LOCALE, dateOptions } = options
  const date = toDateOrNull(value)
  if (!date) return ''

  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...dateOptions,
  }).format(date)
}

export const formatDateContext = (
  start: DateInput,
  end: DateInput,
  options: {
    locale?: string
    dateOptions?: Intl.DateTimeFormatOptions
  } = {}
): string => {
  const startLabel = formatDateLabel(start, options)
  const endLabel = formatDateLabel(end, options)

  if (!startLabel && !endLabel) return ''
  if (startLabel === endLabel) return startLabel
  if (!startLabel) return endLabel
  if (!endLabel) return startLabel
  return `${startLabel} - ${endLabel}`
}

export const formatTimeRange = (
  start: DateInput,
  end: DateInput,
  options: {
    locale?: string
    timeOptions?: Intl.DateTimeFormatOptions
    separator?: string
  } = {}
): string => {
  const { separator = ' - ' } = options
  const startLabel = formatTime(start, options)
  const endLabel = formatTime(end, options)

  if (!startLabel && !endLabel) return ''
  if (!startLabel) return endLabel
  if (!endLabel) return startLabel
  return `${startLabel}${separator}${endLabel}`
}

export const sumNumeric = <T>(
  items: T[],
  selector: (item: T) => NumericInput
): number =>
  items.reduce((total, item) => {
    const numeric = toNumber(selector(item))
    return total + (numeric ?? 0)
  }, 0)
