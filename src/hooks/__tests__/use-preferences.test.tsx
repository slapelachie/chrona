import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { usePreferences } from '../use-preferences'

const originalFetch = global.fetch
const fetchMock = vi.fn()

const mockResponse = <T,>(data: T, ok = true) => ({
  ok,
  json: vi.fn().mockResolvedValue(data),
})

describe('usePreferences', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    global.fetch = fetchMock as any
    localStorage.clear()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('hydrates from storage and clamps values before persisting', async () => {
    localStorage.setItem('chrona:prefs', JSON.stringify({ defaultShiftLengthMinutes: 150 }))

    fetchMock
      .mockResolvedValueOnce(
        mockResponse({ data: { defaultShiftLengthMinutes: 210 } })
      )
      .mockResolvedValueOnce(
        mockResponse({ data: { defaultShiftLengthMinutes: 195 } })
      )

    const { result } = renderHook(() => usePreferences())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.prefs.defaultShiftLengthMinutes).toBe(210)

    act(() => {
      result.current.update({ defaultShiftLengthMinutes: 200 })
    })

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    const [, updateOptions] = fetchMock.mock.calls[1]
    expect(updateOptions?.method).toBe('PUT')
    expect(JSON.parse(updateOptions?.body as string)).toEqual({
      defaultShiftLengthMinutes: 195,
    })

    const stored = JSON.parse(localStorage.getItem('chrona:prefs') ?? '{}')
    expect(stored.defaultShiftLengthMinutes).toBe(195)
    expect(result.current.error).toBeNull()
  })

  it('recovers from server errors by refetching preferences', async () => {
    fetchMock
      .mockResolvedValueOnce(
        mockResponse({ data: { defaultShiftLengthMinutes: 180 } })
      )
      .mockResolvedValueOnce(
        mockResponse({ error: 'Unable to save' }, false)
      )
      .mockResolvedValueOnce(
        mockResponse({ data: { defaultShiftLengthMinutes: 165 } })
      )

    const { result } = renderHook(() => usePreferences())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.prefs.defaultShiftLengthMinutes).toBe(180)

    act(() => {
      result.current.update({ defaultShiftLengthMinutes: 200 })
    })

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))

    const [, updateOptions] = fetchMock.mock.calls[1]
    expect(updateOptions?.method).toBe('PUT')

    expect(result.current.prefs.defaultShiftLengthMinutes).toBe(165)
    expect(JSON.parse(localStorage.getItem('chrona:prefs') ?? '{}').defaultShiftLengthMinutes).toBe(165)
  })
})

