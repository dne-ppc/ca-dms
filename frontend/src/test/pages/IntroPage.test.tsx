/**
 * IntroPage Main Component Tests - TDD Red Phase
 * Testing main container component with routing integration
 */
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { IntroPage } from '../../pages/IntroPage'

// Mock the intro page service
vi.mock('../../services/introPageService', () => ({
  introPageService: {
    getIntroPageData: vi.fn(),
    getIntroPageDataWithFallback: vi.fn(),
    updatePersonalization: vi.fn(),
  },
}))

// Mock auth service
vi.mock('../../services/authService', () => ({
  getCurrentUser: vi.fn(),
  isAuthenticated: vi.fn(),
}))

// Mock components
vi.mock('../../components/intro/IntroPageLayout', () => ({
  IntroPageLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="intro-page-layout">{children}</div>
  )
}))

vi.mock('../../components/intro/UserStatisticsCard', () => ({
  UserStatisticsCard: () => <div data-testid="user-statistics-card">User Statistics</div>
}))

vi.mock('../../components/intro/SystemOverviewCard', () => ({
  SystemOverviewCard: () => <div data-testid="system-overview-card">System Overview</div>
}))

vi.mock('../../components/intro/ActionableItemsCard', () => ({
  ActionableItemsCard: () => <div data-testid="actionable-items-card">Actionable Items</div>
}))

vi.mock('../../components/intro/ActivityFeedCard', () => ({
  ActivityFeedCard: () => <div data-testid="activity-feed-card">Activity Feed</div>
}))

// Mock data
const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User'
}

const mockIntroPageData = {
  userId: 'user-123',
  userStatistics: {
    documentCount: 42,
    templateCount: 8,
    recentDocuments: [
      {
        id: 'doc-1',
        title: 'Board Meeting Minutes - September 2025',
        updatedAt: new Date('2025-09-12T10:30:00Z'),
        status: 'approved'
      }
    ]
  },
  systemOverview: {
    total_users: 150,
    active_documents: 1250,
    system_health_score: 98.5
  },
  actionableItems: {
    pending_approvals: 3,
    urgent_tasks: 1,
    items: []
  },
  activityFeed: {
    recent_activities: ['document_created'],
    activities: [],
    unread_count: 2
  },
  personalization: {
    theme: 'light' as const,
    dashboard_layout: 'standard' as const,
    notifications: { email: true, push: false, in_app: true },
    widgets: ['recent_documents', 'pending_tasks']
  }
}

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
)

describe('IntroPage Main Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render intro page with authentication check', async () => {
    // RED: This should fail - IntroPage component doesn't exist yet
    const { isAuthenticated } = await import('../../services/authService')
    const { getCurrentUser } = await import('../../services/authService')
    const { introPageService } = await import('../../services/introPageService')

    ;(isAuthenticated as Mock).mockReturnValue(true)
    ;(getCurrentUser as Mock).mockResolvedValue(mockUser)
    ;(introPageService.getIntroPageData as Mock).mockResolvedValue(mockIntroPageData)

    render(
      <TestWrapper>
        <IntroPage />
      </TestWrapper>
    )

    // Should show intro page layout
    await waitFor(() => {
      expect(screen.getByTestId('intro-page-layout')).toBeInTheDocument()
    })

    // Should show main sections
    await waitFor(() => {
      expect(screen.getByTestId('user-statistics-card')).toBeInTheDocument()
      expect(screen.getByTestId('system-overview-card')).toBeInTheDocument()
      expect(screen.getByTestId('actionable-items-card')).toBeInTheDocument()
      expect(screen.getByTestId('activity-feed-card')).toBeInTheDocument()
    })
  })

  it('should handle loading states properly', async () => {
    // RED: This should fail - loading state handling not implemented yet
    const { isAuthenticated } = await import('../../services/authService')
    const { getCurrentUser } = await import('../../services/authService')
    const { introPageService } = await import('../../services/introPageService')

    ;(isAuthenticated as Mock).mockReturnValue(true)
    ;(getCurrentUser as Mock).mockResolvedValue(mockUser)

    // Simulate slow loading
    const slowPromise = new Promise(resolve => setTimeout(() => resolve(mockIntroPageData), 1000))
    ;(introPageService.getIntroPageData as Mock).mockReturnValue(slowPromise)

    render(
      <TestWrapper>
        <IntroPage />
      </TestWrapper>
    )

    // Should show loading skeleton
    expect(screen.getByTestId('intro-page-loading')).toBeInTheDocument()

    // Should show content after loading
    await waitFor(() => {
      expect(screen.getByTestId('intro-page-layout')).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('should handle authentication redirect', async () => {
    // RED: This should fail - authentication handling not implemented yet
    const { isAuthenticated } = await import('../../services/authService')

    ;(isAuthenticated as Mock).mockReturnValue(false)

    render(
      <TestWrapper>
        <IntroPage />
      </TestWrapper>
    )

    // Should redirect to login or show authentication prompt
    await waitFor(() => {
      expect(screen.getByTestId('auth-required')).toBeInTheDocument()
    })
  })

  it('should handle error states gracefully', async () => {
    // RED: This should fail - error handling not implemented yet
    const { isAuthenticated } = await import('../../services/authService')
    const { getCurrentUser } = await import('../../services/authService')
    const { introPageService } = await import('../../services/introPageService')

    ;(isAuthenticated as Mock).mockReturnValue(true)
    ;(getCurrentUser as Mock).mockResolvedValue(mockUser)
    ;(introPageService.getIntroPageData as Mock).mockRejectedValue(new Error('Network error'))

    render(
      <TestWrapper>
        <IntroPage />
      </TestWrapper>
    )

    // Should show error boundary
    await waitFor(() => {
      expect(screen.getByTestId('intro-page-error')).toBeInTheDocument()
      expect(screen.getByText(/network error/i)).toBeInTheDocument()
    })
  })

  it('should support refresh functionality', async () => {
    // RED: This should fail - refresh functionality not implemented yet
    const { isAuthenticated } = await import('../../services/authService')
    const { getCurrentUser } = await import('../../services/authService')
    const { introPageService } = await import('../../services/introPageService')

    ;(isAuthenticated as Mock).mockReturnValue(true)
    ;(getCurrentUser as Mock).mockResolvedValue(mockUser)
    ;(introPageService.getIntroPageData as Mock).mockResolvedValue(mockIntroPageData)

    render(
      <TestWrapper>
        <IntroPage />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByTestId('intro-page-layout')).toBeInTheDocument()
    })

    // Should have refresh button
    const refreshButton = screen.getByTestId('intro-page-refresh')
    expect(refreshButton).toBeInTheDocument()

    // Should trigger refresh when clicked
    fireEvent.click(refreshButton)

    await waitFor(() => {
      expect(introPageService.getIntroPageData).toHaveBeenCalledTimes(2)
    })
  })

  it('should handle responsive layout changes', async () => {
    // RED: This should fail - responsive handling not implemented yet
    const { isAuthenticated } = await import('../../services/authService')
    const { getCurrentUser } = await import('../../services/authService')
    const { introPageService } = await import('../../services/introPageService')

    ;(isAuthenticated as Mock).mockReturnValue(true)
    ;(getCurrentUser as Mock).mockResolvedValue(mockUser)
    ;(introPageService.getIntroPageData as Mock).mockResolvedValue(mockIntroPageData)

    render(
      <TestWrapper>
        <IntroPage />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByTestId('intro-page-layout')).toBeInTheDocument()
    })

    // Should detect mobile layout
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 768 })
    fireEvent.resize(window)

    await waitFor(() => {
      const layout = screen.getByTestId('intro-page-layout')
      expect(layout).toHaveClass('mobile-layout')
    })
  })

  it('should integrate with routing correctly', async () => {
    // RED: This should fail - routing integration not implemented yet
    const { isAuthenticated } = await import('../../services/authService')
    const { getCurrentUser } = await import('../../services/authService')
    const { introPageService } = await import('../../services/introPageService')

    ;(isAuthenticated as Mock).mockReturnValue(true)
    ;(getCurrentUser as Mock).mockResolvedValue(mockUser)
    ;(introPageService.getIntroPageData as Mock).mockResolvedValue(mockIntroPageData)

    render(
      <TestWrapper>
        <IntroPage />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByTestId('intro-page-layout')).toBeInTheDocument()
    })

    // Should be accessible via root route
    expect(window.location.pathname).toBe('/')

    // Should have proper page metadata
    expect(document.title).toContain('CA-DMS Dashboard')
  })

  it('should handle real-time updates', async () => {
    // RED: This should fail - real-time updates not implemented yet
    const { isAuthenticated } = await import('../../services/authService')
    const { getCurrentUser } = await import('../../services/authService')
    const { introPageService } = await import('../../services/introPageService')

    ;(isAuthenticated as Mock).mockReturnValue(true)
    ;(getCurrentUser as Mock).mockResolvedValue(mockUser)
    ;(introPageService.getIntroPageData as Mock).mockResolvedValue(mockIntroPageData)

    render(
      <TestWrapper>
        <IntroPage />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByTestId('intro-page-layout')).toBeInTheDocument()
    })

    // Should have real-time indicator
    expect(screen.getByTestId('real-time-status')).toBeInTheDocument()

    // Should show connection status
    expect(screen.getByText(/connected/i)).toBeInTheDocument()
  })

  it('should support keyboard navigation', async () => {
    // RED: This should fail - keyboard navigation not implemented yet
    const { isAuthenticated } = await import('../../services/authService')
    const { getCurrentUser } = await import('../../services/authService')
    const { introPageService } = await import('../../services/introPageService')

    ;(isAuthenticated as Mock).mockReturnValue(true)
    ;(getCurrentUser as Mock).mockResolvedValue(mockUser)
    ;(introPageService.getIntroPageData as Mock).mockResolvedValue(mockIntroPageData)

    render(
      <TestWrapper>
        <IntroPage />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByTestId('intro-page-layout')).toBeInTheDocument()
    })

    // Should have skip navigation
    expect(screen.getByTestId('skip-to-main-content')).toBeInTheDocument()

    // Should have proper tab order
    const focusableElements = screen.getAllByRole('button')
    expect(focusableElements.length).toBeGreaterThan(0)
  })

  it('should handle personalization integration', async () => {
    // RED: This should fail - personalization integration not implemented yet
    const { isAuthenticated } = await import('../../services/authService')
    const { getCurrentUser } = await import('../../services/authService')
    const { introPageService } = await import('../../services/introPageService')

    ;(isAuthenticated as Mock).mockReturnValue(true)
    ;(getCurrentUser as Mock).mockResolvedValue(mockUser)
    ;(introPageService.getIntroPageData as Mock).mockResolvedValue(mockIntroPageData)

    render(
      <TestWrapper>
        <IntroPage />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByTestId('intro-page-layout')).toBeInTheDocument()
    })

    // Should apply user's theme
    const layout = screen.getByTestId('intro-page-layout')
    expect(layout).toHaveClass('theme-light')

    // Should apply user's layout preference
    expect(layout).toHaveClass('layout-standard')

    // Should show user's configured widgets
    const widgets = mockIntroPageData.personalization.widgets
    widgets.forEach(widget => {
      expect(screen.getByTestId(`widget-${widget}`)).toBeInTheDocument()
    })
  })
})