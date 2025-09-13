import { useState, useEffect } from 'react'
import { Download, Wifi, WifiOff, RefreshCw, X } from 'lucide-react'
import { usePWA } from '@/hooks/usePWA'
import { useOfflineStore } from '@/stores/offlineStore'

interface PWAStatusProps {
  className?: string
}

export const PWAStatus = ({ className = '' }: PWAStatusProps) => {
  const { isInstallable, isOffline, hasUpdate, installApp, updateApp } = usePWA()
  const { pendingActions, syncInProgress } = useOfflineStore()
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false)

  // Show install prompt when app becomes installable
  useEffect(() => {
    if (isInstallable) {
      setShowInstallPrompt(true)
    }
  }, [isInstallable])

  // Show update prompt when update is available
  useEffect(() => {
    if (hasUpdate) {
      setShowUpdatePrompt(true)
    }
  }, [hasUpdate])

  // Update offline store when offline status changes
  useEffect(() => {
    useOfflineStore.getState().setOfflineStatus(isOffline)
  }, [isOffline])

  const handleInstall = async () => {
    try {
      await installApp()
      setShowInstallPrompt(false)
    } catch (error) {
      console.error('Failed to install app:', error)
    }
  }

  const handleUpdate = async () => {
    try {
      await updateApp()
      setShowUpdatePrompt(false)
    } catch (error) {
      console.error('Failed to update app:', error)
    }
  }

  return (
    <div className={`fixed top-4 right-4 z-50 space-y-2 ${className}`}>
      {/* Offline Status Indicator */}
      {isOffline && (
        <div className="bg-yellow-100 border border-yellow-200 rounded-lg p-3 shadow-lg max-w-sm">
          <div className="flex items-center space-x-2">
            <WifiOff className="h-5 w-5 text-yellow-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-800">
                You're offline
              </p>
              <p className="text-xs text-yellow-700">
                Changes will sync when connection is restored
              </p>
              {pendingActions.length > 0 && (
                <p className="text-xs text-yellow-600 mt-1">
                  {pendingActions.length} pending change{pendingActions.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
            {syncInProgress && (
              <RefreshCw className="h-4 w-4 text-yellow-600 animate-spin" />
            )}
          </div>
        </div>
      )}

      {/* Online Status with Sync Indicator */}
      {!isOffline && pendingActions.length > 0 && (
        <div className="bg-blue-100 border border-blue-200 rounded-lg p-3 shadow-lg max-w-sm">
          <div className="flex items-center space-x-2">
            <Wifi className="h-5 w-5 text-blue-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-800">
                Syncing changes
              </p>
              <p className="text-xs text-blue-700">
                {pendingActions.length} change{pendingActions.length !== 1 ? 's' : ''} pending
              </p>
            </div>
            {syncInProgress && (
              <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />
            )}
          </div>
        </div>
      )}

      {/* Install Prompt */}
      {showInstallPrompt && isInstallable && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-lg max-w-sm">
          <div className="flex items-start space-x-3">
            <Download className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-900">
                Install CA-DMS
              </h3>
              <p className="text-xs text-gray-600 mt-1">
                Install this app on your device for a better experience and offline access.
              </p>
              <div className="flex space-x-2 mt-3">
                <button
                  onClick={handleInstall}
                  className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 transition-colors"
                >
                  Install
                </button>
                <button
                  onClick={() => setShowInstallPrompt(false)}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-md hover:bg-gray-200 transition-colors"
                >
                  Later
                </button>
              </div>
            </div>
            <button
              onClick={() => setShowInstallPrompt(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Update Prompt */}
      {showUpdatePrompt && hasUpdate && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-lg max-w-sm">
          <div className="flex items-start space-x-3">
            <RefreshCw className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-900">
                Update Available
              </h3>
              <p className="text-xs text-gray-600 mt-1">
                A new version of CA-DMS is available with improvements and bug fixes.
              </p>
              <div className="flex space-x-2 mt-3">
                <button
                  onClick={handleUpdate}
                  className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-md hover:bg-green-700 transition-colors"
                >
                  Update Now
                </button>
                <button
                  onClick={() => setShowUpdatePrompt(false)}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-md hover:bg-gray-200 transition-colors"
                >
                  Later
                </button>
              </div>
            </div>
            <button
              onClick={() => setShowUpdatePrompt(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}