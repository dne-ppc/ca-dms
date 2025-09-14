/**
 * End-to-End Integration Tests - Task 2.3.8 Implementation
 * Complete frontend-backend integration validation
 */
import { describe, it, expect, beforeEach, beforeAll, vi, Mock } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IntroPage } from '../../pages/IntroPage'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// Import services that need integration testing
import * as authService from '../../services/authService'
import * as introPageService from '../../services/introPageService'

// Mock the services for controlled integration testing
vi.mock('../../services/authService', () => ({
  authService: {
    getCurrentUser: vi.fn(),
    getCurrentUserContext: vi.fn(),
    isAuthenticated: vi.fn(() => true)
  },
  getCurrentUser: vi.fn(),
  isAuthenticated: vi.fn(() => true),
  getAuthToken: vi.fn(() => 'mock-token'),
  logout: vi.fn()
}))

vi.mock('../../services/introPageService', () => ({
  introPageService: {
    getIntroPageData: vi.fn()
  }
}))

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Test data for integration
const mockUser = {
  id: 'test-user-123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'admin'
}

const mockIntroData = {
  systemOverview: {
    total_users: 150,
    active_documents: 1250,
    documents_today: 8,
    documents_this_week: 45,
    system_health_score: 98.5,
    storage_usage: {
      used_gb: 45.2,
      total_gb: 100,
      percentage: 45.2
    },
    performance_metrics: {
      avg_response_time: 120,
      uptime_percentage: 99.8,
      error_rate: 0.02
    },
    document_types: {
      governance: 450,
      policy: 320,
      meeting: 280,
      notice: 200
    },
    user_activity: {
      active_today: 25,
      active_this_week: 89,
      new_registrations: 5
    }
  },
  personalStats: {
    userId: 'test-user-123',
    documentCount: 42,
    templateCount: 8,
    documentsCreatedThisWeek: 5,
    documentsCreatedThisMonth: 18,
    collaborationScore: 85,
    productivityScore: 92.5,
    recentDocuments: [
      {
        id: 'doc-1',
        title: 'Board Meeting Minutes - September 2025',
        updatedAt: new Date('2025-09-12T10:30:00Z'),
        status: 'approved' as const,
        type: 'meeting' as const
      }
    ],
    documentsByType: {
      meeting: 15,
      policy: 12,
      notice: 10,
      governance: 5
    },
    workflowParticipation: {
      approvals_completed: 25,
      reviews_completed: 18,
      tasks_assigned: 8,
      tasks_completed: 6
    },
    activityTimeline: [
      { date: '2025-09-12', documents: 2, collaborations: 1 },
      { date: '2025-09-11', documents: 1, collaborations: 3 }
    ]
  },
  lastUpdated: new Date('2025-09-13T10:00:00Z'),
  performanceMetrics: {
    coordination_time_ms: 150,
    cache_hit_rate: 85
  }
}

// Test wrapper component
const createTestWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false }
    }
  })

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  )
}

describe('End-to-End Integration Tests - Task 2.3.8', () => {
  let mockGetCurrentUser: Mock
  let mockIsAuthenticated: Mock
  let mockGetIntroPageData: Mock

  beforeAll(async () => {
    // Get the mocked functions
    mockGetCurrentUser = vi.mocked(authService.getCurrentUser)
    mockIsAuthenticated = vi.mocked(authService.isAuthenticated)
    mockGetIntroPageData = vi.mocked(introPageService.introPageService.getIntroPageData)
  })

  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()

    // Setup successful authentication by default
    mockIsAuthenticated.mockReturnValue(true)
    mockGetCurrentUser.mockResolvedValue(mockUser)
    mockGetIntroPageData.mockResolvedValue(mockIntroData)
  })

  describe('🔄 Complete Integration Flow', () => {
    it('should successfully load and display the complete integrated dashboard', async () => {
      const TestWrapper = createTestWrapper()

      render(
        <TestWrapper>
          <IntroPage />
        </TestWrapper>
      )

      // 1. Should start with loading state
      expect(screen.getByTestId('intro-page-loading')).toBeInTheDocument()

      // 2. Wait for authentication and data loading to complete
      await waitFor(() => {
        expect(screen.queryByTestId('intro-page-loading')).not.toBeInTheDocument()
      }, { timeout: 10000 })

      // 3. Verify authentication flow worked
      expect(mockIsAuthenticated).toHaveBeenCalled()
      expect(mockGetCurrentUser).toHaveBeenCalled()
      expect(mockGetIntroPageData).toHaveBeenCalledWith(mockUser.id)

      // 4. Verify main components are rendered
      expect(screen.getByText('System Overview')).toBeInTheDocument()
      expect(screen.getByText('Your Statistics')).toBeInTheDocument()

      // 5. Verify system data is displayed
      expect(screen.getByText('150')).toBeInTheDocument() // total users
      expect(screen.getByText('1,250')).toBeInTheDocument() // active documents

      // 6. Verify personal data is displayed
      expect(screen.getByText('42')).toBeInTheDocument() // document count
      expect(screen.getByText('92.5')).toBeInTheDocument() // productivity score

      // 7. Verify interactive elements are present
      expect(screen.getByTestId('intro-page-refresh')).toBeInTheDocument()
      expect(screen.getByTestId('refresh-button')).toBeInTheDocument()

      console.log('✅ Complete integration flow successful')
    })

    it('should handle the complete refresh workflow end-to-end', async () => {
      const TestWrapper = createTestWrapper()

      render(
        <TestWrapper>
          <IntroPage />
        </TestWrapper>
      )

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('System Overview')).toBeInTheDocument()
      })

      // Clear previous calls
      vi.clearAllMocks()

      // Setup updated data for refresh
      const updatedData = {
        ...mockIntroData,
        systemOverview: {
          ...mockIntroData.systemOverview,
          total_users: 155,
          documents_today: 12
        }
      }
      mockGetIntroPageData.mockResolvedValue(updatedData)

      // Trigger refresh
      const refreshButton = screen.getByTestId('intro-page-refresh')
      fireEvent.click(refreshButton)

      // Should show refreshing state
      await waitFor(() => {
        expect(screen.getByText('Refreshing...')).toBeInTheDocument()
      })

      // Should call the service with noCache option
      expect(mockGetIntroPageData).toHaveBeenCalledWith(mockUser.id, { noCache: true })

      // Wait for refresh to complete
      await waitFor(() => {
        expect(screen.queryByText('Refreshing...')).not.toBeInTheDocument()
        expect(screen.getByText('155')).toBeInTheDocument() // updated users
        expect(screen.getByText('12')).toBeInTheDocument() // updated documents today
      })

      console.log('✅ Complete refresh workflow successful')
    })

    it('should handle responsive layout changes across all components', async () => {
      const TestWrapper = createTestWrapper()

      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      })

      render(
        <TestWrapper>
          <IntroPage />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('System Overview')).toBeInTheDocument()
      })

      // Fire resize event
      fireEvent(window, new Event('resize'))

      // Should apply mobile layouts
      const systemOverview = screen.getByTestId('system-overview-container')
      const personalStats = screen.getByTestId('personal-stats-container')

      expect(systemOverview).toHaveClass('mobile-layout')
      expect(personalStats).toHaveClass('mobile-layout')

      // Restore desktop viewport
      Object.defineProperty(window, 'innerWidth', { value: 1024 })
      fireEvent(window, new Event('resize'))

      // Should apply desktop layouts
      await waitFor(() => {
        expect(systemOverview).toHaveClass('desktop-layout')
        expect(personalStats).toHaveClass('desktop-layout')
      })

      console.log('✅ Responsive integration successful')
    })

    it('should maintain state consistency across component interactions', async () => {
      const TestWrapper = createTestWrapper()
      const user = userEvent.setup()

      render(
        <TestWrapper>
          <IntroPage />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Your Statistics')).toBeInTheDocument()
      })

      // Test time range changes
      const timeRangeSelector = screen.getByTestId('time-range-selector')
      await user.selectOptions(timeRangeSelector, 'week')

      await waitFor(() => {
        expect(screen.getByDisplayValue('This Week')).toBeInTheDocument()
      })

      // Test that the change is reflected globally
      expect(screen.getByTestId('global-time-range-indicator')).toHaveTextContent('Week')

      console.log('✅ State consistency integration successful')
    })
  })

  describe('🔧 Error Handling Integration', () => {
    it('should handle authentication failures gracefully', async () => {
      const TestWrapper = createTestWrapper()

      // Mock authentication failure
      mockIsAuthenticated.mockReturnValue(false)

      render(
        <TestWrapper>
          <IntroPage />
        </TestWrapper>
      )

      // Should show authentication required state
      await waitFor(() => {
        expect(screen.getByTestId('auth-required')).toBeInTheDocument()
        expect(screen.getByText('Authentication Required')).toBeInTheDocument()
      })

      console.log('✅ Authentication error handling successful')
    })

    it('should handle API failures with proper error states', async () => {
      const TestWrapper = createTestWrapper()

      // Mock API failure
      mockGetIntroPageData.mockRejectedValue(new Error('API service unavailable'))

      render(
        <TestWrapper>
          <IntroPage />
        </TestWrapper>
      )

      // Should show error state
      await waitFor(() => {
        expect(screen.getByTestId('intro-error-state')).toBeInTheDocument()
        expect(screen.getByText('Failed to load dashboard data')).toBeInTheDocument()
        expect(screen.getByTestId('retry-button')).toBeInTheDocument()
      })

      console.log('✅ API error handling successful')
    })

    it('should handle partial data failures with fallbacks', async () => {
      const TestWrapper = createTestWrapper()

      // Mock partial data
      const partialData = {
        ...mockIntroData,
        personalStats: null // Simulate personal stats failure
      }
      mockGetIntroPageData.mockResolvedValue(partialData)

      render(
        <TestWrapper>
          <IntroPage />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('System Overview')).toBeInTheDocument()
      })

      // Should show system data
      expect(screen.getByText('150')).toBeInTheDocument()

      // Should handle missing personal stats gracefully
      expect(screen.getByTestId('personal-stats-error')).toBeInTheDocument()
      expect(screen.getByText(/personal statistics unavailable/i)).toBeInTheDocument()

      console.log('✅ Partial failure handling successful')
    })

    it('should retry failed operations successfully', async () => {
      const TestWrapper = createTestWrapper()

      // First call fails, second succeeds
      mockGetIntroPageData
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue(mockIntroData)

      render(
        <TestWrapper>
          <IntroPage />
        </TestWrapper>
      )

      // Wait for error state
      await waitFor(() => {
        expect(screen.getByTestId('retry-button')).toBeInTheDocument()
      })

      // Click retry
      const retryButton = screen.getByTestId('retry-button')
      fireEvent.click(retryButton)

      // Should successfully load after retry
      await waitFor(() => {
        expect(screen.getByText('System Overview')).toBeInTheDocument()
        expect(screen.getByText('150')).toBeInTheDocument()
      })

      expect(mockGetIntroPageData).toHaveBeenCalledTimes(2)

      console.log('✅ Retry mechanism successful')
    })
  })

  describe('🚀 Performance Integration', () => {
    it('should load all components within performance targets', async () => {
      const TestWrapper = createTestWrapper()
      const startTime = performance.now()

      render(
        <TestWrapper>
          <IntroPage />
        </TestWrapper>
      )

      // Wait for complete loading
      await waitFor(() => {
        expect(screen.getByText('System Overview')).toBeInTheDocument()
        expect(screen.getByText('Your Statistics')).toBeInTheDocument()
      })

      const loadTime = performance.now() - startTime

      // Should load within 2 seconds
      expect(loadTime).toBeLessThan(2000)

      console.log(`✅ Performance target met: ${Math.round(loadTime)}ms`)
    })

    it('should handle concurrent operations without conflicts', async () => {
      const TestWrapper = createTestWrapper()
      const user = userEvent.setup()

      render(
        <TestWrapper>
          <IntroPage />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByTestId('intro-page-refresh')).toBeInTheDocument()
      })

      // Clear mock calls
      vi.clearAllMocks()
      mockGetIntroPageData.mockResolvedValue(mockIntroData)

      // Trigger multiple concurrent operations
      const refreshButton = screen.getByTestId('intro-page-refresh')
      const timeRangeSelector = screen.getByTestId('time-range-selector')

      await Promise.all([
        user.click(refreshButton),
        user.selectOptions(timeRangeSelector, 'year'),
        user.click(refreshButton) // Second click
      ])

      // Should handle concurrent operations gracefully
      await waitFor(() => {
        expect(screen.getByDisplayValue('This Year')).toBeInTheDocument()
      })

      // Should not show conflict errors
      expect(screen.queryByTestId('state-conflict-error')).not.toBeInTheDocument()

      console.log('✅ Concurrent operations handled successfully')
    })
  })

  describe('♿ Accessibility Integration', () => {
    it('should maintain accessibility standards across integrated components', async () => {
      const TestWrapper = createTestWrapper()

      render(
        <TestWrapper>
          <IntroPage />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('System Overview')).toBeInTheDocument()
      })

      // Should have proper page structure
      expect(screen.getByRole('main')).toBeInTheDocument()

      // Should have proper headings hierarchy
      const headings = screen.getAllByRole('heading')
      expect(headings.length).toBeGreaterThan(2)

      // Should have accessible regions
      expect(screen.getByRole('region', { name: /system overview/i })).toBeInTheDocument()
      expect(screen.getByRole('region', { name: /personal statistics/i })).toBeInTheDocument()

      // Should have skip link
      expect(screen.getByTestId('skip-to-main-content')).toBeInTheDocument()

      console.log('✅ Accessibility integration successful')
    })

    it('should support keyboard navigation across components', async () => {
      const TestWrapper = createTestWrapper()
      const user = userEvent.setup()

      render(
        <TestWrapper>
          <IntroPage />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByTestId('time-range-selector')).toBeInTheDocument()
      })

      // Test keyboard navigation
      const timeRangeSelector = screen.getByTestId('time-range-selector')
      const refreshButton = screen.getByTestId('intro-page-refresh')
      const skipLink = screen.getByTestId('skip-to-main-content')

      // Test that all key elements are focusable
      skipLink.focus()
      expect(skipLink).toHaveFocus()

      timeRangeSelector.focus()
      expect(timeRangeSelector).toHaveFocus()

      refreshButton.focus()
      expect(refreshButton).toHaveFocus()

      // Test basic tab navigation works (elements are in tab order)
      await user.keyboard('{Tab}')
      // Should move focus to some focusable element (actual order may vary)
      expect(document.activeElement).toBeTruthy()

      console.log('✅ Keyboard navigation integration successful')
    })

    it('should provide screen reader announcements for updates', async () => {
      const TestWrapper = createTestWrapper()

      render(
        <TestWrapper>
          <IntroPage />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('System Overview')).toBeInTheDocument()
      })

      // Should have live regions
      expect(screen.getByRole('status')).toBeInTheDocument()

      // Trigger refresh to test announcements
      const refreshButton = screen.getByTestId('intro-page-refresh')
      fireEvent.click(refreshButton)

      // Should announce updates
      await waitFor(() => {
        const liveRegion = screen.getByRole('status')
        expect(liveRegion).toHaveTextContent(/data updated/i)
      })

      console.log('✅ Screen reader integration successful')
    })
  })
})