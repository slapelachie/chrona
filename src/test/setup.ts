import '@testing-library/jest-dom'
import { expect, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'
import { beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { seedTaxConfigForYear, clearTaxConfig } from '@/lib/__tests__/helpers/tax-config'

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers)

// Clean up after each test case
afterEach(() => {
  cleanup()
})

// Global test configuration
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
})

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  root: Element | null = null
  rootMargin: string = '0px'
  thresholds: ReadonlyArray<number> = [0]
  
  constructor() {}
  observe() {}
  disconnect() {}
  unobserve() {}
  takeRecords(): IntersectionObserverEntry[] { return [] }
}

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  observe() {}
  disconnect() {}
  unobserve() {}
}

// Seed a minimal current-year tax configuration for tests that rely on DB-backed tax rates
const currentTaxYear = (() => {
  const now = new Date()
  const y = now.getFullYear()
  return now.getMonth() >= 6 ? `${y}-${(y + 1) % 100}` : `${y - 1}-${y % 100}`
})()

beforeAll(async () => {
  try {
    await seedTaxConfigForYear(prisma as any, currentTaxYear)
  } catch {
    // Best-effort; individual tests may seed as needed
  }
})

afterAll(async () => {
  try {
    await clearTaxConfig(prisma as any, currentTaxYear)
  } catch {
    // ignore
  }
})
