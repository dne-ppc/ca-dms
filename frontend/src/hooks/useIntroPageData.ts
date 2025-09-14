/**
 * useIntroPageData Hook - Custom data fetching hooks for intro page
 * Provides React Query-based hooks for efficient intro page data management
 */
import { useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'

import { introPageService } from '../services/introPageService'
import type {
  TransformedIntroPageData,
  SystemOverview,
  ServiceOptions,
  ActionableItems,
  ActivityFeed
} from '../services/introPageService'

// Query keys for React Query
export const INTRO_PAGE_QUERY_KEYS = {
  all: ['introPage'] as const,
  data: (userId: string) => [...INTRO_PAGE_QUERY_KEYS.all, 'data', userId] as const,
  systemOverview: () => [...INTRO_PAGE_QUERY_KEYS.all, 'systemOverview'] as const,
  personalStats: (userId: string) => [...INTRO_PAGE_QUERY_KEYS.all, 'personalStats', userId] as const,
  actionableItems: (userId: string) => [...INTRO_PAGE_QUERY_KEYS.all, 'actionableItems', userId] as const,
  activityFeed: (userId: string) => [...INTRO_PAGE_QUERY_KEYS.all, 'activityFeed', userId] as const
}

// Hook options interfaces
export interface UseIntroPageDataOptions extends ServiceOptions {
  fallback?: boolean
  enabled?: boolean
  staleTime?: number
  gcTime?: number
}

export interface UseActionableItemsOptions {
  priority?: 'low' | 'medium' | 'high'
  enabled?: boolean
}

export interface UseActivityFeedOptions {
  activityTypes?: string[]
  limit?: number
  enabled?: boolean
}

// UserStatistics type (from service but need to import correctly)
interface UserStatistics {
  documentCount: number
  templateCount: number
  recentDocuments: Array<{
    id: string
    title: string
    updatedAt: Date
    status: string
  }>
  documentTypes: Record<string, number>
}

/**
 * Main hook for fetching complete intro page data
 */
export function useIntroPageData(
  userId: string,
  options: UseIntroPageDataOptions = {}
): UseQueryResult<TransformedIntroPageData, Error> & { refetch: () => Promise<any> } {
  const { fallback = false, enabled = true, staleTime = 5 * 60 * 1000, gcTime = 10 * 60 * 1000, ...serviceOptions } = options

  return useQuery({
    queryKey: INTRO_PAGE_QUERY_KEYS.data(userId),
    queryFn: async () => {
      if (!userId || !userId.trim()) {
        throw new Error('User ID is required')
      }

      if (fallback) {
        return introPageService.getIntroPageDataWithFallback(userId)
      } else {
        // Only pass serviceOptions if there are actual options set
        const hasOptions = Object.keys(serviceOptions).length > 0
        if (hasOptions) {
          return introPageService.getIntroPageData(userId, serviceOptions)
        } else {
          return introPageService.getIntroPageData(userId)
        }
      }
    },
    enabled: enabled && !!userId,
    staleTime,
    gcTime,
    retry: (failureCount, error) => {
      // Don't retry on user ID validation errors
      if (error.message === 'User ID is required') {
        return false
      }
      // Don't retry on test errors to avoid timeouts
      if (error.message.includes('Failed to fetch')) {
        return false
      }
      return failureCount < 2
    }
  })
}

/**
 * Hook for fetching system overview data
 */
export function useSystemOverview(
  options: { enabled?: boolean; staleTime?: number } = {}
): UseQueryResult<SystemOverview, Error> & { refetch: () => Promise<any> } {
  const { enabled = true, staleTime = 2 * 60 * 1000 } = options

  return useQuery({
    queryKey: INTRO_PAGE_QUERY_KEYS.systemOverview(),
    queryFn: () => introPageService.getSystemOverview(),
    enabled,
    staleTime,
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: (failureCount, error) => {
      if (error.message.includes('Failed to fetch')) {
        return false
      }
      return failureCount < 2
    }
  })
}

/**
 * Hook for fetching personal statistics data
 */
export function usePersonalStats(
  userId: string,
  options: { enabled?: boolean; staleTime?: number } = {}
): UseQueryResult<UserStatistics, Error> & { refetch: () => Promise<any> } {
  const { enabled = true, staleTime = 5 * 60 * 1000 } = options

  return useQuery({
    queryKey: INTRO_PAGE_QUERY_KEYS.personalStats(userId),
    queryFn: () => introPageService.getUserStatistics(userId),
    enabled: enabled && !!userId,
    staleTime,
    gcTime: 10 * 60 * 1000,
    retry: (failureCount, error) => {
      if (error.message.includes('Failed to fetch')) {
        return false
      }
      return failureCount < 2
    }
  })
}

/**
 * Hook for fetching actionable items with filtering options
 */
export function useActionableItems(
  userId: string,
  options: UseActionableItemsOptions = {}
): UseQueryResult<ActionableItems, Error> & { refetch: () => Promise<any> } {
  const { priority, enabled = true } = options

  return useQuery({
    queryKey: [...INTRO_PAGE_QUERY_KEYS.actionableItems(userId), { priority }],
    queryFn: async () => {
      const data = await introPageService.getActionableItems(userId)

      // Apply client-side filtering if priority is specified
      if (priority) {
        return {
          ...data,
          items: data.items.filter(item => item.priority === priority)
        }
      }

      return data
    },
    enabled: enabled && !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes - actionable items should be fresh
    gcTime: 5 * 60 * 1000,
    retry: (failureCount, error) => {
      if (error.message.includes('Failed to fetch')) {
        return false
      }
      return failureCount < 2
    }
  })
}

/**
 * Hook for fetching activity feed with filtering options
 */
export function useActivityFeed(
  userId: string,
  options: UseActivityFeedOptions = {}
): UseQueryResult<ActivityFeed, Error> & { refetch: () => Promise<any> } {
  const { activityTypes, limit, enabled = true } = options

  return useQuery({
    queryKey: [...INTRO_PAGE_QUERY_KEYS.activityFeed(userId), { activityTypes, limit }],
    queryFn: async () => {
      const data = await introPageService.getActivityFeed(userId)

      let filteredActivities = data.activities

      // Apply activity type filtering
      if (activityTypes && activityTypes.length > 0) {
        filteredActivities = filteredActivities.filter(activity =>
          activityTypes.includes(activity.type)
        )
      }

      // Apply limit
      if (limit && limit > 0) {
        filteredActivities = filteredActivities.slice(0, limit)
      }

      return {
        ...data,
        activities: filteredActivities
      }
    },
    enabled: enabled && !!userId,
    staleTime: 1 * 60 * 1000, // 1 minute - activity feed should be very fresh
    gcTime: 5 * 60 * 1000,
    retry: (failureCount, error) => {
      if (error.message.includes('Failed to fetch')) {
        return false
      }
      return failureCount < 2
    }
  })
}

/**
 * Hook for managing data refresh operations
 */
export function useIntroPageRefresh(userId: string) {
  const queryClient = useQueryClient()

  const refreshSystemOverview = useCallback(async () => {
    await queryClient.refetchQueries({
      queryKey: INTRO_PAGE_QUERY_KEYS.systemOverview()
    })
  }, [queryClient])

  const refreshPersonalStats = useCallback(async () => {
    await queryClient.refetchQueries({
      queryKey: INTRO_PAGE_QUERY_KEYS.personalStats(userId)
    })
  }, [queryClient, userId])

  const refreshActionableItems = useCallback(async () => {
    await queryClient.refetchQueries({
      queryKey: INTRO_PAGE_QUERY_KEYS.actionableItems(userId)
    })
  }, [queryClient, userId])

  const refreshActivityFeed = useCallback(async () => {
    await queryClient.refetchQueries({
      queryKey: INTRO_PAGE_QUERY_KEYS.activityFeed(userId)
    })
  }, [queryClient, userId])

  const refreshAll = useCallback(async () => {
    await Promise.all([
      refreshSystemOverview(),
      refreshPersonalStats(),
      refreshActionableItems(),
      refreshActivityFeed()
    ])
  }, [refreshSystemOverview, refreshPersonalStats, refreshActionableItems, refreshActivityFeed])

  // Get query states for refresh status tracking
  const systemQuery = queryClient.getQueryState(INTRO_PAGE_QUERY_KEYS.systemOverview())
  const personalQuery = queryClient.getQueryState(INTRO_PAGE_QUERY_KEYS.personalStats(userId))
  const actionableQuery = queryClient.getQueryState(INTRO_PAGE_QUERY_KEYS.actionableItems(userId))
  const activityQuery = queryClient.getQueryState(INTRO_PAGE_QUERY_KEYS.activityFeed(userId))

  const isRefreshing = useMemo(() => ({
    systemOverview: systemQuery?.isFetching ?? false,
    personalStats: personalQuery?.isFetching ?? false,
    actionableItems: actionableQuery?.isFetching ?? false,
    activityFeed: activityQuery?.isFetching ?? false
  }), [systemQuery?.isFetching, personalQuery?.isFetching, actionableQuery?.isFetching, activityQuery?.isFetching])

  const lastRefresh = useMemo(() => ({
    systemOverview: systemQuery?.dataUpdatedAt ? new Date(systemQuery.dataUpdatedAt) : null,
    personalStats: personalQuery?.dataUpdatedAt ? new Date(personalQuery.dataUpdatedAt) : null,
    actionableItems: actionableQuery?.dataUpdatedAt ? new Date(actionableQuery.dataUpdatedAt) : null,
    activityFeed: activityQuery?.dataUpdatedAt ? new Date(activityQuery.dataUpdatedAt) : null
  }), [
    systemQuery?.dataUpdatedAt,
    personalQuery?.dataUpdatedAt,
    actionableQuery?.dataUpdatedAt,
    activityQuery?.dataUpdatedAt
  ])

  return {
    refreshAll,
    refreshSystemOverview,
    refreshPersonalStats,
    refreshActionableItems,
    refreshActivityFeed,
    isRefreshing,
    lastRefresh
  }
}

/**
 * Hook for invalidating and clearing intro page cache
 */
export function useIntroPageCache() {
  const queryClient = useQueryClient()

  const invalidateAll = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: INTRO_PAGE_QUERY_KEYS.all
    })
  }, [queryClient])

  const clearCache = useCallback(() => {
    queryClient.removeQueries({
      queryKey: INTRO_PAGE_QUERY_KEYS.all
    })
  }, [queryClient])

  const prefetchIntroPageData = useCallback(async (userId: string, options: ServiceOptions = {}) => {
    await queryClient.prefetchQuery({
      queryKey: INTRO_PAGE_QUERY_KEYS.data(userId),
      queryFn: () => introPageService.getIntroPageData(userId, options),
      staleTime: 5 * 60 * 1000
    })
  }, [queryClient])

  return {
    invalidateAll,
    clearCache,
    prefetchIntroPageData
  }
}