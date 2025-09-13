/**
 * Integration tests for NotificationCenter component
 * Tests component interactions with API, state management, and user workflows
 */
import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NotificationCenter from '../../components/notifications/NotificationCenter'

// Mock toast hook
const mockToast = jest.fn()
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast })
}))

// Mock child components
jest.mock('../../components/notifications/NotificationPreferences', () => {
  return function MockNotificationPreferences() {
    return <div data-testid="notification-preferences">Notification Preferences Component</div>
  }
})

jest.mock('../../components/notifications/NotificationHistory', () => {
  return function MockNotificationHistory() {
    return <div data-testid="notification-history">Notification History Component</div>
  }
})

// Mock UI components
jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className} data-testid="card">{children}</div>,
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: any) => <div data-testid="card-title">{children}</div>
}))

jest.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children, defaultValue }: any) => <div data-testid="tabs" data-default-value={defaultValue}>{children}</div>,
  TabsContent: ({ children, value }: any) => <div data-testid={`tab-content-${value}`}>{children}</div>,
  TabsList: ({ children }: any) => <div data-testid="tabs-list">{children}</div>,
  TabsTrigger: ({ children, value, ...props }: any) => (
    <button data-testid={`tab-trigger-${value}`} {...props}>{children}</button>
  )
}))

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant }: any) => <span data-testid="badge" data-variant={variant}>{children}</span>
}))

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-testid={props['data-testid'] || 'button'}
      {...props}
    >
      {children}
    </button>
  )
}))

// Mock fetch
const mockFetch = jest.fn()
global.fetch = mockFetch

describe('NotificationCenter Integration Tests', () => {
  const mockStatsData = {
    total_notifications: 150,
    pending_notifications: 12,
    sent_notifications: 130,
    failed_notifications: 8,
    delivery_rate: 86.7
  }

  beforeEach(() => {
    jest.clearAllMocks()
    localStorage.setItem('access_token', 'test-token')

    // Default successful stats fetch
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockStatsData
    })
  })

  afterEach(() => {
    localStorage.clear()
    jest.resetAllMocks()
  })

  describe('Component Initialization', () => {
    it('should render notification center with header', async () => {
      await act(async () => {
        render(<NotificationCenter />)
      })

      expect(screen.getByText('Notification Center')).toBeInTheDocument()
      expect(screen.getByText('Manage your notification preferences and view history')).toBeInTheDocument()
    })

    it('should fetch stats on component mount', async () => {
      await act(async () => {
        render(<NotificationCenter />)
      })

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/v1/notifications/stats/overview', {
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json'
          }
        })
      })
    })

    it('should display tabs with default preferences selection', async () => {
      await act(async () => {
        render(<NotificationCenter />)
      })

      expect(screen.getByTestId('tabs')).toHaveAttribute('data-default-value', 'preferences')
      expect(screen.getByTestId('tab-trigger-preferences')).toBeInTheDocument()
      expect(screen.getByTestId('tab-trigger-history')).toBeInTheDocument()
    })
  })

  describe('Statistics Display Integration', () => {
    it('should display statistics after successful fetch', async () => {
      await act(async () => {
        render(<NotificationCenter />)
      })

      await waitFor(() => {
        expect(screen.getByText('150')).toBeInTheDocument() // total_notifications
        expect(screen.getByText('12')).toBeInTheDocument() // pending_notifications
        expect(screen.getByText('130')).toBeInTheDocument() // sent_notifications
        expect(screen.getByText('8')).toBeInTheDocument() // failed_notifications
        expect(screen.getByText('86.7%')).toBeInTheDocument() // delivery_rate
      })
    })

    it('should show pending notifications count in badge', async () => {
      await act(async () => {
        render(<NotificationCenter />)
      })

      await waitFor(() => {
        const badge = screen.getByTestId('badge')
        expect(badge).toHaveTextContent('150')
        expect(badge).toHaveAttribute('data-variant', 'secondary')
      })
    })

    it('should display send pending button when there are pending notifications', async () => {
      await act(async () => {
        render(<NotificationCenter />)
      })

      await waitFor(() => {
        expect(screen.getByText('Send 12 Pending')).toBeInTheDocument()
      })
    })

    it('should not display send pending button when no pending notifications', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          ...mockStatsData,
          pending_notifications: 0
        })
      })

      await act(async () => {
        render(<NotificationCenter />)
      })

      await waitFor(() => {
        expect(screen.queryByText(/Send.*Pending/)).not.toBeInTheDocument()
      })
    })
  })

  describe('API Error Handling', () => {
    it('should handle stats fetch failure gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      await act(async () => {
        render(<NotificationCenter />)
      })

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Error",
          description: "Failed to load notification statistics",
          variant: "destructive"
        })
      })
    })

    it('should handle non-ok response status', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500
      })

      await act(async () => {
        render(<NotificationCenter />)
      })

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Error",
          description: "Failed to load notification statistics",
          variant: "destructive"
        })
      })
    })

    it('should handle send pending notifications failure', async () => {
      // First call for stats (successful)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatsData
      })

      // Second call for sending notifications (failure)
      mockFetch.mockRejectedValueOnce(new Error('Send failed'))

      await act(async () => {
        render(<NotificationCenter />)
      })

      await waitFor(() => {
        expect(screen.getByText('Send 12 Pending')).toBeInTheDocument()
      })

      const sendButton = screen.getByText('Send 12 Pending')

      await act(async () => {
        fireEvent.click(sendButton)
      })

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Error",
          description: "Failed to send pending notifications",
          variant: "destructive"
        })
      })
    })
  })

  describe('User Interactions', () => {
    it('should handle refresh button click', async () => {
      await act(async () => {
        render(<NotificationCenter />)
      })

      // Wait for initial load
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1)
      })

      const refreshButton = screen.getByText('Refresh')

      await act(async () => {
        fireEvent.click(refreshButton)
      })

      // Should be called twice now (initial + refresh)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should show loading state during refresh', async () => {
      let resolvePromise: (value: any) => void
      const fetchPromise = new Promise((resolve) => {
        resolvePromise = resolve
      })

      mockFetch.mockReturnValue(fetchPromise)

      await act(async () => {
        render(<NotificationCenter />)
      })

      const refreshButton = screen.getByText('Loading...')
      expect(refreshButton).toBeDisabled()

      // Resolve the promise
      act(() => {
        resolvePromise!({
          ok: true,
          json: async () => mockStatsData
        })
      })

      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument()
      })
    })

    it('should handle send pending notifications successfully', async () => {
      // First call for stats
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatsData
      })

      // Second call for sending notifications
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sent_count: 12 })
      })

      // Third call for refreshing stats
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockStatsData,
          pending_notifications: 0,
          sent_notifications: 142
        })
      })

      await act(async () => {
        render(<NotificationCenter />)
      })

      await waitFor(() => {
        expect(screen.getByText('Send 12 Pending')).toBeInTheDocument()
      })

      const sendButton = screen.getByText('Send 12 Pending')

      await act(async () => {
        fireEvent.click(sendButton)
      })

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Success",
          description: "12 notifications sent successfully"
        })
      })

      // Should refresh stats after sending
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/notifications/send-pending', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json'
        }
      })
    })

    it('should show loading state during send operation', async () => {
      let resolveStatsPromise: (value: any) => void
      let resolveSendPromise: (value: any) => void

      const statsPromise = new Promise((resolve) => {
        resolveStatsPromise = resolve
      })
      const sendPromise = new Promise((resolve) => {
        resolveSendPromise = resolve
      })

      // First call returns stats promise
      mockFetch.mockReturnValueOnce(statsPromise)

      await act(async () => {
        render(<NotificationCenter />)
      })

      // Resolve stats
      act(() => {
        resolveStatsPromise!({
          ok: true,
          json: async () => mockStatsData
        })
      })

      await waitFor(() => {
        expect(screen.getByText('Send 12 Pending')).toBeInTheDocument()
      })

      // Set up send promise
      mockFetch.mockReturnValueOnce(sendPromise)

      const sendButton = screen.getByText('Send 12 Pending')

      await act(async () => {
        fireEvent.click(sendButton)
      })

      // Should show loading state
      expect(screen.getByText('Sending...')).toBeInTheDocument()
      expect(screen.getByText('Sending...')).toBeDisabled()

      // Resolve send
      act(() => {
        resolveSendPromise!({
          ok: true,
          json: async () => ({ sent_count: 12 })
        })
      })

      await waitFor(() => {
        expect(screen.queryByText('Sending...')).not.toBeInTheDocument()
      })
    })
  })

  describe('Tab Navigation Integration', () => {
    it('should render preferences tab content by default', async () => {
      await act(async () => {
        render(<NotificationCenter />)
      })

      expect(screen.getByTestId('tab-content-preferences')).toBeInTheDocument()
      expect(screen.getByTestId('notification-preferences')).toBeInTheDocument()
    })

    it('should render history tab content', async () => {
      await act(async () => {
        render(<NotificationCenter />)
      })

      expect(screen.getByTestId('tab-content-history')).toBeInTheDocument()
      expect(screen.getByTestId('notification-history')).toBeInTheDocument()
    })

    it('should switch between tabs', async () => {
      const user = userEvent.setup()

      await act(async () => {
        render(<NotificationCenter />)
      })

      const historyTab = screen.getByTestId('tab-trigger-history')
      const preferencesTab = screen.getByTestId('tab-trigger-preferences')

      // Initially preferences should be active
      expect(screen.getByTestId('notification-preferences')).toBeInTheDocument()

      // Switch to history
      await act(async () => {
        await user.click(historyTab)
      })

      expect(screen.getByTestId('notification-history')).toBeInTheDocument()

      // Switch back to preferences
      await act(async () => {
        await user.click(preferencesTab)
      })

      expect(screen.getByTestId('notification-preferences')).toBeInTheDocument()
    })
  })

  describe('Authentication Integration', () => {
    it('should include authorization header in API calls', async () => {
      await act(async () => {
        render(<NotificationCenter />)
      })

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/v1/notifications/stats/overview', {
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json'
          }
        })
      })
    })

    it('should handle missing token gracefully', async () => {
      localStorage.removeItem('access_token')

      await act(async () => {
        render(<NotificationCenter />)
      })

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/v1/notifications/stats/overview', {
          headers: {
            'Authorization': 'Bearer null',
            'Content-Type': 'application/json'
          }
        })
      })
    })
  })

  describe('Data Formatting Integration', () => {
    it('should format large numbers with locale string', async () => {
      const largeStatsData = {
        ...mockStatsData,
        total_notifications: 12345,
        sent_notifications: 10234
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => largeStatsData
      })

      await act(async () => {
        render(<NotificationCenter />)
      })

      await waitFor(() => {
        expect(screen.getByText('12,345')).toBeInTheDocument()
        expect(screen.getByText('10,234')).toBeInTheDocument()
      })
    })

    it('should display delivery rate with percentage', async () => {
      const statsWithDecimals = {
        ...mockStatsData,
        delivery_rate: 95.67
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => statsWithDecimals
      })

      await act(async () => {
        render(<NotificationCenter />)
      })

      await waitFor(() => {
        expect(screen.getByText('95.67%')).toBeInTheDocument()
      })
    })
  })

  describe('State Management Integration', () => {
    it('should maintain state consistency across operations', async () => {
      await act(async () => {
        render(<NotificationCenter />)
      })

      // Initial state
      await waitFor(() => {
        expect(screen.getByText('12')).toBeInTheDocument() // pending notifications
      })

      // Send pending notifications
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sent_count: 12 })
      })

      // Updated stats after sending
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockStatsData,
          pending_notifications: 0,
          sent_notifications: 142
        })
      })

      const sendButton = screen.getByText('Send 12 Pending')

      await act(async () => {
        fireEvent.click(sendButton)
      })

      // Should refresh stats automatically and update display
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(3) // initial + send + refresh
      })
    })

    it('should handle concurrent operations properly', async () => {
      await act(async () => {
        render(<NotificationCenter />)
      })

      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument()
        expect(screen.getByText('Send 12 Pending')).toBeInTheDocument()
      })

      // Mock slow responses
      mockFetch.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: async () => mockStatsData
        }), 100))
      )

      const refreshButton = screen.getByText('Refresh')
      const sendButton = screen.getByText('Send 12 Pending')

      // Click both buttons quickly
      await act(async () => {
        fireEvent.click(refreshButton)
        fireEvent.click(sendButton)
      })

      // Both should show loading states
      expect(screen.getByText('Loading...')).toBeInTheDocument()
      expect(screen.getByText('Sending...')).toBeInTheDocument()
    })
  })
})