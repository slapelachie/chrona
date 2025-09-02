import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { Container } from 'react-bootstrap'
import { vi } from 'vitest'

// Custom render function that wraps components with Bootstrap Container
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <Container fluid>
      {children}
    </Container>
  )
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

export * from '@testing-library/react'
export { customRender as render }

// Common test data generators for Australian pay calculations
export const createTestUser = () => ({
  id: '1',
  name: 'Test User',
  email: 'test@example.com',
  tfnDeclared: true,
  claimsTaxFreeThreshold: true,
  hasHECSDebt: false,
})

export const createTestPayGuide = () => ({
  id: '1',
  name: 'Retail Award 2024',
  effectiveFrom: new Date('2024-01-01'),
  effectiveTo: new Date('2024-12-31'),
  isActive: true,
  baseHourlyRate: 25.50, // Includes 25% casual loading
  overtimeRate1_5x: 1.75, // 175%
  overtimeRate2x: 2.25,   // 225%
  dailyOvertimeHours: 9,
  weeklyOvertimeHours: 38,
})

export const createTestShift = () => ({
  id: '1',
  userId: '1',
  payGuideId: '1',
  startTime: new Date('2024-12-01T09:00:00.000Z'),
  endTime: new Date('2024-12-01T17:00:00.000Z'),
  breakMinutes: 30,
  shiftType: 'CASUAL' as const,
  status: 'COMPLETED' as const,
  notes: 'Test shift',
  location: 'Test Store',
  totalMinutes: 450, // 7.5 hours
  regularHours: 7.5,
  overtimeHours: 0,
  penaltyHours: 0,
  grossPay: 191.25,
})

// Mock fetch for API testing
export const mockFetch = (data: unknown, ok = true, status = 200) => {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok,
      status,
      json: () => Promise.resolve(data),
    })
  ) as typeof fetch
}

// Helper for testing Australian currency formatting
export const expectAustralianCurrency = (value: string) => {
  // This will be used with expect() in tests, but not defined here
  return value.match(/^\$\d{1,3}(,\d{3})*(\.\d{2})?$/)
}