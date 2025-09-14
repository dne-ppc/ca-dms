/**
 * Intro Page Components Tests - TDD Red Phase
 * Comprehensive testing for intro page dashboard components
 */
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { IntroPage } from '../../components/intro/IntroPage'
import { UserStatisticsCard } from '../../components/intro/UserStatisticsCard'
import { SystemOverviewCard } from '../../components/intro/SystemOverviewCard'
import { ActionableItemsCard } from '../../components/intro/ActionableItemsCard'
import { ActivityFeedCard } from '../../components/intro/ActivityFeedCard'
import { PersonalizationPanel } from '../../components/intro/PersonalizationPanel'
import { introPageService } from '../../services/introPageService'

// Mock the intro page service
vi.mock('../../services/introPageService', () => ({
  introPageService: {
    getIntroPageData: vi.fn(),
    getUserStatistics: vi.fn(),
    getSystemOverview: vi.fn(),
    getActionableItems: vi.fn(),
    getActivityFeed: vi.fn(),
    getPersonalization: vi.fn(),
    updatePersonalization: vi.fn(),
    checkHealth: vi.fn(),
  },
}))

const mockIntroPageService = introPageService as {
  getIntroPageData: Mock
  getUserStatistics: Mock
  getSystemOverview: Mock
  getActionableItems: Mock
  getActivityFeed: Mock
  getPersonalization: Mock
  updatePersonalization: Mock
  checkHealth: Mock
}

// Mock data
const mockUserData = {
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
    ],
    documentTypes: {
      meeting_minutes: 15,
      policies: 12,
      notices: 15
    }
  },
  systemOverview: {
    total_users: 150,
    active_documents: 1250,
    documents_today: 8,
    documents_this_week: 45,
    system_health_score: 98.5
  },
  actionableItems: {
    user_id: 'user-123',
    pending_approvals: 3,
    urgent_tasks: 1,
    overdue_items: 0,
    items: [
      {
        id: 'approval-456',
        type: 'document_approval',
        title: 'Budget Proposal Review',
        due_date: '2025-09-15T17:00:00Z',
        priority: 'high' as const,
        status: 'pending'
      }
    ]
  },
  activityFeed: {
    user_id: 'user-123',
    recent_activities: ['document_created', 'approval_pending'],
    activities: [
      {
        id: 'activity-1',
        type: 'document_created',
        description: 'Created new board meeting minutes',
        timestamp: '2025-09-12T14:30:00Z',
        related_document: 'doc-1'
      }
    ],
    unread_count: 2
  },
  personalization: {
    theme: 'dark' as const,
    dashboard_layout: 'compact' as const,
    notifications: {
      email: true,
      push: false,
      in_app: true
    },
    widgets: ['recent_documents', 'pending_tasks'],
    language: 'en',
    timezone: 'America/New_York'
  },
  performanceMetrics: {
    coordination_time_ms: 234.5,
    data_sources: ['database', 'cache'],
    cache_hit_rate: 85.2,
    request_id: 'req-abc123'
  },
  lastUpdated: new Date('2025-09-13T10:45:23.123Z')
}

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
)

describe('IntroPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIntroPageService.getIntroPageData.mockResolvedValue(mockUserData)
  })

  it('should render main intro page with all sections', async () => {
    // RED: This should fail - IntroPage component doesn't exist yet
    render(
      <TestWrapper>
        <IntroPage userId="user-123" />
      </TestWrapper>
    )

    // Should show loading state initially
    expect(screen.getByText(/loading/i)).toBeInTheDocument()

    // Should render all main sections after loading
    await waitFor(() => {
      expect(screen.getByText(/user statistics/i)).toBeInTheDocument()
      expect(screen.getByText(/system overview/i)).toBeInTheDocument()
      expect(screen.getByText(/actionable items/i)).toBeInTheDocument()
      expect(screen.getByText(/activity feed/i)).toBeInTheDocument()
    })

    expect(mockIntroPageService.getIntroPageData).toHaveBeenCalledWith('user-123')
  })

  it('should handle loading states properly', async () => {
    // RED: This should fail - loading state management not implemented yet
    const delayedPromise = new Promise(resolve =>
      setTimeout(() => resolve(mockUserData), 100)
    )
    mockIntroPageService.getIntroPageData.mockReturnValue(delayedPromise)

    render(
      <TestWrapper>
        <IntroPage userId="user-123" />
      </TestWrapper>
    )

    // Should show loading indicator
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(screen.getByText(/loading your dashboard/i)).toBeInTheDocument()

    // Should hide loading after data loads
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    })
  })

  it('should handle error states gracefully', async () => {
    // RED: This should fail - error handling not implemented yet
    const errorMessage = 'Failed to load dashboard data'
    mockIntroPageService.getIntroPageData.mockRejectedValue(new Error(errorMessage))

    render(
      <TestWrapper>
        <IntroPage userId="user-123" />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument()
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })

    // Should show retry button
    const retryButton = screen.getByText(/retry/i)
    expect(retryButton).toBeInTheDocument()

    fireEvent.click(retryButton)
    expect(mockIntroPageService.getIntroPageData).toHaveBeenCalledTimes(2)
  })

  it('should support responsive layout switching', async () => {
    // RED: This should fail - responsive layout not implemented yet
    render(
      <TestWrapper>
        <IntroPage userId="user-123" />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByTestId('intro-page-container')).toBeInTheDocument()
    })

    const container = screen.getByTestId('intro-page-container')

    // Should have responsive classes
    expect(container).toHaveClass('grid')
    expect(container).toHaveClass('lg:grid-cols-3')
    expect(container).toHaveClass('md:grid-cols-2')
    expect(container).toHaveClass('grid-cols-1')
  })

  it('should update when userId changes', async () => {
    // RED: This should fail - userId change handling not implemented yet
    const { rerender } = render(
      <TestWrapper>
        <IntroPage userId="user-123" />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(mockIntroPageService.getIntroPageData).toHaveBeenCalledWith('user-123')
    })

    rerender(
      <TestWrapper>
        <IntroPage userId="user-456" />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(mockIntroPageService.getIntroPageData).toHaveBeenCalledWith('user-456')
    })
  })
})

describe('UserStatisticsCard Component', () => {
  it('should display user statistics correctly', () => {
    // RED: This should fail - UserStatisticsCard component doesn't exist yet
    render(
      <UserStatisticsCard
        statistics={mockUserData.userStatistics}
        isLoading={false}
      />
    )

    expect(screen.getByText('42')).toBeInTheDocument() // Document count
    expect(screen.getByText('8')).toBeInTheDocument() // Template count
    expect(screen.getByText(/board meeting minutes/i)).toBeInTheDocument()
  })

  it('should show loading skeleton when loading', () => {
    // RED: This should fail - loading skeleton not implemented yet
    render(
      <UserStatisticsCard
        statistics={null}
        isLoading={true}
      />
    )

    expect(screen.getByTestId('statistics-skeleton')).toBeInTheDocument()
    expect(screen.getAllByTestId('skeleton-line')).toHaveLength(4)
  })

  it('should handle document type breakdown visualization', () => {
    // RED: This should fail - document type visualization not implemented yet
    render(
      <UserStatisticsCard
        statistics={mockUserData.userStatistics}
        isLoading={false}
      />
    )

    // Should show document type breakdown
    expect(screen.getByText('Meeting Minutes: 15')).toBeInTheDocument()
    expect(screen.getByText('Policies: 12')).toBeInTheDocument()
    expect(screen.getByText('Notices: 15')).toBeInTheDocument()

    // Should show visual chart/progress bars
    expect(screen.getByTestId('document-type-chart')).toBeInTheDocument()
  })

  it('should navigate to documents on click', () => {
    // RED: This should fail - navigation not implemented yet
    render(
      <TestWrapper>
        <UserStatisticsCard
          statistics={mockUserData.userStatistics}
          isLoading={false}
        />
      </TestWrapper>
    )

    const viewAllButton = screen.getByText(/view all documents/i)
    fireEvent.click(viewAllButton)

    // Should navigate to documents page
    expect(window.location.pathname).toBe('/documents')
  })
})

describe('SystemOverviewCard Component', () => {
  it('should display system metrics correctly', () => {
    // RED: This should fail - SystemOverviewCard component doesn't exist yet
    render(
      <SystemOverviewCard
        overview={mockUserData.systemOverview}
        isLoading={false}
      />
    )

    expect(screen.getByText('150')).toBeInTheDocument() // Total users
    expect(screen.getByText('1,250')).toBeInTheDocument() // Active documents
    expect(screen.getByText('8')).toBeInTheDocument() // Documents today
    expect(screen.getByText('98.5%')).toBeInTheDocument() // Health score
  })

  it('should show health status indicator', () => {
    // RED: This should fail - health status indicator not implemented yet
    render(
      <SystemOverviewCard
        overview={mockUserData.systemOverview}
        isLoading={false}
      />
    )

    const healthIndicator = screen.getByTestId('health-indicator')
    expect(healthIndicator).toBeInTheDocument()
    expect(healthIndicator).toHaveClass('bg-green-500') // Healthy status
  })

  it('should format large numbers correctly', () => {
    // RED: This should fail - number formatting not implemented yet
    const largeNumbers = {
      ...mockUserData.systemOverview,
      active_documents: 12500,
      total_users: 1500
    }

    render(
      <SystemOverviewCard
        overview={largeNumbers}
        isLoading={false}
      />
    )

    expect(screen.getByText('12.5K')).toBeInTheDocument()
    expect(screen.getByText('1.5K')).toBeInTheDocument()
  })
})

describe('ActionableItemsCard Component', () => {
  it('should display actionable items with priority indicators', () => {
    // RED: This should fail - ActionableItemsCard component doesn't exist yet
    render(
      <ActionableItemsCard
        actionableItems={mockUserData.actionableItems}
        isLoading={false}
        onItemClick={() => {}}
      />
    )

    expect(screen.getByText('Budget Proposal Review')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument() // Pending approvals
    expect(screen.getByText('1')).toBeInTheDocument() // Urgent tasks

    // Should show priority indicator
    const priorityBadge = screen.getByTestId('priority-high')
    expect(priorityBadge).toBeInTheDocument()
    expect(priorityBadge).toHaveClass('bg-red-500')
  })

  it('should handle item click events', () => {
    // RED: This should fail - click handling not implemented yet
    const onItemClick = vi.fn()

    render(
      <ActionableItemsCard
        actionableItems={mockUserData.actionableItems}
        isLoading={false}
        onItemClick={onItemClick}
      />
    )

    const item = screen.getByText('Budget Proposal Review')
    fireEvent.click(item)

    expect(onItemClick).toHaveBeenCalledWith({
      id: 'approval-456',
      type: 'document_approval',
      title: 'Budget Proposal Review',
      due_date: '2025-09-15T17:00:00Z',
      priority: 'high',
      status: 'pending'
    })
  })

  it('should show due date warnings', () => {
    // RED: This should fail - due date warnings not implemented yet
    const overdueItem = {
      ...mockUserData.actionableItems,
      items: [{
        ...mockUserData.actionableItems.items[0],
        due_date: '2025-09-10T17:00:00Z' // Past due
      }]
    }

    render(
      <ActionableItemsCard
        actionableItems={overdueItem}
        isLoading={false}
        onItemClick={() => {}}
      />
    )

    expect(screen.getByText(/overdue/i)).toBeInTheDocument()
    expect(screen.getByTestId('overdue-indicator')).toHaveClass('text-red-600')
  })
})

describe('ActivityFeedCard Component', () => {
  it('should display recent activities', () => {
    // RED: This should fail - ActivityFeedCard component doesn't exist yet
    render(
      <ActivityFeedCard
        activityFeed={mockUserData.activityFeed}
        isLoading={false}
      />
    )

    expect(screen.getByText('Created new board meeting minutes')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument() // Unread count
  })

  it('should format activity timestamps', () => {
    // RED: This should fail - timestamp formatting not implemented yet
    render(
      <ActivityFeedCard
        activityFeed={mockUserData.activityFeed}
        isLoading={false}
      />
    )

    // Should show relative time
    expect(screen.getByText(/\d+ (minute|hour|day)s? ago/)).toBeInTheDocument()
  })

  it('should group activities by date', () => {
    // RED: This should fail - activity grouping not implemented yet
    const multiDayActivities = {
      ...mockUserData.activityFeed,
      activities: [
        ...mockUserData.activityFeed.activities,
        {
          id: 'activity-2',
          type: 'document_approved',
          description: 'Budget document approved',
          timestamp: '2025-09-11T14:30:00Z',
          related_document: 'doc-2'
        }
      ]
    }

    render(
      <ActivityFeedCard
        activityFeed={multiDayActivities}
        isLoading={false}
      />
    )

    expect(screen.getByText('Today')).toBeInTheDocument()
    expect(screen.getByText('Yesterday')).toBeInTheDocument()
  })

  it('should show activity type icons', () => {
    // RED: This should fail - activity type icons not implemented yet
    render(
      <ActivityFeedCard
        activityFeed={mockUserData.activityFeed}
        isLoading={false}
      />
    )

    const activityIcon = screen.getByTestId('activity-icon-document_created')
    expect(activityIcon).toBeInTheDocument()
  })
})

describe('PersonalizationPanel Component', () => {
  it('should display current personalization settings', () => {
    // RED: This should fail - PersonalizationPanel component doesn't exist yet
    render(
      <PersonalizationPanel
        personalization={mockUserData.personalization}
        onUpdate={() => {}}
        isLoading={false}
      />
    )

    expect(screen.getByDisplayValue('dark')).toBeInTheDocument()
    expect(screen.getByDisplayValue('compact')).toBeInTheDocument()
  })

  it('should handle theme changes', async () => {
    // RED: This should fail - theme change handling not implemented yet
    const onUpdate = vi.fn()

    render(
      <PersonalizationPanel
        personalization={mockUserData.personalization}
        onUpdate={onUpdate}
        isLoading={false}
      />
    )

    const themeSelector = screen.getByRole('combobox', { name: /theme/i })
    fireEvent.change(themeSelector, { target: { value: 'light' } })

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith({
        theme: 'light'
      })
    })
  })

  it('should handle notification preferences', () => {
    // RED: This should fail - notification preferences not implemented yet
    const onUpdate = vi.fn()

    render(
      <PersonalizationPanel
        personalization={mockUserData.personalization}
        onUpdate={onUpdate}
        isLoading={false}
      />
    )

    const emailToggle = screen.getByRole('switch', { name: /email notifications/i })
    expect(emailToggle).toBeChecked()

    fireEvent.click(emailToggle)
    expect(onUpdate).toHaveBeenCalledWith({
      notifications: {
        ...mockUserData.personalization.notifications,
        email: false
      }
    })
  })

  it('should handle widget configuration', () => {
    // RED: This should fail - widget configuration not implemented yet
    const onUpdate = vi.fn()

    render(
      <PersonalizationPanel
        personalization={mockUserData.personalization}
        onUpdate={onUpdate}
        isLoading={false}
      />
    )

    const widgetCheckbox = screen.getByRole('checkbox', { name: /recent documents/i })
    expect(widgetCheckbox).toBeChecked()

    fireEvent.click(widgetCheckbox)
    expect(onUpdate).toHaveBeenCalledWith({
      widgets: ['pending_tasks'] // Without recent_documents
    })
  })
})