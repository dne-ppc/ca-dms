import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { EnhancedToolbar } from './EnhancedToolbar'

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  Bold: () => <div data-testid="bold-icon">Bold</div>,
  Italic: () => <div data-testid="italic-icon">Italic</div>,
  Underline: () => <div data-testid="underline-icon">Underline</div>,
  Strikethrough: () => <div data-testid="strikethrough-icon">Strikethrough</div>,
  Undo: () => <div data-testid="undo-icon">Undo</div>,
  Redo: () => <div data-testid="redo-icon">Redo</div>,
  Save: () => <div data-testid="save-icon">Save</div>,
  AlertCircle: () => <div data-testid="alert-icon">Alert</div>,
  FileText: () => <div data-testid="file-icon">FileText</div>,
  List: () => <div data-testid="list-icon">List</div>,
  ListOrdered: () => <div data-testid="list-ordered-icon">ListOrdered</div>,
  AlignLeft: () => <div data-testid="align-left-icon">AlignLeft</div>,
  AlignCenter: () => <div data-testid="align-center-icon">AlignCenter</div>,
  AlignRight: () => <div data-testid="align-right-icon">AlignRight</div>,
  AlignJustify: () => <div data-testid="align-justify-icon">AlignJustify</div>,
}))

// Mock child components
vi.mock('./DocumentTitleInput', () => ({
  DocumentTitleInput: ({ value, onChange }: any) => (
    <input data-testid="document-title" value={value} onChange={(e) => onChange(e.target.value)} />
  )
}))

vi.mock('./DocumentTypeSelector', () => ({
  DocumentTypeSelector: ({ value, onChange }: any) => (
    <select data-testid="document-type" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="normal">Normal Text</option>
      <option value="memo">Memo</option>
    </select>
  )
}))

vi.mock('./HeaderFormatSelector', () => ({
  HeaderFormatSelector: ({ value, onChange }: any) => (
    <select data-testid="header-format" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="normal">Normal</option>
      <option value="h1">Heading 1</option>
    </select>
  )
}))

vi.mock('./DigitalSignatureButton', () => ({
  DigitalSignatureButton: () => <button data-testid="signature-button">Sign</button>
}))

vi.mock('./AdvancedReportingButton', () => ({
  AdvancedReportingButton: () => <button data-testid="reporting-button">Reports</button>
}))

describe('EnhancedToolbar List Functionality', () => {
  const mockProps = {
    documentTitle: 'Test Document',
    documentType: 'normal',
    headerFormat: 'normal',
    onTitleChange: vi.fn(),
    onTypeChange: vi.fn(),
    onHeaderFormatChange: vi.fn(),
    onSave: vi.fn(),
    onBold: vi.fn(),
    onItalic: vi.fn(),
    onUnderline: vi.fn(),
    onStrikethrough: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onBulletList: vi.fn(),
    onNumberedList: vi.fn(),
    onAlignLeft: vi.fn(),
    onAlignCenter: vi.fn(),
    onAlignRight: vi.fn(),
    onAlignJustify: vi.fn(),
  }

  it('should render bullet list button', () => {
    render(<EnhancedToolbar {...mockProps} />)
    const bulletListButton = screen.getByTestId('bullet-list-button')
    expect(bulletListButton).toBeInTheDocument()
    expect(bulletListButton).toHaveAttribute('title', 'Bullet List')
  })

  it('should render numbered list button', () => {
    render(<EnhancedToolbar {...mockProps} />)
    const numberedListButton = screen.getByTestId('numbered-list-button')
    expect(numberedListButton).toBeInTheDocument()
    expect(numberedListButton).toHaveAttribute('title', 'Numbered List')
  })

  it('should call onBulletList when bullet list button is clicked', () => {
    render(<EnhancedToolbar {...mockProps} />)
    const bulletListButton = screen.getByTestId('bullet-list-button')
    fireEvent.click(bulletListButton)
    expect(mockProps.onBulletList).toHaveBeenCalledTimes(1)
  })

  it('should call onNumberedList when numbered list button is clicked', () => {
    render(<EnhancedToolbar {...mockProps} />)
    const numberedListButton = screen.getByTestId('numbered-list-button')
    fireEvent.click(numberedListButton)
    expect(mockProps.onNumberedList).toHaveBeenCalledTimes(1)
  })

  it('should render strikethrough button', () => {
    render(<EnhancedToolbar {...mockProps} />)
    const strikethroughButton = screen.getByTestId('strikethrough-button')
    expect(strikethroughButton).toBeInTheDocument()
    expect(strikethroughButton).toHaveAttribute('title', 'Strikethrough')
  })

  it('should call onStrikethrough when strikethrough button is clicked', () => {
    render(<EnhancedToolbar {...mockProps} />)
    const strikethroughButton = screen.getByTestId('strikethrough-button')
    fireEvent.click(strikethroughButton)
    expect(mockProps.onStrikethrough).toHaveBeenCalledTimes(1)
  })

  it('should render all alignment buttons', () => {
    render(<EnhancedToolbar {...mockProps} />)
    expect(screen.getByTestId('align-left-button')).toBeInTheDocument()
    expect(screen.getByTestId('align-center-button')).toBeInTheDocument()
    expect(screen.getByTestId('align-right-button')).toBeInTheDocument()
    expect(screen.getByTestId('align-justify-button')).toBeInTheDocument()
  })

  it('should call alignment handlers when clicked', () => {
    render(<EnhancedToolbar {...mockProps} />)

    fireEvent.click(screen.getByTestId('align-left-button'))
    expect(mockProps.onAlignLeft).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByTestId('align-center-button'))
    expect(mockProps.onAlignCenter).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByTestId('align-right-button'))
    expect(mockProps.onAlignRight).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByTestId('align-justify-button'))
    expect(mockProps.onAlignJustify).toHaveBeenCalledTimes(1)
  })
})