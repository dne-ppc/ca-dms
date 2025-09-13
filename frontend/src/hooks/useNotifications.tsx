import { useState, useEffect } from 'react'

interface NotificationState {
  permission: NotificationPermission
  isSupported: boolean
  subscriptionStatus: 'unknown' | 'subscribed' | 'unsubscribed'
}

interface PushNotificationHook {
  notificationState: NotificationState
  requestPermission: () => Promise<boolean>
  subscribeToPush: () => Promise<boolean>
  unsubscribeFromPush: () => Promise<boolean>
  sendTestNotification: (title: string, message: string) => void
}

export const useNotifications = (): PushNotificationHook => {
  const [notificationState, setNotificationState] = useState<NotificationState>({
    permission: 'default',
    isSupported: 'Notification' in window,
    subscriptionStatus: 'unknown'
  })

  useEffect(() => {
    // Check initial notification permission
    if ('Notification' in window) {
      setNotificationState(prev => ({
        ...prev,
        permission: Notification.permission
      }))

      // Check if service worker and push messaging is supported
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        checkSubscriptionStatus()
      }
    }
  }, [])

  const checkSubscriptionStatus = async () => {
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      
      setNotificationState(prev => ({
        ...prev,
        subscriptionStatus: subscription ? 'subscribed' : 'unsubscribed'
      }))
    } catch (error) {
      console.error('Error checking push subscription:', error)
      setNotificationState(prev => ({
        ...prev,
        subscriptionStatus: 'unsubscribed'
      }))
    }
  }

  const requestPermission = async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications')
      return false
    }

    try {
      const permission = await Notification.requestPermission()
      setNotificationState(prev => ({
        ...prev,
        permission
      }))

      return permission === 'granted'
    } catch (error) {
      console.error('Error requesting notification permission:', error)
      return false
    }
  }

  const subscribeToPush = async (): Promise<boolean> => {
    if (!('serviceWorker' in navigator && 'PushManager' in window)) {
      console.warn('Push messaging is not supported')
      return false
    }

    try {
      // Ensure notification permission is granted
      if (notificationState.permission !== 'granted') {
        const permitted = await requestPermission()
        if (!permitted) return false
      }

      const registration = await navigator.serviceWorker.ready
      
      // Check if already subscribed
      const existingSubscription = await registration.pushManager.getSubscription()
      if (existingSubscription) {
        setNotificationState(prev => ({
          ...prev,
          subscriptionStatus: 'subscribed'
        }))
        return true
      }

      // Create new subscription
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(getVapidPublicKey())
      })

      // Send subscription to backend
      await sendSubscriptionToBackend(subscription)

      setNotificationState(prev => ({
        ...prev,
        subscriptionStatus: 'subscribed'
      }))

      return true
    } catch (error) {
      console.error('Error subscribing to push notifications:', error)
      return false
    }
  }

  const unsubscribeFromPush = async (): Promise<boolean> => {
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        await subscription.unsubscribe()
        await removeSubscriptionFromBackend(subscription)
        
        setNotificationState(prev => ({
          ...prev,
          subscriptionStatus: 'unsubscribed'
        }))
        
        return true
      }
      
      return false
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error)
      return false
    }
  }

  const sendTestNotification = (title: string, message: string) => {
    if (notificationState.permission === 'granted') {
      new Notification(title, {
        body: message,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: 'test-notification',
        requireInteraction: false,
        timestamp: Date.now()
      })
    }
  }

  return {
    notificationState,
    requestPermission,
    subscribeToPush,
    unsubscribeFromPush,
    sendTestNotification
  }
}

// Utility functions
const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

const getVapidPublicKey = (): string => {
  // In a real application, this would come from your environment variables
  // For now, we'll use a placeholder key
  return 'BEl62iUYgUivxIkv69yViEuiBIa40HI80NuIc0K4XcUk7oUKQ7LcCwGArF2URBKhnGb4wNgpKCTNxJL4Q4Y4pJg'
}

const sendSubscriptionToBackend = async (subscription: PushSubscription) => {
  try {
    const response = await fetch('/api/v1/notifications/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscription: subscription.toJSON()
      })
    })

    if (!response.ok) {
      throw new Error('Failed to send subscription to backend')
    }
  } catch (error) {
    console.error('Error sending subscription to backend:', error)
    throw error
  }
}

const removeSubscriptionFromBackend = async (subscription: PushSubscription) => {
  try {
    const response = await fetch('/api/v1/notifications/push/unsubscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscription: subscription.toJSON()
      })
    })

    if (!response.ok) {
      throw new Error('Failed to remove subscription from backend')
    }
  } catch (error) {
    console.error('Error removing subscription from backend:', error)
    throw error
  }
}

// PWA notification component
export const NotificationPermissionPrompt = () => {
  const { notificationState, requestPermission, subscribeToPush } = useNotifications()
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    // Show prompt if notifications are supported but not enabled
    if (notificationState.isSupported && notificationState.permission === 'default') {
      setShowPrompt(true)
    }
  }, [notificationState])

  const handleEnable = async () => {
    const permitted = await requestPermission()
    if (permitted) {
      await subscribeToPush()
    }
    setShowPrompt(false)
  }

  if (!showPrompt || !notificationState.isSupported) {
    return null
  }

  return (
    <div className="notification-permission-prompt relative z-20 bg-blue-50 border border-blue-200 rounded-lg p-4 mx-4 mb-4 md:mx-6">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-blue-600 text-lg">🔔</span>
          </div>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-blue-900">
            Stay updated with notifications
          </h3>
          <p className="text-sm text-blue-700 mt-1">
            Get notified about document approvals, workflow updates, and important changes.
          </p>
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 mt-3">
            <button
              onClick={handleEnable}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
            >
              Enable Notifications
            </button>
            <button
              onClick={() => setShowPrompt(false)}
              className="px-4 py-2 bg-white text-blue-600 text-sm border border-blue-200 rounded-md hover:bg-blue-50 transition-colors"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}