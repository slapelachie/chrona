import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ShiftPreferences } from '../shift-preferences'
import { usePreferences } from '@/hooks/use-preferences'

vi.mock('@/hooks/use-preferences', () => ({
  usePreferences: vi.fn(),
}))

const mockedUsePreferences = vi.mocked(usePreferences)

describe('ShiftPreferences', () => {
  beforeEach(() => {
    mockedUsePreferences.mockReset()
  })

  it('shows current defaults and saves updated value through preferences hook', async () => {
    const update = vi.fn()

    mockedUsePreferences.mockReturnValue({
      prefs: { defaultShiftLengthMinutes: 180 },
      update,
      reset: vi.fn(),
      loading: false,
      error: null,
    })

    const user = userEvent.setup()

    render(<ShiftPreferences />)

    expect(
      screen.getByText('Current: 3 hours')
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '2h' }))
    await user.click(screen.getByRole('button', { name: 'Save default' }))

    expect(update).toHaveBeenCalledWith({ defaultShiftLengthMinutes: 120 })
    await waitFor(() =>
      expect(
        screen.getByText('Default shift length updated')
      ).toBeInTheDocument()
    )
  })

  it('surfaces hook errors inline', () => {
    mockedUsePreferences.mockReturnValue({
      prefs: { defaultShiftLengthMinutes: 180 },
      update: vi.fn(),
      reset: vi.fn(),
      loading: false,
      error: 'Unable to save preferences',
    })

    render(<ShiftPreferences />)

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Unable to save preferences'
    )
  })
})

