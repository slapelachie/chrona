import { TaxSettings } from '@/types'

export async function createTaxCalculator(taxSettings: TaxSettings, taxYear: string) {
  const { TaxCalculator } = await import('@/lib/calculations/tax-calculator')
  return await TaxCalculator.createFromDatabase(taxSettings, taxYear)
}
