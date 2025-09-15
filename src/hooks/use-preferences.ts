import { useEffect, useState } from 'react'

type Prefs = {
  defaultPayGuideId?: string
  emailReminders?: boolean
  payPeriodAlerts?: boolean
  shiftReminders?: boolean
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

export function usePreferences() {
  const [prefs, setPrefs] = useState<Prefs>({})

  useEffect(() => {
    setPrefs(read())
  }, [])

  const update = (patch: Partial<Prefs>) => {
    setPrefs(prev => {
      const next = { ...prev, ...patch }
      write(next)
      return next
    })
  }

  const reset = () => {
    setPrefs({})
    write({})
  }

  return { prefs, update, reset }
}

