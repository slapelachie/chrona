'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardBody, Button } from '../ui'
import { 
  CheckSquare, 
  Edit3, 
  Trash2, 
  Download, 
  X, 
  AlertTriangle,
  FileText
} from 'lucide-react'
import { Form } from 'react-bootstrap'

interface ShiftItem {
  id: string
  startTime: string
  endTime: string
  totalPay?: string
  payGuide?: {
    name: string
  }
}

interface PayGuide {
  id: string
  name: string
  baseRate: string
}

interface BulkActionsProps {
  selectedShifts: string[]
  shifts: ShiftItem[]
  onSelectionChange: (selectedIds: string[]) => void
  onRefresh?: () => void
}

export const BulkActions: React.FC<BulkActionsProps> = ({ 
  selectedShifts, 
  shifts, 
  onSelectionChange,
  onRefresh 
}) => {
  const [showBulkEdit, setShowBulkEdit] = useState(false)
  const [showBulkDelete, setShowBulkDelete] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [payGuides, setPayGuides] = useState<PayGuide[]>([])
  const [loading, setLoading] = useState(false)
  const [bulkEditData, setBulkEditData] = useState({
    payGuideId: '',
    notes: '',
    updatePayGuide: false,
    updateNotes: false
  })

  useEffect(() => {
    if (showBulkEdit) {
      fetchPayGuides()
    }
  }, [showBulkEdit])

  const fetchPayGuides = async () => {
    try {
      const response = await fetch('/api/pay-rates?active=true&limit=50')
      if (response.ok) {
        const data = await response.json()
        setPayGuides(data.data?.payGuides || [])
      }
    } catch (error) {
      console.error('Failed to fetch pay guides:', error)
    }
  }

  const handleSelectAll = () => {
    const allShiftIds = shifts.map(shift => shift.id)
    onSelectionChange(allShiftIds)
  }

  const handleDeselectAll = () => {
    onSelectionChange([])
  }

  const handleBulkEdit = async () => {
    if (selectedShifts.length === 0) return
    
    try {
      setLoading(true)
      
      const updateData: any = {}
      if (bulkEditData.updatePayGuide && bulkEditData.payGuideId) {
        updateData.payGuideId = bulkEditData.payGuideId
      }
      if (bulkEditData.updateNotes) {
        updateData.notes = bulkEditData.notes || null
      }
      
      // Update each shift individually (batch API not implemented)
      const updatePromises = selectedShifts.map(shiftId => 
        fetch(`/api/shifts/${shiftId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData)
        })
      )
      
      const results = await Promise.allSettled(updatePromises)
      const failures = results.filter(result => result.status === 'rejected' || 
        (result.status === 'fulfilled' && !result.value.ok))
      
      if (failures.length === 0) {
        setShowBulkEdit(false)
        setBulkEditData({
          payGuideId: '',
          notes: '',
          updatePayGuide: false,
          updateNotes: false
        })
        onSelectionChange([])
        if (onRefresh) onRefresh()
      } else {
        alert(`Failed to update ${failures.length} shift(s). Please try again.`)
      }
    } catch (error) {
      console.error('Bulk edit failed:', error)
      alert('Bulk edit failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedShifts.length === 0) return
    
    try {
      setLoading(true)
      
      // Delete each shift individually
      const deletePromises = selectedShifts.map(shiftId => 
        fetch(`/api/shifts/${shiftId}`, { method: 'DELETE' })
      )
      
      const results = await Promise.allSettled(deletePromises)
      const failures = results.filter(result => result.status === 'rejected' || 
        (result.status === 'fulfilled' && !result.value.ok))
      
      if (failures.length === 0) {
        setShowBulkDelete(false)
        onSelectionChange([])
        if (onRefresh) onRefresh()
      } else {
        alert(`Failed to delete ${failures.length} shift(s). Please try again.`)
      }
    } catch (error) {
      console.error('Bulk delete failed:', error)
      alert('Bulk delete failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    try {
      const selectedShiftData = shifts.filter(shift => selectedShifts.includes(shift.id))
      
      // Create CSV data
      const headers = ['Date', 'Start Time', 'End Time', 'Pay Guide', 'Total Pay']
      const csvData = selectedShiftData.map(shift => {
        const startDate = new Date(shift.startTime)
        const endDate = new Date(shift.endTime)
        
        return [
          startDate.toLocaleDateString('en-AU'),
          startDate.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false }),
          endDate.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false }),
          shift.payGuide?.name || 'Unknown',
          shift.totalPay ? `$${parseFloat(shift.totalPay).toFixed(2)}` : 'N/A'
        ]
      })
      
      const csvContent = [headers, ...csvData]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n')
      
      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `shifts_export_${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      setShowExport(false)
    } catch (error) {
      console.error('Export failed:', error)
      alert('Export failed. Please try again.')
    }
  }

  if (selectedShifts.length === 0) {
    return (
      <Card variant="outlined">
        <CardBody>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            gap: '0.5rem'
          }}>
            <CheckSquare size={20} style={{ color: 'var(--color-text-tertiary)' }} />
            <p style={{ 
              color: 'var(--color-text-secondary)', 
              margin: 0,
              fontSize: '0.875rem'
            }}>
              Select shifts to perform bulk actions
            </p>
          </div>
        </CardBody>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardBody>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ color: 'var(--color-text-primary)', fontWeight: '500' }}>
                {selectedShifts.length} shift{selectedShifts.length !== 1 ? 's' : ''} selected
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  disabled={selectedShifts.length === shifts.length}
                >
                  Select All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDeselectAll}
                >
                  Deselect All
                </Button>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBulkEdit(true)}
                leftIcon={<Edit3 size={16} />}
              >
                Bulk Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowExport(true)}
                leftIcon={<Download size={16} />}
              >
                Export
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setShowBulkDelete(true)}
                leftIcon={<Trash2 size={16} />}
              >
                Bulk Delete
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Bulk Edit Modal */}
      {showBulkEdit && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <Card style={{ maxWidth: '500px', width: '100%', maxHeight: '80vh', overflow: 'auto' }}>
            <CardBody>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ color: 'var(--color-text-primary)', margin: 0 }}>
                  Bulk Edit Shifts
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowBulkEdit(false)}
                  disabled={loading}
                >
                  <X size={16} />
                </Button>
              </div>
              
              <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                Editing {selectedShifts.length} shift{selectedShifts.length !== 1 ? 's' : ''}. 
                Only check the fields you want to update.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Pay Guide Update */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <Form.Check
                      type="checkbox"
                      id="updatePayGuide"
                      checked={bulkEditData.updatePayGuide}
                      onChange={(e) => setBulkEditData(prev => ({ 
                        ...prev, 
                        updatePayGuide: e.target.checked,
                        payGuideId: e.target.checked ? prev.payGuideId : ''
                      }))}
                    />
                    <Form.Label htmlFor="updatePayGuide" style={{ 
                      color: 'var(--color-text-primary)', 
                      fontWeight: '500',
                      margin: 0
                    }}>
                      Update Pay Guide
                    </Form.Label>
                  </div>
                  {bulkEditData.updatePayGuide && (
                    <Form.Select
                      value={bulkEditData.payGuideId}
                      onChange={(e) => setBulkEditData(prev => ({ ...prev, payGuideId: e.target.value }))}
                      style={{
                        backgroundColor: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text-primary)',
                        borderRadius: '6px'
                      }}
                    >
                      <option value="">Select a pay guide</option>
                      {payGuides.map(guide => (
                        <option key={guide.id} value={guide.id}>
                          {guide.name} (${guide.baseRate}/hr)
                        </option>
                      ))}
                    </Form.Select>
                  )}
                </div>
                
                {/* Notes Update */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <Form.Check
                      type="checkbox"
                      id="updateNotes"
                      checked={bulkEditData.updateNotes}
                      onChange={(e) => setBulkEditData(prev => ({ 
                        ...prev, 
                        updateNotes: e.target.checked,
                        notes: e.target.checked ? prev.notes : ''
                      }))}
                    />
                    <Form.Label htmlFor="updateNotes" style={{ 
                      color: 'var(--color-text-primary)', 
                      fontWeight: '500',
                      margin: 0
                    }}>
                      Update Notes
                    </Form.Label>
                  </div>
                  {bulkEditData.updateNotes && (
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={bulkEditData.notes}
                      onChange={(e) => setBulkEditData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Enter notes for all selected shifts..."
                      style={{
                        backgroundColor: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text-primary)',
                        borderRadius: '6px',
                        resize: 'vertical'
                      }}
                    />
                  )}
                </div>
              </div>
              
              <div style={{ 
                display: 'flex', 
                gap: '1rem', 
                justifyContent: 'flex-end',
                marginTop: '2rem'
              }}>
                <Button
                  variant="outline"
                  onClick={() => setShowBulkEdit(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleBulkEdit}
                  isLoading={loading}
                  disabled={loading || (!bulkEditData.updatePayGuide && !bulkEditData.updateNotes)}
                >
                  Update Shifts
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Bulk Delete Modal */}
      {showBulkDelete && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <Card style={{ maxWidth: '400px', width: '100%' }}>
            <CardBody>
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <AlertTriangle size={48} style={{ color: 'var(--color-danger)', marginBottom: '1rem' }} />
                <h3 style={{ color: 'var(--color-text-primary)', margin: 0, marginBottom: '0.5rem' }}>
                  Delete {selectedShifts.length} Shift{selectedShifts.length !== 1 ? 's' : ''}
                </h3>
                <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
                  Are you sure you want to delete these shifts? This action cannot be undone.
                </p>
              </div>
              
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <Button
                  variant="outline"
                  onClick={() => setShowBulkDelete(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={handleBulkDelete}
                  isLoading={loading}
                  disabled={loading}
                >
                  Delete Shifts
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Export Modal */}
      {showExport && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <Card style={{ maxWidth: '400px', width: '100%' }}>
            <CardBody>
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <FileText size={48} style={{ color: 'var(--color-primary)', marginBottom: '1rem' }} />
                <h3 style={{ color: 'var(--color-text-primary)', margin: 0, marginBottom: '0.5rem' }}>
                  Export Shifts
                </h3>
                <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
                  Export {selectedShifts.length} shift{selectedShifts.length !== 1 ? 's' : ''} to CSV format.
                </p>
              </div>
              
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <Button
                  variant="outline"
                  onClick={() => setShowExport(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleExport}
                  leftIcon={<Download size={16} />}
                >
                  Download CSV
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </>
  )
}
