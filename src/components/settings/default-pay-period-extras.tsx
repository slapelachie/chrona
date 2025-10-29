"use client"

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardBody, CardHeader, Button, Input } from '@/components/ui'
import { Form } from 'react-bootstrap'
import { Plus, Save, Trash2, X, Edit, GripVertical } from 'lucide-react'

type Template = {
  id: string
  userId: string
  label: string
  description?: string
  amount: string
  taxable: boolean
  active: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

type TemplateFormState = {
  label: string
  description: string
  amount: string
  taxable: boolean
  active: boolean
  sortOrder: number
}

const EMPTY_FORM: TemplateFormState = {
  label: '',
  description: '',
  amount: '',
  taxable: true,
  active: true,
  sortOrder: 0,
}

export const DefaultPayPeriodExtrasSettings: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formState, setFormState] = useState<TemplateFormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editState, setEditState] = useState<TemplateFormState | null>(null)
  const [editSaving, setEditSaving] = useState(false)

  const sortedTemplates = useMemo(
    () =>
      [...templates].sort((a, b) => {
        if (a.sortOrder === b.sortOrder) {
          return a.createdAt.localeCompare(b.createdAt)
        }
        return a.sortOrder - b.sortOrder
      }),
    [templates]
  )

  const fetchTemplates = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/pay-periods/default-extras', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load defaults')
      const json = await res.json()
      setTemplates(json.data || [])
    } catch (err: any) {
      setError(err.message || 'Unable to load default extras')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTemplates()
  }, [])

  const resetForm = useCallback(() => {
    setFormState({ ...EMPTY_FORM, sortOrder: templates.length })
  }, [templates.length])

  useEffect(() => {
    resetForm()
  }, [resetForm])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const payload = {
        label: formState.label.trim(),
        description: formState.description.trim() || undefined,
        amount: formState.amount,
        taxable: formState.taxable,
        active: formState.active,
        sortOrder: Number.isFinite(formState.sortOrder) ? formState.sortOrder : 0,
      }

      const res = await fetch('/api/pay-periods/default-extras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json?.message || 'Failed to save default extra')
      }

      setTemplates(prev => [...prev, json.data])
      resetForm()
    } catch (err: any) {
      setError(err.message || 'Failed to save default extra')
    } finally {
      setSaving(false)
    }
  }

  const startEditing = (template: Template) => {
    setEditingId(template.id)
    setEditState({
      label: template.label,
      description: template.description || '',
      amount: template.amount,
      taxable: template.taxable,
      active: template.active,
      sortOrder: template.sortOrder,
    })
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditState(null)
  }

  const handleUpdate = async (template: Template) => {
    if (!editState) return
    setEditSaving(true)
    setError(null)
    try {
      const payload: Record<string, unknown> = {}
      if (editState.label.trim() !== template.label) payload.label = editState.label.trim()
      const desc = editState.description.trim()
      if ((desc || undefined) !== template.description) payload.description = desc || null
      if (editState.amount !== template.amount) payload.amount = editState.amount
      if (editState.taxable !== template.taxable) payload.taxable = editState.taxable
      if (editState.active !== template.active) payload.active = editState.active
      if (editState.sortOrder !== template.sortOrder) payload.sortOrder = editState.sortOrder

      if (Object.keys(payload).length === 0) {
        cancelEditing()
        return
      }

      const res = await fetch(`/api/pay-periods/default-extras/${template.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json?.message || 'Failed to update default extra')
      }

      setTemplates(prev => prev.map(item => item.id === template.id ? json.data : item))
      cancelEditing()
    } catch (err: any) {
      setError(err.message || 'Failed to update default extra')
    } finally {
      setEditSaving(false)
    }
  }

  const handleDelete = async (templateId: string) => {
    if (!confirm('Delete this default extra?')) return
    setError(null)
    try {
      const res = await fetch(`/api/pay-periods/default-extras/${templateId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.message || 'Failed to delete default extra')
      }

      setTemplates(prev => prev.filter(item => item.id !== templateId))
    } catch (err: any) {
      setError(err.message || 'Failed to delete default extra')
    }
  }

  return (
    <div className="d-flex flex-column gap-3">
      <Card variant="outlined">
        <CardHeader>
          <div className="d-flex flex-column gap-1">
            <div className="fw-semibold">Default extras</div>
            <div className="text-secondary" style={{ fontSize: 13 }}>
              These extras will be added automatically whenever a new pay period is created. You can edit or remove them per pay period if needed.
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleCreate} className="d-flex flex-column gap-3">
            <div className="d-flex flex-column gap-2">
              <Input
                label="Label"
                placeholder="e.g. Laundry allowance"
                value={formState.label}
                onChange={(e) => setFormState(prev => ({ ...prev, label: e.target.value }))}
                required
              />
              <Input
                label="Description (optional)"
                placeholder="Short note visible when reviewing pay periods"
                value={formState.description}
                onChange={(e) => setFormState(prev => ({ ...prev, description: e.target.value }))}
              />
              <div className="d-flex flex-wrap gap-3">
                <Input
                  label="Amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formState.amount}
                  onChange={(e) => setFormState(prev => ({ ...prev, amount: e.target.value }))}
                  required
                  style={{ maxWidth: 180 }}
                />
                <Input
                  label="Sort order"
                  type="number"
                  value={formState.sortOrder.toString()}
                  onChange={(e) => {
                    const value = e.target.value
                    setFormState(prev => ({ ...prev, sortOrder: value === '' ? 0 : Number(value) }))
                  }}
                  style={{ maxWidth: 160 }}
                />
              </div>
              <div className="d-flex flex-wrap gap-4">
                <Form.Check
                  type="switch"
                  id="default-extra-taxable"
                  label="Taxable"
                  checked={formState.taxable}
                  onChange={(e) => setFormState(prev => ({ ...prev, taxable: e.target.checked }))}
                />
                <Form.Check
                  type="switch"
                  id="default-extra-active"
                  label="Active"
                  checked={formState.active}
                  onChange={(e) => setFormState(prev => ({ ...prev, active: e.target.checked }))}
                />
              </div>
            </div>
            <div className="d-flex gap-2 justify-content-end">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                leftIcon={<Plus size={16} />}
                isLoading={saving}
              >
                Add Default Extra
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      <Card variant="ghost" className="d-flex flex-column gap-2">
        <CardHeader>
          <div className="d-flex align-items-center justify-content-between">
            <div className="fw-semibold">Existing defaults</div>
            <div className="text-secondary" style={{ fontSize: 13 }}>
              Active defaults are applied when pay periods are created.
            </div>
          </div>
        </CardHeader>
        <CardBody>
          {loading ? (
            <div>Loading…</div>
          ) : sortedTemplates.length === 0 ? (
            <div className="text-secondary" style={{ fontSize: 13 }}>No default extras configured yet.</div>
          ) : (
            <div className="d-flex flex-column gap-2">
              {sortedTemplates.map(template => {
                const isEditing = editingId === template.id && editState
                return (
                  <Card key={template.id} variant="outlined" padding="sm">
                    <CardBody>
                      {isEditing ? (
                        <div className="d-flex flex-column gap-3">
                          <div className="d-flex align-items-center gap-2 text-secondary" style={{ fontSize: 12 }}>
                            <GripVertical size={14} /> ID: {template.id}
                          </div>
                          <Input
                            label="Label"
                            value={editState.label}
                            onChange={(e) => setEditState(prev => prev ? ({ ...prev, label: e.target.value }) : prev)}
                            required
                          />
                          <Input
                            label="Description"
                            value={editState.description}
                            onChange={(e) => setEditState(prev => prev ? ({ ...prev, description: e.target.value }) : prev)}
                          />
                          <div className="d-flex flex-wrap gap-3">
                            <Input
                              label="Amount"
                              type="number"
                              step="0.01"
                              value={editState.amount}
                              onChange={(e) => setEditState(prev => prev ? ({ ...prev, amount: e.target.value }) : prev)}
                              required
                              style={{ maxWidth: 160 }}
                            />
                            <Input
                              label="Sort order"
                              type="number"
                              value={editState.sortOrder.toString()}
                              onChange={(e) => {
                                const value = e.target.value
                                setEditState(prev => prev ? ({ ...prev, sortOrder: value === '' ? 0 : Number(value) }) : prev)
                              }}
                              style={{ maxWidth: 140 }}
                            />
                          </div>
                          <div className="d-flex flex-wrap gap-4">
                            <Form.Check
                              type="switch"
                              id={`template-${template.id}-taxable`}
                              label="Taxable"
                              checked={editState.taxable}
                              onChange={(e) => setEditState(prev => prev ? ({ ...prev, taxable: e.target.checked }) : prev)}
                            />
                            <Form.Check
                              type="switch"
                              id={`template-${template.id}-active`}
                              label="Active"
                              checked={editState.active}
                              onChange={(e) => setEditState(prev => prev ? ({ ...prev, active: e.target.checked }) : prev)}
                            />
                          </div>
                          <div className="d-flex gap-2 justify-content-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={cancelEditing}
                              leftIcon={<X size={16} />}
                              disabled={editSaving}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => handleUpdate(template)}
                              isLoading={editSaving}
                              leftIcon={<Save size={16} />}
                            >
                              Save changes
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="d-flex flex-column gap-2">
                          <div className="d-flex justify-content-between align-items-center">
                            <div>
                              <div className="fw-semibold d-flex align-items-center gap-2">
                                {template.label}
                                {!template.active && (
                                  <span className="badge bg-secondary" style={{ fontSize: 11 }}>Inactive</span>
                                )}
                                {!template.taxable && (
                                  <span className="badge bg-info" style={{ fontSize: 11 }}>Non-taxable</span>
                                )}
                              </div>
                              {template.description && (
                                <div className="text-secondary" style={{ fontSize: 13 }}>{template.description}</div>
                              )}
                            </div>
                            <div className="text-aqua fw-semibold">${parseFloat(template.amount).toFixed(2)}</div>
                          </div>
                          <div className="d-flex justify-content-between align-items-center text-secondary" style={{ fontSize: 12 }}>
                            <div>Sort order #{template.sortOrder}</div>
                            <div className="d-flex gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                leftIcon={<Edit size={16} />}
                                onClick={() => startEditing(template)}
                              >
                                Edit
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                leftIcon={<Trash2 size={16} />}
                                onClick={() => handleDelete(template.id)}
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardBody>
                  </Card>
                )
              })}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
