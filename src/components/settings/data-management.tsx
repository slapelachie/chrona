"use client"

import React, { useState } from 'react'
import { Button, Card } from '@/components/ui'
import { usePreferences } from '@/hooks/use-preferences'
import { ImportResult, ConflictResolution } from '@/types'

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error || `Failed: ${url}`)
  return json.data as T
}

async function downloadFromEndpoint(url: string, filename: string) {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  })
  
  if (!response.ok) {
    const contentType = response.headers.get('content-type')
    if (contentType && contentType.includes('application/json')) {
      const errorData = await response.json()
      throw new Error(errorData.error || errorData.message || 'Export failed')
    } else {
      throw new Error(`Export failed with status ${response.status}`)
    }
  }
  
  const blob = await response.blob()
  const downloadUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = downloadUrl
  a.download = filename
  a.click()
  URL.revokeObjectURL(downloadUrl)
}

export const DataManagement: React.FC = () => {
  const { reset } = usePreferences()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [newType, setNewType] = useState<'WEEKLY'|'FORTNIGHTLY'|'MONTHLY'>('WEEKLY')
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [showImportOptions, setShowImportOptions] = useState(false)
  const [conflictResolution, setConflictResolution] = useState<ConflictResolution>('skip')
  const [showSelectiveExport, setShowSelectiveExport] = useState(false)
  const [showSelectiveImport, setShowSelectiveImport] = useState(false)
  
  // Export/Import type selections
  const [exportSelections, setExportSelections] = useState({
    user: true,
    shifts: true,
    payGuides: true,
    payPeriods: true,
    taxData: true
  })
  
  const [importSelections, setImportSelections] = useState({
    user: false,
    shifts: false,
    payGuides: false,
    payPeriods: false,
    taxData: false
  })
  
  // Date filters for export
  const [exportStartDate, setExportStartDate] = useState('')
  const [exportEndDate, setExportEndDate] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)

  const exportAll = async () => {
    setBusy(true); setErr(null); setMsg(null); setImportResult(null)
    try {
      const [user, payPeriods, shifts, payGuides, taxData] = await Promise.all([
        fetchJson('/api/user'),
        fetchJson('/api/pay-periods?limit=100&include=shifts'),
        fetch('/api/export/shifts').then(r => r.json()),
        fetch('/api/export/pay-guides').then(r => r.json()),
        fetch('/api/export/tax-data').then(r => r.json()),
      ])

      const exportData = {
        user,
        payPeriods,
        shifts,
        payGuides,
        taxData,
        exportedAt: new Date().toISOString(),
        exportType: 'complete'
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `chrona-complete-export-${new Date().toISOString().slice(0,10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setMsg('Complete export successful')
    } catch (e: any) {
      setErr(e.message)
    } finally { setBusy(false) }
  }

  const exportShifts = async () => {
    setBusy(true); setErr(null); setMsg(null); setImportResult(null)
    try {
      await downloadFromEndpoint('/api/export/shifts', `chrona-shifts-${new Date().toISOString().slice(0,10)}.json`)
      setMsg('Shifts exported successfully')
    } catch (e: any) {
      setErr(e.message)
    } finally { setBusy(false) }
  }

  const exportPayGuides = async () => {
    setBusy(true); setErr(null); setMsg(null); setImportResult(null)
    try {
      await downloadFromEndpoint('/api/export/pay-guides', `chrona-pay-guides-${new Date().toISOString().slice(0,10)}.json`)
      setMsg('Pay guides exported successfully')
    } catch (e: any) {
      setErr(e.message)
    } finally { setBusy(false) }
  }

  const exportTaxData = async () => {
    setBusy(true); setErr(null); setMsg(null); setImportResult(null)
    try {
      await downloadFromEndpoint('/api/export/tax-data', `chrona-tax-data-${new Date().toISOString().slice(0,10)}.json`)
      setMsg('Tax data exported successfully')
    } catch (e: any) {
      setErr(e.message)
    } finally { setBusy(false) }
  }

  const exportSelective = async () => {
    setBusy(true); setErr(null); setMsg(null); setImportResult(null)
    try {
      const params = new URLSearchParams()
      
      // Add selected data types
      Object.entries(exportSelections).forEach(([type, selected]) => {
        if (selected) {
          params.append(`include${type.charAt(0).toUpperCase() + type.slice(1)}`, 'true')
        }
      })
      
      // Add date filters if set
      if (exportStartDate) params.append('startDate', exportStartDate)
      if (exportEndDate) params.append('endDate', exportEndDate)
      if (includeInactive) params.append('includeInactive', 'true')
      
      const url = `/api/export/selective?${params.toString()}`
      await downloadFromEndpoint(url, `chrona-selective-export-${new Date().toISOString().slice(0,10)}.json`)
      
      const selectedTypes = Object.entries(exportSelections)
        .filter(([_, selected]) => selected)
        .map(([type, _]) => type)
        .join(', ')
      
      setMsg(`Selective export successful (${selectedTypes})`)
    } catch (e: any) {
      setErr(e.message)
    } finally { setBusy(false) }
  }

  const importData = async (file: File, type: 'shifts' | 'pay-guides' | 'tax-data' | 'preferences') => {
    setBusy(true); setErr(null); setMsg(null); setImportResult(null)
    try {
      const text = await file.text()
      const json = JSON.parse(text)

      if (type === 'preferences') {
        const prefs = json?.preferences || json?.prefs
        if (prefs && typeof window !== 'undefined') {
          localStorage.setItem('chrona:prefs', JSON.stringify(prefs))
          setMsg('Preferences imported successfully')
        } else {
          setErr('No preferences found in file')
        }
        return
      }

      let endpoint = ''
      let requestData: any = {}

      switch (type) {
        case 'shifts':
          endpoint = '/api/import/shifts'
          requestData = {
            shifts: json.shifts || [],
            options: {
              conflictResolution,
              validatePayGuides: true
            }
          }
          break
        case 'pay-guides':
          endpoint = '/api/import/pay-guides'
          requestData = {
            payGuides: json.payGuides || [],
            options: {
              conflictResolution,
              activateImported: true
            }
          }
          break
        case 'tax-data':
          endpoint = '/api/import/tax-data'
          requestData = {
            taxSettings: json.taxSettings,
            taxCoefficients: json.taxCoefficients,
            hecsThresholds: json.hecsThresholds,
            stslRates: json.stslRates,
            taxRateConfigs: json.taxRateConfigs,
            options: {
              conflictResolution,
              replaceExisting: false
            }
          }
          break
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      })

      const result: ImportResult = await response.json()
      setImportResult(result)

      if (result.success) {
        setMsg(`Import successful: ${result.summary.successful} items imported, ${result.summary.skipped} skipped`)
      } else {
        setErr(`Import completed with errors: ${result.summary.failed} failed, ${result.summary.successful} successful`)
      }

    } catch (e: any) {
      setErr(e.message)
    } finally { setBusy(false) }
  }

  const importSelective = async (file: File) => {
    setBusy(true); setErr(null); setMsg(null); setImportResult(null)
    try {
      const text = await file.text()
      const json = JSON.parse(text)

      // Auto-detect available data types and update selections
      const availableTypes = []
      if (json.user) availableTypes.push('user')
      if (json.shifts?.shifts) availableTypes.push('shifts')
      if (json.payGuides?.payGuides) availableTypes.push('payGuides')
      if (json.payPeriods?.payPeriods) availableTypes.push('payPeriods')
      if (json.taxData) availableTypes.push('taxData')

      // Update import selections to show what's available
      setImportSelections({
        user: availableTypes.includes('user'),
        shifts: availableTypes.includes('shifts'),
        payGuides: availableTypes.includes('payGuides'),
        payPeriods: availableTypes.includes('payPeriods'),
        taxData: availableTypes.includes('taxData')
      })

      if (availableTypes.length === 0) {
        setErr('No recognized data types found in the file')
        return
      }

      // Get only selected types for import
      const selectedTypes = Object.entries(importSelections)
        .filter(([_, selected]) => selected)
        .map(([type, _]) => type)

      if (selectedTypes.length === 0) {
        setErr('Please select at least one data type to import')
        return
      }

      const requestData = {
        data: json,
        options: {
          conflictResolution,
          selectedTypes,
          importSettings: {
            validatePayGuides: true,
            activateImported: true,
            replaceExisting: false
          }
        }
      }

      const response = await fetch('/api/import/selective', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      })

      const result: ImportResult = await response.json()
      setImportResult(result)

      if (result.success) {
        setMsg(`Selective import successful: ${result.summary.successful} items imported, ${result.summary.skipped} skipped`)
      } else {
        setErr(`Import completed with errors: ${result.summary.failed} failed, ${result.summary.successful} successful`)
      }

    } catch (e: any) {
      setErr(e.message)
    } finally { setBusy(false) }
  }

  const ImportResultDisplay = ({ result }: { result: ImportResult }) => (
    <div className="mt-3 p-3" style={{ backgroundColor: '#2a2a2a', borderRadius: '8px', fontSize: '13px' }}>
      <div className="fw-semibold mb-2">Import Results</div>
      <div className="mb-2">
        <span className="text-success">✓ {result.summary.successful} successful</span>
        {result.summary.skipped > 0 && <span className="text-warning ms-3">⊘ {result.summary.skipped} skipped</span>}
        {result.summary.failed > 0 && <span className="text-danger ms-3">✗ {result.summary.failed} failed</span>}
      </div>

      {result.created.length > 0 && (
        <div className="mb-2">
          <div className="text-success fw-semibold">Created:</div>
          <ul className="mb-0 ps-3">
            {result.created.slice(0, 5).map((item, i) => <li key={i}>{item}</li>)}
            {result.created.length > 5 && <li>...and {result.created.length - 5} more</li>}
          </ul>
        </div>
      )}

      {result.updated.length > 0 && (
        <div className="mb-2">
          <div className="text-info fw-semibold">Updated:</div>
          <ul className="mb-0 ps-3">
            {result.updated.slice(0, 5).map((item, i) => <li key={i}>{item}</li>)}
            {result.updated.length > 5 && <li>...and {result.updated.length - 5} more</li>}
          </ul>
        </div>
      )}

      {result.errors.length > 0 && (
        <div className="mb-2">
          <div className="text-danger fw-semibold">Errors:</div>
          <ul className="mb-0 ps-3">
            {result.errors.slice(0, 3).map((error, i) => (
              <li key={i}>{error.field}: {error.message}</li>
            ))}
            {result.errors.length > 3 && <li>...and {result.errors.length - 3} more errors</li>}
          </ul>
        </div>
      )}

      {result.warnings.length > 0 && (
        <div>
          <div className="text-warning fw-semibold">Warnings:</div>
          <ul className="mb-0 ps-3">
            {result.warnings.slice(0, 3).map((warning, i) => (
              <li key={i}>{warning.field}: {warning.message}</li>
            ))}
            {result.warnings.length > 3 && <li>...and {result.warnings.length - 3} more warnings</li>}
          </ul>
        </div>
      )}
    </div>
  )

  return (
    <Card>
      <div className="d-flex flex-column gap-4">
        {err && <div role="alert" style={{ color: '#F44336' }}>{err}</div>}
        {msg && <div aria-live="polite" style={{ color: '#00E5FF' }}>{msg}</div>}

        {/* Export Section */}
        <div>
          <div className="fw-semibold mb-2">Export Data</div>
          
          <div className="d-flex gap-2 flex-wrap mb-3">
            <Button onClick={exportAll} disabled={busy} size="sm">
              {busy ? 'Exporting…' : 'Complete Export'}
            </Button>
            <Button onClick={() => setShowSelectiveExport(!showSelectiveExport)} variant="outline-primary" size="sm">
              {showSelectiveExport ? 'Hide' : 'Show'} Selective Export
            </Button>
            <Button onClick={exportShifts} disabled={busy} variant="outline-secondary" size="sm">
              Export Shifts Only
            </Button>
            <Button onClick={exportPayGuides} disabled={busy} variant="outline-secondary" size="sm">
              Export Pay Guides Only
            </Button>
            <Button onClick={exportTaxData} disabled={busy} variant="outline-secondary" size="sm">
              Export Tax Data Only
            </Button>
          </div>

          {showSelectiveExport && (
            <div className="p-3 mb-3" style={{ backgroundColor: '#2a2a2a', borderRadius: '8px' }}>
              <div className="fw-semibold mb-2">Choose Data to Export</div>
              
              <div className="row mb-3">
                {Object.entries(exportSelections).map(([type, selected]) => (
                  <div key={type} className="col-6 col-md-4 mb-2">
                    <label className="d-flex align-items-center">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(e) => setExportSelections(prev => ({ ...prev, [type]: e.target.checked }))}
                        className="me-2"
                      />
                      {type === 'payGuides' ? 'Pay Guides' : 
                       type === 'payPeriods' ? 'Pay Periods' : 
                       type === 'taxData' ? 'Tax Data' :
                       type.charAt(0).toUpperCase() + type.slice(1)}
                    </label>
                  </div>
                ))}
              </div>

              <div className="row mb-3">
                <div className="col-md-6 mb-2">
                  <label className="form-label" style={{ fontSize: '13px' }}>Start Date (optional)</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={exportStartDate}
                    onChange={(e) => setExportStartDate(e.target.value)}
                  />
                </div>
                <div className="col-md-6 mb-2">
                  <label className="form-label" style={{ fontSize: '13px' }}>End Date (optional)</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={exportEndDate}
                    onChange={(e) => setExportEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="d-flex align-items-center">
                  <input
                    type="checkbox"
                    checked={includeInactive}
                    onChange={(e) => setIncludeInactive(e.target.checked)}
                    className="me-2"
                  />
                  Include inactive pay guides
                </label>
              </div>

              <Button onClick={exportSelective} disabled={busy || !Object.values(exportSelections).some(Boolean)} size="sm">
                {busy ? 'Exporting…' : 'Export Selected Data'}
              </Button>
            </div>
          )}

          <div className="text-secondary" style={{ fontSize: 13 }}>
            Use selective export to choose exactly what data to include and apply date filters.
          </div>
        </div>

        <hr style={{ borderColor: '#333' }} />

        {/* Import Section */}
        <div>
          <div className="fw-semibold mb-2">Import Data</div>
          
          <div className="d-flex gap-2 flex-wrap mb-3">
            <Button 
              variant="outline-secondary" 
              size="sm" 
              onClick={() => setShowImportOptions(!showImportOptions)}
            >
              {showImportOptions ? 'Hide' : 'Show'} Import Options
            </Button>
            <Button 
              variant="outline-primary" 
              size="sm" 
              onClick={() => setShowSelectiveImport(!showSelectiveImport)}
            >
              {showSelectiveImport ? 'Hide' : 'Show'} Selective Import
            </Button>
          </div>

          {showImportOptions && (
            <div className="mb-3 p-3" style={{ backgroundColor: '#2a2a2a', borderRadius: '8px' }}>
              <div className="fw-semibold mb-2">Conflict Resolution</div>
              <div className="d-flex gap-2 flex-wrap">
                <label className="d-flex align-items-center">
                  <input 
                    type="radio" 
                    name="conflictResolution" 
                    value="skip" 
                    checked={conflictResolution === 'skip'}
                    onChange={(e) => setConflictResolution(e.target.value as ConflictResolution)}
                    className="me-2"
                  />
                  Skip duplicates
                </label>
                <label className="d-flex align-items-center">
                  <input 
                    type="radio" 
                    name="conflictResolution" 
                    value="overwrite" 
                    checked={conflictResolution === 'overwrite'}
                    onChange={(e) => setConflictResolution(e.target.value as ConflictResolution)}
                    className="me-2"
                  />
                  Overwrite existing
                </label>
                <label className="d-flex align-items-center">
                  <input 
                    type="radio" 
                    name="conflictResolution" 
                    value="rename" 
                    checked={conflictResolution === 'rename'}
                    onChange={(e) => setConflictResolution(e.target.value as ConflictResolution)}
                    className="me-2"
                  />
                  Rename duplicates
                </label>
              </div>
            </div>
          )}

          {showSelectiveImport && (
            <div className="mb-3 p-3" style={{ backgroundColor: '#2a2a2a', borderRadius: '8px' }}>
              <div className="fw-semibold mb-2">Selective Import</div>
              <div className="mb-3">
                <label className="btn btn-primary btn-sm" style={{ cursor: 'pointer' }}>
                  Choose Export File to Import
                  <input 
                    type="file" 
                    accept="application/json" 
                    onChange={(e) => e.target.files?.[0] && importSelective(e.target.files[0])} 
                    style={{ display: 'none' }} 
                    disabled={busy}
                  />
                </label>
              </div>
              
              <div className="fw-semibold mb-2">Select Data Types to Import</div>
              <div className="row mb-3">
                {Object.entries(importSelections).map(([type, selected]) => (
                  <div key={type} className="col-6 col-md-4 mb-2">
                    <label className="d-flex align-items-center">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(e) => setImportSelections(prev => ({ ...prev, [type]: e.target.checked }))}
                        className="me-2"
                      />
                      {type === 'payGuides' ? 'Pay Guides' : 
                       type === 'payPeriods' ? 'Pay Periods' : 
                       type === 'taxData' ? 'Tax Data' :
                       type.charAt(0).toUpperCase() + type.slice(1)}
                    </label>
                  </div>
                ))}
              </div>
              
              <div className="text-secondary" style={{ fontSize: 13 }}>
                When you select a file, available data types will be automatically detected and checkboxes will be updated.
              </div>
            </div>
          )}

          <div className="fw-semibold mb-2">Individual Import Options</div>
          <div className="d-flex gap-2 flex-wrap mb-2">
            <label className="btn btn-outline-primary btn-sm" style={{ cursor: 'pointer' }}>
              Import Shifts Only
              <input 
                type="file" 
                accept="application/json" 
                onChange={(e) => e.target.files?.[0] && importData(e.target.files[0], 'shifts')} 
                style={{ display: 'none' }} 
                disabled={busy}
              />
            </label>
            <label className="btn btn-outline-primary btn-sm" style={{ cursor: 'pointer' }}>
              Import Pay Guides Only
              <input 
                type="file" 
                accept="application/json" 
                onChange={(e) => e.target.files?.[0] && importData(e.target.files[0], 'pay-guides')} 
                style={{ display: 'none' }} 
                disabled={busy}
              />
            </label>
            <label className="btn btn-outline-primary btn-sm" style={{ cursor: 'pointer' }}>
              Import Tax Data Only
              <input 
                type="file" 
                accept="application/json" 
                onChange={(e) => e.target.files?.[0] && importData(e.target.files[0], 'tax-data')} 
                style={{ display: 'none' }} 
                disabled={busy}
              />
            </label>
            <label className="btn btn-outline-secondary btn-sm" style={{ cursor: 'pointer' }}>
              Import Preferences Only
              <input 
                type="file" 
                accept="application/json" 
                onChange={(e) => e.target.files?.[0] && importData(e.target.files[0], 'preferences')} 
                style={{ display: 'none' }} 
                disabled={busy}
              />
            </label>
          </div>
          <div className="text-secondary" style={{ fontSize: 13 }}>
            Individual imports work with single data type exports. Use selective import for complete control over multi-type exports.
          </div>

          {importResult && <ImportResultDisplay result={importResult} />}
        </div>

        <hr style={{ borderColor: '#333' }} />

        {/* Local Preferences */}
        <div>
          <div className="fw-semibold mb-2">Local Settings</div>
          <Button variant="secondary" size="sm" onClick={() => { reset(); setMsg('Local preferences cleared') }}>
            Clear Local Preferences
          </Button>
          <div className="text-secondary mt-2" style={{ fontSize: 13 }}>
            This only clears browser-stored preferences, not your account data.
          </div>
        </div>

        <hr style={{ borderColor: '#333' }} />

        {/* Pay Period Transformation */}
        <div>
          <div className="fw-semibold mb-2">Transform Pay Periods</div>
          <div className="text-secondary mb-2" style={{ fontSize: 13 }}>
            Change between weekly, fortnightly, and monthly. Existing shifts will be reassigned to new periods and totals recalculated.
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <select className="form-select" value={newType} onChange={e => setNewType(e.target.value as any)} style={{ width: 'auto' }}>
              <option value="WEEKLY">Weekly</option>
              <option value="FORTNIGHTLY">Fortnightly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
            <Button
              variant="primary"
              size="sm"
              disabled={busy}
              onClick={async () => {
                if (!confirm(`Transform all pay periods to ${newType}? This will recalculate and may take a moment.`)) return
                setBusy(true); setErr(null); setMsg(null); setImportResult(null)
                try {
                  const res = await fetch('/api/pay-periods/transform', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newPayPeriodType: newType, cleanup: true })
                  })
                  const json = await res.json()
                  if (!res.ok) throw new Error(json?.error || json?.message || 'Failed to transform')
                  setMsg(`Transformed: moved ${json.data.movedShifts} shifts; affected ${json.data.affectedPayPeriods} periods; removed ${json.data.removedEmptyPayPeriods} empty.`)
                } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
              }}
            >
              {busy ? 'Transforming…' : 'Transform'}
            </Button>
          </div>
          <div className="text-warning mt-2" style={{ color: '#FFC107', fontSize: 13 }}>
            Tip: Export a backup before transforming.
          </div>
        </div>
      </div>
    </Card>
  )
}
