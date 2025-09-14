/**
 * PersonalStats Component Tests - TDD Red Phase
 * Testing user-specific productivity metrics
 */
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PersonalStats } from '../../components/intro/PersonalStats'

// Mock data
const mockPersonalStatsData = {
  userId: 'user-123',
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
      status: 'approved',
      type: 'meeting'
    },
    {
      id: 'doc-2',
      title: 'Community Policy Update',
      updatedAt: new Date('2025-09-11T14:20:00Z'),
      status: 'draft',
      type: 'policy'
    },
    {
      id: 'doc-3',
      title: 'Maintenance Notice',
      updatedAt: new Date('2025-09-10T09:15:00Z'),
      status: 'published',
      type: 'notice'
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
    { date: '2025-09-11', documents: 1, collaborations: 3 },
    { date: '2025-09-10', documents: 3, collaborations: 0 },
    { date: '2025-09-09', documents: 0, collaborations: 2 },
    { date: '2025-09-08', documents: 1, collaborations: 1 }
  ]
}

type TimeRange = 'week' | 'month' | 'quarter' | 'year'

describe('PersonalStats Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render personal statistics with user metrics', () => {
    // RED: This should fail - PersonalStats component doesn't exist yet
    render(
      <PersonalStats
        userId="user-123"
        data={mockPersonalStatsData}
        loading={false}
        timeRange="month"
        onTimeRangeChange={vi.fn()}
      />
    )

    // Should display document count
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('Documents Created')).toBeInTheDocument()

    // Should display template count
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('Templates')).toBeInTheDocument()

    // Should display productivity score
    expect(screen.getByText('92.5')).toBeInTheDocument()
    expect(screen.getByText('Productivity Score')).toBeInTheDocument()
  })

  it('should display document creation timeline visualization', () => {
    // RED: This should fail - timeline visualization not implemented yet
    render(
      <PersonalStats
        userId="user-123"
        data={mockPersonalStatsData}
        loading={false}
        timeRange="week"
        onTimeRangeChange={vi.fn()}
      />
    )

    // Should show activity timeline
    expect(screen.getByTestId('activity-timeline')).toBeInTheDocument()

    // Should display recent activity data
    expect(screen.getByTestId('timeline-chart')).toBeInTheDocument()

    // Should show daily document counts in timeline
    const timelineChart = screen.getByTestId('timeline-chart')
    expect(timelineChart).toBeInTheDocument()
    // Timeline shows activity data for the recent dates
    expect(timelineChart.textContent).toMatch(/Sep 1[0-9]/)
  })

  it('should show collaboration activity metrics', () => {
    // RED: This should fail - collaboration metrics not implemented yet
    render(
      <PersonalStats
        userId="user-123"
        data={mockPersonalStatsData}
        loading={false}
        timeRange="month"
        onTimeRangeChange={vi.fn()}
      />
    )

    // Should display collaboration score
    expect(screen.getByText('85')).toBeInTheDocument()
    expect(screen.getByText('Collaboration Score')).toBeInTheDocument()

    // Should show workflow participation - use more specific queries
    const workflowSection = screen.getByText('Workflow Participation').closest('div')
    expect(workflowSection).toBeInTheDocument()

    // Check for approvals and reviews within workflow section
    expect(workflowSection).toHaveTextContent('25')
    expect(workflowSection).toHaveTextContent('18')
    expect(screen.getByText('Approvals Completed')).toBeInTheDocument()
    expect(screen.getByText('Reviews Completed')).toBeInTheDocument()
  })

  it('should support time range filtering', () => {
    // RED: This should fail - time range filtering not implemented yet
    const mockOnTimeRangeChange = vi.fn()

    render(
      <PersonalStats
        userId="user-123"
        data={mockPersonalStatsData}
        loading={false}
        timeRange="month"
        onTimeRangeChange={mockOnTimeRangeChange}
      />
    )

    // Should have time range selector
    const timeRangeSelect = screen.getByTestId('time-range-selector')
    expect(timeRangeSelect).toBeInTheDocument()

    // Should show current selection
    expect(screen.getByDisplayValue('This Month')).toBeInTheDocument()

    // Should handle time range changes
    fireEvent.change(timeRangeSelect, { target: { value: 'week' } })
    expect(mockOnTimeRangeChange).toHaveBeenCalledWith('week')
  })

  it('should display recent documents list', () => {
    // RED: This should fail - recent documents display not implemented yet
    render(
      <PersonalStats
        userId="user-123"
        data={mockPersonalStatsData}
        loading={false}
        timeRange="month"
        onTimeRangeChange={vi.fn()}
      />
    )

    // Should show recent documents section
    expect(screen.getByText('Recent Documents')).toBeInTheDocument()

    // Should display document titles
    expect(screen.getByText('Board Meeting Minutes - September 2025')).toBeInTheDocument()
    expect(screen.getByText('Community Policy Update')).toBeInTheDocument()

    // Should show document status
    expect(screen.getByText('approved')).toBeInTheDocument()
    expect(screen.getByText('draft')).toBeInTheDocument()
  })

  it('should show document type breakdown visualization', () => {
    // RED: This should fail - document type visualization not implemented yet
    render(
      <PersonalStats
        userId="user-123"
        data={mockPersonalStatsData}
        loading={false}
        timeRange="month"
        onTimeRangeChange={vi.fn()}
      />
    )

    // Should display document types chart
    expect(screen.getByTestId('document-types-breakdown')).toBeInTheDocument()

    // Should show document type counts
    expect(screen.getByText('meeting: 15')).toBeInTheDocument()
    expect(screen.getByText('policy: 12')).toBeInTheDocument()
    expect(screen.getByText('notice: 10')).toBeInTheDocument()
    expect(screen.getByText('governance: 5')).toBeInTheDocument()
  })

  it('should calculate and display productivity score', () => {
    // RED: This should fail - productivity calculation visualization not implemented yet
    render(
      <PersonalStats
        userId="user-123"
        data={mockPersonalStatsData}
        loading={false}
        timeRange="month"
        onTimeRangeChange={vi.fn()}
      />
    )

    // Should show productivity score with visual indicator
    const productivityIndicator = screen.getByTestId('productivity-score-indicator')
    expect(productivityIndicator).toBeInTheDocument()

    // Should have appropriate styling for high score (>90)
    expect(productivityIndicator).toHaveClass('score-excellent')

    // Should show score breakdown
    expect(screen.getByTestId('productivity-breakdown')).toBeInTheDocument()
  })

  it('should handle loading state with skeleton', () => {
    // RED: This should fail - loading skeleton not implemented yet
    render(
      <PersonalStats
        userId="user-123"
        data={null}
        loading={true}
        timeRange="month"
        onTimeRangeChange={vi.fn()}
      />
    )

    // Should show loading skeleton
    expect(screen.getByTestId('personal-stats-skeleton')).toBeInTheDocument()

    // Should not show actual data
    expect(screen.queryByText('42')).not.toBeInTheDocument()
  })

  it('should handle workflow participation metrics', () => {
    // RED: This should fail - workflow metrics not implemented yet
    render(
      <PersonalStats
        userId="user-123"
        data={mockPersonalStatsData}
        loading={false}
        timeRange="month"
        onTimeRangeChange={vi.fn()}
      />
    )

    // Should display workflow participation section
    expect(screen.getByText('Workflow Participation')).toBeInTheDocument()

    // Should show tasks completion rate
    const completionRate = (6 / 8) * 100 // 75%
    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.getByText('Task Completion Rate')).toBeInTheDocument()

    // Should show assigned vs completed tasks
    expect(screen.getByText('6 of 8 tasks completed')).toBeInTheDocument()
  })

  it('should support mobile responsive design', () => {
    // RED: This should fail - responsive design not implemented yet
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 })

    render(
      <PersonalStats
        userId="user-123"
        data={mockPersonalStatsData}
        loading={false}
        timeRange="month"
        onTimeRangeChange={vi.fn()}
      />
    )

    const container = screen.getByTestId('personal-stats-container')
    expect(container).toHaveClass('mobile-layout')

    // Should stack elements vertically on mobile
    expect(screen.getByTestId('stats-grid')).toHaveClass('grid-cols-1')
  })

  it('should handle empty or no data state', () => {
    // RED: This should fail - empty state handling not implemented yet
    const emptyData = {
      ...mockPersonalStatsData,
      documentCount: 0,
      recentDocuments: []
    }

    render(
      <PersonalStats
        userId="user-123"
        data={emptyData}
        loading={false}
        timeRange="month"
        onTimeRangeChange={vi.fn()}
      />
    )

    // Should show empty state message
    expect(screen.getByTestId('empty-stats-message')).toBeInTheDocument()
    expect(screen.getByText(/no documents created/i)).toBeInTheDocument()

    // Should show encouragement to create documents
    expect(screen.getByText(/start creating/i)).toBeInTheDocument()
  })

  it('should support document navigation from recent list', () => {
    // RED: This should fail - document navigation not implemented yet
    const mockOnDocumentClick = vi.fn()

    render(
      <PersonalStats
        userId="user-123"
        data={mockPersonalStatsData}
        loading={false}
        timeRange="month"
        onTimeRangeChange={vi.fn()}
        onDocumentClick={mockOnDocumentClick}
      />
    )

    // Should make recent documents clickable
    const firstDocument = screen.getByTestId('recent-document-doc-1')
    expect(firstDocument).toBeInTheDocument()

    fireEvent.click(firstDocument)
    expect(mockOnDocumentClick).toHaveBeenCalledWith('doc-1')
  })

  it('should display current week/month statistics', () => {
    // RED: This should fail - current period stats not implemented yet
    render(
      <PersonalStats
        userId="user-123"
        data={mockPersonalStatsData}
        loading={false}
        timeRange="week"
        onTimeRangeChange={vi.fn()}
      />
    )

    // Should show current week stats (find in the metrics grid, not the dropdown)
    const statsGrid = screen.getByTestId('stats-grid')
    expect(statsGrid).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    // Find "This Week" specifically in the stats grid context
    expect(statsGrid.textContent).toContain('This Week')

    // Should show comparison with previous period
    expect(screen.getByTestId('period-comparison')).toBeInTheDocument()
  })

  it('should provide accessibility features', () => {
    // RED: This should fail - accessibility features not implemented yet
    render(
      <PersonalStats
        userId="user-123"
        data={mockPersonalStatsData}
        loading={false}
        timeRange="month"
        onTimeRangeChange={vi.fn()}
      />
    )

    // Should have proper ARIA labels
    expect(screen.getByRole('region', { name: 'Personal Statistics Dashboard' })).toBeInTheDocument()

    // Should have screen reader accessible charts
    expect(screen.getByLabelText('Document creation timeline')).toBeInTheDocument()
    expect(screen.getByLabelText('Productivity score indicator')).toBeInTheDocument()

    // Should support keyboard navigation
    const timeRangeSelect = screen.getByTestId('time-range-selector')
    expect(timeRangeSelect).toHaveAttribute('tabIndex', '0')
  })

  it('should handle data updates and animations', () => {
    // RED: This should fail - data updates and animations not implemented yet
    const { rerender } = render(
      <PersonalStats
        userId="user-123"
        data={mockPersonalStatsData}
        loading={false}
        timeRange="month"
        onTimeRangeChange={vi.fn()}
      />
    )

    // Initial data
    expect(screen.getByText('42')).toBeInTheDocument()

    // Update data
    const updatedData = {
      ...mockPersonalStatsData,
      documentCount: 45,
      productivityScore: 95.0
    }

    rerender(
      <PersonalStats
        userId="user-123"
        data={updatedData}
        loading={false}
        timeRange="month"
        onTimeRangeChange={vi.fn()}
      />
    )

    // Should animate to new values
    expect(screen.getByText('45')).toBeInTheDocument()
    expect(screen.getByText('95')).toBeInTheDocument()

    // Should show update indicator
    expect(screen.getByTestId('stats-updated-indicator')).toBeInTheDocument()
  })
})