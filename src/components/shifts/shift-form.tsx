'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Card, CardBody, Button, Input } from '../ui'
import {
  Calendar,
  Clock,
  DollarSign,
  Loader,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Form } from 'react-bootstrap'
import { PayCalculationResult, PayPeriodType } from '@/types'
import { BreakPeriodsInput, BreakPeriodInput } from './break-periods-input'
import { PayBreakdown } from './pay-breakdown'
import { usePreferences } from '@/hooks/use-preferences'
import { calculatePayPeriodRange } from '@/lib/pay-period-range'

interface PayGuide {
  id: string
  name: string
  baseRate: string
  description?: string
  effectiveFrom: string
  effectiveTo?: string
  timezone?: string
}

interface PayPreview {
  totalHours: string
  basePay: string
  overtimePay: string
  penaltyPay: string
  totalPay: string
}

interface ShiftFormProps {
  mode: 'create' | 'edit'
  shiftId?: string
}

interface ShiftData {
  payGuideId: string
  startTime: string
  endTime: string
  notes: string
  breakPeriods: BreakPeriodInput[]
}

const LAST_SHIFT_START_KEY = 'shift-form:last-start-time'
const LAST_SHIFT_END_KEY = 'shift-form:last-end-time'
const LAST_SHIFT_PAY_GUIDE_KEY = 'shift-form:last-pay-guide-id'

export const ShiftForm: React.FC<ShiftFormProps> = ({ mode, shiftId }) => {
  const { prefs } = usePreferences()
  const [formData, setFormData] = useState<ShiftData>({
    payGuideId: '',
    startTime: '',
    endTime: '',
    notes: '',
    breakPeriods: [],
  })

  const [payGuides, setPayGuides] = useState<PayGuide[]>([])
  const [payPreview, setPayPreview] = useState<PayPreview | null>(null)
  const [payCalculation, setPayCalculation] =
    useState<PayCalculationResult | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(mode === 'edit')
  const [initialBreakPeriods, setInitialBreakPeriods] =
    useState<BreakPeriodInput[]>([])
  const bannerRef = useRef<HTMLDivElement | null>(null)
  const lastDurationMsRef = useRef<number | null>(null)
  const fallbackShiftDurationMinutes = Math.min(
    Math.max(prefs?.defaultShiftLengthMinutes ?? 180, 15),
    24 * 60,
  )
  const fallbackShiftDurationMs = fallbackShiftDurationMinutes * 60 * 1000
  const [userContext, setUserContext] = useState<{
    payPeriodType: PayPeriodType
    timezone: string
  } | null>(null)
  const [payPeriodWarning, setPayPeriodWarning] = useState<{
    periodStart: Date
    periodEnd: Date
    effectiveFrom: Date
    effectiveTo?: Date | null
  } | null>(null)
  const [payPeriodRangeLabel, setPayPeriodRangeLabel] = useState<string>('')

  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const statusParam = searchParams.get('status')
  const [bannerStatus, setBannerStatus] = useState<'success' | 'error' | null>(
    statusParam === 'success' || statusParam === 'error' ? statusParam : null,
  )

  useEffect(() => {
    if (statusParam === 'success' || statusParam === 'error') {
      setBannerStatus(statusParam)
    } else {
      setBannerStatus(null)
    }
  }, [statusParam])

  useEffect(() => {
    if (mode === 'create' && bannerStatus) {
      bannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [bannerStatus, mode])

  // Fetch pay guides on component mount
  useEffect(() => {
    fetchUser()
    fetchPayGuides()
    if (mode === 'edit' && shiftId) {
      fetchShiftData()
    } else {
      setInitialLoading(false)
      setInitialBreakPeriods([])
    }
  }, [mode, shiftId])

  // Fetch pay preview when form data changes
  useEffect(() => {
    if (formData.payGuideId && formData.startTime && formData.endTime) {
      const timeoutId = setTimeout(() => {
        fetchPayPreview()
      }, 500) // Debounce API calls

      return () => clearTimeout(timeoutId)
    } else {
      setPayPreview(null)
      setPayCalculation(null)
    }
  }, [
    formData.payGuideId,
    formData.startTime,
    formData.endTime,
    formData.breakPeriods,
  ])

  const dismissBanner = () => {
    setBannerStatus(null)
    const entries = Array.from(searchParams.entries())
    if (entries.length === 0) return
    const params = new URLSearchParams(entries)
    params.delete('status')
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }

  const fetchPayGuides = async () => {
    try {
      const response = await fetch('/api/pay-rates?active=true&limit=50&include=metadata')
      if (response.ok) {
        const data = await response.json()
        setPayGuides(data.data?.payGuides || [])
      }
    } catch (error) {
      console.error('Failed to fetch pay guides:', error)
    }
  }

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/user')
      if (!response.ok) return
      const data = await response.json()
      if (data?.data) {
        setUserContext({
          payPeriodType: data.data.payPeriodType,
          timezone: data.data.timezone,
        })
      }
    } catch (error) {
      console.error('Failed to fetch user context:', error)
    }
  }

  // Auto-select default pay guide for new shifts if available
  useEffect(() => {
    if (mode !== 'create') return
    if (formData.payGuideId) return
    if (!prefs?.defaultPayGuideId) return
    const exists = payGuides.some((pg) => pg.id === prefs.defaultPayGuideId)
    if (exists) {
      setFormData((prev) => ({ ...prev, payGuideId: prefs.defaultPayGuideId! }))
    }
  }, [mode, prefs?.defaultPayGuideId, payGuides, formData.payGuideId])

  useEffect(() => {
    if (!formData.payGuideId) return
    if (payGuides.length === 0) return
    const exists = payGuides.some((pg) => pg.id === formData.payGuideId)
    if (!exists) {
      setFormData((prev) => ({ ...prev, payGuideId: '' }))
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(LAST_SHIFT_PAY_GUIDE_KEY)
      }
    }
  }, [formData.payGuideId, payGuides])

  const fetchShiftData = async () => {
    if (!shiftId) return

    try {
      setInitialLoading(true)
      const response = await fetch(`/api/shifts/${shiftId}`)
      if (response.ok) {
        const data = await response.json()
        const shift = data.data

        // Convert UTC dates to local datetime-local format
        const startTime = new Date(shift.startTime)
        const endTime = new Date(shift.endTime)

        const breakPeriods = (shift.breakPeriods || []).map((bp: any) => ({
          id: bp.id,
          startTime: bp.startTime,
          endTime: bp.endTime,
        }))
        setFormData({
          payGuideId: shift.payGuideId,
          startTime: formatDateTimeLocal(startTime),
          endTime: formatDateTimeLocal(endTime),
          notes: shift.notes || '',
          breakPeriods,
        })
        setInitialBreakPeriods(breakPeriods.map((bp) => ({ ...bp })))
      }
    } catch (error) {
      console.error('Failed to fetch shift data:', error)
    } finally {
      setInitialLoading(false)
    }
  }

  const fetchPayPreview = async () => {
    try {
      setPreviewLoading(true)

      // Transform break periods for API
      const breakPeriods = formData.breakPeriods
        .filter((bp) => bp.startTime && bp.endTime)
        .map((bp) => ({
          startTime: new Date(bp.startTime).toISOString(),
          endTime: new Date(bp.endTime).toISOString(),
        }))

      const response = await fetch('/api/shifts/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payGuideId: formData.payGuideId,
          startTime: new Date(formData.startTime).toISOString(),
          endTime: new Date(formData.endTime).toISOString(),
          breakPeriods,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const calculation = data.data.calculation

        // Store the complete calculation for breakdown
        setPayCalculation(calculation)

        // Transform the PayCalculationResult to PayPreview format for backward compatibility
        const preview: PayPreview = {
          totalHours: calculation.shift.totalHours.toString(),
          basePay: calculation.breakdown.basePay.toString(),
          overtimePay: calculation.breakdown.overtimePay.toString(),
          penaltyPay: calculation.breakdown.penaltyPay.toString(),
          totalPay: calculation.breakdown.totalPay.toString(),
        }

        setPayPreview(preview)
      }
    } catch (error) {
      console.error('Failed to fetch pay preview:', error)
    } finally {
      setPreviewLoading(false)
    }
  }

  const formatDateTimeLocal = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  const handleStartTimeChange = (value: string) => {
    // Always set start time
    // Adjust end time depending on whether we already have one
    setFormData((prev) => {
      const next = { ...prev, startTime: value }
      try {
        const newStart = value ? new Date(value) : null
        if (newStart && !Number.isNaN(newStart.getTime())) {
          const preservedDuration =
            lastDurationMsRef.current && lastDurationMsRef.current > 0
              ? lastDurationMsRef.current
              : null

          if (preservedDuration) {
            const newEnd = new Date(newStart.getTime() + preservedDuration)
            next.endTime = formatDateTimeLocal(newEnd)
            lastDurationMsRef.current = preservedDuration
          } else {
            const newEnd = new Date(newStart.getTime() + fallbackShiftDurationMs)
            next.endTime = formatDateTimeLocal(newEnd)
            lastDurationMsRef.current = fallbackShiftDurationMs
          }
        }
      } catch {
        // ignore parse errors; keep user's input
      }
      return next
    })
    if (errors.startTime) setErrors((prev) => ({ ...prev, startTime: '' }))
  }

  const handleEndTimeChange = (value: string) => {
    setFormData((prev) => ({ ...prev, endTime: value }))
    if (errors.endTime) setErrors((prev) => ({ ...prev, endTime: '' }))
  }

  useEffect(() => {
    if (!formData.startTime || !formData.endTime) return

    const start = new Date(formData.startTime)
    const end = new Date(formData.endTime)

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return

    const diff = end.getTime() - start.getTime()
    if (diff > 0) {
      lastDurationMsRef.current = diff
    }
  }, [formData.startTime, formData.endTime])

  useEffect(() => {
    if (!lastDurationMsRef.current || lastDurationMsRef.current <= 0) {
      lastDurationMsRef.current = fallbackShiftDurationMs
    }
  }, [fallbackShiftDurationMs])

  const formatDisplayDate = (date: Date) =>
    new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date)

  useEffect(() => {
    if (mode !== 'create') return
    const selectedGuide = formData.payGuideId
      ? payGuides.find((guide) => guide.id === formData.payGuideId)
      : null

    if (!selectedGuide || !formData.startTime || !userContext) {
      setPayPeriodWarning(null)
      setPayPeriodRangeLabel('')
      return
    }

    try {
      const startDate = new Date(formData.startTime)
      if (Number.isNaN(startDate.getTime())) {
        setPayPeriodWarning(null)
        setPayPeriodRangeLabel('')
        return
      }

      const effectiveTimezone = selectedGuide.timezone || userContext.timezone
      const { startDate: periodStart, endDate: periodEnd } =
        calculatePayPeriodRange(startDate, userContext.payPeriodType, effectiveTimezone)

      const effectiveFrom = new Date(selectedGuide.effectiveFrom)
      const effectiveTo = selectedGuide.effectiveTo
        ? new Date(selectedGuide.effectiveTo)
        : null

      const outOfRange =
        periodStart < effectiveFrom ||
        (effectiveTo !== null && periodEnd > effectiveTo)

      setPayPeriodRangeLabel(
        `${formatDisplayDate(periodStart)} – ${formatDisplayDate(periodEnd)}`,
      )

      if (outOfRange) {
        setPayPeriodWarning({
          periodStart,
          periodEnd,
          effectiveFrom,
          effectiveTo,
        })
      } else {
        setPayPeriodWarning(null)
      }
    } catch (error) {
      console.error('Failed to calculate pay period range:', error)
      setPayPeriodWarning(null)
      setPayPeriodRangeLabel('')
    }
  }, [
    mode,
    formData.payGuideId,
    formData.startTime,
    payGuides,
    userContext,
  ])

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.payGuideId) {
      newErrors.payGuideId = 'Please select a pay guide'
    }

    if (!formData.startTime) {
      newErrors.startTime = 'Start time is required'
    }

    if (!formData.endTime) {
      newErrors.endTime = 'End time is required'
    }

    if (formData.startTime && formData.endTime) {
      const start = new Date(formData.startTime)
      const end = new Date(formData.endTime)

      if (end <= start) {
        newErrors.endTime = 'End time must be after start time'
      }

      const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
      if (durationHours > 24) {
        newErrors.endTime = 'Shift cannot be longer than 24 hours'
      }
    }

    if (formData.notes && formData.notes.length > 500) {
      newErrors.notes = 'Notes cannot exceed 500 characters'
    }

    // Validate break periods
    for (let i = 0; i < formData.breakPeriods.length; i++) {
      const breakPeriod = formData.breakPeriods[i]
      if (breakPeriod.startTime && breakPeriod.endTime) {
        const start = new Date(breakPeriod.startTime)
        const end = new Date(breakPeriod.endTime)

        if (end <= start) {
          newErrors.breakPeriods = `Break ${i + 1}: End time must be after start time`
          break
        }

        if (formData.startTime && formData.endTime) {
          const shiftStart = new Date(formData.startTime)
          const shiftEnd = new Date(formData.endTime)

          if (start < shiftStart || end > shiftEnd) {
            newErrors.breakPeriods = `Break ${i + 1}: Break must be within shift time`
            break
          }
        }

        // Check for overlapping break periods
        for (let j = i + 1; j < formData.breakPeriods.length; j++) {
          const otherBreak = formData.breakPeriods[j]
          if (otherBreak.startTime && otherBreak.endTime) {
            const otherStart = new Date(otherBreak.startTime)
            const otherEnd = new Date(otherBreak.endTime)

            if (start < otherEnd && end > otherStart) {
              newErrors.breakPeriods = `Break ${i + 1} and Break ${j + 1} overlap`
              break
            }
          }
        }

        if (newErrors.breakPeriods) break
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleInputChange = (field: keyof ShiftData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }

  const createBreakPeriods = async (
    shiftId: string,
    breakPeriods: BreakPeriodInput[],
    options: { throwOnError?: boolean } = {},
  ) => {
    const { throwOnError = false } = options
    for (const breakPeriod of breakPeriods) {
      if (breakPeriod.startTime && breakPeriod.endTime) {
        try {
          const response = await fetch(`/api/shifts/${shiftId}/break-periods`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              startTime: new Date(breakPeriod.startTime).toISOString(),
              endTime: new Date(breakPeriod.endTime).toISOString(),
            }),
          })
          if (!response.ok) {
            const errorData = await response.json().catch(() => null)
            const message =
              (errorData?.errors?.[0]?.message as string | undefined) ||
              (errorData?.message as string | undefined) ||
              'Failed to create break period'
            if (throwOnError) {
              throw new Error(message)
            }
            console.error('Failed to create break period:', message)
          }
        } catch (error) {
          console.error('Failed to create break period:', error)
          if (throwOnError) {
            throw error instanceof Error
              ? error
              : new Error('Failed to create break period')
          }
        }
      }
    }
  }

  const syncBreakPeriods = async (
    shiftId: string,
    updatedBreakPeriods: BreakPeriodInput[],
  ) => {
    if (!shiftId) return

    const initialMap = new Map(
      initialBreakPeriods.map((bp) => [bp.id, { ...bp }]),
    )
    const updatedMap = new Map(
      updatedBreakPeriods.map((bp) => [bp.id, { ...bp }]),
    )

    const normalizeTime = (value?: string) =>
      value ? new Date(value).getTime() : null

    // Handle deletions
    for (const existing of initialBreakPeriods) {
      if (!updatedMap.has(existing.id)) {
        const response = await fetch(
          `/api/shifts/${shiftId}/break-periods/${existing.id}`,
          { method: 'DELETE' },
        )
        if (!response.ok) {
          const errorData = await response.json().catch(() => null)
          const message =
            (errorData?.errors?.[0]?.message as string | undefined) ||
            (errorData?.message as string | undefined) ||
            'Failed to delete break period'
          throw new Error(message)
        }
      }
    }

    // Handle updates
    for (const current of updatedBreakPeriods) {
      const baseline = initialMap.get(current.id)
      if (!baseline) continue

      const startChanged =
        normalizeTime(current.startTime) !== normalizeTime(baseline.startTime)
      const endChanged =
        normalizeTime(current.endTime) !== normalizeTime(baseline.endTime)

      if (!startChanged && !endChanged) continue

      const payload: Record<string, string> = {}
      if (current.startTime) {
        payload.startTime = new Date(current.startTime).toISOString()
      }
      if (current.endTime) {
        payload.endTime = new Date(current.endTime).toISOString()
      }

      const response = await fetch(
        `/api/shifts/${shiftId}/break-periods/${current.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        const message =
          (errorData?.errors?.[0]?.message as string | undefined) ||
          (errorData?.message as string | undefined) ||
          'Failed to update break period'
        throw new Error(message)
      }
    }

    // Handle creations
    const newBreaks = updatedBreakPeriods.filter(
      (bp) => !initialMap.has(bp.id),
    )

    if (newBreaks.length > 0) {
      await createBreakPeriods(shiftId, newBreaks, { throwOnError: true })
    }

    setInitialBreakPeriods(updatedBreakPeriods.map((bp) => ({ ...bp })))
  }

  const resetForm = (
    preserved?: Partial<Pick<ShiftData, 'startTime' | 'endTime' | 'payGuideId'>>,
  ) => {
    setFormData({
      payGuideId: preserved?.payGuideId ?? '',
      startTime: preserved?.startTime ?? '',
      endTime: preserved?.endTime ?? '',
      notes: '',
      breakPeriods: [],
    })
    setErrors({})
    setPayPreview(null)
    setPayCalculation(null)
    setPreviewLoading(false)
  }

  const bannerCopy = bannerStatus === 'success'
    ? {
        title: 'Shift saved',
        subtitle: 'Start logging a new shift below.',
      }
    : {
        title: 'Shift not saved',
        subtitle: 'There was an issue saving your shift. Please try again.',
      }

  const BannerIcon = bannerStatus === 'success' ? CheckCircle2 : AlertTriangle

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    try {
      setSubmitting(true)
      if (mode === 'create') {
        if (bannerStatus) {
          dismissBanner()
        } else if (statusParam) {
          const cleared = new URLSearchParams(Array.from(searchParams.entries()))
          cleared.delete('status')
          const clearedQuery = cleared.toString()
          router.replace(clearedQuery ? `${pathname}?${clearedQuery}` : pathname)
        }
        setBannerStatus(null)
      }

      const payload = {
        payGuideId: formData.payGuideId,
        startTime: new Date(formData.startTime).toISOString(),
        endTime: new Date(formData.endTime).toISOString(),
        notes: formData.notes || undefined,
      }

      const url = mode === 'create' ? '/api/shifts' : `/api/shifts/${shiftId}`
      const method = mode === 'create' ? 'POST' : 'PUT'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        const data = await response.json()
        const newShiftId = data.data.id

        // Create break periods after successful shift creation
        if (mode === 'create' && formData.breakPeriods.length > 0) {
          await createBreakPeriods(newShiftId, formData.breakPeriods)
        }

        if (mode === 'create') {
          if (typeof window !== 'undefined') {
            if (formData.startTime) {
              sessionStorage.setItem(LAST_SHIFT_START_KEY, formData.startTime)
            }
            if (formData.endTime) {
              sessionStorage.setItem(LAST_SHIFT_END_KEY, formData.endTime)
            } else {
              sessionStorage.removeItem(LAST_SHIFT_END_KEY)
            }
            if (formData.payGuideId) {
              sessionStorage.setItem(LAST_SHIFT_PAY_GUIDE_KEY, formData.payGuideId)
            }
          }

          resetForm({
            payGuideId: formData.payGuideId,
            startTime: formData.startTime,
            endTime: formData.endTime,
          })
          const params = new URLSearchParams(Array.from(searchParams.entries()))
          params.set('status', 'success')
          const query = params.toString()
          router.replace(query ? `${pathname}?${query}` : pathname)
          router.refresh()
        } else {
          try {
            await syncBreakPeriods(newShiftId, formData.breakPeriods)
          } catch (error) {
            console.error('Failed to sync break periods:', error)
            const message =
              error instanceof Error
                ? error.message
                : 'Failed to update break periods'
            setErrors((prev) => ({ ...prev, breakPeriods: message }))
            setBannerStatus('error')
            return
          }
          router.push(`/shifts/${newShiftId}`)
        }
      } else {
        const errorData = await response.json()
        if (errorData.errors) {
          const formErrors: Record<string, string> = {}
          errorData.errors.forEach((error: any) => {
            formErrors[error.field] = error.message
          })
          setErrors(formErrors)
        }
        setBannerStatus('error')
      }
    } catch (error) {
      console.error('Failed to save shift:', error)
      setErrors({ submit: 'Failed to save shift. Please try again.' })
      setBannerStatus('error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    if (mode === 'edit' && shiftId) {
      router.push(`/shifts/${shiftId}`)
    } else {
      router.push('/timeline')
    }
  }

  useEffect(() => {
    if (mode !== 'create') return
    if (typeof window === 'undefined') return

    const isSamePageReferrer = (() => {
      try {
        if (!document.referrer) return false
        const refUrl = new URL(document.referrer)
        return refUrl.pathname.startsWith('/shifts/new')
      } catch {
        return false
      }
    })()

    if (!isSamePageReferrer) {
      sessionStorage.removeItem(LAST_SHIFT_START_KEY)
      sessionStorage.removeItem(LAST_SHIFT_END_KEY)
      sessionStorage.removeItem(LAST_SHIFT_PAY_GUIDE_KEY)
      lastDurationMsRef.current = fallbackShiftDurationMs
      return
    }

    const storedStart = sessionStorage.getItem(LAST_SHIFT_START_KEY)
    const storedEnd = sessionStorage.getItem(LAST_SHIFT_END_KEY)
    const storedGuide = sessionStorage.getItem(LAST_SHIFT_PAY_GUIDE_KEY)

    if (!storedStart && !storedEnd && !storedGuide) return

    setFormData((prev) => {
      if (prev.startTime || prev.endTime || prev.payGuideId) return prev

      return {
        ...prev,
        payGuideId: storedGuide ?? prev.payGuideId,
        startTime: storedStart ?? prev.startTime,
        endTime: storedEnd ?? prev.endTime,
      }
    })
  }, [mode])

  if (initialLoading) {
    return (
      <Card>
        <CardBody>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2rem',
              gap: '0.5rem',
            }}
          >
            <Loader
              size={20}
              style={{ color: 'var(--color-primary)' }}
              className="spinner"
            />
            <span style={{ color: 'var(--color-text-secondary)' }}>
              Loading shift data...
            </span>
          </div>
        </CardBody>
      </Card>
    )
  }

  return (
    <Card>
      <CardBody>
        {mode === 'create' && bannerStatus && (
          <div
            ref={bannerRef}
            className={`shift-form-banner shift-form-banner--${bannerStatus}`}
            role="status"
            aria-live="polite"
          >
            <div className="shift-form-banner__body">
              <BannerIcon size={18} aria-hidden />
              <div className="shift-form-banner__text">
                <div className="shift-form-banner__title">{bannerCopy.title}</div>
                <div className="shift-form-banner__subtitle">{bannerCopy.subtitle}</div>
              </div>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={dismissBanner}>
              Dismiss
            </Button>
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
          >
            {/* Pay Guide Selection */}
            <div>
              <Form.Label
                style={{
                  color: 'var(--color-text-primary)',
                  fontWeight: '500',
                  marginBottom: '0.5rem',
                  display: 'block',
                }}
              >
                Pay Guide *
              </Form.Label>
              <Form.Select
                value={formData.payGuideId}
                onChange={(e) =>
                  handleInputChange('payGuideId', e.target.value)
                }
                style={{
                  backgroundColor: 'var(--color-surface)',
                  border: `1px solid ${errors.payGuideId ? 'var(--color-danger)' : 'var(--color-border)'}`,
                  color: 'var(--color-text-primary)',
                  borderRadius: '6px',
                  padding: '0.75rem',
                }}
              >
                <option value="">Select a pay guide</option>
                {payGuides.map((guide) => (
                  <option key={guide.id} value={guide.id}>
                    {guide.name} (${guide.baseRate}/hr)
                  </option>
                ))}
              </Form.Select>
              {errors.payGuideId && (
                <div
                  style={{
                    color: 'var(--color-danger)',
                    fontSize: '0.875rem',
                    marginTop: '0.25rem',
                  }}
                >
                  {errors.payGuideId}
                </div>
              )}
            </div>

            {/* Date and Time Inputs */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1rem',
              }}
            >
              <Input
                type="datetime-local"
                label="Start Time"
                value={formData.startTime}
                onChange={(e) => handleStartTimeChange(e.target.value)}
                error={errors.startTime}
                leftIcon={<Calendar size={16} />}
                required
              />

              <Input
                type="datetime-local"
                label="End Time"
                value={formData.endTime}
                onChange={(e) => handleEndTimeChange(e.target.value)}
                error={errors.endTime}
                leftIcon={<Clock size={16} />}
                required
              />
            </div>

            {payPeriodWarning && (
              <div
                role="alert"
                style={{
                  display: 'flex',
                  gap: '0.75rem',
                  padding: '0.85rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid var(--color-warning)',
                  backgroundColor: 'var(--color-warning-bg)',
                  color: 'var(--color-text-primary)',
                  alignItems: 'flex-start',
                }}
              >
                <AlertTriangle
                  size={18}
                  style={{ color: 'var(--color-warning)', marginTop: '0.15rem' }}
                  aria-hidden
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <strong style={{ fontSize: '0.95rem' }}>
                    Pay guide validity warning
                  </strong>
                  <span style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
                    {`The selected pay period (${payPeriodRangeLabel}) extends outside the pay guide's effective window (${formatDisplayDate(payPeriodWarning.effectiveFrom)}${payPeriodWarning.effectiveTo ? ` – ${formatDisplayDate(payPeriodWarning.effectiveTo)}` : ' onwards'}). Double-check the pay guide choice before saving.`}
                  </span>
                </div>
              </div>
            )}

            {/* Break Periods */}
            <BreakPeriodsInput
              breakPeriods={formData.breakPeriods}
              onBreakPeriodsChange={(breakPeriods) =>
                setFormData((prev) => ({ ...prev, breakPeriods }))
              }
              shiftStartTime={formData.startTime}
              shiftEndTime={formData.endTime}
              errors={errors}
            />

            {/* Pay Preview with Detailed Breakdown */}
            {(payCalculation || previewLoading) && (
              <>
                {previewLoading && (
                  <Card variant="outlined">
                    <CardBody>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          marginBottom: '1rem',
                        }}
                      >
                        <DollarSign
                          size={16}
                          style={{ color: 'var(--color-primary)' }}
                        />
                        <h4
                          style={{
                            color: 'var(--color-text-primary)',
                            margin: 0,
                            fontSize: '1rem',
                            fontWeight: '600',
                          }}
                        >
                          Pay Preview
                        </h4>
                        <Loader
                          size={16}
                          style={{ color: 'var(--color-primary)' }}
                          className="spinner"
                        />
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '2rem',
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        Calculating pay breakdown...
                      </div>
                    </CardBody>
                  </Card>
                )}

                {payCalculation && !previewLoading && (
                  <PayBreakdown
                    calculation={payCalculation}
                    isPreview={true}
                    showHeader={true}
                    defaultExpanded={false}
                  />
                )}
              </>
            )}

            {/* Notes */}
            <div>
              <Form.Label
                style={{
                  color: 'var(--color-text-primary)',
                  fontWeight: '500',
                  marginBottom: '0.5rem',
                  display: 'block',
                }}
              >
                Notes
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Add any notes about this shift..."
                style={{
                  backgroundColor: 'var(--color-surface)',
                  border: `1px solid ${errors.notes ? 'var(--color-danger)' : 'var(--color-border)'}`,
                  color: 'var(--color-text-primary)',
                  borderRadius: '6px',
                  resize: 'vertical',
                  minHeight: '80px',
                }}
              />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '0.25rem',
                }}
              >
                {errors.notes && (
                  <div
                    style={{
                      color: 'var(--color-danger)',
                      fontSize: '0.875rem',
                    }}
                  >
                    {errors.notes}
                  </div>
                )}
                <div
                  style={{
                    color: 'var(--color-text-tertiary)',
                    fontSize: '0.875rem',
                    marginLeft: 'auto',
                  }}
                >
                  {formData.notes.length}/500
                </div>
              </div>
            </div>

            {/* Submit Error */}
            {errors.submit && (
              <div
                style={{
                  color: 'var(--color-danger)',
                  textAlign: 'center',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-danger-bg)',
                  borderRadius: '6px',
                  border: '1px solid var(--color-danger)',
                }}
              >
                {errors.submit}
              </div>
            )}

            {/* Form Actions */}
            <div
              style={{
                display: 'flex',
                gap: '1rem',
                justifyContent: 'flex-end',
                flexWrap: 'wrap',
              }}
            >
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={
                  submitting ||
                  !formData.payGuideId ||
                  !formData.startTime ||
                  !formData.endTime
                }
                isLoading={submitting}
              >
                {mode === 'create' ? 'Create Shift' : 'Update Shift'}
              </Button>
            </div>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}
