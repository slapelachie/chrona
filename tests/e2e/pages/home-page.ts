import { Page, Locator } from '@playwright/test'
import { BasePage } from './base-page'

/**
 * Home Page Object Model
 */
export class HomePage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  async goto(): Promise<void> {
    await this.page.goto('/')
    await this.waitForLoad()
  }

  /**
   * Page-specific elements
   */
  get welcomeMessage(): Locator {
    return this.page.locator('h1, .welcome-title')
  }

  get quickActionsSection(): Locator {
    return this.page.locator('.quick-actions, .action-cards')
  }

  get addShiftButton(): Locator {
    return this.page.locator('button:has-text("Add Shift"), a:has-text("Add Shift")')
  }

  get viewShiftsButton(): Locator {
    return this.page.locator('button:has-text("View Shifts"), a:has-text("View Shifts")')
  }

  get recentShiftsSection(): Locator {
    return this.page.locator('.recent-shifts, .shift-list')
  }

  get payPeriodSummary(): Locator {
    return this.page.locator('.pay-period-summary, .current-period')
  }

  /**
   * Actions
   */
  async clickAddShift(): Promise<void> {
    await this.addShiftButton.click()
    await this.page.waitForURL('**/shifts/new')
  }

  async clickViewShifts(): Promise<void> {
    await this.viewShiftsButton.click()
    await this.page.waitForURL('**/shifts')
  }

  async navigateToPayRates(): Promise<void> {
    await this.payRatesLink.click()
    await this.page.waitForURL('**/pay-rates')
  }

  /**
   * Verify home page elements
   */
  async verifyHomePageElements(): Promise<void> {
    await this.welcomeMessage.waitFor({ state: 'visible' })
    await this.quickActionsSection.waitFor({ state: 'visible' })
  }

  /**
   * Check if there are recent shifts displayed
   */
  async hasRecentShifts(): Promise<boolean> {
    const recentShiftsCount = await this.recentShiftsSection.locator('.shift-item, .shift-card').count()
    return recentShiftsCount > 0
  }

  /**
   * Get current pay period information
   */
  async getPayPeriodInfo(): Promise<{ period: string; totalHours: string; grossPay: string } | null> {
    const summaryExists = await this.payPeriodSummary.count() > 0
    if (!summaryExists) return null

    const period = await this.payPeriodSummary.locator('.period-dates').textContent() || ''
    const totalHours = await this.payPeriodSummary.locator('.total-hours').textContent() || ''
    const grossPay = await this.payPeriodSummary.locator('.gross-pay').textContent() || ''

    return { period, totalHours, grossPay }
  }
}