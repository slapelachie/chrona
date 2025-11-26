"use client"

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, CardBody, CardHeader, Input, Select, Toggle } from '@/components/ui'
import type {
  PayGuideListItem,
  PayGuidesListResponse,
  PublicHolidayResponse,
} from '@/types'
import { CalendarPlus, Edit3, RefreshCw, Trash2, X } from 'lucide-react'

type HolidayFormState = {
  name: string
  date: string
  isActive: boolean
}

type FormErrors = Partial<Record<'name' | 'date', string>>

type BannerState = {
  tone: 'success' | 'danger'
  message: string
} | null

const createEmptyForm = (): HolidayFormState => ({
  name: '',
  date: '',
  isActive: true,
})

const toInputDate = (isoString: string) => isoString?.split('T')[0] ?? ''

const formatDisplayDate = (isoString: string) => {
  if (!isoString) return '—'
  const parsed = new Date(isoString)
  if (Number.isNaN(parsed.getTime())) {
    return isoString.split('T')[0] ?? isoString
  }
  return parsed.toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export const PublicHolidayManager: React.FC = () => {
  const [payGuides, setPayGuides] = useState<PayGuideListItem[]>([])
  const [selectedGuideId, setSelectedGuideId] = useState('')
  const [guidesLoading, setGuidesLoading] = useState(true)
  const [guidesError, setGuidesError] = useState<string | null>(null)

  const [holidays, setHolidays] = useState<PublicHolidayResponse[]>([])
  const [holidaysLoading, setHolidaysLoading] = useState(false)
  const [holidaysError, setHolidaysError] = useState<string | null>(null)
  const [actioningId, setActioningId] = useState<string | null>(null)

  const [formState, setFormState] = useState<HolidayFormState>(() => createEmptyForm())
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [formSaving, setFormSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [banner, setBanner] = useState<BannerState>(null)

  const selectedGuide = useMemo(
    () => payGuides.find(guide => guide.id === selectedGuideId) ?? null,
    [payGuides, selectedGuideId],
  )

  const fetchPayGuides = useCallback(async () => {
    try {
      setGuidesLoading(true)
      setGuidesError(null)
      const res = await fetch('/api/pay-rates?limit=100&sortBy=name&sortOrder=asc&fields=id,name,isActive', {
        cache: 'no-store',
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(json?.message || json?.error || 'Failed to load pay guides')
      }
      const list = (json?.data as PayGuidesListResponse | undefined)?.payGuides ?? []
      setPayGuides(list)
      setSelectedGuideId(current => {
        if (current && list.some(item => item.id === current)) return current
        return list[0]?.id ?? ''
      })
    } catch (error) {
      setGuidesError(error instanceof Error ? error.message : 'Failed to load pay guides')
    } finally {
      setGuidesLoading(false)
    }
  }, [])

  const fetchPublicHolidays = useCallback(async (guideId: string) => {
    if (!guideId) return
    try {
      setHolidaysLoading(true)
      setHolidaysError(null)
      const res = await fetch(`/api/pay-rates/${guideId}/public-holidays`, { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(json?.message || json?.error || 'Failed to load public holidays')
      }
      setHolidays(Array.isArray(json?.data) ? json.data : [])
    } catch (error) {
      setHolidays([])
      setHolidaysError(error instanceof Error ? error.message : 'Failed to load public holidays')
    } finally {
      setHolidaysLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPayGuides()
  }, [fetchPayGuides])

  useEffect(() => {
    if (selectedGuideId) {
      fetchPublicHolidays(selectedGuideId)
    } else {
      setHolidays([])
    }
    setBanner(null)
    setFormErrors({})
    setFormState(createEmptyForm())
    setEditingId(null)
  }, [selectedGuideId, fetchPublicHolidays])

  const resetForm = () => {
    setFormState(createEmptyForm())
    setFormErrors({})
    setEditingId(null)
  }

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async event => {
    event.preventDefault()
    if (!selectedGuideId) return

    setFormSaving(true)
    setFormErrors({})
    setBanner(null)

    try {
      const payload = {
        name: formState.name.trim(),
        date: formState.date,
        isActive: formState.isActive,
      }

      const endpoint = editingId
        ? `/api/pay-rates/${selectedGuideId}/public-holidays/${editingId}`
        : `/api/pay-rates/${selectedGuideId}/public-holidays`

      const method = editingId ? 'PUT' : 'POST'

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json().catch(() => null)

      if (!res.ok) {
        const validationErrors = json?.errors
        if (Array.isArray(validationErrors)) {
          const fieldErrors: FormErrors = {}
          for (const err of validationErrors) {
            if (err?.field && err?.message) {
              const fieldName = err.field as keyof FormErrors
              fieldErrors[fieldName] = err.message
            }
          }
          setFormErrors(fieldErrors)
        }
        throw new Error(json?.message || json?.error || 'Failed to save public holiday')
      }

      const savedHoliday = json?.data as PublicHolidayResponse

      setHolidays(prev => {
        const next = editingId
          ? prev.map(holiday => (holiday.id === savedHoliday.id ? savedHoliday : holiday))
          : [...prev, savedHoliday]
        return next.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      })

      setBanner({
        tone: 'success',
        message: editingId ? 'Public holiday updated' : 'Public holiday added',
      })

      resetForm()
    } catch (error) {
      setBanner({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Failed to save public holiday',
      })
    } finally {
      setFormSaving(false)
    }
  }

  const startEditing = (holiday: PublicHolidayResponse) => {
    setEditingId(holiday.id)
    setFormState({
      name: holiday.name,
      date: toInputDate(holiday.date),
      isActive: holiday.isActive,
    })
    setFormErrors({})
    window?.scrollTo?.({ top: 0, behavior: 'smooth' })
  }

  const handleToggleActive = async (holiday: PublicHolidayResponse) => {
    if (!selectedGuideId) return
    setActioningId(holiday.id)
    setBanner(null)
    try {
      const res = await fetch(`/api/pay-rates/${selectedGuideId}/public-holidays/${holiday.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !holiday.isActive }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(json?.message || json?.error || 'Failed to update public holiday')
      }
      const updated = json?.data as PublicHolidayResponse
      setHolidays(prev => prev.map(item => (item.id === holiday.id ? updated : item)))
      setBanner({
        tone: 'success',
        message: `Marked as ${updated.isActive ? 'active' : 'inactive'}`,
      })
    } catch (error) {
      setBanner({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Failed to update public holiday',
      })
    } finally {
      setActioningId(null)
    }
  }

  const handleDelete = async (holiday: PublicHolidayResponse) => {
    if (!selectedGuideId) return
    const confirmed = window.confirm(`Delete ${holiday.name}? This cannot be undone.`)
    if (!confirmed) return
    setActioningId(holiday.id)
    setBanner(null)
    try {
      const res = await fetch(`/api/pay-rates/${selectedGuideId}/public-holidays/${holiday.id}`, {
        method: 'DELETE',
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(json?.message || json?.error || 'Failed to delete public holiday')
      }
      setHolidays(prev => prev.filter(item => item.id !== holiday.id))
      if (editingId === holiday.id) {
        resetForm()
      }
      setBanner({ tone: 'success', message: 'Public holiday deleted' })
    } catch (error) {
      setBanner({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Failed to delete public holiday',
      })
    } finally {
      setActioningId(null)
    }
  }

  const handleRefreshHolidays = () => {
    if (selectedGuideId) {
      fetchPublicHolidays(selectedGuideId)
    }
  }

  return (
    <div className="d-flex flex-column gap-3">
      {guidesError && (
        <Alert tone="danger" role="alert">
          {guidesError}
        </Alert>
      )}

      {banner && (
        <Alert tone={banner.tone} role={banner.tone === 'danger' ? 'alert' : 'status'}>
          {banner.message}
        </Alert>
      )}

      <Card variant="outlined">
        <CardHeader>
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div>
              <div className="fw-semibold">Select pay guide</div>
              <div className="text-secondary">Public holidays are stored per pay guide.</div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchPayGuides}
              isLoading={guidesLoading}
              leftIcon={<RefreshCw size={16} />}
            >
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <Select
            label="Pay guide"
            value={selectedGuideId}
            onChange={event => setSelectedGuideId(event.target.value)}
            disabled={guidesLoading || payGuides.length === 0}
          >
            {payGuides.length === 0 && <option value="">No pay guides found</option>}
            {payGuides.map(guide => (
              <option key={guide.id} value={guide.id}>
                {guide.name}
                {!guide.isActive ? ' (inactive)' : ''}
              </option>
            ))}
          </Select>
        </CardBody>
      </Card>

      {!selectedGuide && !guidesLoading && !guidesError && (
        <Alert tone="info">
          Add a pay guide before managing public holidays.
        </Alert>
      )}

      {selectedGuide && (
        <>
          <Card variant="outlined">
            <CardHeader>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div>
                  <div className="fw-semibold">{selectedGuide.name} · Public holidays</div>
                  <div className="text-secondary">View, edit, toggle, or delete dates.</div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleRefreshHolidays}
                  isLoading={holidaysLoading}
                  leftIcon={<RefreshCw size={16} />}
                >
                  Reload
                </Button>
              </div>
            </CardHeader>
            <CardBody>
              {holidaysError && (
                <Alert tone="danger" className="mb-3">
                  {holidaysError}
                </Alert>
              )}

              {holidaysLoading && <div>Loading public holidays…</div>}

              {!holidaysLoading && holidays.length === 0 && !holidaysError && (
                <div className="text-secondary">No public holidays recorded for this pay guide.</div>
              )}

              {!holidaysLoading && holidays.length > 0 && (
                <div className="d-flex flex-column gap-3">
                  {holidays.map(holiday => (
                    <div
                      key={holiday.id}
                      className="d-flex flex-column flex-md-row gap-2 gap-md-3 align-items-md-center justify-content-between border rounded p-3"
                    >
                      <div className="flex-grow-1">
                        <div className="fw-semibold">{holiday.name}</div>
                        <div className="text-secondary" style={{ fontSize: 13 }}>
                          {formatDisplayDate(holiday.date)} · {holiday.isActive ? 'Active' : 'Inactive'}
                        </div>
                      </div>
                      <div className="d-flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => startEditing(holiday)}
                          leftIcon={<Edit3 size={16} />}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleActive(holiday)}
                          isLoading={actioningId === holiday.id}
                        >
                          {holiday.isActive ? 'Mark inactive' : 'Mark active'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(holiday)}
                          disabled={actioningId === holiday.id}
                          leftIcon={<Trash2 size={16} />}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <Card variant="outlined">
            <CardHeader>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div>
                  <div className="fw-semibold">{editingId ? 'Edit public holiday' : 'Add a public holiday'}</div>
                  <div className="text-secondary">
                    Dates are applied only to {selectedGuide.name}.
                  </div>
                </div>
                {editingId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetForm}
                    leftIcon={<X size={16} />}
                  >
                    Cancel edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardBody>
              <form className="d-flex flex-column gap-3" onSubmit={handleSubmit}>
                <Input
                  label="Holiday name"
                  placeholder="e.g. Australia Day"
                  value={formState.name}
                  onChange={event => setFormState(prev => ({ ...prev, name: event.target.value }))}
                  required
                  error={formErrors.name}
                />

                <Input
                  type="date"
                  label="Date"
                  value={formState.date}
                  onChange={event => setFormState(prev => ({ ...prev, date: event.target.value }))}
                  required
                  error={formErrors.date}
                />

                <Toggle
                  id="holiday-active"
                  label="Active"
                  description="Inactive holidays remain on record but won't apply to new shifts."
                  checked={formState.isActive}
                  onChange={event => setFormState(prev => ({ ...prev, isActive: event.target.checked }))}
                />

                <div className="d-flex gap-2 flex-wrap">
                  <Button
                    type="submit"
                    variant="primary"
                    isLoading={formSaving}
                    leftIcon={editingId ? <Edit3 size={16} /> : <CalendarPlus size={16} />}
                  >
                    {editingId ? 'Save changes' : 'Add holiday'}
                  </Button>
                  {!editingId && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={resetForm}
                      disabled={formSaving}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </form>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  )
}

