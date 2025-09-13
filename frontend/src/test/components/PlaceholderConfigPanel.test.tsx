/**
 * Comprehensive tests for PlaceholderConfigPanel component
 * Tests template management, configuration tabs, validation, styling, and import/export
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlaceholderConfigPanel } from '../../components/editor/PlaceholderConfigPanel'

// Mock the CSS imports
jest.mock('../../components/editor/PlaceholderConfigPanel.css', () => ({}))

// Mock external dependencies
const mockOnTemplateSelect = jest.fn()
const mockOnConfigChange = jest.fn()
const mockOnClose = jest.fn()

// Mock template data
const mockTemplates = [
  {
    id: '1',
    name: 'Board Meeting Minutes',
    category: 'meetings',
    placeholders: [
      { type: 'version_table', label: 'Version History' },
      { type: 'signature', label: 'Board President Signature' },
      { type: 'long_response', label: 'Meeting Notes' }
    ]
  },
  {
    id: '2',
    name: 'Annual Report',
    category: 'reports',
    placeholders: [
      { type: 'version_table', label: 'Document Version' },
      { type: 'line_segment', label: 'Report Period' }
    ]
  }
]

const mockConfig = {
  version_table: {
    title: 'Document Version History',
    fields: ['version', 'date', 'author', 'changes'],
    immutable: true
  },
  signature: {
    label: 'Signature',
    required: true,
    includeDate: true,
    includeTitle: true
  },
  long_response: {
    label: 'Response Area',
    placeholder: 'Enter your response...',
    minHeight: 100,
    maxLength: 1000
  },
  line_segment: {
    label: 'Input Field',
    length: 'medium',
    required: false
  }
}

const defaultProps = {
  isOpen: true,
  onClose: mockOnClose,
  onTemplateSelect: mockOnTemplateSelect,
  onConfigChange: mockOnConfigChange,
  templates: mockTemplates,
  config: mockConfig,
  className: ''
}

describe('PlaceholderConfigPanel Component', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    jest.clearAllMocks()
    user = userEvent.setup()
  })

  describe('Basic Rendering', () => {
    it('should render when open', () => {
      render(<PlaceholderConfigPanel {...defaultProps} />)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Placeholder Configuration')).toBeInTheDocument()
    })

    it('should not render when closed', () => {
      render(<PlaceholderConfigPanel {...defaultProps} isOpen={false} />)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('should apply custom className', () => {
      const { container } = render(
        <PlaceholderConfigPanel {...defaultProps} className="custom-class" />
      )

      expect(container.firstChild).toHaveClass('custom-class')
    })

    it('should render close button', () => {
      render(<PlaceholderConfigPanel {...defaultProps} />)

      const closeButton = screen.getByRole('button', { name: /close/i })
      expect(closeButton).toBeInTheDocument()
    })
  })

  describe('Tab Navigation', () => {
    it('should render all tabs', () => {
      render(<PlaceholderConfigPanel {...defaultProps} />)

      expect(screen.getByRole('tab', { name: /templates/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /configuration/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /validation/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /styling/i })).toBeInTheDocument()
    })

    it('should show templates tab as active by default', () => {
      render(<PlaceholderConfigPanel {...defaultProps} />)

      const templatesTab = screen.getByRole('tab', { name: /templates/i })
      expect(templatesTab).toHaveAttribute('aria-selected', 'true')
    })

    it('should switch tabs when clicked', async () => {
      render(<PlaceholderConfigPanel {...defaultProps} />)

      const configTab = screen.getByRole('tab', { name: /configuration/i })
      await user.click(configTab)

      expect(configTab).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByRole('tab', { name: /templates/i })).toHaveAttribute('aria-selected', 'false')
    })

    it('should support keyboard navigation between tabs', async () => {
      render(<PlaceholderConfigPanel {...defaultProps} />)

      const templatesTab = screen.getByRole('tab', { name: /templates/i })
      templatesTab.focus()

      // Arrow right should move to next tab
      await user.keyboard('[ArrowRight]')
      expect(screen.getByRole('tab', { name: /configuration/i })).toHaveFocus()

      // Arrow left should move to previous tab
      await user.keyboard('[ArrowLeft]')
      expect(templatesTab).toHaveFocus()
    })

    it('should activate tab with Enter or Space', async () => {
      render(<PlaceholderConfigPanel {...defaultProps} />)

      const configTab = screen.getByRole('tab', { name: /configuration/i })
      configTab.focus()

      await user.keyboard('[Enter]')
      expect(configTab).toHaveAttribute('aria-selected', 'true')
    })
  })

  describe('Templates Tab', () => {
    it('should display template categories', () => {
      render(<PlaceholderConfigPanel {...defaultProps} />)

      expect(screen.getByText('meetings')).toBeInTheDocument()
      expect(screen.getByText('reports')).toBeInTheDocument()
    })

    it('should display templates under categories', () => {
      render(<PlaceholderConfigPanel {...defaultProps} />)

      expect(screen.getByText('Board Meeting Minutes')).toBeInTheDocument()
      expect(screen.getByText('Annual Report')).toBeInTheDocument()
    })

    it('should show template placeholder count', () => {
      render(<PlaceholderConfigPanel {...defaultProps} />)

      expect(screen.getByText('3 placeholders')).toBeInTheDocument()
      expect(screen.getByText('2 placeholders')).toBeInTheDocument()
    })

    it('should call onTemplateSelect when template is clicked', async () => {
      render(<PlaceholderConfigPanel {...defaultProps} />)

      const template = screen.getByText('Board Meeting Minutes')
      await user.click(template)

      expect(mockOnTemplateSelect).toHaveBeenCalledWith(mockTemplates[0])
    })

    it('should filter templates by search term', async () => {
      render(<PlaceholderConfigPanel {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText(/search templates/i)
      await user.type(searchInput, 'minutes')

      expect(screen.getByText('Board Meeting Minutes')).toBeInTheDocument()
      expect(screen.queryByText('Annual Report')).not.toBeInTheDocument()
    })

    it('should show no results message when search yields no matches', async () => {
      render(<PlaceholderConfigPanel {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText(/search templates/i)
      await user.type(searchInput, 'nonexistent')

      expect(screen.getByText(/no templates found/i)).toBeInTheDocument()
    })

    it('should clear search when clear button is clicked', async () => {
      render(<PlaceholderConfigPanel {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText(/search templates/i)
      await user.type(searchInput, 'minutes')

      const clearButton = screen.getByRole('button', { name: /clear search/i })
      await user.click(clearButton)

      expect(searchInput).toHaveValue('')
      expect(screen.getByText('Annual Report')).toBeInTheDocument()
    })
  })

  describe('Configuration Tab', () => {
    beforeEach(async () => {
      render(<PlaceholderConfigPanel {...defaultProps} />)
      const configTab = screen.getByRole('tab', { name: /configuration/i })
      await user.click(configTab)
    })

    it('should display configuration sections for each placeholder type', () => {
      expect(screen.getByText('Version Table Settings')).toBeInTheDocument()
      expect(screen.getByText('Signature Settings')).toBeInTheDocument()
      expect(screen.getByText('Long Response Settings')).toBeInTheDocument()
      expect(screen.getByText('Line Segment Settings')).toBeInTheDocument()
    })

    it('should display current configuration values', () => {
      expect(screen.getByDisplayValue('Document Version History')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Signature')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Enter your response...')).toBeInTheDocument()
    })

    it('should update configuration when values change', async () => {
      const titleInput = screen.getByDisplayValue('Document Version History')
      await user.clear(titleInput)
      await user.type(titleInput, 'New Version Title')

      expect(mockOnConfigChange).toHaveBeenCalledWith(
        expect.objectContaining({
          version_table: expect.objectContaining({
            title: 'New Version Title'
          })
        })
      )
    })

    it('should handle checkbox changes', async () => {
      const immutableCheckbox = screen.getByRole('checkbox', { name: /immutable/i })
      await user.click(immutableCheckbox)

      expect(mockOnConfigChange).toHaveBeenCalledWith(
        expect.objectContaining({
          version_table: expect.objectContaining({
            immutable: false
          })
        })
      )
    })

    it('should handle select dropdown changes', async () => {
      const lengthSelect = screen.getByDisplayValue('medium')
      await user.selectOptions(lengthSelect, 'long')

      expect(mockOnConfigChange).toHaveBeenCalledWith(
        expect.objectContaining({
          line_segment: expect.objectContaining({
            length: 'long'
          })
        })
      )
    })

    it('should validate numeric inputs', async () => {
      const minHeightInput = screen.getByDisplayValue('100')
      await user.clear(minHeightInput)
      await user.type(minHeightInput, 'invalid')

      // Should revert to valid value or show error
      expect(screen.getByText(/invalid number/i)).toBeInTheDocument()
    })
  })

  describe('Validation Tab', () => {
    beforeEach(async () => {
      render(<PlaceholderConfigPanel {...defaultProps} />)
      const validationTab = screen.getByRole('tab', { name: /validation/i })
      await user.click(validationTab)
    })

    it('should display validation rules for each placeholder type', () => {
      expect(screen.getByText('Version Table Validation')).toBeInTheDocument()
      expect(screen.getByText('Signature Validation')).toBeInTheDocument()
      expect(screen.getByText('Long Response Validation')).toBeInTheDocument()
      expect(screen.getByText('Line Segment Validation')).toBeInTheDocument()
    })

    it('should show required field indicators', () => {
      const requiredLabels = screen.getAllByText('*')
      expect(requiredLabels.length).toBeGreaterThan(0)
    })

    it('should display validation error messages', () => {
      expect(screen.getByText(/minimum height required/i)).toBeInTheDocument()
      expect(screen.getByText(/maximum length must be positive/i)).toBeInTheDocument()
    })

    it('should validate field relationships', () => {
      expect(screen.getByText(/minimum height cannot exceed maximum/i)).toBeInTheDocument()
    })

    it('should show validation status indicators', () => {
      const validIndicators = screen.getAllByText('✓')
      const invalidIndicators = screen.getAllByText('✗')

      expect(validIndicators.length + invalidIndicators.length).toBeGreaterThan(0)
    })
  })

  describe('Styling Tab', () => {
    beforeEach(async () => {
      render(<PlaceholderConfigPanel {...defaultProps} />)
      const stylingTab = screen.getByRole('tab', { name: /styling/i })
      await user.click(stylingTab)
    })

    it('should display style options for each placeholder type', () => {
      expect(screen.getByText('Version Table Styling')).toBeInTheDocument()
      expect(screen.getByText('Signature Styling')).toBeInTheDocument()
      expect(screen.getByText('Long Response Styling')).toBeInTheDocument()
      expect(screen.getByText('Line Segment Styling')).toBeInTheDocument()
    })

    it('should show color pickers', () => {
      const colorInputs = screen.getAllByRole('textbox', { name: /color/i })
      expect(colorInputs.length).toBeGreaterThan(0)
    })

    it('should display font size controls', () => {
      expect(screen.getByLabelText(/font size/i)).toBeInTheDocument()
    })

    it('should show border and padding options', () => {
      expect(screen.getByLabelText(/border width/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/padding/i)).toBeInTheDocument()
    })

    it('should provide style presets', () => {
      expect(screen.getByText('Default')).toBeInTheDocument()
      expect(screen.getByText('Minimal')).toBeInTheDocument()
      expect(screen.getByText('Bold')).toBeInTheDocument()
    })

    it('should update styles when preset is selected', async () => {
      const boldPreset = screen.getByText('Bold')
      await user.click(boldPreset)

      expect(mockOnConfigChange).toHaveBeenCalledWith(
        expect.objectContaining({
          styles: expect.objectContaining({
            preset: 'bold'
          })
        })
      )
    })
  })

  describe('Import/Export Functionality', () => {
    it('should render import button', () => {
      render(<PlaceholderConfigPanel {...defaultProps} />)

      expect(screen.getByRole('button', { name: /import config/i })).toBeInTheDocument()
    })

    it('should render export button', () => {
      render(<PlaceholderConfigPanel {...defaultProps} />)

      expect(screen.getByRole('button', { name: /export config/i })).toBeInTheDocument()
    })

    it('should handle file import', async () => {
      render(<PlaceholderConfigPanel {...defaultProps} />)

      const importButton = screen.getByRole('button', { name: /import config/i })
      await user.click(importButton)

      const fileInput = screen.getByLabelText(/choose file/i)
      expect(fileInput).toBeInTheDocument()
    })

    it('should validate imported file format', async () => {
      render(<PlaceholderConfigPanel {...defaultProps} />)

      const importButton = screen.getByRole('button', { name: /import config/i })
      await user.click(importButton)

      const fileInput = screen.getByLabelText(/choose file/i)
      const invalidFile = new File(['invalid content'], 'invalid.txt', { type: 'text/plain' })

      await user.upload(fileInput, invalidFile)

      expect(screen.getByText(/invalid file format/i)).toBeInTheDocument()
    })

    it('should export configuration as JSON', async () => {
      // Mock URL.createObjectURL
      global.URL.createObjectURL = jest.fn(() => 'mock-url')
      global.URL.revokeObjectURL = jest.fn()

      render(<PlaceholderConfigPanel {...defaultProps} />)

      const exportButton = screen.getByRole('button', { name: /export config/i })
      await user.click(exportButton)

      expect(global.URL.createObjectURL).toHaveBeenCalled()
    })
  })

  describe('Dialog Behavior', () => {
    it('should trap focus within dialog', async () => {
      render(<PlaceholderConfigPanel {...defaultProps} />)

      const dialog = screen.getByRole('dialog')
      const firstFocusable = screen.getByRole('tab', { name: /templates/i })
      const lastFocusable = screen.getByRole('button', { name: /close/i })

      firstFocusable.focus()
      expect(firstFocusable).toHaveFocus()

      // Shift+Tab should cycle to last focusable element
      await user.keyboard('[Shift>][Tab][/Shift]')
      expect(lastFocusable).toHaveFocus()
    })

    it('should close on Escape key', async () => {
      render(<PlaceholderConfigPanel {...defaultProps} />)

      await user.keyboard('[Escape]')
      expect(mockOnClose).toHaveBeenCalled()
    })

    it('should close when close button is clicked', async () => {
      render(<PlaceholderConfigPanel {...defaultProps} />)

      const closeButton = screen.getByRole('button', { name: /close/i })
      await user.click(closeButton)

      expect(mockOnClose).toHaveBeenCalled()
    })

    it('should close when clicking outside dialog', async () => {
      const { container } = render(<PlaceholderConfigPanel {...defaultProps} />)

      // Click on backdrop
      const backdrop = container.querySelector('.backdrop')
      if (backdrop) {
        await user.click(backdrop)
        expect(mockOnClose).toHaveBeenCalled()
      }
    })

    it('should not close when clicking inside dialog', async () => {
      render(<PlaceholderConfigPanel {...defaultProps} />)

      const dialog = screen.getByRole('dialog')
      await user.click(dialog)

      expect(mockOnClose).not.toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<PlaceholderConfigPanel {...defaultProps} />)

      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-modal', 'true')
      expect(dialog).toHaveAttribute('aria-labelledby')
    })

    it('should have accessible tab navigation', () => {
      render(<PlaceholderConfigPanel {...defaultProps} />)

      const tablist = screen.getByRole('tablist')
      expect(tablist).toBeInTheDocument()

      const tabs = screen.getAllByRole('tab')
      tabs.forEach(tab => {
        expect(tab).toHaveAttribute('aria-controls')
        expect(tab).toHaveAttribute('aria-selected')
      })
    })

    it('should provide screen reader announcements', () => {
      render(<PlaceholderConfigPanel {...defaultProps} />)

      const announcements = screen.getByRole('status', { name: /screen reader announcements/i })
      expect(announcements).toBeInTheDocument()
    })

    it('should have proper form labels', () => {
      render(<PlaceholderConfigPanel {...defaultProps} />)

      const configTab = screen.getByRole('tab', { name: /configuration/i })
      user.click(configTab)

      const inputs = screen.getAllByRole('textbox')
      inputs.forEach(input => {
        expect(input).toHaveAccessibleName()
      })
    })
  })

  describe('Performance', () => {
    it('should render efficiently with large template lists', () => {
      const largeTemplateList = Array.from({ length: 1000 }, (_, i) => ({
        id: `template-${i}`,
        name: `Template ${i}`,
        category: 'test',
        placeholders: []
      }))

      const start = performance.now()
      render(<PlaceholderConfigPanel {...defaultProps} templates={largeTemplateList} />)
      const end = performance.now()

      expect(end - start).toBeLessThan(100)
    })

    it('should virtualize long lists when scrolling', () => {
      const largeTemplateList = Array.from({ length: 1000 }, (_, i) => ({
        id: `template-${i}`,
        name: `Template ${i}`,
        category: 'test',
        placeholders: []
      }))

      render(<PlaceholderConfigPanel {...defaultProps} templates={largeTemplateList} />)

      // Only visible templates should be rendered
      const visibleTemplates = screen.getAllByText(/Template \d+/)
      expect(visibleTemplates.length).toBeLessThan(100)
    })

    it('should debounce search input', async () => {
      jest.useFakeTimers()

      render(<PlaceholderConfigPanel {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText(/search templates/i)
      await user.type(searchInput, 'test')

      // Search should be debounced
      expect(screen.getByText('Board Meeting Minutes')).toBeInTheDocument()

      jest.advanceTimersByTime(300)

      // After debounce delay, search should be applied
      await waitFor(() => {
        expect(screen.queryByText('Board Meeting Minutes')).not.toBeInTheDocument()
      })

      jest.useRealTimers()
    })
  })

  describe('Error Handling', () => {
    it('should handle template loading errors', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})

      render(<PlaceholderConfigPanel {...defaultProps} templates={null as any} />)

      expect(screen.getByText(/error loading templates/i)).toBeInTheDocument()

      consoleError.mockRestore()
    })

    it('should handle configuration update errors', async () => {
      const errorOnConfigChange = jest.fn().mockImplementation(() => {
        throw new Error('Configuration update failed')
      })

      render(<PlaceholderConfigPanel {...defaultProps} onConfigChange={errorOnConfigChange} />)

      const configTab = screen.getByRole('tab', { name: /configuration/i })
      await user.click(configTab)

      const titleInput = screen.getByDisplayValue('Document Version History')
      await user.clear(titleInput)
      await user.type(titleInput, 'New Title')

      expect(screen.getByText(/configuration update failed/i)).toBeInTheDocument()
    })

    it('should handle network errors gracefully', async () => {
      // Mock fetch to simulate network error
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

      render(<PlaceholderConfigPanel {...defaultProps} />)

      const exportButton = screen.getByRole('button', { name: /export config/i })
      await user.click(exportButton)

      expect(screen.getByText(/network error/i)).toBeInTheDocument()
    })
  })

  describe('State Management', () => {
    it('should maintain tab state across re-renders', async () => {
      const { rerender } = render(<PlaceholderConfigPanel {...defaultProps} />)

      const configTab = screen.getByRole('tab', { name: /configuration/i })
      await user.click(configTab)

      expect(configTab).toHaveAttribute('aria-selected', 'true')

      rerender(<PlaceholderConfigPanel {...defaultProps} config={{ ...mockConfig }} />)

      expect(configTab).toHaveAttribute('aria-selected', 'true')
    })

    it('should preserve form input values during tab switches', async () => {
      render(<PlaceholderConfigPanel {...defaultProps} />)

      const configTab = screen.getByRole('tab', { name: /configuration/i })
      await user.click(configTab)

      const titleInput = screen.getByDisplayValue('Document Version History')
      await user.clear(titleInput)
      await user.type(titleInput, 'Modified Title')

      const templatesTab = screen.getByRole('tab', { name: /templates/i })
      await user.click(templatesTab)
      await user.click(configTab)

      expect(screen.getByDisplayValue('Modified Title')).toBeInTheDocument()
    })

    it('should reset form when config prop changes', () => {
      const { rerender } = render(<PlaceholderConfigPanel {...defaultProps} />)

      const newConfig = {
        ...mockConfig,
        version_table: {
          ...mockConfig.version_table,
          title: 'Updated Title'
        }
      }

      rerender(<PlaceholderConfigPanel {...defaultProps} config={newConfig} />)

      const configTab = screen.getByRole('tab', { name: /configuration/i })
      user.click(configTab)

      expect(screen.getByDisplayValue('Updated Title')).toBeInTheDocument()
    })
  })
})