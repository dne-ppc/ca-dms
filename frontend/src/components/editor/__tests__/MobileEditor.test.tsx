import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MobileEditor, useTouchGestures } from '../MobileEditor'
import { renderHook, act } from '@testing-library/react'

// Mock QuillEditor
vi.mock('../QuillEditor', () => ({
  QuillEditor: vi.fn(({ onContentChange, readOnly }) => (
    <div data-testid="quill-editor" data-readonly={readOnly}>
      Mock Quill Editor
      <button
        onClick={() => onContentChange?.({ ops: [{ insert: 'test content' }] })}
        data-testid="mock-content-change"
      >
        Change Content
      </button>
    </div>
  ))
}))

// Mock requestFullscreen and exitFullscreen
Object.defineProperty(HTMLDivElement.prototype, 'requestFullscreen', {
  value: vi.fn(),
  writable: true
})

Object.defineProperty(document, 'fullscreenElement', {
  value: null,
  writable: true
})

Object.defineProperty(document, 'exitFullscreen', {
  value: vi.fn(),
  writable: true
})

describe('MobileEditor', () => {
  const mockProps = {
    documentId: 'test-doc-123',
    initialContent: { ops: [{ insert: 'Initial content' }] },
    onContentChange: vi.fn(),
    onSave: vi.fn(),
    readOnly: false
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Task 6.1.1: Mobile editor displays read-only document view', () => {
    it('should display document in read-only mode when readOnly prop is true', () => {
      render(<MobileEditor {...mockProps} readOnly={true} />)

      const quillEditor = screen.getByTestId('quill-editor')
      expect(quillEditor).toHaveAttribute('data-readonly', 'true')

      // Save button should be disabled in read-only mode
      const saveButtons = screen.getAllByRole('button')
      const saveButton = saveButtons.find(button => button.disabled && button.className.includes('bg-blue-600'))
      expect(saveButton).toBeDefined()
      expect(saveButton).toBeDisabled()

      // Status bar should show "Read Only"
      expect(screen.getByText('Read Only')).toBeInTheDocument()
    })

    it('should display document title with document ID', () => {
      render(<MobileEditor {...mockProps} />)

      expect(screen.getByText('Document test-doc-123')).toBeInTheDocument()
    })

    it('should show preview mode when preview toggle is activated', () => {
      render(<MobileEditor {...mockProps} />)

      const previewToggle = screen.getByTitle('Preview Mode')
      fireEvent.click(previewToggle)

      // Editor should be in read-only mode during preview
      const quillEditor = screen.getByTestId('quill-editor')
      expect(quillEditor).toHaveAttribute('data-readonly', 'true')

      // Status should show Preview Mode
      expect(screen.getByText('Preview Mode')).toBeInTheDocument()
    })
  })

  describe('Task 6.1.1: Mobile editor has touch-optimized interface', () => {
    it('should display touch-optimized toolbar buttons', () => {
      render(<MobileEditor {...mockProps} />)

      // Check for touch-friendly toolbar buttons
      const boldButton = screen.getByTitle('Bold')
      const italicButton = screen.getByTitle('Italic')
      const listButton = screen.getByTitle('List')

      expect(boldButton).toBeInTheDocument()
      expect(italicButton).toBeInTheDocument()
      expect(listButton).toBeInTheDocument()

      // Buttons should have adequate touch target size (p-2.5 = 10px padding)
      expect(boldButton).toHaveClass('p-2.5')
    })

    it('should handle virtual keyboard display by hiding toolbar', async () => {
      render(<MobileEditor {...mockProps} />)

      // Simulate virtual keyboard appearing by resizing window
      Object.defineProperty(window, 'innerHeight', { value: 400, writable: true })
      Object.defineProperty(document.documentElement, 'clientHeight', { value: 600, writable: true })

      // Trigger resize event
      fireEvent(window, new Event('resize'))

      await waitFor(() => {
        expect(screen.getByText('Keyboard Active')).toBeInTheDocument()
      })
    })

    it('should allow collapsing and expanding toolbar for better touch experience', () => {
      render(<MobileEditor {...mockProps} />)

      // Find and click the "Hide Toolbar" button
      const hideToolbarButton = screen.getByTitle('Hide Toolbar')
      fireEvent.click(hideToolbarButton)

      // Toolbar should be hidden and show expand option
      expect(screen.getByText('Show Toolbar')).toBeInTheDocument()

      // Click to show toolbar again
      const showToolbarButton = screen.getByText('Show Toolbar')
      fireEvent.click(showToolbarButton)

      // Toolbar should be visible again
      expect(screen.getByTitle('Bold')).toBeInTheDocument()
    })

    it('should support fullscreen mode for immersive editing', () => {
      render(<MobileEditor {...mockProps} />)

      const fullscreenButton = screen.getByTitle('Fullscreen')
      fireEvent.click(fullscreenButton)

      // Should call requestFullscreen on the container
      expect(HTMLDivElement.prototype.requestFullscreen).toHaveBeenCalled()
    })
  })

  describe('Task 6.1.1: Mobile editor shows appropriate restrictions', () => {
    it('should hide editing controls in read-only mode', () => {
      render(<MobileEditor {...mockProps} readOnly={true} />)

      // Toolbar should not be visible in read-only mode
      expect(screen.queryByTitle('Bold')).not.toBeInTheDocument()
      expect(screen.queryByTitle('Italic')).not.toBeInTheDocument()
    })

    it('should disable save button in read-only mode', () => {
      render(<MobileEditor {...mockProps} readOnly={true} />)

      const saveButtons = screen.getAllByRole('button')
      const saveButton = saveButtons.find(button => button.disabled && button.className.includes('bg-blue-600'))
      expect(saveButton).toBeDefined()
      expect(saveButton).toBeDisabled()
      expect(saveButton).toHaveClass('disabled:opacity-50', 'disabled:cursor-not-allowed')
    })

    it('should show editing status in status bar', () => {
      const { rerender } = render(<MobileEditor {...mockProps} readOnly={false} />)
      expect(screen.getByText('Editing')).toBeInTheDocument()

      rerender(<MobileEditor {...mockProps} readOnly={true} />)
      expect(screen.getByText('Read Only')).toBeInTheDocument()
    })

    it('should restrict toolbar visibility when keyboard is active', async () => {
      render(<MobileEditor {...mockProps} />)

      // Simulate virtual keyboard by setting heights to trigger keyboard detection
      Object.defineProperty(window, 'innerHeight', { value: 300, writable: true })
      Object.defineProperty(document.documentElement, 'clientHeight', { value: 500, writable: true })

      fireEvent(window, new Event('resize'))

      await waitFor(() => {
        // Toolbar should be hidden when keyboard is active
        expect(screen.queryByTitle('Bold')).not.toBeInTheDocument()
        expect(screen.getByText('Keyboard Active')).toBeInTheDocument()
      })
    })
  })

  describe('Content and Save Functionality', () => {
    it('should handle content changes', () => {
      render(<MobileEditor {...mockProps} />)

      const mockContentChangeButton = screen.getByTestId('mock-content-change')
      fireEvent.click(mockContentChangeButton)

      expect(mockProps.onContentChange).toHaveBeenCalledWith({ ops: [{ insert: 'test content' }] })
    })

    it('should handle save action', () => {
      render(<MobileEditor {...mockProps} />)

      const saveButtons = screen.getAllByRole('button')
      const saveButton = saveButtons.find(button => button.className.includes('bg-blue-600'))!
      fireEvent.click(saveButton)

      expect(mockProps.onSave).toHaveBeenCalled()
    })
  })
})

describe('useTouchGestures Hook', () => {
  it('should detect swipe gestures correctly', () => {
    const mockEditorRef = { current: null }
    const { result } = renderHook(() => useTouchGestures(mockEditorRef))

    // Mock touch events - note: right swipe means moving from left to right (deltaX < 0)
    const mockTouchStart = {
      targetTouches: [{ clientX: 200, clientY: 100 }]
    } as React.TouchEvent

    const mockTouchMove = {
      targetTouches: [{ clientX: 100, clientY: 100 }]
    } as React.TouchEvent

    let gesture: any = null

    act(() => {
      result.current.handleTouchStart(mockTouchStart)
    })

    act(() => {
      result.current.handleTouchMove(mockTouchMove)
    })

    act(() => {
      gesture = result.current.handleTouchEnd()
    })

    expect(gesture?.type).toBe('swipe-left')
  })

  it('should detect vertical swipe gestures', () => {
    const mockEditorRef = { current: null }
    const { result } = renderHook(() => useTouchGestures(mockEditorRef))

    const mockTouchStart = {
      targetTouches: [{ clientX: 100, clientY: 100 }]
    } as React.TouchEvent

    const mockTouchMove = {
      targetTouches: [{ clientX: 100, clientY: 40 }]  // 60px difference to trigger swipe-up
    } as React.TouchEvent

    let gesture: any = null

    act(() => {
      result.current.handleTouchStart(mockTouchStart)
    })

    act(() => {
      result.current.handleTouchMove(mockTouchMove)
    })

    act(() => {
      gesture = result.current.handleTouchEnd()
    })

    expect(gesture?.type).toBe('swipe-up')
  })

  it('should return null for insufficient swipe distance', () => {
    const mockEditorRef = { current: null }
    const { result } = renderHook(() => useTouchGestures(mockEditorRef))

    const mockTouchStart = {
      targetTouches: [{ clientX: 100, clientY: 100 }]
    } as React.TouchEvent

    const mockTouchMove = {
      targetTouches: [{ clientX: 110, clientY: 100 }]
    } as React.TouchEvent

    let gesture: any = null

    act(() => {
      result.current.handleTouchStart(mockTouchStart)
    })

    act(() => {
      result.current.handleTouchMove(mockTouchMove)
    })

    act(() => {
      gesture = result.current.handleTouchEnd()
    })

    expect(gesture).toBeNull()
  })
})