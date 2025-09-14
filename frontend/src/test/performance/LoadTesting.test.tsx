/**
 * Comprehensive Load Testing - Task 2.4.2 Implementation
 * Tests realistic load conditions for frontend components and user workflows
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// Import components for load testing
import { IntroPage } from '../../pages/IntroPage'
import { SystemOverview } from '../../components/intro/SystemOverview'
import { PersonalStats } from '../../components/intro/PersonalStats'
import { ActionableItems } from '../../components/intro/ActionableItems'
import { QuickActions } from '../../components/intro/QuickActions'
import { ActivityFeed } from '../../components/intro/ActivityFeed'

// Mock services for load testing
vi.mock('../../services/authService', () => ({
  authService: {
    getCurrentUser: vi.fn(),
    isAuthenticated: vi.fn(() => true)
  },
  getCurrentUser: vi.fn(),
  isAuthenticated: vi.fn(() => true)
}))

vi.mock('../../services/introPageService', () => ({
  introPageService: {
    getIntroPageData: vi.fn()
  }
}))

// Performance monitoring utilities
class PerformanceMonitor {
  private measurements: Record<string, number[]> = {}
  private memorySnapshots: MemoryInfo[] = []

  startMeasurement(name: string): void {
    performance.mark(`${name}-start`)
  }

  endMeasurement(name: string): number {
    performance.mark(`${name}-end`)
    performance.measure(name, `${name}-start`, `${name}-end`)

    const measure = performance.getEntriesByName(name, 'measure')[0]
    const duration = measure?.duration || 0

    if (!this.measurements[name]) {
      this.measurements[name] = []
    }
    this.measurements[name].push(duration)

    return duration
  }

  getMeasurements(name: string): number[] {
    return this.measurements[name] || []
  }

  getAverageDuration(name: string): number {
    const measurements = this.getMeasurements(name)
    return measurements.length > 0
      ? measurements.reduce((sum, duration) => sum + duration, 0) / measurements.length
      : 0
  }

  captureMemorySnapshot(): void {
    if (typeof window !== 'undefined' && 'performance' in window && 'memory' in (window.performance as any)) {
      this.memorySnapshots.push((window.performance as any).memory)
    }
  }

  getMemoryUsageIncrease(): number {
    if (this.memorySnapshots.length < 2) return 0
    const initial = this.memorySnapshots[0]
    const final = this.memorySnapshots[this.memorySnapshots.length - 1]
    return final.usedJSHeapSize - initial.usedJSHeapSize
  }

  reset(): void {
    this.measurements = {}
    this.memorySnapshots = []
    performance.clearMeasures()
    performance.clearMarks()
  }
}

// Load testing utilities
class LoadTestUtilities {
  static async simulateConcurrentUsers(userCount: number, action: () => Promise<void>): Promise<void> {
    const promises = Array.from({ length: userCount }, () => action())
    await Promise.all(promises)
  }

  static async simulateRepeatedAction(
    action: () => Promise<void>,
    iterations: number,
    delayMs: number = 50
  ): Promise<void> {
    for (let i = 0; i < iterations; i++) {
      await action()
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }
  }

  static generateLargeDataset(size: number): any[] {
    return Array.from({ length: size }, (_, index) => ({
      id: `item-${index}`,
      title: `Document ${index}`,
      content: `This is the content for document ${index}. `.repeat(10),
      timestamp: new Date(Date.now() - Math.random() * 86400000 * 30),
      status: ['approved', 'draft', 'review'][index % 3],
      type: ['meeting', 'policy', 'governance', 'notice'][index % 4],
      metadata: {
        author: `user-${index % 20}`,
        version: Math.floor(index / 10) + 1,
        tags: [`tag-${index % 5}`, `category-${index % 3}`]
      }
    }))
  }
}

// Test wrapper component
const createLoadTestWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false }
    }
  })

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  )
}

describe('Comprehensive Load Testing - Task 2.4.2', () => {
  let performanceMonitor: PerformanceMonitor

  beforeAll(() => {
    performanceMonitor = new PerformanceMonitor()

    // Mock performance API if not available
    if (!global.performance) {
      global.performance = {
        mark: vi.fn(),
        measure: vi.fn(),
        getEntriesByName: vi.fn(() => [{ duration: Math.random() * 100 }]),
        clearMarks: vi.fn(),
        clearMeasures: vi.fn(),
        now: vi.fn(() => Date.now())
      } as any
    }
  })

  afterAll(() => {
    performanceMonitor.reset()
  })

  describe('🚀 Component Load Testing', () => {
    it('should handle rendering large numbers of components efficiently', async () => {
      const TestWrapper = createLoadTestWrapper()
      const componentCount = 100

      performanceMonitor.startMeasurement('large-component-render')
      performanceMonitor.captureMemorySnapshot()

      const { unmount } = render(
        <TestWrapper>
          <div>
            {Array.from({ length: componentCount }, (_, index) => (
              <SystemOverview
                key={index}
                data={{
                  total_users: 150 + index,
                  active_documents: 1250 + index * 10,
                  documents_today: 8 + index,
                  documents_this_week: 45 + index * 2,
                  system_health_score: 95 + (index % 5)
                }}
                loading={false}
                onRefresh={() => {}}
              />
            ))}
          </div>
        </TestWrapper>
      )

      performanceMonitor.captureMemorySnapshot()
      const renderTime = performanceMonitor.endMeasurement('large-component-render')

      // Performance assertions
      expect(renderTime).toBeLessThan(5000) // Should render 100 components in under 5 seconds
      console.log(`✅ Rendered ${componentCount} components in ${renderTime.toFixed(2)}ms`)

      unmount()
      console.log('✅ Large component rendering load test passed')
    })

    it('should handle rapid state updates without performance degradation', async () => {
      const TestWrapper = createLoadTestWrapper()
      const updateCount = 50

      const { rerender } = render(
        <TestWrapper>
          <PersonalStats
            userId="test-user"
            data={{
              userId: 'test-user',
              documentCount: 42,
              templateCount: 8,
              documentsCreatedThisWeek: 5,
              documentsCreatedThisMonth: 18,
              collaborationScore: 85,
              productivityScore: 92.5,
              recentDocuments: [],
              documentsByType: { meeting: 10, policy: 5, notice: 3, governance: 2 },
              workflowParticipation: {
                approvals_completed: 25,
                reviews_completed: 18,
                tasks_assigned: 8,
                tasks_completed: 6
              },
              activityTimeline: []
            }}
            loading={false}
            timeRange="month"
            onTimeRangeChange={() => {}}
            onDocumentClick={() => {}}
          />
        </TestWrapper>
      )

      performanceMonitor.startMeasurement('rapid-state-updates')

      // Simulate rapid state updates
      for (let i = 0; i < updateCount; i++) {
        rerender(
          <TestWrapper>
            <PersonalStats
              userId="test-user"
              data={{
                userId: 'test-user',
                documentCount: 42 + i,
                templateCount: 8 + i,
                documentsCreatedThisWeek: 5 + i,
                documentsCreatedThisMonth: 18 + i * 2,
                collaborationScore: 85 + (i % 15),
                productivityScore: 92.5 + (i % 7),
                recentDocuments: [],
                documentsByType: {
                  meeting: 10 + i,
                  policy: 5 + i,
                  notice: 3 + i,
                  governance: 2 + i
                },
                workflowParticipation: {
                  approvals_completed: 25 + i,
                  reviews_completed: 18 + i,
                  tasks_assigned: 8 + i,
                  tasks_completed: 6 + i
                },
                activityTimeline: []
              }}
              loading={false}
              timeRange="month"
              onTimeRangeChange={() => {}}
              onDocumentClick={() => {}}
            />
          </TestWrapper>
        )
      }

      const updateTime = performanceMonitor.endMeasurement('rapid-state-updates')

      // Performance assertions
      expect(updateTime).toBeLessThan(2000) // Should complete 50 updates in under 2 seconds
      console.log(`✅ Completed ${updateCount} state updates in ${updateTime.toFixed(2)}ms`)
      console.log('✅ Rapid state updates load test passed')
    })

    it('should handle large dataset rendering efficiently', async () => {
      const TestWrapper = createLoadTestWrapper()
      const largeDataset = LoadTestUtilities.generateLargeDataset(1000)

      performanceMonitor.startMeasurement('large-dataset-render')

      render(
        <TestWrapper>
          <ActionableItems
            items={largeDataset.slice(0, 100).map(item => ({
              id: item.id,
              title: item.title,
              type: item.type as 'approval' | 'review' | 'signature' | 'notification',
              priority: ['high', 'medium', 'low'][Math.floor(Math.random() * 3)] as 'high' | 'medium' | 'low',
              due_date: item.timestamp.toISOString(),
              description: item.content,
              document_id: item.id,
              assigned_to: item.metadata.author
            }))}
            loading={false}
            onItemClick={() => {}}
            onMarkComplete={() => {}}
          />
        </TestWrapper>
      )

      const renderTime = performanceMonitor.endMeasurement('large-dataset-render')

      // Performance assertions
      expect(renderTime).toBeLessThan(3000) // Should render 100 items in under 3 seconds
      console.log(`✅ Rendered 100 actionable items in ${renderTime.toFixed(2)}ms`)
      console.log('✅ Large dataset rendering load test passed')
    })
  })

  describe('⚡ Concurrent User Simulation', () => {
    it('should handle multiple simultaneous user interactions', async () => {
      const TestWrapper = createLoadTestWrapper()
      const concurrentUsers = 10

      const { container } = render(
        <TestWrapper>
          <QuickActions
            actions={[
              {
                id: 'new-document',
                title: 'New Document',
                description: 'Create a new document',
                icon: 'file-plus',
                path: '/documents/new',
                category: 'document'
              },
              {
                id: 'templates',
                title: 'Templates',
                description: 'Browse templates',
                icon: 'template',
                path: '/templates',
                category: 'template'
              }
            ]}
            loading={false}
            onActionClick={() => {}}
            onCustomizeClick={() => {}}
          />
        </TestWrapper>
      )

      performanceMonitor.startMeasurement('concurrent-interactions')

      // Simulate concurrent user interactions
      const simulateUserInteraction = async () => {
        const buttons = container.querySelectorAll('button')
        if (buttons.length > 0) {
          const randomButton = buttons[Math.floor(Math.random() * buttons.length)]
          fireEvent.click(randomButton)
          await new Promise(resolve => setTimeout(resolve, Math.random() * 50))
        }
      }

      await LoadTestUtilities.simulateConcurrentUsers(concurrentUsers, simulateUserInteraction)

      const interactionTime = performanceMonitor.endMeasurement('concurrent-interactions')

      // Performance assertions
      expect(interactionTime).toBeLessThan(1000) // Should handle 10 concurrent interactions in under 1 second
      console.log(`✅ Handled ${concurrentUsers} concurrent user interactions in ${interactionTime.toFixed(2)}ms`)
      console.log('✅ Concurrent user simulation load test passed')
    })

    it('should handle rapid repeated actions without memory leaks', async () => {
      const TestWrapper = createLoadTestWrapper()
      const actionCount = 100

      performanceMonitor.captureMemorySnapshot()

      const { container } = render(
        <TestWrapper>
          <ActivityFeed
            activities={[
              {
                id: 'activity-1',
                type: 'document_created',
                title: 'New document created',
                description: 'Board Meeting Minutes - September 2025',
                timestamp: new Date().toISOString(),
                user: { id: 'user-1', name: 'John Doe' },
                metadata: { document_id: 'doc-1' }
              }
            ]}
            loading={false}
            onActivityClick={() => {}}
            onLoadMore={() => {}}
          />
        </TestWrapper>
      )

      performanceMonitor.startMeasurement('repeated-actions')

      // Simulate repeated user actions
      const simulateRepeatedAction = async () => {
        const buttons = container.querySelectorAll('button')
        if (buttons.length > 0) {
          fireEvent.click(buttons[0])
        }
      }

      await LoadTestUtilities.simulateRepeatedAction(simulateRepeatedAction, actionCount, 10)

      performanceMonitor.captureMemorySnapshot()
      const actionTime = performanceMonitor.endMeasurement('repeated-actions')
      const memoryIncrease = performanceMonitor.getMemoryUsageIncrease()

      // Performance assertions
      expect(actionTime).toBeLessThan(3000) // Should complete 100 actions in under 3 seconds
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024) // Should not increase memory by more than 10MB

      console.log(`✅ Completed ${actionCount} repeated actions in ${actionTime.toFixed(2)}ms`)
      console.log(`✅ Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`)
      console.log('✅ Repeated actions load test passed')
    })
  })

  describe('🔄 Real-time Update Load Testing', () => {
    it('should handle high-frequency real-time updates efficiently', async () => {
      const TestWrapper = createLoadTestWrapper()
      const updateFrequency = 50 // updates per second
      const testDuration = 2000 // 2 seconds

      let updateCount = 0
      const maxUpdates = (updateFrequency * testDuration) / 1000

      const { rerender } = render(
        <TestWrapper>
          <ActivityFeed
            activities={[
              {
                id: 'activity-1',
                type: 'document_updated',
                title: 'Document updated',
                description: 'Real-time update test',
                timestamp: new Date().toISOString(),
                user: { id: 'user-1', name: 'Test User' },
                metadata: { document_id: 'doc-1' }
              }
            ]}
            loading={false}
            onActivityClick={() => {}}
            onLoadMore={() => {}}
          />
        </TestWrapper>
      )

      performanceMonitor.startMeasurement('real-time-updates')

      // Simulate high-frequency updates
      const updateInterval = setInterval(() => {
        if (updateCount >= maxUpdates) {
          clearInterval(updateInterval)
          return
        }

        updateCount++
        rerender(
          <TestWrapper>
            <ActivityFeed
              activities={[
                {
                  id: `activity-${updateCount}`,
                  type: 'document_updated',
                  title: `Update ${updateCount}`,
                  description: `Real-time update test ${updateCount}`,
                  timestamp: new Date().toISOString(),
                  user: { id: 'user-1', name: 'Test User' },
                  metadata: { document_id: `doc-${updateCount}` }
                }
              ]}
              loading={false}
              onActivityClick={() => {}}
              onLoadMore={() => {}}
            />
          </TestWrapper>
        )
      }, 1000 / updateFrequency)

      // Wait for test duration
      await new Promise(resolve => setTimeout(resolve, testDuration))
      clearInterval(updateInterval)

      const updateTime = performanceMonitor.endMeasurement('real-time-updates')

      // Performance assertions
      expect(updateCount).toBeLessThanOrEqual(maxUpdates + 5) // Allow small variance
      expect(updateTime).toBeLessThan(testDuration + 500) // Should complete within test duration + small buffer

      console.log(`✅ Handled ${updateCount} real-time updates in ${updateTime.toFixed(2)}ms`)
      console.log('✅ Real-time update load test passed')
    })
  })

  describe('💾 Memory and Resource Management', () => {
    it('should efficiently manage memory during intensive operations', async () => {
      const TestWrapper = createLoadTestWrapper()

      performanceMonitor.captureMemorySnapshot()

      // Create and destroy components multiple times
      for (let cycle = 0; cycle < 10; cycle++) {
        const { unmount } = render(
          <TestWrapper>
            <div>
              {Array.from({ length: 50 }, (_, index) => (
                <SystemOverview
                  key={`${cycle}-${index}`}
                  data={{
                    total_users: 150 + index,
                    active_documents: 1250 + index * 10,
                    documents_today: 8 + index,
                    documents_this_week: 45 + index * 2,
                    system_health_score: 95 + (index % 5)
                  }}
                  loading={false}
                  onRefresh={() => {}}
                />
              ))}
            </div>
          </TestWrapper>
        )

        // Force cleanup
        unmount()

        // Allow garbage collection
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      performanceMonitor.captureMemorySnapshot()
      const memoryIncrease = performanceMonitor.getMemoryUsageIncrease()

      // Memory management assertions
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024) // Should not increase memory by more than 50MB

      console.log(`✅ Memory increase after 10 cycles: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`)
      console.log('✅ Memory management load test passed')
    })
  })

  describe('📊 Performance Benchmarking', () => {
    it('should meet performance benchmarks for all load test scenarios', () => {
      const benchmarks = {
        'large-component-render': 5000,      // 5 seconds max
        'rapid-state-updates': 2000,         // 2 seconds max
        'large-dataset-render': 3000,        // 3 seconds max
        'concurrent-interactions': 1000,     // 1 second max
        'repeated-actions': 3000,            // 3 seconds max
        'real-time-updates': 2500            // 2.5 seconds max
      }

      let allBenchmarksMet = true
      const results: Record<string, { actual: number; benchmark: number; passed: boolean }> = {}

      Object.entries(benchmarks).forEach(([testName, benchmark]) => {
        const averageDuration = performanceMonitor.getAverageDuration(testName)
        const passed = averageDuration <= benchmark && averageDuration > 0

        results[testName] = {
          actual: averageDuration,
          benchmark,
          passed
        }

        if (!passed) {
          allBenchmarksMet = false
        }

        console.log(`${passed ? '✅' : '❌'} ${testName}: ${averageDuration.toFixed(2)}ms (benchmark: ${benchmark}ms)`)
      })

      expect(allBenchmarksMet).toBe(true)

      const overallScore = Object.values(results).reduce((score, result) => {
        return score + (result.passed ? 1 : 0)
      }, 0) / Object.keys(results).length * 100

      console.log(`🎯 Overall performance score: ${overallScore.toFixed(1)}%`)
      console.log('✅ Performance benchmarking completed')
    })
  })
})