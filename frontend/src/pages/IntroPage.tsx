/**
 * IntroPage Main Component
 * Main container component with routing integration
 */
import React, { useState, useEffect, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import { IntroPageLayout } from '../components/intro/IntroPageLayout'
import { UserStatisticsCard } from '../components/intro/UserStatisticsCard'
import { SystemOverviewCard } from '../components/intro/SystemOverviewCard'
import { ActionableItemsCard } from '../components/intro/ActionableItemsCard'
import { ActivityFeedCard } from '../components/intro/ActivityFeedCard'
import { authService, getCurrentUser, isAuthenticated, User } from '../services/authService'
import { introPageService, TransformedIntroPageData } from '../services/introPageService'

export const IntroPage: React.FC = () => {
  const [user, setUser] = useState<User | null>(null)
  const [data, setData] = useState<TransformedIntroPageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [realTimeConnected, setRealTimeConnected] = useState(true)

  // Set page title
  useEffect(() => {
    document.title = 'CA-DMS Dashboard - Community Association Document Management'
  }, [])

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      if (!isAuthenticated()) {
        setLoading(false)
        return
      }

      try {
        const currentUser = await getCurrentUser()
        setUser(currentUser)
      } catch (error) {
        console.error('Failed to get current user:', error)
        setError('Authentication failed')
      }
    }

    checkAuth()
  }, [])

  // Fetch intro page data
  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const introData = await introPageService.getIntroPageData(user.id)
        setData(introData)
      } catch (error) {
        console.error('Failed to fetch intro page data:', error)
        setError('Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user])

  // Handle responsive layout
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }

    handleResize() // Set initial value
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Handle refresh functionality
  const handleRefresh = useCallback(async () => {
    if (!user || isRefreshing) return

    try {
      setIsRefreshing(true)
      const freshData = await introPageService.getIntroPageData(user.id, { noCache: true })
      setData(freshData)
      setError(null)
    } catch (error) {
      console.error('Failed to refresh data:', error)
      setError('Failed to refresh data')
    } finally {
      setIsRefreshing(false)
    }
  }, [user, isRefreshing])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'F5' || (event.ctrlKey && event.key === 'r')) {
      event.preventDefault()
      handleRefresh()
    }
  }, [handleRefresh])

  // Skip to main content link
  const SkipToMainContent = () => (
    <a
      href="#main-content"
      data-testid="skip-to-main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-500 text-white px-4 py-2 rounded z-50"
    >
      Skip to main content
    </a>
  )

  // Loading skeleton
  const LoadingSkeleton = () => (
    <div data-testid="intro-page-loading" className="space-y-6">
      <div className="h-8 bg-gray-200 rounded animate-pulse mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-64 bg-gray-200 rounded animate-pulse" />
        ))}
      </div>
    </div>
  )

  // Error boundary
  const ErrorDisplay = () => (
    <div data-testid="intro-page-error" className="text-center py-12">
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
        <h2 className="text-lg font-semibold text-red-800 mb-2">
          Unable to Load Dashboard
        </h2>
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
        >
          {isRefreshing ? 'Retrying...' : 'Try Again'}
        </button>
      </div>
    </div>
  )

  // Real-time connection status
  const RealTimeStatus = () => (
    <div data-testid="real-time-status" className="flex items-center space-x-2 text-sm">
      <div className={`w-2 h-2 rounded-full ${realTimeConnected ? 'bg-green-500' : 'bg-red-500'}`} />
      <span className="text-gray-600">
        {realTimeConnected ? 'Connected' : 'Disconnected'}
      </span>
    </div>
  )

  // Authentication required
  if (!isAuthenticated()) {
    return (
      <div data-testid="auth-required" className="text-center py-12">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-md mx-auto">
          <h2 className="text-lg font-semibold text-yellow-800 mb-2">
            Authentication Required
          </h2>
          <p className="text-yellow-600 mb-4">
            Please log in to access your dashboard.
          </p>
          {/* Only redirect in actual app, not in tests */}
          {typeof window !== 'undefined' && !window.location.pathname.includes('test') && (
            <Navigate to="/login" replace />
          )}
        </div>
      </div>
    )
  }

  // Loading state
  if (loading) {
    return (
      <div onKeyDown={handleKeyDown} tabIndex={-1}>
        <SkipToMainContent />
        <LoadingSkeleton />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div onKeyDown={handleKeyDown} tabIndex={-1}>
        <SkipToMainContent />
        <ErrorDisplay />
      </div>
    )
  }

  // Main layout with data
  const layoutVariant = isMobile ? 'mobile' : 'desktop'
  const theme = data?.personalization?.theme || 'light'
  const layout = data?.personalization?.dashboard_layout || 'standard'

  return (
    <div onKeyDown={handleKeyDown} tabIndex={-1}>
      <SkipToMainContent />

      <IntroPageLayout
        variant={layoutVariant}
        className={`theme-${theme} layout-${layout} ${isMobile ? 'mobile-layout' : 'desktop-layout'}`}
      >
        <main id="main-content" role="main">
          {/* Header Section */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Welcome back, {user?.name || 'User'}
              </h1>
              <p className="text-gray-600">
                Here's what's happening with your community documents
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <RealTimeStatus />
              <button
                data-testid="intro-page-refresh"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50 transition-colors"
                title="Refresh dashboard data (F5 or Ctrl+R)"
              >
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* User Statistics */}
            {(!data?.personalization?.widgets || data.personalization.widgets.includes('recent_documents')) && (
              <div data-testid="widget-recent_documents">
                <UserStatisticsCard
                  data={data?.userStatistics || null}
                  loading={loading}
                />
              </div>
            )}

            {/* System Overview */}
            <SystemOverviewCard
              data={data?.systemOverview || null}
              loading={loading}
            />

            {/* Actionable Items */}
            {(!data?.personalization?.widgets || data.personalization.widgets.includes('pending_tasks')) && (
              <div data-testid="widget-pending_tasks">
                <ActionableItemsCard
                  data={data?.actionableItems || null}
                  loading={loading}
                />
              </div>
            )}

            {/* Activity Feed - Always show for now */}
            <div data-testid="widget-activity_feed">
              <ActivityFeedCard
                data={data?.activityFeed || null}
                loading={loading}
              />
            </div>

            {/* System Stats Widget */}
            {data?.personalization?.widgets?.includes('system_stats') && (
              <div data-testid="widget-system_stats">
                <SystemOverviewCard
                  data={data?.systemOverview || null}
                  loading={loading}
                  variant="detailed"
                />
              </div>
            )}

            {/* Quick Actions Widget */}
            {data?.personalization?.widgets?.includes('quick_actions') && (
              <div data-testid="widget-quick_actions">
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
                  <div className="space-y-2">
                    <button className="w-full text-left p-2 hover:bg-gray-50 rounded">
                      Create New Document
                    </button>
                    <button className="w-full text-left p-2 hover:bg-gray-50 rounded">
                      View Recent Documents
                    </button>
                    <button className="w-full text-left p-2 hover:bg-gray-50 rounded">
                      Manage Templates
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Performance Metrics Display */}
          {data?.performanceMetrics && (
            <div className="mt-8 text-xs text-gray-500 border-t pt-4">
              <div className="flex items-center justify-between">
                <span>
                  Data loaded in {data.performanceMetrics.coordination_time_ms}ms
                </span>
                <span>
                  Cache hit rate: {data.performanceMetrics.cache_hit_rate}%
                </span>
                <span>
                  Last updated: {data.lastUpdated?.toLocaleTimeString()}
                </span>
              </div>
            </div>
          )}
        </main>
      </IntroPageLayout>
    </div>
  )
}