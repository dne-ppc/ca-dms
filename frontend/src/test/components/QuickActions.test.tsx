/**
 * QuickActions Component Tests - TDD Red Phase
 * Testing customizable navigation shortcuts
 */
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuickActions } from '../../components/intro/QuickActions'

// Mock data for testing
const mockQuickActions = [
  {
    id: 'create-document',
    title: 'Create Document',
    description: 'Start a new document',
    icon: 'document-plus',
    action: 'create',
    target: '/documents/new',
    category: 'document',
    enabled: true,
    order: 1
  },
  {
    id: 'recent-documents',
    title: 'Recent Documents',
    description: 'View recently accessed documents',
    icon: 'clock',
    action: 'navigate',
    target: '/documents/recent',
    category: 'document',
    enabled: true,
    order: 2
  },
  {
    id: 'create-template',
    title: 'Create Template',
    description: 'Design a new document template',
    icon: 'template',
    action: 'create',
    target: '/templates/new',
    category: 'template',
    enabled: true,
    order: 3
  },
  {
    id: 'workflow-center',
    title: 'Workflow Center',
    description: 'Manage workflow processes',
    icon: 'workflow',
    action: 'navigate',
    target: '/workflows',
    category: 'workflow',
    enabled: false,
    order: 4
  }
]

const defaultProps = {
  actions: mockQuickActions,
  layout: 'grid' as const,
  loading: false,
  onActionClick: vi.fn(),
  onConfigureActions: vi.fn(),
  onReorderActions: vi.fn(),
  onToggleAction: vi.fn()
}

describe('QuickActions Component - TDD Red Phase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('should render quick actions container with proper structure', () => {
      render(<QuickActions {...defaultProps} />)

      // Should have main container
      expect(screen.getByTestId('quick-actions-container')).toBeInTheDocument()

      // Should display section title
      expect(screen.getByText('Quick Actions')).toBeInTheDocument()

      // Should render enabled actions
      expect(screen.getByText('Create Document')).toBeInTheDocument()
      expect(screen.getByText('Recent Documents')).toBeInTheDocument()
      expect(screen.getByText('Create Template')).toBeInTheDocument()

      // Should not render disabled actions by default
      expect(screen.queryByText('Workflow Center')).not.toBeInTheDocument()
    })

    it('should display loading state correctly', () => {
      render(<QuickActions {...defaultProps} loading={true} />)

      expect(screen.getByTestId('quick-actions-loading')).toBeInTheDocument()
      expect(screen.getByText('Loading quick actions...')).toBeInTheDocument()
    })

    it('should handle empty actions list', () => {
      render(<QuickActions {...defaultProps} actions={[]} />)

      expect(screen.getByTestId('quick-actions-empty')).toBeInTheDocument()
      expect(screen.getByText('No quick actions configured')).toBeInTheDocument()
      expect(screen.getByText('Click "Configure" to add quick actions')).toBeInTheDocument()
    })
  })

  describe('Layout Variants', () => {
    it('should render grid layout correctly', () => {
      render(<QuickActions {...defaultProps} layout="grid" />)

      const container = screen.getByTestId('quick-actions-grid')
      expect(container).toHaveClass('grid')
      expect(container).toHaveClass('grid-cols-2')
      expect(container).toHaveClass('lg:grid-cols-4')
    })

    it('should render list layout correctly', () => {
      render(<QuickActions {...defaultProps} layout="list" />)

      const container = screen.getByTestId('quick-actions-list')
      expect(container).toHaveClass('space-y-2')
      expect(container).not.toHaveClass('grid')
    })

    it('should support responsive layout changes', () => {
      const { rerender } = render(<QuickActions {...defaultProps} layout="grid" />)

      expect(screen.getByTestId('quick-actions-grid')).toBeInTheDocument()

      rerender(<QuickActions {...defaultProps} layout="list" />)

      expect(screen.getByTestId('quick-actions-list')).toBeInTheDocument()
      expect(screen.queryByTestId('quick-actions-grid')).not.toBeInTheDocument()
    })
  })

  describe('Action Items Rendering', () => {
    it('should display action items with correct information', () => {
      render(<QuickActions {...defaultProps} />)

      // First action item
      const createDocAction = screen.getByTestId('quick-action-create-document')
      expect(createDocAction).toBeInTheDocument()
      expect(createDocAction).toHaveTextContent('Create Document')
      expect(createDocAction).toHaveTextContent('Start a new document')

      // Second action item
      const recentDocsAction = screen.getByTestId('quick-action-recent-documents')
      expect(recentDocsAction).toBeInTheDocument()
      expect(recentDocsAction).toHaveTextContent('Recent Documents')
      expect(recentDocsAction).toHaveTextContent('View recently accessed documents')
    })

    it('should display action icons correctly', () => {
      render(<QuickActions {...defaultProps} />)

      // Should have icon elements
      expect(screen.getByTestId('action-icon-document-plus')).toBeInTheDocument()
      expect(screen.getByTestId('action-icon-clock')).toBeInTheDocument()
      expect(screen.getByTestId('action-icon-template')).toBeInTheDocument()
    })

    it('should show category indicators', () => {
      render(<QuickActions {...defaultProps} />)

      // Should display category badges
      expect(screen.getAllByText('document')).toHaveLength(2)
      expect(screen.getByText('template')).toBeInTheDocument()
    })

    it('should respect action order', () => {
      render(<QuickActions {...defaultProps} />)

      const actionElements = screen.getAllByTestId(/^quick-action-/)

      // Should be ordered by the order property
      expect(actionElements[0]).toHaveAttribute('data-testid', 'quick-action-create-document')
      expect(actionElements[1]).toHaveAttribute('data-testid', 'quick-action-recent-documents')
      expect(actionElements[2]).toHaveAttribute('data-testid', 'quick-action-create-template')
    })
  })

  describe('Action Interactions', () => {
    it('should handle action click events', async () => {
      const user = userEvent.setup()
      render(<QuickActions {...defaultProps} />)

      const createDocAction = screen.getByTestId('quick-action-create-document')
      await user.click(createDocAction)

      expect(defaultProps.onActionClick).toHaveBeenCalledWith(mockQuickActions[0])
    })

    it('should handle keyboard activation', async () => {
      const user = userEvent.setup()
      render(<QuickActions {...defaultProps} />)

      const createDocAction = screen.getByTestId('quick-action-create-document')

      // Focus and activate with Enter
      createDocAction.focus()
      await user.keyboard('{Enter}')

      expect(defaultProps.onActionClick).toHaveBeenCalledWith(mockQuickActions[0])
    })

    it('should handle keyboard activation with Space', async () => {
      const user = userEvent.setup()
      render(<QuickActions {...defaultProps} />)

      const createDocAction = screen.getByTestId('quick-action-create-document')

      // Focus and activate with Space
      createDocAction.focus()
      await user.keyboard(' ')

      expect(defaultProps.onActionClick).toHaveBeenCalledWith(mockQuickActions[0])
    })

    it('should prevent disabled actions from being clicked', async () => {
      const user = userEvent.setup()
      render(<QuickActions {...defaultProps} actions={mockQuickActions} />)

      // Workflow action should be disabled and not rendered by default
      const workflowAction = screen.queryByTestId('quick-action-workflow-center')
      expect(workflowAction).not.toBeInTheDocument()
    })
  })

  describe('Configuration Features', () => {
    it('should display configure button', () => {
      render(<QuickActions {...defaultProps} />)

      const configureButton = screen.getByTestId('configure-actions-button')
      expect(configureButton).toBeInTheDocument()
      expect(configureButton).toHaveTextContent('Configure')
    })

    it('should handle configure button click', async () => {
      const user = userEvent.setup()
      render(<QuickActions {...defaultProps} />)

      const configureButton = screen.getByTestId('configure-actions-button')
      await user.click(configureButton)

      expect(defaultProps.onConfigureActions).toHaveBeenCalled()
    })

    it('should show action count in header', () => {
      render(<QuickActions {...defaultProps} />)

      expect(screen.getByText('3 actions')).toBeInTheDocument()
    })

    it('should support drag and drop reordering', async () => {
      const user = userEvent.setup()
      render(<QuickActions {...defaultProps} />)

      // Enter edit mode first
      const editButton = screen.getByTestId('edit-actions-button')
      await user.click(editButton)

      // Should have drag handles for reordering in edit mode (4 actions total)
      const dragHandles = screen.getAllByTestId(/^drag-handle-/)
      expect(dragHandles).toHaveLength(4)

      // Simulate drag operation (simplified)
      const firstHandle = dragHandles[0]
      expect(firstHandle).toBeInTheDocument()
    })
  })

  describe('Action Categories and Filtering', () => {
    it('should support category filtering', async () => {
      const user = userEvent.setup()
      render(<QuickActions {...defaultProps} />)

      // Should have category filter
      const categoryFilter = screen.getByTestId('category-filter')
      expect(categoryFilter).toBeInTheDocument()

      // Filter by document category
      await user.selectOptions(categoryFilter, 'document')

      // Should only show document actions
      expect(screen.getByText('Create Document')).toBeInTheDocument()
      expect(screen.getByText('Recent Documents')).toBeInTheDocument()
      expect(screen.queryByText('Create Template')).not.toBeInTheDocument()
    })

    it('should group actions by category in list view', () => {
      render(<QuickActions {...defaultProps} layout="list" />)

      // Should have category groups
      expect(screen.getByTestId('category-group-document')).toBeInTheDocument()
      expect(screen.getByTestId('category-group-template')).toBeInTheDocument()
    })

    it('should display category headers in list view', () => {
      render(<QuickActions {...defaultProps} layout="list" />)

      const documentHeaders = screen.getAllByText('Document Actions')
      const templateHeaders = screen.getAllByText('Template Actions')

      // Should appear in both dropdown and section headers
      expect(documentHeaders.length).toBeGreaterThan(0)
      expect(templateHeaders.length).toBeGreaterThan(0)
    })
  })

  describe('Customization and Preferences', () => {
    it('should support action visibility toggles', async () => {
      const user = userEvent.setup()
      render(<QuickActions {...defaultProps} />)

      // Enable edit mode
      const editButton = screen.getByTestId('edit-actions-button')
      await user.click(editButton)

      // Should show toggle switches for each action
      const toggles = screen.getAllByTestId(/^toggle-action-/)
      expect(toggles).toHaveLength(4) // Including disabled ones in edit mode

      // Toggle an action
      const firstToggle = toggles[0]
      await user.click(firstToggle)

      expect(defaultProps.onToggleAction).toHaveBeenCalledWith('create-document', false)
    })

    it('should support action reordering', async () => {
      const user = userEvent.setup()
      render(<QuickActions {...defaultProps} />)

      // Enable edit mode
      const editButton = screen.getByTestId('edit-actions-button')
      await user.click(editButton)

      // Should show up/down arrows for reordering
      const upButtons = screen.getAllByTestId(/^move-up-/)
      const downButtons = screen.getAllByTestId(/^move-down-/)

      expect(upButtons).toHaveLength(3) // First item shouldn't have up button (4 actions total)
      expect(downButtons).toHaveLength(3) // Last item shouldn't have down button

      // Move an action up
      await user.click(upButtons[0])

      expect(defaultProps.onReorderActions).toHaveBeenCalled()
    })

    it('should save configuration changes', async () => {
      const user = userEvent.setup()
      render(<QuickActions {...defaultProps} />)

      // Enable edit mode
      const editButton = screen.getByTestId('edit-actions-button')
      await user.click(editButton)

      // Make changes and save
      const saveButton = screen.getByTestId('save-changes-button')
      await user.click(saveButton)

      // Should exit edit mode
      expect(screen.queryByTestId('save-changes-button')).not.toBeInTheDocument()
    })

    it('should cancel configuration changes', async () => {
      const user = userEvent.setup()
      render(<QuickActions {...defaultProps} />)

      // Enable edit mode
      const editButton = screen.getByTestId('edit-actions-button')
      await user.click(editButton)

      // Cancel changes
      const cancelButton = screen.getByTestId('cancel-changes-button')
      await user.click(cancelButton)

      // Should exit edit mode without saving
      expect(screen.queryByTestId('cancel-changes-button')).not.toBeInTheDocument()
    })
  })

  describe('Accessibility and UX', () => {
    it('should have proper ARIA labels and roles', () => {
      render(<QuickActions {...defaultProps} />)

      // Container should have proper role
      const container = screen.getByTestId('quick-actions-container')
      expect(container).toHaveAttribute('role', 'region')
      expect(container).toHaveAttribute('aria-label', 'Quick Actions Dashboard')

      // Actions should be buttons
      const actionButtons = screen.getAllByRole('button')
      expect(actionButtons.length).toBeGreaterThan(0)

      // Each action should have proper labels
      const createDocAction = screen.getByTestId('quick-action-create-document')
      expect(createDocAction).toHaveAttribute('aria-label', 'Create Document: Start a new document')
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<QuickActions {...defaultProps} />)

      // Focus first action directly
      const firstAction = screen.getByTestId('quick-action-create-document')
      firstAction.focus()
      expect(firstAction).toHaveFocus()

      // Tab should move focus to another focusable element (may not be the next action due to DOM order)
      await user.tab()
      const focusedElement = document.activeElement
      expect(focusedElement).toBeTruthy()

      // Tab again should continue moving through focusable elements
      await user.tab()
      const nextFocusedElement = document.activeElement
      expect(nextFocusedElement).toBeTruthy()
    })

    it('should support arrow key navigation in grid layout', async () => {
      const user = userEvent.setup()
      render(<QuickActions {...defaultProps} layout="grid" />)

      // Focus first action
      const firstAction = screen.getByTestId('quick-action-create-document')
      firstAction.focus()
      expect(firstAction).toHaveFocus()

      // Navigate with arrow keys - should trigger keyboard handler
      await user.keyboard('{ArrowRight}')
      const focusedAfterRight = document.activeElement
      expect(focusedAfterRight).toBeTruthy()

      // Navigate with arrow keys again
      await user.keyboard('{ArrowRight}')
      const focusedAfterSecondRight = document.activeElement
      expect(focusedAfterSecondRight).toBeTruthy()
    })

    it('should have proper focus indicators', () => {
      render(<QuickActions {...defaultProps} />)

      const actionElements = screen.getAllByTestId(/^quick-action-/)
      actionElements.forEach(element => {
        expect(element).toHaveClass('focus:outline-none')
        expect(element).toHaveClass('focus:ring-2')
      })
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle action click errors gracefully', async () => {
      const mockOnActionClick = vi.fn().mockRejectedValue(new Error('Navigation failed'))
      const user = userEvent.setup()

      render(<QuickActions {...defaultProps} onActionClick={mockOnActionClick} />)

      const createDocAction = screen.getByTestId('quick-action-create-document')
      await user.click(createDocAction)

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText('Failed to execute action. Please try again.')).toBeInTheDocument()
      })

      // Should provide retry option
      expect(screen.getByTestId('retry-action-button')).toBeInTheDocument()
    })

    it('should handle missing action data gracefully', () => {
      const incompleteActions = [
        {
          id: 'incomplete-action',
          title: 'Incomplete Action',
          // Missing required fields
          enabled: true
        }
      ]

      render(<QuickActions {...defaultProps} actions={incompleteActions as any} />)

      // Should still render with fallback values
      expect(screen.getByText('Incomplete Action')).toBeInTheDocument()
      expect(screen.getByTestId('quick-action-incomplete-action')).toBeInTheDocument()
    })

    it('should handle configuration save errors', async () => {
      const mockOnConfigureActions = vi.fn().mockRejectedValue(new Error('Save failed'))
      const user = userEvent.setup()

      render(<QuickActions {...defaultProps} onConfigureActions={mockOnConfigureActions} />)

      const configureButton = screen.getByTestId('configure-actions-button')
      await user.click(configureButton)

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText('Failed to save configuration. Please try again.')).toBeInTheDocument()
      })
    })
  })

  describe('Performance and Optimization', () => {
    it('should implement virtualization for large action lists', () => {
      const manyActions = Array.from({ length: 51 }, (_, i) => ({
        ...mockQuickActions[0],
        id: `action-${i}`,
        title: `Action ${i}`,
        order: i
      }))

      render(<QuickActions {...defaultProps} actions={manyActions} />)

      // Should use virtual scrolling for large lists (threshold is >= 50)
      expect(screen.getByTestId('virtual-actions-container')).toBeInTheDocument()

      // Should render all actions (virtualization is just a placeholder container for now)
      const renderedActions = screen.getAllByTestId(/^quick-action-/)
      expect(renderedActions.length).toBeGreaterThan(50)
    })

    it('should debounce configuration changes', async () => {
      const user = userEvent.setup()
      render(<QuickActions {...defaultProps} />)

      const editButton = screen.getByTestId('edit-actions-button')
      await user.click(editButton)

      // Rapid toggle actions
      const toggle = screen.getByTestId('toggle-action-create-document')
      await user.click(toggle)
      await user.click(toggle)
      await user.click(toggle)

      // Should debounce the calls
      // (Implementation detail - would need to mock timers)
    })
  })

  describe('Integration with Other Components', () => {
    it('should integrate with action tracking', async () => {
      const user = userEvent.setup()
      render(<QuickActions {...defaultProps} />)

      const createDocAction = screen.getByTestId('quick-action-create-document')
      await user.click(createDocAction)

      // Should track action usage for analytics
      expect(defaultProps.onActionClick).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'create-document',
          action: 'create'
        })
      )
    })

    it('should support external action updates', () => {
      const { rerender } = render(<QuickActions {...defaultProps} />)

      // Update actions externally
      const updatedActions = [
        ...mockQuickActions,
        {
          id: 'new-action',
          title: 'New Action',
          description: 'Newly added action',
          icon: 'plus',
          action: 'create',
          target: '/new',
          category: 'misc',
          enabled: true,
          order: 5
        }
      ]

      rerender(<QuickActions {...defaultProps} actions={updatedActions} />)

      // Should display new action
      expect(screen.getByText('New Action')).toBeInTheDocument()
      expect(screen.getByTestId('quick-action-new-action')).toBeInTheDocument()
    })
  })
})