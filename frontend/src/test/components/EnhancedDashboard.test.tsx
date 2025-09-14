/**
 * Enhanced Dashboard Integration Tests - TDD Red Phase
 * Testing integration of intro page components with existing dashboard
 */
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { EnhancedDashboard } from '../../components/dashboard/EnhancedDashboard'
import { introPageService } from '../../services/introPageService'

// Mock the intro page service
vi.mock('../../services/introPageService', () => ({
  introPageService: {
    getIntroPageData: vi.fn(),
    getIntroPageDataWithFallback: vi.fn(),
    updatePersonalization: vi.fn(),
  },
}))

const mockIntroPageService = introPageService as {
  getIntroPageData: Mock
  getIntroPageDataWithFallback: Mock
  updatePersonalization: Mock
}

// Mock fetch for documents API
global.fetch = vi.fn()
const mockFetch = fetch as Mock

// Mock data
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
    items: []
  },
  activityFeed: {
    user_id: 'user-123',
    recent_activities: ['document_created'],
    activities: [],
    unread_count: 2
  },
  personalization: {
    theme: 'dark' as const,
    dashboard_layout: 'compact' as const,
    notifications: { email: true, push: false, in_app: true },
    widgets: ['recent_documents', 'pending_tasks']
  },
  performanceMetrics: {
    coordination_time_ms: 234.5,
    data_sources: ['database', 'cache'],
    cache_hit_rate: 85.2,
    request_id: 'req-abc123'
  },
  lastUpdated: new Date('2025-09-13T10:45:23.123Z')
}

const mockDocuments = [
  {
    id: 'doc-1',
    title: 'Test Document',
    document_type: 'governance',
    version: 1,
    created_at: '2025-09-10T10:00:00Z',
    updated_at: '2025-09-12T10:00:00Z'
  }
]

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
)

describe('EnhancedDashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIntroPageService.getIntroPageData.mockResolvedValue(mockIntroPageData)
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ documents: mockDocuments })
    })
  })

  it('should render enhanced dashboard with intro page section', async () => {
    // RED: This should fail - EnhancedDashboard component doesn't exist yet
    render(
      <TestWrapper>
        <EnhancedDashboard userId="user-123" />
      </TestWrapper>
    )

    // Should show intro page section
    await waitFor(() => {
      expect(screen.getByTestId('intro-page-section')).toBeInTheDocument()
      expect(screen.getByText(/user statistics/i)).toBeInTheDocument()
    })

    // Should still show documents section
    await waitFor(() => {
      expect(screen.getByTestId('documents-section')).toBeInTheDocument()
    })

    expect(mockIntroPageService.getIntroPageData).toHaveBeenCalledWith('user-123')
  })

  it('should support dashboard view toggle between intro and documents', async () => {
    // RED: This should fail - view toggle not implemented yet
    render(
      <TestWrapper>
        <EnhancedDashboard userId="user-123" />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-view-toggle')).toBeInTheDocument()
    })

    const toggleButton = screen.getByTestId('dashboard-view-toggle')

    // Should start with overview view
    expect(screen.getByTestId('intro-page-section')).toBeInTheDocument()

    // Toggle to documents view
    fireEvent.click(toggleButton)
    await waitFor(() => {
      expect(screen.getByTestId('documents-section')).toBeInTheDocument()
      expect(screen.queryByTestId('intro-page-section')).not.toBeInTheDocument()
    })

    // Toggle back to overview
    fireEvent.click(toggleButton)
    await waitFor(() => {
      expect(screen.getByTestId('intro-page-section')).toBeInTheDocument()
    })
  })

  it('should integrate intro page personalization with dashboard layout', async () => {
    // RED: This should fail - personalization integration not implemented yet
    const customPersonalization = {
      ...mockIntroPageData,
      personalization: {
        ...mockIntroPageData.personalization,
        dashboard_layout: 'expanded' as const
      }
    }

    mockIntroPageService.getIntroPageData.mockResolvedValue(customPersonalization)

    render(
      <TestWrapper>
        <EnhancedDashboard userId="user-123" />
      </TestWrapper>
    )

    await waitFor(() => {
      const container = screen.getByTestId('dashboard-container')
      expect(container).toHaveClass('layout-expanded')
    })

    // Should reflect personalization changes
    const personalizationPanel = screen.getByTestId('personalization-panel')
    const layoutSelect = screen.getByRole('combobox', { name: /layout/i })

    fireEvent.change(layoutSelect, { target: { value: 'compact' } })

    await waitFor(() => {
      expect(mockIntroPageService.updatePersonalization).toHaveBeenCalledWith(
        'user-123',
        { dashboard_layout: 'compact' }
      )
    })
  })

  it('should show fallback when intro page service fails', async () => {
    // RED: This should fail - fallback handling not implemented yet
    mockIntroPageService.getIntroPageData.mockRejectedValue(new Error('Service unavailable'))
    mockIntroPageService.getIntroPageDataWithFallback.mockResolvedValue({
      ...mockIntroPageData,
      fallback_mode: true
    })

    render(
      <TestWrapper>
        <EnhancedDashboard userId="user-123" />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText(/fallback mode/i)).toBeInTheDocument()
      expect(screen.getByTestId('fallback-indicator')).toBeInTheDocument()
    })

    expect(mockIntroPageService.getIntroPageDataWithFallback).toHaveBeenCalledWith('user-123')
  })

  it('should integrate actionable items with document navigation', async () => {
    // RED: This should fail - actionable items navigation not implemented yet
    const mockActionableData = {
      ...mockIntroPageData,
      actionableItems: {
        ...mockIntroPageData.actionableItems,
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
      }
    }

    mockIntroPageService.getIntroPageData.mockResolvedValue(mockActionableData)

    render(
      <TestWrapper>
        <EnhancedDashboard userId="user-123" />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Budget Proposal Review')).toBeInTheDocument()
    })

    const actionableItem = screen.getByText('Budget Proposal Review')
    fireEvent.click(actionableItem)

    // Should navigate to documents section and highlight related document
    await waitFor(() => {
      expect(screen.getByTestId('documents-section')).toBeInTheDocument()
    })
  })

  it('should support responsive layout based on screen size', async () => {
    // RED: This should fail - responsive layout not implemented yet
    // Mock window resize
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 768 })

    render(
      <TestWrapper>
        <EnhancedDashboard userId="user-123" />
      </TestWrapper>
    )

    await waitFor(() => {
      const container = screen.getByTestId('dashboard-container')
      expect(container).toHaveClass('responsive-mobile')
    })

    // Simulate desktop size
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1200 })
    fireEvent.resize(window)

    await waitFor(() => {
      const container = screen.getByTestId('dashboard-container')
      expect(container).toHaveClass('responsive-desktop')
    })
  })

  it('should integrate user statistics with document filtering', async () => {
    // RED: This should fail - statistics-document integration not implemented yet
    render(
      <TestWrapper>
        <EnhancedDashboard userId="user-123" />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Meeting Minutes: 15')).toBeInTheDocument()
    })

    // Click on document type in statistics
    const documentTypeItem = screen.getByText('Meeting Minutes: 15')
    fireEvent.click(documentTypeItem)

    // Should filter documents to show only meeting minutes
    await waitFor(() => {
      expect(screen.getByTestId('documents-section')).toBeInTheDocument()
      const filterSelect = screen.getByRole('combobox', { name: /filter/i })
      expect(filterSelect).toHaveValue('meeting')
    })
  })

  it('should show loading states appropriately', async () => {
    // RED: This should fail - coordinated loading states not implemented yet
    const slowPromise = new Promise(resolve => setTimeout(() => resolve(mockIntroPageData), 1000))
    mockIntroPageService.getIntroPageData.mockReturnValue(slowPromise)

    render(
      <TestWrapper>
        <EnhancedDashboard userId="user-123" />
      </TestWrapper>
    )

    // Should show loading for intro section while documents load normally
    expect(screen.getByTestId('intro-loading-skeleton')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByTestId('documents-section')).toBeInTheDocument()
    })

    // Intro section should still be loading
    expect(screen.getByTestId('intro-loading-skeleton')).toBeInTheDocument()
  })

  it('should handle theme changes across entire dashboard', async () => {
    // RED: This should fail - global theme handling not implemented yet
    render(
      <TestWrapper>
        <EnhancedDashboard userId="user-123" />
      </TestWrapper>
    )

    await waitFor(() => {
      const dashboardContainer = screen.getByTestId('dashboard-container')
      expect(dashboardContainer).toHaveClass('theme-dark')
    })

    // Change theme via personalization panel
    const themeSelect = screen.getByRole('combobox', { name: /theme/i })
    fireEvent.change(themeSelect, { target: { value: 'light' } })

    await waitFor(() => {
      const dashboardContainer = screen.getByTestId('dashboard-container')
      expect(dashboardContainer).toHaveClass('theme-light')
    })

    expect(mockIntroPageService.updatePersonalization).toHaveBeenCalledWith(
      'user-123',
      { theme: 'light' }
    )
  })

  it('should provide quick access navigation', async () => {
    // RED: This should fail - quick access navigation not implemented yet
    render(
      <TestWrapper>
        <EnhancedDashboard userId="user-123" />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByTestId('quick-access-bar')).toBeInTheDocument()
    })

    const quickAccessItems = screen.getAllByTestId(/^quick-access-/)
    expect(quickAccessItems.length).toBeGreaterThan(0)

    // Should include shortcuts to create document, view tasks, etc.
    expect(screen.getByTestId('quick-access-create-document')).toBeInTheDocument()
    expect(screen.getByTestId('quick-access-pending-tasks')).toBeInTheDocument()

    // Click on quick access item
    const createDocumentShortcut = screen.getByTestId('quick-access-create-document')
    fireEvent.click(createDocumentShortcut)

    // Should navigate appropriately
    expect(window.location.pathname).toBe('/editor')
  })

  it('should support dashboard widget customization', async () => {
    // RED: This should fail - widget customization not implemented yet
    render(
      <TestWrapper>
        <EnhancedDashboard userId="user-123" />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByTestId('widget-customization-panel')).toBeInTheDocument()
    })

    const widgetCheckboxes = screen.getAllByRole('checkbox', { name: /widget/i })
    expect(widgetCheckboxes.length).toBeGreaterThan(0)

    // Toggle off recent documents widget
    const recentDocsCheckbox = screen.getByRole('checkbox', { name: /recent documents/i })
    fireEvent.click(recentDocsCheckbox)

    await waitFor(() => {
      expect(mockIntroPageService.updatePersonalization).toHaveBeenCalledWith(
        'user-123',
        { widgets: ['pending_tasks'] }
      )
    })

    // Recent documents widget should be hidden
    expect(screen.queryByTestId('recent-documents-widget')).not.toBeInTheDocument()
  })

  it('should handle concurrent data updates', async () => {
    // RED: This should fail - concurrent update handling not implemented yet
    render(
      <TestWrapper>
        <EnhancedDashboard userId="user-123" />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-container')).toBeInTheDocument()
    })

    // Simulate concurrent updates
    const updatedData = { ...mockIntroPageData, userStatistics: { ...mockIntroPageData.userStatistics, documentCount: 45 } }
    mockIntroPageService.getIntroPageData.mockResolvedValue(updatedData)

    // Trigger refresh
    const refreshButton = screen.getByTestId('dashboard-refresh')
    fireEvent.click(refreshButton)

    await waitFor(() => {
      expect(screen.getByText('45')).toBeInTheDocument() // Updated document count
    })

    // Should maintain user's current view state during update
    expect(screen.getByTestId('intro-page-section')).toBeInTheDocument()
  })

  it('should provide accessibility features', async () => {
    // RED: This should fail - accessibility features not implemented yet
    render(
      <TestWrapper>
        <EnhancedDashboard userId="user-123" />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-container')).toBeInTheDocument()
    })

    // Should have proper ARIA landmarks
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('navigation')).toBeInTheDocument()

    // Should support keyboard navigation
    const firstFocusableElement = screen.getByTestId('dashboard-view-toggle')
    firstFocusableElement.focus()

    fireEvent.keyDown(firstFocusableElement, { key: 'Tab' })

    // Should move focus to next element
    const nextElement = screen.getByTestId('quick-access-create-document')
    expect(nextElement).toHaveFocus()

    // Should support skip links
    expect(screen.getByTestId('skip-to-content')).toBeInTheDocument()
  })
})