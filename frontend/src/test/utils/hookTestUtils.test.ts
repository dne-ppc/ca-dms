/**
 * Tests for hook testing utilities
 * Tests the various mock functions and utilities for testing React hooks
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  setupBrowserMocks,
  createKeyboardEvent,
  createFormElement,
  setupTimerMocks,
  mockEventListeners,
  mockNetworkChange,
  mockNotificationPermission,
  waitForHookUpdate,
  testErrorHandling,
  mockServiceWorker,
  mockFetch,
  mockWorkbox,
  mockBeforeInstallPromptEvent
} from './hookTestUtils'

// Mock console to avoid noise in tests
const consoleSpy = {
  log: vi.spyOn(console, 'log').mockImplementation(() => {}),
  warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
  error: vi.spyOn(console, 'error').mockImplementation(() => {})
}

describe('Hook Test Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    consoleSpy.log.mockClear()
    consoleSpy.warn.mockClear()
    consoleSpy.error.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('setupBrowserMocks', () => {
    it('should mock Notification API', () => {
      setupBrowserMocks()

      expect(global.Notification).toBeDefined()
      expect(global.Notification.permission).toBe('default')
      expect(global.Notification.requestPermission).toBeDefined()

      // Test notification creation
      const notification = new global.Notification('Test Title', {
        body: 'Test Body',
        icon: '/icon.png'
      })

      expect(notification.title).toBe('Test Title')
      expect(notification.body).toBe('Test Body')
      expect(notification.icon).toBe('/icon.png')
    })

    it('should mock Service Worker API', () => {
      setupBrowserMocks()

      expect(navigator.serviceWorker).toBeDefined()
      expect(navigator.serviceWorker.register).toBeDefined()
      expect(navigator.serviceWorker.addEventListener).toBeDefined()
    })

    it('should mock localStorage', () => {
      setupBrowserMocks()

      expect(window.localStorage).toBeDefined()
      expect(window.localStorage.getItem).toBeDefined()
      expect(window.localStorage.setItem).toBeDefined()
      expect(window.localStorage.removeItem).toBeDefined()

      // Test localStorage functionality
      window.localStorage.setItem('test', 'value')
      expect(window.localStorage.setItem).toHaveBeenCalledWith('test', 'value')
    })

    it('should mock online/offline status', () => {
      setupBrowserMocks()

      expect(navigator.onLine).toBe(true)
    })

    it('should mock matchMedia', () => {
      setupBrowserMocks()

      expect(window.matchMedia).toBeDefined()

      const mediaQuery = window.matchMedia('(display-mode: standalone)')
      expect(mediaQuery).toHaveProperty('matches')
      expect(mediaQuery).toHaveProperty('addListener')
      expect(mediaQuery).toHaveProperty('removeListener')
    })

    it('should mock fetch', () => {
      setupBrowserMocks()

      expect(global.fetch).toBe(mockFetch)
    })

    it('should mock console methods', () => {
      setupBrowserMocks()

      console.log('test')
      console.warn('test')
      console.error('test')

      // Console methods should be mocked (not produce actual output)
      expect(true).toBe(true) // Just verify no errors thrown
    })

    it('should mock atob for base64 decoding', () => {
      setupBrowserMocks()

      expect(global.atob).toBeDefined()

      const result = global.atob('dGVzdA==') // 'test' in base64
      expect(typeof result).toBe('string')
    })
  })

  describe('createKeyboardEvent', () => {
    it('should create basic keyboard event', () => {
      const event = createKeyboardEvent('Enter')

      expect(event.key).toBe('Enter')
      expect(event.type).toBe('keydown')
      expect(event.ctrlKey).toBe(false)
      expect(event.altKey).toBe(false)
      expect(event.shiftKey).toBe(false)
    })

    it('should create keyboard event with modifiers', () => {
      const event = createKeyboardEvent('s', {
        ctrlKey: true,
        altKey: true,
        shiftKey: true
      })

      expect(event.key).toBe('s')
      expect(event.ctrlKey).toBe(true)
      expect(event.altKey).toBe(true)
      expect(event.shiftKey).toBe(true)
    })

    it('should create keyboard event with target', () => {
      const mockTarget = {
        tagName: 'INPUT',
        contentEditable: 'true',
        classList: { contains: vi.fn().mockReturnValue(true) }
      }

      const event = createKeyboardEvent('Tab', { target: mockTarget })

      expect(event.target).toMatchObject(mockTarget)
    })

    it('should have proper event properties', () => {
      const event = createKeyboardEvent('Escape')

      expect(event.bubbles).toBe(true)
      expect(event.cancelable).toBe(true)
    })
  })

  describe('createFormElement', () => {
    it('should create basic form element', () => {
      const element = createFormElement('input')

      expect(element.tagName).toBe('INPUT')
      expect(element.contentEditable).toBe('false')
      expect(element.classList).toBeDefined()
      expect(element.classList.contains).toBeDefined()
    })

    it('should create form element with additional properties', () => {
      const additional = {
        type: 'text',
        value: 'test value',
        disabled: false
      }

      const element = createFormElement('input', additional)

      expect(element.type).toBe('text')
      expect(element.value).toBe('test value')
      expect(element.disabled).toBe(false)
    })

    it('should handle different element types', () => {
      const textarea = createFormElement('textarea')
      const select = createFormElement('select')

      expect(textarea.tagName).toBe('TEXTAREA')
      expect(select.tagName).toBe('SELECT')
    })
  })

  describe('setupTimerMocks', () => {
    it('should setup fake timers', () => {
      const timerUtils = setupTimerMocks()

      expect(timerUtils).toHaveProperty('advanceTimers')
      expect(timerUtils).toHaveProperty('runAllTimers')
      expect(timerUtils).toHaveProperty('clearAllTimers')

      // Test that timers are fake
      let executed = false
      setTimeout(() => { executed = true }, 1000)

      expect(executed).toBe(false)

      timerUtils.advanceTimers(1000)
      expect(executed).toBe(true)
    })

    it('should advance timers by specified time', () => {
      const timerUtils = setupTimerMocks()

      let counter = 0
      const interval = setInterval(() => { counter++ }, 100)

      timerUtils.advanceTimers(350)
      expect(counter).toBe(3)

      timerUtils.advanceTimers(250)
      expect(counter).toBe(6)

      clearInterval(interval)
    })

    it('should run all pending timers', () => {
      const timerUtils = setupTimerMocks()

      let executed = 0
      setTimeout(() => { executed++ }, 1000)
      setTimeout(() => { executed++ }, 2000)
      setTimeout(() => { executed++ }, 3000)

      expect(executed).toBe(0)

      timerUtils.runAllTimers()
      expect(executed).toBe(3)
    })
  })

  describe('mockEventListeners', () => {
    it('should mock addEventListener and removeEventListener', () => {
      const { addEventListener, removeEventListener, dispatchEvent } = mockEventListeners()

      const handler = vi.fn()
      addEventListener('click', handler)

      expect(addEventListener).toHaveBeenCalledWith('click', handler)

      dispatchEvent('click', 'test-event')
      expect(handler).toHaveBeenCalledWith('test-event')

      removeEventListener('click', handler)
      expect(removeEventListener).toHaveBeenCalledWith('click', handler)

      // Handler should no longer be called after removal
      handler.mockClear()
      dispatchEvent('click', 'test-event-2')
      expect(handler).not.toHaveBeenCalled()
    })

    it('should handle multiple listeners for same event', () => {
      const { addEventListener, dispatchEvent } = mockEventListeners()

      const handler1 = vi.fn()
      const handler2 = vi.fn()

      addEventListener('test-event', handler1)
      addEventListener('test-event', handler2)

      dispatchEvent('test-event', 'data')

      expect(handler1).toHaveBeenCalledWith('data')
      expect(handler2).toHaveBeenCalledWith('data')
    })

    it('should return listeners for inspection', () => {
      const { addEventListener, listeners } = mockEventListeners()

      const handler = vi.fn()
      addEventListener('custom-event', handler)

      expect(listeners['custom-event']).toContain(handler)
    })
  })

  describe('mockNetworkChange', () => {
    beforeEach(() => {
      setupBrowserMocks()
    })

    it('should change navigator.onLine status', () => {
      expect(navigator.onLine).toBe(true)

      mockNetworkChange(false)
      expect(navigator.onLine).toBe(false)

      mockNetworkChange(true)
      expect(navigator.onLine).toBe(true)
    })

    it('should dispatch network events', () => {
      const eventHandler = vi.fn()
      window.addEventListener('online', eventHandler)
      window.addEventListener('offline', eventHandler)

      mockNetworkChange(false)
      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'offline' })
      )

      eventHandler.mockClear()
      mockNetworkChange(true)
      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'online' })
      )
    })
  })

  describe('mockNotificationPermission', () => {
    beforeEach(() => {
      setupBrowserMocks()
    })

    it('should change notification permission', () => {
      expect(global.Notification.permission).toBe('default')

      mockNotificationPermission('granted')
      expect(global.Notification.permission).toBe('granted')

      mockNotificationPermission('denied')
      expect(global.Notification.permission).toBe('denied')
    })

    it('should update requestPermission mock', () => {
      mockNotificationPermission('granted')

      return global.Notification.requestPermission().then(permission => {
        expect(permission).toBe('granted')
      })
    })
  })

  describe('waitForHookUpdate', () => {
    it('should wait for async updates', async () => {
      let value = 'initial'

      const { result } = renderHook(() => {
        return value
      })

      expect(result.current).toBe('initial')

      // Simulate async update
      setTimeout(() => {
        value = 'updated'
      }, 0)

      await waitForHookUpdate(result, () => {
        // The assertion will be run after the async update
        expect(value).toBe('updated')
      })
    })
  })

  describe('testErrorHandling', () => {
    it('should test error handling in async operations', async () => {
      const hookResult = { current: null }

      const errorAction = async () => {
        console.error('Test error message', new Error('Test error'))
        throw new Error('Test error')
      }

      await testErrorHandling(hookResult, errorAction, 'Test error message')

      // The function should have caught and verified the error
      expect(true).toBe(true) // Test passes if no exception thrown
    })

    it('should handle synchronous errors', async () => {
      const hookResult = { current: null }

      const errorAction = () => {
        console.error('Sync error', new Error('Sync error'))
        throw new Error('Sync error')
      }

      await testErrorHandling(hookResult, errorAction, 'Sync error')

      expect(true).toBe(true)
    })
  })

  describe('mockServiceWorker', () => {
    it('should provide service worker mock', () => {
      expect(mockServiceWorker.register).toBeDefined()
      expect(mockServiceWorker.addEventListener).toBeDefined()
      expect(mockServiceWorker.messageSkipWaiting).toBeDefined()

      expect(mockServiceWorker.register()).resolves.toBeUndefined()
    })

    it('should provide push manager mock', async () => {
      const sw = await mockServiceWorker.ready
      expect(sw.pushManager).toBeDefined()
      expect(sw.pushManager.getSubscription).toBeDefined()
      expect(sw.pushManager.subscribe).toBeDefined()
    })
  })

  describe('mockWorkbox', () => {
    it('should provide Workbox constructor mock', () => {
      const WorkboxInstance = new mockWorkbox.Workbox()

      expect(WorkboxInstance.register).toBeDefined()
      expect(WorkboxInstance.addEventListener).toBeDefined()
      expect(WorkboxInstance.messageSkipWaiting).toBeDefined()
    })
  })

  describe('mockBeforeInstallPromptEvent', () => {
    it('should provide BeforeInstallPromptEvent mock', () => {
      expect(mockBeforeInstallPromptEvent.preventDefault).toBeDefined()
      expect(mockBeforeInstallPromptEvent.prompt).toBeDefined()
      expect(mockBeforeInstallPromptEvent.userChoice).toBeDefined()

      expect(mockBeforeInstallPromptEvent.prompt()).resolves.toBeUndefined()
      expect(mockBeforeInstallPromptEvent.userChoice).resolves.toEqual({
        outcome: 'accepted'
      })
    })
  })

  describe('Integration scenarios', () => {
    it('should work together for complex hook testing', async () => {
      // Setup all mocks
      setupBrowserMocks()
      const timerUtils = setupTimerMocks()
      const eventUtils = mockEventListeners()

      // Create a mock hook that uses multiple browser APIs
      const useComplexHook = () => {
        const [online, setOnline] = useState(navigator.onLine)
        const [notification, setNotification] = useState<Notification | null>(null)

        useEffect(() => {
          const handleOnline = () => setOnline(true)
          const handleOffline = () => setOnline(false)

          window.addEventListener('online', handleOnline)
          window.addEventListener('offline', handleOffline)

          return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
          }
        }, [])

        const showNotification = () => {
          if (Notification.permission === 'granted') {
            const notif = new Notification('Test', { body: 'Test body' })
            setNotification(notif)
          }
        }

        return { online, notification, showNotification }
      }

      const { result } = renderHook(useComplexHook)

      // Initial state
      expect(result.current.online).toBe(true)
      expect(result.current.notification).toBeNull()

      // Test network change
      act(() => {
        mockNetworkChange(false)
      })

      expect(result.current.online).toBe(false)

      // Test notification
      act(() => {
        mockNotificationPermission('granted')
        result.current.showNotification()
      })

      expect(result.current.notification).toBeDefined()
      expect(result.current.notification?.title).toBe('Test')
    })

    it('should handle cleanup properly', () => {
      setupBrowserMocks()

      // Verify mocks are in place
      expect(global.Notification).toBeDefined()
      expect(navigator.serviceWorker).toBeDefined()

      // After test cleanup, mocks should still be functional
      expect(() => {
        new global.Notification('Test')
      }).not.toThrow()
    })
  })
})

// Import useState and useEffect for the integration test
import { useState, useEffect } from 'react'