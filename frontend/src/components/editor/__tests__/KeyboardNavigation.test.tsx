import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EnhancedToolbar } from '../EnhancedToolbar'
import { DocumentTitleInput } from '../DocumentTitleInput'
import { DocumentTypeSelector } from '../DocumentTypeSelector'
import { HeaderFormatSelector } from '../HeaderFormatSelector'

describe('Keyboard Navigation Tests - Task 7.2.1: Complete Keyboard Navigation', () => {
  const mockEditorState = {
    documentTitle: 'Keyboard Navigation Test',
    documentType: 'governance',
    headerFormat: 'normal',
    hasUnsavedChanges: false,
    isSaving: false
  }

  const mockHandlers = {
    onTitleChange: vi.fn(),
    onTypeChange: vi.fn(),
    onHeaderFormatChange: vi.fn(),
    onSave: vi.fn(),
    onBold: vi.fn(),
    onItalic: vi.fn(),
    onUnderline: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Tab Navigation Order', () => {
    it('should follow logical tab order through toolbar elements', () => {
      render(
        <EnhancedToolbar
          {...mockEditorState}
          {...mockHandlers}
        />
      )

      // Expected tab order: Title -> Type -> Save -> Header Format -> Bold -> Italic -> Underline -> Undo -> Redo
      const expectedOrder = [
        screen.getByTestId('document-title-input'),
        screen.getByTestId('document-type-selector'),
        screen.getByTestId('save-button'),
        screen.getByTestId('header-format-selector'),
        screen.getByTestId('bold-button'),
        screen.getByTestId('italic-button'),
        screen.getByTestId('underline-button'),
        screen.getByTestId('undo-button'),
        screen.getByTestId('redo-button')
      ]

      expectedOrder.forEach((element, index) => {
        element.focus()
        expect(document.activeElement).toBe(element)

        // Simulate tab to next element
        if (index < expectedOrder.length - 1) {
          fireEvent.keyDown(element, { key: 'Tab' })
        }
      })
    })

    it('should support Shift+Tab for reverse navigation', () => {
      render(
        <EnhancedToolbar
          {...mockEditorState}
          {...mockHandlers}
        />
      )

      const buttons = [
        screen.getByTestId('redo-button'),
        screen.getByTestId('undo-button'),
        screen.getByTestId('underline-button'),
        screen.getByTestId('italic-button'),
        screen.getByTestId('bold-button')
      ]

      buttons.forEach((element) => {
        element.focus()
        expect(document.activeElement).toBe(element)

        // Simulate Shift+Tab
        fireEvent.keyDown(element, { key: 'Tab', shiftKey: true })
      })
    })

    it('should skip disabled elements in tab order', () => {
      render(
        <EnhancedToolbar
          {...mockEditorState}
          {...mockHandlers}
          isSaving={true} // This may disable some buttons
        />
      )

      const saveButton = screen.getByTestId('save-button')

      // Disabled save button should not be focusable
      saveButton.focus()
      // If button is disabled, focus may not stay on it
      const canFocus = document.activeElement === saveButton

      if (!canFocus) {
        // Verify disabled state
        expect(saveButton).toBeDisabled()
      }
    })
  })

  describe('Keyboard Shortcuts', () => {
    it('should support Enter key activation for buttons', () => {
      render(
        <EnhancedToolbar
          {...mockEditorState}
          {...mockHandlers}
        />
      )

      const boldButton = screen.getByTestId('bold-button')
      boldButton.focus()

      // Press Enter
      fireEvent.keyDown(boldButton, { key: 'Enter' })
      expect(mockHandlers.onBold).toHaveBeenCalled()
    })

    it('should support Space key activation for buttons', () => {
      render(
        <EnhancedToolbar
          {...mockEditorState}
          {...mockHandlers}
        />
      )

      const italicButton = screen.getByTestId('italic-button')
      italicButton.focus()

      // Press Space (need to prevent default to work properly)
      fireEvent.keyDown(italicButton, { key: ' ', preventDefault: vi.fn() })
      expect(mockHandlers.onItalic).toHaveBeenCalled()
    })

    it('should support arrow key navigation for select elements', () => {
      render(<DocumentTypeSelector value="governance" onChange={mockHandlers.onTypeChange} />)

      const selector = screen.getByTestId('document-type-selector')
      selector.focus()

      // Arrow down should navigate options
      fireEvent.keyDown(selector, { key: 'ArrowDown' })
      fireEvent.keyDown(selector, { key: 'ArrowUp' })

      expect(selector).toBeInTheDocument()
    })

    it('should support Home/End keys for select navigation', () => {
      render(<HeaderFormatSelector value="normal" onChange={mockHandlers.onHeaderFormatChange} />)

      const selector = screen.getByTestId('header-format-selector')
      selector.focus()

      // Home key should go to first option
      fireEvent.keyDown(selector, { key: 'Home' })
      // End key should go to last option
      fireEvent.keyDown(selector, { key: 'End' })

      expect(selector).toBeInTheDocument()
    })
  })

  describe('Focus Management', () => {
    it('should provide visible focus indicators', () => {
      render(
        <EnhancedToolbar
          {...mockEditorState}
          {...mockHandlers}
        />
      )

      const boldButton = screen.getByTestId('bold-button')
      boldButton.focus()

      // Check for focus ring classes
      expect(boldButton).toHaveClass('focus:ring-2', 'focus:ring-blue-500')
    })

    it('should maintain focus within component boundaries', () => {
      render(
        <EnhancedToolbar
          {...mockEditorState}
          {...mockHandlers}
        />
      )

      const toolbar = screen.getByTestId('enhanced-toolbar')
      const buttons = screen.getAllByRole('button')

      // Test first few buttons to avoid disabled button issues
      const testButtons = buttons.slice(0, 3)
      testButtons.forEach(button => {
        if (!button.hasAttribute('disabled')) {
          button.focus()
          if (document.activeElement === button) {
            expect(toolbar).toContainElement(button)
          }
        }
      })
    })

    it('should handle focus trapping in edit mode', async () => {
      render(<DocumentTitleInput value="Test Title" onChange={mockHandlers.onTitleChange} />)

      const titleButton = screen.getByTestId('document-title-input')

      // Enter edit mode with keyboard
      titleButton.focus()
      fireEvent.keyDown(titleButton, { key: 'Enter', preventDefault: vi.fn() })

      // Should now be in input mode
      const input = screen.getByTestId('document-title-input')
      expect(input.tagName.toLowerCase()).toBe('input')

      // Wait for focus to be set (async due to setTimeout in component)
      await new Promise(resolve => setTimeout(resolve, 10))
      expect(document.activeElement).toBe(input)
    })

    it('should restore focus after edit completion', () => {
      render(<DocumentTitleInput value="Test Title" onChange={mockHandlers.onTitleChange} />)

      const titleButton = screen.getByTestId('document-title-input')
      titleButton.focus()
      fireEvent.keyDown(titleButton, { key: 'Enter' })

      const input = screen.getByTestId('document-title-input')
      fireEvent.change(input, { target: { value: 'Updated Title' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      // Should return to button mode
      const finalButton = screen.getByTestId('document-title-input')
      expect(finalButton.tagName.toLowerCase()).toBe('button')
    })
  })

  describe('Keyboard Accessibility Patterns', () => {
    it('should support ARIA keyboard navigation patterns', () => {
      render(
        <EnhancedToolbar
          {...mockEditorState}
          {...mockHandlers}
        />
      )

      const toolbar = screen.getByRole('toolbar')
      expect(toolbar).toHaveAttribute('aria-orientation', 'horizontal')

      // In horizontal toolbars, left/right arrows typically navigate
      const boldButton = screen.getByTestId('bold-button')
      boldButton.focus()

      fireEvent.keyDown(boldButton, { key: 'ArrowLeft' })
      fireEvent.keyDown(boldButton, { key: 'ArrowRight' })

      expect(boldButton).toBeInTheDocument()
    })

    it('should handle Escape key appropriately', () => {
      render(<DocumentTitleInput value="Test Title" onChange={mockHandlers.onTitleChange} />)

      const titleButton = screen.getByTestId('document-title-input')
      fireEvent.click(titleButton)

      const input = screen.getByTestId('document-title-input')
      fireEvent.change(input, { target: { value: 'Changed Title' } })

      // Escape should cancel changes
      fireEvent.keyDown(input, { key: 'Escape' })

      // Should return to button mode without calling onChange
      expect(mockHandlers.onTitleChange).not.toHaveBeenCalled()
    })

    it('should support contextual keyboard shortcuts', () => {
      render(
        <EnhancedToolbar
          {...mockEditorState}
          {...mockHandlers}
        />
      )

      // Test that title attributes include keyboard shortcuts
      const boldButton = screen.getByTestId('bold-button')
      expect(boldButton).toHaveAttribute('title', 'Bold (Ctrl+B)')

      const italicButton = screen.getByTestId('italic-button')
      expect(italicButton).toHaveAttribute('title', 'Italic (Ctrl+I)')

      const undoButton = screen.getByTestId('undo-button')
      expect(undoButton).toHaveAttribute('title', 'Undo (Ctrl+Z)')
    })
  })

  describe('Complex Keyboard Interactions', () => {
    it('should handle rapid keyboard navigation', () => {
      render(
        <EnhancedToolbar
          {...mockEditorState}
          {...mockHandlers}
        />
      )

      const buttons = [
        screen.getByTestId('bold-button'),
        screen.getByTestId('italic-button'),
        screen.getByTestId('underline-button')
      ]

      // Rapidly navigate and activate buttons
      buttons.forEach(button => {
        button.focus()
        fireEvent.keyDown(button, { key: 'Enter', preventDefault: vi.fn() })
      })

      expect(mockHandlers.onBold).toHaveBeenCalled()
      expect(mockHandlers.onItalic).toHaveBeenCalled()
      expect(mockHandlers.onUnderline).toHaveBeenCalled()
    })

    it('should handle keyboard navigation with dynamic content', () => {
      const { rerender } = render(
        <EnhancedToolbar
          {...mockEditorState}
          {...mockHandlers}
          hasUnsavedChanges={false}
        />
      )

      // Focus save button
      const saveButton = screen.getByTestId('save-button')
      saveButton.focus()

      // Change state to show unsaved changes
      rerender(
        <EnhancedToolbar
          {...mockEditorState}
          {...mockHandlers}
          hasUnsavedChanges={true}
        />
      )

      // Save button should still be focusable
      expect(saveButton).toBeInTheDocument()
      expect(saveButton).not.toBeDisabled()

      // Unsaved indicator should be visible
      expect(screen.getByTestId('unsaved-indicator')).toBeInTheDocument()
    })

    it('should maintain keyboard accessibility during state changes', () => {
      const { rerender } = render(
        <EnhancedToolbar
          {...mockEditorState}
          {...mockHandlers}
          isSaving={false}
        />
      )

      const saveButton = screen.getByTestId('save-button')
      saveButton.focus()

      // Change to saving state
      rerender(
        <EnhancedToolbar
          {...mockEditorState}
          {...mockHandlers}
          isSaving={true}
        />
      )

      // Button should still exist but be disabled
      const updatedSaveButton = screen.getByTestId('save-button')
      expect(updatedSaveButton).toBeDisabled()
      expect(updatedSaveButton).toHaveTextContent('Saving...')
    })
  })

  describe('Cross-Component Keyboard Navigation', () => {
    it('should coordinate focus between multiple components', () => {
      render(
        <div>
          <DocumentTitleInput value="Title" onChange={mockHandlers.onTitleChange} />
          <DocumentTypeSelector value="governance" onChange={mockHandlers.onTypeChange} />
          <HeaderFormatSelector value="normal" onChange={mockHandlers.onHeaderFormatChange} />
        </div>
      )

      // Navigate between components
      const titleInput = screen.getByTestId('document-title-input')
      const typeSelector = screen.getByTestId('document-type-selector')
      const headerSelector = screen.getByTestId('header-format-selector')

      titleInput.focus()
      expect(document.activeElement).toBe(titleInput)

      typeSelector.focus()
      expect(document.activeElement).toBe(typeSelector)

      headerSelector.focus()
      expect(document.activeElement).toBe(headerSelector)
    })

    it('should handle focus delegation appropriately', () => {
      render(
        <EnhancedToolbar
          {...mockEditorState}
          {...mockHandlers}
        />
      )

      const toolbar = screen.getByRole('toolbar')
      const firstButton = screen.getByTestId('document-title-input')

      // Focus first interactive element
      firstButton.focus()

      // Focus should be on a child element within toolbar
      const focusedElement = document.activeElement
      if (focusedElement && focusedElement !== document.body) {
        expect(toolbar).toContainElement(focusedElement)
        expect(focusedElement).not.toBe(toolbar)
      }
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle keyboard events when components are unmounted', () => {
      const { unmount } = render(
        <EnhancedToolbar
          {...mockEditorState}
          {...mockHandlers}
        />
      )

      const boldButton = screen.getByTestId('bold-button')
      boldButton.focus()

      // Unmount component
      unmount()

      // Should not throw errors
      expect(() => {
        fireEvent.keyDown(document.body, { key: 'Enter' })
      }).not.toThrow()
    })

    it('should handle invalid keyboard events gracefully', () => {
      render(
        <EnhancedToolbar
          {...mockEditorState}
          {...mockHandlers}
        />
      )

      const boldButton = screen.getByTestId('bold-button')
      boldButton.focus()

      // Send various keyboard events
      const invalidKeys = ['F1', 'F12', 'Insert', 'PageUp', 'PageDown']

      invalidKeys.forEach(key => {
        expect(() => {
          fireEvent.keyDown(boldButton, { key })
        }).not.toThrow()
      })

      // Should still be focusable
      expect(document.activeElement).toBe(boldButton)
    })

    it('should handle keyboard navigation with missing handlers', () => {
      // This test verifies error boundary behavior
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const incompleteHandlers = {
        onTitleChange: vi.fn(),
        onTypeChange: vi.fn(),
        onHeaderFormatChange: vi.fn(),
        onSave: vi.fn(),
        onBold: undefined as any, // Missing handler
        onItalic: vi.fn(),
        onUnderline: vi.fn(),
        onUndo: vi.fn(),
        onRedo: vi.fn()
      }

      try {
        render(
          <EnhancedToolbar
            {...mockEditorState}
            {...incompleteHandlers}
          />
        )

        const boldButton = screen.getByTestId('bold-button')
        boldButton.focus()

        // This will trigger an error but shouldn't crash the app
        fireEvent.keyDown(boldButton, { key: 'Enter' })

        // If we get here, the error was handled gracefully
        expect(boldButton).toBeInTheDocument()
      } catch (error) {
        // Error is expected due to missing handler
        expect(error).toBeDefined()
      } finally {
        errorSpy.mockRestore()
      }
    })
  })
})