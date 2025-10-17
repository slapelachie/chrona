import { parseCsvToObjects } from './csv-utils'
import {
  ConflictResolution,
  ImportPayGuidesRequest,
  ImportPayPeriodsRequest,
  ImportPreferencesRequest,
  ImportShiftsRequest,
  ImportTaxDataRequest,
  PayPeriodStatus,
  PayPeriodType,
} from '@/types'

const normalizeConflictResolution = (value?: string | null): ConflictResolution => {
  if (value === 'overwrite' || value === 'rename' || value === 'skip') {
    return value
  }
  return 'skip'
}

const parseNumber = (value: string): number | undefined => {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const parseBoolean = (value: string): boolean | undefined => {
  if (!value) return undefined
  const normalized = value.trim().toLowerCase()
  if (normalized === 'true') return true
  if (normalized === 'false') return false
  return undefined
}

const parseMedicareExemption = (value: string | undefined) => {
  if (!value) return undefined
  const normalized = value.trim().toLowerCase()
  if (normalized === 'none' || normalized === 'half' || normalized === 'full') {
    return normalized as 'none' | 'half' | 'full'
  }
  return undefined
}

const parsePayPeriodStatus = (value: string | undefined): PayPeriodStatus => {
  if (!value) return 'pending'
  const normalized = value.trim().toLowerCase()
  return normalized === 'verified' ? 'verified' : 'pending'
}

export const parseShiftsCsv = (
  csv: string,
  options: {
    conflictResolution?: string | null
    validatePayGuides?: string | null
  } = {}
): ImportShiftsRequest => {
  const records = parseCsvToObjects(csv, { headerCase: 'lower' })

  const shifts = records.map(record => {
    const breaksValue = record['breaks'] ?? ''
    const breakPeriods = breaksValue
      .split(';')
      .map(segment => segment.trim())
      .filter(Boolean)
      .map(segment => {
        const [start, end] = segment.split('|').map(part => part?.trim() ?? '')
        if (!start || !end) return null
        return { startTime: start, endTime: end }
      })
      .filter((value): value is { startTime: string; endTime: string } => value !== null)

    return {
      payGuideName: record['pay_guide_name'] ?? record['payguidename'] ?? '',
      startTime: record['start_time'] ?? '',
      endTime: record['end_time'] ?? '',
      notes: record['notes'] || undefined,
      breakPeriods: breakPeriods.length > 0 ? breakPeriods : undefined
    }
  })

  const conflictResolution = normalizeConflictResolution(options.conflictResolution)
  const validatePayGuides = options.validatePayGuides !== 'false'

  return {
    shifts,
    options: {
      conflictResolution,
      validatePayGuides
    }
  }
}

type PayGuideRow = Record<string, string>

export const parsePayGuidesCsv = (
  csv: string,
  options: {
    conflictResolution?: string | null
    activateImported?: string | null
  } = {}
): ImportPayGuidesRequest => {
  const records = parseCsvToObjects(csv, { headerCase: 'lower' }) as PayGuideRow[]

  const payGuidesMap = new Map<string, ImportPayGuidesRequest['payGuides'][number]>()
  const pendingChildren = new Map<string, PayGuideRow[]>()

  const attachChild = (guideName: string, record: PayGuideRow) => {
    const target = payGuidesMap.get(guideName)
    if (!target) {
      const existing = pendingChildren.get(guideName) ?? []
      existing.push(record)
      pendingChildren.set(guideName, existing)
      return
    }

    const type = record['record_type']?.toLowerCase()

    if (type === 'penalty_time_frame') {
      const penalty = {
        name: record['name'],
        multiplier: record['multiplier'],
        dayOfWeek: parseNumber(record['day_of_week']),
        startTime: record['start_time'] || undefined,
        endTime: record['end_time'] || undefined,
        isPublicHoliday: parseBoolean(record['is_public_holiday']) ?? false,
        description: record['description'] || undefined
      }
      if (!target.penaltyTimeFrames) target.penaltyTimeFrames = []
      target.penaltyTimeFrames.push(penalty)
      return
    }

    if (type === 'overtime_time_frame') {
      const overtime = {
        name: record['name'],
        firstThreeHoursMult: record['first_three_hours_mult'],
        afterThreeHoursMult: record['after_three_hours_mult'],
        dayOfWeek: parseNumber(record['day_of_week']),
        startTime: record['start_time'] || undefined,
        endTime: record['end_time'] || undefined,
        isPublicHoliday: parseBoolean(record['is_public_holiday']) ?? false,
        description: record['description'] || undefined
      }
      if (!target.overtimeTimeFrames) target.overtimeTimeFrames = []
      target.overtimeTimeFrames.push(overtime)
      return
    }

    if (type === 'public_holiday') {
      const holiday = {
        name: record['name'],
        date: record['date']
      }
      if (!target.publicHolidays) target.publicHolidays = []
      target.publicHolidays.push(holiday)
    }
  }

  for (const record of records) {
    const type = record['record_type']?.toLowerCase()
    const guideName = record['pay_guide_name'] || record['name'] || ''

    if (type === 'pay_guide') {
      const payGuide = {
        name: guideName,
        baseRate: record['base_rate'],
        minimumShiftHours: parseNumber(record['minimum_shift_hours']),
        maximumShiftHours: parseNumber(record['maximum_shift_hours']),
        description: record['description'] || undefined,
        effectiveFrom: record['effective_from'],
        effectiveTo: record['effective_to'] || undefined,
        timezone: record['timezone'] || undefined,
        penaltyTimeFrames: [] as any[],
        overtimeTimeFrames: [] as any[],
        publicHolidays: [] as any[]
      }

      payGuidesMap.set(guideName, payGuide)

      const waiting = pendingChildren.get(guideName)
      if (waiting) {
        waiting.forEach(child => attachChild(guideName, child))
        pendingChildren.delete(guideName)
      }
    } else if (guideName) {
      attachChild(guideName, record)
    }
  }

  for (const [guideName, rows] of pendingChildren.entries()) {
    if (payGuidesMap.has(guideName)) continue

    const placeholder = {
      name: guideName,
      baseRate: '',
      minimumShiftHours: undefined,
      maximumShiftHours: undefined,
      description: undefined,
      effectiveFrom: '',
      effectiveTo: undefined,
      timezone: undefined,
      penaltyTimeFrames: [] as any[],
      overtimeTimeFrames: [] as any[],
      publicHolidays: [] as any[]
    }

    payGuidesMap.set(guideName, placeholder)
    rows.forEach(row => attachChild(guideName, row))
  }

  const payGuides = Array.from(payGuidesMap.values()).map(guide => ({
    ...guide,
    penaltyTimeFrames: guide.penaltyTimeFrames && guide.penaltyTimeFrames.length > 0 ? guide.penaltyTimeFrames : undefined,
    overtimeTimeFrames: guide.overtimeTimeFrames && guide.overtimeTimeFrames.length > 0 ? guide.overtimeTimeFrames : undefined,
    publicHolidays: guide.publicHolidays && guide.publicHolidays.length > 0 ? guide.publicHolidays : undefined
  }))

  const conflictResolution = normalizeConflictResolution(options.conflictResolution)
  const activateImported = options.activateImported !== 'false'

  return {
    payGuides,
    options: {
      conflictResolution,
      activateImported
    }
  }
}

const parsePaygTaxCsv = (csv?: string) => {
  if (!csv) {
    return {
      taxSettings: undefined,
      taxCoefficients: [] as Array<{
        taxYear: string
        scale: string
        earningsFrom: string
        earningsTo?: string
        coefficientA: string
        coefficientB: string
        description?: string
      }> ,
      taxRateConfigs: [] as Array<{ taxYear: string; description?: string }>
    }
  }

  const records = parseCsvToObjects(csv, { headerCase: 'lower' })

  const taxSettingsRow = records.find(record => record['record_type'] === 'tax_settings')
  const taxSettings = taxSettingsRow
    ? {
        claimedTaxFreeThreshold: parseBoolean(taxSettingsRow['claimed_tax_free_threshold']) ?? undefined,
        isForeignResident: parseBoolean(taxSettingsRow['is_foreign_resident']) ?? undefined,
        hasTaxFileNumber: parseBoolean(taxSettingsRow['has_tax_file_number']) ?? undefined,
        medicareExemption: parseMedicareExemption(taxSettingsRow['medicare_exemption'])
      }
    : undefined

  const taxCoefficients = records
    .filter(record => record['record_type'] === 'tax_coefficient')
    .map(record => ({
      taxYear: record['tax_year'],
      scale: record['scale'],
      earningsFrom: record['earnings_from'],
      earningsTo: record['earnings_to'] || undefined,
      coefficientA: record['coefficient_a'],
      coefficientB: record['coefficient_b'],
      description: record['description'] || undefined
    }))

  const taxRateConfigs = records
    .filter(record => record['record_type'] === 'tax_rate_config')
    .map(record => ({
      taxYear: record['tax_year'],
      description: record['description'] || undefined
    }))

  return { taxSettings, taxCoefficients, taxRateConfigs }
}

const parseStslCsv = (csv?: string) => {
  if (!csv) return []
  const records = parseCsvToObjects(csv, { headerCase: 'lower' })
  return records
    .filter(record => record['record_type'] === 'stsl_rate')
    .map(record => ({
      taxYear: record['tax_year'],
      scale: record['scale'],
      earningsFrom: record['earnings_from'],
      earningsTo: record['earnings_to'] || undefined,
      coefficientA: record['coefficient_a'],
      coefficientB: record['coefficient_b'],
      description: record['description'] || undefined
    }))
}

export const parseTaxDataFiles = (
  input: {
    paygCsv?: string
    stslCsv?: string
    options?: {
      conflictResolution?: string | null
      replaceExisting?: string | null
    }
  } = {}
): ImportTaxDataRequest => {
  const { paygCsv, stslCsv, options = {} } = input
  const payg = parsePaygTaxCsv(paygCsv)
  const stslRates = parseStslCsv(stslCsv)

  const conflictResolution = normalizeConflictResolution(options.conflictResolution)
  const replaceExisting = options.replaceExisting === 'true'

  return {
    taxSettings: payg.taxSettings,
    taxCoefficients: payg.taxCoefficients.length > 0 ? payg.taxCoefficients : undefined,
    stslRates: stslRates.length > 0 ? stslRates : undefined,
    taxRateConfigs: payg.taxRateConfigs.length > 0 ? payg.taxRateConfigs : undefined,
    options: {
      conflictResolution,
      replaceExisting
    }
  }
}

export const parsePayPeriodsFiles = (
  input: {
    payPeriodsCsv: string
    extrasCsv?: string
    options?: {
      conflictResolution?: string | null
    }
  }
): ImportPayPeriodsRequest => {
  const { payPeriodsCsv, extrasCsv, options = {} } = input
  const records = parseCsvToObjects(payPeriodsCsv, { headerCase: 'lower' })

  const payPeriods = records
    .filter(record => record['start_date'] && record['end_date'])
    .map(record => ({
      startDate: record['start_date'],
      endDate: record['end_date'],
      status: parsePayPeriodStatus(record['status']),
      totalHours: record['total_hours'] || undefined,
      totalPay: record['total_pay'] || undefined,
      paygWithholding: record['payg_withholding'] || undefined,
      stslAmount: record['stsl_amount'] || undefined,
      totalWithholdings: record['total_withholdings'] || undefined,
      netPay: record['net_pay'] || undefined,
      actualPay: record['actual_pay'] || undefined
    }))

  const extras = extrasCsv
    ? parseCsvToObjects(extrasCsv, { headerCase: 'lower' })
        .filter(record => record['pay_period_start_date'])
        .map(record => ({
          periodStartDate: record['pay_period_start_date'],
          periodEndDate: record['pay_period_end_date'] || undefined,
          type: record['type'] || '',
          description: record['description'] || undefined,
          amount: record['amount'] || '0',
          taxable: parseBoolean(record['taxable']) ?? true
        }))
    : undefined

  const conflictResolution = normalizeConflictResolution(options.conflictResolution)

  return {
    payPeriods,
    extras,
    options: {
      conflictResolution
    }
  }
}

export const parsePreferencesJson = (json: string): ImportPreferencesRequest => {
  try {
    const parsed = JSON.parse(json)

    const preferences: ImportPreferencesRequest = {
      user: undefined,
      defaultExtras: undefined,
      options: {
        conflictResolution: 'skip'
      }
    }

    if (parsed && typeof parsed === 'object') {
      if (parsed.user && typeof parsed.user === 'object') {
        const user = parsed.user as Record<string, unknown>
        const rawPayPeriodType =
          typeof user.payPeriodType === 'string' ? user.payPeriodType.toUpperCase() : undefined
        const payPeriodType: PayPeriodType | undefined =
          rawPayPeriodType &&
          (['WEEKLY', 'FORTNIGHTLY', 'MONTHLY'] as readonly PayPeriodType[]).includes(
            rawPayPeriodType as PayPeriodType
          )
            ? (rawPayPeriodType as PayPeriodType)
            : undefined

        preferences.user = {
          name: typeof user.name === 'string' ? user.name : undefined,
          email: typeof user.email === 'string' ? user.email : undefined,
          timezone: typeof user.timezone === 'string' ? user.timezone : undefined,
          payPeriodType,
          defaultShiftLengthMinutes:
            typeof user.defaultShiftLengthMinutes === 'number'
              ? user.defaultShiftLengthMinutes
              : typeof user.defaultShiftLengthMinutes === 'string'
                ? Number(user.defaultShiftLengthMinutes)
                : undefined,
        }
      }

      if (Array.isArray(parsed.defaultExtras)) {
        preferences.defaultExtras = parsed.defaultExtras
          .map((extra: any) => ({
            label: typeof extra.label === 'string' ? extra.label : '',
            description: typeof extra.description === 'string' ? extra.description : undefined,
            amount:
              typeof extra.amount === 'string'
                ? extra.amount
                : typeof extra.amount === 'number'
                  ? extra.amount.toString()
                  : '0',
            taxable:
              typeof extra.taxable === 'boolean'
                ? extra.taxable
                : extra.taxable === 'false'
                  ? false
                  : true,
            active:
              typeof extra.active === 'boolean'
                ? extra.active
                : extra.active === 'false'
                  ? false
                  : true,
            sortOrder:
              typeof extra.sortOrder === 'number'
                ? extra.sortOrder
                : typeof extra.sortOrder === 'string'
                  ? Number(extra.sortOrder)
                  : undefined,
          }))
      }
    }

    return preferences
  } catch (error) {
    console.error('Failed to parse preferences JSON:', error)
    return {
      options: { conflictResolution: 'skip' }
    }
  }
}
