'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { Globe2, Mail, User2, CalendarDays, CheckCircle2 } from 'lucide-react'
import { Card, CardBody, Button, Input } from '@/components/ui'

type PayPeriodType = 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY'

type FormValues = {
  name: string
  email: string
  timezone: string
  payPeriodType: PayPeriodType
}

const payPeriodOptions: Array<{ value: PayPeriodType; label: string; helper: string }> = [
  { value: 'WEEKLY', label: 'Weekly', helper: 'Best for consistent weekly rosters.' },
  { value: 'FORTNIGHTLY', label: 'Fortnightly', helper: 'Matches most Australian payroll cycles.' },
  { value: 'MONTHLY', label: 'Monthly', helper: 'Use when paid once per month.' },
]

export const SetupForm: React.FC = () => {
  const router = useRouter()
  const [statusLoading, setStatusLoading] = useState(true)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting, isValid },
    watch,
  } = useForm<FormValues>({
    mode: 'onChange',
    defaultValues: {
      name: '',
      email: '',
      timezone: 'Australia/Sydney',
      payPeriodType: 'WEEKLY',
    },
  })

  const selectedPayPeriod = watch('payPeriodType')

  useEffect(() => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (detected) {
        setValue('timezone', detected)
      }
    } catch {
      // Ignore timezone detection issues
    }
  }, [setValue])

  useEffect(() => {
    let isMounted = true

    const checkStatus = async () => {
      setStatusLoading(true)
      try {
        const res = await fetch('/api/setup/status', { cache: 'no-store' })
        if (!res.ok) throw new Error('Failed to load setup status')
        const data = await res.json()
        if (data?.data?.initialized && isMounted) {
          setInitialized(true)
          router.replace('/')
        }
      } catch (error) {
        console.error('Failed to check setup status', error)
        if (isMounted) {
          setGlobalError('We could not confirm the setup status. You can still try to continue below.')
        }
      } finally {
        if (isMounted) setStatusLoading(false)
      }
    }

    checkStatus()

    return () => {
      isMounted = false
    }
  }, [router])

  useEffect(() => {
    if (initialized && !statusLoading) {
      router.replace('/')
    }
  }, [initialized, router, statusLoading])

  const onSubmit = handleSubmit(async (values) => {
    setGlobalError(null)
    try {
      const res = await fetch('/api/setup/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })

      if (res.status === 409) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? 'This workspace already exists. Try signing in instead.')
      }

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? 'Initialization failed. Please try again.')
      }

      const payload = await res.json().catch(() => null)
      if (payload?.data?.initialized) {
        setInitialized(true)
        router.replace('/')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'We could not complete setup. Please try again.'
      setGlobalError(message)
      throw error
    }
  })

  const renderPayPeriodButtons = () => (
    <div className="d-flex flex-column gap-2">
      {payPeriodOptions.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant={selectedPayPeriod === option.value ? 'primary' : 'outline'}
          onClick={() => setValue('payPeriodType', option.value, { shouldDirty: true, shouldTouch: true, shouldValidate: true })}
          className="justify-content-start"
        >
          <div>
            <div className="fw-semibold d-flex align-items-center gap-2">
              <CalendarDays size={16} />
              {option.label}
            </div>
            <small className="d-block text-muted mt-1">{option.helper}</small>
          </div>
        </Button>
      ))}
    </div>
  )

  return (
    <div className="setup-page">
      <Card>
        <CardBody>
          <div className="mb-3">
            <h2 className="h4 mb-1">First-Time Setup</h2>
            <p className="text-muted mb-0">
              We’ll create your profile and defaults so the dashboard can load with accurate pay calculations.
            </p>
          </div>

          {statusLoading && (
            <div className="alert alert-info d-flex align-items-center gap-2" role="status">
              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
              <span>Checking existing setup...</span>
            </div>
          )}

          {globalError && (
            <div className="alert alert-warning" role="alert">
              {globalError}
            </div>
          )}

          <form onSubmit={onSubmit} noValidate>
            <div className="mb-3">
              <Input
                label="Your Name"
                placeholder="Jane Doe"
                leftIcon={<User2 size={16} />}
                required
                error={errors.name?.message}
                {...register('name', {
                  required: 'Name is required',
                  minLength: {
                    value: 2,
                    message: 'Name must be at least 2 characters',
                  },
                })}
              />
            </div>

            <div className="mb-3">
              <Input
                type="email"
                label="Email"
                placeholder="you@example.com"
                leftIcon={<Mail size={16} />}
                required
                error={errors.email?.message}
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'Enter a valid email address',
                  },
                })}
              />
            </div>

            <div className="mb-3">
              <label className="form-label d-block">Pay Period</label>
              {renderPayPeriodButtons()}
              <input type="hidden" value={selectedPayPeriod} {...register('payPeriodType')} />
            </div>

            <div className="mb-4">
              <Input
                label="Timezone"
                leftIcon={<Globe2 size={16} />}
                required
                error={errors.timezone?.message}
                helpText="Detected automatically—you can change it if your payroll uses a different region."
                {...register('timezone', {
                  required: 'Timezone is required',
                  minLength: { value: 2, message: 'Timezone looks too short' },
                })}
              />
            </div>

            <div className="d-grid">
              <Button
                type="submit"
                size="lg"
                isLoading={isSubmitting}
                loadingText="Setting up..."
                disabled={!isValid || isSubmitting || statusLoading}
              >
                <CheckCircle2 size={16} className="me-2" />
                Initialize and Continue
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
