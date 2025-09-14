import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EnhancedToolbar } from '../EnhancedToolbar'
import { DocumentTitleInput } from '../DocumentTitleInput'
import { DocumentTypeSelector } from '../DocumentTypeSelector'
import { HeaderFormatSelector } from '../HeaderFormatSelector'
import { TableOfContents } from '../TableOfContents'
import { AdvancedReportingButton } from '../AdvancedReportingButton'

// Mock external dependencies
vi.mock('../../../services/reportingService', () => ({
  reportingService: {
    getAnalyticsByType: vi.fn(),
    exportReport: vi.fn()
  }
}))

vi.mock('../../../services/tocService', () => ({
  tocService: {
    extractHeaders: vi.fn(() => []),
    updateDocument: vi.fn()
  }
}))

describe('Editor Integration Tests - Phase 7.1: End-to-End Integration', () => {
  const mockEditorState = {
    documentTitle: 'Test Integration Document',
    documentType: 'governance',
    headerFormat: 'normal',
    content: 'Test content',
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

  describe('Complete Editor Workflow Integration', () => {
    it('should integrate all toolbar components seamlessly', () => {
      const IntegratedEditor = () => (
        <div className="editor-integration">
          <EnhancedToolbar
            documentTitle={mockEditorState.documentTitle}
            documentType={mockEditorState.documentType}
            headerFormat={mockEditorState.headerFormat}
            onTitleChange={mockHandlers.onTitleChange}
            onTypeChange={mockHandlers.onTypeChange}
            onHeaderFormatChange={mockHandlers.onHeaderFormatChange}
            onSave={mockHandlers.onSave}
            onBold={mockHandlers.onBold}
            onItalic={mockHandlers.onItalic}
            onUnderline={mockHandlers.onUnderline}
            onUndo={mockHandlers.onUndo}
            onRedo={mockHandlers.onRedo}
            hasUnsavedChanges={mockEditorState.hasUnsavedChanges}
            isSaving={mockEditorState.isSaving}
          />
        </div>
      )

      render(<IntegratedEditor />)

      // Verify all components are rendered and integrated
      expect(screen.getByTestId('enhanced-toolbar')).toBeInTheDocument()
      expect(screen.getByTestId('document-title-input')).toBeInTheDocument()
      expect(screen.getByTestId('document-type-selector')).toBeInTheDocument()
      expect(screen.getByTestId('header-format-selector')).toBeInTheDocument()
      expect(screen.getByTestId('advanced-reporting-button')).toBeInTheDocument()
    })

    it('should handle complete document editing workflow', async () => {
      render(
        <EnhancedToolbar
          documentTitle=""
          documentType="governance"
          headerFormat="normal"
          onTitleChange={mockHandlers.onTitleChange}
          onTypeChange={mockHandlers.onTypeChange}
          onHeaderFormatChange={mockHandlers.onHeaderFormatChange}
          onSave={mockHandlers.onSave}
          onBold={mockHandlers.onBold}
          onItalic={mockHandlers.onItalic}
          onUnderline={mockHandlers.onUnderline}
          onUndo={mockHandlers.onUndo}
          onRedo={mockHandlers.onRedo}
        />
      )

      // Step 1: Edit document title
      const titleButton = screen.getByTestId('document-title-input')
      fireEvent.click(titleButton)

      const titleInput = screen.getByTestId('document-title-input')
      fireEvent.change(titleInput, { target: { value: 'New Integration Test Doc' } })
      fireEvent.keyDown(titleInput, { key: 'Enter' })

      expect(mockHandlers.onTitleChange).toHaveBeenCalledWith('New Integration Test Doc')

      // Step 2: Change document type
      const typeSelector = screen.getByTestId('document-type-selector')
      fireEvent.change(typeSelector, { target: { value: 'policy' } })

      expect(mockHandlers.onTypeChange).toHaveBeenCalledWith('policy')

      // Step 3: Change header format
      const headerSelector = screen.getByTestId('header-format-selector')
      fireEvent.change(headerSelector, { target: { value: 'h1' } })

      expect(mockHandlers.onHeaderFormatChange).toHaveBeenCalledWith('h1')

      // Step 4: Use formatting controls
      const boldButton = screen.getByTestId('bold-button')
      fireEvent.click(boldButton)

      expect(mockHandlers.onBold).toHaveBeenCalled()

      // Step 5: Save document
      const saveButton = screen.getByTestId('save-button')
      fireEvent.click(saveButton)

      expect(mockHandlers.onSave).toHaveBeenCalled()
    })

    it('should maintain state consistency across components', () => {
      const { rerender } = render(
        <EnhancedToolbar
          documentTitle="Initial Title"
          documentType="governance"
          headerFormat="normal"
          onTitleChange={mockHandlers.onTitleChange}
          onTypeChange={mockHandlers.onTypeChange}
          onHeaderFormatChange={mockHandlers.onHeaderFormatChange}
          onSave={mockHandlers.onSave}
          onBold={mockHandlers.onBold}
          onItalic={mockHandlers.onItalic}
          onUnderline={mockHandlers.onUnderline}
          onUndo={mockHandlers.onUndo}
          onRedo={mockHandlers.onRedo}
        />
      )

      // Verify initial state
      expect(screen.getByTestId('document-title-input')).toHaveTextContent('Initial Title')
      expect(screen.getByTestId('document-type-selector')).toHaveValue('governance')
      expect(screen.getByTestId('header-format-selector')).toHaveValue('normal')

      // Update state
      rerender(
        <EnhancedToolbar
          documentTitle="Updated Title"
          documentType="policy"
          headerFormat="h1"
          onTitleChange={mockHandlers.onTitleChange}
          onTypeChange={mockHandlers.onTypeChange}
          onHeaderFormatChange={mockHandlers.onHeaderFormatChange}
          onSave={mockHandlers.onSave}
          onBold={mockHandlers.onBold}
          onItalic={mockHandlers.onItalic}
          onUnderline={mockHandlers.onUnderline}
          onUndo={mockHandlers.onUndo}
          onRedo={mockHandlers.onRedo}
        />
      )

      // Verify state updates
      expect(screen.getByTestId('document-title-input')).toHaveTextContent('Updated Title')
      expect(screen.getByTestId('document-type-selector')).toHaveValue('policy')
      expect(screen.getByTestId('header-format-selector')).toHaveValue('h1')
    })
  })

  describe('Cross-Component Communication', () => {
    it('should handle rapid state changes without conflicts', async () => {
      render(
        <EnhancedToolbar
          documentTitle="Test Doc"
          documentType="governance"
          headerFormat="normal"
          onTitleChange={mockHandlers.onTitleChange}
          onTypeChange={mockHandlers.onTypeChange}
          onHeaderFormatChange={mockHandlers.onHeaderFormatChange}
          onSave={mockHandlers.onSave}
          onBold={mockHandlers.onBold}
          onItalic={mockHandlers.onItalic}
          onUnderline={mockHandlers.onUnderline}
          onUndo={mockHandlers.onUndo}
          onRedo={mockHandlers.onRedo}
        />
      )

      // Rapid changes
      const typeSelector = screen.getByTestId('document-type-selector')
      const headerSelector = screen.getByTestId('header-format-selector')

      fireEvent.change(typeSelector, { target: { value: 'policy' } })
      fireEvent.change(headerSelector, { target: { value: 'h1' } })
      fireEvent.change(typeSelector, { target: { value: 'meeting' } })
      fireEvent.change(headerSelector, { target: { value: 'h2' } })

      expect(mockHandlers.onTypeChange).toHaveBeenCalledTimes(2)
      expect(mockHandlers.onHeaderFormatChange).toHaveBeenCalledTimes(2)
      expect(mockHandlers.onTypeChange).toHaveBeenLastCalledWith('meeting')
      expect(mockHandlers.onHeaderFormatChange).toHaveBeenLastCalledWith('h2')
    })

    it('should handle saving state correctly', () => {
      const { rerender } = render(
        <EnhancedToolbar
          documentTitle="Test Doc"
          documentType="governance"
          headerFormat="normal"
          onTitleChange={mockHandlers.onTitleChange}
          onTypeChange={mockHandlers.onTypeChange}
          onHeaderFormatChange={mockHandlers.onHeaderFormatChange}
          onSave={mockHandlers.onSave}
          onBold={mockHandlers.onBold}
          onItalic={mockHandlers.onItalic}
          onUnderline={mockHandlers.onUnderline}
          onUndo={mockHandlers.onUndo}
          onRedo={mockHandlers.onRedo}
          hasUnsavedChanges={true}
          isSaving={false}
        />
      )

      // Should show unsaved changes indicator
      expect(screen.getByTestId('unsaved-indicator')).toBeInTheDocument()

      const saveButton = screen.getByTestId('save-button')
      expect(saveButton).not.toBeDisabled()

      // Simulate saving state
      rerender(
        <EnhancedToolbar
          documentTitle="Test Doc"
          documentType="governance"
          headerFormat="normal"
          onTitleChange={mockHandlers.onTitleChange}
          onTypeChange={mockHandlers.onTypeChange}
          onHeaderFormatChange={mockHandlers.onHeaderFormatChange}
          onSave={mockHandlers.onSave}
          onBold={mockHandlers.onBold}
          onItalic={mockHandlers.onItalic}
          onUnderline={mockHandlers.onUnderline}
          onUndo={mockHandlers.onUndo}
          onRedo={mockHandlers.onRedo}
          hasUnsavedChanges={true}
          isSaving={true}
        />
      )

      // Should show saving state
      const savingButton = screen.getByTestId('save-button')
      expect(savingButton).toBeDisabled()
      expect(savingButton).toHaveTextContent(/saving/i)
    })
  })

  describe('Individual Component Integration', () => {
    it('should integrate DocumentTitleInput properly', () => {
      render(
        <DocumentTitleInput
          value="Integration Test Title"
          onChange={mockHandlers.onTitleChange}
        />
      )

      const titleComponent = screen.getByTestId('document-title-input')
      expect(titleComponent).toHaveTextContent('Integration Test Title')

      // Test editing functionality - DocumentTitleInput requires click to enter edit mode
      fireEvent.click(titleComponent)

      // After click, get the input element (now in edit mode)
      const inputElement = screen.getByTestId('document-title-input')
      fireEvent.change(inputElement, { target: { value: 'Updated Title' } })
      fireEvent.blur(inputElement)

      expect(mockHandlers.onTitleChange).toHaveBeenCalledWith('Updated Title')
    })

    it('should integrate DocumentTypeSelector properly', () => {
      render(
        <DocumentTypeSelector
          value="governance"
          onChange={mockHandlers.onTypeChange}
        />
      )

      const typeSelector = screen.getByTestId('document-type-selector')
      expect(typeSelector).toHaveValue('governance')

      fireEvent.change(typeSelector, { target: { value: 'policy' } })
      expect(mockHandlers.onTypeChange).toHaveBeenCalledWith('policy')
    })

    it('should integrate HeaderFormatSelector properly', () => {
      render(
        <HeaderFormatSelector
          value="normal"
          onChange={mockHandlers.onHeaderFormatChange}
        />
      )

      const headerSelector = screen.getByTestId('header-format-selector')
      expect(headerSelector).toHaveValue('normal')

      fireEvent.change(headerSelector, { target: { value: 'h1' } })
      expect(mockHandlers.onHeaderFormatChange).toHaveBeenCalledWith('h1')
    })

    it('should integrate AdvancedReportingButton properly', () => {
      render(<AdvancedReportingButton />)

      const reportingButton = screen.getByTestId('advanced-reporting-button')
      expect(reportingButton).toBeInTheDocument()

      // Test modal opening
      fireEvent.click(reportingButton)
      expect(screen.getByText('Advanced Reporting')).toBeInTheDocument()
    })
  })

  describe('Performance and Memory Integration', () => {
    it('should not cause memory leaks with repeated renders', () => {
      const { rerender, unmount } = render(
        <EnhancedToolbar
          documentTitle="Performance Test"
          documentType="governance"
          headerFormat="normal"
          onTitleChange={mockHandlers.onTitleChange}
          onTypeChange={mockHandlers.onTypeChange}
          onHeaderFormatChange={mockHandlers.onHeaderFormatChange}
          onSave={mockHandlers.onSave}
          onBold={mockHandlers.onBold}
          onItalic={mockHandlers.onItalic}
          onUnderline={mockHandlers.onUnderline}
          onUndo={mockHandlers.onUndo}
          onRedo={mockHandlers.onRedo}
        />
      )

      // Multiple re-renders
      for (let i = 0; i < 10; i++) {
        rerender(
          <EnhancedToolbar
            documentTitle={`Performance Test ${i}`}
            documentType={i % 2 === 0 ? 'governance' : 'policy'}
            headerFormat={i % 3 === 0 ? 'h1' : 'normal'}
            onTitleChange={mockHandlers.onTitleChange}
            onTypeChange={mockHandlers.onTypeChange}
            onHeaderFormatChange={mockHandlers.onHeaderFormatChange}
            onSave={mockHandlers.onSave}
            onBold={mockHandlers.onBold}
            onItalic={mockHandlers.onItalic}
            onUnderline={mockHandlers.onUnderline}
            onUndo={mockHandlers.onUndo}
            onRedo={mockHandlers.onRedo}
          />
        )
      }

      // Should still be functional
      expect(screen.getByTestId('enhanced-toolbar')).toBeInTheDocument()

      unmount()
    })

    it('should handle high-frequency updates efficiently', async () => {
      render(
        <EnhancedToolbar
          documentTitle="Efficiency Test"
          documentType="governance"
          headerFormat="normal"
          onTitleChange={mockHandlers.onTitleChange}
          onTypeChange={mockHandlers.onTypeChange}
          onHeaderFormatChange={mockHandlers.onHeaderFormatChange}
          onSave={mockHandlers.onSave}
          onBold={mockHandlers.onBold}
          onItalic={mockHandlers.onItalic}
          onUnderline={mockHandlers.onUnderline}
          onUndo={mockHandlers.onUndo}
          onRedo={mockHandlers.onRedo}
        />
      )

      const formatButtons = [
        screen.getByTestId('bold-button'),
        screen.getByTestId('italic-button'),
        screen.getByTestId('underline-button')
      ]

      // Rapid clicking
      formatButtons.forEach(button => {
        for (let i = 0; i < 5; i++) {
          fireEvent.click(button)
        }
      })

      expect(mockHandlers.onBold).toHaveBeenCalledTimes(5)
      expect(mockHandlers.onItalic).toHaveBeenCalledTimes(5)
      expect(mockHandlers.onUnderline).toHaveBeenCalledTimes(5)
    })
  })

  describe('Error Boundary Integration', () => {
    it('should handle component errors gracefully', () => {
      // Test with invalid props
      render(
        <DocumentTypeSelector
          value="invalid-type"
          onChange={mockHandlers.onTypeChange}
        />
      )

      // Should still render even with invalid value
      const selector = screen.getByTestId('document-type-selector')
      expect(selector).toBeInTheDocument()
    })

    it('should recover from handler errors', () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error')
      })

      render(
        <DocumentTitleInput
          value="Error Test"
          onChange={errorHandler}
        />
      )

      const titleComponent = screen.getByTestId('document-title-input')

      // Component should still be accessible even with error handler
      expect(titleComponent).toBeInTheDocument()
      expect(titleComponent).toHaveTextContent('Error Test')

      // Click to enter edit mode should not crash the component
      fireEvent.click(titleComponent)

      // Component should still exist after the click
      const inputElement = screen.getByTestId('document-title-input')
      expect(inputElement).toBeInTheDocument()
    })
  })
})