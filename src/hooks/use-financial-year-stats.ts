'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FinancialYearStatisticsResponse } from '@/types'

function buildTaxYearOptions(count = 5): string[] {
  const now = new Date()
  const baseYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1
  const options: string[] = []
  for (let i = 0; i < count; i += 1) {
    const startYear = baseYear - i
    const endSuffix = String((startYear + 1) % 100).padStart(2, '0')
    options.push(`${startYear}-${endSuffix}`)
  }
  return options
}

export function useFinancialYearStats(defaultTaxYear?: string) {
  const [taxYear, setTaxYear] = useState<string | undefined>(defaultTaxYear)
  const [data, setData] = useState<FinancialYearStatisticsResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (ty?: string) => {
    setLoading(true)
    setError(null)
    try {
      const query = ty ? `?taxYear=${encodeURIComponent(ty)}` : ''
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
  }, [])

  useEffect(() => {
    load(taxYear)
  }, [load, taxYear])

  const availableTaxYears = useMemo(() => {
    const options = buildTaxYearOptions(6)
    if (data?.taxYear && !options.includes(data.taxYear)) {
      return [data.taxYear, ...options]
    }
    return options
  }, [data?.taxYear])

  const refresh = useCallback((override?: string) => {
    load(override ?? taxYear)
  }, [load, taxYear])

  return {
    data,
    loading,
    error,
    taxYear: taxYear ?? data?.taxYear,
    setTaxYear,
    refresh,
    availableTaxYears,
  }
}
