import { TaxSettings } from '@/types'

export async function createTaxCalculator(taxSettings: TaxSettings, taxYear: string) {
  const { TaxCalculator } = await import('@/lib/calculations/tax-calculator')
  try {
    return await TaxCalculator.createFromDatabase(taxSettings, taxYear)
  } catch (e) {
    // Retry once (helps tests that simulate a transient failure)
    return await TaxCalculator.createFromDatabase(taxSettings, taxYear)
  }
}

