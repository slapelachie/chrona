import { serializeCsv } from './csv-utils'

type DecimalLike = { toString(): string }

type MaybeDecimal = DecimalLike | null | undefined

interface BreakPeriodExport {
  startTime: Date
  endTime: Date
}

interface ShiftExportRecord {
  payGuide: { name: string }
  startTime: Date
  endTime: Date
  notes: string | null
  totalHours?: MaybeDecimal
  basePay?: MaybeDecimal
  overtimePay?: MaybeDecimal
  penaltyPay?: MaybeDecimal
  totalPay?: MaybeDecimal
  breakPeriods: BreakPeriodExport[]
}

interface TimeFrameExport {
  name: string
  multiplier: DecimalLike
  dayOfWeek: number | null
  startTime: string | null
  endTime: string | null
  isPublicHoliday: boolean | null
  description: string | null
  isActive: boolean
}

interface OvertimeTimeFrameExport {
  name: string
  firstThreeHoursMult: DecimalLike
  afterThreeHoursMult: DecimalLike
  dayOfWeek: number | null
  startTime: string | null
  endTime: string | null
  isPublicHoliday: boolean | null
  description: string | null
  isActive: boolean
}

interface PublicHolidayExport {
  name: string
  date: Date
  isActive: boolean
}

interface PayGuideExportRecord {
  name: string
  baseRate: DecimalLike
  minimumShiftHours: number | null
  maximumShiftHours: number | null
  description: string | null
  effectiveFrom: Date
  effectiveTo: Date | null
  timezone: string
  isActive: boolean
  penaltyTimeFrames: TimeFrameExport[]
  overtimeTimeFrames: OvertimeTimeFrameExport[]
  publicHolidays: PublicHolidayExport[]
}

interface TaxSettingsExport {
  claimedTaxFreeThreshold: boolean | null
  isForeignResident: boolean | null
  hasTaxFileNumber: boolean | null
  medicareExemption: string | null
}

interface TaxCoefficientExport {
  taxYear: string
  scale: string
  earningsFrom: DecimalLike
  earningsTo: DecimalLike | null
  coefficientA: DecimalLike
  coefficientB: DecimalLike
  description: string | null
  isActive: boolean
}

interface TaxRateConfigExport {
  taxYear: string
  description: string | null
  isActive: boolean
}

export const buildShiftsCsv = (shifts: ShiftExportRecord[]): string => {
  const header = [
    'pay_guide_name',
    'start_time',
    'end_time',
    'notes',
    'breaks',
    'total_hours',
    'base_pay',
    'overtime_pay',
    'penalty_pay',
    'total_pay'
  ]

  const rows = shifts.map(shift => {
    const breakValue = shift.breakPeriods
      .map(bp => `${bp.startTime.toISOString()}|${bp.endTime.toISOString()}`)
      .join(';')

    const toStr = (value: MaybeDecimal): string => (value ? value.toString() : '')

    return [
      shift.payGuide.name,
      shift.startTime.toISOString(),
      shift.endTime.toISOString(),
      shift.notes ?? '',
      breakValue,
      toStr(shift.totalHours),
      toStr(shift.basePay),
      toStr(shift.overtimePay),
      toStr(shift.penaltyPay),
      toStr(shift.totalPay)
    ]
  })

  return serializeCsv([header, ...rows])
}

export const buildPayGuidesCsv = (payGuides: PayGuideExportRecord[]): string => {
  const header = [
    'record_type',
    'pay_guide_name',
    'name',
    'base_rate',
    'minimum_shift_hours',
    'maximum_shift_hours',
    'description',
    'effective_from',
    'effective_to',
    'timezone',
    'is_active',
    'multiplier',
    'day_of_week',
    'start_time',
    'end_time',
    'is_public_holiday',
    'first_three_hours_mult',
    'after_three_hours_mult',
    'date'
  ]

  const rows: string[][] = []

  for (const guide of payGuides) {
    rows.push([
      'pay_guide',
      guide.name,
      guide.name,
      guide.baseRate.toString(),
      guide.minimumShiftHours?.toString() ?? '',
      guide.maximumShiftHours?.toString() ?? '',
      guide.description ?? '',
      guide.effectiveFrom.toISOString(),
      guide.effectiveTo?.toISOString() ?? '',
      guide.timezone,
      guide.isActive ? 'true' : 'false',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      ''
    ])

    for (const ptf of guide.penaltyTimeFrames) {
      rows.push([
        'penalty_time_frame',
        guide.name,
        ptf.name,
        '',
        '',
        '',
        ptf.description ?? '',
        '',
        '',
        '',
        ptf.isActive ? 'true' : 'false',
        ptf.multiplier.toString(),
        ptf.dayOfWeek?.toString() ?? '',
        ptf.startTime ?? '',
        ptf.endTime ?? '',
        ptf.isPublicHoliday ? 'true' : 'false',
        '',
        '',
        ''
      ])
    }

    for (const otf of guide.overtimeTimeFrames) {
      rows.push([
        'overtime_time_frame',
        guide.name,
        otf.name,
        '',
        '',
        '',
        otf.description ?? '',
        '',
        '',
        '',
        otf.isActive ? 'true' : 'false',
        '',
        otf.dayOfWeek?.toString() ?? '',
        otf.startTime ?? '',
        otf.endTime ?? '',
        otf.isPublicHoliday ? 'true' : 'false',
        otf.firstThreeHoursMult.toString(),
        otf.afterThreeHoursMult.toString(),
        ''
      ])
    }

    for (const holiday of guide.publicHolidays) {
      rows.push([
        'public_holiday',
        guide.name,
        holiday.name,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        holiday.isActive ? 'true' : 'false',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        holiday.date.toISOString().split('T')[0]
      ])
    }
  }

  return serializeCsv([header, ...rows])
}

export const buildPaygTaxCsv = (
  taxSettings: TaxSettingsExport,
  taxCoefficients: TaxCoefficientExport[],
  taxRateConfigs: TaxRateConfigExport[]
): string => {
  const header = [
    'record_type',
    'tax_year',
    'scale',
    'earnings_from',
    'earnings_to',
    'coefficient_a',
    'coefficient_b',
    'description',
    'is_active',
    'claimed_tax_free_threshold',
    'is_foreign_resident',
    'has_tax_file_number',
    'medicare_exemption'
  ]

  const rows: string[][] = []

  rows.push([
    'tax_settings',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    taxSettings.claimedTaxFreeThreshold ? 'true' : 'false',
    taxSettings.isForeignResident ? 'true' : 'false',
    taxSettings.hasTaxFileNumber ? 'true' : 'false',
    taxSettings.medicareExemption ?? ''
  ])

  for (const coeff of taxCoefficients) {
    rows.push([
      'tax_coefficient',
      coeff.taxYear,
      coeff.scale,
      coeff.earningsFrom.toString(),
      coeff.earningsTo?.toString() ?? '',
      coeff.coefficientA.toString(),
      coeff.coefficientB.toString(),
      coeff.description ?? '',
      coeff.isActive ? 'true' : 'false',
      '',
      '',
      '',
      ''
    ])
  }

  for (const config of taxRateConfigs) {
    rows.push([
      'tax_rate_config',
      config.taxYear,
      '',
      '',
      '',
      '',
      '',
      config.description ?? '',
      config.isActive ? 'true' : 'false',
      '',
      '',
      '',
      ''
    ])
  }

  return serializeCsv([header, ...rows])
}

export const buildStslTaxCsv = (stslRates: TaxCoefficientExport[]): string => {
  const header = [
    'record_type',
    'tax_year',
    'scale',
    'earnings_from',
    'earnings_to',
    'coefficient_a',
    'coefficient_b',
    'description',
    'is_active'
  ]

  const rows = stslRates.map(rate => ([
    'stsl_rate',
    rate.taxYear,
    rate.scale,
    rate.earningsFrom.toString(),
    rate.earningsTo?.toString() ?? '',
    rate.coefficientA.toString(),
    rate.coefficientB.toString(),
    rate.description ?? '',
    rate.isActive ? 'true' : 'false'
  ]))

  return serializeCsv([header, ...rows])
}
