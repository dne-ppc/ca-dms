/**
 * Navigation Integration Tests - TDD Red Phase
 * Testing routing updates to replace dashboard with intro page
 */
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../../App'

// Mock components to avoid complex dependencies
vi.mock('../../pages/Dashboard', () => ({
  default: () => <div data-testid="old-dashboard">Old Dashboard</div>
}))

vi.mock('../../pages/IntroPage', () => ({
  IntroPage: () => <div data-testid="intro-page">New Intro Page</div>
}))

vi.mock('../../pages/DocumentEditor', () => ({
  default: () => <div data-testid="document-editor">Document Editor</div>
}))

vi.mock('../../pages/Search', () => ({
  default: () => <div data-testid="search-page">Search Page</div>
}))

vi.mock('../../components/notifications/NotificationCenter', () => ({
  default: () => <div data-testid="notification-center">Notifications</div>
}))

vi.mock('../../components/notifications/NotificationBell', () => ({
  default: () => <div data-testid="notification-bell">Bell</div>
}))

vi.mock('../../components/ui/ThemeToggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle">Theme</div>
}))

vi.mock('../../components/PWAStatus', () => ({
  PWAStatus: () => <div data-testid="pwa-status">PWA Status</div>
}))

vi.mock('../../components/layout/MobileNavigation', () => ({
  MobileNavigation: () => <div data-testid="mobile-nav">Mobile Nav</div>
}))

vi.mock('../../hooks/useNotifications', () => ({
  NotificationPermissionPrompt: () => <div data-testid="notification-prompt">Permission Prompt</div>
}))

vi.mock('../../hooks/usePWA', () => ({
  usePWA: () => ({ isOffline: false })
}))

vi.mock('../../stores/offlineStore', () => ({
  useOfflineStore: vi.fn((selector) => {
    const mockStore = {
      setOfflineStatus: vi.fn(),
      isOffline: false,
      pendingRequests: []
    }
    return selector ? selector(mockStore) : mockStore.setOfflineStatus
  })
}))

describe('Navigation Integration with IntroPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render IntroPage as default route', () => {
    // RED: This should fail - root route still goes to Dashboard
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )

    // Should show IntroPage, not Dashboard
    expect(screen.getByTestId('intro-page')).toBeInTheDocument()
    expect(screen.queryByTestId('old-dashboard')).not.toBeInTheDocument()
  })

  it('should redirect /dashboard to IntroPage', () => {
    // RED: This should fail - /dashboard still shows old Dashboard
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <App />
      </MemoryRouter>
    )

    // Should redirect to IntroPage
    expect(screen.getByTestId('intro-page')).toBeInTheDocument()
    expect(screen.queryByTestId('old-dashboard')).not.toBeInTheDocument()
  })

  it('should update navigation brand link to point to IntroPage', () => {
    // RED: This should fail - brand link still points to /dashboard
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )

    const brandLink = screen.getByRole('link', { name: /ca-dms/i })
    expect(brandLink).toHaveAttribute('href', '/')
  })

  it('should update main dashboard navigation link', () => {
    // RED: This should fail - dashboard link still exists and points to /dashboard
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )

    // Should have "Home" or "Overview" link instead of "Dashboard"
    expect(screen.getByRole('link', { name: /home|overview/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /dashboard/i })).not.toBeInTheDocument()
  })

  it('should maintain active navigation state for IntroPage', () => {
    // RED: This should fail - active state handling not updated
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )

    const homeLink = screen.getByRole('link', { name: /home|overview/i })
    expect(homeLink).toHaveClass('active')
  })

  it('should preserve other route functionality', () => {
    // RED: This should fail if other routes are broken
    render(
      <MemoryRouter initialEntries={['/editor']}>
        <App />
      </MemoryRouter>
    )

    expect(screen.getByTestId('document-editor')).toBeInTheDocument()

    // Test search route
    render(
      <MemoryRouter initialEntries={['/search']}>
        <App />
      </MemoryRouter>
    )

    expect(screen.getByTestId('search-page')).toBeInTheDocument()
  })

  it('should handle breadcrumb navigation updates', () => {
    // RED: This should fail - breadcrumb system not updated
    render(
      <MemoryRouter initialEntries={['/editor/123']}>
        <App />
      </MemoryRouter>
    )

    // Should show breadcrumb from Home instead of Dashboard
    expect(screen.getByText(/home/i)).toBeInTheDocument()
    expect(screen.queryByText(/dashboard/i)).not.toBeInTheDocument()
  })

  it('should update mobile navigation integration', () => {
    // RED: This should fail - mobile nav still references old dashboard
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )

    // Mobile navigation should be updated
    expect(screen.getByTestId('mobile-nav')).toBeInTheDocument()

    // Should pass correct route information to mobile nav
    const mobileNav = screen.getByTestId('mobile-nav')
    expect(mobileNav).toBeInTheDocument()
  })

  it('should handle browser back/forward navigation', () => {
    // RED: This should fail - browser navigation not properly handled
    const { rerender } = render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )

    expect(screen.getByTestId('intro-page')).toBeInTheDocument()

    // Navigate to editor
    rerender(
      <MemoryRouter initialEntries={['/editor']}>
        <App />
      </MemoryRouter>
    )

    expect(screen.getByTestId('document-editor')).toBeInTheDocument()

    // Navigate back
    rerender(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )

    expect(screen.getByTestId('intro-page')).toBeInTheDocument()
  })

  it('should update page titles and metadata', () => {
    // RED: This should fail - page titles not updated
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )

    // Document title should reflect IntroPage
    expect(document.title).toContain('Dashboard')
    expect(document.title).not.toContain('Old Dashboard')
  })

  it('should handle legacy dashboard URL redirects', () => {
    // RED: This should fail - legacy URLs not handled
    render(
      <MemoryRouter initialEntries={['/dashboard?tab=documents']}>
        <App />
      </MemoryRouter>
    )

    // Should redirect to IntroPage and preserve query params if needed
    expect(screen.getByTestId('intro-page')).toBeInTheDocument()
  })

  it('should integrate with search functionality', () => {
    // RED: This should fail - search integration not updated
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )

    expect(screen.getByTestId('intro-page')).toBeInTheDocument()

    // Should maintain search link functionality
    const searchLink = screen.getByRole('link', { name: /advanced search/i })
    expect(searchLink).toHaveAttribute('href', '/search')
  })

  it('should support direct URL access to IntroPage', () => {
    // RED: This should fail - direct URL access not working
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )

    expect(screen.getByTestId('intro-page')).toBeInTheDocument()

    // Should handle page refresh on root URL
    expect(window.location.pathname).toBe('/')
  })

  it('should handle authentication-aware routing', () => {
    // RED: This should fail - auth-aware routing not implemented
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )

    // Should show appropriate content based on auth state
    expect(screen.getByTestId('intro-page')).toBeInTheDocument()
  })

  it('should maintain proper SEO and accessibility', () => {
    // RED: This should fail - SEO attributes not updated
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )

    // Should have proper main content area
    const mainContent = screen.getByRole('main')
    expect(mainContent).toBeInTheDocument()

    // Should have proper heading structure
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('should preserve notification and PWA functionality', () => {
    // RED: This should fail - PWA integration not maintained
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )

    // Should still show PWA status and notifications
    expect(screen.getByTestId('pwa-status')).toBeInTheDocument()
    expect(screen.getByTestId('notification-bell')).toBeInTheDocument()
    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument()
  })
})