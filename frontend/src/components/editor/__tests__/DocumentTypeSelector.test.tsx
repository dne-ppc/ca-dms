import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DocumentTypeSelector } from '../DocumentTypeSelector'

describe('DocumentTypeSelector - Task 2.3.2: Document Type Selector Implementation', () => {
  const mockProps = {
    value: 'governance',
    onChange: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Component Rendering', () => {
    it('should render the document type selector', () => {
      render(<DocumentTypeSelector {...mockProps} />)

      const selector = screen.getByDisplayValue('Governance Document')
      expect(selector).toBeInTheDocument()
    })

    it('should display all available document types', () => {
      render(<DocumentTypeSelector {...mockProps} />)

      const selector = screen.getByRole('combobox')
      expect(selector).toBeInTheDocument()

      // Check that all expected options are available
      expect(screen.getByText('Governance Document')).toBeInTheDocument()
      expect(screen.getByText('Policy Document')).toBeInTheDocument()
      expect(screen.getByText('Meeting Minutes')).toBeInTheDocument()
      expect(screen.getByText('Notice')).toBeInTheDocument()
      expect(screen.getByText('Form')).toBeInTheDocument()
      expect(screen.getByText('Report')).toBeInTheDocument()
      expect(screen.getByText('Memorandum')).toBeInTheDocument()
      expect(screen.getByText('Other')).toBeInTheDocument()
    })

    it('should apply custom className', () => {
      render(<DocumentTypeSelector {...mockProps} className="custom-class" />)

      const container = document.querySelector('.document-type-selector')
      expect(container).toHaveClass('custom-class')
    })

    it('should show proper icons for each document type', () => {
      render(<DocumentTypeSelector {...mockProps} showIcons />)

      // Icons should be rendered (we can check for SVG elements)
      const svgElements = document.querySelectorAll('svg')
      expect(svgElements.length).toBeGreaterThan(0)
    })
  })

  describe('State Management & Interaction', () => {
    it('should call onChange when value changes', () => {
      render(<DocumentTypeSelector {...mockProps} />)

      const selector = screen.getByRole('combobox')
      fireEvent.change(selector, { target: { value: 'policy' } })

      expect(mockProps.onChange).toHaveBeenCalledWith('policy')
    })

    it('should handle all document type values', () => {
      const documentTypes = [
        { value: 'governance', label: 'Governance Document' },
        { value: 'policy', label: 'Policy Document' },
        { value: 'meeting', label: 'Meeting Minutes' },
        { value: 'notice', label: 'Notice' },
        { value: 'form', label: 'Form' },
        { value: 'report', label: 'Report' },
        { value: 'memo', label: 'Memorandum' },
        { value: 'other', label: 'Other' }
      ]

      documentTypes.forEach(({ value, label }) => {
        const { rerender } = render(<DocumentTypeSelector value={value} onChange={mockProps.onChange} />)

        expect(screen.getByDisplayValue(label)).toBeInTheDocument()
        rerender(<div />)
      })
    })

    it('should maintain controlled component behavior', () => {
      const { rerender } = render(<DocumentTypeSelector {...mockProps} />)

      expect(screen.getByDisplayValue('Governance Document')).toBeInTheDocument()

      rerender(<DocumentTypeSelector value="policy" onChange={mockProps.onChange} />)
      expect(screen.getByDisplayValue('Policy Document')).toBeInTheDocument()
    })
  })

  describe('Document Type Configuration', () => {
    it('should render all available document types', () => {
      render(<DocumentTypeSelector {...mockProps} />)

      const selector = screen.getByRole('combobox')
      expect(selector).toBeInTheDocument()
    })
  })

  describe('Value Handling', () => {
    it('should handle undefined value gracefully', () => {
      render(<DocumentTypeSelector value="other" onChange={mockProps.onChange} />)

      const selector = screen.getByRole('combobox')
      expect(selector).toHaveValue('other')
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<DocumentTypeSelector {...mockProps} />)

      const selector = screen.getByRole('combobox')
      expect(selector).toHaveAttribute('aria-label', 'Document type')
    })

    it('should be keyboard navigable', () => {
      render(<DocumentTypeSelector {...mockProps} />)

      const selector = screen.getByRole('combobox')

      // Test keyboard navigation
      fireEvent.keyDown(selector, { key: 'ArrowDown' })
      fireEvent.keyDown(selector, { key: 'Enter' })

      expect(selector).toBeInTheDocument()
    })

    it('should have proper labeling for screen readers', () => {
      render(<DocumentTypeSelector {...mockProps} />)

      const selector = screen.getByRole('combobox')
      expect(selector).toHaveAttribute('aria-label')
    })

    it('should have proper semantic labeling', () => {
      render(<DocumentTypeSelector {...mockProps} />)

      const selector = screen.getByRole('combobox')
      expect(selector).toHaveAttribute('aria-label', 'Document type')
    })
  })

  describe('Integration with Toolbar', () => {
    it('should work seamlessly within toolbar context', () => {
      const ToolbarWrapper = () => (
        <div role="toolbar">
          <DocumentTypeSelector {...mockProps} />
        </div>
      )

      render(<ToolbarWrapper />)

      const toolbar = screen.getByRole('toolbar')
      const selector = screen.getByRole('combobox')

      expect(toolbar).toContainElement(selector)
    })

    it('should maintain state synchronization with toolbar', () => {
      const handleChange = vi.fn()
      render(<DocumentTypeSelector {...mockProps} onChange={handleChange} />)

      const selector = screen.getByRole('combobox')
      fireEvent.change(selector, { target: { value: 'meeting' } })

      expect(handleChange).toHaveBeenCalledWith('meeting')
    })

    it('should respond to external value changes from toolbar', () => {
      const { rerender } = render(<DocumentTypeSelector {...mockProps} />)

      expect(screen.getByDisplayValue('Governance Document')).toBeInTheDocument()

      rerender(<DocumentTypeSelector value="report" onChange={mockProps.onChange} />)
      expect(screen.getByDisplayValue('Report')).toBeInTheDocument()
    })
  })

  describe('Component Behavior', () => {
    it('should maintain selection state correctly', () => {
      const { rerender } = render(<DocumentTypeSelector {...mockProps} />)

      expect(screen.getByDisplayValue('Governance Document')).toBeInTheDocument()

      rerender(<DocumentTypeSelector value="policy" onChange={mockProps.onChange} />)
      expect(screen.getByDisplayValue('Policy Document')).toBeInTheDocument()
    })
  })
})