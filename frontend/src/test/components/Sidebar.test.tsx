/**
 * Comprehensive tests for Sidebar component
 * Tests layout, responsiveness, accessibility, and user interactions
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sidebar } from '../../components/layout/Sidebar'

// Mock the keyboard navigation context
const mockRegisterSidebar = jest.fn()
jest.mock('../../contexts/KeyboardNavigationContext', () => ({
  useKeyboardNavigationContext: () => ({
    registerSidebar: mockRegisterSidebar
  })
}))

// Mock CSS imports
jest.mock('../../components/layout/Sidebar.css', () => ({}))

describe('Sidebar Component', () => {
  const defaultProps = {
    children: <div data-testid="sidebar-content">Test Content</div>
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('should render with default props', () => {
      render(<Sidebar {...defaultProps} />)

      expect(screen.getByRole('complementary')).toBeInTheDocument()
      expect(screen.getByText('Controls')).toBeInTheDocument()
      expect(screen.getByTestId('sidebar-content')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /collapse sidebar/i })).toBeInTheDocument()
    })

    it('should render with custom title', () => {
      render(<Sidebar {...defaultProps} title="Custom Title" />)

      expect(screen.getByText('Custom Title')).toBeInTheDocument()
      expect(screen.getByRole('complementary')).toHaveAttribute('aria-label', 'Custom Title')
    })

    it('should render collapsed by default when defaultCollapsed is true', () => {
      render(<Sidebar {...defaultProps} defaultCollapsed={true} />)

      expect(screen.queryByTestId('sidebar-content')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /expand sidebar/i })).toBeInTheDocument()
      expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false')
    })

    it('should render expanded by default when defaultCollapsed is false', () => {
      render(<Sidebar {...defaultProps} defaultCollapsed={false} />)

      expect(screen.getByTestId('sidebar-content')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /collapse sidebar/i })).toBeInTheDocument()
      expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true')
    })
  })

  describe('Toggle Functionality', () => {
    it('should toggle sidebar state when button is clicked', async () => {
      const user = userEvent.setup()
      render(<Sidebar {...defaultProps} />)

      const toggleButton = screen.getByRole('button', { name: /collapse sidebar/i })

      // Initially expanded
      expect(screen.getByTestId('sidebar-content')).toBeInTheDocument()
      expect(toggleButton).toHaveAttribute('aria-expanded', 'true')

      // Click to collapse
      await user.click(toggleButton)

      expect(screen.queryByTestId('sidebar-content')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /expand sidebar/i })).toHaveAttribute('aria-expanded', 'false')

      // Click to expand
      const expandButton = screen.getByRole('button', { name: /expand sidebar/i })
      await user.click(expandButton)

      expect(screen.getByTestId('sidebar-content')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /collapse sidebar/i })).toHaveAttribute('aria-expanded', 'true')
    })

    it('should toggle sidebar state when Enter key is pressed', async () => {
      const user = userEvent.setup()
      render(<Sidebar {...defaultProps} />)

      const toggleButton = screen.getByRole('button', { name: /collapse sidebar/i })
      toggleButton.focus()

      // Initially expanded
      expect(screen.getByTestId('sidebar-content')).toBeInTheDocument()

      // Press Enter to collapse
      await user.keyboard('{Enter}')

      expect(screen.queryByTestId('sidebar-content')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /expand sidebar/i })).toBeInTheDocument()

      // Press Enter to expand
      await user.keyboard('{Enter}')

      expect(screen.getByTestId('sidebar-content')).toBeInTheDocument()
    })

    it('should toggle sidebar state when Space key is pressed', async () => {
      const user = userEvent.setup()
      render(<Sidebar {...defaultProps} />)

      const toggleButton = screen.getByRole('button', { name: /collapse sidebar/i })
      toggleButton.focus()

      // Press Space to collapse
      await user.keyboard(' ')

      expect(screen.queryByTestId('sidebar-content')).not.toBeInTheDocument()

      // Press Space to expand
      const expandButton = screen.getByRole('button', { name: /expand sidebar/i })
      await user.keyboard(' ')

      expect(screen.getByTestId('sidebar-content')).toBeInTheDocument()
    })

    it('should not toggle on other key presses', async () => {
      const user = userEvent.setup()
      render(<Sidebar {...defaultProps} />)

      const toggleButton = screen.getByRole('button', { name: /collapse sidebar/i })
      toggleButton.focus()

      // Press other keys
      await user.keyboard('{Tab}')
      await user.keyboard('{Escape}')
      await user.keyboard('a')

      // Should remain expanded
      expect(screen.getByTestId('sidebar-content')).toBeInTheDocument()
    })
  })

  describe('Mobile Overlay', () => {
    it('should show overlay when sidebar is expanded', () => {
      const { container } = render(<Sidebar {...defaultProps} />)

      const overlay = container.querySelector('.sidebar-overlay')
      expect(overlay).toBeInTheDocument()
    })

    it('should not show overlay when sidebar is collapsed', () => {
      const { container } = render(<Sidebar {...defaultProps} defaultCollapsed={true} />)

      const overlay = container.querySelector('.sidebar-overlay')
      expect(overlay).not.toBeInTheDocument()
    })

    it('should collapse sidebar when overlay is clicked', async () => {
      const user = userEvent.setup()
      const { container } = render(<Sidebar {...defaultProps} />)

      const overlay = container.querySelector('.sidebar-overlay')
      expect(overlay).toBeInTheDocument()
      expect(screen.getByTestId('sidebar-content')).toBeInTheDocument()

      // Click overlay
      await user.click(overlay!)

      expect(screen.queryByTestId('sidebar-content')).not.toBeInTheDocument()
      expect(container.querySelector('.sidebar-overlay')).not.toBeInTheDocument()
    })
  })

  describe('CSS Classes', () => {
    it('should apply collapsed class when collapsed', () => {
      const { container } = render(<Sidebar {...defaultProps} defaultCollapsed={true} />)

      const sidebar = container.querySelector('.sidebar')
      expect(sidebar).toHaveClass('collapsed')
      expect(sidebar).not.toHaveClass('expanded')
    })

    it('should apply expanded class when expanded', () => {
      const { container } = render(<Sidebar {...defaultProps} defaultCollapsed={false} />)

      const sidebar = container.querySelector('.sidebar')
      expect(sidebar).toHaveClass('expanded')
      expect(sidebar).not.toHaveClass('collapsed')
    })

    it('should update classes when toggled', async () => {
      const user = userEvent.setup()
      const { container } = render(<Sidebar {...defaultProps} />)

      const sidebar = container.querySelector('.sidebar')
      const toggleButton = screen.getByRole('button')

      // Initially expanded
      expect(sidebar).toHaveClass('expanded')

      // Toggle to collapsed
      await user.click(toggleButton)

      expect(sidebar).toHaveClass('collapsed')
      expect(sidebar).not.toHaveClass('expanded')

      // Toggle back to expanded
      await user.click(toggleButton)

      expect(sidebar).toHaveClass('expanded')
      expect(sidebar).not.toHaveClass('collapsed')
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<Sidebar {...defaultProps} title="Test Sidebar" />)

      const sidebar = screen.getByRole('complementary')
      const toggleButton = screen.getByRole('button')

      expect(sidebar).toHaveAttribute('aria-label', 'Test Sidebar')
      expect(toggleButton).toHaveAttribute('aria-label', 'Collapse sidebar')
      expect(toggleButton).toHaveAttribute('aria-expanded', 'true')
    })

    it('should update ARIA attributes when toggled', async () => {
      const user = userEvent.setup()
      render(<Sidebar {...defaultProps} />)

      const toggleButton = screen.getByRole('button')

      // Initially expanded
      expect(toggleButton).toHaveAttribute('aria-label', 'Collapse sidebar')
      expect(toggleButton).toHaveAttribute('aria-expanded', 'true')

      // Toggle to collapsed
      await user.click(toggleButton)

      expect(toggleButton).toHaveAttribute('aria-label', 'Expand sidebar')
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false')

      // Toggle back to expanded
      await user.click(toggleButton)

      expect(toggleButton).toHaveAttribute('aria-label', 'Collapse sidebar')
      expect(toggleButton).toHaveAttribute('aria-expanded', 'true')
    })

    it('should be focusable and keyboard navigable', async () => {
      const user = userEvent.setup()
      render(<Sidebar {...defaultProps} />)

      const toggleButton = screen.getByRole('button')

      // Should be focusable
      await user.tab()
      expect(document.activeElement).toBe(toggleButton)

      // Should respond to keyboard activation
      await user.keyboard('{Enter}')
      expect(screen.queryByTestId('sidebar-content')).not.toBeInTheDocument()
    })
  })

  describe('Keyboard Navigation Integration', () => {
    it('should register with keyboard navigation context', () => {
      render(<Sidebar {...defaultProps} />)

      expect(mockRegisterSidebar).toHaveBeenCalledWith(expect.any(HTMLDivElement))
    })

    it('should register only once on mount', () => {
      const { rerender } = render(<Sidebar {...defaultProps} />)

      expect(mockRegisterSidebar).toHaveBeenCalledTimes(1)

      // Rerender with different props
      rerender(<Sidebar {...defaultProps} title="New Title" />)

      // Should not register again
      expect(mockRegisterSidebar).toHaveBeenCalledTimes(1)
    })
  })

  describe('Content Rendering', () => {
    it('should render children content when expanded', () => {
      render(
        <Sidebar {...defaultProps}>
          <div data-testid="child-1">Child 1</div>
          <div data-testid="child-2">Child 2</div>
        </Sidebar>
      )

      expect(screen.getByTestId('child-1')).toBeInTheDocument()
      expect(screen.getByTestId('child-2')).toBeInTheDocument()
    })

    it('should not render children content when collapsed', () => {
      render(
        <Sidebar defaultCollapsed={true}>
          <div data-testid="child-1">Child 1</div>
          <div data-testid="child-2">Child 2</div>
        </Sidebar>
      )

      expect(screen.queryByTestId('child-1')).not.toBeInTheDocument()
      expect(screen.queryByTestId('child-2')).not.toBeInTheDocument()
    })

    it('should handle complex children', () => {
      const ComplexChild = () => (
        <div>
          <h4>Complex Child</h4>
          <ul>
            <li>Item 1</li>
            <li>Item 2</li>
          </ul>
          <button>Action Button</button>
        </div>
      )

      render(
        <Sidebar {...defaultProps}>
          <ComplexChild />
        </Sidebar>
      )

      expect(screen.getByText('Complex Child')).toBeInTheDocument()
      expect(screen.getByText('Item 1')).toBeInTheDocument()
      expect(screen.getByText('Item 2')).toBeInTheDocument()
      expect(screen.getByText('Action Button')).toBeInTheDocument()
    })
  })

  describe('State Management', () => {
    it('should maintain independent state across multiple instances', async () => {
      const user = userEvent.setup()

      render(
        <div>
          <Sidebar title="Sidebar 1">
            <div data-testid="content-1">Content 1</div>
          </Sidebar>
          <Sidebar title="Sidebar 2" defaultCollapsed={true}>
            <div data-testid="content-2">Content 2</div>
          </Sidebar>
        </div>
      )

      // Sidebar 1 should be expanded, Sidebar 2 collapsed
      expect(screen.getByTestId('content-1')).toBeInTheDocument()
      expect(screen.queryByTestId('content-2')).not.toBeInTheDocument()

      // Toggle Sidebar 1
      const toggleButton1 = screen.getByRole('button', { name: /collapse sidebar/i })
      await user.click(toggleButton1)

      // Sidebar 1 should now be collapsed, Sidebar 2 still collapsed
      expect(screen.queryByTestId('content-1')).not.toBeInTheDocument()
      expect(screen.queryByTestId('content-2')).not.toBeInTheDocument()

      // Toggle Sidebar 2
      const toggleButton2 = screen.getByRole('button', { name: /expand sidebar/i })
      await user.click(toggleButton2)

      // Sidebar 1 should be collapsed, Sidebar 2 expanded
      expect(screen.queryByTestId('content-1')).not.toBeInTheDocument()
      expect(screen.getByTestId('content-2')).toBeInTheDocument()
    })

    it('should handle rapid toggle operations', async () => {
      const user = userEvent.setup()
      render(<Sidebar {...defaultProps} />)

      const toggleButton = screen.getByRole('button')

      // Rapid toggles
      for (let i = 0; i < 5; i++) {
        await user.click(toggleButton)
      }

      // Should end up collapsed (started expanded, odd number of clicks)
      expect(screen.queryByTestId('sidebar-content')).not.toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should handle missing keyboard navigation context gracefully', () => {
      // Mock missing context
      jest.doMock('../../contexts/KeyboardNavigationContext', () => ({
        useKeyboardNavigationContext: () => ({
          registerSidebar: undefined
        })
      }))

      expect(() => {
        render(<Sidebar {...defaultProps} />)
      }).not.toThrow()

      expect(screen.getByRole('complementary')).toBeInTheDocument()
    })

    it('should handle null children gracefully', () => {
      render(<Sidebar>{null}</Sidebar>)

      expect(screen.getByRole('complementary')).toBeInTheDocument()
      expect(screen.getByText('Controls')).toBeInTheDocument()
    })

    it('should handle undefined children gracefully', () => {
      render(<Sidebar>{undefined}</Sidebar>)

      expect(screen.getByRole('complementary')).toBeInTheDocument()
      expect(screen.getByText('Controls')).toBeInTheDocument()
    })
  })

  describe('Performance', () => {
    it('should not cause unnecessary re-renders', () => {
      const mockChild = jest.fn(() => <div>Mock Child</div>)
      const MockChild = React.memo(mockChild)

      const { rerender } = render(
        <Sidebar title="Test">
          <MockChild />
        </Sidebar>
      )

      expect(mockChild).toHaveBeenCalledTimes(1)

      // Rerender with same props
      rerender(
        <Sidebar title="Test">
          <MockChild />
        </Sidebar>
      )

      // Child should not re-render
      expect(mockChild).toHaveBeenCalledTimes(1)
    })

    it('should handle large amounts of content efficiently', () => {
      const largeContent = Array.from({ length: 1000 }, (_, i) => (
        <div key={i}>Item {i}</div>
      ))

      const start = performance.now()
      render(<Sidebar>{largeContent}</Sidebar>)
      const end = performance.now()

      // Should render within reasonable time
      expect(end - start).toBeLessThan(100)
    })
  })
})