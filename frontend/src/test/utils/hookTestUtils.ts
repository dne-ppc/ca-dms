/**
 * Test utilities for React hooks testing
 */
import { renderHook, act } from '@testing-library/react'
import { vi, beforeEach, afterEach } from 'vitest'

// Mock service worker for PWA tests
export const mockServiceWorker = {
  register: vi.fn().mockResolvedValue(undefined),
  addEventListener: vi.fn(),
  messageSkipWaiting: vi.fn(),
  ready: Promise.resolve({
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
}

// Mock fetch for API calls
export const mockFetch = vi.fn()

// Mock browser APIs
export const setupBrowserMocks = () => {
  // Mock Notification API
  global.Notification = vi.fn().mockImplementation((title, options) => ({
    title,
    body: options?.body,
    icon: options?.icon,
    tag: options?.tag,
    requireInteraction: options?.requireInteraction,
    timestamp: options?.timestamp
  })) as any

  global.Notification.permission = 'default'
  global.Notification.requestPermission = vi.fn().mockResolvedValue('granted')

  // Mock Service Worker API
  Object.defineProperty(navigator, 'serviceWorker', {
    value: mockServiceWorker,
    writable: true
  })

  // Mock online/offline status
  Object.defineProperty(navigator, 'onLine', {
    value: true,
    writable: true
  })

  // Mock PushManager
  Object.defineProperty(window, 'PushManager', {
    value: vi.fn(),
    writable: true
  })

  // Mock localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn()
  }
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true
  })

  // Mock atob for base64 decoding
  global.atob = vi.fn().mockImplementation((str: string) => {
    return Buffer.from(str, 'base64').toString('binary')
  })

  // Mock matchMedia for PWA display mode
  Object.defineProperty(window, 'matchMedia', {
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === '(display-mode: standalone)' ? false : true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    })),
    writable: true
  })

  // Mock fetch
  global.fetch = mockFetch

  // Mock console methods to avoid noise in tests
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
}

// Mock keyboard events
export const createKeyboardEvent = (
  key: string,
  options: {
    ctrlKey?: boolean
    altKey?: boolean
    shiftKey?: boolean
    target?: Partial<HTMLElement>
  } = {}
): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', {
    key,
    ctrlKey: options.ctrlKey || false,
    altKey: options.altKey || false,
    shiftKey: options.shiftKey || false,
    bubbles: true,
    cancelable: true
  })

  // Mock target element
  if (options.target) {
    Object.defineProperty(event, 'target', {
      value: {
        tagName: 'DIV',
        contentEditable: 'false',
        classList: { contains: vi.fn().mockReturnValue(false) },
        ...options.target
      },
      writable: true
    })
  }

  return event
}

// Mock form elements
export const createFormElement = (tagName: string, additional: any = {}): HTMLElement => ({
  tagName: tagName.toUpperCase(),
  contentEditable: 'false',
  classList: { contains: vi.fn().mockReturnValue(false) },
  ...additional
} as HTMLElement)

// Mock timer functions
export const setupTimerMocks = () => {
  vi.useFakeTimers()
  return {
    advanceTimers: (ms: number) => act(() => vi.advanceTimersByTime(ms)),
    runAllTimers: () => act(() => vi.runAllTimers()),
    clearAllTimers: () => vi.clearAllTimers()
  }
}

// Mock Workbox
export const mockWorkbox = {
  Workbox: vi.fn().mockImplementation(() => ({
    register: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn(),
    messageSkipWaiting: vi.fn()
  }))
}

// Mock BeforeInstallPromptEvent
export const mockBeforeInstallPromptEvent = {
  preventDefault: vi.fn(),
  prompt: vi.fn().mockResolvedValue(undefined),
  userChoice: Promise.resolve({ outcome: 'accepted' as const })
}

// Setup and cleanup utilities
export const setupHookTest = () => {
  beforeEach(() => {
    setupBrowserMocks()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.restoreAllMocks()
  })
}

// Utility to test async hook operations
export const waitForHookUpdate = async (hookResult: any, assertion: () => void) => {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  assertion()
}

// Mock event listeners for testing
export const mockEventListeners = () => {
  const listeners: Record<string, Function[]> = {}

  const addEventListener = vi.fn().mockImplementation((event: string, handler: Function) => {
    if (!listeners[event]) listeners[event] = []
    listeners[event].push(handler)
  })

  const removeEventListener = vi.fn().mockImplementation((event: string, handler: Function) => {
    if (listeners[event]) {
      listeners[event] = listeners[event].filter(h => h !== handler)
    }
  })

  const dispatchEvent = (event: string, ...args: any[]) => {
    if (listeners[event]) {
      listeners[event].forEach(handler => handler(...args))
    }
  }

  Object.defineProperty(document, 'addEventListener', { value: addEventListener })
  Object.defineProperty(document, 'removeEventListener', { value: removeEventListener })
  Object.defineProperty(window, 'addEventListener', { value: addEventListener })
  Object.defineProperty(window, 'removeEventListener', { value: removeEventListener })

  return { addEventListener, removeEventListener, dispatchEvent, listeners }
}

// Mock network status changes
export const mockNetworkChange = (online: boolean) => {
  Object.defineProperty(navigator, 'onLine', {
    value: online,
    writable: true
  })

  const event = new Event(online ? 'online' : 'offline')
  window.dispatchEvent(event)
}

// Mock notification permission changes
export const mockNotificationPermission = (permission: NotificationPermission) => {
  global.Notification.permission = permission
  global.Notification.requestPermission = vi.fn().mockResolvedValue(permission)
}

// Utility for testing component rendering in hooks
export const renderHookWithWrapper = <T>(
  hook: () => T,
  wrapper?: React.ComponentType<{ children: React.ReactNode }>
) => {
  return renderHook(hook, { wrapper })
}

// Mock timer utilities for PWA and notification tests
export const createMockTimer = () => {
  const timers: NodeJS.Timeout[] = []

  const mockSetTimeout = vi.fn().mockImplementation((fn: Function, delay: number) => {
    const timer = setTimeout(fn, delay) as NodeJS.Timeout
    timers.push(timer)
    return timer
  })

  const clearAllMockTimers = () => {
    timers.forEach(timer => clearTimeout(timer))
    timers.length = 0
  }

  global.setTimeout = mockSetTimeout

  return { mockSetTimeout, clearAllMockTimers, timers }
}

// Utility to test error handling in hooks
export const testErrorHandling = async (
  hookResult: any,
  errorAction: () => Promise<void> | void,
  expectedError?: string
) => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

  await act(async () => {
    try {
      await errorAction()
    } catch (error) {
      // Expected error
    }
  })

  if (expectedError) {
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining(expectedError),
      expect.any(Error)
    )
  }

  consoleError.mockRestore()
}