/**
 * Cache Integration Hooks - React Query caching optimization and management
 * Provides advanced caching strategies, optimization, and management for intro page data
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { useQueryClient, QueryClient } from '@tanstack/react-query'
import { introPageService } from '../services/introPageService'
import { INTRO_PAGE_QUERY_KEYS } from './useIntroPageData'

// Cache configuration interfaces
export interface CacheStats {
  totalEntries: number
  memoryUsage: number
  expiredEntriesCleared: number
  defaultStaleTime: number
  cacheHitRate: number
}

export interface CacheOptimizationConfig {
  enabled: boolean
  strategies: string[]
  memoryLimit?: number
  enableMemoryOptimization?: boolean
}

export interface CacheWarmingConfig {
  activeWarmers: number
  warmingStrategies: string[]
  totalWarmedQueries: number
}

export interface PreloadStatus {
  introPage: {
    loaded: boolean
    loadTime: number
    error?: string
  }
  systemOverview: {
    loaded: boolean
    loadTime: number
    error?: string
  }
  personalStats: {
    loaded: boolean
    loadTime: number
    error?: string
  }
}

export interface CachePersistenceConfig {
  include: string[]
  maxAge: number
  compression: boolean
}

export interface PersistedQuery {
  queryKey: any[]
  data: any
  timestamp: number
}

// Cache Context for provider
interface CacheContextValue {
  queryClient: QueryClient
  debugEnabled: boolean
}

const CacheContext = createContext<CacheContextValue | undefined>(undefined)

export const CacheProvider: React.FC<{
  children: React.ReactNode
  queryClient: QueryClient
}> = ({ children, queryClient }) => {
  const debugEnabled = process.env.NODE_ENV === 'development'

  const contextValue: CacheContextValue = {
    queryClient,
    debugEnabled
  }

  return React.createElement(
    CacheContext.Provider,
    { value: contextValue },
    children
  )
}

/**
 * Hook for managing cache statistics and operations
 */
export function useCacheManager() {
  const queryClient = useQueryClient()
  const context = useContext(CacheContext)

  // Cache statistics state
  const [cacheStats, setCacheStats] = useState<CacheStats>({
    totalEntries: 0,
    memoryUsage: 0,
    expiredEntriesCleared: 0,
    defaultStaleTime: 0,
    cacheHitRate: 0
  })

  // Calculate cache statistics
  const calculateCacheStats = useCallback((): CacheStats => {
    const cache = queryClient.getQueryCache()
    const queries = cache.getAll()

    const totalEntries = queries.length
    const memoryUsage = JSON.stringify(queries).length
    const defaultStaleTime = queryClient.getDefaultOptions().queries?.staleTime || 0

    // Calculate cache hit rate (simplified estimation)
    const successfulQueries = queries.filter(q => q.state.status === 'success')
    const cacheHitRate = totalEntries > 0 ? successfulQueries.length / totalEntries : 0

    return {
      totalEntries,
      memoryUsage,
      expiredEntriesCleared: cacheStats.expiredEntriesCleared,
      defaultStaleTime: Number(defaultStaleTime),
      cacheHitRate
    }
  }, [queryClient, cacheStats.expiredEntriesCleared])

  // Update cache stats periodically
  useEffect(() => {
    const updateStats = () => {
      const newStats = calculateCacheStats()
      setCacheStats(newStats)
    }

    updateStats()
    const interval = setInterval(updateStats, 30000) // Update every 30 seconds

    return () => clearInterval(interval)
  }, [calculateCacheStats])

  // Clear expired cache entries
  const clearExpiredCache = useCallback(async () => {
    const cache = queryClient.getQueryCache()
    const queries = cache.getAll()
    const now = Date.now()

    let expiredCount = 0

    queries.forEach(query => {
      const staleTime = query.options.staleTime || 0
      const dataUpdatedAt = query.state.dataUpdatedAt || 0

      if (now - dataUpdatedAt > staleTime) {
        cache.remove(query)
        expiredCount++
      }
    })

    setCacheStats(prev => ({ ...prev, expiredEntriesCleared: prev.expiredEntriesCleared + expiredCount }))
    return expiredCount
  }, [queryClient])

  // Clear all cache
  const clearAllCache = useCallback(async () => {
    queryClient.clear()
    setCacheStats(prev => ({ ...prev, totalEntries: 0, memoryUsage: 0 }))
  }, [queryClient])

  // Optimize cache performance
  const optimizeCache = useCallback(async (config: CacheOptimizationConfig = { enabled: true, strategies: [] }) => {
    if (!config.enabled) return

    // Remove stale queries
    await clearExpiredCache()

    // Memory optimization if enabled
    if (config.enableMemoryOptimization && config.memoryLimit) {
      const currentStats = calculateCacheStats()

      if (currentStats.memoryUsage > config.memoryLimit) {
        const cache = queryClient.getQueryCache()
        const queries = cache.getAll()

        // Sort by last accessed time and remove oldest
        const sortedQueries = queries.sort((a, b) =>
          (a.state.dataUpdatedAt || 0) - (b.state.dataUpdatedAt || 0)
        )

        const queriesToRemove = Math.ceil(queries.length * 0.3) // Remove 30% of queries

        for (let i = 0; i < queriesToRemove; i++) {
          cache.remove(sortedQueries[i])
        }
      }
    }
  }, [queryClient, clearExpiredCache, calculateCacheStats])

  // Get current cache statistics
  const getCacheStats = useCallback(() => calculateCacheStats(), [calculateCacheStats])

  // Debug cache (development only)
  const debugCache = useCallback(() => {
    if (context?.debugEnabled) {
      console.group('🗄️ Cache Debug Information')
      console.log('Cache Stats:', getCacheStats())
      console.log('All Queries:', queryClient.getQueryCache().getAll())
      console.log('Query Defaults:', queryClient.getDefaultOptions())
      console.groupEnd()
    }
  }, [context?.debugEnabled, getCacheStats, queryClient])

  return {
    // Cache statistics
    cacheSize: cacheStats.totalEntries,
    cacheHitRate: cacheStats.cacheHitRate,
    totalQueries: cacheStats.totalEntries,
    activeQueries: queryClient.isFetching(),
    staleCacheCount: 0, // Simplified for now

    // Cache management functions
    clearExpiredCache,
    clearAllCache,
    optimizeCache,
    getCacheStats,

    // Debug functionality
    debugCache,
    cacheDebugEnabled: context?.debugEnabled || false
  }
}

/**
 * Hook for cache optimization strategies
 */
export function useCacheOptimization() {
  const queryClient = useQueryClient()

  // Optimize stale time based on usage patterns
  const optimizeStaleTime = useCallback(async (usagePatterns: Array<{
    queryKey: string[]
    accessFrequency: 'high' | 'medium' | 'low'
    lastAccessed: number
  }>) => {
    const optimizedTimes: Record<string, number> = {}

    usagePatterns.forEach(pattern => {
      const key = pattern.queryKey.join('-')

      // Calculate optimal stale time based on access frequency
      switch (pattern.accessFrequency) {
        case 'high':
          optimizedTimes[key] = 30 * 1000 // 30 seconds
          break
        case 'medium':
          optimizedTimes[key] = 2 * 60 * 1000 // 2 minutes
          break
        case 'low':
          optimizedTimes[key] = 10 * 60 * 1000 // 10 minutes
          break
      }
    })

    return optimizedTimes
  }, [])

  // Optimize garbage collection time
  const optimizeGcTime = useCallback(async (memoryUsage: number, priority: 'memory' | 'performance' = 'performance') => {
    if (priority === 'memory') {
      return 2 * 60 * 1000 // 2 minutes for memory optimization
    } else {
      return memoryUsage > 10 * 1024 * 1024 ? 5 * 60 * 1000 : 15 * 60 * 1000 // 5 or 15 minutes
    }
  }, [])

  // Enable smart refetching
  const enableSmartRefetching = useCallback(async (config: {
    focusRefetch?: boolean
    intervalRefetch?: boolean
    userActivityTracking?: boolean
    adaptiveRefetch?: boolean
  }) => {
    const strategies: string[] = []

    if (config.focusRefetch) strategies.push('focus')
    if (config.intervalRefetch) strategies.push('interval')
    if (config.userActivityTracking) strategies.push('user-activity')
    if (config.adaptiveRefetch) strategies.push('adaptive')

    return {
      enabled: strategies.length > 0,
      strategies
    }
  }, [])

  // Configure background refresh
  const configureBackgroundRefresh = useCallback(async (queries: string[], interval: number = 60000) => {
    // This would set up background refresh intervals
    // For now, return configuration
    return {
      interval,
      queries: queries.length,
      enabled: true
    }
  }, [])

  // Setup cache warming
  const setupCacheWarming = useCallback(async (warmingQueries: Array<{
    queryKey: string[]
    priority: 'high' | 'medium' | 'low'
    interval: number
  }>): Promise<CacheWarmingConfig> => {
    const activeWarmers = warmingQueries.length
    const warmingStrategies = ['interval', 'predictive']

    // In a real implementation, this would set up actual warming intervals
    warmingQueries.forEach(query => {
      if (query.priority === 'high') {
        // Set up high-priority warming
        console.log(`Setting up high-priority warming for`, query.queryKey)
      }
    })

    return {
      activeWarmers,
      warmingStrategies,
      totalWarmedQueries: warmingQueries.length
    }
  }, [])

  return {
    optimizeStaleTime,
    optimizeGcTime,
    enableSmartRefetching,
    configureBackgroundRefresh,
    setupCacheWarming
  }
}

/**
 * Hook for cache preloading
 */
export function useCachePreloader() {
  const queryClient = useQueryClient()
  const [preloadStatus, setPreloadStatus] = useState<PreloadStatus>({
    introPage: { loaded: false, loadTime: 0 },
    systemOverview: { loaded: false, loadTime: 0 },
    personalStats: { loaded: false, loadTime: 0 }
  })

  // Preload intro page data
  const preloadIntroPage = useCallback(async (userId: string) => {
    const startTime = performance.now()

    // Try to call the service directly to detect errors
    try {
      const data = await introPageService.getIntroPageData(userId)

      // If successful, set the data in cache
      queryClient.setQueryData(INTRO_PAGE_QUERY_KEYS.data(userId), data)

      const loadTime = performance.now() - startTime
      setPreloadStatus(prev => ({
        ...prev,
        introPage: { loaded: true, loadTime, error: undefined }
      }))
    } catch (error) {
      const loadTime = performance.now() - startTime
      setPreloadStatus(prev => ({
        ...prev,
        introPage: { loaded: false, loadTime, error: (error as Error).message }
      }))
    }
  }, [queryClient])

  // Preload critical system data
  const preloadCriticalData = useCallback(async () => {
    const startTime = performance.now()

    try {
      await queryClient.prefetchQuery({
        queryKey: INTRO_PAGE_QUERY_KEYS.systemOverview(),
        queryFn: () => introPageService.getSystemOverview(),
        staleTime: 2 * 60 * 1000
      })

      const loadTime = performance.now() - startTime
      setPreloadStatus(prev => ({
        ...prev,
        systemOverview: { loaded: true, loadTime, error: undefined }
      }))
    } catch (error) {
      setPreloadStatus(prev => ({
        ...prev,
        systemOverview: { loaded: false, loadTime: 0, error: (error as Error).message }
      }))
    }
  }, [queryClient])

  // Preload user-specific data
  const preloadUserSpecificData = useCallback(async (userId: string) => {
    const startTime = performance.now()

    try {
      await Promise.all([
        queryClient.prefetchQuery({
          queryKey: INTRO_PAGE_QUERY_KEYS.personalStats(userId),
          queryFn: () => introPageService.getUserStatistics(userId)
        }),
        queryClient.prefetchQuery({
          queryKey: INTRO_PAGE_QUERY_KEYS.actionableItems(userId),
          queryFn: () => introPageService.getActionableItems(userId)
        }),
        queryClient.prefetchQuery({
          queryKey: INTRO_PAGE_QUERY_KEYS.activityFeed(userId),
          queryFn: () => introPageService.getActivityFeed(userId)
        })
      ])

      const loadTime = performance.now() - startTime
      setPreloadStatus(prev => ({
        ...prev,
        personalStats: { loaded: true, loadTime, error: undefined }
      }))
    } catch (error) {
      setPreloadStatus(prev => ({
        ...prev,
        personalStats: { loaded: false, loadTime: 0, error: (error as Error).message }
      }))
    }
  }, [queryClient])

  // Get preload status
  const getPreloadStatus = useCallback(() => preloadStatus, [preloadStatus])

  return {
    preloadIntroPage,
    preloadCriticalData,
    preloadUserSpecificData,
    getPreloadStatus
  }
}

/**
 * Hook for cache invalidation strategies
 */
export function useCacheInvalidation() {
  const queryClient = useQueryClient()

  // Invalidate user-specific data
  const invalidateUserData = useCallback(async (userId: string) => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: INTRO_PAGE_QUERY_KEYS.data(userId)
      }),
      queryClient.invalidateQueries({
        queryKey: INTRO_PAGE_QUERY_KEYS.personalStats(userId)
      }),
      queryClient.invalidateQueries({
        queryKey: INTRO_PAGE_QUERY_KEYS.actionableItems(userId)
      }),
      queryClient.invalidateQueries({
        queryKey: INTRO_PAGE_QUERY_KEYS.activityFeed(userId)
      })
    ])
  }, [queryClient])

  // Invalidate system data
  const invalidateSystemData = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: INTRO_PAGE_QUERY_KEYS.systemOverview()
    })
  }, [queryClient])

  // Invalidate stale data based on age
  const invalidateStaleData = useCallback(async (maxAge: number = 60000) => {
    const cache = queryClient.getQueryCache()
    const queries = cache.getAll()
    const now = Date.now()
    let invalidatedCount = 0

    for (const query of queries) {
      const dataUpdatedAt = query.state.dataUpdatedAt || 0
      if (now - dataUpdatedAt > maxAge) {
        await queryClient.invalidateQueries({
          queryKey: query.queryKey
        })
        invalidatedCount++
      }
    }

    return invalidatedCount
  }, [queryClient])

  // Invalidate by pattern
  const invalidateByPattern = useCallback(async (pattern: string) => {
    const cache = queryClient.getQueryCache()
    const queries = cache.getAll()

    for (const query of queries) {
      const keyString = query.queryKey.join('-')
      if (keyString.includes(pattern)) {
        await queryClient.invalidateQueries({
          queryKey: query.queryKey
        })
      }
    }
  }, [queryClient])

  // Schedule invalidation
  const scheduleInvalidation = useCallback((config: {
    queryKey: any[]
    delay: number
    recurring?: boolean
  }) => {
    const scheduleId = `schedule-${Date.now()}-${Math.random()}`

    if (config.recurring) {
      setInterval(() => {
        queryClient.invalidateQueries({
          queryKey: config.queryKey
        })
      }, config.delay)
    } else {
      setTimeout(() => {
        queryClient.invalidateQueries({
          queryKey: config.queryKey
        })
      }, config.delay)
    }

    return scheduleId
  }, [queryClient])

  return {
    invalidateUserData,
    invalidateSystemData,
    invalidateStaleData,
    invalidateByPattern,
    scheduleInvalidation
  }
}

/**
 * Hook for cache persistence to localStorage
 */
export function useCachePersistence() {
  const queryClient = useQueryClient()
  const [persistenceEnabled, setPersistenceEnabled] = useState(false)
  const [storageError, setStorageError] = useState<string | null>(null)
  const [persistedQueries, setPersistedQueries] = useState<PersistedQuery[]>([])

  // Enable cache persistence
  const enablePersistence = useCallback(async (config: CachePersistenceConfig) => {
    try {
      setPersistenceEnabled(true)
      setStorageError(null)

      // Store configuration
      localStorage.setItem('ca-dms-cache-config', JSON.stringify(config))
    } catch (error) {
      setPersistenceEnabled(false)
      setStorageError((error as Error).name)
    }
  }, [])

  // Save cache to localStorage
  const saveCacheToStorage = useCallback(async () => {
    // Always try to save, but handle errors gracefully
    if (!persistenceEnabled) {
      setPersistenceEnabled(true) // Enable for this operation
    }

    try {
      const cache = queryClient.getQueryCache()
      const queries = cache.getAll()

      const cacheData = {
        queries: queries.map(query => ({
          queryKey: query.queryKey,
          data: query.state.data,
          timestamp: Date.now()
        })),
        timestamp: Date.now()
      }

      localStorage.setItem('ca-dms-cache', JSON.stringify(cacheData))
    } catch (error) {
      setPersistenceEnabled(false)
      if ((error as Error).message === 'QuotaExceededError') {
        setStorageError('QuotaExceededError')
      } else {
        setStorageError((error as Error).message)
      }
    }
  }, [persistenceEnabled, queryClient])

  // Load cache from localStorage
  const loadCacheFromStorage = useCallback(async () => {
    try {
      const cachedData = localStorage.getItem('ca-dms-cache')
      if (cachedData) {
        const parsed = JSON.parse(cachedData)
        setPersistedQueries(parsed.queries || [])

        // Optionally restore queries to React Query cache
        parsed.queries.forEach((query: PersistedQuery) => {
          queryClient.setQueryData(query.queryKey, query.data)
        })
      }
    } catch (error) {
      console.error('Failed to load cache from storage:', error)
    }
  }, [queryClient])

  // Clear persisted cache
  const clearPersistedCache = useCallback(async () => {
    try {
      localStorage.removeItem('ca-dms-cache')
      localStorage.removeItem('ca-dms-cache-config')
      setPersistedQueries([])
      setPersistenceEnabled(false)
    } catch (error) {
      console.error('Failed to clear persisted cache:', error)
    }
  }, [])

  // Get persisted queries
  const getPersistedQueries = useCallback(() => persistedQueries, [persistedQueries])

  // Get storage error
  const getStorageError = useCallback(() => storageError, [storageError])

  return {
    persistenceEnabled,
    enablePersistence,
    saveCacheToStorage,
    loadCacheFromStorage,
    clearPersistedCache,
    getPersistedQueries,
    getStorageError
  }
}