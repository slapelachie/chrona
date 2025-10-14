"use client"

import React from 'react'
import { Card, CardBody, CardHeader } from '@/components/ui'
import { usePreferences } from '@/hooks/use-preferences'
import './settings-section.scss'

type ToggleProps = {
  label: string
  hint?: string
  checked?: boolean
  onChange: (value: boolean) => void
}

const SettingsToggle: React.FC<ToggleProps> = ({ label, hint, checked, onChange }) => (
  <button
    type="button"
    className={`settings-toggle${checked ? ' settings-toggle--on' : ''}`}
    role="switch"
    aria-checked={!!checked}
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

export const NotificationPreferences: React.FC = () => {
  const { prefs, update } = usePreferences()

  return (
    <div className="settings-section">
      <Card className="settings-section__card" variant="outlined">
        <CardHeader>
          <div className="settings-section__header">
            <div className="settings-section__heading">
              <h3 className="settings-section__title">Notifications</h3>
              <p className="settings-section__description">
                Choose which reminders Chrona should send. These preferences are stored on this device.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <div className="settings-section__content" aria-label="Notification preferences">
            <SettingsToggle
              label="Email reminders"
              hint="Weekly summary of shifts and pay period activity"
              checked={prefs.emailReminders}
              onChange={(value) => update({ emailReminders: value })}
            />
            <SettingsToggle
              label="Pay period alerts"
              hint="Notify me when a pay period is ready to verify"
              checked={prefs.payPeriodAlerts}
              onChange={(value) => update({ payPeriodAlerts: value })}
            />
            <SettingsToggle
              label="Shift start reminders"
              hint="Send reminders one hour before shifts start"
              checked={prefs.shiftReminders}
              onChange={(value) => update({ shiftReminders: value })}
            />
            <span className="settings-list__summary">
              Notification preferences sync across browsers when you sign in with the same account.
            </span>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
