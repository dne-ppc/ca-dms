import React, { useState, useMemo, useCallback } from 'react'
import { tocService, TOCHeader, TOCHierarchyItem } from '../../services/tocService'

interface TableOfContentsProps {
  content: string
  onHeaderClick?: (headerId: string) => void
  activeHeaderId?: string
  hierarchical?: boolean
  showLineNumbers?: boolean
  maxLevel?: number
  className?: string
  showCounts?: boolean
  collapsible?: boolean
  searchable?: boolean
  showAnchors?: boolean
  emptyMessage?: string
  showValidation?: boolean
}

export const TableOfContents: React.FC<TableOfContentsProps> = ({
  content,
  onHeaderClick,
  activeHeaderId,
  hierarchical = true,
  showLineNumbers = false,
  maxLevel,
  className = '',
  showCounts = false,
  collapsible = false,
  searchable = false,
  showAnchors = false,
  emptyMessage = 'No table of contents available',
  showValidation = false
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const [extractionError, setExtractionError] = useState<string | null>(null)

  // Extract headers with error handling
  const headers = useMemo(() => {
    try {
      setExtractionError(null)
      if (!content.trim()) return []

      const extracted = tocService.extractHeaders(content)

      // Apply level filtering
      if (maxLevel) {
        return extracted.filter(header => header.level <= maxLevel)
      }

      return extracted
    } catch (error) {
      setExtractionError('Failed to generate table of contents')
      console.error('TOC extraction error:', error)
      return []
    }
  }, [content, maxLevel])

  // Generate hierarchy if needed
  const hierarchy = useMemo(() => {
    if (!hierarchical || headers.length === 0) return []
    try {
      return tocService.generateHierarchy(content)
    } catch (error) {
      console.error('Hierarchy generation error:', error)
      return []
    }
  }, [content, hierarchical, headers.length])

  // Filter headers based on search query
  const filteredHeaders = useMemo(() => {
    if (!searchQuery.trim()) return headers

    const query = searchQuery.toLowerCase()
    return headers.filter(header =>
      header.text.toLowerCase().includes(query)
    )
  }, [headers, searchQuery])

  // Validate hierarchy if requested
  const hierarchyValidation = useMemo(() => {
    if (!showValidation || !content.trim()) return { isValid: true, message: '' }

    try {
      const isValid = tocService.validateHierarchy(content)
      return {
        isValid,
        message: isValid ? '' : 'Invalid header hierarchy detected. Consider checking header levels.'
      }
    } catch (error) {
      return { isValid: false, message: 'Unable to validate hierarchy' }
    }
  }, [content, showValidation])

  // Calculate header counts by level
  const headerCounts = useMemo(() => {
    if (!showCounts) return {}

    const counts: Record<number, number> = {}
    headers.forEach(header => {
      counts[header.level] = (counts[header.level] || 0) + 1
    })
    return counts
  }, [headers, showCounts])

  const handleHeaderClick = useCallback((headerId: string) => {
    onHeaderClick?.(headerId)
  }, [onHeaderClick])

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    // Simple debouncing by using a timeout
    setTimeout(() => {
      setSearchQuery(value)
    }, 150)
  }, [])

  const toggleCollapse = useCallback((headerId: string) => {
    setCollapsedSections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(headerId)) {
        newSet.delete(headerId)
      } else {
        newSet.add(headerId)
      }
      return newSet
    })
  }, [])

  const renderFlatList = () => {
    const headersToRender = searchable ? filteredHeaders : headers

    return (
      <ul role="list" aria-label="Table of contents navigation" className={`space-y-1 ${className}`}>
        {headersToRender.map((header) => (
          <li key={header.id} className={`level-${header.level}`}>
            <button
              onClick={() => handleHeaderClick(header.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleHeaderClick(header.id)
                }
              }}
              className={`w-full text-left p-2 rounded hover:bg-gray-100 transition-colors ${
                activeHeaderId === header.id ? 'active bg-blue-100 text-blue-800' : ''
              } ${
                header.level === 1 ? 'font-semibold text-gray-900' :
                header.level === 2 ? 'font-medium text-gray-700' :
                'text-gray-600'
              }`}
              style={{ paddingLeft: `${(header.level - 1) * 16 + 8}px` }}
              title={showAnchors ? `Navigate to ${header.text}` : undefined}
              aria-label={`Navigate to ${header.text}, level ${header.level}`}
              tabIndex={0}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center">
                  {showLineNumbers && (
                    <span className="text-xs text-gray-400 mr-2 w-8 text-right">
                      {header.lineNumber}
                    </span>
                  )}
                  {header.text}
                </span>
                {showCounts && headerCounts[header.level] && (
                  <span className="text-xs text-gray-400">
                    ({headerCounts[header.level]})
                  </span>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>
    )
  }

  const renderHierarchicalItem = (item: TOCHierarchyItem, depth = 0): React.ReactNode => {
    const isCollapsed = collapsedSections.has(item.id)
    const hasChildren = item.children.length > 0

    return (
      <li key={item.id} className={`level-${item.level}`}>
        <div className="flex items-center">
          {collapsible && hasChildren && (
            <button
              onClick={() => toggleCollapse(item.id)}
              aria-label="Collapse section"
              className="p-1 mr-1 text-gray-400 hover:text-gray-600"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="currentColor"
                className={`transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
              >
                <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/>
              </svg>
            </button>
          )}

          <button
            onClick={() => handleHeaderClick(item.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleHeaderClick(item.id)
              }
            }}
            className={`flex-1 text-left p-2 rounded hover:bg-gray-100 transition-colors ${
              activeHeaderId === item.id ? 'active bg-blue-100 text-blue-800' : ''
            } ${
              item.level === 1 ? 'font-semibold text-gray-900' :
              item.level === 2 ? 'font-medium text-gray-700' :
              'text-gray-600'
            }`}
            title={showAnchors ? `Navigate to ${item.text}` : undefined}
            aria-label={`Navigate to ${item.text}, level ${item.level}`}
            tabIndex={0}
          >
            <div className="flex items-center justify-between">
              <span>{item.text}</span>
              {showCounts && headerCounts[item.level] && (
                <span className="text-xs text-gray-400">
                  ({headerCounts[item.level]})
                </span>
              )}
            </div>
          </button>
        </div>

        {hasChildren && !isCollapsed && (
          <ul className="ml-4 mt-1 space-y-1">
            {item.children.map((child) => renderHierarchicalItem(child, depth + 1))}
          </ul>
        )}
      </li>
    )
  }

  const renderHierarchicalList = () => {
    return (
      <ul role="list" aria-label="Table of contents navigation" className={`space-y-1 ${className}`}>
        {hierarchy.map((item) => renderHierarchicalItem(item))}
      </ul>
    )
  }

  // Show extraction error
  if (extractionError) {
    return (
      <div className="p-4 text-red-600 text-sm">
        {extractionError}
      </div>
    )
  }

  // Show empty state
  if (headers.length === 0) {
    return (
      <div className="p-4 text-gray-500 text-sm">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div>
      {/* Search Input */}
      {searchable && (
        <div className="p-4 border-b border-gray-200">
          <input
            type="text"
            placeholder="Search headers..."
            onChange={handleSearchChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      )}

      {/* Hierarchy Validation Warning */}
      {showValidation && !hierarchyValidation.isValid && (
        <div className="p-4 bg-yellow-50 border-b border-yellow-200">
          <div className="text-yellow-800 text-sm">
            ⚠️ {hierarchyValidation.message}
          </div>
        </div>
      )}

      {/* Table of Contents */}
      <div className="p-4">
        {hierarchical ? renderHierarchicalList() : renderFlatList()}
      </div>
    </div>
  )
}