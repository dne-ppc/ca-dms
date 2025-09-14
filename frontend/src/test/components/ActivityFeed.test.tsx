/**
 * ActivityFeed Component Tests - TDD Red Phase
 * Testing real-time activity stream with timeline display
 */
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActivityFeed, ActivityItem } from '../../components/intro/ActivityFeed'

// Mock activity data with comprehensive real-time scenarios
const mockActivityItems: ActivityItem[] = [
  {
    id: 'activity-001',
    type: 'document_created',
    title: 'New Document Created',
    description: 'Created "Board Meeting Minutes - Q4 2024"',
    timestamp: new Date('2024-12-20T10:30:00Z'),
    user: {
      id: 'user-001',
      name: 'Alice Johnson',
      avatar: '/avatars/alice.jpg',
      role: 'Manager'
    },
    metadata: {
      documentId: 'doc-001',
      documentTitle: 'Board Meeting Minutes - Q4 2024',
      category: 'meeting',
      priority: 'high'
    },
    status: 'completed',
    actions: ['view', 'edit']
  },
  {
    id: 'activity-002',
    type: 'document_updated',
    title: 'Document Updated',
    description: 'Updated "Employee Handbook" with new policies',
    timestamp: new Date('2024-12-20T09:45:00Z'),
    user: {
      id: 'user-002',
      name: 'Bob Smith',
      avatar: '/avatars/bob.jpg',
      role: 'HR Director'
    },
    metadata: {
      documentId: 'doc-002',
      documentTitle: 'Employee Handbook',
      changes: ['added_section', 'updated_policy'],
      version: '2.1'
    },
    status: 'completed',
    actions: ['view', 'compare']
  },
  {
    id: 'activity-003',
    type: 'approval_pending',
    title: 'Approval Required',
    description: 'Budget proposal awaiting your approval',
    timestamp: new Date('2024-12-20T09:15:00Z'),
    user: {
      id: 'user-003',
      name: 'Carol Davis',
      avatar: '/avatars/carol.jpg',
      role: 'Finance Manager'
    },
    metadata: {
      documentId: 'doc-003',
      documentTitle: 'Q1 2025 Budget Proposal',
      approvalType: 'budget',
      deadline: new Date('2024-12-25T17:00:00Z')
    },
    status: 'pending',
    actions: ['approve', 'reject', 'view']
  },
  {
    id: 'activity-004',
    type: 'comment_added',
    title: 'New Comment',
    description: 'Added comment on contract review',
    timestamp: new Date('2024-12-20T08:30:00Z'),
    user: {
      id: 'user-004',
      name: 'David Wilson',
      avatar: '/avatars/david.jpg',
      role: 'Legal Counsel'
    },
    metadata: {
      documentId: 'doc-004',
      documentTitle: 'Vendor Contract Review',
      commentId: 'comment-001',
      commentText: 'Please review clause 5.2 for liability terms'
    },
    status: 'completed',
    actions: ['view', 'reply']
  },
  {
    id: 'activity-005',
    type: 'workflow_started',
    title: 'Workflow Started',
    description: 'Policy review workflow initiated',
    timestamp: new Date('2024-12-20T08:00:00Z'),
    user: {
      id: 'user-001',
      name: 'Alice Johnson',
      avatar: '/avatars/alice.jpg',
      role: 'Manager'
    },
    metadata: {
      workflowId: 'workflow-001',
      workflowName: 'Policy Review Process',
      documentId: 'doc-005',
      documentTitle: 'Data Privacy Policy',
      steps: 3,
      currentStep: 1
    },
    status: 'in_progress',
    actions: ['view', 'monitor']
  }
]

const defaultProps = {
  activities: mockActivityItems,
  loading: false,
  onActivityClick: vi.fn(),
  onActionClick: vi.fn(),
  onLoadMore: vi.fn(),
  onRefresh: vi.fn(),
  hasMore: true
}

describe('ActivityFeed Component - TDD Red Phase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Timeline Display and Layout', () => {
    it('should display activity feed with timeline layout', () => {
      render(<ActivityFeed {...defaultProps} />)

      // Should display main activity feed container
      const feedContainer = screen.getByTestId('activity-feed-container')
      expect(feedContainer).toBeInTheDocument()
      expect(feedContainer).toHaveClass('activity-timeline')

      // Should have header with title and actions
      const feedHeader = screen.getByTestId('activity-feed-header')
      expect(feedHeader).toBeInTheDocument()
      expect(feedHeader).toHaveTextContent('Recent Activity')
    })

    it('should render activity items in chronological order', () => {
      render(<ActivityFeed {...defaultProps} />)

      // Should display all activity items
      const activityItems = screen.getAllByTestId(/^activity-item-/)
      expect(activityItems).toHaveLength(5)

      // Should be ordered by timestamp (newest first)
      const firstActivity = screen.getByTestId('activity-item-activity-001')
      const lastActivity = screen.getByTestId('activity-item-activity-005')

      const firstIndex = Array.from(activityItems).indexOf(firstActivity)
      const lastIndex = Array.from(activityItems).indexOf(lastActivity)
      expect(firstIndex).toBeLessThan(lastIndex)
    })

    it('should display activity items with timeline connectors', () => {
      render(<ActivityFeed {...defaultProps} />)

      // Each activity should have timeline elements
      mockActivityItems.forEach(activity => {
        const timelineMarker = screen.getByTestId(`timeline-marker-${activity.id}`)
        expect(timelineMarker).toBeInTheDocument()
        expect(timelineMarker).toHaveClass('timeline-marker')

        const timelineConnector = screen.getByTestId(`timeline-connector-${activity.id}`)
        expect(timelineConnector).toBeInTheDocument()
        expect(timelineConnector).toHaveClass('timeline-line')
      })
    })

    it('should show activity type icons and status indicators', () => {
      render(<ActivityFeed {...defaultProps} />)

      // Document created activity
      const documentIcon = screen.getByTestId('activity-icon-activity-001')
      expect(documentIcon).toBeInTheDocument()
      expect(documentIcon).toHaveClass('icon-document-create')

      // Approval pending activity
      const approvalIcon = screen.getByTestId('activity-icon-activity-003')
      expect(approvalIcon).toBeInTheDocument()
      expect(approvalIcon).toHaveClass('icon-approval-pending')

      // Status indicators
      const completedStatus = screen.getByTestId('status-indicator-activity-001')
      expect(completedStatus).toHaveClass('status-completed')

      const pendingStatus = screen.getByTestId('status-indicator-activity-003')
      expect(pendingStatus).toHaveClass('status-pending')
    })

    it('should display relative timestamps with hover details', () => {
      render(<ActivityFeed {...defaultProps} />)

      // Should show relative time (e.g., "2 hours ago")
      const relativeTime = screen.getByTestId('relative-time-activity-001')
      expect(relativeTime).toBeInTheDocument()
      expect(relativeTime).toHaveTextContent(/ago$/)

      // Should have title with absolute timestamp
      expect(relativeTime).toHaveAttribute('title')
      const absoluteTime = relativeTime.getAttribute('title')
      expect(absoluteTime).toContain('2024-12-20')
    })
  })

  describe('User Information and Avatars', () => {
    it('should display user avatars and names for each activity', () => {
      render(<ActivityFeed {...defaultProps} />)

      // Should show user avatars
      const aliceAvatar = screen.getByTestId('user-avatar-activity-001')
      expect(aliceAvatar).toBeInTheDocument()
      expect(aliceAvatar).toHaveAttribute('src', '/avatars/alice.jpg')
      expect(aliceAvatar).toHaveAttribute('alt', 'Alice Johnson')

      // Should show user names
      const userName = screen.getByTestId('user-name-activity-001')
      expect(userName).toBeInTheDocument()
      expect(userName).toHaveTextContent('Alice Johnson')

      // Should show user roles
      const userRole = screen.getByTestId('user-role-activity-001')
      expect(userRole).toBeInTheDocument()
      expect(userRole).toHaveTextContent('Manager')
    })

    it('should group consecutive activities by same user', () => {
      const sameUserActivities = [
        { ...mockActivityItems[0], id: 'act-1', timestamp: new Date('2024-12-20T10:30:00Z') },
        { ...mockActivityItems[0], id: 'act-2', timestamp: new Date('2024-12-20T10:25:00Z') },
        { ...mockActivityItems[1], id: 'act-3', timestamp: new Date('2024-12-20T10:20:00Z') }
      ]

      render(<ActivityFeed {...defaultProps} activities={sameUserActivities} />)

      // First activity should show full user info
      expect(screen.getByTestId('user-avatar-act-1')).toBeInTheDocument()

      // Second activity by same user should be grouped (minimal user info)
      const groupedActivity = screen.getByTestId('activity-item-act-2')
      expect(groupedActivity).toHaveClass('activity-grouped')

      // Third activity by different user should show full info again
      expect(screen.getByTestId('user-avatar-act-3')).toBeInTheDocument()
    })

    it('should handle missing user avatars gracefully', () => {
      const activitiesWithoutAvatars = mockActivityItems.map(activity => ({
        ...activity,
        user: { ...activity.user, avatar: undefined }
      }))

      render(<ActivityFeed {...defaultProps} activities={activitiesWithoutAvatars} />)

      // Should show default avatar or initials
      const defaultAvatar = screen.getByTestId('user-avatar-activity-001')
      expect(defaultAvatar).toBeInTheDocument()
      expect(defaultAvatar).toHaveClass('avatar-default')
      expect(defaultAvatar).toHaveTextContent('AJ') // Initials
    })
  })

  describe('Activity Content and Metadata', () => {
    it('should display activity title and description', () => {
      render(<ActivityFeed {...defaultProps} />)

      // Should show activity titles
      const activityTitle = screen.getByTestId('activity-title-activity-001')
      expect(activityTitle).toBeInTheDocument()
      expect(activityTitle).toHaveTextContent('New Document Created')

      // Should show activity descriptions
      const activityDescription = screen.getByTestId('activity-description-activity-001')
      expect(activityDescription).toBeInTheDocument()
      expect(activityDescription).toHaveTextContent('Created "Board Meeting Minutes - Q4 2024"')
    })

    it('should display context-specific metadata', () => {
      render(<ActivityFeed {...defaultProps} />)

      // Document creation metadata
      const documentMetadata = screen.getByTestId('activity-metadata-activity-001')
      expect(documentMetadata).toBeInTheDocument()
      expect(documentMetadata).toHaveTextContent('Document: Board Meeting Minutes - Q4 2024')
      expect(documentMetadata).toHaveTextContent('Category: meeting')

      // Approval metadata with deadline
      const approvalMetadata = screen.getByTestId('activity-metadata-activity-003')
      expect(approvalMetadata).toBeInTheDocument()
      expect(approvalMetadata).toHaveTextContent('Deadline:')
      expect(approvalMetadata).toHaveClass('metadata-urgent') // Near deadline
    })

    it('should show expandable details for complex activities', () => {
      render(<ActivityFeed {...defaultProps} />)

      // Workflow activity should have expandable details
      const workflowActivity = screen.getByTestId('activity-item-activity-005')
      const expandButton = screen.getByTestId('expand-details-activity-005')
      expect(expandButton).toBeInTheDocument()

      // Should show collapsed state initially
      expect(screen.queryByTestId('expanded-details-activity-005')).not.toBeInTheDocument()
    })

    it('should expand activity details when requested', async () => {
      const user = userEvent.setup()
      render(<ActivityFeed {...defaultProps} />)

      // Click expand button
      const expandButton = screen.getByTestId('expand-details-activity-005')
      await user.click(expandButton)

      // Should show expanded details
      const expandedDetails = screen.getByTestId('expanded-details-activity-005')
      expect(expandedDetails).toBeInTheDocument()
      expect(expandedDetails).toHaveTextContent('Steps: 3')
      expect(expandedDetails).toHaveTextContent('Current Step: 1')
    })
  })

  describe('Interactive Actions and Buttons', () => {
    it('should display contextual action buttons for each activity', () => {
      render(<ActivityFeed {...defaultProps} />)

      // Document creation should have view/edit actions
      const viewButton = screen.getByTestId('action-view-activity-001')
      expect(viewButton).toBeInTheDocument()
      expect(viewButton).toHaveTextContent('View')

      const editButton = screen.getByTestId('action-edit-activity-001')
      expect(editButton).toBeInTheDocument()
      expect(editButton).toHaveTextContent('Edit')

      // Approval should have approve/reject/view actions
      const approveButton = screen.getByTestId('action-approve-activity-003')
      expect(approveButton).toBeInTheDocument()
      expect(approveButton).toHaveClass('action-primary')

      const rejectButton = screen.getByTestId('action-reject-activity-003')
      expect(rejectButton).toBeInTheDocument()
      expect(rejectButton).toHaveClass('action-danger')
    })

    it('should handle action button clicks', async () => {
      const user = userEvent.setup()
      render(<ActivityFeed {...defaultProps} />)

      // Click view action
      const viewButton = screen.getByTestId('action-view-activity-001')
      await user.click(viewButton)

      expect(defaultProps.onActionClick).toHaveBeenCalledWith('view', mockActivityItems[0])

      // Click approve action
      const approveButton = screen.getByTestId('action-approve-activity-003')
      await user.click(approveButton)

      expect(defaultProps.onActionClick).toHaveBeenCalledWith('approve', mockActivityItems[2])
    })

    it('should handle activity item clicks for navigation', async () => {
      const user = userEvent.setup()
      render(<ActivityFeed {...defaultProps} />)

      // Click on activity item
      const activityItem = screen.getByTestId('activity-item-activity-001')
      await user.click(activityItem)

      expect(defaultProps.onActivityClick).toHaveBeenCalledWith(mockActivityItems[0])
    })

    it('should disable actions based on permissions or status', () => {
      const restrictedActivities = mockActivityItems.map(activity => ({
        ...activity,
        actions: activity.status === 'completed' ? ['view'] : activity.actions
      }))

      render(<ActivityFeed {...defaultProps} activities={restrictedActivities} />)

      // Completed activities should only have view action
      expect(screen.getByTestId('action-view-activity-001')).toBeInTheDocument()
      expect(screen.queryByTestId('action-edit-activity-001')).not.toBeInTheDocument()
    })
  })

  describe('Real-time Updates and Loading States', () => {
    it('should display loading state while fetching activities', () => {
      render(<ActivityFeed {...defaultProps} loading={true} activities={[]} />)

      // Should show loading skeleton
      const loadingContainer = screen.getByTestId('activity-feed-loading')
      expect(loadingContainer).toBeInTheDocument()

      // Should show multiple skeleton items
      const skeletonItems = screen.getAllByTestId(/^activity-skeleton-/)
      expect(skeletonItems).toHaveLength(3) // Default skeleton count
    })

    it('should show empty state when no activities exist', () => {
      render(<ActivityFeed {...defaultProps} activities={[]} />)

      // Should show empty state
      const emptyState = screen.getByTestId('activity-feed-empty')
      expect(emptyState).toBeInTheDocument()
      expect(emptyState).toHaveTextContent('No recent activity')

      // Should have illustration or icon
      const emptyIcon = screen.getByTestId('empty-state-icon')
      expect(emptyIcon).toBeInTheDocument()
    })

    it('should handle refresh functionality', async () => {
      const user = userEvent.setup()
      render(<ActivityFeed {...defaultProps} />)

      // Should have refresh button
      const refreshButton = screen.getByTestId('refresh-activities-button')
      expect(refreshButton).toBeInTheDocument()

      // Click refresh
      await user.click(refreshButton)
      expect(defaultProps.onRefresh).toHaveBeenCalled()
    })

    it('should support infinite scroll with load more', async () => {
      const user = userEvent.setup()
      render(<ActivityFeed {...defaultProps} />)

      // Should show load more button when hasMore is true
      const loadMoreButton = screen.getByTestId('load-more-activities-button')
      expect(loadMoreButton).toBeInTheDocument()
      expect(loadMoreButton).toHaveTextContent('Load More')

      // Click load more
      await user.click(loadMoreButton)
      expect(defaultProps.onLoadMore).toHaveBeenCalled()
    })

    it('should hide load more when no more activities available', () => {
      render(<ActivityFeed {...defaultProps} hasMore={false} />)

      // Should not show load more button
      expect(screen.queryByTestId('load-more-activities-button')).not.toBeInTheDocument()

      // Should show end message
      const endMessage = screen.getByTestId('activities-end-message')
      expect(endMessage).toBeInTheDocument()
      expect(endMessage).toHaveTextContent('You\'re all caught up!')
    })
  })

  describe('Filtering and Search Capabilities', () => {
    it('should provide activity type filters', () => {
      render(<ActivityFeed {...defaultProps} />)

      // Should have filter dropdown
      const filterDropdown = screen.getByTestId('activity-type-filter')
      expect(filterDropdown).toBeInTheDocument()

      // Should have filter options
      const allFilter = screen.getByTestId('filter-option-all')
      expect(allFilter).toBeInTheDocument()
      expect(allFilter).toHaveTextContent('All Activities')

      const documentsFilter = screen.getByTestId('filter-option-documents')
      expect(documentsFilter).toBeInTheDocument()
      expect(documentsFilter).toHaveTextContent('Documents')

      const approvalsFilter = screen.getByTestId('filter-option-approvals')
      expect(approvalsFilter).toBeInTheDocument()
      expect(approvalsFilter).toHaveTextContent('Approvals')
    })

    it('should filter activities by type', async () => {
      const user = userEvent.setup()
      render(<ActivityFeed {...defaultProps} />)

      // Filter by document activities
      const filterDropdown = screen.getByTestId('activity-type-filter')
      await user.selectOptions(filterDropdown, 'documents')

      // Should only show document-related activities
      expect(screen.getByTestId('activity-item-activity-001')).toBeInTheDocument() // document_created
      expect(screen.getByTestId('activity-item-activity-002')).toBeInTheDocument() // document_updated
      expect(screen.queryByTestId('activity-item-activity-003')).not.toBeInTheDocument() // approval_pending
    })

    it('should support search within activity content', async () => {
      const user = userEvent.setup()
      render(<ActivityFeed {...defaultProps} />)

      // Should have search input
      const searchInput = screen.getByTestId('activity-search-input')
      expect(searchInput).toBeInTheDocument()
      expect(searchInput).toHaveAttribute('placeholder', 'Search activities...')

      // Search for specific term
      await user.type(searchInput, 'budget')

      // Should filter activities containing the search term
      expect(screen.getByTestId('activity-item-activity-003')).toBeInTheDocument() // Budget proposal
      expect(screen.queryByTestId('activity-item-activity-001')).not.toBeInTheDocument() // Board meeting
    })

    it('should show search results count', async () => {
      const user = userEvent.setup()
      render(<ActivityFeed {...defaultProps} />)

      // Search for term
      const searchInput = screen.getByTestId('activity-search-input')
      await user.type(searchInput, 'document')

      // Should show results count
      const resultsCount = screen.getByTestId('search-results-count')
      expect(resultsCount).toBeInTheDocument()
      expect(resultsCount).toHaveTextContent('2 activities found')
    })
  })

  describe('Time-based Grouping and Organization', () => {
    it('should group activities by time periods', () => {
      render(<ActivityFeed {...defaultProps} />)

      // Should have time period headers
      const todayGroup = screen.getByTestId('time-group-today')
      expect(todayGroup).toBeInTheDocument()
      expect(todayGroup).toHaveTextContent('Today')

      // Should group activities under appropriate time headers
      const todayActivities = screen.getAllByTestId(/^activity-item-.*/).filter(item =>
        item.closest('[data-testid="time-group-today"]')
      )
      expect(todayActivities.length).toBeGreaterThan(0)
    })

    it('should show activity counts for each time group', () => {
      render(<ActivityFeed {...defaultProps} />)

      // Should show count badge for time groups
      const todayCount = screen.getByTestId('time-group-count-today')
      expect(todayCount).toBeInTheDocument()
      expect(todayCount).toHaveTextContent('5') // All activities are from today
    })

    it('should support collapsible time groups', async () => {
      const user = userEvent.setup()
      render(<ActivityFeed {...defaultProps} />)

      // Should have collapse button for time groups
      const collapseButton = screen.getByTestId('collapse-time-group-today')
      expect(collapseButton).toBeInTheDocument()

      // Click to collapse
      await user.click(collapseButton)

      // Activities should be hidden
      expect(screen.queryByTestId('activity-item-activity-001')).not.toBeInTheDocument()

      // Click to expand
      await user.click(collapseButton)

      // Activities should be visible again
      expect(screen.getByTestId('activity-item-activity-001')).toBeInTheDocument()
    })
  })

  describe('Accessibility and Keyboard Navigation', () => {
    it('should support keyboard navigation through activities', async () => {
      const user = userEvent.setup()
      render(<ActivityFeed {...defaultProps} />)

      // Focus first activity
      const firstActivity = screen.getByTestId('activity-item-activity-001')
      firstActivity.focus()

      // Should be focusable
      expect(firstActivity).toHaveFocus()

      // Navigate with arrow keys
      await user.keyboard('{ArrowDown}')
      const secondActivity = screen.getByTestId('activity-item-activity-002')
      expect(secondActivity).toHaveFocus()
    })

    it('should have proper ARIA labels and roles', () => {
      render(<ActivityFeed {...defaultProps} />)

      // Timeline should have proper role
      const timeline = screen.getByTestId('activity-feed-container')
      expect(timeline).toHaveAttribute('role', 'feed')
      expect(timeline).toHaveAttribute('aria-label', 'Activity timeline')

      // Activities should have article role
      const activity = screen.getByTestId('activity-item-activity-001')
      expect(activity).toHaveAttribute('role', 'article')
      expect(activity).toHaveAttribute('aria-label')
    })

    it('should announce live updates with screen readers', () => {
      render(<ActivityFeed {...defaultProps} />)

      // Should have live region for updates
      const liveRegion = screen.getByTestId('activity-live-region')
      expect(liveRegion).toBeInTheDocument()
      expect(liveRegion).toHaveAttribute('aria-live', 'polite')
      expect(liveRegion).toHaveAttribute('aria-atomic', 'false')
    })
  })
})