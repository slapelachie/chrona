"use client"

import React, { useMemo, useState } from 'react'
import JSZip from 'jszip'
import { Button, Card, CardHeader, CardBody, CardFooter } from '@/components/ui'
import { usePreferences } from '@/hooks/use-preferences'
import { ImportResult, ConflictResolution } from '@/types'
import {
  parseShiftsCsv,
  parsePayGuidesCsv,
  parseTaxDataFiles
} from '@/lib/import-csv'

async function downloadFromEndpoint(url: string, filename: string) {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'text/csv,application/zip,*/*'
    }
  })

  if (!response.ok) {
    const contentType = response.headers.get('content-type')
    if (contentType && contentType.includes('application/json')) {
      const errorData = await response.json()
      throw new Error(errorData.error || errorData.message || 'Export failed')
    }
    throw new Error(`Export failed with status ${response.status}`)
  }

  const blob = await response.blob()
  const downloadUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = downloadUrl
  a.download = filename
  a.click()
  URL.revokeObjectURL(downloadUrl)
}

type DataTypeKey = 'shifts' | 'payGuides' | 'taxData'

type DataSelectionState = Record<DataTypeKey, boolean>

type ShiftsPayload = ReturnType<typeof parseShiftsCsv>['shifts']
type PayGuidesPayload = ReturnType<typeof parsePayGuidesCsv>['payGuides']
type TaxDataPayload = ReturnType<typeof parseTaxDataFiles>

type PendingSelectiveImport = {
  data: {
    shifts?: { shifts: ShiftsPayload }
    payGuides?: { payGuides: PayGuidesPayload }
    taxData?: TaxDataPayload
  }
  availableTypes: DataTypeKey[]
}

const formatTypeLabel = (type: DataTypeKey) => {
  switch (type) {
    case 'payGuides':
      return 'Pay Guides'
    case 'taxData':
      return 'Tax Data'
    default:
      return 'Shifts'
  }
}

const conflictLabels: Record<ConflictResolution, string> = {
  skip: 'Skip duplicates',
  overwrite: 'Overwrite existing',
  rename: 'Rename duplicates'
}

const createEmptySelections = (): DataSelectionState => ({
  shifts: false,
  payGuides: false,
  taxData: false
})

export const DataManagement: React.FC = () => {
  const { reset } = usePreferences()

  const [exportSelections, setExportSelections] = useState<DataSelectionState>({
    shifts: true,
    payGuides: true,
    taxData: true
  })
  const [exportStartDate, setExportStartDate] = useState('')
  const [exportEndDate, setExportEndDate] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [exporting, setExporting] = useState(false)

  const [conflictResolution, setConflictResolution] = useState<ConflictResolution>('skip')
  const [pendingImport, setPendingImport] = useState<PendingSelectiveImport | null>(null)
  const [importSelections, setImportSelections] = useState<DataSelectionState>(() => createEmptySelections())
  const [importArchiveName, setImportArchiveName] = useState<string | null>(null)
  const [preparingImport, setPreparingImport] = useState(false)
  const [importing, setImporting] = useState(false)

  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  const [newType, setNewType] = useState<'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY'>('WEEKLY')
  const [reprocessBusy, setReprocessBusy] = useState(false)
  const [transforming, setTransforming] = useState(false)

  const selectedExportTypes = useMemo(
    () => (Object.entries(exportSelections) as [DataTypeKey, boolean][]) 
      .filter(([, selected]) => selected)
      .map(([type]) => type),
    [exportSelections]
  )

  const selectedImportTypes = useMemo(
    () => pendingImport
      ? pendingImport.availableTypes.filter(type => importSelections[type])
      : [],
    [importSelections, pendingImport]
  )

  const resetAlerts = () => {
    setErr(null)
    setMsg(null)
    setImportResult(null)
  }

  const handleExport = async () => {
    resetAlerts()
    if (selectedExportTypes.length === 0) {
      setErr('Select at least one data type to export.')
      return
    }

    setExporting(true)
    try {
      const params = new URLSearchParams()

      selectedExportTypes.forEach(type => {
        params.append(`include${type.charAt(0).toUpperCase()}${type.slice(1)}`, 'true')
      })

      if (exportStartDate) params.append('startDate', exportStartDate)
      if (exportEndDate) params.append('endDate', exportEndDate)
      if (includeInactive) params.append('includeInactive', 'true')

      const filename = `chrona-export-${new Date().toISOString().slice(0, 10)}.zip`
      const url = `/api/export/selective?${params.toString()}`

      await downloadFromEndpoint(url, filename)

      const label = selectedExportTypes.map(formatTypeLabel).join(', ')
      setMsg(`Export started for: ${label}`)
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setExporting(false)
    }
  }

  const handleArchiveSelection = async (file: File) => {
    resetAlerts()
    setPreparingImport(true)
    setPendingImport(null)
    setImportArchiveName(null)

    try {
      const buffer = await file.arrayBuffer()
      const zip = await JSZip.loadAsync(buffer)

      const data: PendingSelectiveImport['data'] = {}
      const availableTypes: DataTypeKey[] = []

      if (zip.files['shifts.csv']) {
        const text = await zip.files['shifts.csv'].async('string')
        const parsed = parseShiftsCsv(text)
        if (parsed.shifts.length > 0) {
          data.shifts = { shifts: parsed.shifts }
          availableTypes.push('shifts')
        }
      }

      if (zip.files['pay-guides.csv']) {
        const text = await zip.files['pay-guides.csv'].async('string')
        const parsed = parsePayGuidesCsv(text)
        if (parsed.payGuides.length > 0) {
          data.payGuides = { payGuides: parsed.payGuides }
          availableTypes.push('payGuides')
        }
      }

      const paygMatch = zip.file(/tax-data-payg\.csv$/i)
      const stslMatch = zip.file(/tax-data-stsl\.csv$/i)
      if (paygMatch.length > 0 && stslMatch.length > 0) {
        const paygCsv = await paygMatch[0].async('string')
        const stslCsv = await stslMatch[0].async('string')
        const parsed = parseTaxDataFiles({ paygCsv, stslCsv })
        if (parsed.taxSettings || parsed.taxCoefficients || parsed.stslRates || parsed.taxRateConfigs) {
          data.taxData = parsed
          availableTypes.push('taxData')
        }
      }

      if (availableTypes.length === 0) {
        throw new Error('No recognized data types found in the archive.')
      }

      setPendingImport({ data, availableTypes })
      setImportSelections({
        shifts: availableTypes.includes('shifts'),
        payGuides: availableTypes.includes('payGuides'),
        taxData: availableTypes.includes('taxData')
      })
      setImportArchiveName(file.name)
      setMsg('Archive ready. Review the selections and start the import when you are ready.')
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setPreparingImport(false)
    }
  }

  const clearPendingImport = () => {
    setPendingImport(null)
    setImportSelections(createEmptySelections())
    setImportArchiveName(null)
  }

  const submitSelectiveImport = async () => {
    if (!pendingImport) return
    resetAlerts()

    if (selectedImportTypes.length === 0) {
      setErr('Choose at least one data type to import.')
      return
    }

    setImporting(true)
    try {
      const payloadData: PendingSelectiveImport['data'] = {}
      selectedImportTypes.forEach(type => {
        const value = pendingImport.data[type]
        if (value) {
          ;(payloadData as Record<string, unknown>)[type] = value
        }
      })

      const response = await fetch('/api/import/selective', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: payloadData,
          options: {
            conflictResolution,
            selectedTypes: selectedImportTypes,
            importSettings: {
              validatePayGuides: true,
              activateImported: true,
              replaceExisting: false
            }
          }
        })
      })

      const result: ImportResult = await response.json()
      setImportResult(result)

      if (!response.ok || !result.success) {
        const { failed, successful } = result.summary
        setErr(`Import completed with issues: ${failed} failed, ${successful} succeeded.`)
      } else {
        const label = selectedImportTypes.map(formatTypeLabel).join(', ')
        setMsg(`Import successful for: ${label}`)
        clearPendingImport()
      }
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setImporting(false)
    }
  }

  const importPreferences = async (file: File) => {
    resetAlerts()
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      const prefs = json?.preferences || json?.prefs
      if (prefs && typeof window !== 'undefined') {
        localStorage.setItem('chrona:prefs', JSON.stringify(prefs))
        setMsg('Preferences imported successfully.')
      } else {
        setErr('No preferences found in the selected file.')
      }
    } catch (e: any) {
      setErr(e.message)
    }
  }

  const conflictOptions: ConflictResolution[] = ['skip', 'overwrite', 'rename']

  const ExportSelections = () => (
    <div className="d-flex flex-column gap-2">
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <span className="fw-semibold">Data types</span>
        <div className="d-flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={exporting}
            onClick={() => setExportSelections({ shifts: true, payGuides: true, taxData: true })}
          >
            Select all
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={exporting}
            onClick={() => setExportSelections(createEmptySelections())}
          >
            Clear
          </Button>
        </div>
      </div>
      <div className="d-flex flex-wrap gap-3">
        {(Object.keys(exportSelections) as DataTypeKey[]).map(type => (
          <label key={type} className="form-check form-check-inline m-0">
            <input
              type="checkbox"
              className="form-check-input"
              checked={exportSelections[type]}
              onChange={(e) => setExportSelections(prev => ({ ...prev, [type]: e.target.checked }))}
              disabled={exporting}
            />
            <span className="form-check-label">{formatTypeLabel(type)}</span>
          </label>
        ))}
      </div>
    </div>
  )

  const ImportResultDisplay = ({ result }: { result: ImportResult }) => (
    <div className="border rounded p-3 bg-dark text-light">
      <div className="d-flex flex-column gap-2">
        <div>
          <span className="fw-semibold me-3">Successful:</span>
          <span>{result.summary.successful}</span>
          {result.summary.skipped > 0 && (
            <span className="ms-3 text-warning">Skipped: {result.summary.skipped}</span>
          )}
          {result.summary.failed > 0 && (
            <span className="ms-3 text-danger">Failed: {result.summary.failed}</span>
          )}
        </div>

        {result.created.length > 0 && (
          <div>
            <div className="fw-semibold text-success">Created</div>
            <ul className="mb-0 ps-3">
              {result.created.slice(0, 5).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
              {result.created.length > 5 && (
                <li>...and {result.created.length - 5} more</li>
              )}
            </ul>
          </div>
        )}

        {result.updated.length > 0 && (
          <div>
            <div className="fw-semibold text-info">Updated</div>
            <ul className="mb-0 ps-3">
              {result.updated.slice(0, 5).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
              {result.updated.length > 5 && (
                <li>...and {result.updated.length - 5} more</li>
              )}
            </ul>
          </div>
        )}

        {result.errors.length > 0 && (
          <div>
            <div className="fw-semibold text-danger">Errors</div>
            <ul className="mb-0 ps-3">
              {result.errors.slice(0, 3).map((error, index) => (
                <li key={index}>{error.field}: {error.message}</li>
              ))}
              {result.errors.length > 3 && (
                <li>...and {result.errors.length - 3} more</li>
              )}
            </ul>
          </div>
        )}

        {result.warnings.length > 0 && (
          <div>
            <div className="fw-semibold text-warning">Warnings</div>
            <ul className="mb-0 ps-3">
              {result.warnings.slice(0, 3).map((warning, index) => (
                <li key={index}>{warning.field}: {warning.message}</li>
              ))}
              {result.warnings.length > 3 && (
                <li>...and {result.warnings.length - 3} more</li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="d-flex flex-column gap-4">
      {err && (
        <div className="alert alert-danger" role="alert">
          {err}
        </div>
      )}
      {msg && (
        <div className="alert alert-info" role="status">
          {msg}
        </div>
      )}

      <Card variant="elevated">
        <CardHeader className="d-flex flex-column gap-1">
          <h3 className="h5 mb-0">Export Data</h3>
          <p className="text-secondary mb-0">
            Generate a ZIP archive containing CSV files for the resources you select. Filters apply to shifts only.
          </p>
        </CardHeader>
        <CardBody className="d-flex flex-column gap-4">
          <ExportSelections />

          <div className="row gy-3">
            <div className="col-md-6">
              <label className="form-label mb-1">Start date (optional)</label>
              <input
                type="date"
                className="form-control"
                value={exportStartDate}
                onChange={(e) => setExportStartDate(e.target.value)}
                disabled={exporting}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label mb-1">End date (optional)</label>
              <input
                type="date"
                className="form-control"
                value={exportEndDate}
                onChange={(e) => setExportEndDate(e.target.value)}
                disabled={exporting}
              />
            </div>
          </div>

          <div className="form-check form-switch">
            <input
              className="form-check-input"
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
              disabled={exporting}
              id="includeInactiveGuides"
            />
            <label className="form-check-label" htmlFor="includeInactiveGuides">
              Include inactive pay guides
            </label>
          </div>

          <div className="d-flex flex-wrap align-items-center gap-3">
            <Button
              type="button"
              onClick={handleExport}
              disabled={exporting || selectedExportTypes.length === 0}
              isLoading={exporting}
              loadingText="Preparing export…"
            >
              Download export
            </Button>
            <span className="text-secondary small">
              Your browser will download a ZIP file containing one CSV per data type.
            </span>
          </div>
        </CardBody>
      </Card>

      <Card variant="elevated">
        <CardHeader className="d-flex flex-column gap-1">
          <h3 className="h5 mb-0">Import Data</h3>
          <p className="text-secondary mb-0">
            Upload a Chrona export ZIP, choose the datasets to restore, and decide how to handle duplicates.
          </p>
        </CardHeader>
        <CardBody className="d-flex flex-column gap-4">
          <div className="d-flex flex-column gap-2">
            <span className="fw-semibold">Upload archive</span>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <label className="btn btn-outline-primary btn-sm mb-0" style={{ cursor: preparingImport ? 'wait' : 'pointer' }}>
                {preparingImport ? 'Processing…' : 'Choose ZIP'}
                <input
                  type="file"
                  accept="application/zip,.zip"
                  onChange={(e) => e.target.files?.[0] && handleArchiveSelection(e.target.files[0])}
                  style={{ display: 'none' }}
                  disabled={preparingImport || importing}
                />
              </label>
              {importArchiveName && (
                <span className="badge bg-dark text-light py-2 px-3">{importArchiveName}</span>
              )}
              {pendingImport && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearPendingImport}
                  disabled={importing || preparingImport}
                >
                  Remove file
                </Button>
              )}
            </div>
            <span className="text-secondary small">
              Expecting a Chrona export ZIP containing <code>shifts.csv</code>, <code>pay-guides.csv</code>, and tax data CSVs.
            </span>
          </div>

          <div className="d-flex flex-column gap-2">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
              <span className="fw-semibold">Data types</span>
              {pendingImport && (
                <div className="d-flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={importing}
                    onClick={() => setImportSelections({
                      shifts: pendingImport.availableTypes.includes('shifts'),
                      payGuides: pendingImport.availableTypes.includes('payGuides'),
                      taxData: pendingImport.availableTypes.includes('taxData')
                    })}
                  >
                    Select all found
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={importing}
                    onClick={() => setImportSelections(createEmptySelections())}
                  >
                    Clear
                  </Button>
                </div>
              )}
            </div>
            <div className="d-flex flex-wrap gap-3">
              {(Object.keys(importSelections) as DataTypeKey[]).map(type => {
                const available = pendingImport?.availableTypes.includes(type) ?? false
                const disabled = !available || importing
                return (
                  <label key={type} className={`form-check form-check-inline m-0 ${!available ? 'text-secondary' : ''}`}>
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={importSelections[type] && available}
                      disabled={disabled}
                      onChange={(e) => setImportSelections(prev => ({ ...prev, [type]: e.target.checked }))}
                    />
                    <span className="form-check-label">{formatTypeLabel(type)}</span>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="d-flex flex-column gap-2">
            <span className="fw-semibold">Conflict resolution</span>
            <div className="d-flex flex-wrap gap-2">
              {conflictOptions.map(option => (
                <Button
                  key={option}
                  type="button"
                  size="sm"
                  variant={conflictResolution === option ? 'primary' : 'outline'}
                  onClick={() => setConflictResolution(option)}
                  disabled={importing}
                >
                  {conflictLabels[option]}
                </Button>
              ))}
            </div>
            <span className="text-secondary small">
              Choose how Chrona should react when a matching record already exists.
            </span>
          </div>

          <div className="d-flex flex-wrap align-items-center gap-3">
            <Button
              type="button"
              onClick={submitSelectiveImport}
              disabled={!pendingImport || selectedImportTypes.length === 0 || importing}
              isLoading={importing}
              loadingText="Importing…"
            >
              Import selected data
            </Button>
            <span className="text-secondary small">
              Shifts automatically create pay periods if necessary. Double-check default pay-period extras afterwards.
            </span>
          </div>
        </CardBody>
        {importResult && (
          <CardFooter>
            <ImportResultDisplay result={importResult} />
          </CardFooter>
        )}
      </Card>

      <Card variant="elevated">
        <CardHeader className="d-flex flex-column gap-1">
          <h3 className="h5 mb-0">Local Settings</h3>
          <p className="text-secondary mb-0">
            Manage browser-only preferences stored on this device.
          </p>
        </CardHeader>
        <CardBody className="d-flex flex-column gap-3">
          <div className="d-flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                reset()
                resetAlerts()
                setMsg('Local preferences cleared for this browser.')
              }}
            >
              Clear local preferences
            </Button>
            <label className="btn btn-outline-secondary btn-sm mb-0">
              Import preferences
              <input
                type="file"
                accept="application/json"
                onChange={(e) => e.target.files?.[0] && importPreferences(e.target.files[0])}
                style={{ display: 'none' }}
              />
            </label>
          </div>
          <span className="text-secondary small">
            These options only affect cached settings in your browser; they never modify your account data.
          </span>
        </CardBody>
      </Card>

      <Card variant="elevated">
        <CardHeader className="d-flex flex-column gap-1">
          <h3 className="h5 mb-0">Maintenance</h3>
          <p className="text-secondary mb-0">
            Reprocess totals and rebuild year-to-date values across all tax years.
          </p>
        </CardHeader>
        <CardBody className="d-flex flex-column gap-3">
          <div className="text-secondary small">
            This operation recalculates pay periods, taxes, and YTD figures. It can take a few minutes for large datasets.
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={reprocessBusy}
            isLoading={reprocessBusy}
            loadingText="Reprocessing…"
            onClick={async () => {
              if (!confirm('Reprocess everything? This may take a few minutes. Continue?')) return
              resetAlerts()
              setReprocessBusy(true)
              try {
                const res = await fetch('/api/admin/maintenance/reprocess', { method: 'POST' })
                const json = await res.json()
                if (!res.ok) throw new Error(json?.error || json?.message || 'Reprocess failed')
                const taxYears = (json?.data?.details || [])
                  .map((d: { taxYear: string }) => d.taxYear)
                  .join(', ')
                setMsg(`Reprocessed ${json?.data?.totalPayPeriods ?? 0} pay periods across ${json?.data?.processedTaxYears ?? 0} tax years${taxYears ? ` (${taxYears})` : ''}.`)
              } catch (e: any) {
                setErr(e.message)
              } finally {
                setReprocessBusy(false)
              }
            }}
          >
            Reprocess all (Pay + YTD)
          </Button>
        </CardBody>
      </Card>

      <Card variant="elevated">
        <CardHeader className="d-flex flex-column gap-1">
          <h3 className="h5 mb-0">Transform Pay Periods</h3>
          <p className="text-secondary mb-0">
            Switch the pay period cadence for all shifts and recalculate totals automatically.
          </p>
        </CardHeader>
        <CardBody className="d-flex flex-column gap-3">
          <div className="d-flex align-items-center gap-3 flex-wrap">
            <div className="d-flex flex-column">
              <label className="form-label mb-1">New pay period type</label>
              <select
                className="form-select"
                value={newType}
                onChange={(e) => setNewType(e.target.value as typeof newType)}
                disabled={transforming}
              >
                <option value="WEEKLY">Weekly</option>
                <option value="FORTNIGHTLY">Fortnightly</option>
                <option value="MONTHLY">Monthly</option>
              </select>
            </div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={transforming}
              isLoading={transforming}
              loadingText="Transforming…"
              onClick={async () => {
                if (!confirm(`Transform all pay periods to ${newType}? This will recalculate and may take a moment.`)) return
                resetAlerts()
                setTransforming(true)
                try {
                  const res = await fetch('/api/pay-periods/transform', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newPayPeriodType: newType, cleanup: true })
                  })
                  const json = await res.json()
                  if (!res.ok) throw new Error(json?.error || json?.message || 'Failed to transform')
                  setMsg(`Transformed: moved ${json.data.movedShifts} shifts; affected ${json.data.affectedPayPeriods} periods; removed ${json.data.removedEmptyPayPeriods} empty.`)
                } catch (e: any) {
                  setErr(e.message)
                } finally {
                  setTransforming(false)
                }
              }}
            >
              Transform
            </Button>
          </div>
          <div className="text-warning small">
            Tip: Export a backup before transforming to keep a snapshot of your current schedule.
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
