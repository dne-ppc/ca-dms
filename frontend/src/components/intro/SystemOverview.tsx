/**
 * SystemOverview Component
 * Visual system statistics dashboard
 */
import React, { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'

interface SystemOverviewData {
  total_users: number
  active_documents: number
  documents_today: number
  documents_this_week: number
  system_health_score: number
  storage_usage?: {
    used_gb: number
    total_gb: number
    percentage: number
  }
  performance_metrics?: {
    avg_response_time: number
    uptime_percentage: number
    error_rate: number
  }
  document_types?: {
    governance: number
    policy: number
    meeting: number
    notice: number
  }
  user_activity?: {
    active_today: number
    active_this_week: number
    new_registrations: number
  }
}

interface SystemOverviewProps {
  data: SystemOverviewData | null
  loading: boolean
  onRefresh: () => void
  error?: string
  variant?: 'standard' | 'detailed'
  autoRefresh?: boolean
  refreshInterval?: number
  className?: string
}

export const SystemOverview: React.FC<SystemOverviewProps> = ({
  data,
  loading,
  onRefresh,
  error,
  variant = 'standard',
  autoRefresh = false,
  refreshInterval = 30000,
  className
}) => {
  const [isUpdated, setIsUpdated] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Handle responsive design
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh || !onRefresh) return

    const interval = setInterval(() => {
      onRefresh()
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefresh, onRefresh, refreshInterval])

  // Show data updated indicator
  useEffect(() => {
    if (data) {
      setIsUpdated(true)
      const timer = setTimeout(() => setIsUpdated(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [data])

  // Format large numbers with commas
  const formatNumber = (num: number): string => {
    return num.toLocaleString()
  }

  // Get health status class and message
  const getHealthStatus = (score: number) => {
    if (score >= 95) return { class: 'health-excellent', message: 'Excellent' }
    if (score >= 85) return { class: 'health-good', message: 'Good' }
    if (score >= 70) return { class: 'health-warning', message: 'Attention Required' }
    return { class: 'health-critical', message: 'Critical' }
  }

  // Loading skeleton
  const LoadingSkeleton = () => (
    <div data-testid="system-overview-skeleton" className="space-y-4">
      <div className="h-6 bg-gray-200 rounded animate-pulse mb-4" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-gray-200 rounded animate-pulse" />
        ))}
      </div>
      {variant === 'detailed' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      )}
    </div>
  )

  // Error state
  const ErrorState = () => (
    <div className="text-center py-8">
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-red-800 mb-2">
          System Overview Unavailable
        </h3>
        <p className="text-red-600 mb-4">{error}</p>
        <button
          data-testid="retry-button"
          onClick={onRefresh}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    </div>
  )

  // Metric Card Component
  const MetricCard: React.FC<{
    title: string
    value: string | number
    subtitle?: string
    trend?: 'up' | 'down' | 'stable'
    testId?: string
    className?: string
  }> = ({ title, value, subtitle, trend, testId, className: cardClassName }) => (
    <div className={cn('bg-white rounded-lg shadow p-4', cardClassName)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900" data-testid={testId}>
            {typeof value === 'number' ? formatNumber(value) : value}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-500">{subtitle}</p>
          )}
        </div>
        {trend && (
          <div data-testid={`${testId}-trend`} className={cn('text-sm', {
            'text-green-600': trend === 'up',
            'text-red-600': trend === 'down',
            'text-gray-600': trend === 'stable'
          })}>
            {trend === 'up' && '↗'}
            {trend === 'down' && '↘'}
            {trend === 'stable' && '→'}
          </div>
        )}
      </div>
    </div>
  )

  // Progress Bar Component
  const ProgressBar: React.FC<{ percentage: number; testId?: string }> = ({ percentage, testId }) => (
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div
        data-testid={testId}
        className="bg-blue-600 h-2 rounded-full transition-all duration-500"
        style={{ width: `${Math.min(percentage, 100)}%` }}
      />
    </div>
  )

  // Document Types Chart (Simple Bar Chart)
  const DocumentTypesChart = () => {
    if (!data?.document_types) return null

    const types = Object.entries(data.document_types)
    const maxCount = Math.max(...types.map(([, count]) => count))

    return (
      <div data-testid="document-types-chart" className="space-y-2">
        {types.map(([type, count]) => (
          <div key={type} className="flex items-center space-x-2">
            <span className="text-sm w-20 capitalize">{type}:</span>
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full"
                style={{ width: `${(count / maxCount) * 100}%` }}
              />
            </div>
            <span className="text-sm font-medium w-12">{count}</span>
          </div>
        ))}
      </div>
    )
  }

  if (loading) return <LoadingSkeleton />
  if (error) return <ErrorState />
  if (!data) return null

  const healthStatus = getHealthStatus(data.system_health_score)
  const containerClasses = cn(
    'system-overview',
    isMobile ? 'mobile-layout' : 'desktop-layout',
    className
  )

  return (
    <div data-testid="system-overview-container" className={containerClasses}>
      <div
        role="region"
        aria-label="System Overview Dashboard"
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">System Overview</h2>
          <div className="flex items-center space-x-2">
            {autoRefresh && (
              <div data-testid="auto-refresh-indicator" className="flex items-center space-x-1 text-sm text-gray-500">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span>Auto-refresh</span>
              </div>
            )}
            {isUpdated && (
              <div data-testid="data-updated-indicator" className="text-sm text-green-600">
                Updated
              </div>
            )}
            <button
              data-testid="refresh-button"
              onClick={onRefresh}
              tabIndex={0}
              className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Main Metrics Grid */}
        <div
          data-testid="metrics-grid"
          className={cn(
            'grid gap-4',
            isMobile ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-4'
          )}
        >
          <MetricCard
            title="Total Users"
            value={data.total_users}
            testId="total-users"
            aria-label="Total users count"
          />
          <MetricCard
            title="Active Documents"
            value={data.active_documents}
            testId="active-documents"
          />
          <MetricCard
            title="Documents Today"
            value={data.documents_today}
            trend="up"
            testId="documents-today"
          />
          <MetricCard
            title="Documents This Week"
            value={data.documents_this_week}
            trend="up"
            testId="documents-week"
          />
        </div>

        {/* System Health */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">System Health</h3>
          <div className="flex items-center space-x-4">
            <div
              data-testid="system-health-indicator"
              className={cn('w-4 h-4 rounded-full', {
                'bg-green-500': healthStatus.class === 'health-excellent',
                'bg-yellow-500': healthStatus.class === 'health-warning',
                'bg-red-500': healthStatus.class === 'health-critical',
                [healthStatus.class]: true
              })}
              aria-label="System health score"
            />
            <span className="text-2xl font-bold">{data.system_health_score}%</span>
            <span className="text-gray-600">{healthStatus.message}</span>
            {healthStatus.class === 'health-warning' && (
              <span className="text-yellow-600 text-sm">Attention Required</span>
            )}
          </div>

          {/* Performance Metrics */}
          {data.performance_metrics && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Uptime: </span>
                <span className="font-medium">{data.performance_metrics.uptime_percentage}%</span>
              </div>
              <div>
                <span className="text-gray-600">Response Time: </span>
                <span className="font-medium">{data.performance_metrics.avg_response_time}ms</span>
              </div>
              <div>
                <span className="text-gray-600">Error Rate: </span>
                <span className="font-medium">{data.performance_metrics.error_rate}%</span>
              </div>
            </div>
          )}
        </div>

        {/* User Activity */}
        {data.user_activity && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">User Activity</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricCard
                title="Active Today"
                value={data.user_activity.active_today}
                className="shadow-none border"
              />
              <MetricCard
                title="Active This Week"
                value={data.user_activity.active_this_week}
                className="shadow-none border"
              />
              <MetricCard
                title="New Registrations"
                value={data.user_activity.new_registrations}
                className="shadow-none border"
              />
            </div>
          </div>
        )}

        {/* Document Types Breakdown */}
        {data.document_types && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Document Types</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                {Object.entries(data.document_types).map(([type, count]) => (
                  <div key={type} className="flex justify-between">
                    <span className="capitalize">{type}:</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
              <DocumentTypesChart />
            </div>
          </div>
        )}

        {/* Detailed Metrics (for detailed variant) */}
        {variant === 'detailed' && (
          <div data-testid="detailed-metrics-section" className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Storage Usage */}
            {data.storage_usage && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Storage Usage</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{data.storage_usage.used_gb} GB used</span>
                    <span>{data.storage_usage.total_gb} GB total</span>
                  </div>
                  <ProgressBar
                    percentage={data.storage_usage.percentage}
                    testId="storage-progress-bar"
                  />
                  <p className="text-xs text-gray-500 text-center">
                    {data.storage_usage.percentage.toFixed(1)}% used
                  </p>
                </div>
              </div>
            )}

            {/* Performance Metrics */}
            {data.performance_metrics && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Performance Metrics</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Avg Response Time</span>
                    <span className="font-medium">{data.performance_metrics.avg_response_time}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Uptime</span>
                    <span className="font-medium">{data.performance_metrics.uptime_percentage}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Error Rate</span>
                    <span className="font-medium">{data.performance_metrics.error_rate}%</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}