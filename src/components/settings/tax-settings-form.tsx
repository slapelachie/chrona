"use client"

import React, { useEffect, useState } from 'react'
import { Loader } from 'lucide-react'
import { Button, Card, CardBody, CardHeader } from '@/components/ui'
import './settings-section.scss'

type TaxSettings = {
  id: string
  claimedTaxFreeThreshold: boolean
  isForeignResident: boolean
  hasTaxFileNumber: boolean
  medicareExemption: 'none' | 'half' | 'full'
  hecsHelpRate?: string
}

const SettingsToggle: React.FC<{
  label: string
  hint?: string
  checked: boolean
  onChange: (value: boolean) => void
}> = ({ label, hint, checked, onChange }) => (
  <button
    type="button"
    className={`settings-toggle${checked ? ' settings-toggle--on' : ''}`}
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
  >
    <span className="settings-toggle__label">
      <span className="settings-toggle__title">{label}</span>
      {hint && <span className="settings-toggle__hint">{hint}</span>}
    </span>
    <span className="settings-toggle__control" aria-hidden>
      <span className="settings-toggle__thumb" />
    </span>
  </button>
)

export const TaxSettingsForm: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [data, setData] = useState<TaxSettings | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('/api/tax-settings', { cache: 'no-store' })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || 'Failed to load tax settings')
        if (mounted) setData(json.data)
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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!data) return
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/tax-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimedTaxFreeThreshold: data.claimedTaxFreeThreshold,
          isForeignResident: data.isForeignResident,
          hasTaxFileNumber: data.hasTaxFileNumber,
          medicareExemption: data.medicareExemption,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.message || json?.error || 'Failed to save settings')
      setMessage('Tax settings updated')
      setData(json.data)
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
              <span>Loading tax settings...</span>
            </div>
          </CardBody>
        </Card>
      </div>
    )
  }

  if (error && !data) {
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

  if (!data) return null

  return (
    <div className="settings-section">
      <Card className="settings-section__card" variant="outlined">
        <CardHeader>
          <div className="settings-section__header">
            <div className="settings-section__heading">
              <h3 className="settings-section__title">PAYG settings</h3>
              <p className="settings-section__description">
                These options are used when calculating PAYG and Medicare withholding for each pay period.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <form onSubmit={onSubmit} className="settings-form" aria-label="Tax settings">
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

            <div className="settings-section__content">
              <SettingsToggle
                label="Tax file number provided"
                checked={data.hasTaxFileNumber}
                onChange={(value) => setData({ ...data, hasTaxFileNumber: value })}
              />
              <SettingsToggle
                label="Claim tax-free threshold"
                hint="Reduces PAYG withholding if eligible"
                checked={data.claimedTaxFreeThreshold}
                onChange={(value) => setData({ ...data, claimedTaxFreeThreshold: value })}
              />
              <SettingsToggle
                label="Foreign resident"
                hint="Applies non-resident PAYG rates"
                checked={data.isForeignResident}
                onChange={(value) => setData({ ...data, isForeignResident: value })}
              />

              <div className="settings-field">
                <label className="settings-label" htmlFor="medicare-exemption">
                  Medicare exemption
                </label>
                <select
                  id="medicare-exemption"
                  className="settings-select"
                  value={data.medicareExemption}
                  onChange={(e) => setData({ ...data, medicareExemption: e.target.value as TaxSettings['medicareExemption'] })}
                >
                  <option value="none">None</option>
                  <option value="half">Half</option>
                  <option value="full">Full</option>
                </select>
              </div>

              {data.hecsHelpRate && (
                <div className="settings-inline-feedback settings-inline-feedback--info">
                  HECS-HELP repayment rate: {Number(data.hecsHelpRate).toFixed(2)}%
                </div>
              )}
            </div>

            <div className="settings-section__footer">
              <Button type="submit" isLoading={saving} loadingText="Saving">
                Save settings
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
