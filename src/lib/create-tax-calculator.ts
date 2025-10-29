import { TaxSettings } from '@/types'

export async function createTaxCalculator(taxSettings: TaxSettings, taxYear: string) {
  const { TaxCalculator } = await import('@/lib/calculations/tax-calculator')
  try {
    return await TaxCalculator.createFromDatabase(taxSettings, taxYear)
  } catch (error) {
    console.warn('Retrying tax calculator creation after failure:', error)
    // Retry once (helps tests that simulate a transient failure)
    return await TaxCalculator.createFromDatabase(taxSettings, taxYear)
  }
}
