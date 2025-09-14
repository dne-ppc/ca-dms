import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FormatControls } from '../FormatControls'

// Mock Quill editor
const mockEditor = {
  getSelection: vi.fn(),
  getLine: vi.fn(),
  deleteText: vi.fn(),
  insertText: vi.fn(),
  formatLine: vi.fn(),
  setSelection: vi.fn(),
  on: vi.fn(),
  off: vi.fn()
}

describe('FormatControls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should not render any visible UI', () => {
    const { container } = render(
      <FormatControls
        editor={mockEditor}
        headerFormat="normal"
        onHeaderFormatChange={vi.fn()}
      />
    )

    expect(container.firstChild).toBeNull()
  })

  it('should set up editor event listeners', () => {
    render(
      <FormatControls
        editor={mockEditor}
        headerFormat="normal"
        onHeaderFormatChange={vi.fn()}
      />
    )

    expect(mockEditor.on).toHaveBeenCalledWith('selection-change', expect.any(Function))
    expect(mockEditor.on).toHaveBeenCalledWith('text-change', expect.any(Function))
  })

  it('should clean up event listeners on unmount', () => {
    const { unmount } = render(
      <FormatControls
        editor={mockEditor}
        headerFormat="normal"
        onHeaderFormatChange={vi.fn()}
      />
    )

    unmount()

    expect(mockEditor.off).toHaveBeenCalledWith('selection-change', expect.any(Function))
    expect(mockEditor.off).toHaveBeenCalledWith('text-change', expect.any(Function))
  })

  it('should handle header format changes when editor is available', () => {
    const mockSelection = { index: 10 }
    const mockLine = [{
      domNode: { textContent: 'Sample text' }
    }, 0]

    mockEditor.getSelection.mockReturnValue(mockSelection)
    mockEditor.getLine.mockReturnValue(mockLine)

    render(
      <FormatControls
        editor={mockEditor}
        headerFormat="h1"
        onHeaderFormatChange={vi.fn()}
      />
    )

    // FormatControls should attempt to apply H1 formatting
    expect(mockEditor.getSelection).toHaveBeenCalled()
  })

  it('should gracefully handle editor errors', () => {
    const mockSelection = { index: 10 }
    mockEditor.getSelection.mockReturnValue(mockSelection)
    mockEditor.getLine.mockImplementation(() => {
      throw new Error('Editor error')
    })

    // Should not throw error during render - errors are caught in detectCurrentFormat
    const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})

    expect(() => {
      render(
        <FormatControls
          editor={mockEditor}
          headerFormat="normal"
          onHeaderFormatChange={vi.fn()}
        />
      )
    }).not.toThrow()

    consoleSpy.mockRestore()
  })
})