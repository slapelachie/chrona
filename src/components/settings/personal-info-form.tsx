"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { Loader } from 'lucide-react'
import { Button, Card, CardBody, CardHeader, Input } from '@/components/ui'
import './settings-section.scss'

type PayPeriodType = 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY'

type User = {
  id: string
  name: string
  email: string
  timezone: string
  payPeriodType: PayPeriodType
}

const AU_TIMEZONES = [
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Brisbane',
  'Australia/Perth',
  'Australia/Adelaide',
  'Australia/Darwin',
  'Australia/Hobart',
]

const PAY_PERIOD_OPTIONS: Array<{ value: PayPeriodType; label: string; hint: string }> = [
  { value: 'WEEKLY', label: 'Weekly', hint: '52 cycles per year' },
  { value: 'FORTNIGHTLY', label: 'Fortnightly', hint: '26 cycles per year' },
  { value: 'MONTHLY', label: 'Monthly', hint: '12 cycles per year' },
]

export const PersonalInfoForm: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('/api/user', { cache: 'no-store' })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || 'Failed to load user')
        if (mounted) setUser(json.data)
      } catch (e: any) {
        if (mounted) setError(e.message)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!message) return
    const id = window.setTimeout(() => setMessage(null), 4000)
    return () => window.clearTimeout(id)
  }, [message])

  const timezoneOptions = useMemo(
    () => AU_TIMEZONES.map((tz) => ({ value: tz, label: tz })),
    []
  )

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/user', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: user.name,
          email: user.email,
          timezone: user.timezone,
          payPeriodType: user.payPeriodType,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.message || json?.error || 'Failed to save')
      setMessage('Profile updated successfully')
      setUser(json.data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="settings-section">
        <Card className="settings-section__card" variant="outlined">
          <CardBody>
            <div className="settings-section__spinner" role="status" aria-live="polite">
              <Loader size={18} />
              <span>Loading personal information...</span>
            </div>
          </CardBody>
        </Card>
      </div>
    )
  }

  if (error && !user) {
    return (
      <div className="settings-section">
        <Card className="settings-section__card" variant="outlined">
          <CardBody>
            <div className="settings-inline-feedback settings-inline-feedback--error" role="alert">
              {error}
            </div>
          </CardBody>
        </Card>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="settings-section">
      <Card className="settings-section__card" variant="outlined">
        <CardHeader>
          <div className="settings-section__header">
            <div className="settings-section__heading">
              <h3 className="settings-section__title">Personal details</h3>
              <p className="settings-section__description">
                Keep your contact details and default pay cycle up to date.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <form onSubmit={onSubmit} className="settings-form" aria-label="Personal information">
            {error && (
              <div className="settings-inline-feedback settings-inline-feedback--error" role="alert">
                {error}
              </div>
            )}
            {message && (
              <div className="settings-inline-feedback settings-inline-feedback--success" role="status">
                {message}
              </div>
            )}

            <div className="settings-form__grid">
              <Input
                label="Name"
                placeholder="Your full name"
                value={user.name}
                onChange={(e) => setUser({ ...user, name: e.target.value })}
                required
              />
              <Input
                label="Email"
                type="email"
                placeholder="you@example.com"
                value={user.email}
                onChange={(e) => setUser({ ...user, email: e.target.value })}
                required
              />
            </div>

            <div className="settings-form__grid">
              <div className="settings-field">
                <label className="settings-label" htmlFor="timezone-select">
                  Timezone
                </label>
                <select
                  id="timezone-select"
                  className="settings-select"
                  value={user.timezone}
                  onChange={(e) => setUser({ ...user, timezone: e.target.value })}
                >
                  {timezoneOptions.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="settings-field">
                <span className="settings-label">Pay period type</span>
                <div className="settings-pill-group" role="radiogroup" aria-label="Pay period type">
                  {PAY_PERIOD_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={user.payPeriodType === option.value}
                      className={`settings-pill ${user.payPeriodType === option.value ? 'settings-pill--active' : ''}`}
                      onClick={() => setUser({ ...user, payPeriodType: option.value })}
                    >
                      <span>{option.label}</span>
                      <span className="settings-pill__hint">{option.hint}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="settings-section__footer">
              <Button type="submit" isLoading={saving} loadingText="Saving">
                Save changes
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
