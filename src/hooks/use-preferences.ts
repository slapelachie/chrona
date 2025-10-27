import { useCallback, useEffect, useState } from 'react'

type Prefs = {
  defaultPayGuideId?: string
  emailReminders?: boolean
  payPeriodAlerts?: boolean
  shiftReminders?: boolean
  defaultShiftLengthMinutes?: number
}

const KEY = 'chrona:prefs'

function read(): Prefs {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function write(prefs: Prefs) {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY, JSON.stringify(prefs))
}

const clampShiftMinutes = (value: number) => {
  const clamped = Math.min(Math.max(Math.round(value), 15), 24 * 60)
  const snapped = Math.round(clamped / 15) * 15
  return Math.min(Math.max(snapped, 15), 24 * 60)
}

export function usePreferences() {
  const [prefs, setPrefs] = useState<Prefs>(() => read())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const mergePrefs = useCallback((patch: Partial<Prefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch }
      write(next)
      return next
    })
  }, [])

  const fetchUserPrefs = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/user')
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        const payload = json ?? {}
        throw new Error(payload?.error || payload?.message || 'Failed to load user settings')
      }
      const user = json?.data
      if (user && typeof user.defaultShiftLengthMinutes === 'number') {
        mergePrefs({ defaultShiftLengthMinutes: clampShiftMinutes(user.defaultShiftLengthMinutes) })
      }
      setError(null)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to load preferences')
      }
    } finally {
      setLoading(false)
    }
  }, [mergePrefs])

  useEffect(() => {
    void fetchUserPrefs()
  }, [fetchUserPrefs])

  const persistToServer = useCallback(async (patch: Partial<Prefs>) => {
    const payload: Record<string, unknown> = {}
    if (patch.defaultShiftLengthMinutes !== undefined) {
      payload.defaultShiftLengthMinutes = clampShiftMinutes(patch.defaultShiftLengthMinutes)
    }

    if (Object.keys(payload).length === 0) return

    try {
      const res = await fetch('/api/user', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json().catch(() => null)

      if (!res.ok) {
        const payload = json ?? {}
        throw new Error(payload?.error || payload?.message || 'Failed to update preferences')
      }

      const user = json?.data
      if (user && typeof user.defaultShiftLengthMinutes === 'number') {
        mergePrefs({ defaultShiftLengthMinutes: clampShiftMinutes(user.defaultShiftLengthMinutes) })
      }
      setError(null)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to update preferences')
      }
      // Re-fetch to restore server truth.
      await fetchUserPrefs()
    }
  }, [fetchUserPrefs, mergePrefs])

  const update = (patch: Partial<Prefs>) => {
    mergePrefs(patch)
    void persistToServer(patch)
  }

  const reset = () => {
    mergePrefs({})
    void persistToServer({ defaultShiftLengthMinutes: 180 })
  }

  return { prefs, update, reset, loading, error }
}
