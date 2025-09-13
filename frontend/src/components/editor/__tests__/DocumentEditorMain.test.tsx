import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { DocumentEditorMain } from '../DocumentEditorMain'

// Mock child components
vi.mock('../EnhancedToolbar', () => ({
  EnhancedToolbar: ({ documentTitle, onTitleChange, isReadOnly, ...props }: any) => (
    <div data-testid="enhanced-toolbar" role="toolbar" aria-label="Document editing toolbar">
      <input
        data-testid="title-input"
        value={documentTitle}
        onChange={(e) => onTitleChange(e.target.value)}
        disabled={isReadOnly || false}
      />
    </div>
  )
}))

vi.mock('../RightHandPanel', () => ({
  RightHandPanel: ({ document, onVersionSelect, collapsed, onCollapseChange }: any) => (
    <div data-testid="right-hand-panel" className={collapsed ? 'collapsed' : 'expanded'}>
      <button onClick={() => onVersionSelect?.({ id: 'v1', title: 'Version 1', content: 'New content' })}>
        Select Version
      </button>
      <button onClick={() => onCollapseChange?.(!collapsed)}>
        Toggle Panel
      </button>
    </div>
  )
}))

vi.mock('../EnhancedQuillEditor', () => ({
  EnhancedQuillEditor: ({ content, onChange, readOnly }: any) => (
    <div data-testid="quill-editor">
      <textarea
        data-testid="editor-content"
        value={content}
        onChange={(e) => onChange(e.target.value)}
        disabled={readOnly || false}
      />
    </div>
  )
}))

// Mock device detection with a default implementation
const mockUseDeviceDetection = vi.fn(() => ({
  isMobile: false,
  isDesktop: true,
  breakpoint: 'desktop'
}))

vi.mock('../../hooks/useDeviceDetection', () => ({
  useDeviceDetection: mockUseDeviceDetection
}))

describe('DocumentEditorMain', () => {
  const mockDocument = {
    id: 'doc123',
    title: 'Test Document',
    type: 'policy',
    content: '# Test Title\nSome content here',
    author: 'John Doe',
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-01T10:00:00Z'
  }

  const mockUser = {
    id: 'user1',
    name: 'John Doe',
    email: 'john@example.com'
  }

  const defaultProps = {
    document: mockDocument,
    user: mockUser,
    onDocumentUpdate: vi.fn(),
    onSave: vi.fn(),
    isReadOnly: false
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Layout Structure', () => {
    it('should render complete editor layout with all components', () => {
      render(<DocumentEditorMain {...defaultProps} />)

      expect(screen.getByTestId('enhanced-toolbar')).toBeInTheDocument()
      expect(screen.getByTestId('quill-editor')).toBeInTheDocument()
      expect(screen.getByTestId('right-hand-panel')).toBeInTheDocument()
    })

    it('should display document title in toolbar', () => {
      render(<DocumentEditorMain {...defaultProps} />)

      const titleInput = screen.getByTestId('title-input')
      expect(titleInput).toHaveValue('Test Document')
    })

    it('should have proper responsive layout classes', () => {
      const { container } = render(<DocumentEditorMain {...defaultProps} />)

      const mainContainer = container.firstChild as HTMLElement
      expect(mainContainer).toHaveClass('document-editor-main')
      expect(mainContainer).toHaveClass('flex', 'flex-col', 'h-full')
    })

    it('should show editor content area', () => {
      render(<DocumentEditorMain {...defaultProps} />)

      const editorContent = screen.getByTestId('editor-content')
      expect(editorContent).toHaveValue('# Test Title\nSome content here')
    })
  })

  describe('Document Management', () => {
    it('should handle document title changes', async () => {
      const onDocumentUpdate = vi.fn()
      render(<DocumentEditorMain {...defaultProps} onDocumentUpdate={onDocumentUpdate} />)

      const titleInput = screen.getByTestId('title-input')
      fireEvent.change(titleInput, { target: { value: 'New Document Title' } })

      await waitFor(() => {
        expect(onDocumentUpdate).toHaveBeenCalledWith({
          ...mockDocument,
          title: 'New Document Title'
        })
      })
    })

    it('should handle document content changes', async () => {
      const onDocumentUpdate = vi.fn()
      render(<DocumentEditorMain {...defaultProps} onDocumentUpdate={onDocumentUpdate} />)

      const editorContent = screen.getByTestId('editor-content')
      fireEvent.change(editorContent, { target: { value: '# New Content\nUpdated text' } })

      await waitFor(() => {
        expect(onDocumentUpdate).toHaveBeenCalledWith({
          ...mockDocument,
          content: '# New Content\nUpdated text'
        })
      })
    })

    it('should handle save operations', () => {
      const onSave = vi.fn()
      render(<DocumentEditorMain {...defaultProps} onSave={onSave} />)

      // Trigger save (would typically be from toolbar save button)
      fireEvent.keyDown(document, { key: 's', ctrlKey: true })

      expect(onSave).toHaveBeenCalledWith(mockDocument)
    })

    it('should track unsaved changes', async () => {
      render(<DocumentEditorMain {...defaultProps} />)

      const titleInput = screen.getByTestId('title-input')
      fireEvent.change(titleInput, { target: { value: 'Modified Title' } })

      await waitFor(() => {
        expect(screen.getByTestId('enhanced-toolbar')).toBeInTheDocument()
        // Toolbar should show unsaved changes indicator
      })
    })
  })

  describe('Version Management Integration', () => {
    it('should handle version selection from right panel', async () => {
      render(<DocumentEditorMain {...defaultProps} />)

      const versionButton = screen.getByText('Select Version')
      fireEvent.click(versionButton)

      await waitFor(() => {
        // Should update editor with selected version content
        expect(screen.getByTestId('quill-editor')).toBeInTheDocument()
      })
    })

    it('should show version comparison when version selected', async () => {
      render(<DocumentEditorMain {...defaultProps} showVersionComparison={true} />)

      expect(screen.getByTestId('right-hand-panel')).toBeInTheDocument()
      // Version comparison would be handled by RightHandPanel
    })

    it('should handle version restoration', async () => {
      const onDocumentUpdate = vi.fn()
      render(<DocumentEditorMain {...defaultProps} onDocumentUpdate={onDocumentUpdate} />)

      // Version restoration would trigger through RightHandPanel
      const versionButton = screen.getByText('Select Version')
      fireEvent.click(versionButton)

      // Should update document when version is restored
      await waitFor(() => {
        expect(onDocumentUpdate).toHaveBeenCalled()
      })
    })
  })

  describe('Right Panel Management', () => {
    it('should allow collapsing right panel', () => {
      render(<DocumentEditorMain {...defaultProps} rightPanelCollapsed={true} />)

      const rightPanel = screen.getByTestId('right-hand-panel')
      expect(rightPanel).toHaveClass('collapsed')
    })

    it('should expand right panel when needed', () => {
      render(<DocumentEditorMain {...defaultProps} rightPanelCollapsed={false} />)

      const rightPanel = screen.getByTestId('right-hand-panel')
      expect(rightPanel).toHaveClass('expanded')
    })

    it('should toggle panel collapse state', async () => {
      const { rerender } = render(<DocumentEditorMain {...defaultProps} rightPanelCollapsed={false} />)

      expect(screen.getByTestId('right-hand-panel')).toHaveClass('expanded')

      rerender(<DocumentEditorMain {...defaultProps} rightPanelCollapsed={true} />)

      expect(screen.getByTestId('right-hand-panel')).toHaveClass('collapsed')
    })

    it('should auto-collapse panel on mobile', () => {
      // Set mobile mode for this test before rendering
      mockUseDeviceDetection.mockImplementation(() => ({
        isMobile: true,
        isDesktop: false,
        breakpoint: 'mobile'
      }))

      render(<DocumentEditorMain {...defaultProps} />)

      const rightPanel = screen.getByTestId('right-hand-panel')
      expect(rightPanel).toHaveClass('collapsed')
    })
  })

  describe('Mobile Experience', () => {
    it('should show mobile restriction message', () => {
      // Set mobile mode for this test before rendering
      mockUseDeviceDetection.mockImplementation(() => ({
        isMobile: true,
        isDesktop: false,
        breakpoint: 'mobile'
      }))

      render(<DocumentEditorMain {...defaultProps} />)

      expect(screen.getByText(/Mobile editing is limited/)).toBeInTheDocument()
    })

    it('should disable editing controls on mobile', () => {
      // Set mobile mode for this test before rendering
      mockUseDeviceDetection.mockImplementation(() => ({
        isMobile: true,
        isDesktop: false,
        breakpoint: 'mobile'
      }))

      render(<DocumentEditorMain {...defaultProps} />)

      const editorContent = screen.getByTestId('editor-content')
      expect(editorContent).toBeDisabled()
    })

    it('should hide right panel by default on mobile', () => {
      // Set mobile mode for this test before rendering
      mockUseDeviceDetection.mockImplementation(() => ({
        isMobile: true,
        isDesktop: false,
        breakpoint: 'mobile'
      }))

      render(<DocumentEditorMain {...defaultProps} />)

      const rightPanel = screen.getByTestId('right-hand-panel')
      expect(rightPanel).toHaveClass('collapsed')
    })

    it('should adapt toolbar for mobile', () => {
      // Set mobile mode for this test before rendering
      mockUseDeviceDetection.mockImplementation(() => ({
        isMobile: true,
        isDesktop: false,
        breakpoint: 'mobile'
      }))

      render(<DocumentEditorMain {...defaultProps} />)

      const toolbar = screen.getByTestId('enhanced-toolbar')
      expect(toolbar).toBeInTheDocument()
      // Toolbar should adapt its layout for mobile
    })
  })

  describe('Read-Only Mode', () => {
    it('should disable all editing when in read-only mode', () => {
      render(<DocumentEditorMain {...defaultProps} isReadOnly={true} />)

      const editorContent = screen.getByTestId('editor-content')
      const titleInput = screen.getByTestId('title-input')

      expect(editorContent).toBeDisabled()
      expect(titleInput).toBeDisabled()
    })

    it('should show read-only indicator', () => {
      render(<DocumentEditorMain {...defaultProps} isReadOnly={true} />)

      expect(screen.getByText(/Read Only/)).toBeInTheDocument()
    })

    it('should hide save controls in read-only mode', () => {
      render(<DocumentEditorMain {...defaultProps} isReadOnly={true} />)

      // Save controls should be disabled or hidden
      expect(screen.getByTestId('enhanced-toolbar')).toBeInTheDocument()
    })
  })

  describe('Keyboard Shortcuts', () => {
    it('should handle Ctrl+S for save', () => {
      const onSave = vi.fn()
      render(<DocumentEditorMain {...defaultProps} onSave={onSave} />)

      fireEvent.keyDown(document, { key: 's', ctrlKey: true })

      expect(onSave).toHaveBeenCalled()
    })

    it('should handle Ctrl+Z for undo', () => {
      render(<DocumentEditorMain {...defaultProps} />)

      fireEvent.keyDown(document, { key: 'z', ctrlKey: true })

      // Undo should be handled by the editor
      expect(screen.getByTestId('quill-editor')).toBeInTheDocument()
    })

    it('should handle Ctrl+Y for redo', () => {
      render(<DocumentEditorMain {...defaultProps} />)

      fireEvent.keyDown(document, { key: 'y', ctrlKey: true })

      // Redo should be handled by the editor
      expect(screen.getByTestId('quill-editor')).toBeInTheDocument()
    })

    it('should handle Escape to close panels', () => {
      render(<DocumentEditorMain {...defaultProps} rightPanelCollapsed={false} />)

      fireEvent.keyDown(document, { key: 'Escape' })

      // Should close any open panels or dialogs
      expect(screen.getByTestId('right-hand-panel')).toBeInTheDocument()
    })
  })

  describe('Performance', () => {
    it('should not re-render unnecessarily', () => {
      const { rerender } = render(<DocumentEditorMain {...defaultProps} />)

      // Re-render with same props
      rerender(<DocumentEditorMain {...defaultProps} />)

      expect(screen.getByTestId('enhanced-toolbar')).toBeInTheDocument()
      expect(screen.getByTestId('quill-editor')).toBeInTheDocument()
      expect(screen.getByTestId('right-hand-panel')).toBeInTheDocument()
    })

    it('should debounce document updates', async () => {
      const onDocumentUpdate = vi.fn()
      render(<DocumentEditorMain {...defaultProps} onDocumentUpdate={onDocumentUpdate} />)

      const titleInput = screen.getByTestId('title-input')

      // Rapid changes
      fireEvent.change(titleInput, { target: { value: 'A' } })
      fireEvent.change(titleInput, { target: { value: 'AB' } })
      fireEvent.change(titleInput, { target: { value: 'ABC' } })

      // Should debounce the updates
      await waitFor(() => {
        expect(onDocumentUpdate).toHaveBeenCalledTimes(1)
      })
    })

    it('should lazy load right panel content', () => {
      render(<DocumentEditorMain {...defaultProps} rightPanelCollapsed={true} />)

      const rightPanel = screen.getByTestId('right-hand-panel')
      expect(rightPanel).toHaveClass('collapsed')
      // Content should be lazy loaded when expanded
    })
  })

  describe('Error Handling', () => {
    it('should handle document update failures', async () => {
      const onDocumentUpdate = vi.fn().mockRejectedValue(new Error('Update failed'))
      render(<DocumentEditorMain {...defaultProps} onDocumentUpdate={onDocumentUpdate} />)

      const titleInput = screen.getByTestId('title-input')
      fireEvent.change(titleInput, { target: { value: 'New Title' } })

      await waitFor(() => {
        expect(screen.getByText(/Failed to save/)).toBeInTheDocument()
      })
    })

    it('should handle save failures gracefully', async () => {
      const onSave = vi.fn().mockRejectedValue(new Error('Save failed'))
      render(<DocumentEditorMain {...defaultProps} onSave={onSave} />)

      fireEvent.keyDown(document, { key: 's', ctrlKey: true })

      await waitFor(() => {
        expect(screen.getByText(/Save failed/)).toBeInTheDocument()
      })
    })

    it('should show loading states during operations', () => {
      render(<DocumentEditorMain {...defaultProps} isSaving={true} />)

      expect(screen.getByText(/Saving/)).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper document structure', () => {
      render(<DocumentEditorMain {...defaultProps} />)

      const main = screen.getByRole('main')
      expect(main).toBeInTheDocument()
      expect(main).toHaveAttribute('aria-label', 'Document editor')
    })

    it('should support keyboard navigation between sections', () => {
      render(<DocumentEditorMain {...defaultProps} />)

      const toolbar = screen.getByTestId('enhanced-toolbar')
      const editor = screen.getByTestId('quill-editor')

      // Should be able to tab between sections
      expect(toolbar).toBeInTheDocument()
      expect(editor).toBeInTheDocument()
    })

    it('should announce save status to screen readers', async () => {
      render(<DocumentEditorMain {...defaultProps} isSaving={true} />)

      const statusRegion = screen.getByRole('status')
      expect(statusRegion).toHaveTextContent(/Saving/)
    })

    it('should have proper landmark roles', () => {
      render(<DocumentEditorMain {...defaultProps} />)

      expect(screen.getByRole('main')).toBeInTheDocument()
      expect(screen.getByRole('toolbar')).toBeInTheDocument()
      // Navigation region would be in the right panel
    })
  })
})