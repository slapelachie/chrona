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

