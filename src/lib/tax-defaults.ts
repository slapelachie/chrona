import { Decimal } from 'decimal.js'
import { TaxCoefficient } from '@/types'

export const DEFAULT_TAX_COEFFICIENTS: TaxCoefficient[] = [
  // Scale 2 - Claimed tax-free threshold (most common for employees)
  { scale: 'scale2', earningsFrom: new Decimal(0), earningsTo: new Decimal(371), coefficientA: new Decimal(0), coefficientB: new Decimal(0) },
  { scale: 'scale2', earningsFrom: new Decimal(371), earningsTo: new Decimal(515), coefficientA: new Decimal(0.19), coefficientB: new Decimal(70.5385) },
  { scale: 'scale2', earningsFrom: new Decimal(515), earningsTo: new Decimal(721), coefficientA: new Decimal(0.2348), coefficientB: new Decimal(93.4615) },
  { scale: 'scale2', earningsFrom: new Decimal(721), earningsTo: new Decimal(1282), coefficientA: new Decimal(0.219), coefficientB: new Decimal(82.1154) },
  { scale: 'scale2', earningsFrom: new Decimal(1282), earningsTo: new Decimal(2307), coefficientA: new Decimal(0.3477), coefficientB: new Decimal(247.1154) },
  { scale: 'scale2', earningsFrom: new Decimal(2307), earningsTo: null, coefficientA: new Decimal(0.45), coefficientB: new Decimal(482.6731) },

  // Scale 1 - Did not claim tax-free threshold
  { scale: 'scale1', earningsFrom: new Decimal(0), earningsTo: new Decimal(88), coefficientA: new Decimal(0.19), coefficientB: new Decimal(0) },
  { scale: 'scale1', earningsFrom: new Decimal(88), earningsTo: new Decimal(371), coefficientA: new Decimal(0.2348), coefficientB: new Decimal(12.7692) },
  { scale: 'scale1', earningsFrom: new Decimal(371), earningsTo: new Decimal(515), coefficientA: new Decimal(0.219), coefficientB: new Decimal(6.5385) },
  { scale: 'scale1', earningsFrom: new Decimal(515), earningsTo: new Decimal(721), coefficientA: new Decimal(0.3477), coefficientB: new Decimal(72.5385) },
  { scale: 'scale1', earningsFrom: new Decimal(721), earningsTo: new Decimal(1282), coefficientA: new Decimal(0.45), coefficientB: new Decimal(146.0769) },
  { scale: 'scale1', earningsFrom: new Decimal(1282), earningsTo: null, coefficientA: new Decimal(0.45), coefficientB: new Decimal(146.0769) },
]
