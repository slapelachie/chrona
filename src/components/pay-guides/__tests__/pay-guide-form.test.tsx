import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PayGuideForm } from '../pay-guide-form'
import { PayGuideResponse } from '@/types'

const originalFetch = global.fetch

const mockResponse = <T,>(data: T, ok = true) => ({
  ok,
  json: vi.fn().mockResolvedValue(data),
})

describe('PayGuideForm', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    global.fetch = fetchMock as any
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('prefills fields when editing an existing pay guide', async () => {
    const payGuide: PayGuideResponse = {
      id: 'pg_123',
      name: 'Retail Award',
      baseRate: '27.50',
      minimumShiftHours: 3,
      maximumShiftHours: 9,
      description: 'Level 1 adult',
      effectiveFrom: '2024-01-01T00:00:00.000Z',
      effectiveTo: '2024-12-31T00:00:00.000Z',
      timezone: 'Australia/Sydney',
      isActive: true,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    }

    fetchMock.mockResolvedValueOnce(mockResponse({ data: payGuide }))

    render(<PayGuideForm mode="edit" payGuideId="pg_123" />)

    expect(fetchMock).toHaveBeenCalledWith('/api/pay-rates/pg_123')

    expect(await screen.findByDisplayValue('Retail Award')).toBeInTheDocument()
    expect(screen.getByDisplayValue('27.50')).toBeInTheDocument()
    expect(screen.getByLabelText('Active')).toBeChecked()
    expect(screen.getByDisplayValue('2024-01-01')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2024-12-31')).toBeInTheDocument()
  })

  it('submits creation payload and surfaces success messaging', async () => {
    const onSaved = vi.fn()
    const savedGuide: PayGuideResponse = {
      id: 'pg_new',
      name: 'New Guide',
      baseRate: '31.00',
      minimumShiftHours: null,
      maximumShiftHours: null,
      description: null,
      effectiveFrom: '2024-01-01T00:00:00.000Z',
      effectiveTo: null,
      timezone: 'Australia/Sydney',
      isActive: true,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    }

    fetchMock.mockResolvedValueOnce(mockResponse({ data: savedGuide }))

    const user = userEvent.setup()

    render(<PayGuideForm mode="create" onSaved={onSaved} />)

    await user.clear(screen.getByLabelText(/name/i))
    await user.type(screen.getByLabelText(/name/i), 'New Guide')
    await user.clear(screen.getByLabelText(/base rate/i))
    await user.type(screen.getByLabelText(/base rate/i), '31')
    await user.clear(screen.getByLabelText(/description/i))
    await user.type(screen.getByLabelText(/description/i), 'Award description')

    await user.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [, requestInit] = fetchMock.mock.calls[0]
    expect(fetchMock).toHaveBeenCalledWith('/api/pay-rates', expect.any(Object))
    expect(requestInit?.method).toBe('POST')

    const payload = JSON.parse((requestInit?.body as string) ?? '{}')
    expect(payload).toEqual(
      expect.objectContaining({
        name: 'New Guide',
        baseRate: '31',
        timezone: 'Australia/Sydney',
        isActive: true,
      })
    )

    expect(await screen.findByText('Saved successfully')).toBeInTheDocument()
    expect(onSaved).toHaveBeenCalledWith(savedGuide)
  })

  it('shows an error message when the save fails', async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse({ error: 'Save failed' }, false)
    )

    const user = userEvent.setup()

    render(<PayGuideForm mode="create" />)

    await user.clear(screen.getByLabelText(/name/i))
    await user.type(screen.getByLabelText(/name/i), 'Broken Guide')
    await user.clear(screen.getByLabelText(/base rate/i))
    await user.type(screen.getByLabelText(/base rate/i), '28')

    await user.click(screen.getByRole('button', { name: 'Create' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Save failed')
  })

  it('disables the submit button and shows optimistic state while saving', async () => {
    const user = userEvent.setup()

    const deferred: { resolve: (value: unknown) => void } = {
      resolve: () => {},
    }

    fetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        deferred.resolve = resolve
      })
    )

    render(<PayGuideForm mode="create" />)

    await user.clear(screen.getByLabelText(/name/i))
    await user.type(screen.getByLabelText(/name/i), 'Optimistic Guide')
    await user.clear(screen.getByLabelText(/base rate/i))
    await user.type(screen.getByLabelText(/base rate/i), '29.5')

    const submit = screen.getByRole('button', { name: 'Create' })

    await user.click(submit)

    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()

    deferred.resolve(
      mockResponse({
        data: {
          id: 'pg_optimistic',
          name: 'Optimistic Guide',
        },
      })
    )

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Create' })).not.toBeDisabled()
    )
  })
})
