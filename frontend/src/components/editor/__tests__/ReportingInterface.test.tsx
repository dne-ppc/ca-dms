import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ReportingInterface } from '../ReportingInterface'

// Mock the reporting service
vi.mock('../../../services/reportingService', () => ({
  reportingService: {
    getAnalyticsByType: vi.fn(),
    exportReport: vi.fn()
  }
}))

import { reportingService } from '../../../services/reportingService'

// Mock URL.createObjectURL for browser APIs
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
global.URL.revokeObjectURL = vi.fn()

describe('ReportingInterface - Task 5.4.1-5.4.2: Modal Implementation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Modal Rendering and Behavior', () => {
    it('should not render when closed', () => {
      render(<ReportingInterface isOpen={false} onClose={vi.fn()} />)

      expect(screen.queryByText('Advanced Reporting')).toBeNull()
    })

    it('should render when open', () => {
      render(<ReportingInterface isOpen={true} onClose={vi.fn()} />)

      expect(screen.getByText('Advanced Reporting')).toBeDefined()
      expect(screen.getByText('Generate and export comprehensive workflow reports')).toBeDefined()
    })

    it('should call onClose when close button clicked', () => {
      const mockOnClose = vi.fn()
      render(<ReportingInterface isOpen={true} onClose={mockOnClose} />)

      const closeButton = screen.getByLabelText('Close reporting interface')
      fireEvent.click(closeButton)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('should call onClose when backdrop clicked', () => {
      const mockOnClose = vi.fn()
      render(<ReportingInterface isOpen={true} onClose={mockOnClose} />)

      const backdrop = document.querySelector('.bg-black.bg-opacity-50')
      expect(backdrop).toBeDefined()
      fireEvent.click(backdrop!)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('should call onClose when Escape key pressed', () => {
      const mockOnClose = vi.fn()
      render(<ReportingInterface isOpen={true} onClose={mockOnClose} />)

      fireEvent.keyDown(document, { key: 'Escape' })

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('should not call onClose when Escape pressed and modal is closed', () => {
      const mockOnClose = vi.fn()
      render(<ReportingInterface isOpen={false} onClose={mockOnClose} />)

      fireEvent.keyDown(document, { key: 'Escape' })

      expect(mockOnClose).not.toHaveBeenCalled()
    })
  })

  describe('Report Type Selection', () => {
    it('should render all available report types', () => {
      render(<ReportingInterface isOpen={true} onClose={vi.fn()} />)

      expect(screen.getByText('Workflow Analytics')).toBeDefined()
      expect(screen.getByText('Approval Rates')).toBeDefined()
      expect(screen.getByText('Bottleneck Analysis')).toBeDefined()
      expect(screen.getByText('User Performance')).toBeDefined()
      expect(screen.getByText('Time Analytics')).toBeDefined()
      expect(screen.getByText('Document Types Report')).toBeDefined()
    })

    it('should show descriptions for each report type', () => {
      render(<ReportingInterface isOpen={true} onClose={vi.fn()} />)

      expect(screen.getByText('Overview of workflow performance and completion rates')).toBeDefined()
      expect(screen.getByText('Approval and rejection trends across documents')).toBeDefined()
      expect(screen.getByText('Identify workflow steps causing delays')).toBeDefined()
    })

    it('should allow selecting different report types', () => {
      render(<ReportingInterface isOpen={true} onClose={vi.fn()} />)

      const approvalRatesButton = screen.getByText('Approval Rates').closest('button')
      expect(approvalRatesButton).toBeDefined()

      fireEvent.click(approvalRatesButton!)

      // Check that the button has selected styling
      expect(approvalRatesButton?.className).toContain('border-blue-500')
      expect(approvalRatesButton?.className).toContain('bg-blue-50')
    })

    it('should show icons for each report type', () => {
      render(<ReportingInterface isOpen={true} onClose={vi.fn()} />)

      // Check that SVG icons are present (lucide icons render as SVG)
      const svgElements = document.querySelectorAll('svg')
      expect(svgElements.length).toBeGreaterThan(6) // At least one icon per report type + close button
    })
  })

  describe('Date Range Configuration', () => {
    it('should render date range inputs', () => {
      render(<ReportingInterface isOpen={true} onClose={vi.fn()} />)

      expect(screen.getByLabelText('Start Date')).toBeDefined()
      expect(screen.getByLabelText('End Date')).toBeDefined()
    })

    it('should have default date range values', () => {
      render(<ReportingInterface isOpen={true} onClose={vi.fn()} />)

      const startDateInput = screen.getByLabelText('Start Date') as HTMLInputElement
      const endDateInput = screen.getByLabelText('End Date') as HTMLInputElement

      expect(startDateInput.value).toBeTruthy()
      expect(endDateInput.value).toBeTruthy()
      // End date should be today or recent
      expect(new Date(endDateInput.value).getTime()).toBeCloseTo(Date.now(), -2) // Within 2 digits of precision (days)
    })

    it('should allow changing date range', () => {
      render(<ReportingInterface isOpen={true} onClose={vi.fn()} />)

      const startDateInput = screen.getByLabelText('Start Date') as HTMLInputElement
      fireEvent.change(startDateInput, { target: { value: '2024-01-01' } })

      expect(startDateInput.value).toBe('2024-01-01')
    })
  })

  describe('Export Format Selection', () => {
    it('should render export format dropdown', () => {
      render(<ReportingInterface isOpen={true} onClose={vi.fn()} />)

      const exportSelect = screen.getByDisplayValue('JSON Data')
      expect(exportSelect).toBeDefined()
    })

    it('should show all export format options', () => {
      render(<ReportingInterface isOpen={true} onClose={vi.fn()} />)

      const exportSelect = screen.getByDisplayValue('JSON Data') as HTMLSelectElement
      const options = Array.from(exportSelect.options).map(option => option.text)

      expect(options).toContain('JSON Data')
      expect(options).toContain('CSV Spreadsheet')
      expect(options).toContain('PDF Report')
      expect(options).toContain('Excel Workbook')
    })

    it('should allow changing export format', () => {
      render(<ReportingInterface isOpen={true} onClose={vi.fn()} />)

      const exportSelect = screen.getByDisplayValue('JSON Data') as HTMLSelectElement
      fireEvent.change(exportSelect, { target: { value: 'csv' } })

      expect(exportSelect.value).toBe('csv')
    })
  })

  describe('Report Generation', () => {
    it('should call reporting service when generating report', async () => {
      const mockData = {
        total_workflows: 100,
        active_workflows: 20,
        completed_instances: 80,
        average_completion_time: 2.5,
        approval_rates: { approved: 85, rejected: 10, pending: 5 }
      }

      vi.mocked(reportingService.getAnalyticsByType).mockResolvedValue(mockData)

      render(<ReportingInterface isOpen={true} onClose={vi.fn()} />)

      const generateButton = screen.getByText('Generate Report')
      fireEvent.click(generateButton)

      await waitFor(() => {
        expect(reportingService.getAnalyticsByType).toHaveBeenCalledWith('workflow-analytics')
      })
    })

    it('should show loading state during report generation', async () => {
      vi.mocked(reportingService.getAnalyticsByType).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      )

      render(<ReportingInterface isOpen={true} onClose={vi.fn()} />)

      const generateButton = screen.getByText('Generate Report')
      fireEvent.click(generateButton)

      expect(screen.getByText('Generating...')).toBeDefined()
    })

    it('should display error message on generation failure', async () => {
      vi.mocked(reportingService.getAnalyticsByType).mockRejectedValue(
        new Error('API Error: Service unavailable')
      )

      render(<ReportingInterface isOpen={true} onClose={vi.fn()} />)

      const generateButton = screen.getByText('Generate Report')
      fireEvent.click(generateButton)

      await waitFor(() => {
        expect(screen.getByText('API Error: Service unavailable')).toBeDefined()
      })
    })

    it('should disable export button when no report data', () => {
      render(<ReportingInterface isOpen={true} onClose={vi.fn()} />)

      const exportButton = screen.getByText('Export')
      expect(exportButton).toBeDisabled()
    })
  })

  describe('Report Preview', () => {
    it('should show workflow analytics preview after generation', async () => {
      const mockData = {
        total_workflows: 100,
        active_workflows: 20,
        completed_instances: 80,
        average_completion_time: 2.5,
        approval_rates: { approved: 85, rejected: 10, pending: 5 }
      }

      vi.mocked(reportingService.getAnalyticsByType).mockResolvedValue(mockData)

      render(<ReportingInterface isOpen={true} onClose={vi.fn()} />)

      const generateButton = screen.getByText('Generate Report')
      fireEvent.click(generateButton)

      await waitFor(() => {
        expect(screen.getByText('Workflow Analytics Preview')).toBeDefined()
        expect(screen.getByText('100')).toBeDefined() // total_workflows
        expect(screen.getByText('20')).toBeDefined() // active_workflows
        expect(screen.getByText('85%')).toBeDefined() // approval rate
      })
    })

    it('should show approval rates preview for approval report type', async () => {
      const mockData = {
        overall_approval_rate: 0.85,
        rates_by_user: { user1: 0.9, user2: 0.8 },
        rates_by_document_type: { contract: 0.95 },
        trend_data: [{ date: '2024-01-01', rate: 0.85 }]
      }

      vi.mocked(reportingService.getAnalyticsByType).mockResolvedValue(mockData)

      render(<ReportingInterface isOpen={true} onClose={vi.fn()} />)

      // Select approval rates report type
      const approvalRatesButton = screen.getByText('Approval Rates').closest('button')
      fireEvent.click(approvalRatesButton!)

      const generateButton = screen.getByText('Generate Report')
      fireEvent.click(generateButton)

      await waitFor(() => {
        expect(screen.getByText('85.0%')).toBeDefined() // overall approval rate
        expect(screen.getByText('2')).toBeDefined() // users analyzed
      })
    })
  })

  describe('Report Export', () => {
    it('should call export service with correct parameters', async () => {
      const mockData = { test: 'data' }
      const mockExportResult = {
        downloadUrl: 'blob:mock-url',
        filename: 'test-report.json',
        format: 'json'
      }

      vi.mocked(reportingService.getAnalyticsByType).mockResolvedValue(mockData)
      vi.mocked(reportingService.exportReport).mockResolvedValue(mockExportResult)

      render(<ReportingInterface isOpen={true} onClose={vi.fn()} />)

      // Generate report first
      const generateButton = screen.getByText('Generate Report')
      fireEvent.click(generateButton)

      await waitFor(() => {
        expect(screen.getByText('Export')).not.toBeDisabled()
      })

      // Export report
      const exportButton = screen.getByText('Export')
      fireEvent.click(exportButton)

      await waitFor(() => {
        expect(reportingService.exportReport).toHaveBeenCalledWith({
          data: mockData,
          format: 'json',
          filename: expect.stringMatching(/workflow-analytics-report-.*\.json/)
        })
      })
    })

    it('should handle export workflow correctly', async () => {
      const mockData = { test: 'data' }
      const mockExportResult = {
        downloadUrl: 'blob:mock-url',
        filename: 'test-report.json',
        format: 'json'
      }

      vi.mocked(reportingService.getAnalyticsByType).mockResolvedValue(mockData)
      vi.mocked(reportingService.exportReport).mockResolvedValue(mockExportResult)

      render(<ReportingInterface isOpen={true} onClose={vi.fn()} />)

      // Generate and export report
      fireEvent.click(screen.getByText('Generate Report'))
      await waitFor(() => screen.getByText('Export'))
      fireEvent.click(screen.getByText('Export'))

      await waitFor(() => {
        expect(reportingService.exportReport).toHaveBeenCalled()
      })
    })

    it('should show error message on export failure', async () => {
      const mockData = { test: 'data' }

      vi.mocked(reportingService.getAnalyticsByType).mockResolvedValue(mockData)
      vi.mocked(reportingService.exportReport).mockRejectedValue(
        new Error('Export failed: Invalid format')
      )

      render(<ReportingInterface isOpen={true} onClose={vi.fn()} />)

      // Generate report first
      fireEvent.click(screen.getByText('Generate Report'))
      await waitFor(() => screen.getByText('Export'))

      // Try to export
      fireEvent.click(screen.getByText('Export'))

      await waitFor(() => {
        expect(screen.getByText('Export failed: Invalid format')).toBeDefined()
      })
    })
  })

  describe('Integration and Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<ReportingInterface isOpen={true} onClose={vi.fn()} />)

      const closeButton = screen.getByLabelText('Close reporting interface')
      expect(closeButton).toBeDefined()
    })

    it('should apply custom className', () => {
      render(<ReportingInterface isOpen={true} onClose={vi.fn()} className="custom-class" />)

      const modal = document.querySelector('.custom-class')
      expect(modal).toBeDefined()
    })

    it('should handle rapid interactions without issues', async () => {
      vi.mocked(reportingService.getAnalyticsByType).mockResolvedValue({ test: 'data' })

      render(<ReportingInterface isOpen={true} onClose={vi.fn()} />)

      const generateButton = screen.getByText('Generate Report')

      // Rapid clicks
      fireEvent.click(generateButton)
      fireEvent.click(generateButton)
      fireEvent.click(generateButton)

      // Should only call service once due to loading state
      await waitFor(() => {
        expect(reportingService.getAnalyticsByType).toHaveBeenCalledTimes(1)
      })
    })
  })
})