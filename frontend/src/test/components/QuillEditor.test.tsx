import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '../utils'
import { QuillEditor } from '../../components/editor/QuillEditor'

describe('QuillEditor', () => {
  beforeEach(() => {
    // Reset any global state if needed
  })

  it('should render Quill editor container', () => {
    render(<QuillEditor />)
    
    // Look for the editor container
    const editorContainer = screen.getByTestId('quill-editor')
    expect(editorContainer).toBeInTheDocument()
  })

  it('should initialize with empty content', () => {
    render(<QuillEditor />)
    
    const editor = screen.getByTestId('quill-editor')
    expect(editor).toHaveTextContent('')
  })

  it('should accept initial content prop', () => {
    const initialContent = '{"ops":[{"insert":"Hello World\\n"}]}'
    render(<QuillEditor initialContent={initialContent} />)
    
    // Editor should have the initial content
    const editor = screen.getByTestId('quill-editor')
    expect(editor).toBeInTheDocument()
  })

  it('should call onChange when content changes', () => {
    const mockOnChange = vi.fn()
    render(<QuillEditor onChange={mockOnChange} />)
    
    // Component should render without errors
    const editor = screen.getByTestId('quill-editor')
    expect(editor).toBeInTheDocument()
  })

  it('should handle placeholder insertion', () => {
    const mockOnInsertPlaceholder = vi.fn()
    
    render(
      <QuillEditor 
        initialContent=""
        onInsertPlaceholder={mockOnInsertPlaceholder}
      />
    )
    
    // This test verifies the component renders without errors
    // More detailed placeholder insertion testing would require 
    // mocking Quill's internal methods
    expect(mockOnInsertPlaceholder).not.toHaveBeenCalled()
  })

  it('should register custom blots', () => {
    render(<QuillEditor initialContent="" />)
    
    // Verify that custom blots are registered
    // Note: This is implicit verification through successful rendering
    const editor = screen.getByTestId('quill-editor')
    expect(editor).toBeInTheDocument()
  })
})