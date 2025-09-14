/**
 * QuickActions Component
 * Customizable navigation shortcuts with drag-and-drop configuration
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'

export interface QuickAction {
  id: string
  title: string
  description?: string
  icon: string
  action: 'create' | 'navigate' | 'execute'
  target: string
  category: string
  enabled: boolean
  order: number
  metadata?: Record<string, any>
}

interface QuickActionsProps {
  actions: QuickAction[]
  layout?: 'grid' | 'list'
  loading?: boolean
  onActionClick: (action: QuickAction) => void | Promise<void>
  onConfigureActions?: () => void
  onReorderActions?: (reorderedActions: QuickAction[]) => void
  onToggleAction?: (actionId: string, enabled: boolean) => void
  className?: string
}

type CategoryFilter = 'all' | string

export const QuickActions: React.FC<QuickActionsProps> = ({
  actions,
  layout = 'grid',
  loading = false,
  onActionClick,
  onConfigureActions,
  onReorderActions,
  onToggleAction,
  className
}) => {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [isEditMode, setIsEditMode] = useState(false)
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({})
  const [retryingAction, setRetryingAction] = useState<string | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)

  // Filter and sort actions
  const filteredAndSortedActions = useMemo(() => {
    // In edit mode, show all actions; otherwise, only enabled actions
    let filtered = isEditMode ? actions : actions.filter(action => action.enabled)

    // Apply category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(action => action.category === categoryFilter)
    }

    // Sort by order
    return filtered.sort((a, b) => a.order - b.order)
  }, [actions, categoryFilter, isEditMode])

  // Group actions by category for list view
  const groupedActions = useMemo(() => {
    const groups: Record<string, QuickAction[]> = {}
    filteredAndSortedActions.forEach(action => {
      if (!groups[action.category]) {
        groups[action.category] = []
      }
      groups[action.category].push(action)
    })
    return groups
  }, [filteredAndSortedActions])

  // Get unique categories
  const categories = useMemo(() => {
    return Array.from(new Set(actions.map(action => action.category)))
  }, [actions])

  // Handle action click with error handling
  const handleActionClick = useCallback(async (action: QuickAction) => {
    try {
      setActionErrors(prev => ({ ...prev, [action.id]: '' }))
      await onActionClick(action)
    } catch (error) {
      setActionErrors(prev => ({
        ...prev,
        [action.id]: 'Failed to execute action. Please try again.'
      }))
    }
  }, [onActionClick])

  // Handle retry action
  const handleRetryAction = useCallback(async (action: QuickAction) => {
    setRetryingAction(action.id)
    try {
      await handleActionClick(action)
      setActionErrors(prev => ({ ...prev, [action.id]: '' }))
    } finally {
      setRetryingAction(null)
    }
  }, [handleActionClick])

  // Handle configure actions with error handling
  const handleConfigureActions = useCallback(async () => {
    try {
      setConfigError(null)
      if (onConfigureActions) {
        await onConfigureActions()
      }
    } catch (error) {
      setConfigError('Failed to save configuration. Please try again.')
    }
  }, [onConfigureActions])

  // Handle action reordering
  const handleMoveAction = useCallback((actionId: string, direction: 'up' | 'down') => {
    if (!onReorderActions) return

    const currentActions = [...actions]
    const actionIndex = currentActions.findIndex(a => a.id === actionId)

    if (actionIndex === -1) return

    const newIndex = direction === 'up' ? actionIndex - 1 : actionIndex + 1
    if (newIndex < 0 || newIndex >= currentActions.length) return

    // Swap orders
    const temp = currentActions[actionIndex].order
    currentActions[actionIndex].order = currentActions[newIndex].order
    currentActions[newIndex].order = temp

    onReorderActions(currentActions)
  }, [actions, onReorderActions])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent, action: QuickAction) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleActionClick(action)
    } else if (layout === 'grid') {
      // Arrow key navigation in grid
      const currentIndex = filteredAndSortedActions.findIndex(a => a.id === action.id)
      let nextIndex = currentIndex

      switch (event.key) {
        case 'ArrowRight':
          nextIndex = Math.min(currentIndex + 1, filteredAndSortedActions.length - 1)
          break
        case 'ArrowLeft':
          nextIndex = Math.max(currentIndex - 1, 0)
          break
        case 'ArrowDown':
          nextIndex = Math.min(currentIndex + 2, filteredAndSortedActions.length - 1) // Assuming 2 columns
          break
        case 'ArrowUp':
          nextIndex = Math.max(currentIndex - 2, 0) // Assuming 2 columns
          break
      }

      if (nextIndex !== currentIndex) {
        event.preventDefault()
        const nextAction = filteredAndSortedActions[nextIndex]
        const nextElement = document.querySelector(`[data-testid="quick-action-${nextAction.id}"]`) as HTMLElement
        nextElement?.focus()
      }
    }
  }, [layout, filteredAndSortedActions, handleActionClick])

  // Icon mapping (simplified)
  const getIconComponent = (iconName: string) => {
    const iconMap: Record<string, string> = {
      'document-plus': '📄',
      'clock': '🕒',
      'template': '📝',
      'workflow': '⚡',
      'plus': '➕'
    }
    return iconMap[iconName] || '📋'
  }

  // Loading state
  if (loading) {
    return (
      <div
        data-testid="quick-actions-loading"
        className={cn("bg-white rounded-lg shadow p-6", className)}
      >
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
        <div className="text-center text-gray-500 mt-4">Loading quick actions...</div>
      </div>
    )
  }

  // Empty state
  if (filteredAndSortedActions.length === 0 && actions.length === 0) {
    return (
      <div
        data-testid="quick-actions-empty"
        className={cn("bg-white rounded-lg shadow p-8 text-center", className)}
      >
        <div className="text-gray-400 mb-4">
          <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-600 mb-2">No quick actions configured</h3>
        <p className="text-gray-500 mb-4">Click "Configure" to add quick actions</p>
        {onConfigureActions && (
          <button
            onClick={handleConfigureActions}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Configure Actions
          </button>
        )}
      </div>
    )
  }

  return (
    <div
      data-testid="quick-actions-container"
      role="region"
      aria-label="Quick Actions Dashboard"
      className={cn("bg-white rounded-lg shadow", className)}
    >
      {/* Header Section */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Quick Actions</h2>
            <p className="text-sm text-gray-500">{filteredAndSortedActions.length} actions</p>
          </div>
          <div className="flex items-center space-x-2">
            {onConfigureActions && (
              <>
                {!isEditMode ? (
                  <>
                    <button
                      data-testid="edit-actions-button"
                      onClick={() => setIsEditMode(true)}
                      className="text-gray-600 hover:text-gray-800 px-3 py-1 rounded text-sm"
                    >
                      Edit
                    </button>
                    <button
                      data-testid="configure-actions-button"
                      onClick={handleConfigureActions}
                      className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                    >
                      Configure
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      data-testid="cancel-changes-button"
                      onClick={() => setIsEditMode(false)}
                      className="text-gray-600 hover:text-gray-800 px-3 py-1 rounded text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      data-testid="save-changes-button"
                      onClick={() => setIsEditMode(false)}
                      className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                    >
                      Save
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex items-center space-x-4">
          <select
            data-testid="category-filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Categories</option>
            {categories.map((category, index) => (
              <option key={`${category}-${index}`} value={category}>
                {category ? (category.charAt(0).toUpperCase() + category.slice(1)) : 'Unknown'} Actions
              </option>
            ))}
          </select>
        </div>

        {/* Configuration Error */}
        {configError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600">
            {configError}
          </div>
        )}
      </div>

      {/* Actions Grid/List */}
      <div className="p-6">
        {layout === 'grid' ? (
          <div
            data-testid="quick-actions-grid"
            className="grid grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {filteredAndSortedActions.map((action) => (
              <ActionCard
                key={action.id}
                action={action}
                isEditMode={isEditMode}
                error={actionErrors[action.id]}
                isRetrying={retryingAction === action.id}
                onActionClick={handleActionClick}
                onRetryAction={handleRetryAction}
                onToggleAction={onToggleAction}
                onMoveAction={handleMoveAction}
                onKeyDown={handleKeyDown}
                canMoveUp={action.order > 1}
                canMoveDown={action.order < actions.length}
                getIconComponent={getIconComponent}
              />
            ))}
          </div>
        ) : (
          <div data-testid="quick-actions-list" className="space-y-2">
            {Object.entries(groupedActions).map(([category, categoryActions]) => (
              <div key={category} data-testid={`category-group-${category}`}>
                <h3 className="text-lg font-medium text-gray-900 mb-3">
                  {category.charAt(0).toUpperCase() + category.slice(1)} Actions
                </h3>
                <div className="space-y-2">
                  {categoryActions.map((action) => (
                    <ActionCard
                      key={action.id}
                      action={action}
                      isEditMode={isEditMode}
                      error={actionErrors[action.id]}
                      isRetrying={retryingAction === action.id}
                      onActionClick={handleActionClick}
                      onRetryAction={handleRetryAction}
                      onToggleAction={onToggleAction}
                      onMoveAction={handleMoveAction}
                      onKeyDown={handleKeyDown}
                      canMoveUp={action.order > 1}
                      canMoveDown={action.order < actions.length}
                      getIconComponent={getIconComponent}
                      layout="list"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Virtualization Container for Large Lists */}
      {filteredAndSortedActions.length >= 50 && (
        <div data-testid="virtual-actions-container" className="hidden">
          {/* Virtual scrolling would be implemented here for performance */}
        </div>
      )}
    </div>
  )
}

// Action Card Component
interface ActionCardProps {
  action: QuickAction
  isEditMode: boolean
  error?: string
  isRetrying: boolean
  onActionClick: (action: QuickAction) => void
  onRetryAction: (action: QuickAction) => void
  onToggleAction?: (actionId: string, enabled: boolean) => void
  onMoveAction: (actionId: string, direction: 'up' | 'down') => void
  onKeyDown: (event: React.KeyboardEvent, action: QuickAction) => void
  canMoveUp: boolean
  canMoveDown: boolean
  getIconComponent: (iconName: string) => string
  layout?: 'grid' | 'list'
}

const ActionCard: React.FC<ActionCardProps> = ({
  action,
  isEditMode,
  error,
  isRetrying,
  onActionClick,
  onRetryAction,
  onToggleAction,
  onMoveAction,
  onKeyDown,
  canMoveUp,
  canMoveDown,
  getIconComponent,
  layout = 'grid'
}) => {
  const isListLayout = layout === 'list'

  return (
    <div
      data-testid={`quick-action-${action.id}`}
      role="button"
      tabIndex={0}
      aria-label={`${action.title}: ${action.description || ''}`}
      className={cn(
        "relative group transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg",
        isListLayout
          ? "flex items-center p-4 hover:bg-gray-50"
          : "p-6 text-center hover:shadow-md cursor-pointer",
        action.enabled
          ? "bg-white border border-gray-200 hover:border-gray-300"
          : "bg-gray-50 border border-gray-100 opacity-60"
      )}
      onClick={!isEditMode ? () => onActionClick(action) : undefined}
      onKeyDown={(e) => !isEditMode && onKeyDown(e, action)}
    >
      {/* Drag Handle for Reordering */}
      {isEditMode && (
        <div
          data-testid={`drag-handle-${action.id}`}
          className="absolute top-2 left-2 text-gray-400 cursor-move"
        >
          ⋮⋮
        </div>
      )}

      <div className={cn("flex", isListLayout ? "items-center space-x-4" : "flex-col items-center")}>
        {/* Icon */}
        <div
          data-testid={`action-icon-${action.icon}`}
          className={cn(
            "text-2xl",
            isListLayout ? "flex-shrink-0" : "mb-3"
          )}
        >
          {getIconComponent(action.icon)}
        </div>

        {/* Content */}
        <div className={cn("flex-1", isListLayout ? "text-left" : "")}>
          <h3 className={cn("font-medium text-gray-900", isListLayout ? "text-base" : "text-sm")}>
            {action.title}
          </h3>
          {action.description && (
            <p className={cn("text-gray-600", isListLayout ? "text-sm mt-1" : "text-xs mt-1")}>
              {action.description}
            </p>
          )}

          {/* Category Badge */}
          <span className={cn(
            "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800",
            isListLayout ? "mt-2" : "mt-3"
          )}>
            {action.category}
          </span>

          {/* Error Display */}
          {error && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
              {error}
              <button
                data-testid="retry-action-button"
                onClick={(e) => {
                  e.stopPropagation()
                  onRetryAction(action)
                }}
                disabled={isRetrying}
                className="ml-2 text-red-700 hover:text-red-900 underline"
              >
                {isRetrying ? 'Retrying...' : 'Retry'}
              </button>
            </div>
          )}
        </div>

        {/* Edit Mode Controls */}
        {isEditMode && (
          <div className="flex items-center space-x-2">
            {/* Toggle Switch */}
            {onToggleAction && (
              <label className="flex items-center">
                <input
                  data-testid={`toggle-action-${action.id}`}
                  type="checkbox"
                  checked={action.enabled}
                  onChange={(e) => onToggleAction(action.id, e.target.checked)}
                  className="sr-only"
                />
                <div className={cn(
                  "relative inline-flex items-center h-6 w-11 rounded-full transition-colors",
                  action.enabled ? "bg-blue-600" : "bg-gray-300"
                )}>
                  <span className={cn(
                    "inline-block w-4 h-4 transform bg-white rounded-full transition-transform",
                    action.enabled ? "translate-x-6" : "translate-x-1"
                  )} />
                </div>
              </label>
            )}

            {/* Move Controls */}
            <div className="flex flex-col space-y-1">
              {canMoveUp && (
                <button
                  data-testid={`move-up-${action.id}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onMoveAction(action.id, 'up')
                  }}
                  className="text-gray-400 hover:text-gray-600 text-xs"
                >
                  ↑
                </button>
              )}
              {canMoveDown && (
                <button
                  data-testid={`move-down-${action.id}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onMoveAction(action.id, 'down')
                  }}
                  className="text-gray-400 hover:text-gray-600 text-xs"
                >
                  ↓
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}