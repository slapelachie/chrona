import { test, expect } from '@playwright/test'
import { HomePage } from './pages/home-page'
import { waitForAppLoad, expectBootstrapLoaded, testMobileViewport } from './utils/test-helpers'

test.describe('Homepage', () => {
  test('should load successfully and display core elements', async ({ page }) => {
    const homePage = new HomePage(page)
    
    await homePage.goto()
    await waitForAppLoad(page)
    
    // Verify the page loads with proper title
    await expect(page).toHaveTitle(/Chrona/)
    
    // Verify Bootstrap is loaded
    await expectBootstrapLoaded(page)
    
    // Verify basic page structure exists
    await expect(page.locator('body')).toBeVisible()
  })

  test('should be mobile responsive', async ({ page }) => {
    const homePage = new HomePage(page)
    
    await homePage.goto()
    
    // Test mobile viewport
    await testMobileViewport(page, async () => {
      await homePage.verifyMobileLayout()
      
      // Verify key elements are still visible on mobile
      await expect(page.locator('body')).toBeVisible()
    })
  })

  test('should have proper meta tags for mobile', async ({ page }) => {
    await page.goto('/')
    
    // Check for mobile-friendly meta tags
    const viewportMeta = page.locator('meta[name="viewport"]')
    await expect(viewportMeta).toHaveAttribute('content', /width=device-width/)
    
    // Check for responsive design indicators
    const hasBootstrapContainer = await page.locator('.container, .container-fluid').count()
    expect(hasBootstrapContainer).toBeGreaterThan(0)
  })

  test('should handle different screen sizes gracefully', async ({ page }) => {
    const homePage = new HomePage(page)
    await homePage.goto()
    
    const screenSizes = [
      { width: 320, height: 568, name: 'mobile-small' },   // iPhone SE
      { width: 390, height: 844, name: 'mobile-large' },  // iPhone 12
      { width: 768, height: 1024, name: 'tablet' },       // iPad
      { width: 1280, height: 720, name: 'desktop' },      // Desktop
    ]
    
    for (const size of screenSizes) {
      await page.setViewportSize({ width: size.width, height: size.height })
      await page.waitForTimeout(500) // Allow layout to adjust
      
      // Verify page is still functional at this size
      await expect(page.locator('body')).toBeVisible()
      
      // Take screenshot for visual regression testing
      await page.screenshot({ 
        path: `tests/screenshots/homepage-${size.name}.png`,
        fullPage: true 
      })
    }
  })
})

test.describe('App Performance', () => {
  test('should load within acceptable time limits', async ({ page }) => {
    const startTime = Date.now()
    
    await page.goto('/')
    await waitForAppLoad(page)
    
    const loadTime = Date.now() - startTime
    
    // Should load within 3 seconds (adjust as needed)
    expect(loadTime).toBeLessThan(3000)
  })

  test('should have no console errors on initial load', async ({ page }) => {
    const consoleErrors: string[] = []
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })
    
    await page.goto('/')
    await waitForAppLoad(page)
    
    // Allow for any async operations to complete
    await page.waitForTimeout(1000)
    
    // Should have no console errors
    expect(consoleErrors).toHaveLength(0)
  })
})