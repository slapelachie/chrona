import { Page, Locator } from '@playwright/test'

/**
 * Base Page Object Model for common functionality
 */
export abstract class BasePage {
  constructor(protected page: Page) {}

  /**
   * Navigate to the page
   */
  abstract goto(): Promise<void>

  /**
   * Common navigation elements
   */
  get navigationBar(): Locator {
    return this.page.locator('nav, .navbar')
  }

  get homeLink(): Locator {
    return this.page.locator('a[href="/"], a[href="/home"]')
  }

  get shiftsLink(): Locator {
    return this.page.locator('a[href="/shifts"]')
  }

  get payRatesLink(): Locator {
    return this.page.locator('a[href="/pay-rates"]')
  }

  /**
   * Common form elements
   */
  get submitButton(): Locator {
    return this.page.locator('button[type="submit"], .btn-primary')
  }

  get cancelButton(): Locator {
    return this.page.locator('button[type="button"]:has-text("Cancel"), .btn-secondary:has-text("Cancel")')
  }

  get loadingSpinner(): Locator {
    return this.page.locator('.spinner-border, .loading')
  }

  /**
   * Common alert/notification elements
   */
  get successAlert(): Locator {
    return this.page.locator('.alert-success, .toast-success')
  }

  get errorAlert(): Locator {
    return this.page.locator('.alert-danger, .toast-error')
  }

  get warningAlert(): Locator {
    return this.page.locator('.alert-warning, .toast-warning')
  }

  /**
   * Wait for page to be fully loaded
   */
  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle')
    await this.page.waitForSelector('body', { state: 'attached' })
  }

  /**
   * Check if Bootstrap is loaded
   */
  async isBootstrapLoaded(): Promise<boolean> {
    const containerCount = await this.page.locator('.container, .container-fluid').count()
    return containerCount > 0
  }

  /**
   * Get current page title
   */
  async getTitle(): Promise<string> {
    return await this.page.title()
  }

  /**
   * Take a screenshot for debugging
   */
  async takeScreenshot(name: string): Promise<void> {
    await this.page.screenshot({ path: `tests/screenshots/${name}.png` })
  }

  /**
   * Fill form field with error handling
   */
  async fillField(selector: string, value: string): Promise<void> {
    await this.page.fill(selector, value)
  }

  /**
   * Click element with waiting
   */
  async clickElement(selector: string): Promise<void> {
    await this.page.click(selector)
  }

  /**
   * Verify mobile responsiveness
   */
  async verifyMobileLayout(): Promise<void> {
    const viewport = this.page.viewportSize()
    if (viewport && viewport.width <= 768) {
      // Verify mobile-specific elements are visible
      const mobileMenu = this.page.locator('.navbar-toggler, .mobile-menu')
      const hasMobileMenu = await mobileMenu.count()
      // Mobile menu should exist for small screens
      if (hasMobileMenu === 0) {
        throw new Error('Mobile menu not found on mobile viewport')
      }
    }
  }
}