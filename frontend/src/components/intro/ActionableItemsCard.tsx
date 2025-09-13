/**
 * ActionableItemsCard Component
 * Displays pending approvals, urgent tasks, and actionable items
 */
import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'

interface ActionableItem {
  id: string
  type: string
  title: string
  due_date: string
  priority: 'low' | 'medium' | 'high'
  status: string
}

interface ActionableItems {
  user_id: string
  pending_approvals: number
  urgent_tasks: number
  overdue_items: number
  items: ActionableItem[]
}

interface ActionableItemsCardProps {
  actionableItems: ActionableItems | null
  isLoading: boolean
  onItemClick: (item: ActionableItem) => void
}

const PriorityBadge = ({ priority }: { priority: string }) => {
  const config = {
    high: { color: 'bg-red-500', textColor: 'text-white', testId: 'priority-high' },
    medium: { color: 'bg-yellow-500', textColor: 'text-white', testId: 'priority-medium' },
    low: { color: 'bg-green-500', textColor: 'text-white', testId: 'priority-low' }
  }

  const { color, textColor, testId } = config[priority as keyof typeof config] || config.low

  return (
    <span
      data-testid={testId}
      className={`px-2 py-1 rounded-full text-xs font-medium ${color} ${textColor}`}
    >
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  )
}

const DueDateIndicator = ({ dueDate }: { dueDate: string }) => {
  const now = new Date()
  const due = new Date(dueDate)
  const isOverdue = due < now
  const daysDiff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (isOverdue) {
    return (
      <div data-testid="overdue-indicator" className="text-red-600 text-xs font-medium">
        Overdue
      </div>
    )
  }

  if (daysDiff <= 1) {
    return (
      <div className="text-orange-600 text-xs font-medium">
        Due {daysDiff === 0 ? 'Today' : 'Tomorrow'}
      </div>
    )
  }

  return (
    <div className="text-gray-600 text-xs">
      Due in {daysDiff} days
    </div>
  )
}

export const ActionableItemsCard: React.FC<ActionableItemsCardProps> = ({
  actionableItems,
  isLoading,
  onItemClick
}) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Actionable Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
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

  if (!actionableItems) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Actionable Items</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">No actionable items</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actionable Items</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Metrics */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="text-lg font-bold text-blue-600">
              {actionableItems.pending_approvals}
            </div>
            <div className="text-xs text-gray-600">Pending</div>
          </div>
          <div className="p-3 bg-orange-50 rounded-lg">
            <div className="text-lg font-bold text-orange-600">
              {actionableItems.urgent_tasks}
            </div>
            <div className="text-xs text-gray-600">Urgent</div>
          </div>
          <div className="p-3 bg-red-50 rounded-lg">
            <div className="text-lg font-bold text-red-600">
              {actionableItems.overdue_items}
            </div>
            <div className="text-xs text-gray-600">Overdue</div>
          </div>
        </div>

        {/* Individual Items */}
        {actionableItems.items.length > 0 ? (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">Recent Items</h4>
            {actionableItems.items.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => onItemClick(item)}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="font-medium text-sm text-gray-900 flex-1 pr-2">
                    {item.title}
                  </div>
                  <PriorityBadge priority={item.priority} />
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500 capitalize">
                    {item.type.replace(/_/g, ' ')}
                  </span>
                  <DueDateIndicator dueDate={item.due_date} />
                </div>
              </div>
            ))}

            {actionableItems.items.length > 5 && (
              <div className="text-center pt-2">
                <button
                  className="text-sm text-blue-600 hover:text-blue-800"
                  onClick={() => window.location.pathname = '/tasks'}
                >
                  View all {actionableItems.items.length} items →
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <div className="text-gray-400 mb-2">🎉</div>
            <div className="text-sm text-gray-600">All caught up!</div>
            <div className="text-xs text-gray-500">No pending items at the moment</div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}