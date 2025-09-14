/**
 * ActionableItems Priority System Tests - TDD Red Phase
 * Testing enhanced visual priority indicators
 */
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActionableItems, ActionableItem } from '../../components/intro/ActionableItems'

// Mock data with various priority combinations
const mockActionableItems: ActionableItem[] = [
  {
    id: 'critical-task',
    type: 'approval',
    title: 'Critical Budget Approval',
    description: 'Urgent budget approval required for Q4',
    priority: 'high',
    urgency: 'overdue',
    deadline: new Date('2025-01-01'),
    assignedTo: 'manager@company.com',
    documentId: 'doc-001',
    workflowId: 'wf-001',
    createdAt: new Date('2024-12-01'),
    metadata: {
      documentType: 'budget',
      requiredBy: 'Finance Director',
      estimatedTime: 30
    }
  },
  {
    id: 'high-priority-review',
    type: 'review',
    title: 'Contract Review',
    description: 'Review vendor contract terms',
    priority: 'high',
    urgency: 'due_soon',
    deadline: new Date('2025-01-15'),
    assignedTo: 'legal@company.com',
    documentId: 'doc-002',
    workflowId: 'wf-002',
    createdAt: new Date('2024-12-05'),
    metadata: {
      documentType: 'contract',
      requiredBy: 'Legal Team',
      estimatedTime: 45
    }
  },
  {
    id: 'medium-signature',
    type: 'signature',
    title: 'Policy Update Signature',
    description: 'Sign updated company policy',
    priority: 'medium',
    urgency: 'normal',
    deadline: new Date('2025-02-01'),
    assignedTo: 'hr@company.com',
    documentId: 'doc-003',
    createdAt: new Date('2024-12-10'),
    metadata: {
      documentType: 'policy',
      estimatedTime: 10
    }
  },
  {
    id: 'low-priority-task',
    type: 'task',
    title: 'Quarterly Report Review',
    description: 'Review quarterly performance metrics',
    priority: 'low',
    urgency: 'normal',
    deadline: new Date('2025-03-01'),
    assignedTo: 'analyst@company.com',
    documentId: 'doc-004',
    createdAt: new Date('2024-12-12'),
    metadata: {
      documentType: 'report',
      estimatedTime: 20
    }
  }
]

const defaultProps = {
  items: mockActionableItems,
  loading: false,
  onItemClick: vi.fn(),
  onActionComplete: vi.fn(),
  onPriorityChange: vi.fn()
}

describe('ActionableItems Priority System - TDD Red Phase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Enhanced Priority Visualization', () => {
    it('should display enhanced priority indicators with visual hierarchy', () => {
      render(<ActionableItems {...defaultProps} />)

      // High priority items should have enhanced visual treatment
      const highPriorityItem = screen.getByTestId('actionable-item-critical-task')
      expect(highPriorityItem).toBeInTheDocument()

      // Should have priority indicator with enhanced styling
      const priorityIndicator = screen.getByTestId('priority-indicator-critical-task')
      expect(priorityIndicator).toBeInTheDocument()
      expect(priorityIndicator).toHaveClass('priority-high')
    })

    it('should show priority levels with distinct visual treatments', () => {
      render(<ActionableItems {...defaultProps} />)

      // High priority should be visually distinct
      const highPriorityIndicator = screen.getByTestId('priority-indicator-critical-task')
      expect(highPriorityIndicator).toHaveClass('bg-red-500', 'text-white')

      // Medium priority should have medium visual treatment
      const mediumPriorityIndicator = screen.getByTestId('priority-indicator-medium-signature')
      expect(mediumPriorityIndicator).toHaveClass('bg-yellow-400', 'text-gray-900')

      // Low priority should have subtle visual treatment
      const lowPriorityIndicator = screen.getByTestId('priority-indicator-low-priority-task')
      expect(lowPriorityIndicator).toHaveClass('bg-green-100', 'text-green-800')
    })

    it('should display priority icons alongside text labels', () => {
      render(<ActionableItems {...defaultProps} />)

      // High priority should have urgent icon
      const highPriorityIcon = screen.getByTestId('priority-icon-critical-task')
      expect(highPriorityIcon).toBeInTheDocument()
      expect(highPriorityIcon).toHaveTextContent('🔥') // Fire icon for high priority

      // Medium priority should have warning icon
      const mediumPriorityIcon = screen.getByTestId('priority-icon-medium-signature')
      expect(mediumPriorityIcon).toBeInTheDocument()
      expect(mediumPriorityIcon).toHaveTextContent('⚠️') // Warning icon for medium priority

      // Low priority should have info icon
      const lowPriorityIcon = screen.getByTestId('priority-icon-low-priority-task')
      expect(lowPriorityIcon).toBeInTheDocument()
      expect(lowPriorityIcon).toHaveTextContent('ℹ️') // Info icon for low priority
    })

    it('should combine priority and urgency for comprehensive visual indicators', () => {
      render(<ActionableItems {...defaultProps} />)

      // Critical item (high priority + overdue) should have maximum visual impact
      const criticalItem = screen.getByTestId('actionable-item-critical-task')
      expect(criticalItem).toHaveClass('border-red-500', 'bg-red-50')

      // High priority + due soon should have strong visual treatment
      const highDueSoonItem = screen.getByTestId('actionable-item-high-priority-review')
      expect(highDueSoonItem).toHaveClass('border-orange-400', 'bg-orange-50')

      // Medium priority + normal urgency should have moderate visual treatment
      const mediumNormalItem = screen.getByTestId('actionable-item-medium-signature')
      expect(mediumNormalItem).toHaveClass('border-yellow-200', 'bg-yellow-50')
    })

    it('should show visual priority ranking with numbers or symbols', () => {
      render(<ActionableItems {...defaultProps} />)

      // Should display priority ranking indicators
      const highPriorityRank = screen.getByTestId('priority-rank-critical-task')
      expect(highPriorityRank).toBeInTheDocument()
      expect(highPriorityRank).toHaveTextContent('1') // Rank 1 for highest priority

      const mediumPriorityRank = screen.getByTestId('priority-rank-medium-signature')
      expect(mediumPriorityRank).toBeInTheDocument()
      expect(mediumPriorityRank).toHaveTextContent('3') // Rank 3 for medium priority

      const lowPriorityRank = screen.getByTestId('priority-rank-low-priority-task')
      expect(lowPriorityRank).toBeInTheDocument()
      expect(lowPriorityRank).toHaveTextContent('4') // Rank 4 for lowest priority
    })

    it('should display priority progress bars or visual weights', () => {
      render(<ActionableItems {...defaultProps} />)

      // High priority should have full intensity progress bar
      const highPriorityBar = screen.getByTestId('priority-bar-critical-task')
      expect(highPriorityBar).toBeInTheDocument()
      expect(highPriorityBar).toHaveClass('w-full', 'bg-red-500')

      // Medium priority should have medium intensity
      const mediumPriorityBar = screen.getByTestId('priority-bar-medium-signature')
      expect(mediumPriorityBar).toBeInTheDocument()
      expect(mediumPriorityBar).toHaveClass('w-3/5', 'bg-yellow-400')

      // Low priority should have minimal intensity
      const lowPriorityBar = screen.getByTestId('priority-bar-low-priority-task')
      expect(lowPriorityBar).toBeInTheDocument()
      expect(lowPriorityBar).toHaveClass('w-1/5', 'bg-green-400')
    })
  })

  describe('Advanced Priority Features', () => {
    it('should support interactive priority change with visual feedback', async () => {
      const user = userEvent.setup()
      render(<ActionableItems {...defaultProps} />)

      // Should have priority change controls
      const priorityDropdown = screen.getByTestId('priority-dropdown-critical-task')
      expect(priorityDropdown).toBeInTheDocument()

      // Change priority
      await user.selectOptions(priorityDropdown, 'medium')

      expect(defaultProps.onPriorityChange).toHaveBeenCalledWith('critical-task', 'medium')
    })

    it('should display priority trend indicators (increased/decreased)', () => {
      const itemsWithTrends = mockActionableItems.map(item => ({
        ...item,
        metadata: {
          ...item.metadata,
          priorityTrend: item.id === 'critical-task' ? 'increased' :
                        item.id === 'medium-signature' ? 'decreased' : 'stable'
        }
      }))

      render(<ActionableItems {...defaultProps} items={itemsWithTrends} />)

      // Should show trend indicators
      const increasedTrend = screen.getByTestId('priority-trend-critical-task')
      expect(increasedTrend).toBeInTheDocument()
      expect(increasedTrend).toHaveClass('text-red-600')
      expect(increasedTrend).toHaveTextContent('↗️') // Upward trend

      const decreasedTrend = screen.getByTestId('priority-trend-medium-signature')
      expect(decreasedTrend).toBeInTheDocument()
      expect(decreasedTrend).toHaveClass('text-green-600')
      expect(decreasedTrend).toHaveTextContent('↘️') // Downward trend
    })

    it('should support priority filtering with enhanced visual controls', async () => {
      const user = userEvent.setup()
      render(<ActionableItems {...defaultProps} />)

      // Should have enhanced priority filter
      const priorityFilter = screen.getByTestId('enhanced-priority-filter')
      expect(priorityFilter).toBeInTheDocument()

      // Should have visual filter buttons with colors
      const highPriorityFilter = screen.getByTestId('filter-priority-high')
      expect(highPriorityFilter).toHaveClass('bg-red-100', 'text-red-800')

      const mediumPriorityFilter = screen.getByTestId('filter-priority-medium')
      expect(mediumPriorityFilter).toHaveClass('bg-yellow-100', 'text-yellow-800')

      const lowPriorityFilter = screen.getByTestId('filter-priority-low')
      expect(lowPriorityFilter).toHaveClass('bg-green-100', 'text-green-800')

      // Filter by high priority
      await user.click(highPriorityFilter)

      // Should only show high priority items
      expect(screen.getByTestId('actionable-item-critical-task')).toBeInTheDocument()
      expect(screen.getByTestId('actionable-item-high-priority-review')).toBeInTheDocument()
      expect(screen.queryByTestId('actionable-item-medium-signature')).not.toBeInTheDocument()
      expect(screen.queryByTestId('actionable-item-low-priority-task')).not.toBeInTheDocument()
    })

    it('should show priority statistics and summary', () => {
      render(<ActionableItems {...defaultProps} />)

      // Should display priority statistics
      const priorityStats = screen.getByTestId('priority-statistics')
      expect(priorityStats).toBeInTheDocument()

      // Should show counts for each priority level
      const highPriorityCount = screen.getByTestId('priority-count-high')
      expect(highPriorityCount).toHaveTextContent('2') // 2 high priority items

      const mediumPriorityCount = screen.getByTestId('priority-count-medium')
      expect(mediumPriorityCount).toHaveTextContent('1') // 1 medium priority item

      const lowPriorityCount = screen.getByTestId('priority-count-low')
      expect(lowPriorityCount).toHaveTextContent('1') // 1 low priority item
    })

    it('should display priority badges with accessibility support', () => {
      render(<ActionableItems {...defaultProps} />)

      // Priority indicators should have proper ARIA labels
      const highPriorityBadge = screen.getByTestId('priority-indicator-critical-task')
      expect(highPriorityBadge).toHaveAttribute('aria-label', 'High priority item')
      expect(highPriorityBadge).toHaveAttribute('role', 'status')

      const mediumPriorityBadge = screen.getByTestId('priority-indicator-medium-signature')
      expect(mediumPriorityBadge).toHaveAttribute('aria-label', 'Medium priority item')
      expect(mediumPriorityBadge).toHaveAttribute('role', 'status')
    })
  })

  describe('Priority Interaction Patterns', () => {
    it('should support bulk priority changes', async () => {
      const user = userEvent.setup()
      render(<ActionableItems {...defaultProps} />)

      // Select multiple items
      const item1Checkbox = screen.getByTestId('select-item-critical-task')
      const item2Checkbox = screen.getByTestId('select-item-medium-signature')

      await user.click(item1Checkbox)
      await user.click(item2Checkbox)

      // Should show bulk priority change option
      const bulkPriorityButton = screen.getByTestId('bulk-priority-change')
      expect(bulkPriorityButton).toBeInTheDocument()

      await user.click(bulkPriorityButton)

      // Should show priority change modal/dropdown
      const bulkPriorityDropdown = screen.getByTestId('bulk-priority-dropdown')
      expect(bulkPriorityDropdown).toBeInTheDocument()
    })

    it('should show priority change confirmation for critical items', async () => {
      const user = userEvent.setup()
      render(<ActionableItems {...defaultProps} />)

      // Try to change high priority item to low
      const priorityDropdown = screen.getByTestId('priority-dropdown-critical-task')
      await user.selectOptions(priorityDropdown, 'low')

      // Should show confirmation modal
      const confirmationModal = screen.getByTestId('priority-change-confirmation')
      expect(confirmationModal).toBeInTheDocument()
      expect(confirmationModal).toHaveTextContent('Are you sure you want to change this critical item to low priority?')
    })

    it('should provide priority change history/audit trail', () => {
      const itemsWithHistory = mockActionableItems.map(item => ({
        ...item,
        metadata: {
          ...item.metadata,
          priorityHistory: [
            { priority: 'medium', changedAt: new Date('2024-12-01'), changedBy: 'user1' },
            { priority: 'high', changedAt: new Date('2024-12-15'), changedBy: 'manager1' }
          ]
        }
      }))

      render(<ActionableItems {...defaultProps} items={itemsWithHistory} />)

      // Should have priority history indicator
      const priorityHistory = screen.getByTestId('priority-history-critical-task')
      expect(priorityHistory).toBeInTheDocument()
      expect(priorityHistory).toHaveAttribute('title', 'Priority changed from medium to high on 12/14/2024 by manager1')
    })

    it('should show priority-based deadline urgency calculations', () => {
      render(<ActionableItems {...defaultProps} />)

      // High priority items should have adjusted deadline urgency
      const criticalDeadline = screen.getByTestId('deadline-urgency-critical-task')
      expect(criticalDeadline).toBeInTheDocument()
      expect(criticalDeadline).toHaveClass('urgency-critical') // Extra urgent due to high priority

      // Medium priority should have standard urgency
      const mediumDeadline = screen.getByTestId('deadline-urgency-medium-signature')
      expect(mediumDeadline).toBeInTheDocument()
      expect(mediumDeadline).toHaveClass('urgency-standard')
    })
  })

  describe('Priority Visual Theming', () => {
    it('should support different priority visualization themes', () => {
      render(<ActionableItems {...defaultProps} />)

      // Should have theme-appropriate priority colors
      const container = screen.getByTestId('actionable-items-container')
      expect(container).toHaveClass('priority-theme-default')

      // Priority indicators should follow theme
      const priorityIndicators = screen.getAllByTestId(/^priority-indicator-/)
      priorityIndicators.forEach(indicator => {
        expect(indicator).toHaveClass('priority-themed')
      })
    })

    it('should adapt priority colors for accessibility (colorblind-friendly)', () => {
      render(<ActionableItems {...defaultProps} />)

      // Should have patterns/shapes in addition to colors for accessibility
      const highPriorityIndicator = screen.getByTestId('priority-indicator-critical-task')
      expect(highPriorityIndicator).toHaveClass('priority-pattern-diagonal') // Pattern for colorblind users

      const mediumPriorityIndicator = screen.getByTestId('priority-indicator-medium-signature')
      expect(mediumPriorityIndicator).toHaveClass('priority-pattern-dots')

      const lowPriorityIndicator = screen.getByTestId('priority-indicator-low-priority-task')
      expect(lowPriorityIndicator).toHaveClass('priority-pattern-solid')
    })

    it('should show priority indicators in dark mode', () => {
      // Mock dark mode
      document.documentElement.classList.add('dark')

      render(<ActionableItems {...defaultProps} />)

      // Priority indicators should adapt to dark mode
      const highPriorityIndicator = screen.getByTestId('priority-indicator-critical-task')
      expect(highPriorityIndicator).toHaveClass('dark:bg-red-600', 'dark:text-red-100')

      // Clean up
      document.documentElement.classList.remove('dark')
    })
  })
})