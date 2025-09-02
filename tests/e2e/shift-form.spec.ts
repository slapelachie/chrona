import { test, expect } from '@playwright/test'
import { ShiftFormPage } from './pages/shift-form-page'
import { testShifts, expectedCalculations } from './fixtures/test-data'
import { waitForAppLoad, fillTime, expectAustralianCurrency } from './utils/test-helpers'

test.describe('Shift Form', () => {
  test.beforeEach(async ({ page }) => {
    // Skip if shift form doesn't exist yet
    const response = await page.goto('/shifts/new')
    if (response?.status() === 404) {
      test.skip()
    }
  })

  test('should load shift form successfully', async ({ page }) => {
    const shiftForm = new ShiftFormPage(page)
    
    await shiftForm.goto()
    await waitForAppLoad(page)
    
    // Verify form elements are present
    await expect(shiftForm.dateInput).toBeVisible()
    await expect(shiftForm.startTimeInput).toBeVisible()
    await expect(shiftForm.endTimeInput).toBeVisible()
    await expect(shiftForm.saveButton).toBeVisible()
  })

  test('should calculate pay correctly for regular shift', async ({ page }) => {
    const shiftForm = new ShiftFormPage(page)
    await shiftForm.goto()
    
    // Fill out a regular shift
    await shiftForm.fillShiftForm(testShifts.regularShift)
    
    // Wait for calculations to update
    await shiftForm.waitForPreviewUpdate()
    
    // Verify calculations
    const preview = await shiftForm.getCalculationPreview()
    expect(preview.totalHours).toBe(expectedCalculations.regularShift.totalHours.toString())
    
    // Verify Australian currency formatting
    await expectAustralianCurrency(
      page,
      shiftForm.grossPayDisplay.toString(),
      expectedCalculations.regularShift.grossPay
    )
  })

  test('should validate required fields', async ({ page }) => {
    const shiftForm = new ShiftFormPage(page)
    await shiftForm.goto()
    
    // Try to submit empty form
    await shiftForm.saveButton.click()
    
    // Check for validation errors
    const errors = await shiftForm.getValidationErrors()
    expect(errors.length).toBeGreaterThan(0)
    
    // Form should not be valid
    const isValid = await shiftForm.isFormValid()
    expect(isValid).toBe(false)
  })

  test('should handle time inputs correctly', async ({ page }) => {
    const shiftForm = new ShiftFormPage(page)
    await shiftForm.goto()
    
    // Test time input helpers
    await fillTime(page, 'input[name="startTime"]', 9, 30) // 9:30 AM
    await fillTime(page, 'input[name="endTime"]', 17, 45)  // 5:45 PM
    
    // Verify values were set
    await expect(shiftForm.startTimeInput).toHaveValue('09:30')
    await expect(shiftForm.endTimeInput).toHaveValue('17:45')
  })

  test('should be mobile responsive', async ({ page }) => {
    const shiftForm = new ShiftFormPage(page)
    
    // Set mobile viewport
    await page.setViewportSize({ width: 390, height: 844 })
    await shiftForm.goto()
    
    // Verify form is usable on mobile
    await expect(shiftForm.dateInput).toBeVisible()
    await expect(shiftForm.startTimeInput).toBeVisible()
    await expect(shiftForm.saveButton).toBeVisible()
    
    // Verify mobile form layout
    await shiftForm.verifyMobileLayout()
  })

  test('should update preview in real-time', async ({ page }) => {
    const shiftForm = new ShiftFormPage(page)
    await shiftForm.goto()
    
    // Start with empty form
    let preview = await shiftForm.getCalculationPreview()
    expect(preview.grossPay).toBe('$0.00')
    
    // Fill start and end times
    await shiftForm.startTimeInput.fill('09:00')
    await shiftForm.endTimeInput.fill('17:00')
    
    // Wait for preview to update
    await shiftForm.waitForPreviewUpdate()
    
    // Preview should now show calculated values
    preview = await shiftForm.getCalculationPreview()
    expect(preview.grossPay).not.toBe('$0.00')
    expect(parseFloat(preview.totalHours)).toBeGreaterThan(0)
  })
})

test.describe('Shift Form - Pay Calculations', () => {
  test.skip('should calculate overtime correctly', async ({ page }) => {
    // Skip until overtime logic is implemented
    const shiftForm = new ShiftFormPage(page)
    await shiftForm.goto()
    
    // Fill overtime shift
    await shiftForm.fillShiftForm(testShifts.overtimeShift)
    await shiftForm.waitForPreviewUpdate()
    
    const preview = await shiftForm.getCalculationPreview()
    expect(preview.overtimeHours).toBe(expectedCalculations.overtimeShift.overtimeHours.toString())
  })

  test.skip('should calculate penalty rates correctly', async ({ page }) => {
    // Skip until penalty rate logic is implemented
    const shiftForm = new ShiftFormPage(page)
    await shiftForm.goto()
    
    // Fill weekend shift
    const weekendDate = new Date('2024-12-07') // Saturday
    await shiftForm.fillShiftForm(testShifts.weekendShift, weekendDate)
    await shiftForm.waitForPreviewUpdate()
    
    const preview = await shiftForm.getCalculationPreview()
    expect(parseFloat(preview.penaltyHours)).toBeGreaterThan(0)
  })
})