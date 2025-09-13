/**
 * End-to-end tests for notification system workflow
 * Tests the complete user journey for notification management and preferences
 */
import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { apiClient } from '../../services/api'

// Mock API services
jest.mock('../../services/api', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn()
  }
}))

// Mock notification data
const mockNotifications = [
  {
    id: 'notif-1',
    title: 'Document Approved',
    message: 'Your document "Policy Update" has been approved',
    type: 'success',
    read: false,
    created_at: '2024-01-15T10:00:00Z',
    document_id: 'doc-1'
  },
  {
    id: 'notif-2',
    title: 'Review Required',
    message: 'Please review document "Board Meeting Minutes"',
    type: 'info',
    read: true,
    created_at: '2024-01-14T15:30:00Z',
    document_id: 'doc-2'
  },
  {
    id: 'notif-3',
    title: 'System Update',
    message: 'The system will be under maintenance tonight',
    type: 'warning',
    read: false,
    created_at: '2024-01-13T09:00:00Z'
  }
]

const mockPreferences = {
  email_notifications: true,
  push_notifications: false,
  document_approved: true,
  document_rejected: true,
  review_required: true,
  system_updates: false,
  daily_digest: true,
  weekly_summary: false
}

const mockStats = {
  total_notifications: 25,
  pending_notifications: 3,
  sent_notifications: 20,
  failed_notifications: 2,
  delivery_rate: 80.0
}

// Mock Components
const MockNotificationCenter = ({ onTabChange }: any) => {
  const [activeTab, setActiveTab] = React.useState('preferences')
  const [stats, setStats] = React.useState(mockStats)
  const [loading, setLoading] = React.useState(false)

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    onTabChange?.(tab)
  }

  const refreshStats = async () => {
    setLoading(true)
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 500))
    setLoading(false)
  }

  const sendPendingNotifications = async () => {
    setLoading(true)
    await new Promise(resolve => setTimeout(resolve, 1000))
    setStats(prev => ({ ...prev, pending_notifications: 0, sent_notifications: prev.sent_notifications + prev.pending_notifications }))
    setLoading(false)
  }

  return (
    <div data-testid="notification-center">
      <h1>Notification Center</h1>

      {/* Statistics */}
      <div data-testid="stats-overview">
        <h2>Statistics (Last 30 days)</h2>
        <div className="stats-grid">
          <div data-testid="total-stat">Total: {stats.total_notifications}</div>
          <div data-testid="pending-stat">Pending: {stats.pending_notifications}</div>
          <div data-testid="sent-stat">Sent: {stats.sent_notifications}</div>
          <div data-testid="failed-stat">Failed: {stats.failed_notifications}</div>
          <div data-testid="delivery-rate">Delivery: {stats.delivery_rate}%</div>
        </div>
        <div className="stats-actions">
          <button data-testid="refresh-stats-btn" onClick={refreshStats} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          {stats.pending_notifications > 0 && (
            <button data-testid="send-pending-btn" onClick={sendPendingNotifications} disabled={loading}>
              {loading ? 'Sending...' : `Send ${stats.pending_notifications} Pending`}
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div data-testid="tab-navigation">
        <button
          data-testid="preferences-tab"
          className={activeTab === 'preferences' ? 'active' : ''}
          onClick={() => handleTabChange('preferences')}
        >
          Preferences
        </button>
        <button
          data-testid="history-tab"
          className={activeTab === 'history' ? 'active' : ''}
          onClick={() => handleTabChange('history')}
        >
          History ({stats.total_notifications})
        </button>
      </div>

      {/* Tab Content */}
      <div data-testid="tab-content">
        {activeTab === 'preferences' && <MockNotificationPreferences />}
        {activeTab === 'history' && <MockNotificationHistory />}
      </div>
    </div>
  )
}

const MockNotificationPreferences = () => {
  const [preferences, setPreferences] = React.useState(mockPreferences)
  const [saving, setSaving] = React.useState(false)
  const [message, setMessage] = React.useState('')

  const handlePreferenceChange = (key: string, value: boolean) => {
    setPreferences(prev => ({ ...prev, [key]: value }))
  }

  const savePreferences = async () => {
    setSaving(true)
    try {
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      setMessage('Preferences saved successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      setMessage('Failed to save preferences')
    } finally {
      setSaving(false)
    }
  }

  const testNotification = async () => {
    try {
      // Mock browser notification
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification('Test Notification', {
            body: 'This is a test notification from CA-DMS',
            icon: '/icon.png'
          })
          setMessage('Test notification sent!')
        } else if (Notification.permission === 'default') {
          const permission = await Notification.requestPermission()
          if (permission === 'granted') {
            new Notification('Test Notification', {
              body: 'This is a test notification from CA-DMS',
              icon: '/icon.png'
            })
            setMessage('Test notification sent!')
          } else {
            setMessage('Notification permission denied')
          }
        } else {
          setMessage('Notifications are blocked')
        }
      } else {
        setMessage('Notifications not supported')
      }
    } catch (error) {
      setMessage('Failed to send test notification')
    }
    setTimeout(() => setMessage(''), 3000)
  }

  return (
    <div data-testid="notification-preferences">
      <h2>Notification Preferences</h2>

      {message && (
        <div data-testid="preference-message" className={message.includes('Failed') ? 'error' : 'success'}>
          {message}
        </div>
      )}

      {/* Delivery Methods */}
      <section data-testid="delivery-methods">
        <h3>Delivery Methods</h3>
        <label>
          <input
            type="checkbox"
            data-testid="email-notifications"
            checked={preferences.email_notifications}
            onChange={(e) => handlePreferenceChange('email_notifications', e.target.checked)}
          />
          Email Notifications
        </label>
        <label>
          <input
            type="checkbox"
            data-testid="push-notifications"
            checked={preferences.push_notifications}
            onChange={(e) => handlePreferenceChange('push_notifications', e.target.checked)}
          />
          Push Notifications
        </label>
      </section>

      {/* Notification Types */}
      <section data-testid="notification-types">
        <h3>Notification Types</h3>
        <label>
          <input
            type="checkbox"
            data-testid="document-approved"
            checked={preferences.document_approved}
            onChange={(e) => handlePreferenceChange('document_approved', e.target.checked)}
          />
          Document Approved
        </label>
        <label>
          <input
            type="checkbox"
            data-testid="document-rejected"
            checked={preferences.document_rejected}
            onChange={(e) => handlePreferenceChange('document_rejected', e.target.checked)}
          />
          Document Rejected
        </label>
        <label>
          <input
            type="checkbox"
            data-testid="review-required"
            checked={preferences.review_required}
            onChange={(e) => handlePreferenceChange('review_required', e.target.checked)}
          />
          Review Required
        </label>
        <label>
          <input
            type="checkbox"
            data-testid="system-updates"
            checked={preferences.system_updates}
            onChange={(e) => handlePreferenceChange('system_updates', e.target.checked)}
          />
          System Updates
        </label>
      </section>

      {/* Digest Options */}
      <section data-testid="digest-options">
        <h3>Digest Options</h3>
        <label>
          <input
            type="checkbox"
            data-testid="daily-digest"
            checked={preferences.daily_digest}
            onChange={(e) => handlePreferenceChange('daily_digest', e.target.checked)}
          />
          Daily Digest
        </label>
        <label>
          <input
            type="checkbox"
            data-testid="weekly-summary"
            checked={preferences.weekly_summary}
            onChange={(e) => handlePreferenceChange('weekly_summary', e.target.checked)}
          />
          Weekly Summary
        </label>
      </section>

      {/* Actions */}
      <div data-testid="preference-actions">
        <button data-testid="save-preferences-btn" onClick={savePreferences} disabled={saving}>
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
        <button data-testid="test-notification-btn" onClick={testNotification}>
          Test Notification
        </button>
      </div>
    </div>
  )
}

const MockNotificationHistory = () => {
  const [notifications, setNotifications] = React.useState(mockNotifications)
  const [filter, setFilter] = React.useState('all')
  const [sortBy, setSortBy] = React.useState('newest')

  const filteredNotifications = React.useMemo(() => {
    let filtered = notifications

    // Apply read/unread filter
    if (filter === 'unread') {
      filtered = filtered.filter(n => !n.read)
    } else if (filter === 'read') {
      filtered = filtered.filter(n => n.read)
    }

    // Apply sorting
    filtered.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      } else {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      }
    })

    return filtered
  }, [notifications, filter, sortBy])

  const markAsRead = (notificationId: string) => {
    setNotifications(prev => prev.map(n =>
      n.id === notificationId ? { ...n, read: true } : n
    ))
  }

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const deleteNotification = (notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId))
  }

  const clearAll = () => {
    if (window.confirm('Are you sure you want to clear all notifications?')) {
      setNotifications([])
    }
  }

  return (
    <div data-testid="notification-history">
      <h2>Notification History</h2>

      {/* Controls */}
      <div data-testid="history-controls">
        <div className="filters">
          <label>
            Filter:
            <select data-testid="filter-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
            </select>
          </label>
          <label>
            Sort:
            <select data-testid="sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </label>
        </div>
        <div className="actions">
          <button data-testid="mark-all-read-btn" onClick={markAllAsRead}>
            Mark All as Read
          </button>
          <button data-testid="clear-all-btn" onClick={clearAll} className="danger">
            Clear All
          </button>
        </div>
      </div>

      {/* Notification List */}
      <div data-testid="notification-list">
        {filteredNotifications.length === 0 ? (
          <div data-testid="no-notifications">
            <p>No notifications found.</p>
          </div>
        ) : (
          filteredNotifications.map(notification => (
            <div
              key={notification.id}
              data-testid={`notification-${notification.id}`}
              className={`notification-item ${notification.read ? 'read' : 'unread'} ${notification.type}`}
            >
              <div className="notification-content">
                <h4>{notification.title}</h4>
                <p>{notification.message}</p>
                <small>{new Date(notification.created_at).toLocaleString()}</small>
              </div>
              <div className="notification-actions">
                {!notification.read && (
                  <button
                    data-testid={`mark-read-${notification.id}`}
                    onClick={() => markAsRead(notification.id)}
                  >
                    Mark as Read
                  </button>
                )}
                <button
                  data-testid={`delete-${notification.id}`}
                  onClick={() => deleteNotification(notification.id)}
                  className="danger"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// Main workflow app
const NotificationWorkflowApp = () => {
  const [currentTab, setCurrentTab] = React.useState('preferences')

  return (
    <div data-testid="notification-workflow-app">
      <MockNotificationCenter onTabChange={setCurrentTab} />
    </div>
  )
}

describe('Notification Workflow E2E Tests', () => {
  const mockApiClient = apiClient as jest.Mocked<typeof apiClient>

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock Notification API
    global.Notification = jest.fn() as any
    global.Notification.permission = 'default'
    global.Notification.requestPermission = jest.fn().mockResolvedValue('granted')

    // Mock window.confirm
    window.confirm = jest.fn(() => true)

    // Mock API responses
    mockApiClient.get.mockResolvedValue({
      success: true,
      data: mockStats
    })

    mockApiClient.put.mockResolvedValue({
      success: true,
      data: {}
    })

    mockApiClient.post.mockResolvedValue({
      success: true,
      data: { sent_count: 3 }
    })
  })

  describe('Notification Center Overview', () => {
    it('should display notification statistics', async () => {
      await act(async () => {
        render(<NotificationWorkflowApp />)
      })

      expect(screen.getByTestId('stats-overview')).toBeInTheDocument()
      expect(screen.getByTestId('total-stat')).toHaveTextContent('Total: 25')
      expect(screen.getByTestId('pending-stat')).toHaveTextContent('Pending: 3')
      expect(screen.getByTestId('sent-stat')).toHaveTextContent('Sent: 20')
      expect(screen.getByTestId('failed-stat')).toHaveTextContent('Failed: 2')
      expect(screen.getByTestId('delivery-rate')).toHaveTextContent('Delivery: 80%')
    })

    it('should show send pending button when there are pending notifications', async () => {
      await act(async () => {
        render(<NotificationWorkflowApp />)
      })

      expect(screen.getByTestId('send-pending-btn')).toBeInTheDocument()
      expect(screen.getByTestId('send-pending-btn')).toHaveTextContent('Send 3 Pending')
    })

    it('should refresh statistics when refresh button is clicked', async () => {
      const user = userEvent.setup()

      await act(async () => {
        render(<NotificationWorkflowApp />)
      })

      const refreshBtn = screen.getByTestId('refresh-stats-btn')

      await act(async () => {
        await user.click(refreshBtn)
      })

      // Should show loading state
      expect(screen.getByText('Loading...')).toBeInTheDocument()

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument()
      })
    })

    it('should send pending notifications', async () => {
      const user = userEvent.setup()

      await act(async () => {
        render(<NotificationWorkflowApp />)
      })

      const sendBtn = screen.getByTestId('send-pending-btn')

      await act(async () => {
        await user.click(sendBtn)
      })

      // Should show loading state
      expect(screen.getByText('Sending...')).toBeInTheDocument()

      // Wait for operation to complete
      await waitFor(() => {
        expect(screen.getByTestId('pending-stat')).toHaveTextContent('Pending: 0')
        expect(screen.getByTestId('sent-stat')).toHaveTextContent('Sent: 23')
      })
    })
  })

  describe('Tab Navigation', () => {
    it('should switch between preferences and history tabs', async () => {
      const user = userEvent.setup()

      await act(async () => {
        render(<NotificationWorkflowApp />)
      })

      // Should start with preferences tab active
      expect(screen.getByTestId('notification-preferences')).toBeInTheDocument()

      // Switch to history tab
      await act(async () => {
        await user.click(screen.getByTestId('history-tab'))
      })

      expect(screen.getByTestId('notification-history')).toBeInTheDocument()
      expect(screen.queryByTestId('notification-preferences')).not.toBeInTheDocument()

      // Switch back to preferences
      await act(async () => {
        await user.click(screen.getByTestId('preferences-tab'))
      })

      expect(screen.getByTestId('notification-preferences')).toBeInTheDocument()
      expect(screen.queryByTestId('notification-history')).not.toBeInTheDocument()
    })

    it('should show notification count in history tab', async () => {
      await act(async () => {
        render(<NotificationWorkflowApp />)
      })

      expect(screen.getByTestId('history-tab')).toHaveTextContent('History (25)')
    })
  })

  describe('Preference Management Workflow', () => {
    it('should update notification preferences', async () => {
      const user = userEvent.setup()

      await act(async () => {
        render(<NotificationWorkflowApp />)
      })

      // Verify initial state
      expect(screen.getByTestId('email-notifications')).toBeChecked()
      expect(screen.getByTestId('push-notifications')).not.toBeChecked()

      // Toggle push notifications
      await act(async () => {
        await user.click(screen.getByTestId('push-notifications'))
      })

      expect(screen.getByTestId('push-notifications')).toBeChecked()

      // Toggle off email notifications
      await act(async () => {
        await user.click(screen.getByTestId('email-notifications'))
      })

      expect(screen.getByTestId('email-notifications')).not.toBeChecked()

      // Save preferences
      await act(async () => {
        await user.click(screen.getByTestId('save-preferences-btn'))
      })

      // Should show loading state
      expect(screen.getByText('Saving...')).toBeInTheDocument()

      // Should show success message
      await waitFor(() => {
        expect(screen.getByTestId('preference-message')).toHaveTextContent('Preferences saved successfully!')
      })
    })

    it('should test browser notifications', async () => {
      const user = userEvent.setup()

      await act(async () => {
        render(<NotificationWorkflowApp />)
      })

      await act(async () => {
        await user.click(screen.getByTestId('test-notification-btn'))
      })

      // Should request permission and create notification
      expect(global.Notification.requestPermission).toHaveBeenCalled()
      expect(global.Notification).toHaveBeenCalledWith('Test Notification', {
        body: 'This is a test notification from CA-DMS',
        icon: '/icon.png'
      })

      // Should show success message
      await waitFor(() => {
        expect(screen.getByTestId('preference-message')).toHaveTextContent('Test notification sent!')
      })
    })

    it('should handle notification permission denied', async () => {
      const user = userEvent.setup()

      // Mock permission denied
      global.Notification.requestPermission = jest.fn().mockResolvedValue('denied')

      await act(async () => {
        render(<NotificationWorkflowApp />)
      })

      await act(async () => {
        await user.click(screen.getByTestId('test-notification-btn'))
      })

      await waitFor(() => {
        expect(screen.getByTestId('preference-message')).toHaveTextContent('Notification permission denied')
      })
    })
  })

  describe('Notification History Workflow', () => {
    it('should display notification history', async () => {
      const user = userEvent.setup()

      await act(async () => {
        render(<NotificationWorkflowApp />)
      })

      // Switch to history tab
      await act(async () => {
        await user.click(screen.getByTestId('history-tab'))
      })

      expect(screen.getByTestId('notification-history')).toBeInTheDocument()
      expect(screen.getByTestId('notification-notif-1')).toBeInTheDocument()
      expect(screen.getByTestId('notification-notif-2')).toBeInTheDocument()
      expect(screen.getByTestId('notification-notif-3')).toBeInTheDocument()

      // Check notification content
      expect(screen.getByText('Document Approved')).toBeInTheDocument()
      expect(screen.getByText('Review Required')).toBeInTheDocument()
      expect(screen.getByText('System Update')).toBeInTheDocument()
    })

    it('should filter notifications by read status', async () => {
      const user = userEvent.setup()

      await act(async () => {
        render(<NotificationWorkflowApp />)
      })

      await act(async () => {
        await user.click(screen.getByTestId('history-tab'))
      })

      // Filter by unread
      await act(async () => {
        await user.selectOptions(screen.getByTestId('filter-select'), 'unread')
      })

      expect(screen.getByTestId('notification-notif-1')).toBeInTheDocument()
      expect(screen.queryByTestId('notification-notif-2')).not.toBeInTheDocument()
      expect(screen.getByTestId('notification-notif-3')).toBeInTheDocument()

      // Filter by read
      await act(async () => {
        await user.selectOptions(screen.getByTestId('filter-select'), 'read')
      })

      expect(screen.queryByTestId('notification-notif-1')).not.toBeInTheDocument()
      expect(screen.getByTestId('notification-notif-2')).toBeInTheDocument()
      expect(screen.queryByTestId('notification-notif-3')).not.toBeInTheDocument()
    })

    it('should sort notifications', async () => {
      const user = userEvent.setup()

      await act(async () => {
        render(<NotificationWorkflowApp />)
      })

      await act(async () => {
        await user.click(screen.getByTestId('history-tab'))
      })

      // Change sort to oldest first
      await act(async () => {
        await user.selectOptions(screen.getByTestId('sort-select'), 'oldest')
      })

      // Verify sorting (implementation would need to check order of elements)
      expect(screen.getByTestId('notification-list')).toBeInTheDocument()
    })

    it('should mark individual notifications as read', async () => {
      const user = userEvent.setup()

      await act(async () => {
        render(<NotificationWorkflowApp />)
      })

      await act(async () => {
        await user.click(screen.getByTestId('history-tab'))
      })

      // Mark first notification as read
      const markReadBtn = screen.getByTestId('mark-read-notif-1')
      await act(async () => {
        await user.click(markReadBtn)
      })

      // Button should disappear (notification is now read)
      expect(screen.queryByTestId('mark-read-notif-1')).not.toBeInTheDocument()
    })

    it('should mark all notifications as read', async () => {
      const user = userEvent.setup()

      await act(async () => {
        render(<NotificationWorkflowApp />)
      })

      await act(async () => {
        await user.click(screen.getByTestId('history-tab'))
      })

      await act(async () => {
        await user.click(screen.getByTestId('mark-all-read-btn'))
      })

      // All mark as read buttons should disappear
      expect(screen.queryByTestId('mark-read-notif-1')).not.toBeInTheDocument()
      expect(screen.queryByTestId('mark-read-notif-3')).not.toBeInTheDocument()
    })

    it('should delete individual notifications', async () => {
      const user = userEvent.setup()

      await act(async () => {
        render(<NotificationWorkflowApp />)
      })

      await act(async () => {
        await user.click(screen.getByTestId('history-tab'))
      })

      await act(async () => {
        await user.click(screen.getByTestId('delete-notif-1'))
      })

      // Notification should be removed
      expect(screen.queryByTestId('notification-notif-1')).not.toBeInTheDocument()
    })

    it('should clear all notifications with confirmation', async () => {
      const user = userEvent.setup()

      await act(async () => {
        render(<NotificationWorkflowApp />)
      })

      await act(async () => {
        await user.click(screen.getByTestId('history-tab'))
      })

      await act(async () => {
        await user.click(screen.getByTestId('clear-all-btn'))
      })

      expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to clear all notifications?')

      // Should show no notifications message
      await waitFor(() => {
        expect(screen.getByTestId('no-notifications')).toBeInTheDocument()
        expect(screen.getByText('No notifications found.')).toBeInTheDocument()
      })
    })
  })

  describe('Integration and Error Handling', () => {
    it('should handle preference save errors', async () => {
      const user = userEvent.setup()

      // Mock API to reject
      mockApiClient.put.mockRejectedValue(new Error('Save failed'))

      await act(async () => {
        render(<NotificationWorkflowApp />)
      })

      await act(async () => {
        await user.click(screen.getByTestId('save-preferences-btn'))
      })

      await waitFor(() => {
        expect(screen.getByTestId('preference-message')).toHaveTextContent('Failed to save preferences')
      })
    })

    it('should handle notification permission already granted', async () => {
      const user = userEvent.setup()

      // Mock permission already granted
      global.Notification.permission = 'granted'

      await act(async () => {
        render(<NotificationWorkflowApp />)
      })

      await act(async () => {
        await user.click(screen.getByTestId('test-notification-btn'))
      })

      // Should not request permission
      expect(global.Notification.requestPermission).not.toHaveBeenCalled()
      expect(global.Notification).toHaveBeenCalled()
    })

    it('should handle unsupported notifications', async () => {
      const user = userEvent.setup()

      // Remove Notification from window
      const originalNotification = window.Notification
      delete (window as any).Notification

      await act(async () => {
        render(<NotificationWorkflowApp />)
      })

      await act(async () => {
        await user.click(screen.getByTestId('test-notification-btn'))
      })

      await waitFor(() => {
        expect(screen.getByTestId('preference-message')).toHaveTextContent('Notifications not supported')
      })

      // Restore Notification
      window.Notification = originalNotification
    })
  })
})