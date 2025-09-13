/**
 * Global teardown for visual regression tests
 * Cleans up test environment and generates reports
 */

import { FullConfig } from '@playwright/test'
import fs from 'fs/promises'
import path from 'path'

async function globalTeardown(config: FullConfig) {
  console.log('Cleaning up visual regression testing environment...')

  try {
    // Generate visual test summary
    await generateVisualTestSummary()

    // Clean up temporary files if not in CI
    if (!process.env.CI) {
      await cleanupTemporaryFiles()
    }

    // Archive test results if in CI
    if (process.env.CI) {
      await archiveTestResults()
    }

    console.log('Visual regression cleanup complete')

  } catch (error) {
    console.error('Failed to cleanup visual regression environment:', error)
    // Don't throw to avoid failing the entire test suite
  }
}

async function generateVisualTestSummary() {
  const resultDir = 'test-results'
  const reportPath = path.join(resultDir, 'visual-summary.json')

  const summary = {
    timestamp: new Date().toISOString(),
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    skippedTests: 0,
    visualDifferences: [],
    environment: {
      node: process.version,
      os: process.platform,
      ci: !!process.env.CI
    }
  }

  // Read test results if available
  try {
    const resultsFile = path.join(resultDir, 'visual-test-results.json')
    const results = await fs.readFile(resultsFile, 'utf8')
    const testResults = JSON.parse(results)

    summary.totalTests = testResults.suites?.length || 0
    summary.passedTests = testResults.suites?.filter((s: any) => s.outcome === 'expected').length || 0
    summary.failedTests = testResults.suites?.filter((s: any) => s.outcome === 'unexpected').length || 0
    summary.skippedTests = testResults.suites?.filter((s: any) => s.outcome === 'skipped').length || 0

  } catch (error) {
    console.log('No test results file found, generating empty summary')
  }

  await fs.writeFile(reportPath, JSON.stringify(summary, null, 2))
  console.log(`Visual test summary written to ${reportPath}`)
}

async function cleanupTemporaryFiles() {
  const tempDirs = [
    'test-results/temp',
    'test-results/screenshots/temp'
  ]

  for (const dir of tempDirs) {
    try {
      await fs.rm(dir, { recursive: true, force: true })
    } catch (error) {
      // Directory might not exist, ignore
    }
  }
}

async function archiveTestResults() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const archiveDir = `test-results/archive/${timestamp}`

  await fs.mkdir(archiveDir, { recursive: true })

  // Copy important files to archive
  const filesToArchive = [
    'visual-test-report',
    'visual-test-results.json',
    'visual-summary.json'
  ]

  for (const file of filesToArchive) {
    const sourcePath = path.join('test-results', file)
    const destPath = path.join(archiveDir, file)

    try {
      await fs.cp(sourcePath, destPath, { recursive: true })
    } catch (error) {
      console.log(`Could not archive ${file}:`, error.message)
    }
  }

  console.log(`Test results archived to ${archiveDir}`)
}

export default globalTeardown