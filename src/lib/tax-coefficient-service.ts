import { Decimal } from 'decimal.js'
import { TaxCoefficient, TaxRateConfig, StslRate } from '@/types'

/**
 * Service for loading tax coefficients, HECS thresholds, and tax configuration
 * from the database with caching for performance
 */
export class TaxCoefficientService {
  private static coefficientsCache = new Map<string, TaxCoefficient[]>()
  private static taxConfigCache = new Map<string, TaxRateConfig>()
  private static stslRatesCache = new Map<string, StslRate[]>()
  private static cacheExpiry = new Map<string, number>()
  
  // Cache TTL: 1 hour (tax rates don't change frequently)
  private static readonly CACHE_TTL = 60 * 60 * 1000

  /**
   * Get tax coefficients for a specific tax year and scale
   */
  static async getTaxCoefficients(taxYear: string, scale?: string): Promise<TaxCoefficient[]> {
    const cacheKey = `coefficients:${taxYear}:${scale || 'all'}`
    
    // Check cache first
    if (this.isCacheValid(cacheKey)) {
      const cached = this.coefficientsCache.get(cacheKey)
      if (cached) {
        return cached
      }
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
      this.coefficientsCache.set(cacheKey, coefficients)
      this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL)

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
    
    // Check cache first
    if (this.isCacheValid(cacheKey)) {
      const cached = this.taxConfigCache.get(cacheKey)
      if (cached) {
        return cached
      }
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
        this.taxConfigCache.set(cacheKey, config)
        this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL)
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
        this.taxConfigCache.set(cacheKey, config)
        this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL)
        return config
      }

      // Truly missing: nothing for this year
      throw new Error(`No tax configuration found for tax year ${taxYear}`)
    } catch (error: any) {
      console.error('Error loading tax configuration from database:', error)
      if (error instanceof Error && error.message.includes('No tax configuration found')) {
        throw error
      }
      console.warn('Falling back to hardcoded tax configuration')
      return this.getFallbackTaxConfig()
    }
  }

  /**
   * Clear all caches (useful for testing or when tax rates are updated)
   */
  static clearCache(): void {
    this.coefficientsCache.clear()
    this.taxConfigCache.clear()
    this.stslRatesCache.clear()
    this.cacheExpiry.clear()
  }

  /**
   * Clear cache for a specific tax year
   */
  static clearCacheForTaxYear(taxYear: string): void {
    const keysToDelete: string[] = []
    
    for (const key of this.cacheExpiry.keys()) {
      if (key.includes(taxYear)) {
        keysToDelete.push(key)
      }
    }

    keysToDelete.forEach(key => {
      this.coefficientsCache.delete(key)
      this.taxConfigCache.delete(key)
      this.stslRatesCache.delete(key)
      this.cacheExpiry.delete(key)
    })
  }

  private static isCacheValid(cacheKey: string): boolean {
    const expiry = this.cacheExpiry.get(cacheKey)
    return expiry ? Date.now() < expiry : false
  }

  private static getFallbackCoefficients(scale?: string): TaxCoefficient[] {
    // Hardcoded fallback coefficients for 2024-25 (Scale 2 - most common)
    const scale2Coefficients: TaxCoefficient[] = [
      { scale: 'scale2', earningsFrom: new Decimal(0), earningsTo: new Decimal(371), coefficientA: new Decimal(0), coefficientB: new Decimal(0) },
      { scale: 'scale2', earningsFrom: new Decimal(371), earningsTo: new Decimal(515), coefficientA: new Decimal(0.19), coefficientB: new Decimal(70.5385) },
      { scale: 'scale2', earningsFrom: new Decimal(515), earningsTo: new Decimal(721), coefficientA: new Decimal(0.2348), coefficientB: new Decimal(93.4615) },
      { scale: 'scale2', earningsFrom: new Decimal(721), earningsTo: new Decimal(1282), coefficientA: new Decimal(0.219), coefficientB: new Decimal(82.1154) },
      { scale: 'scale2', earningsFrom: new Decimal(1282), earningsTo: new Decimal(2307), coefficientA: new Decimal(0.3477), coefficientB: new Decimal(247.1154) },
      { scale: 'scale2', earningsFrom: new Decimal(2307), earningsTo: null, coefficientA: new Decimal(0.45), coefficientB: new Decimal(482.6731) },
    ]

    const scale1Coefficients: TaxCoefficient[] = [
      { scale: 'scale1', earningsFrom: new Decimal(0), earningsTo: new Decimal(88), coefficientA: new Decimal(0.19), coefficientB: new Decimal(0) },
      { scale: 'scale1', earningsFrom: new Decimal(88), earningsTo: new Decimal(371), coefficientA: new Decimal(0.2348), coefficientB: new Decimal(12.7692) },
      { scale: 'scale1', earningsFrom: new Decimal(371), earningsTo: new Decimal(515), coefficientA: new Decimal(0.219), coefficientB: new Decimal(6.5385) },
      { scale: 'scale1', earningsFrom: new Decimal(515), earningsTo: new Decimal(721), coefficientA: new Decimal(0.3477), coefficientB: new Decimal(72.5385) },
      { scale: 'scale1', earningsFrom: new Decimal(721), earningsTo: new Decimal(1282), coefficientA: new Decimal(0.45), coefficientB: new Decimal(146.0769) },
      { scale: 'scale1', earningsFrom: new Decimal(1282), earningsTo: null, coefficientA: new Decimal(0.45), coefficientB: new Decimal(146.0769) },
    ]

    if (scale === 'scale1') return scale1Coefficients
    if (scale === 'scale2') return scale2Coefficients
    
    // Return all scales if no specific scale requested
    return [...scale1Coefficients, ...scale2Coefficients]
  }

  private static getFallbackTaxConfig(): TaxRateConfig {
    return {
      taxYear: '2024-25',
      stslRates: [],
      coefficients: this.getFallbackCoefficients(),
    }
  }

  // STSL component rates per Schedule 8
  static async getStslRates(taxYear: string): Promise<StslRate[]> {
    const cacheKey = `stsl:${taxYear}`
    if (this.isCacheValid(cacheKey)) {
      const cached = this.stslRatesCache.get(cacheKey)
      if (cached) return cached
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
      this.stslRatesCache.set(cacheKey, result)
      this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL)
      return result
    } catch (error) {
      console.error('Error loading STSL rates from database:', error)
      return []
    }
  }

  // No date-based STSL lookups; formulas use the single configured A/B set.
}
