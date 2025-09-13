import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { EnhancedEditorLayout } from '../EnhancedEditorLayout'
import * as useDeviceDetectionModule from '../../../hooks/useDeviceDetection'

// Mock the useDeviceDetection hook
vi.mock('../../../hooks/useDeviceDetection', () => ({
  useDeviceDetection: vi.fn()
}))

// Mock child components that might not exist yet
vi.mock('../EnhancedToolbar', () => ({
  EnhancedToolbar: () => <div data-testid="enhanced-toolbar">Enhanced Toolbar</div>
}))

vi.mock('../MobileEditor', () => ({
  MobileEditor: () => <div data-testid="mobile-editor">Mobile Editor</div>
}))

vi.mock('../DocumentEditor', () => ({
  DocumentEditor: () => <div data-testid="document-editor">Document Editor</div>
}))

describe('EnhancedEditorLayout', () => {
  const mockUseDeviceDetection = vi.mocked(useDeviceDetectionModule.useDeviceDetection)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render mobile layout for mobile devices', () => {
    mockUseDeviceDetection.mockReturnValue({
      isMobile: true,
      isDesktop: false,
      breakpoint: 'sm',
      windowWidth: 480,
      isBreakpointUp: vi.fn(),
      isBreakpointDown: vi.fn()
    })

    render(<EnhancedEditorLayout />)

    // Should show mobile editor
    expect(screen.getByTestId('mobile-editor')).toBeInTheDocument()

    // Should NOT show desktop components
    expect(screen.queryByTestId('enhanced-toolbar')).not.toBeInTheDocument()
    expect(screen.queryByTestId('document-editor')).not.toBeInTheDocument()
  })

  it('should render desktop layout for desktop devices', () => {
    mockUseDeviceDetection.mockReturnValue({
      isMobile: false,
      isDesktop: true,
      breakpoint: 'lg',
      windowWidth: 1024,
      isBreakpointUp: vi.fn(),
      isBreakpointDown: vi.fn()
    })

    render(<EnhancedEditorLayout />)

    // Should show desktop components
    expect(screen.getByTestId('enhanced-toolbar')).toBeInTheDocument()
    expect(screen.getByTestId('document-editor')).toBeInTheDocument()

    // Should NOT show mobile editor
    expect(screen.queryByTestId('mobile-editor')).not.toBeInTheDocument()
  })

  it('should show mobile restriction message for mobile devices', () => {
    mockUseDeviceDetection.mockReturnValue({
      isMobile: true,
      isDesktop: false,
      breakpoint: 'sm',
      windowWidth: 480,
      isBreakpointUp: vi.fn(),
      isBreakpointDown: vi.fn()
    })

    render(<EnhancedEditorLayout />)

    // Should show restriction message
    expect(screen.getByText(/document editing is limited on mobile devices/i)).toBeInTheDocument()
    expect(screen.getByText(/please use a desktop/i)).toBeInTheDocument()
  })

  it('should have proper CSS classes for responsive layout', () => {
    mockUseDeviceDetection.mockReturnValue({
      isMobile: false,
      isDesktop: true,
      breakpoint: 'lg',
      windowWidth: 1024,
      isBreakpointUp: vi.fn(),
      isBreakpointDown: vi.fn()
    })

    const { container } = render(<EnhancedEditorLayout />)

    // Should have main layout container class
    expect(container.firstChild).toHaveClass('enhanced-editor-layout')

    // Should have desktop-specific classes
    expect(container.querySelector('.desktop-layout')).toBeInTheDocument()
  })

  it('should have proper CSS classes for mobile layout', () => {
    mockUseDeviceDetection.mockReturnValue({
      isMobile: true,
      isDesktop: false,
      breakpoint: 'sm',
      windowWidth: 480,
      isBreakpointUp: vi.fn(),
      isBreakpointDown: vi.fn()
    })

    const { container } = render(<EnhancedEditorLayout />)

    // Should have main layout container class
    expect(container.firstChild).toHaveClass('enhanced-editor-layout')

    // Should have mobile-specific classes
    expect(container.querySelector('.mobile-layout')).toBeInTheDocument()
  })

  it('should render with proper accessibility attributes', () => {
    mockUseDeviceDetection.mockReturnValue({
      isMobile: false,
      isDesktop: true,
      breakpoint: 'lg',
      windowWidth: 1024,
      isBreakpointUp: vi.fn(),
      isBreakpointDown: vi.fn()
    })

    render(<EnhancedEditorLayout />)

    // Should have proper ARIA role
    const layout = screen.getByRole('main')
    expect(layout).toBeInTheDocument()
    expect(layout).toHaveAttribute('aria-label', 'Document editor')
  })
})