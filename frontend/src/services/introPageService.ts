/**
 * Intro Page Service - API Integration
 * Service for fetching and managing intro page dashboard data
 */
import { apiClient } from './api'

// Type definitions for intro page data structures
export interface UserStatistics {
  user_id: string
  documents: number
  templates: number
  recent_documents: Array<{
    id: string
    title: string
    updated_at: string
    status: string
  }>
  document_types: Record<string, number>
}

export interface SystemOverview {
  total_users: number
  active_documents: number
  documents_today: number
  documents_this_week: number
  system_health_score: number
}

export interface ActionableItem {
  id: string
  type: string
  title: string
  due_date: string
  priority: 'low' | 'medium' | 'high'
  status: string
}

export interface ActionableItems {
  user_id: string
  pending_approvals: number
  urgent_tasks: number
  overdue_items: number
  items: ActionableItem[]
}

export interface ActivityFeed {
  user_id: string
  recent_activities: string[]
  activities: Array<{
    id: string
    type: string
    description: string
    timestamp: string
    related_document?: string
  }>
  unread_count: number
}

export interface Personalization {
  theme: 'light' | 'dark'
  dashboard_layout: 'compact' | 'standard' | 'expanded'
  notifications: {
    email: boolean
    push: boolean
    in_app: boolean
  }
  widgets: string[]
  language?: string
  timezone?: string
}

export interface PerformanceMetrics {
  coordination_time_ms: number
  data_sources: string[]
  cache_hit_rate: number
  request_id: string
}

export interface IntroPageData {
  user_id: string
  user_statistics: UserStatistics
  system_overview: SystemOverview
  actionable_items: ActionableItems
  activity_feed: ActivityFeed
  personalization: Personalization
  performance_metrics: PerformanceMetrics
  last_updated: string
  data_sources: string[]
}

// Transformed frontend data structure
export interface TransformedIntroPageData {
  userId: string
  userStatistics: {
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
  systemOverview: SystemOverview
  actionableItems: ActionableItems
  activityFeed: ActivityFeed
  personalization: Personalization
  performanceMetrics: PerformanceMetrics
  lastUpdated: Date
  fallback_mode?: boolean
}

// Service options
export interface ServiceOptions {
  noCache?: boolean
  timeout?: number
}

export interface FilterOptions {
  priority?: 'low' | 'medium' | 'high'
  limit?: number
  offset?: number
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy'
  timestamp: string
  service?: string
  api_version?: string
}

// Authentication helper
const getAuthHeaders = () => {
  const token = localStorage.getItem('authToken') || 'test-jwt-token-frontend'
  return {
    Authorization: `Bearer ${token}`
  }
}

// Data transformation utilities
const transformIntroPageData = (apiData: IntroPageData): TransformedIntroPageData => {
  return {
    userId: apiData.user_id,
    userStatistics: {
      documentCount: apiData.user_statistics.documents,
      templateCount: apiData.user_statistics.templates,
      recentDocuments: apiData.user_statistics.recent_documents.map(doc => ({
        ...doc,
        updatedAt: new Date(doc.updated_at)
      })),
      documentTypes: apiData.user_statistics.document_types
    },
    systemOverview: apiData.system_overview,
    actionableItems: apiData.actionable_items,
    activityFeed: apiData.activity_feed,
    personalization: apiData.personalization,
    performanceMetrics: apiData.performance_metrics,
    lastUpdated: new Date(apiData.last_updated)
  }
}

// Response validation
const validateIntroPageResponse = (data: any): IntroPageData => {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid response format')
  }

  const required = ['user_id', 'last_updated']
  for (const field of required) {
    if (!(field in data)) {
      throw new Error(`Invalid response format: missing ${field}`)
    }
  }

  return data as IntroPageData
}

// Retry logic for network failures
const retryOnNetworkError = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 2
): Promise<T> => {
  let lastError: Error

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error

      // Only retry on network errors
      if (error instanceof Error && error.name === 'NetworkError' && attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
        continue
      }

      throw error
    }
  }

  throw lastError!
}

// Main service class
class IntroPageService {
  /**
   * Fetch complete intro page data for a user
   */
  async getIntroPageData(userId: string, options: ServiceOptions = {}): Promise<TransformedIntroPageData> {
    if (!userId || !userId.trim()) {
      throw new Error('User ID is required')
    }

    const headers: Record<string, string> = {
      ...getAuthHeaders()
    }

    if (options.noCache) {
      headers['Cache-Control'] = 'no-cache'
    }

    return retryOnNetworkError(async () => {
      const response = await apiClient.get<IntroPageData>(`/intro-page/${userId}`, {
        headers
      })

      const validatedData = validateIntroPageResponse(response)
      return transformIntroPageData(validatedData)
    })
  }

  /**
   * Fetch intro page data with fallback on service failures
   */
  async getIntroPageDataWithFallback(userId: string): Promise<TransformedIntroPageData> {
    try {
      return await this.getIntroPageData(userId)
    } catch (error) {
      // Provide fallback data on service failures
      if (error instanceof Error && error.status === 503) {
        return {
          userId,
          userStatistics: {
            documentCount: 0,
            templateCount: 0,
            recentDocuments: [],
            documentTypes: {}
          },
          systemOverview: {
            total_users: 0,
            active_documents: 0,
            documents_today: 0,
            documents_this_week: 0,
            system_health_score: 0
          },
          actionableItems: {
            user_id: userId,
            pending_approvals: 0,
            urgent_tasks: 0,
            overdue_items: 0,
            items: []
          },
          activityFeed: {
            user_id: userId,
            recent_activities: [],
            activities: [],
            unread_count: 0
          },
          personalization: {
            theme: 'light',
            dashboard_layout: 'standard',
            notifications: { email: true, push: false, in_app: true },
            widgets: []
          },
          performanceMetrics: {
            coordination_time_ms: 0,
            data_sources: [],
            cache_hit_rate: 0,
            request_id: 'fallback'
          },
          lastUpdated: new Date(),
          fallback_mode: true
        }
      }
      throw error
    }
  }

  /**
   * Fetch user statistics from individual service
   */
  async getUserStatistics(userId: string): Promise<UserStatistics> {
    if (!userId || !userId.trim()) {
      throw new Error('User ID is required')
    }

    const response = await apiClient.get<UserStatistics>(`/services/user-stats/${userId}`, {
      headers: getAuthHeaders()
    })

    return response
  }

  /**
   * Fetch system overview from individual service
   */
  async getSystemOverview(): Promise<SystemOverview> {
    const response = await apiClient.get<SystemOverview>('/services/system-stats', {
      headers: getAuthHeaders()
    })

    return response
  }

  /**
   * Fetch actionable items with filtering support
   */
  async getActionableItems(userId: string, filters: FilterOptions = {}): Promise<ActionableItems> {
    if (!userId || !userId.trim()) {
      throw new Error('User ID is required')
    }

    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value.toString())
      }
    })

    const queryString = params.toString()
    const url = `/services/actionable-items/${userId}${queryString ? `?${queryString}` : ''}`

    const response = await apiClient.get<ActionableItems>(url, {
      headers: getAuthHeaders(),
      ...(Object.keys(filters).length > 0 && { params: filters })
    })

    return response
  }

  /**
   * Fetch activity feed with filtering
   */
  async getActivityFeed(userId: string, filters: FilterOptions = {}): Promise<ActivityFeed> {
    if (!userId || !userId.trim()) {
      throw new Error('User ID is required')
    }

    const response = await apiClient.get<ActivityFeed>(`/services/activity-feed/${userId}`, {
      headers: getAuthHeaders(),
      ...(Object.keys(filters).length > 0 && { params: filters })
    })

    return response
  }

  /**
   * Fetch personalization settings
   */
  async getPersonalization(userId: string): Promise<Personalization> {
    if (!userId || !userId.trim()) {
      throw new Error('User ID is required')
    }

    const response = await apiClient.get<Personalization>(`/services/personalization/${userId}`, {
      headers: getAuthHeaders()
    })

    return response
  }

  /**
   * Update personalization settings
   */
  async updatePersonalization(userId: string, data: Partial<Personalization>): Promise<Personalization> {
    if (!userId || !userId.trim()) {
      throw new Error('User ID is required')
    }

    const response = await (apiClient as any).put<Personalization>(`/services/personalization/${userId}`, data, {
      headers: getAuthHeaders()
    })

    return response
  }

  /**
   * Check intro page service health
   */
  async checkHealth(): Promise<HealthStatus> {
    const response = await apiClient.get<HealthStatus>('/health')
    return response
  }

  /**
   * Check individual service health
   */
  async checkServiceHealth(serviceName: string): Promise<HealthStatus> {
    const response = await apiClient.get<HealthStatus>(`/services/${serviceName}/health`)
    return response
  }
}

// Export singleton instance
export const introPageService = new IntroPageService()
export default introPageService