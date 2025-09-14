import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { EnhancedEditorLayout } from '../EnhancedEditorLayout'
import { useDeviceDetection } from '../../../hooks/useDeviceDetection'

// Mock the device detection hook
vi.mock('../../../hooks/useDeviceDetection', () => ({
  useDeviceDetection: vi.fn()
}))

// Mock components
vi.mock('../EnhancedQuillEditor', () => ({
  EnhancedQuillEditor: () => <div data-testid="quill-editor">Enhanced Quill Editor</div>
}))

interface MockProps {
  documentId?: string
  value?: string
  onChange?: (value: string) => void
  readOnly?: boolean
}

const mockProps: MockProps = {
  documentId: 'test-doc-123',
  value: 'Test document content',
  onChange: vi.fn(),
  readOnly: false
}

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
)

describe('EnhancedEditorLayout - Task 1.2.1-1.2.2: TDD Green Phase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default to desktop device
    const mockUseDeviceDetection = vi.mocked(useDeviceDetection)
    mockUseDeviceDetection.mockReturnValue({
      isMobile: false,
      isDesktop: true,
      deviceType: 'desktop',
      isTouchDevice: false,
      breakpoint: 'lg',
      windowWidth: 1024,
      isBreakpointUp: vi.fn(() => true),
      isBreakpointDown: vi.fn(() => false)
    })
  })

  describe('TDD Green Phase - Component functionality', () => {
    it('should render EnhancedEditorLayout component successfully', () => {
      render(
        <TestWrapper>
          <EnhancedEditorLayout {...mockProps} />
        </TestWrapper>
      )

      expect(screen.getByTestId('enhanced-editor-layout')).toBeInTheDocument()
    })

    it('should render mobile layout for mobile devices', () => {
      const mockUseDeviceDetection = vi.mocked(useDeviceDetection)
      mockUseDeviceDetection.mockReturnValue({
        isMobile: true,
        isDesktop: false,
        deviceType: 'mobile',
        isTouchDevice: true,
        breakpoint: 'xs',
        windowWidth: 375,
        isBreakpointUp: vi.fn(() => false),
        isBreakpointDown: vi.fn(() => true)
      })

      render(
        <TestWrapper>
          <EnhancedEditorLayout {...mockProps} />
        </TestWrapper>
      )

      expect(screen.getByTestId('mobile-editor-layout')).toBeInTheDocument()
    })

    it('should render desktop layout for desktop devices', () => {
      render(
        <TestWrapper>
          <EnhancedEditorLayout {...mockProps} />
        </TestWrapper>
      )

      expect(screen.getByTestId('enhanced-editor-layout')).toBeInTheDocument()
      expect(screen.getByTestId('enhanced-editor-layout')).toHaveClass('desktop-layout')
    })

    it('should show mobile restriction message', () => {
      const mockUseDeviceDetection = vi.mocked(useDeviceDetection)
      mockUseDeviceDetection.mockReturnValue({
        isMobile: true,
        isDesktop: false,
        deviceType: 'mobile',
        isTouchDevice: true,
        breakpoint: 'xs',
        windowWidth: 375,
        isBreakpointUp: vi.fn(() => false),
        isBreakpointDown: vi.fn(() => true)
      })

      render(
        <TestWrapper>
          <EnhancedEditorLayout {...mockProps} />
        </TestWrapper>
      )

      expect(screen.getByText(/mobile editing is limited/i)).toBeInTheDocument()
    })

    it('should handle device-aware rendering', () => {
      render(
        <TestWrapper>
          <EnhancedEditorLayout {...mockProps} />
        </TestWrapper>
      )

      expect(screen.getByTestId('enhanced-editor-layout')).toHaveClass('desktop-layout')
    })

    it('should handle responsive design', () => {
      const mockUseDeviceDetection = vi.mocked(useDeviceDetection)
      mockUseDeviceDetection.mockReturnValue({
        isMobile: false,
        isDesktop: true,
        deviceType: 'tablet',
        isTouchDevice: true,
        breakpoint: 'md',
        windowWidth: 768,
        isBreakpointUp: vi.fn(() => true),
        isBreakpointDown: vi.fn(() => false)
      })

      render(
        <TestWrapper>
          <EnhancedEditorLayout {...mockProps} />
        </TestWrapper>
      )

      expect(screen.getByTestId('enhanced-editor-layout')).toHaveClass('tablet-layout')
    })

    it('should integrate with enhanced Quill editor', () => {
      render(
        <TestWrapper>
          <EnhancedEditorLayout {...mockProps} />
        </TestWrapper>
      )

      expect(screen.getByTestId('quill-editor')).toBeInTheDocument()
    })

    it('should handle read-only mode correctly', () => {
      render(
        <TestWrapper>
          <EnhancedEditorLayout {...mockProps} readOnly={true} />
        </TestWrapper>
      )

      expect(screen.getByTestId('enhanced-editor-layout')).toHaveClass('read-only')
    })

    it('should provide proper error boundaries', () => {
      render(
        <TestWrapper>
          <EnhancedEditorLayout {...mockProps} />
        </TestWrapper>
      )

      expect(screen.getByTestId('editor-error-boundary')).toBeInTheDocument()
    })
  })
})

// These tests should ALL FAIL initially, driving the implementation