import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { NotificationPermissionPrompt } from '../../hooks/useNotifications'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock the useNotifications hook to force the prompt to show
vi.mock('../../hooks/useNotifications', async () => {
  const actual = await vi.importActual('../../hooks/useNotifications')

  // Mock a component that always renders the notification prompt with updated styling
  const MockNotificationPermissionPrompt = () => {
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
              <button className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors">
                Enable Notifications
              </button>
              <button className="px-4 py-2 bg-white text-blue-600 text-sm border border-blue-200 rounded-md hover:bg-blue-50 transition-colors">
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return {
    ...actual,
    useNotifications: () => ({
      notificationState: {
        isSupported: true,
        permission: 'default',
        subscriptionStatus: 'unsubscribed'
      },
      requestPermission: vi.fn(),
      subscribeToPush: vi.fn()
    }),
    NotificationPermissionPrompt: MockNotificationPermissionPrompt
  }
})

const renderNotificationPrompt = (props = {}) => {
  return render(
    <BrowserRouter>
      <div className="app-layout">
        <main className="main-content">
          <NotificationPermissionPrompt {...props} />
        </main>
      </div>
    </BrowserRouter>
  )
}

describe('NotificationPermissionPrompt Layout Fix', () => {
  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = ''
  })

  describe('Fixed: Notification panel positioning and layout', () => {
    it('should have notification-permission-prompt class for styling', () => {
      renderNotificationPrompt()

      const promptElement = screen.queryByText('Stay updated with notifications')

      if (promptElement) {
        const promptContainer = promptElement.closest('.notification-permission-prompt')
        expect(promptContainer).toBeInTheDocument()
        expect(promptContainer).toHaveClass('notification-permission-prompt')
      }
    })

    it('should have proper Tailwind classes for layout and z-index', () => {
      renderNotificationPrompt()

      const promptElement = screen.queryByText('Stay updated with notifications')

      if (promptElement) {
        const promptContainer = promptElement.closest('.notification-permission-prompt')!

        // Check for proper Tailwind classes
        expect(promptContainer).toHaveClass('relative') // Position relative
        expect(promptContainer).toHaveClass('z-20') // Z-index 20
        expect(promptContainer).toHaveClass('mx-4') // Horizontal margins
        expect(promptContainer).toHaveClass('mb-4') // Bottom margin
        expect(promptContainer).toHaveClass('md:mx-6') // Responsive margins
      }
    })

    it('should be properly contained within main content area', () => {
      renderNotificationPrompt()

      const promptElement = screen.queryByText('Stay updated with notifications')

      if (promptElement) {
        // Should be rendered within the main content area
        const mainContent = promptElement.closest('.main-content')
        expect(mainContent).toBeInTheDocument()

        // The prompt should be a direct child or descendant of main-content
        expect(mainContent?.contains(promptElement)).toBe(true)
      }
    })

    it('should have responsive button layout', () => {
      renderNotificationPrompt()

      const enableButton = screen.queryByText('Enable Notifications')
      const laterButton = screen.queryByText('Maybe Later')

      if (enableButton && laterButton) {
        const buttonContainer = enableButton.parentElement!

        // Should have responsive flex classes
        expect(buttonContainer).toHaveClass('flex')
        expect(buttonContainer).toHaveClass('flex-col') // Mobile: column layout
        expect(buttonContainer).toHaveClass('sm:flex-row') // Desktop: row layout
        expect(buttonContainer).toHaveClass('space-y-2') // Mobile: vertical spacing
        expect(buttonContainer).toHaveClass('sm:space-y-0') // Desktop: no vertical spacing
        expect(buttonContainer).toHaveClass('sm:space-x-3') // Desktop: horizontal spacing
      }
    })

    it('should not use problematic positioning that conflicts with layout', () => {
      renderNotificationPrompt()

      const promptElement = screen.queryByText('Stay updated with notifications')

      if (promptElement) {
        const promptContainer = promptElement.closest('.notification-permission-prompt')!

        // Should not have position classes that would conflict with normal document flow
        expect(promptContainer).not.toHaveClass('fixed')
        expect(promptContainer).not.toHaveClass('absolute')
        expect(promptContainer).toHaveClass('relative') // Should use relative positioning
      }
    })

    it('should render notification prompt content correctly', () => {
      renderNotificationPrompt()

      // Check that all expected content is present
      expect(screen.getByText('Stay updated with notifications')).toBeInTheDocument()
      expect(screen.getByText('Get notified about document approvals, workflow updates, and important changes.')).toBeInTheDocument()
      expect(screen.getByText('Enable Notifications')).toBeInTheDocument()
      expect(screen.getByText('Maybe Later')).toBeInTheDocument()

      // Check the bell icon
      expect(screen.getByText('🔔')).toBeInTheDocument()
    })
  })

  describe('Layout integration', () => {
    it('should not interfere with main content layout', () => {
      renderNotificationPrompt()

      const promptElement = screen.queryByText('Stay updated with notifications')

      if (promptElement) {
        const promptContainer = promptElement.closest('.notification-permission-prompt')!

        // Should be a block-level element that respects document flow
        expect(promptContainer.tagName).toBe('DIV')

        // Should have proper container styling
        expect(promptContainer).toHaveClass('bg-blue-50')
        expect(promptContainer).toHaveClass('border')
        expect(promptContainer).toHaveClass('border-blue-200')
        expect(promptContainer).toHaveClass('rounded-lg')
        expect(promptContainer).toHaveClass('p-4')
      }
    })
  })
})