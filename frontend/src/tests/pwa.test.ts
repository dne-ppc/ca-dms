import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePWA } from '../hooks/usePWA'
import { useOfflineStore } from '../stores/offlineStore'

// Mock service worker and push manager
const mockServiceWorker = {
  ready: Promise.resolve({
    pushManager: {
      getSubscription: vi.fn(),
      subscribe: vi.fn()
    }
  })
}

const mockWorkbox = {
  addEventListener: vi.fn(),
  register: vi.fn(),
  messageSkipWaiting: vi.fn()
}

// Mock global objects
beforeEach(() => {
  vi.clearAllMocks()
  
  // Mock navigator
  Object.defineProperty(global.navigator, 'serviceWorker', {
    value: mockServiceWorker,
    writable: true
  })
  
  Object.defineProperty(global.navigator, 'onLine', {
    value: true,
    writable: true
  })

  // Mock Workbox
  vi.doMock('workbox-window', () => ({
    Workbox: vi.fn(() => mockWorkbox)
  }))

  // Mock window methods
  Object.defineProperty(global.window, 'matchMedia', {
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn()
    }))
  })
})

describe('PWA Functionality', () => {
  describe('usePWA Hook', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => usePWA())

      expect(result.current.isInstallable).toBe(false)
      expect(result.current.isInstalled).toBe(false)
      expect(result.current.isOffline).toBe(false)
      expect(result.current.hasUpdate).toBe(false)
    })

    it('should detect offline status', () => {
      // Mock offline status
      Object.defineProperty(global.navigator, 'onLine', {
        value: false,
        writable: true
      })

      const { result } = renderHook(() => usePWA())
      expect(result.current.isOffline).toBe(true)
    })

    it('should detect installed PWA', () => {
      // Mock standalone display mode
      Object.defineProperty(global.window, 'matchMedia', {
        value: vi.fn().mockImplementation(query => {
          if (query === '(display-mode: standalone)') {
            return { matches: true }
          }
          return { matches: false }
        })
      })

      const { result } = renderHook(() => usePWA())
      expect(result.current.isInstalled).toBe(true)
    })

    it('should handle install prompt', async () => {
      const mockPrompt = {
        prompt: vi.fn().mockResolvedValue(undefined),
        userChoice: Promise.resolve({ outcome: 'accepted' })
      }

      const { result } = renderHook(() => usePWA())

      // Simulate beforeinstallprompt event
      act(() => {
        const event = new Event('beforeinstallprompt')
        Object.assign(event, mockPrompt)
        window.dispatchEvent(event)
      })

      expect(result.current.isInstallable).toBe(true)

      // Test install functionality
      await act(async () => {
        await result.current.installApp()
      })

      expect(mockPrompt.prompt).toHaveBeenCalled()
    })
  })

  describe('Offline Store', () => {
    it('should manage offline documents', () => {
      const store = useOfflineStore.getState()
      const testDocument = {
        id: '1',
        title: 'Test Document',
        content: 'Test content',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      // Add document
      act(() => {
        store.addDocument(testDocument)
      })

      const storedDoc = store.getDocument('1')
      expect(storedDoc).toBeDefined()
      expect(storedDoc?.title).toBe('Test Document')
      expect(storedDoc?.localChanges).toBe(false)
    })

    it('should queue actions when offline', () => {
      const store = useOfflineStore.getState()

      act(() => {
        store.setOfflineStatus(true)
        store.updateDocument('1', { title: 'Updated Title' })
      })

      expect(store.isOffline).toBe(true)
      expect(store.pendingActions).toHaveLength(1)
      expect(store.pendingActions[0].type).toBe('update')
    })

    it('should handle sync operations', () => {
      const store = useOfflineStore.getState()

      act(() => {
        store.queueAction({
          type: 'create',
          documentId: '1',
          data: { title: 'New Document' }
        })
        store.startSync()
      })

      expect(store.syncInProgress).toBe(true)

      act(() => {
        store.markActionSynced(store.pendingActions[0].id)
        store.endSync(true)
      })

      expect(store.syncInProgress).toBe(false)
      expect(store.lastSyncTime).toBeDefined()
    })

    it('should manage conflict resolution', () => {
      const store = useOfflineStore.getState()

      act(() => {
        store.addDocument({
          id: '1',
          title: 'Test Document',
          content: 'Original content',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        store.markConflict('1')
      })

      const doc = store.getDocument('1')
      expect(doc?.conflictStatus).toBe('pending')

      act(() => {
        store.resolveConflict('1', 'local')
      })

      const resolvedDoc = store.getDocument('1')
      expect(resolvedDoc?.conflictStatus).toBe('resolved')
      expect(resolvedDoc?.localChanges).toBe(true)
    })
  })

  describe('PWA Storage Management', () => {
    it('should calculate storage size', () => {
      const store = useOfflineStore.getState()

      act(() => {
        store.addDocument({
          id: '1',
          title: 'Test Document',
          content: 'Test content',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      })

      const size = store.getStorageSize()
      expect(size).toBeGreaterThan(0)
    })

    it('should clear offline data', () => {
      const store = useOfflineStore.getState()

      act(() => {
        store.addDocument({
          id: '1',
          title: 'Test Document',
          content: 'Test content',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        store.queueAction({
          type: 'create',
          documentId: '1',
          data: {}
        })
      })

      expect(store.documents).toHaveLength(1)
      expect(store.pendingActions).toHaveLength(1)

      act(() => {
        store.clearOfflineData()
      })

      expect(store.documents).toHaveLength(0)
      expect(store.pendingActions).toHaveLength(0)
    })
  })

  describe('Service Worker Integration', () => {
    it('should register service worker', () => {
      renderHook(() => usePWA())
      expect(mockWorkbox.register).toHaveBeenCalled()
    })

    it('should handle service worker updates', () => {
      const { result } = renderHook(() => usePWA())

      // Simulate service worker waiting event
      act(() => {
        const waitingCallback = mockWorkbox.addEventListener.mock.calls
          .find(call => call[0] === 'waiting')?.[1]
        waitingCallback?.()
      })

      expect(result.current.hasUpdate).toBe(true)
    })

    it('should skip waiting on update', async () => {
      const { result } = renderHook(() => usePWA())

      await act(async () => {
        await result.current.updateApp()
      })

      expect(mockWorkbox.messageSkipWaiting).toHaveBeenCalled()
    })
  })
})