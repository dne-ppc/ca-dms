/**
 * ActivityFeedCard Component
 * Displays recent user activities and system events
 */
import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'

interface Activity {
  id: string
  type: string
  description: string
  timestamp: string
  related_document?: string
}

interface ActivityFeed {
  user_id: string
  recent_activities: string[]
  activities: Activity[]
  unread_count: number
}

interface ActivityFeedCardProps {
  activityFeed: ActivityFeed | null
  isLoading: boolean
}

const ActivityIcon = ({ type }: { type: string }) => {
  const iconMap: Record<string, string> = {
    document_created: '📄',
    document_approved: '✅',
    document_rejected: '❌',
    workflow_started: '🔄',
    notification_sent: '📧',
    user_joined: '👥',
    comment_added: '💬',
    default: '📌'
  }

  return (
    <div
      data-testid={`activity-icon-${type}`}
      className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm"
    >
      {iconMap[type] || iconMap.default}
    </div>
  )
}

const formatRelativeTime = (timestamp: string): string => {
  const now = new Date()
  const time = new Date(timestamp)
  const diffMs = now.getTime() - time.getTime()

  const minutes = Math.floor(diffMs / (1000 * 60))
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  return `${days} day${days > 1 ? 's' : ''} ago`
}

const groupActivitiesByDate = (activities: Activity[]) => {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const groups: Record<string, Activity[]> = {
    Today: [],
    Yesterday: [],
    Earlier: []
  }

  activities.forEach(activity => {
    const activityDate = new Date(activity.timestamp)
    const activityDateStr = activityDate.toDateString()

    if (activityDateStr === today.toDateString()) {
      groups.Today.push(activity)
    } else if (activityDateStr === yesterday.toDateString()) {
      groups.Yesterday.push(activity)
    } else {
      groups.Earlier.push(activity)
    }
  })

  return groups
}

export const ActivityFeedCard: React.FC<ActivityFeedCardProps> = ({
  activityFeed,
  isLoading
}) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity Feed</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex space-x-3">
                <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded animate-pulse" />
                  <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!activityFeed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity Feed</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">No recent activities</p>
        </CardContent>
      </Card>
    )
  }

  const groupedActivities = groupActivitiesByDate(activityFeed.activities)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Activity Feed
          {activityFeed.unread_count > 0 && (
            <Badge variant="destructive">
              {activityFeed.unread_count} unread
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {activityFeed.activities.length > 0 ? (
          <div className="space-y-4">
            {Object.entries(groupedActivities).map(([groupName, activities]) => {
              if (activities.length === 0) return null

              return (
                <div key={groupName}>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">
                    {groupName}
                  </h4>
                  <div className="space-y-3">
                    {activities.slice(0, groupName === 'Today' ? 10 : 5).map((activity) => (
                      <div
                        key={activity.id}
                        className="flex items-start space-x-3 p-2 hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        <ActivityIcon type={activity.type} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900">
                            {activity.description}
                          </p>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className="text-xs text-gray-500">
                              {formatRelativeTime(activity.timestamp)}
                            </span>
                            {activity.related_document && (
                              <>
                                <span className="text-xs text-gray-400">•</span>
                                <button
                                  className="text-xs text-blue-600 hover:text-blue-800"
                                  onClick={() => window.location.pathname = `/documents/${activity.related_document}`}
                                >
                                  View Document
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}

            {/* View All Link */}
            <div className="text-center pt-4 border-t">
              <button
                className="text-sm text-blue-600 hover:text-blue-800"
                onClick={() => window.location.pathname = '/activities'}
              >
                View all activities →
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-gray-400 text-4xl mb-4">📝</div>
            <div className="text-sm text-gray-600 mb-2">No recent activities</div>
            <div className="text-xs text-gray-500">
              Your activity feed will appear here as you use the system
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}