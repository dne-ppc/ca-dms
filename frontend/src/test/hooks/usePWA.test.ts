/**
 * Comprehensive tests for usePWA hook and utility functions
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  usePWA,
  saveToOfflineStorage,
  getFromOfflineStorage,
  clearOfflineStorage
} from '../../hooks/usePWA'
import {
  setupHookTest,
  mockWorkbox,
  mockBeforeInstallPromptEvent,
  mockEventListeners,
  mockNetworkChange,
  waitForHookUpdate
} from '../utils/hookTestUtils'

// Mock Workbox
vi.mock('workbox-window', () => mockWorkbox)

describe('usePWA', () => {
  setupHookTest()

  let eventListeners: ReturnType<typeof mockEventListeners>

  beforeEach(() => {
    eventListeners = mockEventListeners()
    vi.clearAllMocks()

    // Reset mocks
    mockWorkbox.Workbox.mockImplementation(() => ({
      register: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn(),
      messageSkipWaiting: vi.fn()
    }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Initial State', () => {
    it('should return initial PWA state', () => {
      const { result } = renderHook(() => usePWA())

      expect(result.current).toMatchObject({
        isInstallable: false,
        isInstalled: false,
        isOffline: false, // navigator.onLine is true by default
        hasUpdate: false,
        installApp: expect.any(Function),
        updateApp: expect.any(Function)
      })
    })

    it('should detect offline status correctly', () => {
      // Mock offline status
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true
      })

      const { result } = renderHook(() => usePWA())

      expect(result.current.isOffline).toBe(true)
    })

    it('should detect installed PWA via display mode', () => {
      // Mock standalone display mode
      Object.defineProperty(window, 'matchMedia', {
        value: vi.fn().mockImplementation((query: string) => ({
          matches: query === '(display-mode: standalone)' ? true : false,
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn()
        })),
        writable: true
      })

      const { result } = renderHook(() => usePWA())

      expect(result.current.isInstalled).toBe(true)
    })
  })

  describe('Service Worker Integration', () => {
    it('should register service worker when available', async () => {
      const mockRegister = vi.fn().mockResolvedValue(undefined)
      mockWorkbox.Workbox.mockImplementation(() => ({
        register: mockRegister,
        addEventListener: vi.fn(),
        messageSkipWaiting: vi.fn()
      }))

      renderHook(() => usePWA())

      await waitForHookUpdate(null, () => {
        expect(mockWorkbox.Workbox).toHaveBeenCalledWith('/sw.js')
        expect(mockRegister).toHaveBeenCalled()
      })
    })

    it('should handle service worker waiting event', async () => {
      let waitingHandler: Function
      const mockAddEventListener = vi.fn().mockImplementation((event, handler) => {
        if (event === 'waiting') {
          waitingHandler = handler
        }
      })

      mockWorkbox.Workbox.mockImplementation(() => ({
        register: vi.fn().mockResolvedValue(undefined),
        addEventListener: mockAddEventListener,
        messageSkipWaiting: vi.fn()
      }))

      const { result } = renderHook(() => usePWA())

      await waitForHookUpdate(result, () => {
        expect(mockAddEventListener).toHaveBeenCalledWith('waiting', expect.any(Function))
      })

      // Trigger waiting event
      act(() => {
        waitingHandler?.()
      })

      expect(result.current.hasUpdate).toBe(true)
    })

    it('should handle service worker controlling event', async () => {
      let controllingHandler: Function
      const mockAddEventListener = vi.fn().mockImplementation((event, handler) => {
        if (event === 'controlling') {
          controllingHandler = handler
        }
      })

      const mockReload = vi.fn()
      Object.defineProperty(window.location, 'reload', {
        value: mockReload,
        writable: true
      })

      mockWorkbox.Workbox.mockImplementation(() => ({
        register: vi.fn().mockResolvedValue(undefined),
        addEventListener: mockAddEventListener,
        messageSkipWaiting: vi.fn()
      }))

      renderHook(() => usePWA())

      await waitForHookUpdate(null, () => {
        expect(mockAddEventListener).toHaveBeenCalledWith('controlling', expect.any(Function))
      })

      // Trigger controlling event
      act(() => {
        controllingHandler?.()
      })

      expect(mockReload).toHaveBeenCalled()
    })

    it('should handle service worker not supported', () => {
      // Mock service worker not supported
      delete (navigator as any).serviceWorker

      expect(() => {
        renderHook(() => usePWA())
      }).not.toThrow()
    })
  })

  describe('Install Prompt Handling', () => {
    it('should handle beforeinstallprompt event', () => {
      const { result } = renderHook(() => usePWA())

      expect(result.current.isInstallable).toBe(false)

      // Trigger beforeinstallprompt event
      act(() => {
        eventListeners.dispatchEvent('beforeinstallprompt', mockBeforeInstallPromptEvent)
      })

      expect(result.current.isInstallable).toBe(true)
      expect(mockBeforeInstallPromptEvent.preventDefault).toHaveBeenCalled()
    })

    it('should install app when prompted', async () => {
      const { result } = renderHook(() => usePWA())

      // Set up install prompt
      act(() => {
        eventListeners.dispatchEvent('beforeinstallprompt', mockBeforeInstallPromptEvent)
      })

      expect(result.current.isInstallable).toBe(true)

      // Install app
      await act(async () => {
        await result.current.installApp()
      })

      expect(mockBeforeInstallPromptEvent.prompt).toHaveBeenCalled()
      expect(result.current.isInstalled).toBe(true)
      expect(result.current.isInstallable).toBe(false)
    })

    it('should handle install prompt rejection', async () => {
      const rejectedPromptEvent = {
        ...mockBeforeInstallPromptEvent,
        userChoice: Promise.resolve({ outcome: 'dismissed' as const })
      }

      const { result } = renderHook(() => usePWA())

      // Set up install prompt
      act(() => {
        eventListeners.dispatchEvent('beforeinstallprompt', rejectedPromptEvent)
      })

      // Try to install app
      await act(async () => {
        await result.current.installApp()
      })

      expect(result.current.isInstalled).toBe(false)
      expect(result.current.isInstallable).toBe(true) // Should remain installable
    })

    it('should handle installApp without prompt', async () => {
      const { result } = renderHook(() => usePWA())

      // Try to install without prompt
      await act(async () => {
        await result.current.installApp()
      })

      // Should not crash or change state
      expect(result.current.isInstalled).toBe(false)
      expect(result.current.isInstallable).toBe(false)
    })

    it('should handle install prompt errors', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      const errorPromptEvent = {
        ...mockBeforeInstallPromptEvent,
        prompt: vi.fn().mockRejectedValue(new Error('Install failed'))
      }

      const { result } = renderHook(() => usePWA())

      act(() => {
        eventListeners.dispatchEvent('beforeinstallprompt', errorPromptEvent)
      })

      await act(async () => {
        await result.current.installApp()
      })

      expect(consoleError).toHaveBeenCalledWith('Failed to install PWA:', expect.any(Error))
      expect(result.current.isInstalled).toBe(false)

      consoleError.mockRestore()
    })
  })

  describe('Network Status Handling', () => {
    it('should update offline status when going offline', () => {
      const { result } = renderHook(() => usePWA())

      expect(result.current.isOffline).toBe(false)

      // Go offline
      act(() => {
        mockNetworkChange(false)
      })

      expect(result.current.isOffline).toBe(true)
    })

    it('should update offline status when going online', () => {
      // Start offline
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true
      })

      const { result } = renderHook(() => usePWA())

      expect(result.current.isOffline).toBe(true)

      // Go online
      act(() => {
        mockNetworkChange(true)
      })

      expect(result.current.isOffline).toBe(false)
    })

    it('should handle rapid network status changes', () => {
      const { result } = renderHook(() => usePWA())

      expect(result.current.isOffline).toBe(false)

      // Rapid changes
      act(() => {
        mockNetworkChange(false)
        mockNetworkChange(true)
        mockNetworkChange(false)
        mockNetworkChange(true)
      })

      expect(result.current.isOffline).toBe(false)
    })
  })

  describe('Update Handling', () => {
    it('should update app when update is available', async () => {
      let waitingHandler: Function
      const mockMessageSkipWaiting = vi.fn()
      const mockAddEventListener = vi.fn().mockImplementation((event, handler) => {
        if (event === 'waiting') {
          waitingHandler = handler
        }
      })

      mockWorkbox.Workbox.mockImplementation(() => ({
        register: vi.fn().mockResolvedValue(undefined),
        addEventListener: mockAddEventListener,
        messageSkipWaiting: mockMessageSkipWaiting
      }))

      const { result } = renderHook(() => usePWA())

      // Trigger update available
      await waitForHookUpdate(result, () => {
        waitingHandler?.()
      })

      expect(result.current.hasUpdate).toBe(true)

      // Update app
      await act(async () => {
        await result.current.updateApp()
      })

      expect(mockMessageSkipWaiting).toHaveBeenCalled()
      expect(result.current.hasUpdate).toBe(false)
    })

    it('should handle updateApp without workbox', async () => {
      const { result } = renderHook(() => usePWA())

      // Try to update without workbox
      await act(async () => {
        await result.current.updateApp()
      })

      // Should not crash
      expect(result.current.hasUpdate).toBe(false)
    })

    it('should handle update errors', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      const mockMessageSkipWaiting = vi.fn().mockImplementation(() => {
        throw new Error('Update failed')
      })

      let waitingHandler: Function
      const mockAddEventListener = vi.fn().mockImplementation((event, handler) => {
        if (event === 'waiting') {
          waitingHandler = handler
        }
      })

      mockWorkbox.Workbox.mockImplementation(() => ({
        register: vi.fn().mockResolvedValue(undefined),
        addEventListener: mockAddEventListener,
        messageSkipWaiting: mockMessageSkipWaiting
      }))

      const { result } = renderHook(() => usePWA())

      // Trigger update available
      await waitForHookUpdate(result, () => {
        waitingHandler?.()
      })

      // Try to update
      await act(async () => {
        await result.current.updateApp()
      })

      expect(consoleError).toHaveBeenCalledWith('Failed to update PWA:', expect.any(Error))

      consoleError.mockRestore()
    })
  })

  describe('Event Listener Cleanup', () => {
    it('should remove event listeners on unmount', () => {
      const { unmount } = renderHook(() => usePWA())

      // Should have added event listeners
      expect(eventListeners.addEventListener).toHaveBeenCalledWith(
        'beforeinstallprompt',
        expect.any(Function)
      )
      expect(eventListeners.addEventListener).toHaveBeenCalledWith(
        'online',
        expect.any(Function)
      )
      expect(eventListeners.addEventListener).toHaveBeenCalledWith(
        'offline',
        expect.any(Function)
      )

      unmount()

      // Should have removed event listeners
      expect(eventListeners.removeEventListener).toHaveBeenCalledWith(
        'beforeinstallprompt',
        expect.any(Function)
      )
      expect(eventListeners.removeEventListener).toHaveBeenCalledWith(
        'online',
        expect.any(Function)
      )
      expect(eventListeners.removeEventListener).toHaveBeenCalledWith(
        'offline',
        expect.any(Function)
      )
    })
  })
})

describe('Offline Storage Utilities', () => {
  let localStorageMock: {
    getItem: ReturnType<typeof vi.fn>
    setItem: ReturnType<typeof vi.fn>
    removeItem: ReturnType<typeof vi.fn>
    clear: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    }

    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true
    })

    Object.defineProperty(window, 'Object', {
      value: {
        ...Object,
        keys: vi.fn().mockReturnValue([])
      },
      writable: true
    })

    vi.clearAllMocks()
  })

  describe('saveToOfflineStorage', () => {
    it('should save data to localStorage with timestamp', () => {
      const testData = { message: 'Hello World' }
      const testKey = 'test-key'

      saveToOfflineStorage(testKey, testData)

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'offline_test-key',
        expect.stringContaining('"data":{"message":"Hello World"}')
      )
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'offline_test-key',
        expect.stringContaining('"timestamp":')
      )
    })

    it('should handle complex data structures', () => {
      const complexData = {
        array: [1, 2, 3],
        nested: { deep: { value: 'test' } },
        nullValue: null,
        boolValue: true
      }

      saveToOfflineStorage('complex', complexData)

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'offline_complex',
        expect.stringContaining('"array":[1,2,3]')
      )
    })

    it('should handle localStorage errors gracefully', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded')
      })

      expect(() => {
        saveToOfflineStorage('test', { data: 'test' })
      }).not.toThrow()

      expect(consoleError).toHaveBeenCalledWith(
        'Failed to save to offline storage:',
        expect.any(Error)
      )

      consoleError.mockRestore()
    })

    it('should handle null and undefined data', () => {
      saveToOfflineStorage('null-test', null)
      saveToOfflineStorage('undefined-test', undefined)

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'offline_null-test',
        expect.stringContaining('"data":null')
      )
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'offline_undefined-test',
        expect.stringContaining('"data":null')
      )
    })
  })

  describe('getFromOfflineStorage', () => {
    it('should retrieve and parse stored data', () => {
      const storedData = {
        data: { message: 'Hello World' },
        timestamp: Date.now()
      }

      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedData))

      const result = getFromOfflineStorage<{ message: string }>('test-key')

      expect(localStorageMock.getItem).toHaveBeenCalledWith('offline_test-key')
      expect(result).toEqual({ message: 'Hello World' })
    })

    it('should return null for non-existent keys', () => {
      localStorageMock.getItem.mockReturnValue(null)

      const result = getFromOfflineStorage('non-existent')

      expect(result).toBeNull()
    })

    it('should handle corrupted data gracefully', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      localStorageMock.getItem.mockReturnValue('invalid-json{')

      const result = getFromOfflineStorage('corrupted')

      expect(result).toBeNull()
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to get from offline storage:',
        expect.any(Error)
      )

      consoleError.mockRestore()
    })

    it('should handle localStorage errors gracefully', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('Storage access denied')
      })

      const result = getFromOfflineStorage('error-test')

      expect(result).toBeNull()
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to get from offline storage:',
        expect.any(Error)
      )

      consoleError.mockRestore()
    })

    it('should return correct type', () => {
      const storedData = {
        data: { count: 42, items: ['a', 'b', 'c'] },
        timestamp: Date.now()
      }

      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedData))

      const result = getFromOfflineStorage<{ count: number; items: string[] }>('typed-test')

      expect(result).toEqual({ count: 42, items: ['a', 'b', 'c'] })
      expect(typeof result?.count).toBe('number')
      expect(Array.isArray(result?.items)).toBe(true)
    })
  })

  describe('clearOfflineStorage', () => {
    it('should clear specific key when provided', () => {
      clearOfflineStorage('specific-key')

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('offline_specific-key')
    })

    it('should clear all offline data when no key provided', () => {
      const mockKeys = ['offline_key1', 'offline_key2', 'other_key', 'offline_key3']
      Object.keys = vi.fn().mockReturnValue(mockKeys)

      clearOfflineStorage()

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('offline_key1')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('offline_key2')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('offline_key3')
      expect(localStorageMock.removeItem).not.toHaveBeenCalledWith('other_key')
      expect(localStorageMock.removeItem).toHaveBeenCalledTimes(3)
    })

    it('should handle localStorage errors gracefully', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      localStorageMock.removeItem.mockImplementation(() => {
        throw new Error('Storage access denied')
      })

      expect(() => {
        clearOfflineStorage('error-key')
      }).not.toThrow()

      expect(consoleError).toHaveBeenCalledWith(
        'Failed to clear offline storage:',
        expect.any(Error)
      )

      consoleError.mockRestore()
    })

    it('should handle Object.keys errors gracefully', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      Object.keys = vi.fn().mockImplementation(() => {
        throw new Error('Keys access denied')
      })

      expect(() => {
        clearOfflineStorage()
      }).not.toThrow()

      expect(consoleError).toHaveBeenCalledWith(
        'Failed to clear offline storage:',
        expect.any(Error)
      )

      consoleError.mockRestore()
    })
  })

  describe('Offline Storage Integration', () => {
    it('should work with save-retrieve-clear cycle', () => {
      const testData = { message: 'Integration Test', value: 123 }

      // Save data
      saveToOfflineStorage('integration', testData)

      // Mock the stored data retrieval
      const storedCall = localStorageMock.setItem.mock.calls[0]
      const storedJson = storedCall[1]
      localStorageMock.getItem.mockReturnValue(storedJson)

      // Retrieve data
      const retrieved = getFromOfflineStorage<typeof testData>('integration')
      expect(retrieved).toEqual(testData)

      // Clear data
      clearOfflineStorage('integration')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('offline_integration')
    })

    it('should handle multiple keys correctly', () => {
      const data1 = { type: 'document', id: 1 }
      const data2 = { type: 'user', id: 2 }

      saveToOfflineStorage('doc1', data1)
      saveToOfflineStorage('user1', data2)

      // Mock Object.keys to return our keys
      Object.keys = vi.fn().mockReturnValue(['offline_doc1', 'offline_user1', 'other_key'])

      clearOfflineStorage()

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('offline_doc1')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('offline_user1')
      expect(localStorageMock.removeItem).not.toHaveBeenCalledWith('other_key')
    })
  })
})