"use client"

import React, { useMemo, useRef, useState } from 'react'
import JSZip from 'jszip'
import { Button, Card, CardHeader, CardBody, CardFooter, Input, Select, Toggle, Alert } from '@/components/ui'
import { usePreferences } from '@/hooks/use-preferences'
import { ImportResult, ConflictResolution } from '@/types'
import {
  parseShiftsCsv,
  parsePayGuidesCsv,
  parseTaxDataFiles,
  parsePayPeriodsFiles,
  parsePreferencesJson
} from '@/lib/import-csv'
import { ImportPayPeriodsRequest, ImportPreferencesRequest } from '@/types'
import './data-management.scss'

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

type DataTypeKey = 'shifts' | 'payPeriods' | 'payGuides' | 'taxData' | 'preferences'

type DataSelectionState = Record<DataTypeKey, boolean>

type ShiftsPayload = ReturnType<typeof parseShiftsCsv>['shifts']
type PayGuidesPayload = ReturnType<typeof parsePayGuidesCsv>['payGuides']
type TaxDataPayload = ReturnType<typeof parseTaxDataFiles>
type PayPeriodsPayload = ImportPayPeriodsRequest
type PreferencesPayload = ImportPreferencesRequest

type PendingSelectiveImport = {
  data: {
    shifts?: { shifts: ShiftsPayload }
    payGuides?: { payGuides: PayGuidesPayload }
    taxData?: TaxDataPayload
    payPeriods?: PayPeriodsPayload
    preferences?: PreferencesPayload
  }
  availableTypes: DataTypeKey[]
}

const formatTypeLabel = (type: DataTypeKey) => {
  switch (type) {
    case 'payGuides':
      return 'Pay Guides'
    case 'payPeriods':
      return 'Pay Periods'
    case 'taxData':
      return 'Tax Data'
    case 'preferences':
      return 'Preferences'
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
  payPeriods: false,
  payGuides: false,
  taxData: false,
  preferences: false
})

export const DataManagement: React.FC = () => {
  const { reset } = usePreferences()

  const [exportSelections, setExportSelections] = useState<DataSelectionState>({
    shifts: true,
    payPeriods: true,
    payGuides: true,
    taxData: true,
    preferences: true
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

  const archiveInputRef = useRef<HTMLInputElement | null>(null)
  const preferencesInputRef = useRef<HTMLInputElement | null>(null)

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

      const payPeriodsMatch = zip.file(/pay-periods\.csv$/i)
      if (payPeriodsMatch.length > 0) {
        const payPeriodsCsv = await payPeriodsMatch[0].async('string')
        const extrasMatch = zip.file(/pay-period-extras\.csv$/i)
        const extrasCsv = extrasMatch.length > 0 ? await extrasMatch[0].async('string') : undefined
        const parsed = parsePayPeriodsFiles({ payPeriodsCsv, extrasCsv })
        if (parsed.payPeriods.length > 0) {
          data.payPeriods = parsed
          availableTypes.push('payPeriods')
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

      const preferencesMatch = zip.file(/preferences\.json$/i)
      if (preferencesMatch.length > 0) {
        const json = await preferencesMatch[0].async('string')
        const parsed = parsePreferencesJson(json)
        if (parsed.user || (parsed.defaultExtras && parsed.defaultExtras.length > 0)) {
          data.preferences = parsed
          availableTypes.push('preferences')
        }
      }

      if (availableTypes.length === 0) {
        throw new Error('No recognized data types found in the archive.')
      }

      setPendingImport({ data, availableTypes })
      setImportSelections({
        shifts: availableTypes.includes('shifts'),
        payPeriods: availableTypes.includes('payPeriods'),
        payGuides: availableTypes.includes('payGuides'),
        taxData: availableTypes.includes('taxData'),
        preferences: availableTypes.includes('preferences')
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
            onClick={() => setExportSelections({ shifts: true, payPeriods: true, payGuides: true, taxData: true, preferences: true })}
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
      <div className="d-flex flex-wrap gap-2">
        {(Object.keys(exportSelections) as DataTypeKey[]).map(type => {
          const isSelected = exportSelections[type]
          return (
            <Button
              key={type}
              type="button"
              size="sm"
              variant={isSelected ? 'secondary' : 'ghost'}
              className="data-management__pill"
              onClick={() => setExportSelections(prev => ({ ...prev, [type]: !prev[type] }))}
              aria-pressed={isSelected}
              disabled={exporting}
            >
              {formatTypeLabel(type)}
            </Button>
          )
        })}
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
        <Alert tone="danger" role="alert">
          {err}
        </Alert>
      )}
      {msg && (
        <Alert tone="info" role="status">
          {msg}
        </Alert>
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

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem',
            }}
          >
            <Input
              type="date"
              label="Start date (optional)"
              value={exportStartDate}
              onChange={(e) => setExportStartDate(e.target.value)}
              disabled={exporting}
            />
            <Input
              type="date"
              label="End date (optional)"
              value={exportEndDate}
              onChange={(e) => setExportEndDate(e.target.value)}
              disabled={exporting}
            />
          </div>

          <Toggle
            label="Include inactive pay guides"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            disabled={exporting}
          />

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
            <span className="data-management__hint">
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => !preparingImport && !importing && archiveInputRef.current?.click()}
                disabled={preparingImport || importing}
                className="data-management__pill"
              >
                {preparingImport ? 'Processing…' : 'Choose ZIP'}
              </Button>
              <input
                ref={archiveInputRef}
                type="file"
                accept="application/zip,.zip"
                onChange={(e) => e.target.files?.[0] && handleArchiveSelection(e.target.files[0])}
                style={{ display: 'none' }}
                disabled={preparingImport || importing}
              />
              {importArchiveName && (
                <span className="data-management__tag">{importArchiveName}</span>
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
            <span className="data-management__hint">
              Expecting a Chrona export ZIP containing <code>shifts.csv</code>, <code>pay-guides.csv</code>, tax data CSVs, optional <code>pay-periods.csv</code> with extras, and <code>preferences.json</code> when exporting settings.
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
                      payPeriods: pendingImport.availableTypes.includes('payPeriods'),
                      payGuides: pendingImport.availableTypes.includes('payGuides'),
                      taxData: pendingImport.availableTypes.includes('taxData'),
                      preferences: pendingImport.availableTypes.includes('preferences')
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
            <div className="d-flex flex-wrap gap-2">
              {(Object.keys(importSelections) as DataTypeKey[]).map(type => {
                const available = pendingImport?.availableTypes.includes(type) ?? false
                const isSelected = importSelections[type] && available
                return (
                  <Button
                    key={type}
                    type="button"
                    size="sm"
                    variant={isSelected ? 'secondary' : 'ghost'}
                    className={`data-management__pill ${!available ? 'data-management__pill--disabled' : ''}`}
                    onClick={() => {
                      if (!available || importing) return
                      setImportSelections(prev => ({ ...prev, [type]: !prev[type] }))
                    }}
                    aria-pressed={isSelected}
                    disabled={!available || importing}
                  >
                    {formatTypeLabel(type)}
                  </Button>
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
            <span className="data-management__hint">
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
            <span className="data-management__hint">
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => preferencesInputRef.current?.click()}
              className="data-management__pill"
            >
              Import preferences
            </Button>
            <input
              ref={preferencesInputRef}
              type="file"
              accept="application/json"
              onChange={(e) => e.target.files?.[0] && importPreferences(e.target.files[0])}
              style={{ display: 'none' }}
            />
          </div>
          <span className="data-management__hint">
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
          <div className="data-management__hint">
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
            <Select
              label="New pay period type"
              value={newType}
              onChange={(e) => setNewType(e.target.value as typeof newType)}
              disabled={transforming}
            >
              <option value="WEEKLY">Weekly</option>
              <option value="FORTNIGHTLY">Fortnightly</option>
              <option value="MONTHLY">Monthly</option>
            </Select>
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
          <div className="data-management__hint data-management__hint--warning">
            Tip: Export a backup before transforming to keep a snapshot of your current schedule.
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
