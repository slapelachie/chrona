import { Page, Locator } from '@playwright/test'
import { BasePage } from './base-page'
import { testShifts } from '../fixtures/test-data'

/**
 * Shift Form Page Object Model
 */
export class ShiftFormPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  async goto(): Promise<void> {
    await this.page.goto('/shifts/new')
    await this.waitForLoad()
  }

  /**
   * Form elements
   */
  get dateInput(): Locator {
    return this.page.locator('input[name="date"], input[type="date"]')
  }

  get startTimeInput(): Locator {
    return this.page.locator('input[name="startTime"], input[name="start-time"]')
  }

  get endTimeInput(): Locator {
    return this.page.locator('input[name="endTime"], input[name="end-time"]')
  }

  get breakMinutesInput(): Locator {
    return this.page.locator('input[name="breakMinutes"], input[name="break-minutes"]')
  }

  get payRateSelector(): Locator {
    return this.page.locator('select[name="payGuideId"], select[name="pay-rate"]')
  }

  get shiftTypeSelector(): Locator {
    return this.page.locator('select[name="shiftType"], select[name="shift-type"]')
  }

  get locationInput(): Locator {
    return this.page.locator('input[name="location"]')
  }

  get notesInput(): Locator {
    return this.page.locator('textarea[name="notes"], input[name="notes"]')
  }

  get saveButton(): Locator {
    return this.page.locator('button[type="submit"]:has-text("Save"), .btn-primary:has-text("Save")')
  }

  get previewSection(): Locator {
    return this.page.locator('.shift-preview, .calculation-preview')
  }

  get totalHoursDisplay(): Locator {
    return this.page.locator('.total-hours-display, [data-testid="total-hours"]')
  }

  get grossPayDisplay(): Locator {
    return this.page.locator('.gross-pay-display, [data-testid="gross-pay"]')
  }

  get overtimeHoursDisplay(): Locator {
    return this.page.locator('.overtime-hours-display, [data-testid="overtime-hours"]')
  }

  get penaltyHoursDisplay(): Locator {
    return this.page.locator('.penalty-hours-display, [data-testid="penalty-hours"]')
  }

  /**
   * Actions
   */
  async fillShiftForm(shift: typeof testShifts.regularShift, date?: Date): Promise<void> {
    const shiftDate = date || new Date()
    
    // Fill date
    await this.fillDate(shiftDate)
    
    // Fill time inputs
    await this.startTimeInput.fill(shift.startTime)
    await this.endTimeInput.fill(shift.endTime)
    
    // Fill break minutes
    await this.breakMinutesInput.fill(shift.breakMinutes.toString())
    
    // Select shift type
    await this.shiftTypeSelector.selectOption(shift.shiftType)
    
    // Fill optional fields
    if (shift.location) {
      await this.locationInput.fill(shift.location)
    }
    
    if (shift.notes) {
      await this.notesInput.fill(shift.notes)
    }
  }

  async fillDate(date: Date): Promise<void> {
    const formattedDate = date.toISOString().split('T')[0]
    await this.dateInput.fill(formattedDate)
  }

  async selectPayRate(payRateName: string): Promise<void> {
    await this.payRateSelector.selectOption({ label: payRateName })
  }

  async saveShift(): Promise<void> {
    await this.saveButton.click()
    await this.page.waitForLoadState('networkidle')
  }

  /**
   * Preview calculations
   */
  async getCalculationPreview(): Promise<{
    totalHours: string
    grossPay: string
    overtimeHours: string
    penaltyHours: string
  }> {
    await this.previewSection.waitFor({ state: 'visible' })
    
    const totalHours = await this.totalHoursDisplay.textContent() || '0'
    const grossPay = await this.grossPayDisplay.textContent() || '$0.00'
    const overtimeHours = await this.overtimeHoursDisplay.textContent() || '0'
    const penaltyHours = await this.penaltyHoursDisplay.textContent() || '0'
    
    return {
      totalHours: totalHours.trim(),
      grossPay: grossPay.trim(),
      overtimeHours: overtimeHours.trim(),
      penaltyHours: penaltyHours.trim(),
    }
  }

  /**
   * Wait for preview to update after form changes
   */
  async waitForPreviewUpdate(): Promise<void> {
    await this.page.waitForTimeout(500) // Debounce delay
    await this.previewSection.waitFor({ state: 'visible' })
  }

  /**
   * Verify form validation
   */
  async getValidationErrors(): Promise<string[]> {
    const errors: string[] = []
    
    const errorElements = await this.page.locator('.invalid-feedback, .error-message, .field-error').all()
    
    for (const element of errorElements) {
      const errorText = await element.textContent()
      if (errorText) {
        errors.push(errorText.trim())
      }
    }
    
    return errors
  }

  /**
   * Check if form is valid (no error states)
   */
  async isFormValid(): Promise<boolean> {
    const invalidFields = await this.page.locator('.is-invalid, .error').count()
    return invalidFields === 0
  }
}