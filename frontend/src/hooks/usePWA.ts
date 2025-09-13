import { useState, useEffect } from 'react'
import { Workbox } from 'workbox-window'

interface PWAInstallPrompt {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface PWAState {
  isInstallable: boolean
  isInstalled: boolean
  isOffline: boolean
  hasUpdate: boolean
  installApp: () => Promise<void>
  updateApp: () => Promise<void>
}

export const usePWA = (): PWAState => {
  const [isInstallable, setIsInstallable] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [hasUpdate, setHasUpdate] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<PWAInstallPrompt | null>(null)
  const [workbox, setWorkbox] = useState<Workbox | null>(null)

  useEffect(() => {
    // Check if app is already installed
    const checkInstallation = () => {
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true)
      }
    }

    // Handle install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as any)
      setIsInstallable(true)
    }

    // Handle online/offline status
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)

    // Initialize service worker
    const initializeServiceWorker = () => {
      if ('serviceWorker' in navigator) {
        const wb = new Workbox('/sw.js')
        
        // Handle service worker updates
        wb.addEventListener('waiting', () => {
          setHasUpdate(true)
        })

        wb.addEventListener('controlling', () => {
          window.location.reload()
        })

        // Register service worker
        wb.register()
        setWorkbox(wb)
      }
    }

    // Add event listeners
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    // Initialize
    checkInstallation()
    initializeServiceWorker()

    // Cleanup
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const installApp = async (): Promise<void> => {
    if (!installPrompt) return

    try {
      await installPrompt.prompt()
      const { outcome } = await installPrompt.userChoice
      
      if (outcome === 'accepted') {
        setIsInstalled(true)
        setIsInstallable(false)
        setInstallPrompt(null)
      }
    } catch (error) {
      console.error('Failed to install PWA:', error)
    }
  }

  const updateApp = async (): Promise<void> => {
    if (!workbox) return

    try {
      // Skip waiting and activate new service worker
      workbox.messageSkipWaiting()
      setHasUpdate(false)
    } catch (error) {
      console.error('Failed to update PWA:', error)
    }
  }

  return {
    isInstallable,
    isInstalled,
    isOffline,
    hasUpdate,
    installApp,
    updateApp
  }
}

// Utility functions for offline functionality
export const saveToOfflineStorage = (key: string, data: any): void => {
  try {
    localStorage.setItem(`offline_${key}`, JSON.stringify({
      data,
      timestamp: Date.now()
    }))
  } catch (error) {
    console.error('Failed to save to offline storage:', error)
  }
}

export const getFromOfflineStorage = <T>(key: string): T | null => {
  try {
    const stored = localStorage.getItem(`offline_${key}`)
    if (!stored) return null

    const parsed = JSON.parse(stored)
    return parsed.data as T
  } catch (error) {
    console.error('Failed to get from offline storage:', error)
    return null
  }
}

export const clearOfflineStorage = (key?: string): void => {
  try {
    if (key) {
      localStorage.removeItem(`offline_${key}`)
    } else {
      // Clear all offline data
      Object.keys(localStorage)
        .filter(k => k.startsWith('offline_'))
        .forEach(k => localStorage.removeItem(k))
    }
  } catch (error) {
    console.error('Failed to clear offline storage:', error)
  }
}