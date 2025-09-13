/**
 * Integration tests for TemplateManager component
 * Tests complex interactions with API, filtering, pagination, and user workflows
 */
import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemplateManager } from '../../components/templates/TemplateManager'

// Mock UI components
jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className} data-testid="card">{children}</div>,
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: any) => <div data-testid="card-title">{children}</div>
}))

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, size, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-testid={props['data-testid'] || 'button'}
      data-variant={variant}
      data-size={size}
      {...props}
    >
      {children}
    </button>
  )
}))

jest.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, placeholder, ...props }: any) => (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      data-testid="input"
      {...props}
    />
  )
}))

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, className }: any) => (
    <span data-testid="badge" data-variant={variant} className={className}>
      {children}
    </span>
  )
}))

jest.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <div data-testid="select" data-value={value}>
      <button onClick={() => onValueChange && onValueChange('test-value')}>
        {children}
      </button>
    </div>
  ),
  SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
  SelectItem: ({ children, value }: any) => (
    <div data-testid="select-item" data-value={value}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: any) => <div data-testid="select-trigger">{children}</div>,
  SelectValue: ({ placeholder }: any) => <span data-testid="select-value">{placeholder}</span>
}))

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open, onOpenChange }: any) => (
    <div data-testid="dialog" data-open={open}>
      {children}
      {open && <div data-testid="dialog-overlay" />}
    </div>
  ),
  DialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
  DialogDescription: ({ children }: any) => <div data-testid="dialog-description">{children}</div>,
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <div data-testid="dialog-title">{children}</div>,
  DialogTrigger: ({ children, asChild }: any) => (
    <div data-testid="dialog-trigger">{children}</div>
  )
}))

jest.mock('@/lib/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' ')
}))

// Mock fetch
const mockFetch = jest.fn()
global.fetch = mockFetch

// Mock window.location
const mockLocation = {
  href: ''
}
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true
})

// Mock window.confirm
global.confirm = jest.fn(() => true)

describe('TemplateManager Integration Tests', () => {
  const mockTemplatesData = {
    templates: [
      {
        id: 'template-1',
        name: 'Governance Policy Template',
        description: 'Standard template for governance policies',
        category: 'governance',
        access_level: 'public',
        status: 'published',
        version: 2,
        usage_count: 15,
        created_by: 'user-1',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-20T10:00:00Z',
        published_at: '2024-01-18T10:00:00Z',
        tags: ['policy', 'governance', 'standard']
      },
      {
        id: 'template-2',
        name: 'Meeting Minutes Template',
        description: 'Template for board meeting minutes',
        category: 'meeting',
        access_level: 'internal',
        status: 'draft',
        version: 1,
        usage_count: 8,
        created_by: 'user-2',
        created_at: '2024-01-10T10:00:00Z',
        updated_at: '2024-01-10T10:00:00Z',
        tags: ['meeting', 'minutes']
      },
      {
        id: 'template-3',
        name: 'Financial Report Template',
        description: 'Quarterly financial reporting template',
        category: 'financial',
        access_level: 'private',
        status: 'published',
        version: 3,
        usage_count: 25,
        created_by: 'user-3',
        created_at: '2024-01-05T10:00:00Z',
        updated_at: '2024-01-25T10:00:00Z',
        published_at: '2024-01-12T10:00:00Z',
        tags: ['financial', 'quarterly', 'report']
      }
    ],
    total: 3,
    page: 1,
    limit: 12,
    total_pages: 1,
    has_next: false,
    has_prev: false
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockLocation.href = ''

    // Default successful API response
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockTemplatesData
    })
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('Component Initialization', () => {
    it('should render template manager with header and controls', async () => {
      await act(async () => {
        render(<TemplateManager />)
      })

      expect(screen.getByText('Document Templates')).toBeInTheDocument()
      expect(screen.getByText('Create and manage reusable document templates for your organization')).toBeInTheDocument()
      expect(screen.getByText('Create Template')).toBeInTheDocument()
    })

    it('should fetch templates on component mount', async () => {
      await act(async () => {
        render(<TemplateManager />)
      })

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/templates/?'),
          undefined
        )
      })

      // Check if templates are displayed
      await waitFor(() => {
        expect(screen.getByText('Governance Policy Template')).toBeInTheDocument()
        expect(screen.getByText('Meeting Minutes Template')).toBeInTheDocument()
        expect(screen.getByText('Financial Report Template')).toBeInTheDocument()
      })
    })

    it('should show loading state initially', async () => {
      let resolvePromise: (value: any) => void
      const fetchPromise = new Promise((resolve) => {
        resolvePromise = resolve
      })

      mockFetch.mockReturnValue(fetchPromise)

      await act(async () => {
        render(<TemplateManager />)
      })

      // Should show loading spinner
      expect(screen.getByTestId('card-content')).toContainElement(
        screen.getByRole('generic', { hidden: true })
      )

      // Resolve the promise
      act(() => {
        resolvePromise!({
          ok: true,
          json: async () => mockTemplatesData
        })
      })

      await waitFor(() => {
        expect(screen.getByText('Governance Policy Template')).toBeInTheDocument()
      })
    })
  })

  describe('Search and Filtering Integration', () => {
    it('should search templates when search query changes', async () => {
      const user = userEvent.setup()

      await act(async () => {
        render(<TemplateManager />)
      })

      // Wait for initial load
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1)
      })

      const searchInput = screen.getByPlaceholderText('Search templates...')

      await act(async () => {
        await user.type(searchInput, 'governance')
      })

      // Should trigger search with query parameter
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('query=governance'),
          undefined
        )
      })
    })

    it('should filter by category', async () => {
      await act(async () => {
        render(<TemplateManager />)
      })

      // Wait for initial load
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1)
      })

      // Simulate category filter change
      const categorySelect = screen.getAllByTestId('select')[0]

      await act(async () => {
        fireEvent.click(categorySelect)
      })

      // Should trigger search with category parameter
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('category=test-value'),
          undefined
        )
      })
    })

    it('should filter by status', async () => {
      await act(async () => {
        render(<TemplateManager />)
      })

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1)
      })

      // Simulate status filter change
      const statusSelect = screen.getAllByTestId('select')[1]

      await act(async () => {
        fireEvent.click(statusSelect)
      })

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('status=test-value'),
          undefined
        )
      })
    })

    it('should change sort order', async () => {
      await act(async () => {
        render(<TemplateManager />)
      })

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1)
      })

      // Find sort order button (↓ or ↑)
      const sortOrderButton = screen.getByText('↓')

      await act(async () => {
        fireEvent.click(sortOrderButton)
      })

      // Should trigger search with asc sort order
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('sort_order=asc'),
          undefined
        )
      })
    })

    it('should combine multiple filters', async () => {
      const user = userEvent.setup()

      await act(async () => {
        render(<TemplateManager />)
      })

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1)
      })

      // Apply search query
      const searchInput = screen.getByPlaceholderText('Search templates...')
      await act(async () => {
        await user.type(searchInput, 'policy')
      })

      // Apply category filter
      const categorySelect = screen.getAllByTestId('select')[0]
      await act(async () => {
        fireEvent.click(categorySelect)
      })

      // Should include both query and category parameters
      await waitFor(() => {
        const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1]
        expect(lastCall[0]).toContain('query=policy')
        expect(lastCall[0]).toContain('category=test-value')
      })
    })
  })

  describe('View Mode Integration', () => {
    it('should switch between grid and list view modes', async () => {
      await act(async () => {
        render(<TemplateManager />)
      })

      await waitFor(() => {
        expect(screen.getByText('Governance Policy Template')).toBeInTheDocument()
      })

      // Initially should be in grid mode
      const gridButton = screen.getByRole('button', { name: /grid/i })
      const listButton = screen.getByRole('button', { name: /list/i })

      expect(gridButton).toHaveAttribute('data-variant', 'default')
      expect(listButton).toHaveAttribute('data-variant', 'ghost')

      // Switch to list mode
      await act(async () => {
        fireEvent.click(listButton)
      })

      expect(listButton).toHaveAttribute('data-variant', 'default')
      expect(gridButton).toHaveAttribute('data-variant', 'ghost')
    })

    it('should render templates differently in grid vs list mode', async () => {
      await act(async () => {
        render(<TemplateManager />)
      })

      await waitFor(() => {
        expect(screen.getByText('Governance Policy Template')).toBeInTheDocument()
      })

      // In grid mode, should see usage count in card format
      expect(screen.getByText('Used 15 times')).toBeInTheDocument()

      // Switch to list mode
      const listButton = screen.getByRole('button', { name: /list/i })
      await act(async () => {
        fireEvent.click(listButton)
      })

      // Should still see usage count but in different format
      expect(screen.getByText('Used 15 times')).toBeInTheDocument()
    })
  })

  describe('Template Actions Integration', () => {
    it('should handle template view action', async () => {
      await act(async () => {
        render(<TemplateManager />)
      })

      await waitFor(() => {
        expect(screen.getByText('Governance Policy Template')).toBeInTheDocument()
      })

      // Find and click view button (Eye icon)
      const viewButtons = screen.getAllByRole('button')
      const viewButton = viewButtons.find(btn => btn.innerHTML.includes('eye'))

      if (viewButton) {
        await act(async () => {
          fireEvent.click(viewButton)
        })

        expect(mockLocation.href).toBe('/templates/template-1')
      }
    })

    it('should handle template edit action', async () => {
      await act(async () => {
        render(<TemplateManager />)
      })

      await waitFor(() => {
        expect(screen.getByText('Governance Policy Template')).toBeInTheDocument()
      })

      // Find and click edit button
      const editButtons = screen.getAllByRole('button')
      const editButton = editButtons.find(btn => btn.innerHTML.includes('edit'))

      if (editButton) {
        await act(async () => {
          fireEvent.click(editButton)
        })

        expect(mockLocation.href).toBe('/templates/template-1/edit')
      }
    })

    it('should handle template delete action with confirmation', async () => {
      // Mock successful delete
      mockFetch.mockResolvedValueOnce({
        ok: true
      })

      // Mock refresh after delete
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockTemplatesData,
          templates: mockTemplatesData.templates.slice(1) // Remove first template
        })
      })

      await act(async () => {
        render(<TemplateManager />)
      })

      await waitFor(() => {
        expect(screen.getByText('Governance Policy Template')).toBeInTheDocument()
      })

      // Find and click delete button
      const deleteButtons = screen.getAllByRole('button')
      const deleteButton = deleteButtons.find(btn => btn.innerHTML.includes('trash'))

      if (deleteButton) {
        await act(async () => {
          fireEvent.click(deleteButton)
        })

        // Should call confirm
        expect(global.confirm).toHaveBeenCalledWith('Are you sure you want to delete this template?')

        // Should call delete API
        await waitFor(() => {
          expect(mockFetch).toHaveBeenCalledWith('/api/v1/templates/template-1', {
            method: 'DELETE'
          })
        })

        // Should refresh the list
        expect(mockFetch).toHaveBeenCalledTimes(3) // initial + delete + refresh
      }
    })

    it('should handle template publish action', async () => {
      // Mock successful publish
      mockFetch.mockResolvedValueOnce({
        ok: true
      })

      // Mock refresh after publish
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTemplatesData
      })

      await act(async () => {
        render(<TemplateManager />)
      })

      await waitFor(() => {
        expect(screen.getByText('Meeting Minutes Template')).toBeInTheDocument()
      })

      // Find publish button (should only exist for draft templates)
      const publishButton = screen.getByText('Publish')

      await act(async () => {
        fireEvent.click(publishButton)
      })

      // Should call publish API
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/v1/templates/template-2/publish', {
          method: 'POST'
        })
      })

      // Should refresh the list
      expect(mockFetch).toHaveBeenCalledTimes(3) // initial + publish + refresh
    })

    it('should not show publish button for published templates', async () => {
      await act(async () => {
        render(<TemplateManager />)
      })

      await waitFor(() => {
        expect(screen.getByText('Governance Policy Template')).toBeInTheDocument()
      })

      // Published templates should not have publish button
      const publishButtons = screen.queryAllByText('Publish')
      expect(publishButtons).toHaveLength(1) // Only the draft template should have it
    })
  })

  describe('Pagination Integration', () => {
    it('should show pagination when multiple pages exist', async () => {
      const paginatedData = {
        ...mockTemplatesData,
        total: 24,
        total_pages: 2,
        has_next: true
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => paginatedData
      })

      await act(async () => {
        render(<TemplateManager />)
      })

      await waitFor(() => {
        expect(screen.getByText('Previous')).toBeInTheDocument()
        expect(screen.getByText('Next')).toBeInTheDocument()
        expect(screen.getByText('1')).toBeInTheDocument()
        expect(screen.getByText('2')).toBeInTheDocument()
      })
    })

    it('should handle page navigation', async () => {
      const paginatedData = {
        ...mockTemplatesData,
        total: 24,
        total_pages: 2,
        has_next: true
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => paginatedData
      })

      await act(async () => {
        render(<TemplateManager />)
      })

      await waitFor(() => {
        expect(screen.getByText('Next')).toBeInTheDocument()
      })

      const nextButton = screen.getByText('Next')

      await act(async () => {
        fireEvent.click(nextButton)
      })

      // Should call API with page=2
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('page=2'),
          undefined
        )
      })
    })

    it('should disable pagination buttons appropriately', async () => {
      const firstPageData = {
        ...mockTemplatesData,
        page: 1,
        total_pages: 3,
        has_next: true,
        has_prev: false
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => firstPageData
      })

      await act(async () => {
        render(<TemplateManager />)
      })

      await waitFor(() => {
        const prevButton = screen.getByText('Previous')
        const nextButton = screen.getByText('Next')

        expect(prevButton).toBeDisabled()
        expect(nextButton).not.toBeDisabled()
      })
    })
  })

  describe('Create Template Dialog Integration', () => {
    it('should open create template dialog', async () => {
      await act(async () => {
        render(<TemplateManager />)
      })

      const createButton = screen.getByText('Create Template')

      await act(async () => {
        fireEvent.click(createButton)
      })

      expect(screen.getByTestId('dialog')).toHaveAttribute('data-open', 'true')
      expect(screen.getByText('Create New Template')).toBeInTheDocument()
      expect(screen.getByText('Start from scratch')).toBeInTheDocument()
      expect(screen.getByText('Create from existing document')).toBeInTheDocument()
    })

    it('should handle create from scratch option', async () => {
      await act(async () => {
        render(<TemplateManager />)
      })

      const createButton = screen.getByText('Create Template')
      await act(async () => {
        fireEvent.click(createButton)
      })

      const fromScratchButton = screen.getByText('Start from scratch')
      await act(async () => {
        fireEvent.click(fromScratchButton)
      })

      expect(mockLocation.href).toBe('/templates/create')
    })

    it('should handle create from document option', async () => {
      await act(async () => {
        render(<TemplateManager />)
      })

      const createButton = screen.getByText('Create Template')
      await act(async () => {
        fireEvent.click(createButton)
      })

      const fromDocButton = screen.getByText('Create from existing document')
      await act(async () => {
        fireEvent.click(fromDocButton)
      })

      expect(mockLocation.href).toBe('/templates/create-from-document')
    })
  })

  describe('Empty State Integration', () => {
    it('should show empty state when no templates found', async () => {
      const emptyData = {
        templates: [],
        total: 0,
        page: 1,
        limit: 12,
        total_pages: 0,
        has_next: false,
        has_prev: false
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => emptyData
      })

      await act(async () => {
        render(<TemplateManager />)
      })

      await waitFor(() => {
        expect(screen.getByText('No templates found')).toBeInTheDocument()
        expect(screen.getByText('Get started by creating your first document template')).toBeInTheDocument()
      })

      // Should have create button in empty state
      const createButtons = screen.getAllByText('Create Template')
      expect(createButtons.length).toBeGreaterThan(1)
    })
  })

  describe('Error Handling Integration', () => {
    it('should handle API fetch errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      mockFetch.mockRejectedValue(new Error('Network error'))

      await act(async () => {
        render(<TemplateManager />)
      })

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to search templates:', expect.any(Error))
      })

      // Should stop loading even on error
      expect(screen.queryByRole('generic', { hidden: true })).not.toBeInTheDocument()

      consoleSpy.mockRestore()
    })

    it('should handle delete errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      // Initial load succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTemplatesData
      })

      // Delete fails
      mockFetch.mockRejectedValueOnce(new Error('Delete failed'))

      await act(async () => {
        render(<TemplateManager />)
      })

      await waitFor(() => {
        expect(screen.getByText('Governance Policy Template')).toBeInTheDocument()
      })

      const deleteButtons = screen.getAllByRole('button')
      const deleteButton = deleteButtons.find(btn => btn.innerHTML.includes('trash'))

      if (deleteButton) {
        await act(async () => {
          fireEvent.click(deleteButton)
        })

        await waitFor(() => {
          expect(consoleSpy).toHaveBeenCalledWith('Failed to delete template:', expect.any(Error))
        })
      }

      consoleSpy.mockRestore()
    })
  })

  describe('Badge and Status Integration', () => {
    it('should display correct category and status badges', async () => {
      await act(async () => {
        render(<TemplateManager />)
      })

      await waitFor(() => {
        expect(screen.getByText('governance')).toBeInTheDocument()
        expect(screen.getByText('published')).toBeInTheDocument()
        expect(screen.getByText('meeting')).toBeInTheDocument()
        expect(screen.getByText('draft')).toBeInTheDocument()
        expect(screen.getByText('financial')).toBeInTheDocument()
      })
    })

    it('should display template tags', async () => {
      await act(async () => {
        render(<TemplateManager />)
      })

      await waitFor(() => {
        // Should show first 3 tags
        expect(screen.getByText('policy')).toBeInTheDocument()
        expect(screen.getByText('governance')).toBeInTheDocument()
        expect(screen.getByText('standard')).toBeInTheDocument()
      })
    })

    it('should show additional tag count when more than 3 tags', async () => {
      const templateWithManyTags = {
        ...mockTemplatesData.templates[0],
        tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5']
      }

      const dataWithManyTags = {
        ...mockTemplatesData,
        templates: [templateWithManyTags, ...mockTemplatesData.templates.slice(1)]
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => dataWithManyTags
      })

      await act(async () => {
        render(<TemplateManager />)
      })

      await waitFor(() => {
        expect(screen.getByText('+2')).toBeInTheDocument() // +2 for remaining tags
      })
    })
  })
})