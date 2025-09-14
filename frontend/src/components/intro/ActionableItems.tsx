/**
 * ActionableItems Component
 * Priority-sorted pending tasks display with comprehensive interaction support
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'

export interface ActionableItem {
  id: string
  type: 'approval' | 'review' | 'signature' | 'task'
  title: string
  description?: string
  priority: 'high' | 'medium' | 'low'
  urgency?: 'overdue' | 'due_soon' | 'normal'
  deadline?: Date
  assignedTo: string
  documentId?: string
  workflowId?: string
  createdAt?: Date
  metadata?: {
    documentType?: string
    requiredBy?: string
    estimatedTime?: number
    priorityTrend?: 'increased' | 'decreased' | 'stable'
    priorityHistory?: Array<{
      priority: string
      changedAt: Date
      changedBy: string
    }>
  }
}

interface ActionableItemsProps {
  items: ActionableItem[]
  loading?: boolean
  onItemClick: (item: ActionableItem) => void
  onActionComplete: (itemId: string) => void | Promise<void>
  onPriorityChange?: (itemId: string, priority: string) => void
  onBulkAction?: (action: string, itemIds: string[]) => void
  className?: string
}

type SortOption = 'priority' | 'deadline' | 'created' | 'type'
type FilterOption = 'all' | 'high' | 'medium' | 'low'

// Priority system utilities
const getPriorityIcon = (priority: string): string => {
  switch (priority) {
    case 'high': return '🔥'
    case 'medium': return '⚠️'
    case 'low': return 'ℹ️'
    default: return '📋'
  }
}

const getPriorityRank = (item: ActionableItem, allItems: ActionableItem[]): number => {
  const priorityWeight = { high: 3, medium: 2, low: 1 }
  const urgencyWeight = { overdue: 3, due_soon: 2, normal: 1 }

  const itemScore = (priorityWeight[item.priority] * 10) + urgencyWeight[item.urgency || 'normal']

  // Sort all items by score and find rank
  const sortedItems = allItems
    .map(i => ({
      id: i.id,
      score: (priorityWeight[i.priority] * 10) + urgencyWeight[i.urgency || 'normal']
    }))
    .sort((a, b) => b.score - a.score)

  return sortedItems.findIndex(i => i.id === item.id) + 1
}

const getPriorityBarWidth = (priority: string): string => {
  switch (priority) {
    case 'high': return 'w-full'
    case 'medium': return 'w-3/5'
    case 'low': return 'w-1/5'
    default: return 'w-0'
  }
}

const getPriorityBarColor = (priority: string): string => {
  switch (priority) {
    case 'high': return 'bg-red-500'
    case 'medium': return 'bg-yellow-400'
    case 'low': return 'bg-green-400'
    default: return 'bg-gray-300'
  }
}

const getCombinedPriorityClasses = (item: ActionableItem): string => {
  if (item.priority === 'high' && item.urgency === 'overdue') {
    return 'border-red-500 bg-red-50'
  } else if (item.priority === 'high' && item.urgency === 'due_soon') {
    return 'border-orange-400 bg-orange-50'
  } else if (item.priority === 'medium') {
    return 'border-yellow-200 bg-yellow-50'
  } else {
    return 'border-green-200 bg-green-50'
  }
}

export const ActionableItems: React.FC<ActionableItemsProps> = ({
  items,
  loading = false,
  onItemClick,
  onActionComplete,
  onPriorityChange,
  onBulkAction,
  className
}) => {
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [priorityFilter, setPriorityFilter] = useState<FilterOption>('all')
  const [showPriorityStats, setShowPriorityStats] = useState(false)
  const [showBulkPriority, setShowBulkPriority] = useState(false)
  const [bulkPriorityValue, setBulkPriorityValue] = useState<string>('medium')
  const [priorityChangeConfirmation, setPriorityChangeConfirmation] = useState<{ itemId: string, newPriority: string } | null>(null)
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortOption>('priority')
  const [searchTerm, setSearchTerm] = useState('')
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({})
  const [retryingAction, setRetryingAction] = useState<string | null>(null)

  // Priority statistics
  const priorityStats = useMemo(() => {
    const stats = { high: 0, medium: 0, low: 0 }
    items.forEach(item => {
      stats[item.priority]++
    })
    return stats
  }, [items])

  // Handle priority change with confirmation for critical items
  const handlePriorityChange = useCallback((itemId: string, newPriority: string) => {
    const item = items.find(i => i.id === itemId)
    if (item?.priority === 'high' && newPriority === 'low') {
      setPriorityChangeConfirmation({ itemId, newPriority })
    } else {
      onPriorityChange?.(itemId, newPriority)
    }
  }, [items, onPriorityChange])

  // Confirm priority change
  const confirmPriorityChange = useCallback(() => {
    if (priorityChangeConfirmation) {
      onPriorityChange?.(priorityChangeConfirmation.itemId, priorityChangeConfirmation.newPriority)
      setPriorityChangeConfirmation(null)
    }
  }, [priorityChangeConfirmation, onPriorityChange])

  // Handle bulk priority change
  const handleBulkPriorityChange = useCallback(() => {
    if (selectedItems.length > 0 && onBulkAction) {
      onBulkAction('priority_change', selectedItems.map(id => ({ id, priority: bulkPriorityValue })))
      setShowBulkPriority(false)
      setSelectedItems([])
    }
  }, [selectedItems, bulkPriorityValue, onBulkAction])

  // Memoized filtering and sorting
  const filteredAndSortedItems = useMemo(() => {
    let filtered = items

    // Apply priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(item => item.priority === priorityFilter)
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(item => item.type === typeFilter)
    }

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(searchLower) ||
        item.description.toLowerCase().includes(searchLower)
      )
    }

    // Sort items
    const priorityWeight = { high: 3, medium: 2, low: 1 }
    const urgencyWeight = { overdue: 3, due_soon: 2, normal: 1 }

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          const aPriority = (priorityWeight[a.priority] * 10) + urgencyWeight[a.urgency]
          const bPriority = (priorityWeight[b.priority] * 10) + urgencyWeight[b.urgency]
          return bPriority - aPriority
        case 'deadline':
          const aDeadline = a.deadline ? new Date(a.deadline).getTime() : Infinity
          const bDeadline = b.deadline ? new Date(b.deadline).getTime() : Infinity
          return aDeadline - bDeadline
        case 'created':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case 'type':
          return a.type.localeCompare(b.type)
        default:
          return 0
      }
    })
  }, [items, priorityFilter, typeFilter, searchTerm, sortBy])

  // Format deadline display
  const formatDeadline = useCallback((deadline: Date | undefined) => {
    if (!deadline) {
      return { text: 'No deadline set', className: 'text-gray-400' }
    }

    const now = new Date()
    const deadlineDate = new Date(deadline)
    const diff = deadlineDate.getTime() - now.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

    if (diff < 0) {
      return { text: `Overdue by ${Math.abs(days)} days`, className: 'text-red-600' }
    } else if (days === 0) {
      return { text: `Due in ${hours} hours`, className: 'text-orange-600' }
    } else if (days === 1) {
      return { text: 'Due tomorrow', className: 'text-yellow-600' }
    } else if (days < 7) {
      return { text: `Due in ${days} days`, className: 'text-blue-600' }
    } else {
      return { text: deadlineDate.toLocaleDateString(), className: 'text-gray-600' }
    }
  }, [])

  // Handle action completion with error handling
  const handleActionComplete = useCallback(async (itemId: string) => {
    try {
      setActionErrors(prev => ({ ...prev, [itemId]: '' }))
      await onActionComplete(itemId)
    } catch (error) {
      setActionErrors(prev => ({
        ...prev,
        [itemId]: 'Failed to complete action. Please try again.'
      }))
    }
  }, [onActionComplete])

  // Handle retry action
  const handleRetryAction = useCallback(async (itemId: string) => {
    setRetryingAction(itemId)
    try {
      await handleActionComplete(itemId)
      setActionErrors(prev => ({ ...prev, [itemId]: '' }))
    } finally {
      setRetryingAction(null)
    }
  }, [handleActionComplete])

  // Handle bulk actions
  const handleBulkComplete = useCallback(() => {
    if (onBulkAction && selectedItems.length > 0) {
      onBulkAction('complete', selectedItems)
      setSelectedItems([])
    }
  }, [onBulkAction, selectedItems])

  // Handle item selection
  const handleItemSelection = useCallback((itemId: string, selected: boolean) => {
    setSelectedItems(prev =>
      selected
        ? [...prev, itemId]
        : prev.filter(id => id !== itemId)
    )
  }, [])

  // Loading state
  if (loading) {
    return (
      <div
        data-testid="actionable-items-loading"
        className={cn("bg-white rounded-lg shadow p-6", className)}
      >
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex space-x-4">
                <div className="w-4 h-4 bg-gray-200 rounded"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="text-center text-gray-500 mt-4">Loading actionable items...</div>
      </div>
    )
  }

  // Empty state
  if (filteredAndSortedItems.length === 0 && items.length === 0) {
    return (
      <div
        data-testid="actionable-items-empty"
        className={cn("bg-white rounded-lg shadow p-8 text-center", className)}
      >
        <div className="text-gray-400 mb-4">
          <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-600 mb-2">No actionable items at this time</h3>
        <p className="text-gray-500">Great! You're all caught up.</p>
      </div>
    )
  }

  return (
    <div
      data-testid="actionable-items-container"
      role="region"
      aria-label="Actionable Items Dashboard"
      className={cn("bg-white rounded-lg shadow priority-theme-default", className)}
    >
      {/* Header Section */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Actionable Items</h2>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">
              {filteredAndSortedItems.length} of {items.length} items
            </span>
            {selectedItems.length > 0 && (
              <>
                <button
                  data-testid="bulk-complete-button"
                  onClick={handleBulkComplete}
                  className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                >
                  Complete Selected ({selectedItems.length})
                </button>
                <button
                  data-testid="bulk-priority-change"
                  onClick={() => setShowBulkPriority(true)}
                  className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700"
                >
                  Change Priority
                </button>
              </>
            )}
          </div>
        </div>

        {/* Priority Statistics */}
        <div data-testid="priority-statistics" className="mb-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Priority Overview</h3>
            <button
              onClick={() => setShowPriorityStats(!showPriorityStats)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {showPriorityStats ? 'Hide' : 'Show'} Details
            </button>
          </div>
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                High
              </span>
              <span data-testid="priority-count-high" className="text-sm font-medium">{priorityStats.high}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                Medium
              </span>
              <span data-testid="priority-count-medium" className="text-sm font-medium">{priorityStats.medium}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Low
              </span>
              <span data-testid="priority-count-low" className="text-sm font-medium">{priorityStats.low}</span>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-wrap gap-4">
          {/* Search */}
          <div className="flex-1 min-w-64">
            <input
              data-testid="search-filter"
              type="text"
              placeholder="Search actionable items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Enhanced Priority Filter */}
          <div data-testid="enhanced-priority-filter" className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Priority:</span>
            <button
              data-testid="filter-priority-all"
              onClick={() => setPriorityFilter('all')}
              className={cn(
                "px-3 py-1 rounded text-xs font-medium transition-colors",
                priorityFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              All
            </button>
            <button
              data-testid="filter-priority-high"
              onClick={() => setPriorityFilter('high')}
              className={cn(
                "px-3 py-1 rounded text-xs font-medium transition-colors",
                priorityFilter === 'high' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-800 hover:bg-red-200'
              )}
            >
              🔥 High
            </button>
            <button
              data-testid="filter-priority-medium"
              onClick={() => setPriorityFilter('medium')}
              className={cn(
                "px-3 py-1 rounded text-xs font-medium transition-colors",
                priorityFilter === 'medium' ? 'bg-yellow-600 text-white' : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
              )}
            >
              ⚠️ Medium
            </button>
            <button
              data-testid="filter-priority-low"
              onClick={() => setPriorityFilter('low')}
              className={cn(
                "px-3 py-1 rounded text-xs font-medium transition-colors",
                priorityFilter === 'low' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-800 hover:bg-green-200'
              )}
            >
              ℹ️ Low
            </button>
          </div>

          {/* Type Filter */}
          <select
            data-testid="type-filter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option data-testid="filter-type-all" value="all">All Types</option>
            <option data-testid="filter-type-approval" value="approval">Approvals</option>
            <option data-testid="filter-type-review" value="review">Reviews</option>
            <option data-testid="filter-type-signature" value="signature">Signatures</option>
            <option data-testid="filter-type-task" value="task">Tasks</option>
          </select>

          {/* Sort Options */}
          <select
            data-testid="sort-dropdown"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option data-testid="sort-by-priority" value="priority">Sort by Priority</option>
            <option data-testid="sort-by-deadline" value="deadline">Sort by Deadline</option>
            <option data-testid="sort-by-created" value="created">Sort by Created</option>
            <option data-testid="sort-by-type" value="type">Sort by Type</option>
          </select>
        </div>
      </div>

      {/* Items List */}
      <div data-testid="virtual-list-container" className="max-h-96 overflow-y-auto">
        <ul role="list" className="divide-y divide-gray-200">
          {filteredAndSortedItems.map((item) => {
            const deadlineInfo = formatDeadline(item.deadline)
            const isSelected = selectedItems.includes(item.id)
            const hasError = actionErrors[item.id]

            return (
              <li
                key={item.id}
                data-testid={`actionable-item-${item.id}`}
                role="listitem"
                tabIndex={0}
                aria-label={`${item.priority.charAt(0).toUpperCase() + item.priority.slice(1)} priority ${item.type}: ${item.title}`}
                className={cn(
                  "p-4 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none cursor-pointer transition-colors border-l-4",
                  `priority-${item.priority}`,
                  getCombinedPriorityClasses(item),
                  isSelected && "bg-blue-50 border-l-4 border-blue-500"
                )}
                onClick={() => onItemClick(item)}
                onMouseEnter={() => setHoveredItem(item.id)}
                onMouseLeave={() => setHoveredItem(null)}
              >
                <div className="flex items-start space-x-4">
                  {/* Selection Checkbox */}
                  <input
                    data-testid={`select-item-${item.id}`}
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      e.stopPropagation()
                      handleItemSelection(item.id, e.target.checked)
                    }}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />

                  {/* Enhanced Priority Indicator */}
                  <div className="flex-shrink-0 space-y-2">
                    {/* Priority Badge with Icon */}
                    <div className="flex items-center space-x-1">
                      <span
                        data-testid={`priority-icon-${item.id}`}
                        className="text-sm"
                      >
                        {getPriorityIcon(item.priority)}
                      </span>
                      <span
                        data-testid={`priority-indicator-${item.id}`}
                        role="status"
                        aria-label={`${item.priority.charAt(0).toUpperCase() + item.priority.slice(1)} priority item`}
                        className={cn(
                          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium priority-themed",
                          item.priority === 'high' && "bg-red-500 text-white priority-high priority-pattern-diagonal",
                          item.priority === 'medium' && "bg-yellow-400 text-gray-900 priority-medium priority-pattern-dots",
                          item.priority === 'low' && "bg-green-100 text-green-800 priority-low priority-pattern-solid",
                          // Dark mode support
                          "dark:bg-red-600 dark:text-red-100"
                        )}
                      >
                        {item.priority.toUpperCase()}
                      </span>
                      <span
                        data-testid={`priority-rank-${item.id}`}
                        className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-gray-800 text-white rounded-full"
                      >
                        {getPriorityRank(item, items)}
                      </span>
                    </div>

                    {/* Priority Progress Bar */}
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <div
                        data-testid={`priority-bar-${item.id}`}
                        className={cn(
                          "h-2 rounded-full transition-all",
                          getPriorityBarWidth(item.priority),
                          getPriorityBarColor(item.priority)
                        )}
                      />
                    </div>

                    {/* Priority Trend Indicator */}
                    {item.metadata?.priorityTrend && item.metadata.priorityTrend !== 'stable' && (
                      <span
                        data-testid={`priority-trend-${item.id}`}
                        className={cn(
                          "text-xs",
                          item.metadata.priorityTrend === 'increased' && "text-red-600",
                          item.metadata.priorityTrend === 'decreased' && "text-green-600"
                        )}
                      >
                        {item.metadata.priorityTrend === 'increased' ? '↗️' : '↘️'}
                      </span>
                    )}

                    {/* Priority History Tooltip */}
                    {item.metadata?.priorityHistory && item.metadata.priorityHistory.length > 0 && (
                      <span
                        data-testid={`priority-history-${item.id}`}
                        className="text-xs text-gray-400 cursor-help"
                        title={`Priority changed from ${item.metadata.priorityHistory[item.metadata.priorityHistory.length - 2]?.priority || 'unknown'} to ${item.metadata.priorityHistory[item.metadata.priorityHistory.length - 1]?.priority} on ${new Date(item.metadata.priorityHistory[item.metadata.priorityHistory.length - 1]?.changedAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })} by ${item.metadata.priorityHistory[item.metadata.priorityHistory.length - 1]?.changedBy}`}
                      >
                        📈
                      </span>
                    )}
                  </div>

                  {/* Item Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {item.title}
                      </h3>

                      <div className="flex items-center space-x-2">
                        {/* Priority Change Dropdown */}
                        {onPriorityChange && (
                          <select
                            data-testid={`priority-dropdown-${item.id}`}
                            value={item.priority}
                            onChange={(e) => {
                              e.stopPropagation()
                              handlePriorityChange(item.id, e.target.value)
                            }}
                            className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                          </select>
                        )}

                        {/* Urgency Badge */}
                        {item.urgency && item.urgency !== 'normal' && (
                          <span
                            data-testid={`urgency-badge-${item.urgency}`}
                            className={cn(
                              "inline-flex items-center px-2 py-1 rounded text-xs font-medium",
                              item.urgency === 'overdue' && "bg-red-500 text-white urgency-overdue",
                              item.urgency === 'due_soon' && "bg-orange-500 text-white urgency-due-soon"
                            )}
                          >
                            {item.urgency === 'overdue' ? 'OVERDUE' : 'DUE SOON'}
                          </span>
                        )}
                      </div>
                    </div>

                    {item.description && (
                      <p className="mt-1 text-sm text-gray-600">{item.description}</p>
                    )}

                    {/* Metadata Row */}
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center space-x-4">
                        <span>Due: <span className={deadlineInfo.className}>{deadlineInfo.text}</span></span>
                        {/* Enhanced Deadline Urgency */}
                        <span
                          data-testid={`deadline-urgency-${item.id}`}
                          className={cn(
                            "font-medium",
                            item.priority === 'high' && item.urgency === 'overdue' && "urgency-critical text-red-700",
                            item.urgency === 'overdue' && "text-red-600",
                            item.urgency === 'due_soon' && "text-orange-600",
                            item.urgency === 'normal' && "urgency-standard text-gray-500"
                          )}
                        >
                          {item.urgency === 'overdue' && '⚠️ Overdue'}
                          {item.urgency === 'due_soon' && '🔔 Due Soon'}
                          {item.urgency === 'normal' && '✓ On Track'}
                        </span>
                        {item.metadata?.estimatedTime && (
                          <span>~{item.metadata.estimatedTime} min</span>
                        )}
                        <span>Type: {item.type}</span>
                      </div>

                      {/* Workflow Progress */}
                      {item.workflowId && (
                        <div data-testid={`workflow-progress-${item.workflowId}`} className="flex items-center space-x-1">
                          <div className="w-16 bg-gray-200 rounded-full h-1.5">
                            <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: '60%' }}></div>
                          </div>
                          <span className="text-xs">60%</span>
                        </div>
                      )}
                    </div>

                    {/* Error Display */}
                    {hasError && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                        {hasError}
                        <button
                          data-testid="retry-action-button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRetryAction(item.id)
                          }}
                          disabled={retryingAction === item.id}
                          className="ml-2 text-red-700 hover:text-red-900 underline"
                        >
                          {retryingAction === item.id ? 'Retrying...' : 'Retry'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex-shrink-0">
                    <div className="flex items-center space-x-2">
                      {/* Type-specific action buttons */}
                      {item.type === 'approval' && (
                        <>
                          <button
                            data-testid="approve-button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleActionComplete(item.id)
                            }}
                            className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                          >
                            Approve
                          </button>
                          <button
                            data-testid="reject-button"
                            onClick={(e) => {
                              e.stopPropagation()
                              // Handle reject action
                            }}
                            className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                          >
                            Reject
                          </button>
                        </>
                      )}

                      {item.type === 'review' && (
                        <button
                          data-testid="review-button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onItemClick(item)
                          }}
                          className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          Review
                        </button>
                      )}

                      {item.type === 'signature' && (
                        <button
                          data-testid="sign-button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleActionComplete(item.id)
                          }}
                          className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          Sign
                        </button>
                      )}

                      {/* Complete action button */}
                      <button
                        data-testid={`complete-action-${item.id}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleActionComplete(item.id)
                        }}
                        className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
                      >
                        Complete
                      </button>
                    </div>

                    {/* Quick Actions Menu */}
                    {hoveredItem === item.id && (
                      <div
                        data-testid={`quick-actions-menu-${item.id}`}
                        className="absolute right-4 mt-2 bg-white border border-gray-200 rounded-md shadow-lg z-10"
                      >
                        <div className="px-3 py-2 text-sm font-medium text-gray-700 border-b">Quick Actions</div>
                        <div className="py-1">
                          <button className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">View Details</button>
                          <button className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">Edit Priority</button>
                          <button className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">Reassign</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Bulk Priority Change Modal */}
      {showBulkPriority && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-medium mb-4">Change Priority for Selected Items</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Priority Level:
              </label>
              <select
                data-testid="bulk-priority-dropdown"
                value={bulkPriorityValue}
                onChange={(e) => setBulkPriorityValue(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowBulkPriority(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkPriorityChange}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Update Priority
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Priority Change Confirmation Modal */}
      {priorityChangeConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div data-testid="priority-change-confirmation" className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-medium mb-4">Confirm Priority Change</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to change this critical item to low priority?
              This action cannot be undone and may affect workflow deadlines.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setPriorityChangeConfirmation(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmPriorityChange}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
              >
                Confirm Change
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Announcements for Screen Readers */}
      <div
        data-testid="actionable-items-announcements"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {/* Dynamic announcements will be inserted here */}
      </div>
    </div>
  )
}