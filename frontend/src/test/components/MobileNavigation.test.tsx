import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { MobileNavigation } from '../../components/layout/MobileNavigation'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock window.innerWidth for responsive tests
const mockInnerWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  })
  window.dispatchEvent(new Event('resize'))
}

const renderMobileNavigation = (props = {}) => {
  const defaultProps = { isAuthenticated: true, ...props }
  return render(
    <BrowserRouter>
      <MobileNavigation {...defaultProps} />
    </BrowserRouter>
  )
}

describe('MobileNavigation', () => {
  beforeEach(() => {
    // Reset window width
    mockInnerWidth(1024) // Default to desktop size
  })

  describe('Bug: Multiple menus showing simultaneously', () => {
    it('should NOT show mobile navigation on desktop screens', () => {
      // Set desktop screen size
      mockInnerWidth(1024)

      renderMobileNavigation()

      // The mobile header bar should be hidden on desktop (md:hidden class)
      const mobileHeader = screen.queryByRole('button', { name: /open navigation menu/i })

      // This test should FAIL initially because both mobile and desktop menus are showing
      expect(mobileHeader).not.toBeInTheDocument()
    })

    it('should NOT show both slide-out menu AND bottom navigation bar simultaneously', () => {
      // Set mobile screen size
      mockInnerWidth(375)

      renderMobileNavigation()

      // Should only have one navigation element now
      const navigationElements = screen.queryAllByRole('navigation')

      // Check for duplicate dashboard links (which would indicate multiple nav methods)
      const dashboardLinks = screen.queryAllByText('Dashboard')

      // Should only have one navigation element and one dashboard link
      expect(navigationElements).toHaveLength(1)
      expect(dashboardLinks.length).toBeLessThanOrEqual(1)
    })

    it('should hide mobile navigation when user is not authenticated', () => {
      mockInnerWidth(375)
      renderMobileNavigation({ isAuthenticated: false })

      // Should not show navigation for unauthenticated users
      const navigationElements = screen.queryAllByRole('navigation')
      expect(navigationElements).toHaveLength(0)

      const mobileButton = screen.queryByRole('button', { name: /open navigation menu/i })
      expect(mobileButton).not.toBeInTheDocument()
    })
  })

  describe('Responsive behavior', () => {
    it('should show mobile navigation only on small screens', () => {
      // Mobile screen
      mockInnerWidth(375)
      renderMobileNavigation()

      const mobileButton = screen.queryByRole('button', { name: /open navigation menu/i })
      expect(mobileButton).toBeInTheDocument()

      // Desktop screen
      mockInnerWidth(1024)
      renderMobileNavigation()

      const mobileButtonDesktop = screen.queryByRole('button', { name: /open navigation menu/i })
      expect(mobileButtonDesktop).not.toBeInTheDocument()
    })
  })

  describe('Menu state management', () => {
    it('should only show one navigation method at a time', () => {
      mockInnerWidth(375)
      renderMobileNavigation()

      // Should have either slide-out OR bottom nav, not both
      const allNavigationElements = screen.queryAllByRole('navigation')

      // This test should FAIL initially
      expect(allNavigationElements.length).toBeLessThanOrEqual(1)
    })
  })
})