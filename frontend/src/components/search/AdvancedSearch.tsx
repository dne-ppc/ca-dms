/**
 * Advanced Search Component for Task EXTRA.4
 * Full-text search with filtering, highlighting, and context preview
 */
import React, { useState, useCallback, useRef, useEffect } from 'react'
import { documentService } from '../../services/documentService'
import type { AdvancedSearchParams, AdvancedSearchResponse, SearchResult } from '../../services/documentService'
import './AdvancedSearch.css'

interface AdvancedSearchProps {
  onResultSelect?: (document: any) => void
  onClose?: () => void
  className?: string
}

export const AdvancedSearch: React.FC<AdvancedSearchProps> = ({
  onResultSelect,
  onClose,
  className = ''
}) => {
  const [searchParams, setSearchParams] = useState<AdvancedSearchParams>({
    query: '',
    sortBy: 'relevance',
    sortOrder: 'desc',
    limit: 20,
    offset: 0,
    highlight: true,
    contextLength: 100,
    searchPlaceholders: true,
    fuzzy: false,
    includeStats: true
  })
  
  const [results, setResults] = useState<AdvancedSearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  
  const searchTimeoutRef = useRef<NodeJS.Timeout>()
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus search input and perform initial search
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
    // Perform initial search to load all documents
    performSearch({ ...searchParams, query: '' })
  }, [])

  // Debounced search
  const performSearch = useCallback(async (params: AdvancedSearchParams) => {
    // Allow empty searches to show all documents
    // if (!params.query?.trim() && !params.documentType && !params.createdBy) {
    //   setResults(null)
    //   return
    // }

    setLoading(true)
    setError(null)
    
    try {
      const response = await documentService.advancedSearch(params)
      setResults(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
      setResults(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // Handle input changes with debouncing
  const handleInputChange = (field: keyof AdvancedSearchParams, value: any) => {
    const newParams = { ...searchParams, [field]: value }
    
    // Reset offset when changing search parameters
    if (field !== 'offset') {
      newParams.offset = 0
    }
    
    setSearchParams(newParams)
    
    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    
    // Debounce search for text input
    if (field === 'query') {
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(newParams)
      }, 300)
    } else {
      // Immediate search for filters
      performSearch(newParams)
    }
  }

  // Handle pagination
  const handlePageChange = (newOffset: number) => {
    const newParams = { ...searchParams, offset: newOffset }
    setSearchParams(newParams)
    performSearch(newParams)
  }

  // Render highlighted content
  const renderHighlightedContent = (content: string) => {
    return (
      <div 
        dangerouslySetInnerHTML={{ __html: content }}
        className="search-highlight"
      />
    )
  }

  // Format document type for display
  const formatDocumentType = (type: string) => {
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString()
    } catch {
      return dateString
    }
  }

  return (
    <div className={`advanced-search ${className}`}>
      {/* Search Header */}
      <div className="search-header">
        <div className="search-input-container">
          <input
            ref={inputRef}
            type="text"
            value={searchParams.query || ''}
            onChange={(e) => handleInputChange('query', e.target.value)}
            placeholder="Search documents... (supports full-text search)"
            className="search-input"
          />
          <div className="search-controls">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`filter-toggle ${showFilters ? 'active' : ''}`}
            >
              Filters
            </button>
            {onClose && (
              <button onClick={onClose} className="close-button">
                ×
              </button>
            )}
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="filters-panel">
            <div className="filter-row">
              <label>
                Document Type:
                <select
                  value={searchParams.documentType || ''}
                  onChange={(e) => handleInputChange('documentType', e.target.value || undefined)}
                >
                  <option value="">All Types</option>
                  <option value="governance">Governance</option>
                  <option value="policy">Policy</option>
                  <option value="bylaws">Bylaws</option>
                  <option value="contract">Contract</option>
                  <option value="minutes">Minutes</option>
                  <option value="board_resolution">Board Resolution</option>
                </select>
              </label>

              <label>
                Sort By:
                <select
                  value={searchParams.sortBy}
                  onChange={(e) => handleInputChange('sortBy', e.target.value)}
                >
                  <option value="relevance">Relevance</option>
                  <option value="created_at">Date Created</option>
                  <option value="title">Title</option>
                </select>
              </label>

              <label>
                Order:
                <select
                  value={searchParams.sortOrder}
                  onChange={(e) => handleInputChange('sortOrder', e.target.value)}
                >
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
              </label>
            </div>

            <div className="filter-row">
              <label>
                <input
                  type="checkbox"
                  checked={searchParams.fuzzy || false}
                  onChange={(e) => handleInputChange('fuzzy', e.target.checked)}
                />
                Fuzzy search (typo tolerance)
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={searchParams.searchPlaceholders !== false}
                  onChange={(e) => handleInputChange('searchPlaceholders', e.target.checked)}
                />
                Search in placeholders
              </label>

              <label>
                Results per page:
                <select
                  value={searchParams.limit}
                  onChange={(e) => handleInputChange('limit', parseInt(e.target.value))}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Search Results */}
      <div className="search-results">
        {loading && (
          <div className="loading">
            <div className="spinner"></div>
            Searching...
          </div>
        )}

        {error && (
          <div className="error-message">
            Error: {error}
          </div>
        )}

        {results && !loading && (
          <>
            {/* Results Summary */}
            <div className="results-summary">
              <div className="results-count">
                Found {results.total} documents
                {results.statistics && (
                  <span className="search-time">
                    ({results.statistics.search_time_ms}ms)
                  </span>
                )}
              </div>

              {results.statistics && results.statistics.document_type_breakdown && (
                <div className="type-breakdown">
                  {Object.entries(results.statistics.document_type_breakdown).map(([type, count]) => (
                    <span key={type} className="type-tag">
                      {formatDocumentType(type)}: {count}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Results List */}
            <div className="results-list">
              {results.results.map((result: SearchResult, index: number) => (
                <div
                  key={result.document.id}
                  className="search-result-item"
                  onClick={() => onResultSelect?.(result.document)}
                >
                  <div className="result-header">
                    <div className="result-title">
                      {result.highlights.find(h => h.field === 'title') ? (
                        renderHighlightedContent(
                          result.highlights.find(h => h.field === 'title')!.content
                        )
                      ) : (
                        result.document.title
                      )}
                    </div>
                    
                    <div className="result-metadata">
                      <span className="document-type">
                        {formatDocumentType(result.document.document_type)}
                      </span>
                      <span className="created-date">
                        {formatDate(result.document.created_at || result.document.createdAt)}
                      </span>
                      {searchParams.sortBy === 'relevance' && (
                        <span className="relevance-score">
                          Score: {result.relevance_score.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Preview with highlighting */}
                  {result.preview && (
                    <div className="result-preview">
                      {result.highlights.find(h => h.field === 'content') ? (
                        renderHighlightedContent(
                          result.highlights.find(h => h.field === 'content')!.content
                        )
                      ) : (
                        result.preview
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination */}
            {results.total > (searchParams.limit || 20) && (
              <div className="pagination">
                <button
                  onClick={() => handlePageChange(Math.max(0, (searchParams.offset || 0) - (searchParams.limit || 20)))}
                  disabled={!searchParams.offset || searchParams.offset === 0}
                  className="pagination-button"
                >
                  Previous
                </button>
                
                <span className="pagination-info">
                  {(searchParams.offset || 0) + 1} - {Math.min((searchParams.offset || 0) + (searchParams.limit || 20), results.total)} of {results.total}
                </span>
                
                <button
                  onClick={() => handlePageChange((searchParams.offset || 0) + (searchParams.limit || 20))}
                  disabled={(searchParams.offset || 0) + (searchParams.limit || 20) >= results.total}
                  className="pagination-button"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}

        {/* Empty State */}
        {results && results.results.length === 0 && !loading && (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <div className="empty-message">
              No documents found matching your search criteria
            </div>
            <div className="empty-suggestions">
              Try using different keywords or adjusting your filters
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdvancedSearch