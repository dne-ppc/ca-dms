/**
 * Comprehensive tests for useNotifications hook and NotificationPermissionPrompt component
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, render, screen, fireEvent } from '@testing-library/react'
import {
  useNotifications,
  NotificationPermissionPrompt
} from '../../hooks/useNotifications'
import {
  setupHookTest,
  mockServiceWorker,
  mockFetch,
  mockNotificationPermission,
  waitForHookUpdate,
  testErrorHandling
} from '../utils/hookTestUtils'

describe('useNotifications Hook', () => {
  setupHookTest()

  beforeEach(() => {
    vi.clearAllMocks()

    // Reset mocks
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true })
    })

    // Mock service worker registration
    mockServiceWorker.ready = Promise.resolve({
      pushManager: {
        getSubscription: vi.fn().mockResolvedValue(null),
        subscribe: vi.fn().mockResolvedValue({
          toJSON: vi.fn().mockReturnValue({
            endpoint: 'test-endpoint',
            keys: { p256dh: 'test-key', auth: 'test-auth' }
          }),
          unsubscribe: vi.fn().mockResolvedValue(true)
        })
      }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Initial State', () => {
    it('should return initial notification state', () => {
      const { result } = renderHook(() => useNotifications())

      expect(result.current.notificationState).toMatchObject({
        permission: 'default',
        isSupported: true,
        subscriptionStatus: 'unknown'
      })
      expect(result.current.requestPermission).toBeInstanceOf(Function)
      expect(result.current.subscribeToPush).toBeInstanceOf(Function)
      expect(result.current.unsubscribeFromPush).toBeInstanceOf(Function)
      expect(result.current.sendTestNotification).toBeInstanceOf(Function)
    })

    it('should detect unsupported notifications', () => {
      // Remove Notification from window
      const originalNotification = global.Notification
      delete (global as any).Notification

      const { result } = renderHook(() => useNotifications())

      expect(result.current.notificationState.isSupported).toBe(false)

      // Restore
      global.Notification = originalNotification
    })

    it('should get initial permission status', () => {
      global.Notification.permission = 'granted'

      const { result } = renderHook(() => useNotifications())

      expect(result.current.notificationState.permission).toBe('granted')
    })
  })

  describe('Permission Management', () => {
    it('should request notification permission successfully', async () => {
      mockNotificationPermission('granted')

      const { result } = renderHook(() => useNotifications())

      let permissionGranted: boolean
      await act(async () => {
        permissionGranted = await result.current.requestPermission()
      })

      expect(permissionGranted!).toBe(true)
      expect(result.current.notificationState.permission).toBe('granted')
      expect(global.Notification.requestPermission).toHaveBeenCalled()
    })

    it('should handle permission denial', async () => {
      mockNotificationPermission('denied')

      const { result } = renderHook(() => useNotifications())

      let permissionGranted: boolean
      await act(async () => {
        permissionGranted = await result.current.requestPermission()
      })

      expect(permissionGranted!).toBe(false)
      expect(result.current.notificationState.permission).toBe('denied')
    })

    it('should handle unsupported notifications gracefully', async () => {
      const originalNotification = global.Notification
      delete (global as any).Notification

      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const { result } = renderHook(() => useNotifications())

      let permissionGranted: boolean
      await act(async () => {
        permissionGranted = await result.current.requestPermission()
      })

      expect(permissionGranted!).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith('This browser does not support notifications')

      consoleWarn.mockRestore()
      global.Notification = originalNotification
    })

    it('should handle permission request errors', async () => {
      global.Notification.requestPermission = vi.fn().mockRejectedValue(new Error('Permission error'))

      const { result } = renderHook(() => useNotifications())

      await testErrorHandling(
        result,
        async () => {
          await result.current.requestPermission()
        },
        'Error requesting notification permission'
      )
    })
  })

  describe('Push Subscription Management', () => {
    it('should check initial subscription status', async () => {
      const mockSubscription = {
        toJSON: () => ({ endpoint: 'test' })
      }
      mockServiceWorker.ready = Promise.resolve({
        pushManager: {
          getSubscription: vi.fn().mockResolvedValue(mockSubscription),
          subscribe: vi.fn()
        }
      })

      const { result } = renderHook(() => useNotifications())

      await waitForHookUpdate(result, () => {
        expect(result.current.notificationState.subscriptionStatus).toBe('subscribed')
      })
    })

    it('should subscribe to push notifications', async () => {
      mockNotificationPermission('granted')

      const mockSubscription = {
        toJSON: vi.fn().mockReturnValue({
          endpoint: 'test-endpoint',
          keys: { p256dh: 'test-key', auth: 'test-auth' }
        }),
        unsubscribe: vi.fn()
      }

      const mockPushManager = {
        getSubscription: vi.fn().mockResolvedValue(null),
        subscribe: vi.fn().mockResolvedValue(mockSubscription)
      }

      mockServiceWorker.ready = Promise.resolve({
        pushManager: mockPushManager
      })

      const { result } = renderHook(() => useNotifications())

      let subscribed: boolean
      await act(async () => {
        subscribed = await result.current.subscribeToPush()
      })

      expect(subscribed!).toBe(true)
      expect(mockPushManager.subscribe).toHaveBeenCalledWith({
        userVisibleOnly: true,
        applicationServerKey: expect.any(Uint8Array)
      })
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/notifications/push/subscribe',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('test-endpoint')
        })
      )
      expect(result.current.notificationState.subscriptionStatus).toBe('subscribed')
    })

    it('should handle existing subscription when subscribing', async () => {
      const existingSubscription = {
        toJSON: () => ({ endpoint: 'existing' })
      }

      mockServiceWorker.ready = Promise.resolve({
        pushManager: {
          getSubscription: vi.fn().mockResolvedValue(existingSubscription),
          subscribe: vi.fn()
        }
      })

      const { result } = renderHook(() => useNotifications())

      let subscribed: boolean
      await act(async () => {
        subscribed = await result.current.subscribeToPush()
      })

      expect(subscribed!).toBe(true)
      expect(result.current.notificationState.subscriptionStatus).toBe('subscribed')
    })

    it('should request permission before subscribing if not granted', async () => {
      mockNotificationPermission('default')
      global.Notification.requestPermission = vi.fn()
        .mockResolvedValueOnce('granted')

      const { result } = renderHook(() => useNotifications())

      await act(async () => {
        await result.current.subscribeToPush()
      })

      expect(global.Notification.requestPermission).toHaveBeenCalled()
    })

    it('should fail subscription if permission denied', async () => {
      mockNotificationPermission('denied')

      const { result } = renderHook(() => useNotifications())

      let subscribed: boolean
      await act(async () => {
        subscribed = await result.current.subscribeToPush()
      })

      expect(subscribed!).toBe(false)
    })

    it('should handle push subscription not supported', async () => {
      delete (navigator as any).serviceWorker
      delete (global as any).PushManager

      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const { result } = renderHook(() => useNotifications())

      let subscribed: boolean
      await act(async () => {
        subscribed = await result.current.subscribeToPush()
      })

      expect(subscribed!).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith('Push messaging is not supported')

      consoleWarn.mockRestore()
    })

    it('should handle subscription errors', async () => {
      mockNotificationPermission('granted')

      mockServiceWorker.ready = Promise.resolve({
        pushManager: {
          getSubscription: vi.fn().mockResolvedValue(null),
          subscribe: vi.fn().mockRejectedValue(new Error('Subscription failed'))
        }
      })

      const { result } = renderHook(() => useNotifications())

      await testErrorHandling(
        result,
        async () => {
          await result.current.subscribeToPush()
        },
        'Error subscribing to push notifications'
      )
    })

    it('should handle backend subscription errors', async () => {
      mockNotificationPermission('granted')
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500
      })

      const mockSubscription = {
        toJSON: vi.fn().mockReturnValue({ endpoint: 'test' }),
        unsubscribe: vi.fn()
      }

      mockServiceWorker.ready = Promise.resolve({
        pushManager: {
          getSubscription: vi.fn().mockResolvedValue(null),
          subscribe: vi.fn().mockResolvedValue(mockSubscription)
        }
      })

      const { result } = renderHook(() => useNotifications())

      await testErrorHandling(
        result,
        async () => {
          await result.current.subscribeToPush()
        },
        'Error subscribing to push notifications'
      )
    })
  })

  describe('Push Unsubscription', () => {
    it('should unsubscribe from push notifications', async () => {
      const mockSubscription = {
        toJSON: vi.fn().mockReturnValue({ endpoint: 'test' }),
        unsubscribe: vi.fn().mockResolvedValue(true)
      }

      mockServiceWorker.ready = Promise.resolve({
        pushManager: {
          getSubscription: vi.fn().mockResolvedValue(mockSubscription)
        }
      })

      const { result } = renderHook(() => useNotifications())

      let unsubscribed: boolean
      await act(async () => {
        unsubscribed = await result.current.unsubscribeFromPush()
      })

      expect(unsubscribed!).toBe(true)
      expect(mockSubscription.unsubscribe).toHaveBeenCalled()
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/notifications/push/unsubscribe',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
      )
      expect(result.current.notificationState.subscriptionStatus).toBe('unsubscribed')
    })

    it('should handle no existing subscription when unsubscribing', async () => {
      mockServiceWorker.ready = Promise.resolve({
        pushManager: {
          getSubscription: vi.fn().mockResolvedValue(null)
        }
      })

      const { result } = renderHook(() => useNotifications())

      let unsubscribed: boolean
      await act(async () => {
        unsubscribed = await result.current.unsubscribeFromPush()
      })

      expect(unsubscribed!).toBe(false)
    })

    it('should handle unsubscription errors', async () => {
      const mockSubscription = {
        unsubscribe: vi.fn().mockRejectedValue(new Error('Unsubscribe failed'))
      }

      mockServiceWorker.ready = Promise.resolve({
        pushManager: {
          getSubscription: vi.fn().mockResolvedValue(mockSubscription)
        }
      })

      const { result } = renderHook(() => useNotifications())

      await testErrorHandling(
        result,
        async () => {
          await result.current.unsubscribeFromPush()
        },
        'Error unsubscribing from push notifications'
      )
    })

    it('should handle backend unsubscription errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500
      })

      const mockSubscription = {
        toJSON: vi.fn().mockReturnValue({ endpoint: 'test' }),
        unsubscribe: vi.fn().mockResolvedValue(true)
      }

      mockServiceWorker.ready = Promise.resolve({
        pushManager: {
          getSubscription: vi.fn().mockResolvedValue(mockSubscription)
        }
      })

      const { result } = renderHook(() => useNotifications())

      await testErrorHandling(
        result,
        async () => {
          await result.current.unsubscribeFromPush()
        },
        'Error unsubscribing from push notifications'
      )
    })
  })

  describe('Test Notifications', () => {
    it('should send test notification when permission granted', () => {
      mockNotificationPermission('granted')

      const { result } = renderHook(() => useNotifications())

      // Update permission state
      act(() => {
        result.current.notificationState.permission = 'granted'
      })

      act(() => {
        result.current.sendTestNotification('Test Title', 'Test Message')
      })

      expect(global.Notification).toHaveBeenCalledWith('Test Title', {
        body: 'Test Message',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: 'test-notification',
        requireInteraction: false,
        timestamp: expect.any(Number)
      })
    })

    it('should not send test notification when permission not granted', () => {
      mockNotificationPermission('denied')

      const { result } = renderHook(() => useNotifications())

      act(() => {
        result.current.sendTestNotification('Test Title', 'Test Message')
      })

      expect(global.Notification).not.toHaveBeenCalled()
    })

    it('should send notification with current timestamp', () => {
      mockNotificationPermission('granted')

      const { result } = renderHook(() => useNotifications())

      const beforeTime = Date.now()

      act(() => {
        result.current.sendTestNotification('Test', 'Message')
      })

      const afterTime = Date.now()

      expect(global.Notification).toHaveBeenCalledWith('Test', {
        body: 'Message',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: 'test-notification',
        requireInteraction: false,
        timestamp: expect.any(Number)
      })

      const call = (global.Notification as any).mock.calls[0]
      const timestamp = call[1].timestamp
      expect(timestamp).toBeGreaterThanOrEqual(beforeTime)
      expect(timestamp).toBeLessThanOrEqual(afterTime)
    })
  })

  describe('Utility Functions', () => {
    it('should convert base64 to Uint8Array correctly', () => {
      const { result } = renderHook(() => useNotifications())

      // Test the base64 conversion by subscribing
      mockNotificationPermission('granted')

      const mockPushManager = {
        getSubscription: vi.fn().mockResolvedValue(null),
        subscribe: vi.fn().mockResolvedValue({
          toJSON: () => ({ endpoint: 'test' }),
          unsubscribe: vi.fn()
        })
      }

      mockServiceWorker.ready = Promise.resolve({
        pushManager: mockPushManager
      })

      act(async () => {
        await result.current.subscribeToPush()
      })

      expect(mockPushManager.subscribe).toHaveBeenCalledWith({
        userVisibleOnly: true,
        applicationServerKey: expect.any(Uint8Array)
      })

      const applicationServerKey = mockPushManager.subscribe.mock.calls[0][0].applicationServerKey
      expect(applicationServerKey).toBeInstanceOf(Uint8Array)
      expect(applicationServerKey.length).toBeGreaterThan(0)
    })

    it('should handle VAPID key correctly', () => {
      // Test that the VAPID key is properly formatted and used
      const { result } = renderHook(() => useNotifications())

      mockNotificationPermission('granted')

      const mockPushManager = {
        getSubscription: vi.fn().mockResolvedValue(null),
        subscribe: vi.fn().mockResolvedValue({
          toJSON: () => ({ endpoint: 'test' }),
          unsubscribe: vi.fn()
        })
      }

      mockServiceWorker.ready = Promise.resolve({
        pushManager: mockPushManager
      })

      act(async () => {
        await result.current.subscribeToPush()
      })

      const applicationServerKey = mockPushManager.subscribe.mock.calls[0][0].applicationServerKey

      // Should be a valid Uint8Array with expected length for a VAPID key
      expect(applicationServerKey).toBeInstanceOf(Uint8Array)
      expect(applicationServerKey.length).toBe(65) // Standard VAPID key length
    })
  })

  describe('Service Worker Integration', () => {
    it('should handle service worker not ready', async () => {
      mockServiceWorker.ready = Promise.reject(new Error('Service worker not ready'))

      const { result } = renderHook(() => useNotifications())

      await waitForHookUpdate(result, () => {
        expect(result.current.notificationState.subscriptionStatus).toBe('unsubscribed')
      })
    })

    it('should handle push manager not available', async () => {
      mockServiceWorker.ready = Promise.resolve({
        // Missing pushManager
      } as any)

      const { result } = renderHook(() => useNotifications())

      await testErrorHandling(
        result,
        async () => {
          await result.current.subscribeToPush()
        }
      )
    })
  })
})

describe('NotificationPermissionPrompt Component', () => {
  setupHookTest()

  beforeEach(() => {
    vi.clearAllMocks()
    mockNotificationPermission('default')
  })

  it('should render permission prompt when notifications are supported and permission is default', () => {
    render(<NotificationPermissionPrompt />)

    expect(screen.getByText('Stay updated with notifications')).toBeInTheDocument()
    expect(screen.getByText('Enable Notifications')).toBeInTheDocument()
    expect(screen.getByText('Maybe Later')).toBeInTheDocument()
  })

  it('should not render when notifications are not supported', () => {
    const originalNotification = global.Notification
    delete (global as any).Notification

    const { container } = render(<NotificationPermissionPrompt />)

    expect(container.firstChild).toBeNull()

    global.Notification = originalNotification
  })

  it('should not render when permission is already granted', () => {
    mockNotificationPermission('granted')

    const { container } = render(<NotificationPermissionPrompt />)

    expect(container.firstChild).toBeNull()
  })

  it('should not render when permission is denied', () => {
    mockNotificationPermission('denied')

    const { container } = render(<NotificationPermissionPrompt />)

    expect(container.firstChild).toBeNull()
  })

  it('should handle enable notifications click', async () => {
    mockNotificationPermission('granted')
    mockFetch.mockResolvedValue({ ok: true })

    const mockSubscription = {
      toJSON: () => ({ endpoint: 'test' }),
      unsubscribe: vi.fn()
    }

    mockServiceWorker.ready = Promise.resolve({
      pushManager: {
        getSubscription: vi.fn().mockResolvedValue(null),
        subscribe: vi.fn().mockResolvedValue(mockSubscription)
      }
    })

    render(<NotificationPermissionPrompt />)

    const enableButton = screen.getByText('Enable Notifications')

    await act(async () => {
      fireEvent.click(enableButton)
    })

    expect(global.Notification.requestPermission).toHaveBeenCalled()
  })

  it('should handle maybe later click', () => {
    render(<NotificationPermissionPrompt />)

    const maybeLaterButton = screen.getByText('Maybe Later')

    act(() => {
      fireEvent.click(maybeLaterButton)
    })

    // Prompt should be hidden
    expect(screen.queryByText('Stay updated with notifications')).not.toBeInTheDocument()
  })

  it('should hide prompt after enabling notifications', async () => {
    mockNotificationPermission('granted')

    render(<NotificationPermissionPrompt />)

    const enableButton = screen.getByText('Enable Notifications')

    await act(async () => {
      fireEvent.click(enableButton)
    })

    // Prompt should be hidden after enabling
    expect(screen.queryByText('Stay updated with notifications')).not.toBeInTheDocument()
  })

  it('should have proper accessibility attributes', () => {
    render(<NotificationPermissionPrompt />)

    const heading = screen.getByText('Stay updated with notifications')
    const enableButton = screen.getByText('Enable Notifications')
    const laterButton = screen.getByText('Maybe Later')

    expect(heading).toBeInTheDocument()
    expect(enableButton).toBeInTheDocument()
    expect(laterButton).toBeInTheDocument()

    // Check button accessibility
    expect(enableButton).toHaveAttribute('type', 'button')
    expect(laterButton).toHaveAttribute('type', 'button')
  })

  it('should have responsive design classes', () => {
    render(<NotificationPermissionPrompt />)

    const container = screen.getByText('Stay updated with notifications').closest('.notification-permission-prompt')
    const buttonContainer = screen.getByText('Enable Notifications').parentElement

    expect(container).toHaveClass('notification-permission-prompt')
    expect(buttonContainer).toHaveClass('flex', 'flex-col', 'sm:flex-row')
  })

  it('should show proper notification icon', () => {
    render(<NotificationPermissionPrompt />)

    const icon = screen.getByText('🔔')
    expect(icon).toBeInTheDocument()
  })

  it('should handle permission request failure gracefully', async () => {
    mockNotificationPermission('denied')

    render(<NotificationPermissionPrompt />)

    const enableButton = screen.getByText('Enable Notifications')

    await act(async () => {
      fireEvent.click(enableButton)
    })

    // Should still hide the prompt even if permission was denied
    expect(screen.queryByText('Stay updated with notifications')).not.toBeInTheDocument()
  })
})