/**
 * Global setup for visual regression tests
 * Prepares test environment and baseline images
 */

import { chromium, FullConfig } from '@playwright/test'
import path from 'path'
import fs from 'fs/promises'

async function globalSetup(config: FullConfig) {
  console.log('Setting up visual regression testing environment...')

  // Create necessary directories
  const directories = [
    'test-results',
    'visual-test-report',
    'test-results/visual-baselines',
    'test-results/visual-failures',
    'test-results/visual-diffs'
  ]

  for (const dir of directories) {
    await fs.mkdir(dir, { recursive: true })
  }

  // Launch browser for setup operations
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    colorScheme: 'light',
    locale: 'en-US',
    timezoneId: 'America/New_York'
  })

  try {
    // Pre-warm the application if needed
    const page = await context.newPage()
    await page.goto('http://localhost:3000')

    // Wait for app to be ready
    await page.waitForSelector('[data-testid="app-ready"]', {
      timeout: 30000,
      state: 'visible'
    }).catch(() => {
      console.log('App ready indicator not found, continuing...')
    })

    // Set up test data if needed
    await page.evaluate(() => {
      // Clear any existing test data
      localStorage.clear()
      sessionStorage.clear()

      // Set up consistent test state
      localStorage.setItem('visual-test-mode', 'true')
      localStorage.setItem('theme', 'light')
      localStorage.setItem('language', 'en')
    })

    console.log('Visual regression environment setup complete')

  } catch (error) {
    console.error('Failed to setup visual regression environment:', error)
    throw error
  } finally {
    await context.close()
    await browser.close()
  }
}

export default globalSetup