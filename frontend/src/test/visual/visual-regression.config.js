/**
 * Visual regression testing configuration
 * Sets up Playwright with visual testing capabilities for UI components
 */

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './visual-tests',
  outputDir: 'test-results/',

  // Visual testing specific configuration
  expect: {
    // Threshold for visual differences (0.2 = 20% difference allowed)
    threshold: 0.2,
    // Animation handling
    animations: 'disabled',
  },

  // Test execution settings
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'visual-test-report' }],
    ['json', { outputFile: 'visual-test-results.json' }],
    process.env.CI ? ['github'] : ['list']
  ],

  use: {
    // Base URL for testing
    baseURL: 'http://localhost:3000',

    // Visual testing settings
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',

    // Viewport settings
    viewport: { width: 1280, height: 720 },

    // Ensure consistent rendering
    colorScheme: 'light',
    locale: 'en-US',
    timezoneId: 'America/New_York',

    // Reduce flakiness
    actionTimeout: 30000,
    navigationTimeout: 30000,
  },

  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Mobile devices
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },

    // Tablet
    {
      name: 'tablet',
      use: { ...devices['iPad Pro'] },
    },

    // High DPI
    {
      name: 'high-dpi',
      use: {
        ...devices['Desktop Chrome'],
        deviceScaleFactor: 2,
      },
    },

    // Dark mode
    {
      name: 'dark-mode',
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'dark',
      },
    },

    // RTL testing
    {
      name: 'rtl',
      use: {
        ...devices['Desktop Chrome'],
        locale: 'ar-SA',
      },
    },
  ],

  // Web server setup for testing
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },

  // Test match patterns
  testMatch: [
    '**/*.visual.spec.ts',
    '**/visual-tests/**/*.spec.ts'
  ],

  // Global setup and teardown
  globalSetup: require.resolve('./visual-setup.ts'),
  globalTeardown: require.resolve('./visual-teardown.ts'),
})