'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FinancialYearStatisticsResponse } from '@/types'

export type QuarterFilterValue = 'all' | '1' | '2' | '3' | '4'

interface LoadOverrides {
  taxYear?: string
  quarter?: QuarterFilterValue
}

export function useFinancialYearStats(defaultTaxYear?: string) {
  const [taxYear, setTaxYear] = useState<string | undefined>(defaultTaxYear)
  const [quarter, setQuarter] = useState<QuarterFilterValue>('all')
  const [data, setData] = useState<FinancialYearStatisticsResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (overrides?: LoadOverrides) => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        const resolvedTaxYear = overrides?.taxYear ?? taxYear ?? defaultTaxYear ?? ''
        if (resolvedTaxYear) {
          params.set('taxYear', resolvedTaxYear)
        }
        const resolvedQuarter = overrides?.quarter ?? quarter
        if (resolvedQuarter && resolvedQuarter !== 'all') {
          params.set('quarter', resolvedQuarter)
        }
        const query = params.toString() ? `?${params.toString()}` : ''
        const res = await fetch(`/api/statistics/financial-year${query}`, { cache: 'no-store' })
        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`)
        }
        const json = await res.json()
        setData(json.data as FinancialYearStatisticsResponse)
      } catch (err) {
        console.error('Failed to load financial year statistics', err)
        setError('Unable to load statistics right now.')
        setData(null)
      } finally {
        setLoading(false)
      }
    },
    [taxYear, quarter, defaultTaxYear]
  )

  useEffect(() => {
    load()
  }, [load])

  const availableTaxYears = useMemo(() => {
    const fromResponse = data?.availableTaxYears ?? []
    if (fromResponse.length > 0) {
      return fromResponse
    }
    if (taxYear) {
      return [taxYear]
    }
    return []
  }, [data?.availableTaxYears, taxYear])

  const refresh = useCallback(
    (overrideTaxYear?: string, overrideQuarter?: QuarterFilterValue) => {
      load({
        taxYear: overrideTaxYear ?? taxYear ?? defaultTaxYear,
        quarter: overrideQuarter ?? quarter,
      })
    },
    [load, taxYear, quarter, defaultTaxYear]
  )

  return {
    data,
    loading,
    error,
    taxYear: taxYear ?? data?.taxYear,
    setTaxYear,
    quarter,
    setQuarter,
    refresh,
    availableTaxYears,
  }
}
