/**
 * Visual regression tests for key UI components
 * Tests visual consistency across browsers and viewports
 */

import { test, expect } from '@playwright/test'

test.describe('Component Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set consistent state for visual tests
    await page.addInitScript(() => {
      localStorage.setItem('visual-test-mode', 'true')
      localStorage.setItem('theme', 'light')
    })

    // Navigate to test page
    await page.goto('/visual-test-components')

    // Wait for components to be ready
    await page.waitForSelector('[data-testid="components-loaded"]', {
      timeout: 10000
    })

    // Disable animations for consistent screenshots
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `
    })
  })

  test.describe('Layout Components', () => {
    test('Sidebar - collapsed state', async ({ page }) => {
      await page.click('[data-testid="sidebar-toggle"]')
      await page.waitForTimeout(100) // Allow state to settle

      await expect(page.locator('[data-testid="sidebar"]')).toHaveScreenshot('sidebar-collapsed.png')
    })

    test('Sidebar - expanded state', async ({ page }) => {
      await page.click('[data-testid="sidebar-toggle"]')
      await page.click('[data-testid="sidebar-toggle"]') // Toggle back to expanded
      await page.waitForTimeout(100)

      await expect(page.locator('[data-testid="sidebar"]')).toHaveScreenshot('sidebar-expanded.png')
    })

    test('MainContent area', async ({ page }) => {
      await expect(page.locator('[data-testid="main-content"]')).toHaveScreenshot('main-content.png')
    })

    test('Mobile navigation overlay', async ({ page }) => {
      // Simulate mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      await page.click('[data-testid="mobile-nav-toggle"]')
      await page.waitForTimeout(100)

      await expect(page.locator('[data-testid="mobile-navigation"]')).toHaveScreenshot('mobile-nav-overlay.png')
    })
  })

  test.describe('Editor Components', () => {
    test('Quill editor - empty state', async ({ page }) => {
      await page.goto('/editor')
      await page.waitForSelector('[data-testid="quill-editor"]')

      await expect(page.locator('[data-testid="quill-editor"]')).toHaveScreenshot('editor-empty.png')
    })

    test('Quill editor - with content', async ({ page }) => {
      await page.goto('/editor')
      await page.waitForSelector('[data-testid="quill-editor"]')

      // Add some content
      await page.fill('[data-testid="quill-editor"] .ql-editor', 'Sample document content with formatting')
      await page.waitForTimeout(100)

      await expect(page.locator('[data-testid="quill-editor"]')).toHaveScreenshot('editor-with-content.png')
    })

    test('Placeholder config panel', async ({ page }) => {
      await page.goto('/editor')
      await page.click('[data-testid="placeholder-config-button"]')
      await page.waitForSelector('[data-testid="placeholder-config-panel"]')

      await expect(page.locator('[data-testid="placeholder-config-panel"]')).toHaveScreenshot('placeholder-config-panel.png')
    })

    test('Rich text editor toolbar', async ({ page }) => {
      await page.goto('/editor')
      await page.waitForSelector('[data-testid="rich-text-toolbar"]')

      await expect(page.locator('[data-testid="rich-text-toolbar"]')).toHaveScreenshot('rich-text-toolbar.png')
    })

    test('Mobile editor interface', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/editor')
      await page.waitForSelector('[data-testid="mobile-editor"]')

      await expect(page.locator('[data-testid="mobile-editor"]')).toHaveScreenshot('mobile-editor.png')
    })
  })

  test.describe('PWA Components', () => {
    test('PWA status - offline indicator', async ({ page }) => {
      // Simulate offline state
      await page.context().setOffline(true)
      await page.reload()
      await page.waitForSelector('[data-testid="pwa-status"]')

      await expect(page.locator('[data-testid="pwa-status"]')).toHaveScreenshot('pwa-offline.png')
    })

    test('PWA status - install prompt', async ({ page }) => {
      // Mock install prompt
      await page.evaluate(() => {
        window.dispatchEvent(new Event('beforeinstallprompt'))
      })
      await page.waitForSelector('[data-testid="pwa-install-prompt"]')

      await expect(page.locator('[data-testid="pwa-install-prompt"]')).toHaveScreenshot('pwa-install-prompt.png')
    })

    test('PWA status - update available', async ({ page }) => {
      // Mock update available
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('swupdatefound'))
      })
      await page.waitForSelector('[data-testid="pwa-update-prompt"]')

      await expect(page.locator('[data-testid="pwa-update-prompt"]')).toHaveScreenshot('pwa-update-prompt.png')
    })
  })

  test.describe('Form Components', () => {
    test('Document template form', async ({ page }) => {
      await page.goto('/templates/new')
      await page.waitForSelector('[data-testid="template-form"]')

      await expect(page.locator('[data-testid="template-form"]')).toHaveScreenshot('template-form.png')
    })

    test('Workflow conditions form', async ({ page }) => {
      await page.goto('/workflows/conditions')
      await page.waitForSelector('[data-testid="workflow-conditions"]')

      await expect(page.locator('[data-testid="workflow-conditions"]')).toHaveScreenshot('workflow-conditions.png')
    })

    test('User settings form', async ({ page }) => {
      await page.goto('/settings')
      await page.waitForSelector('[data-testid="settings-form"]')

      await expect(page.locator('[data-testid="settings-form"]')).toHaveScreenshot('settings-form.png')
    })
  })

  test.describe('Responsive Design', () => {
    test('Desktop layout - 1920px', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 })
      await page.goto('/')

      await expect(page).toHaveScreenshot('desktop-1920.png', { fullPage: true })
    })

    test('Tablet layout - 768px', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 })
      await page.goto('/')

      await expect(page).toHaveScreenshot('tablet-768.png', { fullPage: true })
    })

    test('Mobile layout - 375px', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/')

      await expect(page).toHaveScreenshot('mobile-375.png', { fullPage: true })
    })

    test('Small mobile layout - 320px', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 })
      await page.goto('/')

      await expect(page).toHaveScreenshot('mobile-320.png', { fullPage: true })
    })
  })

  test.describe('Theme Variations', () => {
    test('Light theme', async ({ page }) => {
      await page.addInitScript(() => {
        localStorage.setItem('theme', 'light')
      })
      await page.goto('/')

      await expect(page).toHaveScreenshot('theme-light.png', { fullPage: true })
    })

    test('Dark theme', async ({ page }) => {
      await page.addInitScript(() => {
        localStorage.setItem('theme', 'dark')
      })
      await page.goto('/')

      await expect(page).toHaveScreenshot('theme-dark.png', { fullPage: true })
    })

    test('High contrast theme', async ({ page }) => {
      await page.addInitScript(() => {
        localStorage.setItem('theme', 'high-contrast')
      })
      await page.goto('/')

      await expect(page).toHaveScreenshot('theme-high-contrast.png', { fullPage: true })
    })
  })

  test.describe('State Variations', () => {
    test('Loading states', async ({ page }) => {
      // Intercept API calls to simulate loading
      await page.route('/api/**', route => {
        // Don't fulfill to keep in loading state
        return new Promise(() => {})
      })

      await page.goto('/')
      await page.waitForSelector('[data-testid="loading-spinner"]')

      await expect(page.locator('[data-testid="main-content"]')).toHaveScreenshot('loading-state.png')
    })

    test('Error states', async ({ page }) => {
      // Mock API error
      await page.route('/api/**', route => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Server error' })
        })
      })

      await page.goto('/')
      await page.waitForSelector('[data-testid="error-message"]')

      await expect(page.locator('[data-testid="error-message"]')).toHaveScreenshot('error-state.png')
    })

    test('Empty states', async ({ page }) => {
      // Mock empty data response
      await page.route('/api/documents', route => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ documents: [] })
        })
      })

      await page.goto('/documents')
      await page.waitForSelector('[data-testid="empty-state"]')

      await expect(page.locator('[data-testid="empty-state"]')).toHaveScreenshot('empty-state.png')
    })
  })

  test.describe('Accessibility Visual Tests', () => {
    test('Focus indicators', async ({ page }) => {
      await page.goto('/')

      // Tab through focusable elements and capture focus states
      await page.keyboard.press('Tab')
      await expect(page).toHaveScreenshot('focus-first-element.png')

      await page.keyboard.press('Tab')
      await expect(page).toHaveScreenshot('focus-second-element.png')

      await page.keyboard.press('Tab')
      await expect(page).toHaveScreenshot('focus-third-element.png')
    })

    test('High contrast mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark', forcedColors: 'active' })
      await page.goto('/')

      await expect(page).toHaveScreenshot('high-contrast-forced.png', { fullPage: true })
    })

    test('Reduced motion', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto('/')

      await expect(page).toHaveScreenshot('reduced-motion.png', { fullPage: true })
    })
  })

  test.describe('Print Styles', () => {
    test('Print layout', async ({ page }) => {
      await page.goto('/documents/1')
      await page.emulateMedia({ media: 'print' })

      await expect(page).toHaveScreenshot('print-layout.png', { fullPage: true })
    })

    test('Print editor', async ({ page }) => {
      await page.goto('/editor')
      await page.emulateMedia({ media: 'print' })

      await expect(page).toHaveScreenshot('print-editor.png', { fullPage: true })
    })
  })
})