import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { EnhancedToolbar } from '../EnhancedToolbar'

// Mock child components that will be implemented
vi.mock('../DocumentTitleInput', () => ({
  DocumentTitleInput: ({ value, onChange }: any) => (
    <input
      data-testid="document-title-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Document Title"
    />
  )
}))

vi.mock('../DocumentTypeSelector', () => ({
  DocumentTypeSelector: ({ value, onChange }: any) => (
    <select
      data-testid="document-type-selector"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="governance">Governance</option>
      <option value="policy">Policy</option>
      <option value="meeting">Meeting</option>
    </select>
  )
}))

vi.mock('../HeaderFormatSelector', () => ({
  HeaderFormatSelector: ({ value, onChange }: any) => (
    <select
      data-testid="header-format-selector"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="normal">Normal</option>
      <option value="h1">H1</option>
      <option value="h2">H2</option>
      <option value="h3">H3</option>
    </select>
  )
}))

vi.mock('../AdvancedReportingButton', () => ({
  AdvancedReportingButton: () => (
    <button data-testid="advanced-reporting-button">
      Advanced Reports
    </button>
  )
}))

describe('EnhancedToolbar', () => {
  const mockProps = {
    documentTitle: 'Test Document',
    documentType: 'governance',
    headerFormat: 'normal',
    onTitleChange: vi.fn(),
    onTypeChange: vi.fn(),
    onHeaderFormatChange: vi.fn(),
    onSave: vi.fn(),
    onBold: vi.fn(),
    onItalic: vi.fn(),
    onUnderline: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    isSaving: false,
    hasUnsavedChanges: false
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Layout and Structure', () => {
    it('should span full width of editor container', () => {
      const { container } = render(<EnhancedToolbar {...mockProps} />)

      const toolbar = container.firstChild as HTMLElement
      expect(toolbar).toHaveClass('enhanced-toolbar')
      expect(toolbar).toHaveClass('w-full')

      // Should have CSS that makes it span full width
      const computedStyle = window.getComputedStyle(toolbar)
      expect(computedStyle.width).toBe('100%')
    })

    it('should have Google Docs-style visual design', () => {
      const { container } = render(<EnhancedToolbar {...mockProps} />)

      const toolbar = container.firstChild as HTMLElement
      expect(toolbar).toHaveClass('google-docs-style')
      expect(toolbar).toHaveClass('border-b')
      expect(toolbar).toHaveClass('bg-white')
      expect(toolbar).toHaveClass('shadow-sm')
    })

    it('should be responsive across different screen sizes', () => {
      const { container } = render(<EnhancedToolbar {...mockProps} />)

      const toolbar = container.firstChild as HTMLElement
      expect(toolbar).toHaveClass('responsive-toolbar')

      // Should have responsive classes for different breakpoints
      expect(toolbar).toHaveClass('flex-col', 'md:flex-row')
    })
  })

  describe('Document Controls Integration', () => {
    it('should display document title input in toolbar', () => {
      render(<EnhancedToolbar {...mockProps} />)

      const titleInput = screen.getByTestId('document-title-input')
      expect(titleInput).toBeInTheDocument()
      expect(titleInput).toHaveValue('Test Document')
    })

    it('should display document type selector in toolbar', () => {
      render(<EnhancedToolbar {...mockProps} />)

      const typeSelector = screen.getByTestId('document-type-selector')
      expect(typeSelector).toBeInTheDocument()
      expect(typeSelector).toHaveValue('governance')
    })

    it('should display header format selector instead of size dropdown', () => {
      render(<EnhancedToolbar {...mockProps} />)

      const headerSelector = screen.getByTestId('header-format-selector')
      expect(headerSelector).toBeInTheDocument()
      expect(headerSelector).toHaveValue('normal')

      // Should not have old size dropdown
      expect(screen.queryByTestId('size-dropdown')).not.toBeInTheDocument()
    })

    it('should call handlers when controls change', () => {
      render(<EnhancedToolbar {...mockProps} />)

      // Test title change
      const titleInput = screen.getByTestId('document-title-input')
      fireEvent.change(titleInput, { target: { value: 'New Title' } })
      expect(mockProps.onTitleChange).toHaveBeenCalledWith('New Title')

      // Test type change
      const typeSelector = screen.getByTestId('document-type-selector')
      fireEvent.change(typeSelector, { target: { value: 'policy' } })
      expect(mockProps.onTypeChange).toHaveBeenCalledWith('policy')

      // Test header format change
      const headerSelector = screen.getByTestId('header-format-selector')
      fireEvent.change(headerSelector, { target: { value: 'h1' } })
      expect(mockProps.onHeaderFormatChange).toHaveBeenCalledWith('h1')
    })
  })

  describe('Formatting Controls', () => {
    it('should display formatting buttons (Bold, Italic, Underline)', () => {
      render(<EnhancedToolbar {...mockProps} />)

      expect(screen.getByTestId('bold-button')).toBeInTheDocument()
      expect(screen.getByTestId('italic-button')).toBeInTheDocument()
      expect(screen.getByTestId('underline-button')).toBeInTheDocument()
    })

    it('should display undo/redo buttons', () => {
      render(<EnhancedToolbar {...mockProps} />)

      expect(screen.getByTestId('undo-button')).toBeInTheDocument()
      expect(screen.getByTestId('redo-button')).toBeInTheDocument()
    })

    it('should call formatting handlers when buttons clicked', () => {
      render(<EnhancedToolbar {...mockProps} />)

      fireEvent.click(screen.getByTestId('bold-button'))
      expect(mockProps.onBold).toHaveBeenCalled()

      fireEvent.click(screen.getByTestId('italic-button'))
      expect(mockProps.onItalic).toHaveBeenCalled()

      fireEvent.click(screen.getByTestId('underline-button'))
      expect(mockProps.onUnderline).toHaveBeenCalled()

      fireEvent.click(screen.getByTestId('undo-button'))
      expect(mockProps.onUndo).toHaveBeenCalled()

      fireEvent.click(screen.getByTestId('redo-button'))
      expect(mockProps.onRedo).toHaveBeenCalled()
    })
  })

  describe('Advanced Reporting Integration', () => {
    it('should display advanced reporting button', () => {
      render(<EnhancedToolbar {...mockProps} />)

      expect(screen.getByTestId('advanced-reporting-button')).toBeInTheDocument()
    })
  })

  describe('Save Functionality', () => {
    it('should display save button with correct state', () => {
      render(<EnhancedToolbar {...mockProps} />)

      const saveButton = screen.getByTestId('save-button')
      expect(saveButton).toBeInTheDocument()
      expect(saveButton).not.toBeDisabled()
    })

    it('should show saving state when isSaving is true', () => {
      render(<EnhancedToolbar {...mockProps} isSaving={true} />)

      const saveButton = screen.getByTestId('save-button')
      expect(saveButton).toBeDisabled()
      expect(saveButton).toHaveTextContent(/saving/i)
    })

    it('should indicate unsaved changes', () => {
      render(<EnhancedToolbar {...mockProps} hasUnsavedChanges={true} />)

      expect(screen.getByTestId('unsaved-indicator')).toBeInTheDocument()
    })

    it('should call onSave when save button clicked', () => {
      render(<EnhancedToolbar {...mockProps} />)

      fireEvent.click(screen.getByTestId('save-button'))
      expect(mockProps.onSave).toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      render(<EnhancedToolbar {...mockProps} />)

      const toolbar = screen.getByRole('toolbar')
      expect(toolbar).toBeInTheDocument()
      expect(toolbar).toHaveAttribute('aria-label', 'Document editing toolbar')
    })

    it('should support keyboard navigation', () => {
      render(<EnhancedToolbar {...mockProps} />)

      const toolbar = screen.getByRole('toolbar')
      expect(toolbar).toHaveAttribute('aria-orientation', 'horizontal')

      // All interactive elements should be focusable (buttons are focusable by default)
      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        expect(button).not.toHaveAttribute('tabindex', '-1') // Not disabled from tab order
      })

      // Also check select elements are focusable
      const selects = screen.getAllByRole('combobox')
      selects.forEach(select => {
        expect(select).not.toHaveAttribute('tabindex', '-1')
      })
    })
  })
})