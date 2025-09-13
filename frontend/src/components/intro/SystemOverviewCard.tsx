/**
 * SystemOverviewCard Component
 * Displays system-wide metrics and health status
 */
import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'

interface SystemOverview {
  total_users: number
  active_documents: number
  documents_today: number
  documents_this_week: number
  system_health_score: number
}

interface SystemOverviewCardProps {
  overview: SystemOverview | null
  isLoading: boolean
}

const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toLocaleString()
}

const HealthIndicator = ({ score }: { score: number }) => {
  const getHealthStatus = (score: number) => {
    if (score >= 95) return { color: 'bg-green-500', text: 'Excellent', textColor: 'text-green-700' }
    if (score >= 85) return { color: 'bg-yellow-500', text: 'Good', textColor: 'text-yellow-700' }
    if (score >= 70) return { color: 'bg-orange-500', text: 'Fair', textColor: 'text-orange-700' }
    return { color: 'bg-red-500', text: 'Poor', textColor: 'text-red-700' }
  }

  const status = getHealthStatus(score)

  return (
    <div className="flex items-center space-x-2">
      <div
        data-testid="health-indicator"
        className={`w-3 h-3 rounded-full ${status.color}`}
      />
      <span className={`text-sm font-medium ${status.textColor}`}>
        {status.text}
      </span>
      <span className="text-sm text-gray-600">
        ({score.toFixed(1)}%)
      </span>
    </div>
  )
}

export const SystemOverviewCard: React.FC<SystemOverviewCardProps> = ({
  overview,
  isLoading
}) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>System Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-4 bg-gray-200 rounded animate-pulse"
              />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!overview) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>System Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">No system data available</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Overview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* System Health */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600 mb-2">System Health</div>
          <HealthIndicator score={overview.system_health_score} />
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 border rounded-lg">
            <div className="text-xl font-bold text-gray-900">
              {formatNumber(overview.total_users)}
            </div>
            <div className="text-xs text-gray-600">Total Users</div>
          </div>
          <div className="text-center p-3 border rounded-lg">
            <div className="text-xl font-bold text-gray-900">
              {formatNumber(overview.active_documents)}
            </div>
            <div className="text-xs text-gray-600">Active Documents</div>
          </div>
        </div>

        {/* Activity Metrics */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Documents Today</span>
            <span className="font-semibold text-blue-600">
              {overview.documents_today}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">This Week</span>
            <span className="font-semibold text-green-600">
              {overview.documents_this_week}
            </span>
          </div>
        </div>

        {/* Activity Trend */}
        <div className="pt-2">
          <div className="text-sm text-gray-600 mb-2">Weekly Activity</div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${Math.min((overview.documents_this_week / 100) * 100, 100)}%`
              }}
            />
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {((overview.documents_today / Math.max(overview.documents_this_week, 1)) * 100).toFixed(0)}% of weekly activity completed today
          </div>
        </div>
      </CardContent>
    </Card>
  )
}