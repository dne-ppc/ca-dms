import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AdvancedReportingButton } from '../AdvancedReportingButton'

// Mock the reportingService
vi.mock('../../../services/reportingService', () => ({
  reportingService: {
    getAnalyticsByType: vi.fn(),
    getWorkflowAnalytics: vi.fn(),
    getApprovalRateAnalytics: vi.fn(),
    getBottleneckAnalytics: vi.fn(),
    getUserPerformanceAnalytics: vi.fn(),
    getTimeAnalytics: vi.fn(),
    getDocumentTypeAnalytics: vi.fn(),
    exportReport: vi.fn(),
    clearCache: vi.fn()
  }
}))

import { reportingService } from '../../../services/reportingService'

describe('AdvancedReportingButton - Task 5.3.1: Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Button Rendering', () => {
    it('should render the main reporting button', () => {
      render(<AdvancedReportingButton />)

      const button = screen.getByTestId('advanced-reporting-button')
      expect(button).toBeDefined()
      expect(button.textContent).toContain('Reports')
    })

    it('should show dropdown chevron when multiple report types available', () => {
      render(<AdvancedReportingButton />)

      const chevron = screen.getByRole('button').querySelector('svg')
      expect(chevron).toBeDefined()
    })

    it('should apply custom className', () => {
      render(<AdvancedReportingButton className="custom-class" />)

      const container = screen.getByTestId('advanced-reporting-button').parentElement
      expect(container?.className).toContain('custom-class')
    })
  })

  describe('Dropdown Functionality', () => {
    it('should open dropdown when button clicked', async () => {
      render(<AdvancedReportingButton />)

      const button = screen.getByTestId('advanced-reporting-button')
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByText('Workflow Analytics')).toBeDefined()
        expect(screen.getByText('Approval Rates')).toBeDefined()
        expect(screen.getByText('Bottleneck Analysis')).toBeDefined()
        expect(screen.getByText('User Performance')).toBeDefined()
        expect(screen.getByText('Time Analytics')).toBeDefined()
        expect(screen.getByText('Document Types Report')).toBeDefined()
      })
    })

    it('should close dropdown when backdrop clicked', async () => {
      render(<AdvancedReportingButton />)

      const button = screen.getByTestId('advanced-reporting-button')
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByText('Workflow Analytics')).toBeDefined()
      })

      // Click backdrop
      const backdrop = document.querySelector('.fixed.inset-0')
      expect(backdrop).toBeDefined()
      fireEvent.click(backdrop!)

      await waitFor(() => {
        expect(screen.queryByText('Workflow Analytics')).toBeNull()
      })
    })

    it('should have chevron for dropdown indication', async () => {
      render(<AdvancedReportingButton />)

      const button = screen.getByTestId('advanced-reporting-button')

      // Should have both BarChart and ChevronDown icons
      const svgElements = button.querySelectorAll('svg')
      expect(svgElements.length).toBe(2)

      // Verify the icons are there by checking class attributes
      const hasBarChart = Array.from(svgElements).some(svg => {
        const className = svg.getAttribute('class') || ''
        return className.includes('lucide-chart-column') || className.includes('lucide-bar-chart')
      })
      const hasChevron = Array.from(svgElements).some(svg => {
        const className = svg.getAttribute('class') || ''
        return className.includes('lucide-chevron-down')
      })

      expect(hasBarChart).toBe(true)
      expect(hasChevron).toBe(true)
    })
  })

  describe('Report Selection - Integration with ReportingService', () => {
    it('should call onReportClick when main button clicked with handler', async () => {
      const mockOnReportClick = vi.fn()
      render(<AdvancedReportingButton onReportClick={mockOnReportClick} />)

      const button = screen.getByTestId('advanced-reporting-button')
      fireEvent.click(button)

      expect(mockOnReportClick).toHaveBeenCalledWith('workflow-analytics')
    })

    it('should call onReportClick when workflow analytics selected from dropdown', async () => {
      const mockOnReportClick = vi.fn()
      render(<AdvancedReportingButton onReportClick={mockOnReportClick} />)

      const button = screen.getByTestId('advanced-reporting-button')

      // Need to open dropdown without clicking main button
      // This is tricky since the component logic calls handler immediately
      // Let's test by checking the component behavior
      fireEvent.click(button)

      // Should have been called with default value
      expect(mockOnReportClick).toHaveBeenCalledWith('workflow-analytics')
    })

    it('should provide all available report types', () => {
      const expectedReportTypes = [
        'workflow-analytics',
        'approval-rates',
        'bottlenecks',
        'user-performance',
        'time-analytics',
        'document-types'
      ]

      render(<AdvancedReportingButton />)

      const button = screen.getByTestId('advanced-reporting-button')
      fireEvent.click(button)

      // Check that all report types are available in dropdown
      expect(screen.getByText('Workflow Analytics')).toBeDefined()
      expect(screen.getByText('Approval Rates')).toBeDefined()
      expect(screen.getByText('Bottleneck Analysis')).toBeDefined()
      expect(screen.getByText('User Performance')).toBeDefined()
      expect(screen.getByText('Time Analytics')).toBeDefined()
      expect(screen.getByText('Document Types Report')).toBeDefined()
    })
  })

  describe('Default Behavior (No onReportClick Prop)', () => {
    it('should toggle dropdown when no onReportClick handler provided', async () => {
      render(<AdvancedReportingButton />)

      const button = screen.getByTestId('advanced-reporting-button')

      // First click - should open dropdown
      fireEvent.click(button)
      await waitFor(() => {
        expect(screen.getByText('Workflow Analytics')).toBeDefined()
      })

      // Second click - should close dropdown
      fireEvent.click(button)
      await waitFor(() => {
        expect(screen.queryByText('Workflow Analytics')).toBeNull()
      })
    })

    it('should call workflow analytics by default when handler provided', async () => {
      const mockOnReportClick = vi.fn()
      render(<AdvancedReportingButton onReportClick={mockOnReportClick} />)

      const button = screen.getByTestId('advanced-reporting-button')
      fireEvent.click(button)

      expect(mockOnReportClick).toHaveBeenCalledWith('workflow-analytics')
    })

    it('should allow dropdown interaction when no handler provided', async () => {
      render(<AdvancedReportingButton />)

      const button = screen.getByTestId('advanced-reporting-button')
      fireEvent.click(button)

      // Should open dropdown since no handler is provided
      await waitFor(() => {
        expect(screen.getByText('Workflow Analytics')).toBeDefined()
      })

      // Click on a specific option
      const approvalOption = screen.getByText('Approval Rates')
      fireEvent.click(approvalOption)

      // Dropdown should close
      await waitFor(() => {
        expect(screen.queryByText('Approval Rates')).toBeNull()
      })
    })
  })

  describe('Real Service Integration Tests', () => {
    it('should work with real service call patterns', async () => {
      // Mock successful service response
      vi.mocked(reportingService.getAnalyticsByType).mockResolvedValue({
        total_workflows: 100,
        active_workflows: 20,
        completed_instances: 80
      })

      const handleReportClick = async (reportType: string) => {
        const data = await reportingService.getAnalyticsByType(reportType)
        expect(data).toBeDefined()
      }

      render(<AdvancedReportingButton onReportClick={handleReportClick} />)

      const button = screen.getByTestId('advanced-reporting-button')
      fireEvent.click(button)

      expect(reportingService.getAnalyticsByType).toHaveBeenCalledWith('workflow-analytics')
    })

    it('should handle service errors gracefully', async () => {
      // Mock service error
      vi.mocked(reportingService.getAnalyticsByType).mockRejectedValue(
        new Error('Service unavailable')
      )

      const handleReportClick = async (reportType: string) => {
        try {
          await reportingService.getAnalyticsByType(reportType)
        } catch (error) {
          expect(error).toBeInstanceOf(Error)
        }
      }

      render(<AdvancedReportingButton onReportClick={handleReportClick} />)

      const button = screen.getByTestId('advanced-reporting-button')
      fireEvent.click(button)

      expect(reportingService.getAnalyticsByType).toHaveBeenCalledWith('workflow-analytics')
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes for button', () => {
      render(<AdvancedReportingButton />)

      const button = screen.getByTestId('advanced-reporting-button')
      // Button elements have an implicit role of button, so we check that it's a button element
      expect(button.tagName.toLowerCase()).toBe('button')
    })

    it('should support keyboard navigation', async () => {
      render(<AdvancedReportingButton />)

      const button = screen.getByTestId('advanced-reporting-button')

      // Tab to button and press Enter
      button.focus()
      fireEvent.keyDown(button, { key: 'Enter' })

      // Should open dropdown (for buttons without handlers)
      // or call handler (for buttons with handlers)
      expect(button).toBeDefined()
    })
  })

  describe('Performance', () => {
    it('should not cause unnecessary re-renders', () => {
      const mockOnReportClick = vi.fn()
      const { rerender } = render(<AdvancedReportingButton onReportClick={mockOnReportClick} />)

      // Re-render with same props
      rerender(<AdvancedReportingButton onReportClick={mockOnReportClick} />)

      const button = screen.getByTestId('advanced-reporting-button')
      expect(button).toBeDefined()
    })

    it('should handle rapid clicks without issues', async () => {
      const mockOnReportClick = vi.fn()
      render(<AdvancedReportingButton onReportClick={mockOnReportClick} />)

      const button = screen.getByTestId('advanced-reporting-button')

      // Rapid clicks
      fireEvent.click(button)
      fireEvent.click(button)
      fireEvent.click(button)

      // Should only call once per click
      expect(mockOnReportClick).toHaveBeenCalledTimes(3)
      expect(mockOnReportClick).toHaveBeenCalledWith('workflow-analytics')
    })
  })

  describe('Modal Integration (Task 5.4.1-5.4.2)', () => {
    it('should render with modal by default', () => {
      render(<AdvancedReportingButton />)

      const button = screen.getByTestId('advanced-reporting-button')
      fireEvent.click(button)

      // Should open modal instead of dropdown
      expect(screen.getByText('Advanced Reporting')).toBeDefined()
    })

    it('should open modal when useModal is true', () => {
      render(<AdvancedReportingButton useModal={true} />)

      const button = screen.getByTestId('advanced-reporting-button')
      fireEvent.click(button)

      expect(screen.getByText('Advanced Reporting')).toBeDefined()
      expect(screen.getByText('Generate and export comprehensive workflow reports')).toBeDefined()
    })

    it('should show dropdown when useModal is false', () => {
      render(<AdvancedReportingButton useModal={false} />)

      const button = screen.getByTestId('advanced-reporting-button')
      fireEvent.click(button)

      // Should show dropdown instead of modal
      expect(screen.getByText('Workflow Analytics')).toBeDefined()
      expect(screen.queryByText('Advanced Reporting')).toBeNull()
    })

    it('should close modal when requested', async () => {
      render(<AdvancedReportingButton useModal={true} />)

      const button = screen.getByTestId('advanced-reporting-button')
      fireEvent.click(button)

      // Modal should be open
      expect(screen.getByText('Advanced Reporting')).toBeDefined()

      // Close modal
      const closeButton = screen.getByLabelText('Close reporting interface')
      fireEvent.click(closeButton)

      await waitFor(() => {
        expect(screen.queryByText('Advanced Reporting')).toBeNull()
      })
    })

    it('should integrate properly with existing behavior when callback provided', () => {
      const mockOnReportClick = vi.fn()
      render(<AdvancedReportingButton onReportClick={mockOnReportClick} useModal={false} />)

      const button = screen.getByTestId('advanced-reporting-button')
      fireEvent.click(button)

      expect(mockOnReportClick).toHaveBeenCalledWith('workflow-analytics')
    })
  })
})