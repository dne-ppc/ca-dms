/**
 * Search Integration Tests - TDD Red Phase
 * Testing advanced search integration across intro page components
 */
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchIntegration, SearchResult, SearchScope } from '../../components/intro/SearchIntegration'

// Mock search results from different components
const mockSearchResults: SearchResult[] = [
  {
    id: 'search-001',
    type: 'actionable_item',
    title: 'Budget Approval Required',
    description: 'Q4 budget proposal needs your approval by Dec 25th',
    source: 'actionable_items',
    metadata: {
      priority: 'high',
      dueDate: '2024-12-25',
      assignee: 'Finance Manager',
      category: 'approval'
    },
    relevanceScore: 0.95,
    matchedFields: ['title', 'description'],
    url: '/documents/budget-proposal-q4'
  },
  {
    id: 'search-002',
    type: 'activity',
    title: 'Document Created: Employee Handbook',
    description: 'New employee handbook created with updated policies',
    source: 'activity_feed',
    metadata: {
      timestamp: '2024-12-20T10:30:00Z',
      user: 'HR Manager',
      documentType: 'handbook',
      status: 'completed'
    },
    relevanceScore: 0.87,
    matchedFields: ['title', 'metadata.documentType'],
    url: '/documents/employee-handbook'
  },
  {
    id: 'search-003',
    type: 'quick_action',
    title: 'Create Document',
    description: 'Quickly create a new document from templates',
    source: 'quick_actions',
    metadata: {
      category: 'document',
      permissions: ['create_document'],
      usage: 'high'
    },
    relevanceScore: 0.78,
    matchedFields: ['title', 'description'],
    url: '/documents/new'
  },
  {
    id: 'search-004',
    type: 'statistic',
    title: 'Document Creation Rate',
    description: 'Average documents created per day this month',
    source: 'statistics',
    metadata: {
      value: '12.5 docs/day',
      trend: 'up',
      category: 'productivity',
      period: 'monthly'
    },
    relevanceScore: 0.65,
    matchedFields: ['title'],
    url: '/dashboard/statistics'
  },
  {
    id: 'search-005',
    type: 'personal_stat',
    title: 'My Document Reviews',
    description: 'Documents you have reviewed this week',
    source: 'personal_stats',
    metadata: {
      value: '8 reviews',
      period: 'weekly',
      category: 'review_activity'
    },
    relevanceScore: 0.72,
    matchedFields: ['description'],
    url: '/profile/activity'
  }
]

const defaultProps = {
  isOpen: false,
  onToggle: vi.fn(),
  onResultClick: vi.fn(),
  onSearch: vi.fn(),
  scopes: ['actionable_items', 'activity_feed', 'quick_actions', 'statistics', 'personal_stats'] as SearchScope[],
  placeholder: 'Search across all components...'
}

describe('Search Integration Component - TDD Red Phase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Search Interface and Layout', () => {
    it('should display search trigger button', () => {
      render(<SearchIntegration {...defaultProps} />)

      // Should have search trigger button
      const searchTrigger = screen.getByTestId('search-trigger-button')
      expect(searchTrigger).toBeInTheDocument()
      expect(searchTrigger).toHaveAttribute('aria-label', 'Open search')

      // Should show search icon and keyboard shortcut
      const searchIcon = screen.getByTestId('search-trigger-icon')
      expect(searchIcon).toBeInTheDocument()

      const keyboardHint = screen.getByTestId('search-keyboard-hint')
      expect(keyboardHint).toBeInTheDocument()
      expect(keyboardHint).toHaveTextContent('⌘K')
    })

    it('should open search modal when triggered', async () => {
      const user = userEvent.setup()
      render(<SearchIntegration {...defaultProps} />)

      // Click search trigger
      const searchTrigger = screen.getByTestId('search-trigger-button')
      await user.click(searchTrigger)

      expect(defaultProps.onToggle).toHaveBeenCalledWith(true)
    })

    it('should display search modal when open', () => {
      render(<SearchIntegration {...defaultProps} isOpen={true} />)

      // Should show search modal
      const searchModal = screen.getByTestId('search-modal')
      expect(searchModal).toBeInTheDocument()
      expect(searchModal).toHaveClass('search-modal-open')

      // Should have search input
      const searchInput = screen.getByTestId('search-input')
      expect(searchInput).toBeInTheDocument()
      expect(searchInput).toHaveAttribute('placeholder', 'Search across all components...')
      expect(searchInput).toHaveFocus()
    })

    it('should support keyboard shortcut to open search', async () => {
      const user = userEvent.setup()
      render(<SearchIntegration {...defaultProps} />)

      // Press Cmd+K (or Ctrl+K)
      await user.keyboard('{Meta>}k{/Meta}')

      expect(defaultProps.onToggle).toHaveBeenCalledWith(true)
    })

    it('should close modal with Escape key', async () => {
      const user = userEvent.setup()
      render(<SearchIntegration {...defaultProps} isOpen={true} />)

      // Press Escape
      await user.keyboard('{Escape}')

      expect(defaultProps.onToggle).toHaveBeenCalledWith(false)
    })
  })

  describe('Search Scopes and Filters', () => {
    it('should display available search scopes', () => {
      render(<SearchIntegration {...defaultProps} isOpen={true} />)

      // Should show scope filters
      const scopeFilters = screen.getByTestId('search-scope-filters')
      expect(scopeFilters).toBeInTheDocument()

      // Should have individual scope buttons
      const actionableItemsScope = screen.getByTestId('scope-filter-actionable_items')
      expect(actionableItemsScope).toBeInTheDocument()
      expect(actionableItemsScope).toHaveTextContent('Tasks')

      const activityScope = screen.getByTestId('scope-filter-activity_feed')
      expect(activityScope).toBeInTheDocument()
      expect(activityScope).toHaveTextContent('Activity')

      const quickActionsScope = screen.getByTestId('scope-filter-quick_actions')
      expect(quickActionsScope).toBeInTheDocument()
      expect(quickActionsScope).toHaveTextContent('Actions')

      const statisticsScope = screen.getByTestId('scope-filter-statistics')
      expect(statisticsScope).toBeInTheDocument()
      expect(statisticsScope).toHaveTextContent('Stats')
    })

    it('should toggle search scopes', async () => {
      const user = userEvent.setup()
      render(<SearchIntegration {...defaultProps} isOpen={true} />)

      // Click on actionable items scope
      const actionableItemsScope = screen.getByTestId('scope-filter-actionable_items')
      expect(actionableItemsScope).toHaveClass('scope-active')

      await user.click(actionableItemsScope)
      expect(actionableItemsScope).toHaveClass('scope-inactive')

      // Click again to reactivate
      await user.click(actionableItemsScope)
      expect(actionableItemsScope).toHaveClass('scope-active')
    })

    it('should show scope-specific result counts', () => {
      const propsWithResults = {
        ...defaultProps,
        isOpen: true,
        searchResults: mockSearchResults
      }

      render(<SearchIntegration {...propsWithResults} />)

      // Should show result counts for each scope
      const actionableCount = screen.getByTestId('scope-count-actionable_items')
      expect(actionableCount).toBeInTheDocument()
      expect(actionableCount).toHaveTextContent('1')

      const activityCount = screen.getByTestId('scope-count-activity_feed')
      expect(activityCount).toBeInTheDocument()
      expect(activityCount).toHaveTextContent('1')

      const quickActionsCount = screen.getByTestId('scope-count-quick_actions')
      expect(quickActionsCount).toBeInTheDocument()
      expect(quickActionsCount).toHaveTextContent('1')

      const statsCount = screen.getByTestId('scope-count-statistics')
      expect(statsCount).toBeInTheDocument()
      expect(statsCount).toHaveTextContent('2') // system_stats + personal_stats
    })

    it('should filter results by selected scopes', async () => {
      const user = userEvent.setup()
      const propsWithResults = {
        ...defaultProps,
        isOpen: true,
        searchResults: mockSearchResults
      }

      render(<SearchIntegration {...propsWithResults} />)

      // Disable activity feed scope
      const activityScope = screen.getByTestId('scope-filter-activity_feed')
      await user.click(activityScope)

      // Should not show activity results
      expect(screen.queryByTestId('search-result-search-002')).not.toBeInTheDocument()

      // Should still show other results
      expect(screen.getByTestId('search-result-search-001')).toBeInTheDocument()
      expect(screen.getByTestId('search-result-search-003')).toBeInTheDocument()
    })
  })

  describe('Search Execution and Results', () => {
    it('should trigger search on input change', async () => {
      const user = userEvent.setup()
      render(<SearchIntegration {...defaultProps} isOpen={true} />)

      const searchInput = screen.getByTestId('search-input')
      await user.type(searchInput, 'budget')

      // Should call onSearch with debounced input
      await waitFor(() => {
        expect(defaultProps.onSearch).toHaveBeenCalledWith('budget', defaultProps.scopes)
      })
    })

    it('should display search results with proper structure', () => {
      const propsWithResults = {
        ...defaultProps,
        isOpen: true,
        searchResults: mockSearchResults,
        searchTerm: 'document'
      }

      render(<SearchIntegration {...propsWithResults} />)

      // Should show search results container
      const resultsContainer = screen.getByTestId('search-results-container')
      expect(resultsContainer).toBeInTheDocument()

      // Should show individual results
      mockSearchResults.forEach(result => {
        const resultElement = screen.getByTestId(`search-result-${result.id}`)
        expect(resultElement).toBeInTheDocument()

        // Should show result title and description
        const resultTitle = screen.getByTestId(`result-title-${result.id}`)
        expect(resultTitle).toBeInTheDocument()
        expect(resultTitle).toHaveTextContent(result.title)

        const resultDescription = screen.getByTestId(`result-description-${result.id}`)
        expect(resultDescription).toBeInTheDocument()
        expect(resultDescription).toHaveTextContent(result.description)
      })
    })

    it('should highlight search terms in results', () => {
      const propsWithResults = {
        ...defaultProps,
        isOpen: true,
        searchResults: mockSearchResults,
        searchTerm: 'document'
      }

      render(<SearchIntegration {...propsWithResults} />)

      // Should highlight matched terms
      const highlighted = screen.getAllByTestId(/highlighted-term-/)
      expect(highlighted.length).toBeGreaterThan(0)

      // Check specific highlighting
      const documentResult = screen.getByTestId('search-result-search-002')
      const highlightedTitle = documentResult.querySelector('.search-highlight')
      expect(highlightedTitle).toBeInTheDocument()
      expect(highlightedTitle).toHaveTextContent('Document')
    })

    it('should display result metadata and source information', () => {
      const propsWithResults = {
        ...defaultProps,
        isOpen: true,
        searchResults: mockSearchResults
      }

      render(<SearchIntegration {...propsWithResults} />)

      // Check actionable item metadata
      const actionableResult = screen.getByTestId('search-result-search-001')
      const priority = screen.getByTestId('result-priority-search-001')
      expect(priority).toBeInTheDocument()
      expect(priority).toHaveClass('priority-high')

      const dueDate = screen.getByTestId('result-due-date-search-001')
      expect(dueDate).toBeInTheDocument()
      expect(dueDate).toHaveTextContent('Dec 25')

      // Check source indicator
      const sourceIndicator = screen.getByTestId('result-source-search-001')
      expect(sourceIndicator).toBeInTheDocument()
      expect(sourceIndicator).toHaveTextContent('Tasks')
    })

    it('should show relevance scores and sorting', () => {
      const propsWithResults = {
        ...defaultProps,
        isOpen: true,
        searchResults: mockSearchResults
      }

      render(<SearchIntegration {...propsWithResults} />)

      // Results should be sorted by relevance score (highest first)
      const results = screen.getAllByTestId(/^search-result-/)
      expect(results[0]).toHaveAttribute('data-testid', 'search-result-search-001') // 0.95 score
      expect(results[1]).toHaveAttribute('data-testid', 'search-result-search-002') // 0.87 score
      expect(results[2]).toHaveAttribute('data-testid', 'search-result-search-003') // 0.78 score

      // Should show relevance scores
      const relevanceScore = screen.getByTestId('result-relevance-search-001')
      expect(relevanceScore).toBeInTheDocument()
      expect(relevanceScore).toHaveTextContent('95%')
    })

    it('should handle empty search results', () => {
      const propsWithNoResults = {
        ...defaultProps,
        isOpen: true,
        searchResults: [],
        searchTerm: 'nonexistent'
      }

      render(<SearchIntegration {...propsWithNoResults} />)

      // Should show empty state
      const emptyState = screen.getByTestId('search-empty-state')
      expect(emptyState).toBeInTheDocument()
      expect(emptyState).toHaveTextContent('No results found for "nonexistent"')

      // Should show search suggestions
      const suggestions = screen.getByTestId('search-suggestions')
      expect(suggestions).toBeInTheDocument()
      expect(suggestions).toHaveTextContent('Try different keywords or check your spelling')
    })

    it('should show loading state during search', () => {
      const propsWithLoading = {
        ...defaultProps,
        isOpen: true,
        isLoading: true,
        searchTerm: 'budget'
      }

      render(<SearchIntegration {...propsWithLoading} />)

      // Should show loading indicator
      const loadingIndicator = screen.getByTestId('search-loading')
      expect(loadingIndicator).toBeInTheDocument()
      expect(loadingIndicator).toHaveTextContent('Searching...')

      // Should show skeleton results
      const skeletonResults = screen.getAllByTestId(/^search-skeleton-/)
      expect(skeletonResults).toHaveLength(3) // Default skeleton count
    })
  })

  describe('Result Interaction and Navigation', () => {
    it('should handle result clicks', async () => {
      const user = userEvent.setup()
      const propsWithResults = {
        ...defaultProps,
        isOpen: true,
        searchResults: mockSearchResults
      }

      render(<SearchIntegration {...propsWithResults} />)

      // Click on first result
      const firstResult = screen.getByTestId('search-result-search-001')
      await user.click(firstResult)

      expect(defaultProps.onResultClick).toHaveBeenCalledWith(mockSearchResults[0])
    })

    it('should support keyboard navigation through results', async () => {
      const user = userEvent.setup()
      const propsWithResults = {
        ...defaultProps,
        isOpen: true,
        searchResults: mockSearchResults
      }

      render(<SearchIntegration {...propsWithResults} />)

      const searchInput = screen.getByTestId('search-input')
      searchInput.focus()

      // Navigate down to first result
      await user.keyboard('{ArrowDown}')
      const firstResult = screen.getByTestId('search-result-search-001')
      expect(firstResult).toHaveClass('search-result-focused')

      // Navigate to second result
      await user.keyboard('{ArrowDown}')
      const secondResult = screen.getByTestId('search-result-search-002')
      expect(secondResult).toHaveClass('search-result-focused')

      // Navigate back up
      await user.keyboard('{ArrowUp}')
      expect(firstResult).toHaveClass('search-result-focused')
    })

    it('should activate focused result with Enter key', async () => {
      const user = userEvent.setup()
      const propsWithResults = {
        ...defaultProps,
        isOpen: true,
        searchResults: mockSearchResults
      }

      render(<SearchIntegration {...propsWithResults} />)

      const searchInput = screen.getByTestId('search-input')
      searchInput.focus()

      // Navigate to first result and press Enter
      await user.keyboard('{ArrowDown}{Enter}')

      expect(defaultProps.onResultClick).toHaveBeenCalledWith(mockSearchResults[0])
    })

    it('should show result preview on hover', async () => {
      const user = userEvent.setup()
      const propsWithResults = {
        ...defaultProps,
        isOpen: true,
        searchResults: mockSearchResults
      }

      render(<SearchIntegration {...propsWithResults} />)

      // Hover over result
      const firstResult = screen.getByTestId('search-result-search-001')
      await user.hover(firstResult)

      // Should show preview tooltip
      const resultPreview = screen.getByTestId('result-preview-search-001')
      expect(resultPreview).toBeInTheDocument()
      expect(resultPreview).toHaveTextContent('Budget Approval Required')

      // Should show additional metadata in preview
      const previewMetadata = screen.getByTestId('preview-metadata-search-001')
      expect(previewMetadata).toBeInTheDocument()
      expect(previewMetadata).toHaveTextContent('High Priority')
      expect(previewMetadata).toHaveTextContent('Due: Dec 25')
    })
  })

  describe('Advanced Search Features', () => {
    it('should support search filters and sorting options', () => {
      const propsWithResults = {
        ...defaultProps,
        isOpen: true,
        searchResults: mockSearchResults
      }

      render(<SearchIntegration {...propsWithResults} />)

      // Should have sorting dropdown
      const sortDropdown = screen.getByTestId('search-sort-dropdown')
      expect(sortDropdown).toBeInTheDocument()

      // Should have sorting options
      const relevanceSort = screen.getByTestId('sort-option-relevance')
      expect(relevanceSort).toBeInTheDocument()
      expect(relevanceSort).toHaveTextContent('Relevance')

      const dateSort = screen.getByTestId('sort-option-date')
      expect(dateSort).toBeInTheDocument()
      expect(dateSort).toHaveTextContent('Date')

      const typeSort = screen.getByTestId('sort-option-type')
      expect(typeSort).toBeInTheDocument()
      expect(typeSort).toHaveTextContent('Type')
    })

    it('should support search within specific time ranges', async () => {
      const user = userEvent.setup()
      render(<SearchIntegration {...defaultProps} isOpen={true} />)

      // Should have time range filter
      const timeRangeFilter = screen.getByTestId('search-time-range')
      expect(timeRangeFilter).toBeInTheDocument()

      // Should have time range options
      const todayOption = screen.getByTestId('time-range-today')
      expect(todayOption).toBeInTheDocument()
      expect(todayOption).toHaveTextContent('Today')

      const weekOption = screen.getByTestId('time-range-week')
      expect(weekOption).toBeInTheDocument()
      expect(weekOption).toHaveTextContent('This Week')

      const monthOption = screen.getByTestId('time-range-month')
      expect(monthOption).toBeInTheDocument()
      expect(monthOption).toHaveTextContent('This Month')

      // Select week option
      await user.click(weekOption)
      expect(weekOption).toHaveClass('time-range-active')
    })

    it('should provide search history and suggestions', async () => {
      const user = userEvent.setup()
      render(<SearchIntegration {...defaultProps} isOpen={true} />)

      // Should show search history when input is empty
      const searchHistory = screen.getByTestId('search-history')
      expect(searchHistory).toBeInTheDocument()

      // Should have recent searches
      const recentSearch1 = screen.getByTestId('recent-search-budget')
      expect(recentSearch1).toBeInTheDocument()
      expect(recentSearch1).toHaveTextContent('budget')

      const recentSearch2 = screen.getByTestId('recent-search-document')
      expect(recentSearch2).toBeInTheDocument()
      expect(recentSearch2).toHaveTextContent('document')

      // Click on recent search
      await user.click(recentSearch1)

      // Should populate search input
      const searchInput = screen.getByTestId('search-input')
      expect(searchInput).toHaveValue('budget')
    })

    it('should support advanced search operators', async () => {
      const user = userEvent.setup()
      render(<SearchIntegration {...defaultProps} isOpen={true} />)

      // Should show advanced search help
      const advancedHelp = screen.getByTestId('advanced-search-help')
      expect(advancedHelp).toBeInTheDocument()

      // Click to expand help
      await user.click(advancedHelp)

      // Should show search operators help
      const operatorsHelp = screen.getByTestId('search-operators-help')
      expect(operatorsHelp).toBeInTheDocument()
      expect(operatorsHelp).toHaveTextContent('Use "quotes" for exact phrases')
      expect(operatorsHelp).toHaveTextContent('Use + to require terms')
      expect(operatorsHelp).toHaveTextContent('Use - to exclude terms')
      expect(operatorsHelp).toHaveTextContent('Use type:document to filter by type')
    })

    it('should support saved search queries', async () => {
      const user = userEvent.setup()
      const propsWithResults = {
        ...defaultProps,
        isOpen: true,
        searchResults: mockSearchResults,
        searchTerm: 'budget approval'
      }

      render(<SearchIntegration {...propsWithResults} />)

      // Should have save search button
      const saveSearchButton = screen.getByTestId('save-search-button')
      expect(saveSearchButton).toBeInTheDocument()

      await user.click(saveSearchButton)

      // Should show save search modal
      const saveModal = screen.getByTestId('save-search-modal')
      expect(saveModal).toBeInTheDocument()

      // Should have search name input
      const searchNameInput = screen.getByTestId('saved-search-name-input')
      expect(searchNameInput).toBeInTheDocument()

      await user.type(searchNameInput, 'Budget Reviews')

      const saveButton = screen.getByTestId('confirm-save-search')
      await user.click(saveButton)

      // Should show success message
      const successMessage = screen.getByTestId('save-search-success')
      expect(successMessage).toBeInTheDocument()
      expect(successMessage).toHaveTextContent('Search saved successfully')
    })
  })

  describe('Accessibility and Performance', () => {
    it('should have proper ARIA labels and roles', () => {
      const propsWithResults = {
        ...defaultProps,
        isOpen: true,
        searchResults: mockSearchResults
      }

      render(<SearchIntegration {...propsWithResults} />)

      // Search modal should have proper role
      const searchModal = screen.getByTestId('search-modal')
      expect(searchModal).toHaveAttribute('role', 'dialog')
      expect(searchModal).toHaveAttribute('aria-label', 'Search across intro page')

      // Search input should have proper labels
      const searchInput = screen.getByTestId('search-input')
      expect(searchInput).toHaveAttribute('aria-label', 'Search input')
      expect(searchInput).toHaveAttribute('aria-describedby', 'search-help')

      // Results should have proper roles
      const resultsContainer = screen.getByTestId('search-results-container')
      expect(resultsContainer).toHaveAttribute('role', 'listbox')
      expect(resultsContainer).toHaveAttribute('aria-label', 'Search results')

      // Individual results should have proper roles
      const firstResult = screen.getByTestId('search-result-search-001')
      expect(firstResult).toHaveAttribute('role', 'option')
      expect(firstResult).toHaveAttribute('aria-label')
    })

    it('should announce search results to screen readers', () => {
      const propsWithResults = {
        ...defaultProps,
        isOpen: true,
        searchResults: mockSearchResults,
        searchTerm: 'document'
      }

      render(<SearchIntegration {...propsWithResults} />)

      // Should have live region for announcements
      const liveRegion = screen.getByTestId('search-live-region')
      expect(liveRegion).toBeInTheDocument()
      expect(liveRegion).toHaveAttribute('aria-live', 'polite')
      expect(liveRegion).toHaveAttribute('aria-atomic', 'true')

      // Should announce result count
      expect(liveRegion).toHaveTextContent('Found 5 results for "document"')
    })

    it('should handle search performance with debouncing', async () => {
      const user = userEvent.setup()
      render(<SearchIntegration {...defaultProps} isOpen={true} />)

      const searchInput = screen.getByTestId('search-input')

      // Type quickly
      await user.type(searchInput, 'budget')

      // Should not call onSearch immediately
      expect(defaultProps.onSearch).not.toHaveBeenCalled()

      // Should call onSearch after debounce delay
      await waitFor(() => {
        expect(defaultProps.onSearch).toHaveBeenCalledWith('budget', defaultProps.scopes)
      }, { timeout: 500 })
    })

    it('should support high contrast and reduced motion preferences', () => {
      // Mock high contrast preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query.includes('prefers-contrast: high'),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      })

      const propsWithResults = {
        ...defaultProps,
        isOpen: true,
        searchResults: mockSearchResults
      }

      render(<SearchIntegration {...propsWithResults} />)

      // Should adapt styling for high contrast
      const searchModal = screen.getByTestId('search-modal')
      expect(searchModal).toHaveClass('high-contrast')
    })
  })
})