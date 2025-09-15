import { Decimal } from 'decimal.js'
import { TaxCoefficient, HecsThreshold, TaxRateConfig, StslRate } from '@/types'

/**
 * Service for loading tax coefficients, HECS thresholds, and tax configuration
 * from the database with caching for performance
 */
export class TaxCoefficientService {
  private static coefficientsCache = new Map<string, TaxCoefficient[]>()
  private static hecsThresholdsCache = new Map<string, HecsThreshold[]>()
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
   * Get HECS-HELP thresholds for a specific tax year
   */
  static async getHecsThresholds(taxYear: string): Promise<HecsThreshold[]> {
    const cacheKey = `hecs:${taxYear}`
    
    // Check cache first
    if (this.isCacheValid(cacheKey)) {
      const cached = this.hecsThresholdsCache.get(cacheKey)
      if (cached) {
        return cached
      }
    }

    try {
      const { prisma } = await import('@/lib/db')
      const dbThresholds = await prisma.hecsThreshold.findMany({
        where: {
          taxYear,
          isActive: true,
        },
        orderBy: {
          incomeFrom: 'asc',
        },
      })

      // Transform to domain types
      const thresholds: HecsThreshold[] = dbThresholds.map(threshold => ({
        incomeFrom: threshold.incomeFrom,
        incomeTo: threshold.incomeTo,
        rate: threshold.rate,
      }))

      // Cache the result
      this.hecsThresholdsCache.set(cacheKey, thresholds)
      this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL)

      return thresholds
    } catch (error) {
      console.error('Error loading HECS thresholds from database:', error)
      
      // Fallback to hardcoded values if database fails
      console.warn('Falling back to hardcoded HECS thresholds')
      return this.getFallbackHecsThresholds()
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
      const dbConfig = await prisma.taxRateConfig.findUnique({
        where: { taxYear },
      })

      if (!dbConfig) {
        throw new Error(`No tax configuration found for tax year ${taxYear}`)
      }

      // Get coefficients and STSL rates for this tax year
      const [coefficients, hecsThresholds, stslRates] = await Promise.all([
        this.getTaxCoefficients(taxYear),
        this.getHecsThresholds(taxYear), // legacy
        this.getStslRates(taxYear),
      ])

      // Transform to domain type
      const config: TaxRateConfig = {
        taxYear: dbConfig.taxYear,
        medicareRate: dbConfig.medicareRate,
        medicareLowIncomeThreshold: dbConfig.medicareLowIncomeThreshold,
        medicareHighIncomeThreshold: dbConfig.medicareHighIncomeThreshold,
        hecsHelpThresholds: hecsThresholds,
        stslRates,
        coefficients,
      }

      // Cache the result
      this.taxConfigCache.set(cacheKey, config)
      this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL)

      return config
    } catch (error: any) {
      console.error('Error loading tax configuration from database:', error)
      // If configuration truly not found, rethrow to allow caller/tests to handle
      if (error instanceof Error && error.message.includes('No tax configuration found')) {
        throw error
      }
      // Fallback to hardcoded values only on database failures
      console.warn('Falling back to hardcoded tax configuration')
      return this.getFallbackTaxConfig()
    }
  }

  /**
   * Clear all caches (useful for testing or when tax rates are updated)
   */
  static clearCache(): void {
    this.coefficientsCache.clear()
    this.hecsThresholdsCache.clear()
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
      this.hecsThresholdsCache.delete(key)
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

  private static getFallbackHecsThresholds(): HecsThreshold[] {
    return [
      { incomeFrom: new Decimal(51550), incomeTo: new Decimal(59518), rate: new Decimal(0.01) },
      { incomeFrom: new Decimal(59518), incomeTo: new Decimal(63090), rate: new Decimal(0.02) },
      { incomeFrom: new Decimal(63090), incomeTo: new Decimal(66662), rate: new Decimal(0.025) },
      { incomeFrom: new Decimal(66662), incomeTo: new Decimal(70235), rate: new Decimal(0.03) },
      { incomeFrom: new Decimal(70235), incomeTo: new Decimal(74808), rate: new Decimal(0.035) },
      { incomeFrom: new Decimal(74808), incomeTo: new Decimal(79381), rate: new Decimal(0.04) },
      { incomeFrom: new Decimal(79381), incomeTo: new Decimal(84981), rate: new Decimal(0.045) },
      { incomeFrom: new Decimal(84981), incomeTo: new Decimal(90554), rate: new Decimal(0.05) },
      { incomeFrom: new Decimal(90554), incomeTo: new Decimal(96127), rate: new Decimal(0.055) },
      { incomeFrom: new Decimal(96127), incomeTo: new Decimal(101700), rate: new Decimal(0.06) },
      { incomeFrom: new Decimal(101700), incomeTo: new Decimal(109177), rate: new Decimal(0.065) },
      { incomeFrom: new Decimal(109177), incomeTo: new Decimal(116653), rate: new Decimal(0.07) },
      { incomeFrom: new Decimal(116653), incomeTo: new Decimal(124130), rate: new Decimal(0.075) },
      { incomeFrom: new Decimal(124130), incomeTo: new Decimal(131607), rate: new Decimal(0.08) },
      { incomeFrom: new Decimal(131607), incomeTo: new Decimal(139083), rate: new Decimal(0.085) },
      { incomeFrom: new Decimal(139083), incomeTo: new Decimal(147560), rate: new Decimal(0.09) },
      { incomeFrom: new Decimal(147560), incomeTo: new Decimal(156037), rate: new Decimal(0.095) },
      { incomeFrom: new Decimal(156037), incomeTo: null, rate: new Decimal(0.10) },
    ]
  }

  private static getFallbackTaxConfig(): TaxRateConfig {
    return {
      taxYear: '2024-25',
      medicareRate: new Decimal(0.02),
      medicareLowIncomeThreshold: new Decimal(26000),
      medicareHighIncomeThreshold: new Decimal(32500),
      hecsHelpThresholds: this.getFallbackHecsThresholds(),
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
