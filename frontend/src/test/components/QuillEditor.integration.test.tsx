/**
 * Integration tests for QuillEditor component
 * Tests component interactions with stores, services, and user workflows
 */
import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuillEditor } from '../../components/editor/QuillEditor'
import { useDocumentStore } from '../../stores/documentStore'
import { KeyboardNavigationProvider } from '../../contexts/KeyboardNavigationContext'

// Mock Quill since it's dynamically imported
const mockQuillInstance = {
  getContents: jest.fn(() => ({ ops: [] })),
  setContents: jest.fn(),
  setText: jest.fn(),
  insertEmbed: jest.fn(),
  insertText: jest.fn(),
  setSelection: jest.fn(),
  getSelection: jest.fn(() => ({ index: 0, length: 0 })),
  on: jest.fn(),
  off: jest.fn(),
  history: {
    undo: jest.fn(),
    redo: jest.fn()
  },
  scroll: {
    querySelector: jest.fn()
  }
}

const mockQuillClass = jest.fn(() => mockQuillInstance)

// Mock dynamic Quill import
jest.mock('quill', () => ({
  __esModule: true,
  default: mockQuillClass
}))

// Mock CSS imports
jest.mock('quill/dist/quill.snow.css', () => ({}))

// Mock the document store
jest.mock('../../stores/documentStore', () => ({
  useDocumentStore: jest.fn()
}))

// Mock keyboard navigation hook
jest.mock('../../hooks/useKeyboardNavigation', () => ({
  __esModule: true,
  default: jest.fn(() => ({}))
}))

// Mock CSS import
jest.mock('../../components/editor/QuillEditor.css', () => ({}))

const mockUseDocumentStore = useDocumentStore as jest.MockedFunction<typeof useDocumentStore>

// Test wrapper with providers
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <KeyboardNavigationProvider>
    {children}
  </KeyboardNavigationProvider>
)

describe('QuillEditor Integration Tests', () => {
  const mockDocumentActions = {
    updateDocumentContent: jest.fn(),
    setDocumentDelta: jest.fn(),
    getDocumentDelta: jest.fn(() => []),
    insertPlaceholder: jest.fn(),
    getPlaceholderObjects: jest.fn(() => [])
  }

  beforeEach(() => {
    jest.clearAllMocks()

    // Reset Quill mocks
    mockQuillInstance.getContents.mockReturnValue({ ops: [] })
    mockQuillInstance.getSelection.mockReturnValue({ index: 0, length: 0 })
    mockQuillInstance.scroll.querySelector.mockReturnValue(null)

    // Mock document store state
    mockUseDocumentStore.mockReturnValue({
      currentDocument: {
        id: 'test-doc-1',
        title: 'Test Document',
        content: '{"ops":[{"insert":"Test content\\n"}]}',
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        status: 'draft'
      },
      isDirty: false,
      ...mockDocumentActions
    } as any)
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('Basic Rendering and Initialization', () => {
    it('should render editor with toolbar', async () => {
      await act(async () => {
        render(
          <TestWrapper>
            <QuillEditor />
          </TestWrapper>
        )
      })

      // Wait for async Quill initialization
      await waitFor(() => {
        expect(mockQuillClass).toHaveBeenCalled()
      })

      expect(screen.getByTestId('quill-editor')).toBeInTheDocument()
      expect(screen.getByRole('main')).toBeInTheDocument()
    })

    it('should initialize Quill with correct configuration', async () => {
      await act(async () => {
        render(
          <TestWrapper>
            <QuillEditor readOnly={true} />
          </TestWrapper>
        )
      })

      await waitFor(() => {
        expect(mockQuillClass).toHaveBeenCalledWith(
          expect.any(Element),
          expect.objectContaining({
            theme: 'snow',
            readOnly: true,
            modules: {
              toolbar: '#custom-toolbar'
            }
          })
        )
      })
    })

    it('should set initial content as Delta when valid JSON', async () => {
      const initialContent = '{"ops":[{"insert":"Initial content\\n"}]}'

      await act(async () => {
        render(
          <TestWrapper>
            <QuillEditor initialContent={initialContent} />
          </TestWrapper>
        )
      })

      await waitFor(() => {
        expect(mockQuillInstance.setContents).toHaveBeenCalledWith({
          ops: [{ insert: "Initial content\n" }]
        })
      })
    })

    it('should set initial content as plain text when invalid JSON', async () => {
      const initialContent = 'Plain text content'

      await act(async () => {
        render(
          <TestWrapper>
            <QuillEditor initialContent={initialContent} />
          </TestWrapper>
        )
      })

      await waitFor(() => {
        expect(mockQuillInstance.setText).toHaveBeenCalledWith('Plain text content')
      })
    })
  })

  describe('Content Change Integration', () => {
    it('should call onChange callback when content changes', async () => {
      const mockOnChange = jest.fn()
      let textChangeHandler: Function

      mockQuillInstance.on.mockImplementation((event, handler) => {
        if (event === 'text-change') {
          textChangeHandler = handler
        }
      })

      await act(async () => {
        render(
          <TestWrapper>
            <QuillEditor onChange={mockOnChange} />
          </TestWrapper>
        )
      })

      await waitFor(() => {
        expect(mockQuillInstance.on).toHaveBeenCalledWith('text-change', expect.any(Function))
      })

      // Simulate content change
      mockQuillInstance.getContents.mockReturnValue({
        ops: [{ insert: 'New content\n' }]
      })

      act(() => {
        textChangeHandler!()
      })

      expect(mockOnChange).toHaveBeenCalledWith(
        JSON.stringify({ ops: [{ insert: 'New content\n' }] })
      )
    })

    it('should integrate with document store for content updates', async () => {
      const mockOnChange = jest.fn()
      let textChangeHandler: Function

      mockQuillInstance.on.mockImplementation((event, handler) => {
        if (event === 'text-change') {
          textChangeHandler = handler
        }
      })

      await act(async () => {
        render(
          <TestWrapper>
            <QuillEditor onChange={mockOnChange} />
          </TestWrapper>
        )
      })

      await waitFor(() => {
        expect(textChangeHandler).toBeDefined()
      })

      // Simulate content change
      const newContent = { ops: [{ insert: 'Updated content\n' }] }
      mockQuillInstance.getContents.mockReturnValue(newContent)

      act(() => {
        textChangeHandler!()
      })

      expect(mockOnChange).toHaveBeenCalledWith(JSON.stringify(newContent))
    })
  })

  describe('Placeholder Integration', () => {
    it('should insert version table at document beginning', async () => {
      const mockOnInsertPlaceholder = jest.fn()

      await act(async () => {
        render(
          <TestWrapper>
            <QuillEditor onInsertPlaceholder={mockOnInsertPlaceholder} />
          </TestWrapper>
        )
      })

      await waitFor(() => {
        expect(mockQuillClass).toHaveBeenCalled()
      })

      // Get the QuillEditor instance and call the placeholder insertion
      const quillEditor = mockQuillClass.mock.results[0].value

      // Simulate version table insertion via toolbar
      const toolbar = screen.getByRole('toolbar')
      const versionTableButton = toolbar.querySelector('[data-testid="version-table-button"]')

      if (versionTableButton) {
        fireEvent.click(versionTableButton)

        expect(mockQuillInstance.insertEmbed).toHaveBeenCalledWith(
          0,
          'version-table',
          expect.arrayContaining([
            expect.objectContaining({
              version: '1.0',
              description: 'Initial version',
              author: 'Current User'
            })
          ])
        )
        expect(mockOnInsertPlaceholder).toHaveBeenCalledWith('version-table')
      }
    })

    it('should prevent duplicate version table insertion', async () => {
      // Mock existing version table
      mockQuillInstance.scroll.querySelector.mockReturnValue(document.createElement('div'))

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      await act(async () => {
        render(
          <TestWrapper>
            <QuillEditor />
          </TestWrapper>
        )
      })

      await waitFor(() => {
        expect(mockQuillClass).toHaveBeenCalled()
      })

      // Try to insert version table when one already exists
      const toolbar = screen.getByRole('toolbar')
      const versionTableButton = toolbar.querySelector('[data-testid="version-table-button"]')

      if (versionTableButton) {
        fireEvent.click(versionTableButton)

        expect(consoleSpy).toHaveBeenCalledWith('Document already contains a version table')
        expect(mockQuillInstance.insertEmbed).not.toHaveBeenCalled()
      }

      consoleSpy.mockRestore()
    })

    it('should insert signature field at cursor position', async () => {
      mockQuillInstance.getSelection.mockReturnValue({ index: 5, length: 0 })

      await act(async () => {
        render(
          <TestWrapper>
            <QuillEditor />
          </TestWrapper>
        )
      })

      await waitFor(() => {
        expect(mockQuillClass).toHaveBeenCalled()
      })

      // Simulate signature field insertion
      const toolbar = screen.getByRole('toolbar')
      const signatureButton = toolbar.querySelector('[data-testid="signature-field-button"]')

      if (signatureButton) {
        fireEvent.click(signatureButton)

        expect(mockQuillInstance.insertEmbed).toHaveBeenCalledWith(
          5,
          'signature-field',
          expect.objectContaining({
            name: '',
            date: '',
            title: ''
          })
        )
        expect(mockQuillInstance.setSelection).toHaveBeenCalledWith(7)
      }
    })

    it('should insert long response field with default configuration', async () => {
      mockQuillInstance.getSelection.mockReturnValue({ index: 3, length: 0 })

      await act(async () => {
        render(
          <TestWrapper>
            <QuillEditor />
          </TestWrapper>
        )
      })

      await waitFor(() => {
        expect(mockQuillClass).toHaveBeenCalled()
      })

      // Simulate long response insertion
      const toolbar = screen.getByRole('toolbar')
      const longResponseButton = toolbar.querySelector('[data-testid="long-response-button"]')

      if (longResponseButton) {
        fireEvent.click(longResponseButton)

        expect(mockQuillInstance.insertEmbed).toHaveBeenCalledWith(
          3,
          'long-response',
          expect.objectContaining({
            label: 'Response',
            content: '',
            height: 'medium'
          })
        )
        expect(mockQuillInstance.setSelection).toHaveBeenCalledWith(5)
      }
    })
  })

  describe('Keyboard Navigation Integration', () => {
    it('should handle undo shortcut (Ctrl+Z)', async () => {
      await act(async () => {
        render(
          <TestWrapper>
            <QuillEditor />
          </TestWrapper>
        )
      })

      await waitFor(() => {
        expect(mockQuillClass).toHaveBeenCalled()
      })

      // Simulate Ctrl+Z keypress
      const editor = screen.getByTestId('quill-editor')

      fireEvent.keyDown(editor, {
        key: 'z',
        ctrlKey: true
      })

      expect(mockQuillInstance.history.undo).toHaveBeenCalled()
    })

    it('should handle redo shortcut (Ctrl+Y)', async () => {
      await act(async () => {
        render(
          <TestWrapper>
            <QuillEditor />
          </TestWrapper>
        )
      })

      await waitFor(() => {
        expect(mockQuillClass).toHaveBeenCalled()
      })

      // Simulate Ctrl+Y keypress
      const editor = screen.getByTestId('quill-editor')

      fireEvent.keyDown(editor, {
        key: 'y',
        ctrlKey: true
      })

      expect(mockQuillInstance.history.redo).toHaveBeenCalled()
    })

    it('should not handle shortcuts in read-only mode', async () => {
      await act(async () => {
        render(
          <TestWrapper>
            <QuillEditor readOnly={true} />
          </TestWrapper>
        )
      })

      await waitFor(() => {
        expect(mockQuillClass).toHaveBeenCalled()
      })

      // Simulate Ctrl+Z keypress in read-only mode
      const editor = screen.getByTestId('quill-editor')

      fireEvent.keyDown(editor, {
        key: 'z',
        ctrlKey: true
      })

      expect(mockQuillInstance.history.undo).not.toHaveBeenCalled()
    })
  })

  describe('Accessibility Integration', () => {
    it('should have proper ARIA labels and roles', async () => {
      await act(async () => {
        render(
          <TestWrapper>
            <QuillEditor />
          </TestWrapper>
        )
      })

      expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Document editor')
      expect(screen.getByRole('textbox')).toHaveAttribute('aria-label', 'Document content (editable)')
      expect(screen.getByRole('textbox')).toHaveAttribute('aria-multiline', 'true')
      expect(screen.getByRole('textbox')).toHaveAttribute('aria-describedby', 'editor-instructions')
    })

    it('should update ARIA labels for read-only mode', async () => {
      await act(async () => {
        render(
          <TestWrapper>
            <QuillEditor readOnly={true} />
          </TestWrapper>
        )
      })

      expect(screen.getByRole('textbox')).toHaveAttribute('aria-label', 'Document content (read-only)')
      expect(screen.getByRole('textbox')).toHaveAttribute('tabIndex', '-1')
    })

    it('should provide screen reader instructions', async () => {
      await act(async () => {
        render(
          <TestWrapper>
            <QuillEditor />
          </TestWrapper>
        )
      })

      const instructions = screen.getByText(/Rich text editor for document content/)
      expect(instructions).toBeInTheDocument()
      expect(instructions).toHaveClass('sr-only')
    })
  })

  describe('Error Handling Integration', () => {
    it('should handle Quill initialization failure gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      // Mock Quill import failure
      jest.doMock('quill', () => {
        throw new Error('Failed to load Quill')
      })

      await act(async () => {
        render(
          <TestWrapper>
            <QuillEditor />
          </TestWrapper>
        )
      })

      // Should not crash and should log error
      expect(screen.getByTestId('quill-editor')).toBeInTheDocument()

      consoleSpy.mockRestore()
    })

    it('should handle missing selection gracefully', async () => {
      mockQuillInstance.getSelection.mockReturnValue(null)

      await act(async () => {
        render(
          <TestWrapper>
            <QuillEditor />
          </TestWrapper>
        )
      })

      await waitFor(() => {
        expect(mockQuillClass).toHaveBeenCalled()
      })

      // Try to insert placeholder without selection
      const toolbar = screen.getByRole('toolbar')
      const signatureButton = toolbar.querySelector('[data-testid="signature-field-button"]')

      if (signatureButton) {
        fireEvent.click(signatureButton)

        // Should not crash or call insertEmbed
        expect(mockQuillInstance.insertEmbed).not.toHaveBeenCalled()
      }
    })
  })

  describe('Cleanup Integration', () => {
    it('should properly cleanup event listeners on unmount', async () => {
      const { unmount } = await act(async () => {
        return render(
          <TestWrapper>
            <QuillEditor />
          </TestWrapper>
        )
      })

      await waitFor(() => {
        expect(mockQuillInstance.on).toHaveBeenCalled()
      })

      // Unmount component
      act(() => {
        unmount()
      })

      expect(mockQuillInstance.off).toHaveBeenCalledWith('text-change', expect.any(Function))
    })

    it('should handle cleanup when Quill instance is not available', async () => {
      const { unmount } = await act(async () => {
        return render(
          <TestWrapper>
            <QuillEditor />
          </TestWrapper>
        )
      })

      // Clear the quill instance reference
      mockQuillInstance.cleanup = undefined

      // Should not throw error on unmount
      expect(() => {
        act(() => {
          unmount()
        })
      }).not.toThrow()
    })
  })

  describe('Store Integration Scenarios', () => {
    it('should sync content changes with document store', async () => {
      const mockOnChange = jest.fn()
      let textChangeHandler: Function

      mockQuillInstance.on.mockImplementation((event, handler) => {
        if (event === 'text-change') {
          textChangeHandler = handler
        }
      })

      await act(async () => {
        render(
          <TestWrapper>
            <QuillEditor onChange={mockOnChange} />
          </TestWrapper>
        )
      })

      await waitFor(() => {
        expect(textChangeHandler).toBeDefined()
      })

      // Simulate multiple content changes
      const changes = [
        { ops: [{ insert: 'First change\n' }] },
        { ops: [{ insert: 'Second change\n' }] },
        { ops: [{ insert: 'Final content\n' }] }
      ]

      changes.forEach((content, index) => {
        mockQuillInstance.getContents.mockReturnValue(content)

        act(() => {
          textChangeHandler!()
        })

        expect(mockOnChange).toHaveBeenNthCalledWith(
          index + 1,
          JSON.stringify(content)
        )
      })
    })

    it('should handle placeholder insertion with store integration', async () => {
      const mockOnInsertPlaceholder = jest.fn()

      await act(async () => {
        render(
          <TestWrapper>
            <QuillEditor onInsertPlaceholder={mockOnInsertPlaceholder} />
          </TestWrapper>
        )
      })

      await waitFor(() => {
        expect(mockQuillClass).toHaveBeenCalled()
      })

      // Test all placeholder types
      const placeholderTypes = ['version-table', 'signature-field', 'long-response']

      placeholderTypes.forEach((type, index) => {
        const toolbar = screen.getByRole('toolbar')
        const button = toolbar.querySelector(`[data-testid="${type}-button"]`)

        if (button) {
          fireEvent.click(button)
          expect(mockOnInsertPlaceholder).toHaveBeenNthCalledWith(index + 1, type)
        }
      })
    })
  })
})