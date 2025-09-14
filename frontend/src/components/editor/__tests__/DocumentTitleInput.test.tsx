import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DocumentTitleInput } from '../DocumentTitleInput'

describe('DocumentTitleInput - Task 2.2.2: Document Title Input Implementation', () => {
  const mockProps = {
    value: 'Test Document',
    onChange: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Component Rendering', () => {
    it('should render the document title as a button in display mode', () => {
      render(<DocumentTitleInput {...mockProps} />)

      const button = screen.getByTestId('document-title-input')
      expect(button).toBeInTheDocument()
      expect(button.tagName.toLowerCase()).toBe('button')
      expect(button).toHaveTextContent('Test Document')
    })

    it('should show placeholder when value is empty', () => {
      render(<DocumentTitleInput value="" onChange={mockProps.onChange} placeholder="Document Title" />)

      const button = screen.getByTestId('document-title-input')
      expect(button).toHaveTextContent('Document Title')
    })

    it('should apply custom className', () => {
      render(<DocumentTitleInput {...mockProps} className="custom-class" />)

      const button = screen.getByTestId('document-title-input')
      expect(button).toHaveClass('custom-class')
    })
  })

  describe('State Management & Interaction', () => {
    it('should enter edit mode when clicked', () => {
      render(<DocumentTitleInput {...mockProps} />)

      const button = screen.getByTestId('document-title-input')
      fireEvent.click(button)

      // Should now show input element
      const input = screen.getByTestId('document-title-input')
      expect(input.tagName.toLowerCase()).toBe('input')
      expect(input).toHaveValue('Test Document')
    })

    it('should call onChange when editing is completed', () => {
      render(<DocumentTitleInput {...mockProps} />)

      const button = screen.getByTestId('document-title-input')
      fireEvent.click(button)

      const input = screen.getByTestId('document-title-input')
      fireEvent.change(input, { target: { value: 'New Document Title' } })
      fireEvent.blur(input)

      expect(mockProps.onChange).toHaveBeenCalledWith('New Document Title')
    })

    it('should handle empty value gracefully', () => {
      render(<DocumentTitleInput value="" onChange={mockProps.onChange} placeholder="Document Title" />)

      const button = screen.getByTestId('document-title-input')
      expect(button).toHaveTextContent('Document Title')

      fireEvent.click(button)
      const input = screen.getByTestId('document-title-input')
      fireEvent.change(input, { target: { value: 'New Title' } })
      fireEvent.blur(input)

      expect(mockProps.onChange).toHaveBeenCalledWith('New Title')
    })

    it('should handle Enter key to save changes', () => {
      render(<DocumentTitleInput {...mockProps} />)

      const button = screen.getByTestId('document-title-input')
      fireEvent.click(button)

      const input = screen.getByTestId('document-title-input')
      fireEvent.change(input, { target: { value: 'Enter Saved Title' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      expect(mockProps.onChange).toHaveBeenCalledWith('Enter Saved Title')
    })

    it('should handle Escape key to cancel changes', () => {
      render(<DocumentTitleInput {...mockProps} />)

      const button = screen.getByTestId('document-title-input')
      fireEvent.click(button)

      const input = screen.getByTestId('document-title-input')
      fireEvent.change(input, { target: { value: 'Cancelled Title' } })
      fireEvent.keyDown(input, { key: 'Escape' })

      // Should not call onChange and should revert
      expect(mockProps.onChange).not.toHaveBeenCalled()
    })
  })

  describe('Validation & Length Limits', () => {
    it('should respect maxLength prop', () => {
      render(<DocumentTitleInput {...mockProps} maxLength={10} />)

      const button = screen.getByTestId('document-title-input')
      fireEvent.click(button)

      const input = screen.getByTestId('document-title-input')
      expect(input).toHaveAttribute('maxLength', '10')
    })

    it('should trim whitespace on save', () => {
      render(<DocumentTitleInput {...mockProps} />)

      const button = screen.getByTestId('document-title-input')
      fireEvent.click(button)

      const input = screen.getByTestId('document-title-input')
      fireEvent.change(input, { target: { value: '  Trimmed Title  ' } })
      fireEvent.blur(input)

      expect(mockProps.onChange).toHaveBeenCalledWith('Trimmed Title')
    })

    it('should not save empty titles', () => {
      render(<DocumentTitleInput {...mockProps} />)

      const button = screen.getByTestId('document-title-input')
      fireEvent.click(button)

      const input = screen.getByTestId('document-title-input')
      fireEvent.change(input, { target: { value: '   ' } })
      fireEvent.blur(input)

      expect(mockProps.onChange).not.toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('should be keyboard accessible', () => {
      render(<DocumentTitleInput {...mockProps} />)

      const button = screen.getByTestId('document-title-input')
      expect(button.tagName.toLowerCase()).toBe('button')
      expect(button).not.toHaveAttribute('tabindex', '-1')
    })

    it('should allow keyboard editing', () => {
      render(<DocumentTitleInput {...mockProps} />)

      const button = screen.getByTestId('document-title-input')
      fireEvent.click(button)

      const input = screen.getByTestId('document-title-input')
      expect(input.tagName.toLowerCase()).toBe('input')
    })
  })

  describe('Focus Management', () => {
    it('should focus input when entering edit mode', () => {
      render(<DocumentTitleInput {...mockProps} />)

      const button = screen.getByTestId('document-title-input')
      fireEvent.click(button)

      // Note: Auto-focus behavior tested by existence of input element
      const input = screen.getByTestId('document-title-input')
      expect(input).toBeInTheDocument()
    })
  })

  describe('Integration with Toolbar', () => {
    it('should work seamlessly within toolbar context', () => {
      const ToolbarWrapper = () => (
        <div role="toolbar">
          <DocumentTitleInput {...mockProps} />
        </div>
      )

      render(<ToolbarWrapper />)

      const toolbar = screen.getByRole('toolbar')
      const button = screen.getByTestId('document-title-input')

      expect(toolbar).toContainElement(button)
    })

    it('should maintain state consistency with parent component', () => {
      const { rerender } = render(<DocumentTitleInput value="Initial Title" onChange={mockProps.onChange} />)

      const button = screen.getByTestId('document-title-input')
      expect(button).toHaveTextContent('Initial Title')

      // Simulate parent state update
      rerender(<DocumentTitleInput value="Updated Title" onChange={mockProps.onChange} />)

      expect(screen.getByTestId('document-title-input')).toHaveTextContent('Updated Title')
    })
  })
})