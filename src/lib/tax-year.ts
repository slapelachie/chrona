// Utilities for Australian tax year strings, e.g. "2024-25"

export function getTaxYearStringFromDate(date: Date): string {
  const year = date.getFullYear()
  // Australian tax year runs from July 1 to June 30
  if (date.getMonth() >= 6) {
    // July (6) to December → current year to next year
    const nextYY = String((year + 1) % 100).padStart(2, '0')
    return `${year}-${nextYY}`
  } else {
    // January to June → previous year to current year
    const yy = String(year % 100).padStart(2, '0')
    return `${year - 1}-${yy}`
  }
}

export function getCurrentAuTaxYearString(): string {
  return getTaxYearStringFromDate(new Date())
}

export function getTaxYearBounds(taxYear: string): { start: Date; end: Date } {
  const [startYearStr, endYearSuffix] = taxYear.split('-')
  const startYear = Number(startYearStr)
  if (!startYearStr || Number.isNaN(startYear) || endYearSuffix?.length !== 2) {
    throw new Error(`Invalid tax year string: ${taxYear}`)
  }
  const endYear = Number(`${startYearStr.slice(0, 2)}${endYearSuffix}`)
  const start = new Date(Date.UTC(startYear, 6, 1, 0, 0, 0, 0))
  const end = new Date(Date.UTC(endYear, 5, 30, 23, 59, 59, 999))
  return { start, end }
}

export function normalizeTaxYear(taxYear?: string | null): string {
  if (taxYear && taxYear.includes('-')) {
    return taxYear
  }
  return getCurrentAuTaxYearString()
}
