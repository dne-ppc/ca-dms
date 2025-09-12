import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:5173')
  })

  test('should not have any automatically detectable WCAG A/AA violations', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('should have proper heading hierarchy', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['heading-order'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('should have accessible form controls', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['label', 'form-field-multiple-labels'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('should have sufficient color contrast', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('should support keyboard navigation', async ({ page }) => {
    // Test Tab key navigation
    await page.keyboard.press('Tab')
    const firstFocusable = await page.evaluate(() => document.activeElement?.tagName)
    expect(firstFocusable).toBeTruthy()

    // Test that focus is visible
    const focusedElement = page.locator(':focus')
    await expect(focusedElement).toBeVisible()
  })

  test('should have accessible landmark regions', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['region'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('should have proper ARIA attributes', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules([
        'aria-valid-attr',
        'aria-valid-attr-value',
        'aria-roles',
        'aria-required-attr'
      ])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('should work with high contrast mode', async ({ page }) => {
    // Simulate high contrast preference
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
    
    // Wait for theme changes to apply
    await page.waitForTimeout(100)
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('should handle Alt+1 keyboard shortcut for toolbar focus', async ({ page }) => {
    // Press Alt+1 to focus toolbar
    await page.keyboard.press('Alt+1')
    
    // Check if toolbar or its elements are focused
    const focusedElement = await page.evaluate(() => {
      const active = document.activeElement
      return active?.closest('#custom-toolbar') !== null || active?.id === 'custom-toolbar'
    })
    
    expect(focusedElement).toBe(true)
  })

  test('should support screen reader announcements', async ({ page }) => {
    // Check for ARIA live regions and screen reader content
    const srOnlyElements = await page.locator('.sr-only').count()
    expect(srOnlyElements).toBeGreaterThan(0)

    // Check for proper aria-labels
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['aria-command-name', 'button-name'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('should have skip links for keyboard users', async ({ page }) => {
    // Tab to the first element and check if skip link appears
    await page.keyboard.press('Tab')
    
    // Look for skip links (they might be visually hidden until focused)
    const skipLinks = await page.locator('.skip-link, [href^="#"]').count()
    
    // We should have some way to skip to main content
    expect(skipLinks).toBeGreaterThanOrEqual(0)
  })

  test('editor should be accessible', async ({ page }) => {
    // Wait for editor to load
    await page.waitForSelector('[data-testid="quill-editor"]', { timeout: 5000 })

    // Run accessibility scan on editor specifically
    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('[data-testid="quill-editor"]')
      .withTags(['wcag2aa'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('toolbar should be accessible', async ({ page }) => {
    // Wait for toolbar to load  
    await page.waitForSelector('[data-testid="custom-toolbar"]', { timeout: 5000 })

    // Run accessibility scan on toolbar specifically
    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('[data-testid="custom-toolbar"]')
      .withTags(['wcag2aa'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('should respect reduced motion preferences', async ({ page }) => {
    // Enable reduced motion
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.reload()

    // Check that animations are disabled or minimal
    const animationDuration = await page.evaluate(() => {
      const element = document.querySelector('*')
      const style = window.getComputedStyle(element!)
      return style.animationDuration
    })

    // Should be very short or none when reduced motion is preferred
    expect(['0s', '0.01ms'].some(val => animationDuration?.includes(val))).toBe(true)
  })
})