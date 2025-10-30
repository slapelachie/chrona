import { TaxCoefficient, TaxRateConfig, StslRate } from '@/types'
import { DEFAULT_TAX_COEFFICIENTS } from '@/lib/tax-defaults'

/**
 * Service for loading tax coefficients, HECS thresholds, and tax configuration
 * from the database with caching for performance
 */
type CacheEntry<T> = {
  value: T
  expiresAt: number
}

export class TaxCoefficientService {
  private static coefficientsCache = new Map<string, CacheEntry<TaxCoefficient[]>>()
  private static taxConfigCache = new Map<string, CacheEntry<TaxRateConfig>>()
  private static stslRatesCache = new Map<string, CacheEntry<StslRate[]>>()

  // Cache TTL: 1 hour (tax rates don't change frequently)
  private static readonly CACHE_TTL = 60 * 60 * 1000

  /**
   * Get tax coefficients for a specific tax year and scale
   */
  static async getTaxCoefficients(taxYear: string, scale?: string): Promise<TaxCoefficient[]> {
    const cacheKey = `coefficients:${taxYear}:${scale || 'all'}`
    
    const cachedEntry = this.coefficientsCache.get(cacheKey)
    if (cachedEntry && this.isCacheValid(cachedEntry)) {
      return cachedEntry.value
    }

    try {
      // Build where clause
      const where: any = {
        taxYear,
        isActive: true,
      }

      if (scale) {
        where.scale = scale
      }

      const { prisma } = await import('@/lib/db')
      const dbCoefficients = await prisma.taxCoefficient.findMany({
        where,
        orderBy: [
          { scale: 'asc' },
          { earningsFrom: 'asc' },
        ],
      })

      // Transform to domain types
      const coefficients: TaxCoefficient[] = dbCoefficients.map(coeff => ({
        scale: coeff.scale as any, // Type assertion for TaxScale
        earningsFrom: coeff.earningsFrom,
        earningsTo: coeff.earningsTo,
        coefficientA: coeff.coefficientA,
        coefficientB: coeff.coefficientB,
      }))

      // Cache the result
      this.coefficientsCache.set(cacheKey, {
        value: coefficients,
        expiresAt: this.getExpiryTimestamp(),
      })

      return coefficients
    } catch (error) {
      console.error('Error loading tax coefficients from database:', error)
      
      // Fallback to hardcoded values if database fails
      console.warn('Falling back to hardcoded tax coefficients')
      return this.getFallbackCoefficients(scale)
    }
  }

  /**
   * Get tax rate configuration for a specific tax year
   */
  static async getTaxRateConfig(taxYear: string): Promise<TaxRateConfig> {
    const cacheKey = `config:${taxYear}`
    
    const cachedEntry = this.taxConfigCache.get(cacheKey)
    if (cachedEntry && this.isCacheValid(cachedEntry)) {
      return cachedEntry.value
    }

    try {
      const { prisma } = await import('@/lib/db')
      const dbConfig = await prisma.taxRateConfig.findUnique({ where: { taxYear } })

      // If config exists, use it as the source of truth
      if (dbConfig) {
        const [coefficients, stslRates] = await Promise.all([
          this.getTaxCoefficients(taxYear),
          this.getStslRates(taxYear),
        ])

        const config: TaxRateConfig = {
          taxYear: dbConfig.taxYear,
          stslRates,
          coefficients,
        }
        this.taxConfigCache.set(cacheKey, {
          value: config,
          expiresAt: this.getExpiryTimestamp(),
        })
        return config
      }

      // No config row — synthesize if year-specific tables exist to avoid hard fallback
      const [coeffCount, stslCount] = await Promise.all([
        prisma.taxCoefficient.count({ where: { taxYear, isActive: true } }),
        prisma.stslRate.count({ where: { taxYear, isActive: true } }),
      ])

      if (coeffCount > 0 || stslCount > 0) {
        const [coefficients, stslRates] = await Promise.all([
          this.getTaxCoefficients(taxYear),
          this.getStslRates(taxYear),
        ])

        const config: TaxRateConfig = {
          taxYear,
          stslRates,
          coefficients,
        }
        this.taxConfigCache.set(cacheKey, {
          value: config,
          expiresAt: this.getExpiryTimestamp(),
        })
        return config
      }

      // Truly missing: nothing for this year, fall back to canned configuration so import flows continue
      console.warn(`No tax configuration found for tax year ${taxYear}. Using fallback configuration.`)
      const fallback = this.getFallbackTaxConfig(taxYear)
      this.taxConfigCache.set(cacheKey, {
        value: fallback,
        expiresAt: this.getExpiryTimestamp(),
      })
      return fallback
    } catch (error: any) {
      console.error('Error loading tax configuration from database:', error)
      console.warn('Falling back to hardcoded tax configuration')
      const fallback = this.getFallbackTaxConfig(taxYear)
      this.taxConfigCache.set(cacheKey, {
        value: fallback,
        expiresAt: this.getExpiryTimestamp(),
      })
      return fallback
    }
  }

  /**
   * Clear all caches (useful for testing or when tax rates are updated)
   */
  static clearCache(): void {
    this.coefficientsCache.clear()
    this.taxConfigCache.clear()
    this.stslRatesCache.clear()
  }

  /**
   * Clear cache for a specific tax year
   */
  static clearCacheForTaxYear(taxYear: string): void {
    for (const key of Array.from(this.coefficientsCache.keys())) {
      if (key.includes(taxYear)) this.coefficientsCache.delete(key)
    }
    for (const key of Array.from(this.taxConfigCache.keys())) {
      if (key.includes(taxYear)) this.taxConfigCache.delete(key)
    }
    for (const key of Array.from(this.stslRatesCache.keys())) {
      if (key.includes(taxYear)) this.stslRatesCache.delete(key)
    }
  }

  private static isCacheValid<T>(entry: CacheEntry<T>): boolean {
    return Date.now() < entry.expiresAt
  }

  private static getExpiryTimestamp(): number {
    return Date.now() + this.CACHE_TTL
  }

  private static getFallbackCoefficients(scale?: string): TaxCoefficient[] {
    if (!scale) {
      return DEFAULT_TAX_COEFFICIENTS
    }

    return DEFAULT_TAX_COEFFICIENTS.filter(coeff => coeff.scale === scale)
  }

  private static getFallbackTaxConfig(taxYear = '2024-25'): TaxRateConfig {
    return {
      taxYear,
      stslRates: [],
      coefficients: this.getFallbackCoefficients(),
    }
  }

  // STSL component rates per Schedule 8
  static async getStslRates(taxYear: string): Promise<StslRate[]> {
    const cacheKey = `stsl:${taxYear}`
    const cachedEntry = this.stslRatesCache.get(cacheKey)
    if (cachedEntry && this.isCacheValid(cachedEntry)) {
      return cachedEntry.value
    }

    try {
      const { prisma } = await import('@/lib/db')
      const rows = await prisma.stslRate.findMany({
        where: { taxYear, isActive: true },
        orderBy: [{ scale: 'asc' }, { earningsFrom: 'asc' }],
      })
      const result: StslRate[] = rows.map(r => ({
        scale: r.scale as any,
        earningsFrom: r.earningsFrom,
        earningsTo: r.earningsTo,
        coefficientA: r.coefficientA,
        coefficientB: r.coefficientB,
        description: r.description || undefined,
      }))
      this.stslRatesCache.set(cacheKey, {
        value: result,
        expiresAt: this.getExpiryTimestamp(),
      })
      return result
    } catch (error) {
      console.error('Error loading STSL rates from database:', error)
      return []
    }
  }

  // No date-based STSL lookups; formulas use the single configured A/B set.
}
