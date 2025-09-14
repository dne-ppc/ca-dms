/**
 * PersonalStats Component
 * User-specific productivity metrics
 */
import React, { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'

type TimeRange = 'week' | 'month' | 'quarter' | 'year'

interface RecentDocument {
  id: string
  title: string
  updatedAt: Date
  status: string
  type: string
}

interface PersonalStatsData {
  userId: string
  documentCount: number
  templateCount: number
  documentsCreatedThisWeek: number
  documentsCreatedThisMonth: number
  collaborationScore: number
  productivityScore: number
  recentDocuments: RecentDocument[]
  documentsByType: {
    meeting: number
    policy: number
    notice: number
    governance: number
  }
  workflowParticipation: {
    approvals_completed: number
    reviews_completed: number
    tasks_assigned: number
    tasks_completed: number
  }
  activityTimeline: Array<{
    date: string
    documents: number
    collaborations: number
  }>
}

interface PersonalStatsProps {
  userId: string
  data: PersonalStatsData | null
  loading: boolean
  timeRange: TimeRange
  onTimeRangeChange: (range: TimeRange) => void
  onDocumentClick?: (documentId: string) => void
  className?: string
}

export const PersonalStats: React.FC<PersonalStatsProps> = ({
  userId,
  data,
  loading,
  timeRange,
  onTimeRangeChange,
  onDocumentClick,
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

  // Show data updated indicator
  useEffect(() => {
    if (data) {
      setIsUpdated(true)
      const timer = setTimeout(() => setIsUpdated(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [data])

  // Format date for display
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  // Get productivity score class
  const getProductivityScoreClass = (score: number): string => {
    if (score >= 90) return 'score-excellent'
    if (score >= 75) return 'score-good'
    if (score >= 60) return 'score-average'
    return 'score-poor'
  }

  // Calculate task completion rate
  const getTaskCompletionRate = (data: PersonalStatsData): number => {
    const { tasks_assigned, tasks_completed } = data.workflowParticipation
    return tasks_assigned > 0 ? Math.round((tasks_completed / tasks_assigned) * 100) : 0
  }

  // Loading skeleton
  const LoadingSkeleton = () => (
    <div data-testid="personal-stats-skeleton" className="space-y-6">
      <div className="h-6 bg-gray-200 rounded animate-pulse mb-4" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-gray-200 rounded animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <div key={i} className="h-48 bg-gray-200 rounded animate-pulse" />
        ))}
      </div>
    </div>
  )

  // Empty state
  const EmptyState = () => (
    <div data-testid="empty-stats-message" className="text-center py-12">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-8">
        <h3 className="text-lg font-semibold text-blue-800 mb-2">
          No Documents Created Yet
        </h3>
        <p className="text-blue-600 mb-4">
          Start creating documents to see your productivity metrics here.
        </p>
        <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Create Your First Document
        </button>
      </div>
    </div>
  )

  // Metric Card Component
  const MetricCard: React.FC<{
    title: string
    value: string | number
    subtitle?: string
    className?: string
  }> = ({ title, value, subtitle, className: cardClassName }) => (
    <div className={cn('bg-white rounded-lg shadow p-4', cardClassName)}>
      <p className="text-sm text-gray-600">{title}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {subtitle && (
        <p className="text-xs text-gray-500">{subtitle}</p>
      )}
    </div>
  )

  // Activity Timeline Chart (Simple visualization)
  const ActivityTimelineChart = () => {
    if (!data?.activityTimeline) return null

    const maxValue = Math.max(
      ...data.activityTimeline.map(item => item.documents + item.collaborations)
    )

    return (
      <div data-testid="timeline-chart" className="space-y-2">
        {data.activityTimeline.slice(0, 5).map((item) => {
          const date = new Date(item.date)
          const totalActivity = item.documents + item.collaborations
          const height = maxValue > 0 ? (totalActivity / maxValue) * 100 : 0

          return (
            <div key={item.date} className="flex items-end space-x-2 text-xs">
              <span className="w-20 text-gray-600">
                {formatDate(date)}
              </span>
              <div className="flex-1 flex items-end space-x-1">
                <div className="bg-blue-500 rounded-sm transition-all duration-300" style={{
                  height: `${Math.max(height * 0.6, 4)}px`,
                  width: '12px'
                }} />
                <div className="bg-green-500 rounded-sm transition-all duration-300" style={{
                  height: `${Math.max(height * 0.4, 2)}px`,
                  width: '12px'
                }} />
              </div>
              <span className="w-8 text-gray-500">{totalActivity}</span>
            </div>
          )
        })}
      </div>
    )
  }

  // Document Types Breakdown
  const DocumentTypesBreakdown = () => {
    if (!data?.documentsByType) return null

    const types = Object.entries(data.documentsByType)
    const total = types.reduce((sum, [, count]) => sum + count, 0)

    return (
      <div data-testid="document-types-breakdown" className="space-y-3">
        {types.map(([type, count]) => (
          <div key={type} className="flex items-center justify-between">
            <span className="capitalize text-sm">{type}: {count}</span>
            <div className="flex-1 mx-3 bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${total > 0 ? (count / total) * 100 : 0}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 w-12">
              {total > 0 ? Math.round((count / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    )
  }

  // Recent Documents List
  const RecentDocumentsList = () => {
    if (!data?.recentDocuments?.length) return null

    return (
      <div className="space-y-2">
        {data.recentDocuments.slice(0, 5).map((doc) => (
          <div
            key={doc.id}
            data-testid={`recent-document-${doc.id}`}
            className={cn(
              'p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors',
              onDocumentClick ? 'cursor-pointer' : 'cursor-default'
            )}
            onClick={() => onDocumentClick?.(doc.id)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-medium text-sm truncate">{doc.title}</h4>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-xs text-gray-500">
                    {formatDate(doc.updatedAt)}
                  </span>
                  <span className={cn('text-xs px-2 py-1 rounded-full', {
                    'bg-green-100 text-green-800': doc.status === 'approved',
                    'bg-yellow-100 text-yellow-800': doc.status === 'draft',
                    'bg-blue-100 text-blue-800': doc.status === 'published'
                  })}>
                    {doc.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (loading) return <LoadingSkeleton />
  if (!data) return null
  if (data.documentCount === 0) return <EmptyState />

  const taskCompletionRate = getTaskCompletionRate(data)
  const productivityScoreClass = getProductivityScoreClass(data.productivityScore)
  const containerClasses = cn(
    'personal-stats',
    isMobile ? 'mobile-layout' : 'desktop-layout',
    className
  )

  return (
    <div data-testid="personal-stats-container" className={containerClasses}>
      <div
        role="region"
        aria-label="Personal Statistics Dashboard"
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Your Statistics</h2>
          <div className="flex items-center space-x-2">
            {isUpdated && (
              <div data-testid="stats-updated-indicator" className="text-sm text-green-600">
                Updated
              </div>
            )}
            <select
              data-testid="time-range-selector"
              value={timeRange}
              onChange={(e) => onTimeRangeChange(e.target.value as TimeRange)}
              className="border border-gray-300 rounded px-3 py-1 text-sm"
              tabIndex={0}
            >
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
            </select>
          </div>
        </div>

        {/* Main Metrics Grid */}
        <div
          data-testid="stats-grid"
          className={cn(
            'grid gap-4',
            isMobile ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-4'
          )}
        >
          <MetricCard
            title="Documents Created"
            value={data.documentCount}
            subtitle="Total documents"
          />
          <MetricCard
            title="Templates"
            value={data.templateCount}
            subtitle="Created templates"
          />
          <MetricCard
            title="This Week"
            value={data.documentsCreatedThisWeek}
            subtitle="Created this week"
          />
          <MetricCard
            title="This Month"
            value={data.documentsCreatedThisMonth}
            subtitle="Created this month"
          />
        </div>

        {/* Productivity and Collaboration Scores */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Productivity Score</h3>
            <div className="flex items-center space-x-4">
              <div
                data-testid="productivity-score-indicator"
                className={cn('w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-lg', {
                  'bg-green-500': productivityScoreClass === 'score-excellent',
                  'bg-blue-500': productivityScoreClass === 'score-good',
                  'bg-yellow-500': productivityScoreClass === 'score-average',
                  'bg-red-500': productivityScoreClass === 'score-poor',
                  [productivityScoreClass]: true
                })}
                aria-label="Productivity score indicator"
              >
                {data.productivityScore}
              </div>
              <div>
                <p className="text-sm text-gray-600">
                  {productivityScoreClass === 'score-excellent' && 'Excellent productivity!'}
                  {productivityScoreClass === 'score-good' && 'Good productivity'}
                  {productivityScoreClass === 'score-average' && 'Average productivity'}
                  {productivityScoreClass === 'score-poor' && 'Room for improvement'}
                </p>
                <div data-testid="productivity-breakdown" className="text-xs text-gray-500 mt-1">
                  Based on document creation and collaboration
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Collaboration Score</h3>
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-800 font-bold text-lg">
                {data.collaborationScore}
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600">Active collaborator</p>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${data.collaborationScore}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Activity Timeline and Document Types */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
            <div data-testid="activity-timeline" aria-label="Document creation timeline">
              <ActivityTimelineChart />
            </div>
            <div data-testid="period-comparison" className="mt-4 text-xs text-gray-500">
              Comparing recent activity levels
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Document Types</h3>
            <DocumentTypesBreakdown />
          </div>
        </div>

        {/* Workflow Participation */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Workflow Participation</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Task Completion Rate</span>
                <span className="font-bold text-lg">{taskCompletionRate}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-green-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${taskCompletionRate}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {data.workflowParticipation.tasks_completed} of {data.workflowParticipation.tasks_assigned} tasks completed
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <MetricCard
                title="Approvals Completed"
                value={data.workflowParticipation.approvals_completed}
                className="shadow-none border"
              />
              <MetricCard
                title="Reviews Completed"
                value={data.workflowParticipation.reviews_completed}
                className="shadow-none border"
              />
            </div>
          </div>
        </div>

        {/* Recent Documents */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Documents</h3>
          <RecentDocumentsList />
        </div>
      </div>
    </div>
  )
}