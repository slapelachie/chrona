'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardBody, Button, Input } from '@/components/ui'
import { Globe2, Mail, User2, CalendarDays, CheckCircle2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

type PayPeriodType = 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY'

export const SetupForm: React.FC = () => {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [timezone, setTimezone] = useState('Australia/Sydney')
  const [payPeriodType, setPayPeriodType] = useState<PayPeriodType>('WEEKLY')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (tz) setTimezone(tz)
    } catch { /* noop */ }
    // Check status in case of race conditions
    fetch('/api/setup/status').then(r => r.json()).then(res => {
      if (res?.data?.initialized) setInitialized(true)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (initialized) router.replace('/')
  }, [initialized, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/setup/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, timezone, payPeriodType })
      })
      if (!res.ok) throw new Error('Failed to initialize')
      setInitialized(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Initialization failed'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="setup-page">
      <Card>
        <CardBody>
          <div className="mb-3">
            <h2 className="h4 mb-1">First-Time Setup</h2>
            <p className="text-muted mb-0">We’ll create your profile so the dashboard can load.</p>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <Input label="Your Name" placeholder="Jane Doe" value={name} onChange={e => setName(e.target.value)} leftIcon={<User2 size={16} />} required />
            </div>
            <div className="mb-3">
              <Input type="email" label="Email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} leftIcon={<Mail size={16} />} required />
            </div>
            <div className="mb-3">
              <label className="form-label d-block">Pay Period</label>
              <div className="d-flex gap-2">
                {(['WEEKLY','FORTNIGHTLY','MONTHLY'] as PayPeriodType[]).map(v => (
                  <Button key={v} type="button" variant={payPeriodType === v ? 'primary' : 'outline'} onClick={() => setPayPeriodType(v)}>
                    <CalendarDays size={16} className="me-1" /> {v.charAt(0) + v.slice(1).toLowerCase()}
                  </Button>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <Input label="Timezone" value={timezone} onChange={e => setTimezone(e.target.value)} leftIcon={<Globe2 size={16} />} required />
              <div className="form-text">Detected from your browser; change if needed.</div>
            </div>

            {error && <div className="alert alert-danger" role="alert">{error}</div>}

            <div className="d-grid">
              <Button type="submit" size="lg" isLoading={loading} loadingText="Setting up...">
                <CheckCircle2 size={16} className="me-2" /> Initialize and Continue
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
