# Chrona Testing Setup

This project uses a comprehensive testing strategy with **Vitest** for unit/integration testing and **Playwright** for end-to-end testing.

## Testing Framework Overview

### 🧪 Unit & Integration Testing (Vitest)
- **Framework**: Vitest with React Testing Library
- **Location**: `src/**/*.{test,spec}.{ts,tsx}`
- **Purpose**: Component testing, utility functions, API logic

### 🎭 End-to-End Testing (Playwright)
- **Framework**: Playwright
- **Location**: `tests/e2e/`
- **Purpose**: Full user workflows, cross-browser testing, mobile responsiveness

## Quick Start

```bash
# Run unit tests
npm run test              # Watch mode
npm run test:run          # Single run
npm run test:ui           # Visual UI

# Run E2E tests
npm run test:e2e          # All browsers
npm run test:e2e:ui       # Interactive mode
npm run test:e2e:report   # View reports
```

## Testing Architecture

### Unit Tests (Vitest)
- **Environment**: jsdom for DOM testing
- **Setup**: `src/test/setup.ts` - Global test configuration
- **Utilities**: `src/test/utils.tsx` - Custom render functions and test data
- **Coverage**: HTML and text reports generated

### E2E Tests (Playwright)
- **Browsers**: Chromium, Firefox, WebKit
- **Mobile**: iPhone 12, Pixel 5 emulation
- **Page Objects**: `tests/e2e/pages/` - Reusable page models
- **Test Data**: `tests/e2e/fixtures/` - Shared test data
- **Utilities**: `tests/e2e/utils/` - Helper functions

## Test Categories

### ✅ Unit Tests
- Pay calculation functions
- Utility functions (currency formatting, time validation)
- Form validation logic
- Australian tax calculations

### ✅ Component Tests
- React component rendering
- User interactions
- Form submissions
- State management

### ✅ E2E Tests
- User workflows (create shift, calculate pay)
- Mobile responsiveness
- Cross-browser compatibility
- Performance benchmarks
- Visual regression testing

## Mobile-First Testing

All tests are designed with mobile-first principles:

- **Responsive Design**: Tests verify layouts across screen sizes
- **Touch Interactions**: Minimum 44px touch targets verified
- **Mobile Navigation**: Hamburger menus and mobile-specific UI
- **Performance**: Mobile performance benchmarks

## Australian Pay Testing

Specialized tests for Australian pay calculations:

- **Currency Formatting**: AUD formatting with proper symbols
- **Award Rates**: Retail award overtime and penalty rates
- **Tax Calculations**: Australian tax brackets and HECS-HELP
- **Time Zones**: Australian timezone handling

## CI/CD Integration

Tests are configured for CI environments:

- **Parallel Execution**: Tests run in parallel for speed
- **Retry Logic**: Flaky test detection and retry
- **Artifact Collection**: Screenshots and videos on failure
- **Performance Monitoring**: Load time and console error tracking

## Writing Tests

### Unit Test Example
```typescript
// src/lib/calculations.test.ts
import { describe, it, expect } from 'vitest'
import { calculateGrossPay } from './calculations'

describe('calculateGrossPay', () => {
  it('should calculate regular hours correctly', () => {
    const result = calculateGrossPay({
      hours: 8,
      hourlyRate: 25.50,
      overtimeHours: 0
    })
    expect(result).toBe(204.00)
  })
})
```

### E2E Test Example
```typescript
// tests/e2e/shift-creation.spec.ts
import { test, expect } from '@playwright/test'
import { ShiftFormPage } from './pages/shift-form-page'

test('should create a shift successfully', async ({ page }) => {
  const shiftForm = new ShiftFormPage(page)
  await shiftForm.goto()
  
  await shiftForm.fillShiftForm({
    startTime: '09:00',
    endTime: '17:00',
    breakMinutes: 30
  })
  
  await shiftForm.saveShift()
  await expect(page).toHaveURL('**/shifts')
})
```

## Test Data & Fixtures

- **Mock Data**: Realistic Australian pay scenarios
- **Test Users**: Various tax situations (HECS, TFN, etc.)
- **Pay Guides**: Current Australian award rates
- **Shifts**: Regular, overtime, penalty rate scenarios

## Performance Testing

E2E tests include performance monitoring:

- **Load Times**: Pages must load within 3 seconds
- **Console Errors**: Zero console errors on load
- **Memory Usage**: Monitoring for memory leaks
- **Bundle Size**: Tracking bundle size changes

## Cross-Browser Testing

Tests run across:
- **Desktop**: Chrome, Firefox, Safari
- **Mobile**: iOS Safari, Android Chrome
- **Viewports**: 320px to 1920px wide
- **Features**: Touch, hover states, keyboard navigation

This comprehensive testing setup ensures Chrona works reliably across all target platforms and use cases.