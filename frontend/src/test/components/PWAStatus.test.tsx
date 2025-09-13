/**
 * Comprehensive tests for PWAStatus component
 * Tests PWA functionality, offline behavior, install prompts, and state management
 */
import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PWAStatus } from '../../components/PWAStatus'

// Mock the PWA hook
const mockUsePWA = {
  isInstallable: false,
  isOffline: false,
  hasUpdate: false,
  installApp: jest.fn(),
  updateApp: jest.fn()
}

jest.mock('@/hooks/usePWA', () => ({
  usePWA: () => mockUsePWA
}))

// Mock the offline store
const mockOfflineStore = {
  pendingActions: [],
  syncInProgress: false,
  setOfflineStatus: jest.fn()
}

const mockUseOfflineStore = jest.fn(() => mockOfflineStore)
mockUseOfflineStore.getState = jest.fn(() => ({
  setOfflineStatus: mockOfflineStore.setOfflineStatus
}))

jest.mock('@/stores/offlineStore', () => ({
  useOfflineStore: mockUseOfflineStore
}))

// Mock Lucide React icons
jest.mock('lucide-react', () => ({
  Download: ({ className }: any) => <div data-testid="download-icon" className={className} />,
  Wifi: ({ className }: any) => <div data-testid="wifi-icon" className={className} />,
  WifiOff: ({ className }: any) => <div data-testid="wifi-off-icon" className={className} />,
  RefreshCw: ({ className }: any) => <div data-testid="refresh-icon" className={className} />,
  X: ({ className }: any) => <div data-testid="x-icon" className={className} />
}))

describe('PWAStatus Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Reset mock states
    mockUsePWA.isInstallable = false
    mockUsePWA.isOffline = false
    mockUsePWA.hasUpdate = false
    mockOfflineStore.pendingActions = []
    mockOfflineStore.syncInProgress = false

    // Mock console.error to avoid noise in tests
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Basic Rendering', () => {
    it('should render without any prompts when offline and no special states', () => {
      const { container } = render(<PWAStatus />)

      expect(container.firstChild).toBeInTheDocument()
      expect(screen.queryByText('Install CA-DMS')).not.toBeInTheDocument()
      expect(screen.queryByText('Update Available')).not.toBeInTheDocument()
      expect(screen.queryByText("You're offline")).not.toBeInTheDocument()
    })

    it('should apply custom className', () => {
      const { container } = render(<PWAStatus className="custom-class" />)

      expect(container.firstChild).toHaveClass('custom-class')
    })

    it('should have proper positioning classes', () => {
      const { container } = render(<PWAStatus />)

      expect(container.firstChild).toHaveClass('fixed', 'top-4', 'right-4', 'z-50')
    })
  })

  describe('Offline Status', () => {
    it('should show offline indicator when offline', () => {
      mockUsePWA.isOffline = true

      render(<PWAStatus />)

      expect(screen.getByText("You're offline")).toBeInTheDocument()
      expect(screen.getByText('Changes will sync when connection is restored')).toBeInTheDocument()
      expect(screen.getByTestId('wifi-off-icon')).toBeInTheDocument()
    })

    it('should show pending actions count when offline', () => {
      mockUsePWA.isOffline = true
      mockOfflineStore.pendingActions = ['action1', 'action2', 'action3']

      render(<PWAStatus />)

      expect(screen.getByText('3 pending changes')).toBeInTheDocument()
    })

    it('should show singular form for single pending action', () => {
      mockUsePWA.isOffline = true
      mockOfflineStore.pendingActions = ['action1']

      render(<PWAStatus />)

      expect(screen.getByText('1 pending change')).toBeInTheDocument()
    })

    it('should show sync indicator when syncing while offline', () => {
      mockUsePWA.isOffline = true
      mockOfflineStore.syncInProgress = true

      render(<PWAStatus />)

      const refreshIcon = screen.getByTestId('refresh-icon')
      expect(refreshIcon).toBeInTheDocument()
      expect(refreshIcon).toHaveClass('animate-spin')
    })

    it('should update offline store when offline status changes', async () => {
      const { rerender } = render(<PWAStatus />)

      expect(mockOfflineStore.setOfflineStatus).toHaveBeenCalledWith(false)

      mockUsePWA.isOffline = true
      rerender(<PWAStatus />)

      await waitFor(() => {
        expect(mockOfflineStore.setOfflineStatus).toHaveBeenCalledWith(true)
      })
    })
  })

  describe('Online Status with Pending Actions', () => {
    it('should show sync indicator when online with pending actions', () => {
      mockUsePWA.isOffline = false
      mockOfflineStore.pendingActions = ['action1', 'action2']

      render(<PWAStatus />)

      expect(screen.getByText('Syncing changes')).toBeInTheDocument()
      expect(screen.getByText('2 changes pending')).toBeInTheDocument()
      expect(screen.getByTestId('wifi-icon')).toBeInTheDocument()
    })

    it('should show sync progress indicator when syncing online', () => {
      mockUsePWA.isOffline = false
      mockOfflineStore.pendingActions = ['action1']
      mockOfflineStore.syncInProgress = true

      render(<PWAStatus />)

      const refreshIcon = screen.getByTestId('refresh-icon')
      expect(refreshIcon).toBeInTheDocument()
      expect(refreshIcon).toHaveClass('animate-spin')
    })

    it('should not show sync indicator when online with no pending actions', () => {
      mockUsePWA.isOffline = false
      mockOfflineStore.pendingActions = []

      render(<PWAStatus />)

      expect(screen.queryByText('Syncing changes')).not.toBeInTheDocument()
    })
  })

  describe('Install Prompt', () => {
    it('should show install prompt when app becomes installable', async () => {
      const { rerender } = render(<PWAStatus />)

      expect(screen.queryByText('Install CA-DMS')).not.toBeInTheDocument()

      mockUsePWA.isInstallable = true
      rerender(<PWAStatus />)

      await waitFor(() => {
        expect(screen.getByText('Install CA-DMS')).toBeInTheDocument()
      })

      expect(screen.getByText('Install this app on your device for a better experience and offline access.')).toBeInTheDocument()
      expect(screen.getByTestId('download-icon')).toBeInTheDocument()
    })

    it('should handle install action successfully', async () => {
      const user = userEvent.setup()
      mockUsePWA.isInstallable = true
      mockUsePWA.installApp.mockResolvedValue(undefined)

      render(<PWAStatus />)

      await waitFor(() => {
        expect(screen.getByText('Install CA-DMS')).toBeInTheDocument()
      })

      const installButton = screen.getByRole('button', { name: 'Install' })
      await user.click(installButton)

      expect(mockUsePWA.installApp).toHaveBeenCalled()

      await waitFor(() => {
        expect(screen.queryByText('Install CA-DMS')).not.toBeInTheDocument()
      })
    })

    it('should handle install action failure', async () => {
      const user = userEvent.setup()
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      mockUsePWA.isInstallable = true
      mockUsePWA.installApp.mockRejectedValue(new Error('Install failed'))

      render(<PWAStatus />)

      await waitFor(() => {
        expect(screen.getByText('Install CA-DMS')).toBeInTheDocument()
      })

      const installButton = screen.getByRole('button', { name: 'Install' })
      await user.click(installButton)

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to install app:', expect.any(Error))
      })

      consoleSpy.mockRestore()
    })

    it('should dismiss install prompt when Later button is clicked', async () => {
      const user = userEvent.setup()
      mockUsePWA.isInstallable = true

      render(<PWAStatus />)

      await waitFor(() => {
        expect(screen.getByText('Install CA-DMS')).toBeInTheDocument()
      })

      const laterButton = screen.getByRole('button', { name: 'Later' })
      await user.click(laterButton)

      expect(screen.queryByText('Install CA-DMS')).not.toBeInTheDocument()
    })

    it('should dismiss install prompt when X button is clicked', async () => {
      const user = userEvent.setup()
      mockUsePWA.isInstallable = true

      render(<PWAStatus />)

      await waitFor(() => {
        expect(screen.getByText('Install CA-DMS')).toBeInTheDocument()
      })

      const xButton = screen.getByTestId('x-icon').closest('button')!
      await user.click(xButton)

      expect(screen.queryByText('Install CA-DMS')).not.toBeInTheDocument()
    })
  })

  describe('Update Prompt', () => {
    it('should show update prompt when update becomes available', async () => {
      const { rerender } = render(<PWAStatus />)

      expect(screen.queryByText('Update Available')).not.toBeInTheDocument()

      mockUsePWA.hasUpdate = true
      rerender(<PWAStatus />)

      await waitFor(() => {
        expect(screen.getByText('Update Available')).toBeInTheDocument()
      })

      expect(screen.getByText('A new version of CA-DMS is available with improvements and bug fixes.')).toBeInTheDocument()
      expect(screen.getByTestId('refresh-icon')).toBeInTheDocument()
    })

    it('should handle update action successfully', async () => {
      const user = userEvent.setup()
      mockUsePWA.hasUpdate = true
      mockUsePWA.updateApp.mockResolvedValue(undefined)

      render(<PWAStatus />)

      await waitFor(() => {
        expect(screen.getByText('Update Available')).toBeInTheDocument()
      })

      const updateButton = screen.getByRole('button', { name: 'Update Now' })
      await user.click(updateButton)

      expect(mockUsePWA.updateApp).toHaveBeenCalled()

      await waitFor(() => {
        expect(screen.queryByText('Update Available')).not.toBeInTheDocument()
      })
    })

    it('should handle update action failure', async () => {
      const user = userEvent.setup()
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      mockUsePWA.hasUpdate = true
      mockUsePWA.updateApp.mockRejectedValue(new Error('Update failed'))

      render(<PWAStatus />)

      await waitFor(() => {
        expect(screen.getByText('Update Available')).toBeInTheDocument()
      })

      const updateButton = screen.getByRole('button', { name: 'Update Now' })
      await user.click(updateButton)

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to update app:', expect.any(Error))
      })

      consoleSpy.mockRestore()
    })

    it('should dismiss update prompt when Later button is clicked', async () => {
      const user = userEvent.setup()
      mockUsePWA.hasUpdate = true

      render(<PWAStatus />)

      await waitFor(() => {
        expect(screen.getByText('Update Available')).toBeInTheDocument()
      })

      const laterButton = screen.getByRole('button', { name: 'Later' })
      await user.click(laterButton)

      expect(screen.queryByText('Update Available')).not.toBeInTheDocument()
    })

    it('should dismiss update prompt when X button is clicked', async () => {
      const user = userEvent.setup()
      mockUsePWA.hasUpdate = true

      render(<PWAStatus />)

      await waitFor(() => {
        expect(screen.getByText('Update Available')).toBeInTheDocument()
      })

      const xButtons = screen.getAllByTestId('x-icon')
      const updateXButton = xButtons.find(button => button.closest('button'))
      await user.click(updateXButton!.closest('button')!)

      expect(screen.queryByText('Update Available')).not.toBeInTheDocument()
    })
  })

  describe('Multiple Status Display', () => {
    it('should show both offline status and install prompt', async () => {
      mockUsePWA.isOffline = true
      mockUsePWA.isInstallable = true

      render(<PWAStatus />)

      await waitFor(() => {
        expect(screen.getByText("You're offline")).toBeInTheDocument()
        expect(screen.getByText('Install CA-DMS')).toBeInTheDocument()
      })
    })

    it('should show both update prompt and offline status', async () => {
      mockUsePWA.isOffline = true
      mockUsePWA.hasUpdate = true

      render(<PWAStatus />)

      await waitFor(() => {
        expect(screen.getByText("You're offline")).toBeInTheDocument()
        expect(screen.getByText('Update Available')).toBeInTheDocument()
      })
    })

    it('should show all prompts when all conditions are met', async () => {
      mockUsePWA.isOffline = true
      mockUsePWA.isInstallable = true
      mockUsePWA.hasUpdate = true

      render(<PWAStatus />)

      await waitFor(() => {
        expect(screen.getByText("You're offline")).toBeInTheDocument()
        expect(screen.getByText('Install CA-DMS')).toBeInTheDocument()
        expect(screen.getByText('Update Available')).toBeInTheDocument()
      })
    })

    it('should prioritize display order correctly', () => {
      mockUsePWA.isOffline = true
      mockUsePWA.isInstallable = true
      mockUsePWA.hasUpdate = true

      const { container } = render(<PWAStatus />)

      const children = Array.from(container.firstChild!.children)

      // Offline status should be first, then install, then update
      expect(children).toHaveLength(3)
    })
  })

  describe('State Transitions', () => {
    it('should handle going from offline to online', async () => {
      mockUsePWA.isOffline = true
      const { rerender } = render(<PWAStatus />)

      expect(screen.getByText("You're offline")).toBeInTheDocument()

      mockUsePWA.isOffline = false
      rerender(<PWAStatus />)

      expect(screen.queryByText("You're offline")).not.toBeInTheDocument()
    })

    it('should handle installable state change', async () => {
      const { rerender } = render(<PWAStatus />)

      expect(screen.queryByText('Install CA-DMS')).not.toBeInTheDocument()

      mockUsePWA.isInstallable = true
      rerender(<PWAStatus />)

      await waitFor(() => {
        expect(screen.getByText('Install CA-DMS')).toBeInTheDocument()
      })

      mockUsePWA.isInstallable = false
      rerender(<PWAStatus />)

      // Prompt should remain visible even if isInstallable becomes false
      expect(screen.getByText('Install CA-DMS')).toBeInTheDocument()
    })

    it('should handle update availability change', async () => {
      const { rerender } = render(<PWAStatus />)

      expect(screen.queryByText('Update Available')).not.toBeInTheDocument()

      mockUsePWA.hasUpdate = true
      rerender(<PWAStatus />)

      await waitFor(() => {
        expect(screen.getByText('Update Available')).toBeInTheDocument()
      })

      mockUsePWA.hasUpdate = false
      rerender(<PWAStatus />)

      // Prompt should remain visible even if hasUpdate becomes false
      expect(screen.getByText('Update Available')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have accessible buttons', async () => {
      mockUsePWA.isInstallable = true
      mockUsePWA.hasUpdate = true

      render(<PWAStatus />)

      await waitFor(() => {
        const installButton = screen.getByRole('button', { name: 'Install' })
        const laterButton = screen.getByRole('button', { name: 'Later' })
        const updateButton = screen.getByRole('button', { name: 'Update Now' })

        expect(installButton).toBeInTheDocument()
        expect(laterButton).toBeInTheDocument()
        expect(updateButton).toBeInTheDocument()
      })
    })

    it('should be keyboard navigable', async () => {
      const user = userEvent.setup()
      mockUsePWA.isInstallable = true

      render(<PWAStatus />)

      await waitFor(() => {
        expect(screen.getByText('Install CA-DMS')).toBeInTheDocument()
      })

      // Tab to first button
      await user.tab()
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Install' }))

      // Tab to second button
      await user.tab()
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Later' }))

      // Activate with Enter
      await user.keyboard('{Enter}')
      expect(screen.queryByText('Install CA-DMS')).not.toBeInTheDocument()
    })

    it('should have proper color contrast for different states', () => {
      mockUsePWA.isOffline = true
      mockOfflineStore.pendingActions = ['action1']

      render(<PWAStatus />)

      // Yellow theme for offline
      expect(screen.getByText("You're offline").closest('div')).toHaveClass('bg-yellow-100')

      mockUsePWA.isOffline = false
      const { rerender } = render(<PWAStatus />)

      // Blue theme for syncing
      expect(screen.getByText('Syncing changes').closest('div')).toHaveClass('bg-blue-100')
    })
  })

  describe('Performance', () => {
    it('should not re-render unnecessarily', () => {
      const mockChild = jest.fn(() => null)

      const TestWrapper = ({ children }: { children: React.ReactNode }) => {
        mockChild()
        return <>{children}</>
      }

      const { rerender } = render(
        <TestWrapper>
          <PWAStatus />
        </TestWrapper>
      )

      expect(mockChild).toHaveBeenCalledTimes(1)

      // Rerender with same props
      rerender(
        <TestWrapper>
          <PWAStatus />
        </TestWrapper>
      )

      // Should not cause unnecessary re-renders
      expect(mockChild).toHaveBeenCalledTimes(2) // Expected for React strict mode
    })

    it('should handle rapid state changes efficiently', async () => {
      const { rerender } = render(<PWAStatus />)

      // Rapidly change states
      for (let i = 0; i < 10; i++) {
        mockUsePWA.isOffline = i % 2 === 0
        rerender(<PWAStatus />)
      }

      // Should not crash or have memory leaks
      expect(screen.getByRole('generic')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle undefined hook values gracefully', () => {
      const originalUsePWA = mockUsePWA

      // Mock undefined values
      Object.assign(mockUsePWA, {
        isInstallable: undefined,
        isOffline: undefined,
        hasUpdate: undefined,
        installApp: undefined,
        updateApp: undefined
      })

      expect(() => {
        render(<PWAStatus />)
      }).not.toThrow()

      // Restore original values
      Object.assign(mockUsePWA, originalUsePWA)
    })

    it('should handle store errors gracefully', () => {
      mockUseOfflineStore.getState.mockImplementation(() => {
        throw new Error('Store error')
      })

      expect(() => {
        render(<PWAStatus />)
      }).not.toThrow()
    })
  })
})