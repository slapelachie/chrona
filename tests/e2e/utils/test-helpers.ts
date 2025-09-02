import { Page, expect } from '@playwright/test'

/**
 * Helper utilities for Playwright E2E tests
 */

/**
 * Wait for the Next.js app to be fully loaded
 */
export async function waitForAppLoad(page: Page) {
  // Wait for the Next.js hydration to complete
  await page.waitForLoadState('networkidle')
  await page.waitForSelector('body', { state: 'attached' })
}

/**
 * Check if the page has Bootstrap CSS loaded
 */
export async function expectBootstrapLoaded(page: Page) {
  // Check if Bootstrap CSS classes are applied
  const hasBootstrapContainer = await page.locator('.container, .container-fluid').count()
  expect(hasBootstrapContainer).toBeGreaterThan(0)
}

/**
 * Test mobile responsiveness by changing viewport
 */
export async function testMobileViewport(page: Page, callback: () => Promise<void>) {
  // Test mobile viewport (iPhone 12 size)
  await page.setViewportSize({ width: 390, height: 844 })
  await callback()
  
  // Reset to desktop
  await page.setViewportSize({ width: 1280, height: 720 })
}

/**
 * Test tablet responsiveness
 */
export async function testTabletViewport(page: Page, callback: () => Promise<void>) {
  // Test tablet viewport (iPad size)
  await page.setViewportSize({ width: 768, height: 1024 })
  await callback()
  
  // Reset to desktop
  await page.setViewportSize({ width: 1280, height: 720 })
}

/**
 * Helper to fill Australian currency input
 */
export async function fillAustralianCurrency(page: Page, selector: string, amount: number) {
  await page.fill(selector, amount.toFixed(2))
}

/**
 * Helper to verify Australian currency formatting
 */
export async function expectAustralianCurrency(page: Page, selector: string, expectedAmount: number) {
  const text = await page.textContent(selector)
  const formattedExpected = new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD'
  }).format(expectedAmount)
  
  expect(text?.trim()).toBe(formattedExpected)
}

/**
 * Helper to fill date input with Australian date format
 */
export async function fillAustralianDate(page: Page, selector: string, date: Date) {
  const formattedDate = date.toISOString().split('T')[0]
  await page.fill(selector, formattedDate)
}

/**
 * Helper to fill time input
 */
export async function fillTime(page: Page, selector: string, hours: number, minutes: number = 0) {
  const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  await page.fill(selector, timeString)
}

/**
 * Helper for testing touch interactions on mobile
 */
export async function testTouchInteraction(page: Page, selector: string) {
  // Simulate touch tap
  await page.tap(selector)
  
  // Verify the element is accessible with proper touch target size
  const elementBox = await page.locator(selector).boundingBox()
  if (elementBox) {
    // Bootstrap recommends minimum 44px touch target
    expect(elementBox.width).toBeGreaterThanOrEqual(44)
    expect(elementBox.height).toBeGreaterThanOrEqual(44)
  }
}