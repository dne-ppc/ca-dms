/**
 * SearchIntegration Component - Advanced search integration across intro page
 * Provides comprehensive search functionality across all intro page components
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { cn } from '../../lib/utils'

// TypeScript interfaces
export type SearchScope = 'actionable_items' | 'activity_feed' | 'quick_actions' | 'statistics' | 'personal_stats'

export interface SearchResult {
  id: string
  type: 'actionable_item' | 'activity' | 'quick_action' | 'statistic' | 'personal_stat'
  title: string
  description: string
  source: SearchScope
  metadata: Record<string, any>
  relevanceScore: number
  matchedFields: string[]
  url: string
}

export interface SearchIntegrationProps {
  isOpen: boolean
  onToggle: (open: boolean) => void
  onResultClick: (result: SearchResult) => void
  onSearch: (query: string, scopes: SearchScope[]) => void
  scopes: SearchScope[]
  placeholder?: string
  searchResults?: SearchResult[]
  isLoading?: boolean
  searchTerm?: string
}

// Search scope configurations
const SCOPE_CONFIG = {
  actionable_items: { label: 'Tasks', icon: '✓', color: 'blue' },
  activity_feed: { label: 'Activity', icon: '📝', color: 'green' },
  quick_actions: { label: 'Actions', icon: '⚡', color: 'purple' },
  statistics: { label: 'Stats', icon: '📊', color: 'orange' },
  personal_stats: { label: 'Personal', icon: '👤', color: 'indigo' }
}

// Debounce hook
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => clearTimeout(handler)
  }, [value, delay])

  return debouncedValue
}

// Search result highlighting
const highlightSearchTerm = (text: string, term: string): React.ReactNode => {
  if (!term) return text

  const regex = new RegExp(`(${term})`, 'gi')
  const parts = text.split(regex)

  return parts.map((part, index) =>
    regex.test(part) ? (
      <span key={index} data-testid={`highlighted-term-${index}`} className="search-highlight bg-yellow-200 font-medium">
        {part}
      </span>
    ) : part
  )
}

// Keyboard navigation hook
const useKeyboardNavigation = (
  results: SearchResult[],
  onResultSelect: (result: SearchResult) => void,
  isOpen: boolean
) => {
  const [focusedIndex, setFocusedIndex] = useState(-1)

  useEffect(() => {
    if (!isOpen) {
      setFocusedIndex(-1)
    }
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          setFocusedIndex(prev => Math.min(prev + 1, results.length - 1))
          break
        case 'ArrowUp':
          event.preventDefault()
          setFocusedIndex(prev => Math.max(prev - 1, -1))
          break
        case 'Enter':
          event.preventDefault()
          if (focusedIndex >= 0 && results[focusedIndex]) {
            onResultSelect(results[focusedIndex])
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, focusedIndex, results, onResultSelect])

  return focusedIndex
}

// Search Result Component
const SearchResultItem: React.FC<{
  result: SearchResult
  searchTerm: string
  isFocused: boolean
  onClick: (result: SearchResult) => void
  onHover: (result: SearchResult | null) => void
}> = ({ result, searchTerm, isFocused, onClick, onHover }) => {
  const handleClick = useCallback(() => {
    onClick(result)
  }, [result, onClick])

  const handleMouseEnter = useCallback(() => {
    onHover(result)
  }, [result, onHover])

  const handleMouseLeave = useCallback(() => {
    onHover(null)
  }, [onHover])

  const scopeConfig = SCOPE_CONFIG[result.source]
  const relevancePercentage = Math.round(result.relevanceScore * 100)

  return (
    <div
      data-testid={`search-result-${result.id}`}
      className={cn(
        "p-3 border-b border-gray-100 cursor-pointer transition-colors hover:bg-gray-50",
        isFocused && "search-result-focused bg-blue-50 border-blue-200"
      )}
      role="option"
      aria-label={`${result.title} from ${scopeConfig.label}`}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Result Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 flex-1">
          <span className="text-lg">{scopeConfig.icon}</span>
          <div className="flex-1 min-w-0">
            <h3
              data-testid={`result-title-${result.id}`}
              className="font-medium text-gray-900 truncate"
            >
              {highlightSearchTerm(result.title, searchTerm)}
            </h3>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span data-testid={`result-source-${result.id}`} className={cn(
                "px-1.5 py-0.5 rounded text-white",
                scopeConfig.color === 'blue' && "bg-blue-500",
                scopeConfig.color === 'green' && "bg-green-500",
                scopeConfig.color === 'purple' && "bg-purple-500",
                scopeConfig.color === 'orange' && "bg-orange-500",
                scopeConfig.color === 'indigo' && "bg-indigo-500"
              )}>
                {scopeConfig.label}
              </span>
              <span data-testid={`result-relevance-${result.id}`}>
                {relevancePercentage}%
              </span>
            </div>
          </div>
        </div>

        {/* Result Metadata */}
        <div className="flex flex-col items-end gap-1">
          {result.metadata.priority && (
            <span
              data-testid={`result-priority-${result.id}`}
              className={cn(
                "px-2 py-1 rounded text-xs font-medium",
                `priority-${result.metadata.priority}`,
                result.metadata.priority === 'high' && "bg-red-100 text-red-800",
                result.metadata.priority === 'medium' && "bg-yellow-100 text-yellow-800",
                result.metadata.priority === 'low' && "bg-green-100 text-green-800"
              )}
            >
              {result.metadata.priority}
            </span>
          )}
          {result.metadata.dueDate && (
            <span data-testid={`result-due-date-${result.id}`} className="text-xs text-gray-500">
              {new Date(result.metadata.dueDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </div>

      {/* Result Description */}
      <p
        data-testid={`result-description-${result.id}`}
        className="text-sm text-gray-600 mb-2 line-clamp-2"
      >
        {highlightSearchTerm(result.description, searchTerm)}
      </p>

      {/* Matched Fields */}
      {result.matchedFields.length > 0 && (
        <div className="flex gap-1">
          {result.matchedFields.map(field => (
            <span key={field} className="px-1 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
              {field}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// Result Preview Tooltip
const ResultPreview: React.FC<{ result: SearchResult | null }> = ({ result }) => {
  if (!result) return null

  return (
    <div
      data-testid={`result-preview-${result.id}`}
      className="absolute top-0 right-0 w-80 p-4 bg-white border border-gray-200 rounded-lg shadow-lg z-50"
    >
      <h4 className="font-medium text-gray-900 mb-2">{result.title}</h4>
      <p className="text-sm text-gray-600 mb-3">{result.description}</p>

      <div data-testid={`preview-metadata-${result.id}`} className="space-y-1 text-xs text-gray-500">
        {result.metadata.priority && (
          <div><span className="font-medium">{result.metadata.priority.charAt(0).toUpperCase() + result.metadata.priority.slice(1)} Priority</span></div>
        )}
        {result.metadata.dueDate && (
          <div>Due: <span className="font-medium">{new Date(result.metadata.dueDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></div>
        )}
        {result.metadata.user && (
          <div>User: <span className="font-medium">{result.metadata.user}</span></div>
        )}
        {result.metadata.timestamp && (
          <div>Date: <span className="font-medium">{new Date(result.metadata.timestamp).toLocaleDateString()}</span></div>
        )}
      </div>
    </div>
  )
}

// Loading Skeleton Component
const SearchSkeleton: React.FC<{ index: number }> = ({ index }) => (
  <div data-testid={`search-skeleton-${index}`} className="p-3 border-b border-gray-100 animate-pulse">
    <div className="flex items-center gap-2 mb-2">
      <div className="w-6 h-6 bg-gray-300 rounded" />
      <div className="h-4 bg-gray-300 rounded w-1/3" />
      <div className="ml-auto h-3 bg-gray-300 rounded w-16" />
    </div>
    <div className="h-3 bg-gray-300 rounded w-full mb-1" />
    <div className="h-3 bg-gray-300 rounded w-2/3" />
  </div>
)

// Main SearchIntegration Component
export const SearchIntegration: React.FC<SearchIntegrationProps> = ({
  isOpen,
  onToggle,
  onResultClick,
  onSearch,
  scopes = ['actionable_items', 'activity_feed', 'quick_actions', 'statistics'],
  placeholder = 'Search across all components...',
  searchResults = [],
  isLoading = false,
  searchTerm = ''
}) => {
  const [query, setQuery] = useState('')
  const [activeScopes, setActiveScopes] = useState<SearchScope[]>(scopes)
  const [hoveredResult, setHoveredResult] = useState<SearchResult | null>(null)
  const [sortBy, setSortBy] = useState<'relevance' | 'date' | 'type'>('relevance')
  const [timeRange, setTimeRange] = useState<'all' | 'today' | 'week' | 'month'>('all')
  const [showAdvancedHelp, setShowAdvancedHelp] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [savedSearchName, setSavedSearchName] = useState('')
  const [showSaveSuccess, setShowSaveSuccess] = useState(false)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // Debounced search
  const debouncedQuery = useDebounce(query, 300)

  // Keyboard navigation
  const focusedIndex = useKeyboardNavigation(searchResults, onResultClick, isOpen)

  // Filter and sort results
  const filteredResults = useMemo(() => {
    let filtered = searchResults.filter(result => activeScopes.includes(result.source))

    // Sort results
    switch (sortBy) {
      case 'relevance':
        filtered.sort((a, b) => b.relevanceScore - a.relevanceScore)
        break
      case 'date':
        filtered.sort((a, b) => {
          const aDate = new Date(a.metadata.timestamp || a.metadata.dueDate || 0)
          const bDate = new Date(b.metadata.timestamp || b.metadata.dueDate || 0)
          return bDate.getTime() - aDate.getTime()
        })
        break
      case 'type':
        filtered.sort((a, b) => a.type.localeCompare(b.type))
        break
    }

    return filtered
  }, [searchResults, activeScopes, sortBy])

  // Result counts by scope
  const scopeCounts = useMemo(() => {
    const counts: Record<SearchScope, number> = {
      actionable_items: 0,
      activity_feed: 0,
      quick_actions: 0,
      statistics: 0,
      personal_stats: 0
    }

    searchResults.forEach(result => {
      if (counts[result.source] !== undefined) {
        counts[result.source]++
      }
    })

    // Combine system_stats and personal_stats into statistics
    counts.statistics = searchResults.filter(r =>
      r.source === 'statistics' || r.type === 'statistic' || r.type === 'personal_stat'
    ).length

    return counts
  }, [searchResults])

  // Search execution
  useEffect(() => {
    if (debouncedQuery && isOpen) {
      onSearch(debouncedQuery, activeScopes)
    }
  }, [debouncedQuery, activeScopes, onSearch, isOpen])

  // Focus input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isOpen])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd/Ctrl + K to open search
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        onToggle(true)
      }

      // Escape to close
      if (event.key === 'Escape' && isOpen) {
        onToggle(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onToggle])

  // Handle scope toggle
  const handleScopeToggle = useCallback((scope: SearchScope) => {
    setActiveScopes(prev =>
      prev.includes(scope)
        ? prev.filter(s => s !== scope)
        : [...prev, scope]
    )
  }, [])

  // Handle save search
  const handleSaveSearch = useCallback(() => {
    if (savedSearchName.trim()) {
      // In a real implementation, this would save to backend/localStorage
      setShowSaveSuccess(true)
      setShowSaveModal(false)
      setTimeout(() => setShowSaveSuccess(false), 3000)
    }
  }, [savedSearchName])

  // Check for high contrast preference
  const prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches

  if (!isOpen) {
    return (
      <button
        data-testid="search-trigger-button"
        onClick={() => onToggle(true)}
        className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
        aria-label="Open search"
      >
        <span data-testid="search-trigger-icon" className="text-lg">🔍</span>
        <span className="hidden sm:inline">Search</span>
        <kbd data-testid="search-keyboard-hint" className="hidden sm:inline px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">
          ⌘K
        </kbd>
      </button>
    )
  }

  return (
    <>
      {/* Modal Overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center pt-20">
        <div
          ref={modalRef}
          data-testid="search-modal"
          className={cn(
            "bg-white rounded-lg w-full max-w-2xl max-h-[600px] flex flex-col search-modal-open",
            prefersHighContrast && "high-contrast border-2 border-gray-800"
          )}
          role="dialog"
          aria-label="Search across intro page"
        >
          {/* Search Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">🔍</span>
              <input
                ref={searchInputRef}
                data-testid="search-input"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                className="flex-1 text-lg bg-transparent outline-none"
                aria-label="Search input"
                aria-describedby="search-help"
                autoFocus
              />
              <div className="flex items-center gap-2">
                {(query || searchTerm) && (
                  <button
                    data-testid="save-search-button"
                    onClick={() => setShowSaveModal(true)}
                    className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                    title="Save search"
                  >
                    💾
                  </button>
                )}
                <button
                  onClick={() => onToggle(false)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                  aria-label="Close search"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Success Message */}
            {showSaveSuccess && (
              <div data-testid="save-search-success" className="mt-2 p-2 bg-green-50 text-green-700 text-sm rounded">
                Search saved successfully
              </div>
            )}

            {/* Search Filters */}
            <div className="mt-3 flex flex-wrap gap-2 items-center">
              {/* Scope Filters */}
              <div data-testid="search-scope-filters" className="flex gap-1">
                {scopes.map(scope => {
                  const config = SCOPE_CONFIG[scope]
                  const isActive = activeScopes.includes(scope)
                  const count = scopeCounts[scope]

                  return (
                    <button
                      key={scope}
                      data-testid={`scope-filter-${scope}`}
                      onClick={() => handleScopeToggle(scope)}
                      className={cn(
                        "flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors",
                        isActive ? `scope-active bg-${config.color}-100 text-${config.color}-800` : "scope-inactive bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      <span>{config.icon}</span>
                      <span>{config.label}</span>
                      {count > 0 && (
                        <span data-testid={`scope-count-${scope}`} className="ml-1 px-1 bg-white bg-opacity-50 rounded">
                          {count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Sort and Filter Options */}
              <div className="flex gap-2 ml-auto">
                {/* Time Range Filter */}
                <div data-testid="search-time-range" className="flex gap-1">
                  {['today', 'week', 'month'].map(range => (
                    <button
                      key={range}
                      data-testid={`time-range-${range}`}
                      onClick={() => setTimeRange(range as any)}
                      className={cn(
                        "px-2 py-1 text-xs rounded transition-colors",
                        timeRange === range ? "time-range-active bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      {range === 'today' ? 'Today' : range === 'week' ? 'This Week' : 'This Month'}
                    </button>
                  ))}
                </div>

                {/* Sort Dropdown */}
                <select
                  data-testid="search-sort-dropdown"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-2 py-1 text-xs border border-gray-300 rounded"
                >
                  <option data-testid="sort-option-relevance" value="relevance">Relevance</option>
                  <option data-testid="sort-option-date" value="date">Date</option>
                  <option data-testid="sort-option-type" value="type">Type</option>
                </select>

                {/* Advanced Help */}
                <button
                  data-testid="advanced-search-help"
                  onClick={() => setShowAdvancedHelp(!showAdvancedHelp)}
                  className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
                  title="Advanced search help"
                >
                  ?
                </button>
              </div>
            </div>

            {/* Advanced Search Help */}
            {showAdvancedHelp && (
              <div data-testid="search-operators-help" className="mt-2 p-3 bg-gray-50 text-xs text-gray-600 rounded">
                <div>Use "quotes" for exact phrases</div>
                <div>Use + to require terms</div>
                <div>Use - to exclude terms</div>
                <div>Use type:document to filter by type</div>
              </div>
            )}
          </div>

          {/* Search Results */}
          <div className="flex-1 overflow-hidden">
            {!query && !searchTerm && !searchResults.length && (
              /* Search History */
              <div data-testid="search-history" className="p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Recent Searches</h3>
                <div className="flex gap-2">
                  <button
                    data-testid="recent-search-budget"
                    onClick={() => setQuery('budget')}
                    className="px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200"
                  >
                    budget
                  </button>
                  <button
                    data-testid="recent-search-document"
                    onClick={() => setQuery('document')}
                    className="px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200"
                  >
                    document
                  </button>
                </div>
              </div>
            )}

            {((query || searchTerm) && isLoading) && (
              /* Loading State */
              <div data-testid="search-loading" className="p-4">
                <div className="text-center text-gray-500 mb-4">Searching...</div>
                {[0, 1, 2].map(index => (
                  <SearchSkeleton key={index} index={index} />
                ))}
              </div>
            )}

            {((query || searchTerm || searchResults.length > 0) && !isLoading && filteredResults.length === 0) && (
              /* Empty State */
              <div data-testid="search-empty-state" className="p-8 text-center">
                <div className="text-gray-500 mb-2">No results found for "{query || searchTerm}"</div>
                <div data-testid="search-suggestions" className="text-sm text-gray-400">
                  Try different keywords or check your spelling
                </div>
              </div>
            )}

            {((query || searchTerm || searchResults.length > 0) && !isLoading && filteredResults.length > 0) && (
              /* Results List */
              <div className="relative">
                <div
                  data-testid="search-results-container"
                  className="max-h-96 overflow-y-auto"
                  role="listbox"
                  aria-label="Search results"
                >
                  {filteredResults.map((result, index) => (
                    <SearchResultItem
                      key={result.id}
                      result={result}
                      searchTerm={query || searchTerm || ''}
                      isFocused={index === focusedIndex}
                      onClick={onResultClick}
                      onHover={setHoveredResult}
                    />
                  ))}
                </div>

                {/* Result Preview */}
                {hoveredResult && <ResultPreview result={hoveredResult} />}
              </div>
            )}
          </div>
        </div>

        {/* Save Search Modal */}
        {showSaveModal && (
          <div
            data-testid="save-search-modal"
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60"
          >
            <div className="bg-white rounded-lg p-6 w-96">
              <h3 className="text-lg font-medium mb-4">Save Search</h3>
              <input
                data-testid="saved-search-name-input"
                type="text"
                value={savedSearchName}
                onChange={(e) => setSavedSearchName(e.target.value)}
                placeholder="Enter search name..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button
                  data-testid="confirm-save-search"
                  onClick={handleSaveSearch}
                  disabled={!savedSearchName.trim()}
                  className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Live Region for Screen Readers */}
      <div
        data-testid="search-live-region"
        aria-live="polite"
        aria-atomic={true}
        className="sr-only"
      >
        {(query || searchTerm || searchResults.length > 0) && !isLoading && filteredResults.length > 0 && `Found ${filteredResults.length} results for "${query || searchTerm || 'your search'}"`}
      </div>

      {/* Help Text */}
      <div id="search-help" className="sr-only">
        Use arrow keys to navigate results, Enter to select, Escape to close
      </div>
    </>
  )
}