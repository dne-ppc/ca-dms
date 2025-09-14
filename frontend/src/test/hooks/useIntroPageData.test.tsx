/**
 * useIntroPageData Hook Tests - TDD Red Phase
 * Tests for custom intro page data fetching hooks
 */
import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'

import {
  useIntroPageData,
  useSystemOverview,
  usePersonalStats,
  useActionableItems,
  useActivityFeed,
  useIntroPageRefresh
} from '../../hooks/useIntroPageData'
import { introPageService } from '../../services/introPageService'
import type { TransformedIntroPageData } from '../../services/introPageService'

// Mock the intro page service
vi.mock('../../services/introPageService', () => ({
  introPageService: {
    getIntroPageData: vi.fn(),
    getIntroPageDataWithFallback: vi.fn(),
    getSystemOverview: vi.fn(),
    getUserStatistics: vi.fn(),
    getActionableItems: vi.fn(),
    getActivityFeed: vi.fn()
  }
}))

// Mock data for testing
const mockIntroPageData: TransformedIntroPageData = {
  userId: 'test-user-123',
  userStatistics: {
    documentCount: 42,
    templateCount: 8,
    recentDocuments: [
      {
        id: 'doc-001',
        title: 'Budget Proposal 2024',
        updatedAt: new Date('2024-12-20T10:30:00Z'),
        status: 'draft'
      },
      {
        id: 'doc-002',
        title: 'Meeting Minutes',
        updatedAt: new Date('2024-12-19T14:15:00Z'),
        status: 'published'
      }
    ],
    documentTypes: {
      'proposal': 15,
      'meeting_minutes': 12,
      'policy': 8,
      'other': 7
    }
  },
  systemOverview: {
    total_users: 156,
    active_documents: 234,
    documents_today: 12,
    documents_this_week: 67,
    system_health_score: 98.5
  },
  actionableItems: {
    user_id: 'test-user-123',
    pending_approvals: 5,
    urgent_tasks: 2,
    overdue_items: 1,
    items: [
      {
        id: 'action-001',
        type: 'approval_required',
        title: 'Budget Proposal Review',
        due_date: '2024-12-25',
        priority: 'high',
        status: 'pending'
      },
      {
        id: 'action-002',
        type: 'document_review',
        title: 'Policy Update Review',
        due_date: '2024-12-23',
        priority: 'medium',
        status: 'in_progress'
      }
    ]
  },
  activityFeed: {
    user_id: 'test-user-123',
    recent_activities: ['document_created', 'approval_submitted', 'template_used'],
    activities: [
      {
        id: 'activity-001',
        type: 'document_created',
        title: 'New document: Budget Proposal 2024',
        timestamp: '2024-12-20T10:30:00Z',
        user: 'John Manager',
        metadata: { document_id: 'doc-001', document_type: 'proposal' }
      },
      {
        id: 'activity-002',
        type: 'approval_submitted',
        title: 'Approval submitted for Policy Update',
        timestamp: '2024-12-20T09:15:00Z',
        user: 'Jane Approver',
        metadata: { document_id: 'doc-003', approval_status: 'approved' }
      }
    ]
  },
  personalization: {
    user_id: 'test-user-123',
    preferences: {
      dashboard_layout: 'compact',
      default_view: 'actionable_items',
      notifications_enabled: true,
      auto_refresh: true
    },
    quick_actions: [
      { id: 'create_document', label: 'Create Document', icon: '📄' },
      { id: 'review_pending', label: 'Review Pending', icon: '👀' },
      { id: 'view_templates', label: 'View Templates', icon: '📋' }
    ]
  },
  performanceMetrics: {
    user_id: 'test-user-123',
    response_time: 145,
    cache_hit_rate: 0.92,
    data_freshness: 300,
    error_rate: 0.001
  },
  lastUpdated: new Date('2024-12-20T10:30:00Z')
}

// Test wrapper with QueryClient
const createQueryWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0
      }
    }
  })

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('useIntroPageData Hook - TDD Red Phase', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0
        }
      }
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    queryClient.clear()
  })

  describe('Core Data Fetching Hooks', () => {
    it('should fetch intro page data successfully', async () => {
      const mockGetIntroPageData = vi.mocked(introPageService.getIntroPageData)
      mockGetIntroPageData.mockResolvedValue(mockIntroPageData)

      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => useIntroPageData('test-user-123'), { wrapper })

      expect(result.current.isLoading).toBe(true)
      expect(result.current.data).toBeUndefined()
      expect(result.current.error).toBe(null)

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data).toEqual(mockIntroPageData)
      expect(result.current.error).toBe(null)
      expect(mockGetIntroPageData).toHaveBeenCalledWith('test-user-123')
    })

    it('should handle intro page data fetch errors', async () => {
      const mockError = new Error('Failed to fetch intro page data')
      const mockGetIntroPageData = vi.mocked(introPageService.getIntroPageData)
      mockGetIntroPageData.mockRejectedValue(mockError)

      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => useIntroPageData('test-user-123', {
        staleTime: 0,
        gcTime: 0
      }), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      }, { timeout: 3000 })

      expect(result.current.data).toBeUndefined()
      expect(result.current.error).toEqual(mockError)
    })

    it('should support intro page data refresh', async () => {
      const mockGetIntroPageData = vi.mocked(introPageService.getIntroPageData)
      mockGetIntroPageData.mockResolvedValue(mockIntroPageData)

      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => useIntroPageData('test-user-123'), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Trigger refetch
      await result.current.refetch()

      expect(mockGetIntroPageData).toHaveBeenCalledTimes(2)
    })

    it('should pass service options to intro page data fetch', async () => {
      const mockGetIntroPageData = vi.mocked(introPageService.getIntroPageData)
      mockGetIntroPageData.mockResolvedValue(mockIntroPageData)

      const options = { noCache: true, timeout: 5000 }
      const wrapper = createQueryWrapper()

      renderHook(() => useIntroPageData('test-user-123', options), { wrapper })

      await waitFor(() => {
        expect(mockGetIntroPageData).toHaveBeenCalledWith('test-user-123', options)
      })
    })
  })

  describe('System Overview Hook', () => {
    it('should fetch system overview data successfully', async () => {
      const mockGetSystemOverview = vi.mocked(introPageService.getSystemOverview)
      mockGetSystemOverview.mockResolvedValue(mockIntroPageData.systemOverview)

      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => useSystemOverview(), { wrapper })

      expect(result.current.isLoading).toBe(true)

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data).toEqual(mockIntroPageData.systemOverview)
      expect(mockGetSystemOverview).toHaveBeenCalledWith()
    })

    it('should handle system overview fetch errors', async () => {
      const mockError = new Error('Failed to fetch system overview')
      const mockGetSystemOverview = vi.mocked(introPageService.getSystemOverview)
      mockGetSystemOverview.mockRejectedValue(mockError)

      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => useSystemOverview(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toEqual(mockError)
    })

    it('should cache system overview data appropriately', async () => {
      const mockGetSystemOverview = vi.mocked(introPageService.getSystemOverview)
      mockGetSystemOverview.mockResolvedValue(mockIntroPageData.systemOverview)

      const wrapper = createQueryWrapper()

      // First hook instance
      const { result: result1 } = renderHook(() => useSystemOverview(), { wrapper })
      await waitFor(() => {
        expect(result1.current.isLoading).toBe(false)
      })

      // Second hook instance should use cached data
      const { result: result2 } = renderHook(() => useSystemOverview(), { wrapper })

      expect(result2.current.isLoading).toBe(false)
      expect(result2.current.data).toEqual(mockIntroPageData.systemOverview)
      expect(mockGetSystemOverview).toHaveBeenCalledTimes(1)
    })
  })

  describe('Personal Statistics Hook', () => {
    it('should fetch personal statistics successfully', async () => {
      const mockGetUserStatistics = vi.mocked(introPageService.getUserStatistics)
      mockGetUserStatistics.mockResolvedValue(mockIntroPageData.userStatistics)

      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => usePersonalStats('test-user-123'), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data).toEqual(mockIntroPageData.userStatistics)
      expect(mockGetUserStatistics).toHaveBeenCalledWith('test-user-123')
    })

    it('should require user ID for personal statistics', () => {
      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => usePersonalStats(''), { wrapper })

      expect(result.current.isLoading).toBe(false)
      expect(result.current.data).toBeUndefined()
      expect(result.current.error).toBe(null)
    })

    it('should handle personal statistics fetch errors', async () => {
      const mockError = new Error('Failed to fetch user statistics')
      const mockGetUserStatistics = vi.mocked(introPageService.getUserStatistics)
      mockGetUserStatistics.mockRejectedValue(mockError)

      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => usePersonalStats('test-user-123'), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('Actionable Items Hook', () => {
    it('should fetch actionable items successfully', async () => {
      const mockGetActionableItems = vi.mocked(introPageService.getActionableItems)
      mockGetActionableItems.mockResolvedValue(mockIntroPageData.actionableItems)

      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => useActionableItems('test-user-123'), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data).toEqual(mockIntroPageData.actionableItems)
      expect(mockGetActionableItems).toHaveBeenCalledWith('test-user-123')
    })

    it('should support priority filtering for actionable items', async () => {
      const highPriorityItems = {
        ...mockIntroPageData.actionableItems,
        items: mockIntroPageData.actionableItems.items.filter(item => item.priority === 'high')
      }

      const mockGetActionableItems = vi.mocked(introPageService.getActionableItems)
      mockGetActionableItems.mockResolvedValue(highPriorityItems)

      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => useActionableItems('test-user-123', { priority: 'high' }), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data?.items).toHaveLength(1)
      expect(result.current.data?.items[0].priority).toBe('high')
    })

    it('should handle actionable items fetch errors', async () => {
      const mockError = new Error('Failed to fetch actionable items')
      const mockGetActionableItems = vi.mocked(introPageService.getActionableItems)
      mockGetActionableItems.mockRejectedValue(mockError)

      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => useActionableItems('test-user-123'), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('Activity Feed Hook', () => {
    it('should fetch activity feed successfully', async () => {
      const mockGetActivityFeed = vi.mocked(introPageService.getActivityFeed)
      mockGetActivityFeed.mockResolvedValue(mockIntroPageData.activityFeed)

      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => useActivityFeed('test-user-123'), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data).toEqual(mockIntroPageData.activityFeed)
      expect(mockGetActivityFeed).toHaveBeenCalledWith('test-user-123')
    })

    it('should support activity type filtering', async () => {
      const filteredActivities = {
        ...mockIntroPageData.activityFeed,
        activities: mockIntroPageData.activityFeed.activities.filter(activity =>
          activity.type === 'document_created'
        )
      }

      const mockGetActivityFeed = vi.mocked(introPageService.getActivityFeed)
      mockGetActivityFeed.mockResolvedValue(filteredActivities)

      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => useActivityFeed('test-user-123', {
        activityTypes: ['document_created']
      }), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data?.activities).toHaveLength(1)
      expect(result.current.data?.activities[0].type).toBe('document_created')
    })

    it('should handle activity feed fetch errors', async () => {
      const mockError = new Error('Failed to fetch activity feed')
      const mockGetActivityFeed = vi.mocked(introPageService.getActivityFeed)
      mockGetActivityFeed.mockRejectedValue(mockError)

      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => useActivityFeed('test-user-123'), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('Data Refresh Hook', () => {
    it('should provide refresh functionality for all data types', async () => {
      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => useIntroPageRefresh('test-user-123'), { wrapper })

      expect(typeof result.current.refreshAll).toBe('function')
      expect(typeof result.current.refreshSystemOverview).toBe('function')
      expect(typeof result.current.refreshPersonalStats).toBe('function')
      expect(typeof result.current.refreshActionableItems).toBe('function')
      expect(typeof result.current.refreshActivityFeed).toBe('function')
    })

    it('should track refresh status for all data types', async () => {
      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => useIntroPageRefresh('test-user-123'), { wrapper })

      expect(result.current.isRefreshing.systemOverview).toBe(false)
      expect(result.current.isRefreshing.personalStats).toBe(false)
      expect(result.current.isRefreshing.actionableItems).toBe(false)
      expect(result.current.isRefreshing.activityFeed).toBe(false)
    })

    it('should provide last refresh timestamps', async () => {
      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => useIntroPageRefresh('test-user-123'), { wrapper })

      expect(typeof result.current.lastRefresh.systemOverview).toBe('object')
      expect(typeof result.current.lastRefresh.personalStats).toBe('object')
      expect(typeof result.current.lastRefresh.actionableItems).toBe('object')
      expect(typeof result.current.lastRefresh.activityFeed).toBe('object')
    })
  })

  describe('Hook Integration and Performance', () => {
    it('should handle concurrent data fetching efficiently', async () => {
      const mockGetSystemOverview = vi.mocked(introPageService.getSystemOverview)
      const mockGetUserStatistics = vi.mocked(introPageService.getUserStatistics)
      const mockGetActionableItems = vi.mocked(introPageService.getActionableItems)
      const mockGetActivityFeed = vi.mocked(introPageService.getActivityFeed)

      mockGetSystemOverview.mockResolvedValue(mockIntroPageData.systemOverview)
      mockGetUserStatistics.mockResolvedValue(mockIntroPageData.userStatistics)
      mockGetActionableItems.mockResolvedValue(mockIntroPageData.actionableItems)
      mockGetActivityFeed.mockResolvedValue(mockIntroPageData.activityFeed)

      const wrapper = createQueryWrapper()

      // Render all hooks simultaneously
      const { result: systemResult } = renderHook(() => useSystemOverview(), { wrapper })
      const { result: personalResult } = renderHook(() => usePersonalStats('test-user-123'), { wrapper })
      const { result: actionableResult } = renderHook(() => useActionableItems('test-user-123'), { wrapper })
      const { result: activityResult } = renderHook(() => useActivityFeed('test-user-123'), { wrapper })

      await waitFor(() => {
        expect(systemResult.current.isLoading).toBe(false)
        expect(personalResult.current.isLoading).toBe(false)
        expect(actionableResult.current.isLoading).toBe(false)
        expect(activityResult.current.isLoading).toBe(false)
      })

      expect(systemResult.current.data).toBeDefined()
      expect(personalResult.current.data).toBeDefined()
      expect(actionableResult.current.data).toBeDefined()
      expect(activityResult.current.data).toBeDefined()
    })

    it('should implement proper stale-while-revalidate caching', async () => {
      const mockGetSystemOverview = vi.mocked(introPageService.getSystemOverview)
      mockGetSystemOverview.mockResolvedValue(mockIntroPageData.systemOverview)

      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => useSystemOverview(), { wrapper })

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const initialData = result.current.data

      // Trigger refetch - should return cached data immediately while refetching
      const refetchPromise = result.current.refetch()

      expect(result.current.data).toBe(initialData) // Still has cached data

      await refetchPromise

      expect(mockGetSystemOverview).toHaveBeenCalledTimes(2)
    })

    it('should handle network failures gracefully with fallback data', async () => {
      const mockGetIntroPageDataWithFallback = vi.mocked(introPageService.getIntroPageDataWithFallback)
      mockGetIntroPageDataWithFallback.mockResolvedValue({
        ...mockIntroPageData,
        fallback_mode: true
      })

      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => useIntroPageData('test-user-123', { fallback: true }), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data?.fallback_mode).toBe(true)
      expect(mockGetIntroPageDataWithFallback).toHaveBeenCalledWith('test-user-123')
    })
  })
})