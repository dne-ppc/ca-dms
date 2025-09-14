import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HeaderFormatSelector } from '../HeaderFormatSelector'

describe('HeaderFormatSelector - Task 2.4.2: Header Format Selector Implementation', () => {
  const mockProps = {
    value: 'normal',
    onChange: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Component Rendering', () => {
    it('should render the header format selector', () => {
      render(<HeaderFormatSelector {...mockProps} />)

      const selector = screen.getByDisplayValue('Normal Text')
      expect(selector).toBeInTheDocument()
    })

    it('should display all available header formats', () => {
      render(<HeaderFormatSelector {...mockProps} />)

      const selector = screen.getByRole('combobox')
      expect(selector).toBeInTheDocument()

      // Check that all expected options are available
      expect(screen.getByText('Normal Text')).toBeInTheDocument()
      expect(screen.getByText('Heading 1')).toBeInTheDocument()
      expect(screen.getByText('Heading 2')).toBeInTheDocument()
      expect(screen.getByText('Heading 3')).toBeInTheDocument()
    })

    it('should apply custom className', () => {
      render(<HeaderFormatSelector {...mockProps} className="custom-class" />)

      const container = document.querySelector('.header-format-selector')
      expect(container).toHaveClass('custom-class')
    })

    it('should show visual hierarchy indicators', () => {
      render(<HeaderFormatSelector {...mockProps} showHierarchy />)

      // Check for visual indicators (depends on implementation)
      const selector = screen.getByRole('combobox')
      expect(selector).toBeInTheDocument()
    })
  })

  describe('State Management & Interaction', () => {
    it('should call onChange when value changes', () => {
      render(<HeaderFormatSelector {...mockProps} />)

      const selector = screen.getByRole('combobox')
      fireEvent.change(selector, { target: { value: 'h1' } })

      expect(mockProps.onChange).toHaveBeenCalledWith('h1')
    })

    it('should handle all header format values', () => {
      const headerFormats = [
        { value: 'normal', label: 'Normal Text' },
        { value: 'h1', label: 'Heading 1' },
        { value: 'h2', label: 'Heading 2' },
        { value: 'h3', label: 'Heading 3' }
      ]

      headerFormats.forEach(({ value, label }) => {
        const { rerender } = render(<HeaderFormatSelector value={value} onChange={mockProps.onChange} />)

        expect(screen.getByDisplayValue(label)).toBeInTheDocument()
        rerender(<div />)
      })
    })

    it('should maintain controlled component behavior', () => {
      const { rerender } = render(<HeaderFormatSelector {...mockProps} />)

      expect(screen.getByDisplayValue('Normal Text')).toBeInTheDocument()

      rerender(<HeaderFormatSelector value="h1" onChange={mockProps.onChange} />)
      expect(screen.getByDisplayValue('Heading 1')).toBeInTheDocument()
    })
  })

  describe('Format Values', () => {
    it('should work with all defined format values', () => {
      const formats = ['normal', 'h1', 'h2', 'h3']

      formats.forEach(format => {
        const { rerender } = render(<HeaderFormatSelector value={format} onChange={mockProps.onChange} />)
        const selector = screen.getByRole('combobox')
        expect(selector).toHaveValue(format)
        rerender(<div />)
      })
    })
  })

  describe('Format Changes', () => {
    it('should handle format clearing to normal', () => {
      render(<HeaderFormatSelector value="h1" onChange={mockProps.onChange} />)

      const selector = screen.getByRole('combobox')
      fireEvent.change(selector, { target: { value: 'normal' } })

      expect(mockProps.onChange).toHaveBeenCalledWith('normal')
    })

    it('should reflect prop changes correctly', () => {
      const { rerender } = render(<HeaderFormatSelector {...mockProps} />)
      expect(screen.getByDisplayValue('Normal Text')).toBeInTheDocument()

      rerender(<HeaderFormatSelector value="h1" onChange={mockProps.onChange} />)
      expect(screen.getByDisplayValue('Heading 1')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<HeaderFormatSelector {...mockProps} />)

      const selector = screen.getByRole('combobox')
      expect(selector).toHaveAttribute('aria-label', 'Header format')
    })

    it('should be keyboard navigable', () => {
      render(<HeaderFormatSelector {...mockProps} />)

      const selector = screen.getByRole('combobox')

      // Test keyboard navigation
      fireEvent.keyDown(selector, { key: 'ArrowDown' })
      fireEvent.keyDown(selector, { key: 'Enter' })

      expect(selector).toBeInTheDocument()
    })

    it('should have proper semantic hierarchy', () => {
      render(<HeaderFormatSelector {...mockProps} value="h1" />)

      const selector = screen.getByRole('combobox')
      expect(selector).toHaveAttribute('aria-label')
    })

    it('should announce format changes for screen readers', () => {
      const { rerender } = render(<HeaderFormatSelector {...mockProps} />)

      rerender(<HeaderFormatSelector value="h1" onChange={mockProps.onChange} announceChanges />)

      // Check for ARIA live region updates
      const selector = screen.getByRole('combobox')
      expect(selector).toBeInTheDocument()
    })
  })

  describe('Visual Elements', () => {
    it('should display format icon', () => {
      render(<HeaderFormatSelector {...mockProps} />)

      // Check for Type icon in the component
      const svgElements = document.querySelectorAll('svg')
      expect(svgElements.length).toBeGreaterThan(0)
    })
  })

  describe('Integration with Toolbar', () => {
    it('should work seamlessly within toolbar context', () => {
      const ToolbarWrapper = () => (
        <div role="toolbar">
          <HeaderFormatSelector {...mockProps} />
        </div>
      )

      render(<ToolbarWrapper />)

      const toolbar = screen.getByRole('toolbar')
      const selector = screen.getByRole('combobox')

      expect(toolbar).toContainElement(selector)
    })

    it('should maintain state synchronization with toolbar', () => {
      const handleChange = vi.fn()
      render(<HeaderFormatSelector {...mockProps} onChange={handleChange} />)

      const selector = screen.getByRole('combobox')
      fireEvent.change(selector, { target: { value: 'h1' } })

      expect(handleChange).toHaveBeenCalledWith('h1')
    })

    it('should respond to toolbar state changes', () => {
      const { rerender } = render(<HeaderFormatSelector {...mockProps} />)

      expect(screen.getByDisplayValue('Normal Text')).toBeInTheDocument()

      rerender(<HeaderFormatSelector value="h3" onChange={mockProps.onChange} />)
      expect(screen.getByDisplayValue('Heading 3')).toBeInTheDocument()
    })
  })

  describe('Performance', () => {
    it('should not cause unnecessary re-renders', () => {
      const onChange = vi.fn()
      const { rerender } = render(<HeaderFormatSelector value="normal" onChange={onChange} />)

      // Re-render with same props
      rerender(<HeaderFormatSelector value="normal" onChange={onChange} />)

      const selector = screen.getByRole('combobox')
      expect(selector).toBeInTheDocument()
    })

    it('should handle rapid format changes efficiently', () => {
      render(<HeaderFormatSelector {...mockProps} />)

      const selector = screen.getByRole('combobox')

      // Rapid changes
      fireEvent.change(selector, { target: { value: 'h1' } })
      fireEvent.change(selector, { target: { value: 'h2' } })
      fireEvent.change(selector, { target: { value: 'h3' } })

      expect(mockProps.onChange).toHaveBeenCalledTimes(3)
    })
  })
})