"use client"

import React from 'react'
import { Card } from '@/components/ui'
import { usePreferences } from '@/hooks/use-preferences'

export const NotificationPreferences: React.FC = () => {
  const { prefs, update } = usePreferences()

  const Toggle: React.FC<{ label: string; checked?: boolean; onChange: (v: boolean) => void }> = ({ label, checked, onChange }) => (
    <div className="d-flex align-items-center justify-content-between p-2 rounded" style={{ background: '#121212', border: '1px solid #333' }}>
      <div className="fw-semibold">{label}</div>
      <div className="form-check form-switch m-0">
        <input className="form-check-input" type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      </div>
    </div>
  )

  return (
    <Card>
      <div className="d-flex flex-column gap-2" aria-label="Notification preferences">
        <Toggle label="Email reminders" checked={prefs.emailReminders} onChange={(v) => update({ emailReminders: v })} />
        <Toggle label="Pay period alerts" checked={prefs.payPeriodAlerts} onChange={(v) => update({ payPeriodAlerts: v })} />
        <Toggle label="Shift start reminders" checked={prefs.shiftReminders} onChange={(v) => update({ shiftReminders: v })} />
        <div className="text-secondary" style={{ fontSize: 13 }}>
          Preferences are stored locally on this device.
        </div>
      </div>
    </Card>
  )
}

