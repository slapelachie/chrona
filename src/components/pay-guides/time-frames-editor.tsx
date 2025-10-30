"use client"

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Card, CardBody, Input, Select, Toggle, Alert } from '@/components/ui'
import './pay-guides.scss'
import {
  CreateOvertimeTimeFrameRequest,
  CreatePenaltyTimeFrameRequest,
  OvertimeTimeFrameResponse,
  PenaltyTimeFrameResponse,
} from '@/types'

type BaseFormState = {
  name: string
  dayOfWeek?: number
  startTime?: string
  endTime?: string
  description?: string
  isPublicHoliday: boolean
  isActive: boolean
}

type OvertimeFormState = BaseFormState & {
  firstThreeHoursMult: string
  afterThreeHoursMult: string
}

type PenaltyFormState = BaseFormState & {
  multiplier: string
}

type Variant = 'overtime' | 'penalty'

const DAY_OPTIONS: Array<{ label: string; value?: number }> = [
  { label: 'All days' },
  { label: 'Monday', value: 1 },
  { label: 'Tuesday', value: 2 },
  { label: 'Wednesday', value: 3 },
  { label: 'Thursday', value: 4 },
  { label: 'Friday', value: 5 },
  { label: 'Saturday', value: 6 },
  { label: 'Sunday', value: 0 },
]

const getDayLabel = (dayOfWeek?: number | null) => {
  if (dayOfWeek === null || dayOfWeek === undefined) return 'All days'
  const option = DAY_OPTIONS.find(option => option.value === dayOfWeek)
  return option?.label ?? 'All days'
}

interface VariantConfig<FormState extends BaseFormState, Row extends { name: string }> {
  resourcePath: string
  title: string
  subtitle: string
  initialForm: () => FormState
  mapRowToForm: (row: Row) => FormState
  buildCreatePayload: (form: FormState) => CreatePenaltyTimeFrameRequest | CreateOvertimeTimeFrameRequest
  sanitizePatch: (patch: Partial<FormState>) => Partial<CreatePenaltyTimeFrameRequest> | Partial<CreateOvertimeTimeFrameRequest>
  renderCreateFields: (form: FormState, setForm: React.Dispatch<React.SetStateAction<FormState>>) => React.ReactNode[]
  renderEditFields: (edit: FormState, setEdit: React.Dispatch<React.SetStateAction<FormState>>) => React.ReactNode[]
  renderViewColumns: (row: Row) => React.ReactNode[]
  columnTemplate: string
  canCreate: (form: FormState) => boolean
}

const overtimeConfig: VariantConfig<OvertimeFormState, OvertimeTimeFrameResponse> = {
  resourcePath: 'overtime-time-frames',
  title: 'Overtime Time Frames',
  subtitle: 'Tiered multipliers after regular hours',
  initialForm: () => ({
    name: '',
    firstThreeHoursMult: '1.50',
    afterThreeHoursMult: '2.00',
    dayOfWeek: undefined,
    startTime: '',
    endTime: '',
    description: '',
    isPublicHoliday: false,
    isActive: true,
  }),
  mapRowToForm: (row) => ({
    name: row.name,
    firstThreeHoursMult: row.firstThreeHoursMult,
    afterThreeHoursMult: row.afterThreeHoursMult,
    dayOfWeek: row.dayOfWeek ?? undefined,
    startTime: row.startTime ?? '',
    endTime: row.endTime ?? '',
    description: row.description ?? '',
    isPublicHoliday: row.isPublicHoliday ?? false,
    isActive: row.isActive,
  }),
  buildCreatePayload: (form) => ({
    name: form.name,
    firstThreeHoursMult: form.firstThreeHoursMult,
    afterThreeHoursMult: form.afterThreeHoursMult,
    dayOfWeek: form.dayOfWeek,
    startTime: form.startTime ? form.startTime : undefined,
    endTime: form.endTime ? form.endTime : undefined,
    isPublicHoliday: form.isPublicHoliday,
    description: form.description ? form.description : undefined,
    isActive: form.isActive,
  }),
  sanitizePatch: (patch) => ({
    ...patch,
    startTime: patch.startTime ? patch.startTime : undefined,
    endTime: patch.endTime ? patch.endTime : undefined,
    description: patch.description ? patch.description : undefined,
  }),
  renderCreateFields: (form, setForm) => [
    <Input
      key="firstThreeHours"
      label="First 3h Mult"
      type="number"
      min={1}
      step={0.05}
      value={form.firstThreeHoursMult}
      onChange={event => setForm(prev => ({ ...prev, firstThreeHoursMult: event.target.value }))}
    />,
    <Input
      key="afterThreeHours"
      label=">3h Mult"
      type="number"
      min={1}
      step={0.05}
      value={form.afterThreeHoursMult}
      onChange={event => setForm(prev => ({ ...prev, afterThreeHoursMult: event.target.value }))}
    />,
  ],
  renderEditFields: (edit, setEdit) => [
    <Input
      key="firstThreeHours"
      label="First 3h Mult"
      type="number"
      min={1}
      step={0.05}
      value={edit.firstThreeHoursMult}
      onChange={event => setEdit(prev => ({ ...prev, firstThreeHoursMult: event.target.value }))}
    />,
    <Input
      key="afterThreeHours"
      label=">3h Mult"
      type="number"
      min={1}
      step={0.05}
      value={edit.afterThreeHoursMult}
      onChange={event => setEdit(prev => ({ ...prev, afterThreeHoursMult: event.target.value }))}
    />,
  ],
  renderViewColumns: (row) => [
    `1st3h x${Number(row.firstThreeHoursMult).toFixed(2)}`,
    `>3h x${Number(row.afterThreeHoursMult).toFixed(2)}`,
    getDayLabel(row.dayOfWeek ?? null),
    row.startTime || '—',
    row.endTime || '—',
  ],
  columnTemplate: '1.2fr 0.8fr 0.8fr 0.8fr 0.6fr 0.6fr auto',
  canCreate: (form) => Boolean(form.name && form.firstThreeHoursMult && form.afterThreeHoursMult),
}

const penaltyConfig: VariantConfig<PenaltyFormState, PenaltyTimeFrameResponse> = {
  resourcePath: 'penalty-time-frames',
  title: 'Penalty Time Frames',
  subtitle: 'Weekend/evening/public-holiday loadings',
  initialForm: () => ({
    name: '',
    multiplier: '1.25',
    dayOfWeek: undefined,
    startTime: '',
    endTime: '',
    description: '',
    isPublicHoliday: false,
    isActive: true,
  }),
  mapRowToForm: (row) => ({
    name: row.name,
    multiplier: row.multiplier,
    dayOfWeek: row.dayOfWeek ?? undefined,
    startTime: row.startTime ?? '',
    endTime: row.endTime ?? '',
    description: row.description ?? '',
    isPublicHoliday: row.isPublicHoliday ?? false,
    isActive: row.isActive,
  }),
  buildCreatePayload: (form) => ({
    name: form.name,
    multiplier: form.multiplier,
    dayOfWeek: form.dayOfWeek,
    isPublicHoliday: form.isPublicHoliday,
    startTime: form.startTime ? form.startTime : undefined,
    endTime: form.endTime ? form.endTime : undefined,
    description: form.description ? form.description : undefined,
    isActive: form.isActive,
  }),
  sanitizePatch: (patch) => ({
    ...patch,
    startTime: patch.startTime ? patch.startTime : undefined,
    endTime: patch.endTime ? patch.endTime : undefined,
    description: patch.description ? patch.description : undefined,
  }),
  renderCreateFields: (form, setForm) => [
    <Input
      key="multiplier"
      label="Multiplier"
      type="number"
      min={1}
      step={0.05}
      value={form.multiplier}
      onChange={event => setForm(prev => ({ ...prev, multiplier: event.target.value }))}
    />,
  ],
  renderEditFields: (edit, setEdit) => [
    <Input
      key="multiplier"
      label="Multiplier"
      type="number"
      min={1}
      step={0.05}
      value={edit.multiplier}
      onChange={event => setEdit(prev => ({ ...prev, multiplier: event.target.value }))}
    />,
  ],
  renderViewColumns: (row) => [
    `x${Number(row.multiplier).toFixed(2)}`,
    getDayLabel(row.dayOfWeek ?? null),
    row.startTime || '—',
    row.endTime || '—',
    <span key="description" className="text-secondary" style={{ fontSize: 13 }}>
      {row.description || ''}
    </span>,
  ],
  columnTemplate: '1.2fr 0.6fr 0.8fr 0.6fr 0.6fr 1fr auto',
  canCreate: (form) => Boolean(form.name && form.multiplier),
}

const variantConfigs = {
  overtime: overtimeConfig,
  penalty: penaltyConfig,
} as const

type VariantConfigFor<V extends Variant> = typeof variantConfigs[V]
type FormStateFor<V extends Variant> = ReturnType<VariantConfigFor<V>['initialForm']>
type RowFor<V extends Variant> = Parameters<VariantConfigFor<V>['mapRowToForm']>[0]

type Props<V extends Variant> = {
  payGuideId: string
  variant: V
}

export function TimeFramesEditor<V extends Variant>({ payGuideId, variant }: Props<V>) {
  const config = variantConfigs[variant]
  type FormState = FormStateFor<V>
  type Row = RowFor<V>

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [query, setQuery] = useState('')
  const [form, setForm] = useState<FormState>(() => config.initialForm() as unknown as FormState)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [edit, setEdit] = useState<FormState | null>(null)

  const updateEdit = useCallback<React.Dispatch<React.SetStateAction<FormState>>>(
    (updater) => {
      setEdit(prev => {
        const base = prev ?? (config.initialForm() as unknown as FormState)
        if (typeof updater === 'function') {
          return (updater as (current: FormState) => FormState)(base)
        }
        return updater
      })
    },
    [config],
  )

  const resourceBase = `/api/pay-rates/${payGuideId}/${config.resourcePath}`

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(resourceBase)
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        const message = json?.error || json?.message || 'Failed to load time frames'
        throw new Error(message)
      }
      setRows((json?.data as Row[]) ?? [])
      setError(null)
    } catch (err) {
      setRows([])
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to load time frames')
      }
    } finally {
      setLoading(false)
    }
  }, [resourceBase])

  useEffect(() => {
    setForm(config.initialForm() as unknown as FormState)
    setEditId(null)
    setEdit(null)
    fetchRows()
  }, [config, fetchRows])

  const filteredRows = useMemo(
    () =>
      rows.filter(row => {
        const name = (row as { name?: string }).name ?? ''
        return name.toLowerCase().includes(query.toLowerCase())
      }),
    [rows, query],
  )

  const create = async () => {
    setSaving(true)
    setError(null)
    try {
      const payload = config.buildCreatePayload(form as any)
      const res = await fetch(resourceBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        const message = json?.message || json?.error || 'Create failed'
        throw new Error(message)
      }
      setForm(config.initialForm() as unknown as FormState)
      await fetchRows()
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to create time frame')
      }
    } finally {
      setSaving(false)
    }
  }

  const save = async (id: string, patch: Partial<FormState>) => {
    try {
      const sanitized = config.sanitizePatch(patch as any)
      const res = await fetch(`${resourceBase}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sanitized),
      })
      if (!res.ok) {
        let message = 'Update failed'
        try {
          const json = await res.json()
          message = json?.message || json?.error || message
        } catch {
          try {
            message = await res.text()
          } catch {
            // ignore parsing issues
          }
        }
        throw new Error(message)
      }
      setEditId(null)
      setEdit(null)
      await fetchRows()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Update failed')
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this time frame?')) return
    const res = await fetch(`${resourceBase}/${id}`, { method: 'DELETE' })
    if (res.ok) {
      await fetchRows()
    } else {
      try {
        const json = await res.json()
        alert(json?.message || json?.error || 'Delete failed')
      } catch {
        alert('Delete failed')
      }
    }
  }

  return (
    <div className="d-flex flex-column gap-3">
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <div className="fw-semibold">{config.title}</div>
          <div className="text-secondary" style={{ fontSize: 13 }}>{config.subtitle}</div>
        </div>
        <Input placeholder="Search…" value={query} onChange={event => setQuery(event.target.value)} />
      </div>

      <Card variant="elevated">
        <CardBody>
          <div className="d-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <Input
              label="Name"
              value={form.name}
              onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))}
            />
            {config.renderCreateFields(form as any, setForm as any).map((node, index) => (
              <React.Fragment key={index}>{node}</React.Fragment>
            ))}
            <Select
              label="Day"
              value={form.dayOfWeek ?? ''}
              onChange={event => {
                const value = event.target.value
                setForm(prev => ({ ...prev, dayOfWeek: value === '' ? undefined : Number(value) }))
              }}
            >
              {DAY_OPTIONS.map(option => (
                <option key={option.label} value={option.value ?? ''}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Input
              label="Start (HH:MM)"
              placeholder="18:00"
              value={form.startTime || ''}
              onChange={event => setForm(prev => ({ ...prev, startTime: event.target.value }))}
            />
            <Input
              label="End (HH:MM)"
              placeholder="06:00"
              value={form.endTime || ''}
              onChange={event => setForm(prev => ({ ...prev, endTime: event.target.value }))}
            />
            <Input
              label="Description"
              value={form.description || ''}
              onChange={event => setForm(prev => ({ ...prev, description: event.target.value }))}
            />
            <Toggle
              className="align-self-end"
              label="Active"
              checked={form.isActive}
              onChange={event => setForm(prev => ({ ...prev, isActive: event.target.checked }))}
            />
            <Toggle
              className="align-self-end"
              label="Public holiday"
              checked={form.isPublicHoliday}
              onChange={event => setForm(prev => ({ ...prev, isPublicHoliday: event.target.checked }))}
            />
            <div className="align-self-end">
              <Button onClick={create} disabled={saving || !config.canCreate(form as any)}>
                {saving ? 'Saving…' : 'Add'}
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {loading && <div>Loading…</div>}
      {error && (
        <Alert tone="danger" role="alert">
          {error}
        </Alert>
      )}

      <div className="d-flex flex-column gap-2">
        {filteredRows.map(row => {
          const isEditing = editId === row.id
          return (
            <Card key={row.id} variant="elevated">
              {!isEditing ? (
                <CardBody
                  className="d-grid"
                  style={{ gridTemplateColumns: config.columnTemplate, gap: '0.75rem', alignItems: 'center' }}
                >
                  <div className="fw-semibold" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {row.name}
                    <span className={`pay-guides__chip ${row.isActive ? 'pay-guides__chip--positive' : 'pay-guides__chip--neutral'}`}>
                      {row.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {(row as OvertimeTimeFrameResponse | PenaltyTimeFrameResponse).isPublicHoliday && (
                      <span className="pay-guides__chip pay-guides__chip--info">Public holiday</span>
                    )}
                  </div>
                  {config.renderViewColumns(row as any).map((content, index) => (
                    <div key={index}>{content}</div>
                  ))}
                  <div className="d-flex gap-2 justify-content-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => save(row.id, { isActive: !row.isActive } as Partial<FormState>)}
                    >
                      {row.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setEditId(row.id)
                        setEdit(config.mapRowToForm(row as any) as any)
                      }}
                    >
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(row.id)}>
                      Delete
                    </Button>
                  </div>
                </CardBody>
              ) : (
                <CardBody
                  className="d-grid"
                  style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}
                >
                  <Input
                    label="Name"
                    value={edit?.name || ''}
                    onChange={event => updateEdit(prev => ({ ...prev, name: event.target.value }))}
                  />
                  {config
                    .renderEditFields((edit ?? config.initialForm()) as any, updateEdit as any)
                    .map((field, index) => (
                      <React.Fragment key={index}>{field}</React.Fragment>
                    ))}
                  <Select
                    label="Day"
                    value={edit?.dayOfWeek ?? ''}
                    onChange={event => {
                      const value = event.target.value
                      updateEdit(prev => ({ ...prev, dayOfWeek: value === '' ? undefined : Number(value) }))
                    }}
                  >
                    {DAY_OPTIONS.map(option => (
                      <option key={option.label} value={option.value ?? ''}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                  <Input
                    label="Start (HH:MM)"
                    value={edit?.startTime || ''}
                    onChange={event => updateEdit(prev => ({ ...prev, startTime: event.target.value }))}
                  />
                  <Input
                    label="End (HH:MM)"
                    value={edit?.endTime || ''}
                    onChange={event => updateEdit(prev => ({ ...prev, endTime: event.target.value }))}
                  />
                  <Input
                    label="Description"
                    value={edit?.description || ''}
                    onChange={event => updateEdit(prev => ({ ...prev, description: event.target.value }))}
                  />
                  <Toggle
                    className="align-self-end"
                    label="Active"
                    checked={edit?.isActive ?? true}
                    onChange={event => updateEdit(prev => ({ ...prev, isActive: event.target.checked }))}
                  />
                  <Toggle
                    className="align-self-end"
                    label="Public holiday"
                    checked={edit?.isPublicHoliday ?? false}
                    onChange={event => updateEdit(prev => ({ ...prev, isPublicHoliday: event.target.checked }))}
                  />
                  <div className="align-self-end d-flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => edit && save(row.id, edit as Partial<FormState>)}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditId(null)
                        setEdit(null)
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardBody>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
