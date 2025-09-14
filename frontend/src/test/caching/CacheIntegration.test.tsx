/**
 * Cache Integration Tests - TDD Red Phase
 * Tests for React Query caching strategies and optimization
 */
import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'

import {
  useCacheManager,
  useCacheOptimization,
  useCachePreloader,
  useCacheInvalidation,
  useCachePersistence,
  CacheProvider
} from '../../hooks/useCacheIntegration'
import { useIntroPageData, useSystemOverview } from '../../hooks/useIntroPageData'
import { introPageService } from '../../services/introPageService'
import type { TransformedIntroPageData } from '../../services/introPageService'

// Mock the intro page service
vi.mock('../../services/introPageService', () => ({
  introPageService: {
    getIntroPageData: vi.fn(),
    getSystemOverview: vi.fn(),
    getUserStatistics: vi.fn(),
    getActionableItems: vi.fn(),
    getActivityFeed: vi.fn()
  }
}))

// Mock localStorage for cache persistence
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

// Mock data for testing
const mockIntroPageData: TransformedIntroPageData = {
  userId: 'cache-test-user',
  userStatistics: {
    documentCount: 25,
    templateCount: 5,
    recentDocuments: [
      {
        id: 'doc-cache-001',
        title: 'Cached Document 1',
        updatedAt: new Date('2024-12-20T10:30:00Z'),
        status: 'draft'
      }
    ],
    documentTypes: { 'proposal': 10, 'policy': 15 }
  },
  systemOverview: {
    total_users: 200,
    active_documents: 450,
    documents_today: 25,
    documents_this_week: 125,
    system_health_score: 99.2
  },
  actionableItems: {
    user_id: 'cache-test-user',
    pending_approvals: 3,
    urgent_tasks: 1,
    overdue_items: 0,
    items: []
  },
  activityFeed: {
    user_id: 'cache-test-user',
    recent_activities: ['document_created'],
    activities: []
  },
  personalization: {
    user_id: 'cache-test-user',
    preferences: {
      dashboard_layout: 'compact',
      default_view: 'actionable_items',
      notifications_enabled: true,
      auto_refresh: true
    },
    quick_actions: []
  },
  performanceMetrics: {
    user_id: 'cache-test-user',
    response_time: 120,
    cache_hit_rate: 0.95,
    data_freshness: 180,
    error_rate: 0.0005
  },
  lastUpdated: new Date('2024-12-20T10:30:00Z')
}

// Test wrapper with customizable QueryClient
const createCacheWrapper = (customOptions = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 5 * 60 * 1000, // 5 minutes
        staleTime: 1 * 60 * 1000, // 1 minute
        ...customOptions
      }
    }
  })

  return ({ children }: { children: ReactNode }) => (
    <CacheProvider queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </CacheProvider>
  )
}

describe('Cache Integration - TDD Red Phase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear.mockClear()
    localStorageMock.getItem.mockClear()
    localStorageMock.setItem.mockClear()
    localStorageMock.removeItem.mockClear()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Cache Manager Hook', () => {
    it('should provide cache status information', () => {
      const wrapper = createCacheWrapper()
      const { result } = renderHook(() => useCacheManager(), { wrapper })

      expect(result.current.cacheSize).toBeDefined()
      expect(result.current.cacheHitRate).toBeDefined()
      expect(result.current.totalQueries).toBeDefined()
      expect(result.current.activeQueries).toBeDefined()
      expect(result.current.staleCacheCount).toBeDefined()
    })

    it('should provide cache management functions', () => {
      const wrapper = createCacheWrapper()
      const { result } = renderHook(() => useCacheManager(), { wrapper })

      expect(typeof result.current.clearExpiredCache).toBe('function')
      expect(typeof result.current.clearAllCache).toBe('function')
      expect(typeof result.current.optimizeCache).toBe('function')
      expect(typeof result.current.getCacheStats).toBe('function')
    })

    it('should clear expired cache entries', async () => {
      const wrapper = createCacheWrapper()
      const { result } = renderHook(() => useCacheManager(), { wrapper })

      await act(async () => {
        await result.current.clearExpiredCache()
      })

      const stats = result.current.getCacheStats()
      expect(stats.expiredEntriesCleared).toBeGreaterThanOrEqual(0)
    })

    it('should provide accurate cache statistics', async () => {
      const mockGetSystemOverview = vi.mocked(introPageService.getSystemOverview)
      mockGetSystemOverview.mockResolvedValue(mockIntroPageData.systemOverview)

      const wrapper = createCacheWrapper()

      // First render cache manager
      const { result: managerResult } = renderHook(() => useCacheManager(), { wrapper })

      // Then trigger a query to populate cache
      const { result: queryResult } = renderHook(() => useSystemOverview(), { wrapper })

      await waitFor(() => {
        expect(queryResult.current.isLoading).toBe(false)
      })

      const stats = managerResult.current.getCacheStats()
      expect(stats.totalEntries).toBeGreaterThan(0)
      expect(stats.memoryUsage).toBeGreaterThan(0)
    })
  })

  describe('Cache Optimization Hook', () => {
    it('should provide cache optimization strategies', () => {
      const wrapper = createCacheWrapper()
      const { result } = renderHook(() => useCacheOptimization(), { wrapper })

      expect(typeof result.current.optimizeStaleTime).toBe('function')
      expect(typeof result.current.optimizeGcTime).toBe('function')
      expect(typeof result.current.enableSmartRefetching).toBe('function')
      expect(typeof result.current.configureBackgroundRefresh).toBe('function')
      expect(typeof result.current.setupCacheWarming).toBe('function')
    })

    it('should optimize stale time based on usage patterns', async () => {
      const wrapper = createCacheWrapper()
      const { result } = renderHook(() => useCacheOptimization(), { wrapper })

      const optimizedStaleTime = await result.current.optimizeStaleTime([
        { queryKey: ['system'], accessFrequency: 'high', lastAccessed: Date.now() },
        { queryKey: ['personal'], accessFrequency: 'medium', lastAccessed: Date.now() - 60000 }
      ])

      expect(optimizedStaleTime).toBeDefined()
      expect(typeof optimizedStaleTime['system']).toBe('number')
      expect(typeof optimizedStaleTime['personal']).toBe('number')
    })

    it('should configure smart refetching based on user activity', async () => {
      const wrapper = createCacheWrapper()
      const { result } = renderHook(() => useCacheOptimization(), { wrapper })

      const config = await result.current.enableSmartRefetching({
        focusRefetch: true,
        intervalRefetch: true,
        userActivityTracking: true,
        adaptiveRefetch: true
      })

      expect(config.enabled).toBe(true)
      expect(config.strategies).toContain('focus')
      expect(config.strategies).toContain('interval')
      expect(config.strategies).toContain('adaptive')
    })

    it('should setup background cache warming for critical queries', async () => {
      const wrapper = createCacheWrapper()
      const { result } = renderHook(() => useCacheOptimization(), { wrapper })

      const warmingConfig = await result.current.setupCacheWarming([
        { queryKey: ['systemOverview'], priority: 'high', interval: 30000 },
        { queryKey: ['personalStats', 'test-user'], priority: 'medium', interval: 60000 }
      ])

      expect(warmingConfig.activeWarmers).toBeGreaterThan(0)
      expect(warmingConfig.warmingStrategies).toContain('interval')
      expect(warmingConfig.warmingStrategies).toContain('predictive')
    })
  })

  describe('Cache Preloader Hook', () => {
    it('should provide preloading functionality', () => {
      const wrapper = createCacheWrapper()
      const { result } = renderHook(() => useCachePreloader(), { wrapper })

      expect(typeof result.current.preloadIntroPage).toBe('function')
      expect(typeof result.current.preloadCriticalData).toBe('function')
      expect(typeof result.current.preloadUserSpecificData).toBe('function')
      expect(typeof result.current.getPreloadStatus).toBe('function')
    })

    it('should preload intro page data', async () => {
      const mockGetIntroPageData = vi.mocked(introPageService.getIntroPageData)
      mockGetIntroPageData.mockResolvedValue(mockIntroPageData)

      const wrapper = createCacheWrapper()
      const { result } = renderHook(() => useCachePreloader(), { wrapper })

      await act(async () => {
        await result.current.preloadIntroPage('cache-test-user')
      })

      const status = result.current.getPreloadStatus()
      expect(status.introPage.loaded).toBe(true)
      expect(status.introPage.loadTime).toBeGreaterThan(0)
    })

    it('should preload critical system data', async () => {
      const mockGetSystemOverview = vi.mocked(introPageService.getSystemOverview)
      mockGetSystemOverview.mockResolvedValue(mockIntroPageData.systemOverview)

      const wrapper = createCacheWrapper()
      const { result } = renderHook(() => useCachePreloader(), { wrapper })

      await act(async () => {
        await result.current.preloadCriticalData()
      })

      const status = result.current.getPreloadStatus()
      expect(status.systemOverview.loaded).toBe(true)
    })

    it('should handle preloading errors gracefully', async () => {
      const mockError = new Error('Preload failed')
      const mockGetIntroPageData = vi.mocked(introPageService.getIntroPageData)
      mockGetIntroPageData.mockRejectedValue(mockError)

      const wrapper = createCacheWrapper()
      const { result } = renderHook(() => useCachePreloader(), { wrapper })

      await act(async () => {
        await result.current.preloadIntroPage('cache-test-user')
      })

      // Wait for state update
      await waitFor(() => {
        const status = result.current.getPreloadStatus()
        expect(status.introPage.loaded).toBe(false)
      })

      const status = result.current.getPreloadStatus()
      expect(status.introPage.error).toBe(mockError.message)
    })
  })

  describe('Cache Invalidation Hook', () => {
    it('should provide selective invalidation functions', () => {
      const wrapper = createCacheWrapper()
      const { result } = renderHook(() => useCacheInvalidation(), { wrapper })

      expect(typeof result.current.invalidateUserData).toBe('function')
      expect(typeof result.current.invalidateSystemData).toBe('function')
      expect(typeof result.current.invalidateStaleData).toBe('function')
      expect(typeof result.current.invalidateByPattern).toBe('function')
      expect(typeof result.current.scheduleInvalidation).toBe('function')
    })

    it('should invalidate user-specific data', async () => {
      const mockGetIntroPageData = vi.mocked(introPageService.getIntroPageData)
      mockGetIntroPageData.mockResolvedValue(mockIntroPageData)

      const wrapper = createCacheWrapper()

      // First populate cache
      const { result: queryResult } = renderHook(() => useIntroPageData('cache-test-user'), { wrapper })
      await waitFor(() => {
        expect(queryResult.current.isLoading).toBe(false)
      })

      // Then test invalidation
      const { result: invalidationResult } = renderHook(() => useCacheInvalidation(), { wrapper })

      await act(async () => {
        await invalidationResult.current.invalidateUserData('cache-test-user')
      })

      // Should trigger refetch
      expect(mockGetIntroPageData).toHaveBeenCalledTimes(2)
    })

    it('should invalidate stale data based on age', async () => {
      const wrapper = createCacheWrapper()
      const { result } = renderHook(() => useCacheInvalidation(), { wrapper })

      const invalidatedCount = await act(async () => {
        return await result.current.invalidateStaleData(60000) // 1 minute
      })

      expect(typeof invalidatedCount).toBe('number')
      expect(invalidatedCount).toBeGreaterThanOrEqual(0)
    })

    it('should schedule automatic invalidation', async () => {
      const wrapper = createCacheWrapper()
      const { result } = renderHook(() => useCacheInvalidation(), { wrapper })

      const scheduleId = await act(async () => {
        return result.current.scheduleInvalidation({
          queryKey: ['systemOverview'],
          delay: 30000, // 30 seconds
          recurring: true
        })
      })

      expect(typeof scheduleId).toBe('string')
      expect(scheduleId.length).toBeGreaterThan(0)
    })
  })

  describe('Cache Persistence Hook', () => {
    it('should provide cache persistence functionality', () => {
      const wrapper = createCacheWrapper()
      const { result } = renderHook(() => useCachePersistence(), { wrapper })

      expect(typeof result.current.enablePersistence).toBe('function')
      expect(typeof result.current.saveCacheToStorage).toBe('function')
      expect(typeof result.current.loadCacheFromStorage).toBe('function')
      expect(typeof result.current.clearPersistedCache).toBe('function')
      expect(result.current.persistenceEnabled).toBeDefined()
    })

    it('should save cache data to localStorage', async () => {
      const mockGetSystemOverview = vi.mocked(introPageService.getSystemOverview)
      mockGetSystemOverview.mockResolvedValue(mockIntroPageData.systemOverview)

      const wrapper = createCacheWrapper()

      // Enable persistence first
      const { result: persistenceResult } = renderHook(() => useCachePersistence(), { wrapper })

      await act(async () => {
        await persistenceResult.current.enablePersistence({
          include: ['systemOverview'],
          maxAge: 24 * 60 * 60 * 1000, // 24 hours
          compression: true
        })
      })

      // Load some data
      const { result: queryResult } = renderHook(() => useSystemOverview(), { wrapper })
      await waitFor(() => {
        expect(queryResult.current.isLoading).toBe(false)
      })

      // Save cache
      await act(async () => {
        await persistenceResult.current.saveCacheToStorage()
      })

      expect(localStorageMock.setItem).toHaveBeenCalled()
    })

    it('should load cache data from localStorage', async () => {
      const cachedData = JSON.stringify({
        queries: [{
          queryKey: ['systemOverview'],
          data: mockIntroPageData.systemOverview,
          timestamp: Date.now()
        }]
      })

      localStorageMock.getItem.mockReturnValue(cachedData)

      const wrapper = createCacheWrapper()
      const { result } = renderHook(() => useCachePersistence(), { wrapper })

      await act(async () => {
        await result.current.loadCacheFromStorage()
      })

      expect(localStorageMock.getItem).toHaveBeenCalledWith('ca-dms-cache')

      const loadedQueries = result.current.getPersistedQueries()
      expect(loadedQueries.length).toBeGreaterThan(0)
    })

    it('should handle storage quota exceeded gracefully', async () => {
      const quotaError = new Error('QuotaExceededError')
      localStorageMock.setItem.mockImplementation(() => {
        throw quotaError
      })

      const wrapper = createCacheWrapper()
      const { result } = renderHook(() => useCachePersistence(), { wrapper })

      await act(async () => {
        await result.current.saveCacheToStorage()
      })

      // Should not throw, should handle gracefully
      expect(result.current.persistenceEnabled).toBe(false)
      expect(result.current.getStorageError()).toBe('QuotaExceededError')
    })
  })

  describe('Cache Integration Performance', () => {
    it('should maintain performance with large cache sizes', async () => {
      const wrapper = createCacheWrapper({
        gcTime: 60 * 60 * 1000, // 1 hour
        staleTime: 10 * 60 * 1000 // 10 minutes
      })

      const { result: managerResult } = renderHook(() => useCacheManager(), { wrapper })

      // Simulate large cache
      const mockQueries = Array.from({ length: 100 }, (_, i) => ({
        queryKey: [`test-query-${i}`],
        data: { id: i, value: `test-${i}` },
        timestamp: Date.now()
      }))

      const startTime = performance.now()

      await act(async () => {
        await managerResult.current.optimizeCache()
      })

      const endTime = performance.now()
      const optimizationTime = endTime - startTime

      expect(optimizationTime).toBeLessThan(1000) // Should complete in under 1 second
    })

    it('should efficiently handle concurrent cache operations', async () => {
      const wrapper = createCacheWrapper()

      const { result: managerResult } = renderHook(() => useCacheManager(), { wrapper })
      const { result: preloadResult } = renderHook(() => useCachePreloader(), { wrapper })
      const { result: invalidationResult } = renderHook(() => useCacheInvalidation(), { wrapper })

      // Run concurrent operations
      const operations = await Promise.allSettled([
        managerResult.current.optimizeCache(),
        preloadResult.current.preloadCriticalData(),
        invalidationResult.current.invalidateStaleData(30000)
      ])

      // All operations should complete without conflicts
      operations.forEach(operation => {
        expect(operation.status).toBe('fulfilled')
      })
    })

    it('should implement memory usage limits', async () => {
      const wrapper = createCacheWrapper({
        gcTime: 1000, // Very short GC time for testing
      })

      const { result } = renderHook(() => useCacheManager(), { wrapper })

      const initialStats = result.current.getCacheStats()

      // Simulate memory pressure
      await act(async () => {
        await result.current.optimizeCache({
          memoryLimit: 1024 * 1024, // 1MB limit
          enableMemoryOptimization: true
        })
      })

      const optimizedStats = result.current.getCacheStats()

      if (initialStats.memoryUsage > 1024 * 1024) {
        expect(optimizedStats.memoryUsage).toBeLessThan(initialStats.memoryUsage)
      }
    })
  })

  describe('Cache Provider Integration', () => {
    it('should provide global cache configuration', () => {
      const customQueryClient = new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 15 * 60 * 1000,
            retry: 2
          }
        }
      })

      const { result } = renderHook(
        () => useCacheManager(),
        {
          wrapper: ({ children }) => (
            <CacheProvider queryClient={customQueryClient}>
              <QueryClientProvider client={customQueryClient}>
                {children}
              </QueryClientProvider>
            </CacheProvider>
          )
        }
      )

      expect(result.current.cacheSize).toBeDefined()
      expect(result.current.getCacheStats().defaultStaleTime).toBe(5 * 60 * 1000)
    })

    it('should support cache debugging in development', () => {
      process.env.NODE_ENV = 'development'

      const wrapper = createCacheWrapper()
      const { result } = renderHook(() => useCacheManager(), { wrapper })

      expect(result.current.debugCache).toBeDefined()
      expect(typeof result.current.debugCache).toBe('function')
      expect(result.current.cacheDebugEnabled).toBe(true)

      process.env.NODE_ENV = 'test'
    })
  })
})