"use client"

import React, { useEffect, useState } from 'react'
import { Button, Input, Card } from '@/components/ui'

type User = {
  id: string
  name: string
  email: string
  timezone: string
  payPeriodType: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY'
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
    return () => { mounted = false }
  }, [])

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
      setMessage('Saved successfully')
      setUser(json.data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div>Loading...</div>
  if (error) return <div role="alert" aria-live="polite" style={{ color: '#F44336' }}>{error}</div>
  if (!user) return null

  return (
    <Card>
      <form onSubmit={onSubmit} aria-label="Personal Information">
        <div className="mb-3">
          <label className="form-label">Name</label>
          <Input
            value={user.name}
            onChange={(e) => setUser({ ...user, name: e.target.value })}
            placeholder="Your full name"
            required
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Email</label>
          <Input
            type="email"
            value={user.email}
            onChange={(e) => setUser({ ...user, email: e.target.value })}
            placeholder="you@example.com"
            required
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Timezone</label>
          <select
            className="form-select"
            value={user.timezone}
            onChange={(e) => setUser({ ...user, timezone: e.target.value })}
          >
            {AU_TIMEZONES.map(tz => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>
        <div className="mb-4">
          <label className="form-label">Pay Period Type</label>
          <div className="d-flex gap-2 flex-wrap">
            {(['WEEKLY','FORTNIGHTLY','MONTHLY'] as const).map(opt => (
              <label key={opt} className="d-flex align-items-center gap-2">
                <input
                  type="radio"
                  name="payPeriodType"
                  checked={user.payPeriodType === opt}
                  onChange={() => setUser({ ...user, payPeriodType: opt })}
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="d-flex gap-2">
          <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          {message && <span aria-live="polite" style={{ color: '#00E5FF' }}>{message}</span>}
        </div>
      </form>
    </Card>
  )
}

