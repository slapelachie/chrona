import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PayGuidesList } from '../pay-guides-list'

const originalFetch = global.fetch
const originalConfirm = global.confirm
const originalAlert = global.alert

const mockResponse = <T,>(data: T, ok = true) => ({
  ok,
  json: vi.fn().mockResolvedValue(data),
})

const pushMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}))

describe('PayGuidesList', () => {
  const fetchMock = vi.fn()
  const confirmMock = vi.fn()
  const alertMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    confirmMock.mockReset()
    alertMock.mockReset()
    pushMock.mockReset()

    global.fetch = fetchMock as any
    global.confirm = confirmMock as any
    global.alert = alertMock as any

    confirmMock.mockReturnValue(true)
  })

  afterEach(() => {
    global.fetch = originalFetch
    global.confirm = originalConfirm
    global.alert = originalAlert
  })

  it('filters pay guides based on the search query', async () => {
    const listPayload = {
      data: {
        payGuides: [
          {
            id: 'pg_1',
            name: 'Retail Award',
            baseRate: '27.00',
            effectiveFrom: '2024-01-01T00:00:00.000Z',
            effectiveTo: null,
            timezone: 'Australia/Sydney',
            isActive: true,
          },
          {
            id: 'pg_2',
            name: 'Hospitality Award',
            baseRate: '28.50',
            effectiveFrom: '2024-01-15T00:00:00.000Z',
            effectiveTo: null,
            timezone: 'Australia/Brisbane',
            isActive: true,
          },
        ],
      },
    }

    fetchMock.mockResolvedValue(mockResponse(listPayload))

    const user = userEvent.setup()

    render(<PayGuidesList />)

    expect(await screen.findByText('Retail Award')).toBeInTheDocument()
    expect(screen.getByText('Hospitality Award')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Search pay guides…'), 'Hosp')

    await waitFor(() => {
      expect(screen.getByText('Hospitality Award')).toBeInTheDocument()
      expect(screen.queryByText('Retail Award')).toBeNull()
    })
  })

  it('duplicates a pay guide and navigates to the edit page', async () => {
    const listPayload = {
      data: {
        payGuides: [
          {
            id: 'pg_1',
            name: 'Retail Award',
            baseRate: '27.00',
            effectiveFrom: '2024-01-01T00:00:00.000Z',
            effectiveTo: null,
            timezone: 'Australia/Sydney',
            isActive: true,
          },
        ],
      },
    }

    fetchMock
      .mockResolvedValueOnce(mockResponse(listPayload)) // initial load
      .mockResolvedValueOnce(mockResponse({ data: { id: 'pg_new' } })) // duplicate POST
      .mockResolvedValueOnce(mockResponse(listPayload)) // refetch

    const user = userEvent.setup()

    render(<PayGuidesList />)

    expect(await screen.findByText('Retail Award')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Duplicate' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))

    const [, duplicateOptions] = fetchMock.mock.calls[1]
    expect(duplicateOptions?.method).toBe('POST')
    expect(pushMock).toHaveBeenCalledWith('/pay-guides/pg_new/edit?source=pg_1')
  })

  it('shows an error alert when the list fetch fails', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({ error: 'Failed to load pay guides' }, false)
    )

    render(<PayGuidesList />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Failed to load pay guides')
  })

  it('toggles the active filter and refetches all pay guides', async () => {
    const activePayload = {
      data: {
        payGuides: [
          {
            id: 'pg_active',
            name: 'Active Award',
            baseRate: '27.00',
            effectiveFrom: '2024-01-01T00:00:00.000Z',
            effectiveTo: null,
            timezone: 'Australia/Sydney',
            isActive: true,
          },
        ],
      },
    }

    const allPayload = {
      data: {
        payGuides: [
          ...activePayload.data.payGuides,
          {
            id: 'pg_inactive',
            name: 'Inactive Award',
            baseRate: '24.00',
            effectiveFrom: '2024-01-01T00:00:00.000Z',
            effectiveTo: null,
            timezone: 'Australia/Perth',
            isActive: false,
          },
        ],
      },
    }

    fetchMock
      .mockResolvedValueOnce(mockResponse(activePayload))
      .mockResolvedValueOnce(mockResponse(allPayload))

    const user = userEvent.setup()

    render(<PayGuidesList />)

    expect(await screen.findByText('Active Award')).toBeInTheDocument()
    expect(fetchMock.mock.calls[0][0]).toBe('/api/pay-rates?limit=100&active=true')

    await user.click(screen.getByLabelText('Active only'))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(fetchMock.mock.calls[1][0]).toBe('/api/pay-rates?limit=100')

    expect(await screen.findByText('Inactive Award')).toBeInTheDocument()
  })

  it('deletes a pay guide and refetches the list when deletion succeeds', async () => {
    const payload = {
      data: {
        payGuides: [
          {
            id: 'pg_delete',
            name: 'Delete Me Award',
            baseRate: '27.00',
            effectiveFrom: '2024-01-01T00:00:00.000Z',
            effectiveTo: null,
            timezone: 'Australia/Sydney',
            isActive: true,
          },
        ],
      },
    }

    fetchMock
      .mockResolvedValueOnce(mockResponse(payload)) // initial load
      .mockResolvedValueOnce(mockResponse({}, true)) // delete success
      .mockResolvedValueOnce(
        mockResponse({ data: { payGuides: [] } }) // refetch empty state
      )

    const user = userEvent.setup()

    render(<PayGuidesList />)

    expect(await screen.findByText('Delete Me Award')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(confirmMock).toHaveBeenCalledWith(
      'Delete this pay guide? This may fail if it is in use by shifts.'
    )

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))

    const [, deleteOptions] = fetchMock.mock.calls[1]
    expect(fetchMock.mock.calls[1][0]).toBe('/api/pay-rates/pg_delete')
    expect(deleteOptions?.method).toBe('DELETE')

    expect(alertMock).not.toHaveBeenCalled()
  })

  it('alerts the user when deletion fails', async () => {
    const payload = {
      data: {
        payGuides: [
          {
            id: 'pg_error',
            name: 'Error Award',
            baseRate: '27.00',
            effectiveFrom: '2024-01-01T00:00:00.000Z',
            effectiveTo: null,
            timezone: 'Australia/Sydney',
            isActive: true,
          },
        ],
      },
    }

    fetchMock
      .mockResolvedValueOnce(mockResponse(payload))
      .mockResolvedValueOnce(
        mockResponse({ error: 'Delete failed' }, false)
      )

    const user = userEvent.setup()

    render(<PayGuidesList />)

    expect(await screen.findByText('Error Award')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(alertMock).toHaveBeenCalledWith('Delete failed'))
  })
})
