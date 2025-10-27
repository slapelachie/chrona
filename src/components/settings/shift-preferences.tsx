"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { Card, CardBody, CardHeader, Button, Input } from '@/components/ui'
import { usePreferences } from '@/hooks/use-preferences'
import './settings-section.scss'

const MIN_MINUTES = 15
const MAX_MINUTES = 24 * 60
const PRESET_HOURS = [1, 2, 3, 4, 6, 8]

const clampMinutes = (value: number) =>
  Math.min(Math.max(value, MIN_MINUTES), MAX_MINUTES)

const snapMinutes = (value: number) => {
  const snapped = Math.round(value / 15) * 15
  return clampMinutes(snapped)
}

const minutesToHours = (minutes: number) => minutes / 60

const formatDuration = (minutes: number) => {
  const clamped = clampMinutes(minutes)
  const hours = Math.floor(clamped / 60)
  const mins = clamped % 60
  if (mins === 0) {
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`
  }
  if (hours === 0) {
    return `${mins} minutes`
  }
  return `${hours} ${hours === 1 ? 'hour' : 'hours'} ${mins} mins`
}

export const ShiftPreferences: React.FC = () => {
  const { prefs, update, loading, error } = usePreferences()
  const storedMinutes = clampMinutes(prefs.defaultShiftLengthMinutes ?? 180)

  const [hoursValue, setHoursValue] = useState(() => minutesToHours(storedMinutes))
  const [status, setStatus] = useState<'idle' | 'saved'>('idle')

  useEffect(() => {
    const minutes = clampMinutes(prefs.defaultShiftLengthMinutes ?? 180)
    setHoursValue(minutesToHours(minutes))
  }, [prefs.defaultShiftLengthMinutes])

  useEffect(() => {
    if (status !== 'saved') return
    const id = window.setTimeout(() => setStatus('idle'), 2200)
    return () => window.clearTimeout(id)
  }, [status])

  const minutesValue = useMemo(() => snapMinutes(Math.round(hoursValue * 60)), [hoursValue])
  const hasChanges = minutesValue !== storedMinutes
  const friendlyLabel = useMemo(() => formatDuration(minutesValue), [minutesValue])

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = Number(event.target.value)
    if (Number.isNaN(raw)) {
      setHoursValue(minutesToHours(storedMinutes))
      setStatus('idle')
      return
    }
    const clampedHours = Math.min(Math.max(raw, MIN_MINUTES / 60), MAX_MINUTES / 60)
    setHoursValue(clampedHours)
    setStatus('idle')
  }

  const applyPreset = (hours: number) => {
    setHoursValue(Math.min(Math.max(hours, MIN_MINUTES / 60), MAX_MINUTES / 60))
    setStatus('idle')
  }

  const handleSave = () => {
    const normalizedMinutes = snapMinutes(Math.round(hoursValue * 60))
    update({ defaultShiftLengthMinutes: normalizedMinutes })
    setStatus('saved')
  }

  return (
    <div className="settings-section">
      <Card className="settings-section__card" variant="outlined">
        <CardHeader>
          <div className="settings-section__header">
            <div className="settings-section__heading">
              <h3 className="settings-section__title">Shift defaults</h3>
              <p className="settings-section__description">
                Set the default shift length used when Chrona suggests an end time.
              </p>
            </div>
            <span className="settings-section__badge" aria-live="polite">
              Current: {friendlyLabel}
            </span>
          </div>
        </CardHeader>
        <CardBody>
          <div className="settings-section__content">
            <div className="settings-form__grid">
              <div className="settings-field">
                <span className="settings-label">Default shift length (hours)</span>
                <Input
                  type="number"
                  min={MIN_MINUTES / 60}
                  max={MAX_MINUTES / 60}
                  step={0.25}
                  value={Number(hoursValue.toFixed(2))}
                  onChange={handleInputChange}
                  aria-describedby="default-shift-length-help"
                  disabled={loading}
                />
                <span id="default-shift-length-help" className="settings-inline-help">
                  {friendlyLabel} · saved in 15-minute increments, max 24 hours.
                </span>
              </div>
            </div>

            <div className="settings-section__spacer" role="group" aria-label="Quick shift length presets">
              {PRESET_HOURS.map((hours) => {
                const isActive = Math.abs(hoursValue - hours) < 0.011
                return (
                  <Button
                    key={hours}
                    size="sm"
                    variant={isActive ? 'secondary' : 'outline'}
                    onClick={() => applyPreset(hours)}
                  >
                    {hours}h
                  </Button>
                )
              })}
            </div>

            <div className="settings-section__spacer">
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={!hasChanges || loading}
                onClick={handleSave}
              >
                Save default
              </Button>
              {error && (
                <span className="settings-inline-feedback settings-inline-feedback--error" role="alert">
                  {error}
                </span>
              )}
              {status === 'saved' && !error && (
                <span className="settings-inline-feedback settings-inline-feedback--success" role="status">
                  Default shift length updated
                </span>
              )}
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
