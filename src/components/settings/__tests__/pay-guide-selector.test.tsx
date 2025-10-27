import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PayGuideSelector } from '../pay-guide-selector'
import { usePreferences } from '@/hooks/use-preferences'

vi.mock('@/hooks/use-preferences', () => ({
  usePreferences: vi.fn(),
}))

const mockedUsePreferences = vi.mocked(usePreferences)

const originalFetch = global.fetch
const fetchMock = vi.fn()

const mockResponse = <T,>(data: T, ok = true) => ({
  ok,
  json: vi.fn().mockResolvedValue(data),
})

describe('PayGuideSelector', () => {
  beforeEach(() => {
    mockedUsePreferences.mockReset()
    fetchMock.mockReset()
    global.fetch = fetchMock as any
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('renders fetched pay guides and allows setting a default', async () => {
    const updateMock = vi.fn()
    mockedUsePreferences.mockReturnValue({
      prefs: { defaultPayGuideId: 'pg_2' },
      update: updateMock,
      reset: vi.fn(),
      loading: false,
      error: null,
    })

    fetchMock.mockResolvedValueOnce(
      mockResponse({
        data: {
          payGuides: [
            { id: 'pg_1', name: 'Retail Award', baseRate: '27.00' },
            { id: 'pg_2', name: 'Hospitality Award', baseRate: '28.00' },
          ],
        },
      })
    )

    const user = userEvent.setup()

    render(<PayGuideSelector />)

    expect(await screen.findByText('Current: Hospitality Award')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Search pay guides'), 'Retail')

    await waitFor(() => {
      expect(screen.getByText('Retail Award')).toBeInTheDocument()
      expect(screen.queryByText('Hospitality Award')).toBeNull()
    })

    await user.click(screen.getByRole('button', { name: 'Set default' }))
    expect(updateMock).toHaveBeenCalledWith({ defaultPayGuideId: 'pg_1' })
  })

  it('surfaces an inline error when the fetch fails', async () => {
    mockedUsePreferences.mockReturnValue({
      prefs: {},
      update: vi.fn(),
      reset: vi.fn(),
      loading: false,
      error: null,
    })

    fetchMock.mockResolvedValueOnce(
      mockResponse({ error: 'Failed to load pay guides' }, false)
    )

    render(<PayGuideSelector />)

    const error = await screen.findByRole('alert')
    expect(error).toHaveTextContent('Failed to load pay guides')
  })
})
