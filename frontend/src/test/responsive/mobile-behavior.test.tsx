/**
 * Mobile and responsive behavior tests
 * Tests touch interactions, viewport changes, and mobile-specific functionality
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock components for testing responsive behavior
const MockResponsiveComponent = () => {
  const [isMobile, setIsMobile] = React.useState(false)
  const [orientation, setOrientation] = React.useState('portrait')

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    const checkOrientation = () => {
      setOrientation(window.innerWidth > window.innerHeight ? 'landscape' : 'portrait')
    }

    checkMobile()
    checkOrientation()

    window.addEventListener('resize', checkMobile)
    window.addEventListener('resize', checkOrientation)

    return () => {
      window.removeEventListener('resize', checkMobile)
      window.removeEventListener('resize', checkOrientation)
    }
  }, [])

  return (
    <div data-testid="responsive-component">
      <span data-testid="device-type">{isMobile ? 'mobile' : 'desktop'}</span>
      <span data-testid="orientation">{orientation}</span>
      {isMobile && <div data-testid="mobile-only">Mobile Only Content</div>}
      {!isMobile && <div data-testid="desktop-only">Desktop Only Content</div>}
    </div>
  )
}

const MockTouchComponent = () => {
  const [touchStart, setTouchStart] = React.useState<{ x: number; y: number } | null>(null)
  const [swipeDirection, setSwipeDirection] = React.useState<string>('')
  const [isLongPress, setIsLongPress] = React.useState(false)
  const longPressTimer = React.useRef<NodeJS.Timeout>()

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    setTouchStart({ x: touch.clientX, y: touch.clientY })

    // Start long press timer
    longPressTimer.current = setTimeout(() => {
      setIsLongPress(true)
    }, 500)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return

    const touch = e.changedTouches[0]
    const deltaX = touch.clientX - touchStart.x
    const deltaY = touch.clientY - touchStart.y

    // Clear long press timer
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
    }

    // Determine swipe direction
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      setSwipeDirection(deltaX > 0 ? 'right' : 'left')
    } else {
      setSwipeDirection(deltaY > 0 ? 'down' : 'up')
    }

    setTouchStart(null)
    setIsLongPress(false)
  }

  const handleTouchCancel = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
    }
    setTouchStart(null)
    setIsLongPress(false)
  }

  return (
    <div
      data-testid="touch-component"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      style={{ width: 200, height: 200, background: '#f0f0f0' }}
    >
      <div data-testid="swipe-direction">{swipeDirection}</div>
      <div data-testid="long-press">{isLongPress ? 'Long Press Active' : ''}</div>
    </div>
  )
}

const MockNavigationMenu = () => {
  const [isOpen, setIsOpen] = React.useState(false)
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (!mobile) setIsOpen(false) // Close mobile menu on desktop
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return (
    <nav data-testid="navigation-menu">
      {isMobile && (
        <button
          data-testid="mobile-menu-toggle"
          onClick={() => setIsOpen(!isOpen)}
        >
          Menu
        </button>
      )}
      <ul
        data-testid="menu-items"
        style={{
          display: isMobile ? (isOpen ? 'block' : 'none') : 'flex'
        }}
      >
        <li data-testid="menu-item-1">Home</li>
        <li data-testid="menu-item-2">About</li>
        <li data-testid="menu-item-3">Contact</li>
      </ul>
    </nav>
  )
}

// Mock window resize utility
const mockWindowResize = (width: number, height: number) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  })
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  })
  window.dispatchEvent(new Event('resize'))
}

// Mock touch events
const createTouchEvent = (type: string, touches: Array<{ clientX: number; clientY: number }>) => {
  const event = new Event(type, { bubbles: true })
  Object.defineProperty(event, 'touches', {
    value: touches,
    writable: false,
  })
  Object.defineProperty(event, 'changedTouches', {
    value: touches,
    writable: false,
  })
  return event
}

describe('Mobile and Responsive Behavior Tests', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
    // Reset viewport to desktop size
    mockWindowResize(1024, 768)
  })

  afterEach(() => {
    // Reset to original window properties
    jest.restoreAllMocks()
  })

  describe('Responsive Design', () => {
    it('should detect mobile viewport', async () => {
      render(<MockResponsiveComponent />)

      // Initially desktop
      expect(screen.getByTestId('device-type')).toHaveTextContent('desktop')
      expect(screen.getByTestId('desktop-only')).toBeInTheDocument()
      expect(screen.queryByTestId('mobile-only')).not.toBeInTheDocument()

      // Resize to mobile
      mockWindowResize(375, 667)
      await waitFor(() => {
        expect(screen.getByTestId('device-type')).toHaveTextContent('mobile')
      })

      expect(screen.getByTestId('mobile-only')).toBeInTheDocument()
      expect(screen.queryByTestId('desktop-only')).not.toBeInTheDocument()
    })

    it('should detect orientation changes', async () => {
      render(<MockResponsiveComponent />)

      // Portrait mobile
      mockWindowResize(375, 667)
      await waitFor(() => {
        expect(screen.getByTestId('orientation')).toHaveTextContent('portrait')
      })

      // Landscape mobile
      mockWindowResize(667, 375)
      await waitFor(() => {
        expect(screen.getByTestId('orientation')).toHaveTextContent('landscape')
      })
    })

    it('should adapt navigation for mobile', async () => {
      render(<MockNavigationMenu />)

      // Desktop - menu should be visible
      expect(screen.queryByTestId('mobile-menu-toggle')).not.toBeInTheDocument()
      expect(screen.getByTestId('menu-items')).toBeVisible()

      // Resize to mobile
      mockWindowResize(375, 667)
      await waitFor(() => {
        expect(screen.getByTestId('mobile-menu-toggle')).toBeInTheDocument()
      })

      // Menu should be hidden initially
      expect(screen.getByTestId('menu-items')).not.toBeVisible()

      // Toggle menu
      await user.click(screen.getByTestId('mobile-menu-toggle'))
      expect(screen.getByTestId('menu-items')).toBeVisible()
    })

    it('should handle tablet viewport appropriately', async () => {
      render(<MockResponsiveComponent />)

      // Tablet size (768px is the breakpoint)
      mockWindowResize(768, 1024)
      await waitFor(() => {
        expect(screen.getByTestId('device-type')).toHaveTextContent('desktop')
      })

      // Just below tablet breakpoint
      mockWindowResize(767, 1024)
      await waitFor(() => {
        expect(screen.getByTestId('device-type')).toHaveTextContent('mobile')
      })
    })

    it('should handle very small screens', async () => {
      render(<MockResponsiveComponent />)

      // Very small mobile screen
      mockWindowResize(320, 568)
      await waitFor(() => {
        expect(screen.getByTestId('device-type')).toHaveTextContent('mobile')
        expect(screen.getByTestId('orientation')).toHaveTextContent('portrait')
      })
    })

    it('should handle ultra-wide screens', async () => {
      render(<MockResponsiveComponent />)

      // Ultra-wide desktop
      mockWindowResize(3440, 1440)
      await waitFor(() => {
        expect(screen.getByTestId('device-type')).toHaveTextContent('desktop')
        expect(screen.getByTestId('orientation')).toHaveTextContent('landscape')
      })
    })
  })

  describe('Touch Interactions', () => {
    it('should detect swipe gestures', async () => {
      render(<MockTouchComponent />)

      const touchComponent = screen.getByTestId('touch-component')
      const swipeDirection = screen.getByTestId('swipe-direction')

      // Simulate swipe right
      fireEvent.touchStart(touchComponent, {
        touches: [{ clientX: 100, clientY: 100 }]
      })
      fireEvent.touchEnd(touchComponent, {
        changedTouches: [{ clientX: 200, clientY: 100 }]
      })

      expect(swipeDirection).toHaveTextContent('right')

      // Simulate swipe left
      fireEvent.touchStart(touchComponent, {
        touches: [{ clientX: 200, clientY: 100 }]
      })
      fireEvent.touchEnd(touchComponent, {
        changedTouches: [{ clientX: 100, clientY: 100 }]
      })

      expect(swipeDirection).toHaveTextContent('left')

      // Simulate swipe up
      fireEvent.touchStart(touchComponent, {
        touches: [{ clientX: 100, clientY: 200 }]
      })
      fireEvent.touchEnd(touchComponent, {
        changedTouches: [{ clientX: 100, clientY: 100 }]
      })

      expect(swipeDirection).toHaveTextContent('up')

      // Simulate swipe down
      fireEvent.touchStart(touchComponent, {
        touches: [{ clientX: 100, clientY: 100 }]
      })
      fireEvent.touchEnd(touchComponent, {
        changedTouches: [{ clientX: 100, clientY: 200 }]
      })

      expect(swipeDirection).toHaveTextContent('down')
    })

    it('should detect long press', async () => {
      jest.useFakeTimers()

      render(<MockTouchComponent />)

      const touchComponent = screen.getByTestId('touch-component')
      const longPressIndicator = screen.getByTestId('long-press')

      // Start touch
      fireEvent.touchStart(touchComponent, {
        touches: [{ clientX: 100, clientY: 100 }]
      })

      // Should not be long press immediately
      expect(longPressIndicator).toHaveTextContent('')

      // Fast forward time
      jest.advanceTimersByTime(500)

      expect(longPressIndicator).toHaveTextContent('Long Press Active')

      // End touch
      fireEvent.touchEnd(touchComponent, {
        changedTouches: [{ clientX: 100, clientY: 100 }]
      })

      expect(longPressIndicator).toHaveTextContent('')

      jest.useRealTimers()
    })

    it('should cancel long press on touch move', async () => {
      jest.useFakeTimers()

      render(<MockTouchComponent />)

      const touchComponent = screen.getByTestId('touch-component')
      const longPressIndicator = screen.getByTestId('long-press')

      // Start touch
      fireEvent.touchStart(touchComponent, {
        touches: [{ clientX: 100, clientY: 100 }]
      })

      // Move touch (should cancel long press)
      fireEvent.touchCancel(touchComponent)

      // Fast forward time
      jest.advanceTimersByTime(500)

      // Should not activate long press
      expect(longPressIndicator).toHaveTextContent('')

      jest.useRealTimers()
    })

    it('should handle multi-touch gestures', async () => {
      const MockMultiTouchComponent = () => {
        const [touchCount, setTouchCount] = React.useState(0)
        const [gestureType, setGestureType] = React.useState('')

        const handleTouchStart = (e: React.TouchEvent) => {
          const count = e.touches.length
          setTouchCount(count)

          if (count === 2) {
            setGestureType('pinch/zoom')
          } else if (count === 3) {
            setGestureType('three-finger')
          } else {
            setGestureType('single-touch')
          }
        }

        const handleTouchEnd = (e: React.TouchEvent) => {
          setTouchCount(e.touches.length)
          if (e.touches.length === 0) {
            setGestureType('')
          }
        }

        return (
          <div
            data-testid="multi-touch-component"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <span data-testid="touch-count">{touchCount}</span>
            <span data-testid="gesture-type">{gestureType}</span>
          </div>
        )
      }

      render(<MockMultiTouchComponent />)

      const component = screen.getByTestId('multi-touch-component')

      // Single touch
      fireEvent.touchStart(component, {
        touches: [{ clientX: 100, clientY: 100 }]
      })

      expect(screen.getByTestId('touch-count')).toHaveTextContent('1')
      expect(screen.getByTestId('gesture-type')).toHaveTextContent('single-touch')

      // Two-finger touch
      fireEvent.touchStart(component, {
        touches: [
          { clientX: 100, clientY: 100 },
          { clientX: 200, clientY: 200 }
        ]
      })

      expect(screen.getByTestId('touch-count')).toHaveTextContent('2')
      expect(screen.getByTestId('gesture-type')).toHaveTextContent('pinch/zoom')
    })
  })

  describe('Mobile-Specific Components', () => {
    it('should render mobile editor correctly', async () => {
      const MockMobileEditor = () => {
        const [isMobile, setIsMobile] = React.useState(false)

        React.useEffect(() => {
          const checkMobile = () => setIsMobile(window.innerWidth < 768)
          checkMobile()
          window.addEventListener('resize', checkMobile)
          return () => window.removeEventListener('resize', checkMobile)
        }, [])

        if (isMobile) {
          return (
            <div data-testid="mobile-editor">
              <div data-testid="mobile-toolbar">Mobile Toolbar</div>
              <textarea data-testid="mobile-text-area" />
            </div>
          )
        }

        return (
          <div data-testid="desktop-editor">
            <div data-testid="desktop-toolbar">Desktop Toolbar</div>
            <div data-testid="rich-text-editor">Rich Text Editor</div>
          </div>
        )
      }

      render(<MockMobileEditor />)

      // Desktop view
      expect(screen.getByTestId('desktop-editor')).toBeInTheDocument()
      expect(screen.queryByTestId('mobile-editor')).not.toBeInTheDocument()

      // Switch to mobile
      mockWindowResize(375, 667)
      await waitFor(() => {
        expect(screen.getByTestId('mobile-editor')).toBeInTheDocument()
      })
      expect(screen.queryByTestId('desktop-editor')).not.toBeInTheDocument()
    })

    it('should handle mobile form input correctly', async () => {
      const MockMobileForm = () => {
        const [isMobile, setIsMobile] = React.useState(false)

        React.useEffect(() => {
          const checkMobile = () => setIsMobile(window.innerWidth < 768)
          checkMobile()
          window.addEventListener('resize', checkMobile)
          return () => window.removeEventListener('resize', checkMobile)
        }, [])

        return (
          <form data-testid="mobile-form">
            <input
              type="text"
              data-testid="text-input"
              style={{
                fontSize: isMobile ? '16px' : '14px', // Prevent zoom on iOS
                padding: isMobile ? '12px' : '8px'
              }}
            />
            <input
              type="email"
              data-testid="email-input"
              autoComplete="email"
              inputMode="email"
            />
            <input
              type="tel"
              data-testid="phone-input"
              autoComplete="tel"
              inputMode="tel"
            />
          </form>
        )
      }

      render(<MockMobileForm />)

      mockWindowResize(375, 667)
      await waitFor(() => {
        const textInput = screen.getByTestId('text-input')
        expect(textInput).toHaveStyle('font-size: 16px')
        expect(textInput).toHaveStyle('padding: 12px')
      })

      // Check mobile-optimized attributes
      expect(screen.getByTestId('email-input')).toHaveAttribute('inputMode', 'email')
      expect(screen.getByTestId('phone-input')).toHaveAttribute('inputMode', 'tel')
    })

    it('should handle pull-to-refresh gesture', async () => {
      const MockPullToRefresh = () => {
        const [isRefreshing, setIsRefreshing] = React.useState(false)
        const [pullDistance, setPullDistance] = React.useState(0)

        const handleTouchStart = (e: React.TouchEvent) => {
          if (window.pageYOffset === 0) {
            setPullDistance(0)
          }
        }

        const handleTouchMove = (e: React.TouchEvent) => {
          if (window.pageYOffset === 0) {
            const touch = e.touches[0]
            const startY = 0 // Simplified for testing
            const currentY = touch.clientY
            const distance = Math.max(0, currentY - startY)
            setPullDistance(distance)

            if (distance > 100) {
              e.preventDefault() // Prevent scroll
            }
          }
        }

        const handleTouchEnd = () => {
          if (pullDistance > 100) {
            setIsRefreshing(true)
            setTimeout(() => {
              setIsRefreshing(false)
              setPullDistance(0)
            }, 1000)
          } else {
            setPullDistance(0)
          }
        }

        return (
          <div
            data-testid="pull-to-refresh"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div data-testid="refresh-indicator">
              {isRefreshing ? 'Refreshing...' : pullDistance > 50 ? 'Release to refresh' : ''}
            </div>
            <div data-testid="pull-distance">{pullDistance}</div>
          </div>
        )
      }

      // Mock window.pageYOffset
      Object.defineProperty(window, 'pageYOffset', { value: 0, writable: true })

      render(<MockPullToRefresh />)

      const component = screen.getByTestId('pull-to-refresh')

      // Simulate pull gesture
      fireEvent.touchStart(component, {
        touches: [{ clientX: 100, clientY: 0 }]
      })

      fireEvent.touchMove(component, {
        touches: [{ clientX: 100, clientY: 120 }] // Pull down 120px
      })

      expect(screen.getByTestId('refresh-indicator')).toHaveTextContent('Release to refresh')

      fireEvent.touchEnd(component)

      expect(screen.getByTestId('refresh-indicator')).toHaveTextContent('Refreshing...')
    })
  })

  describe('Accessibility on Mobile', () => {
    it('should maintain accessibility on mobile', async () => {
      const MockAccessibleMobileComponent = () => {
        const [isMobile, setIsMobile] = React.useState(false)

        React.useEffect(() => {
          const checkMobile = () => setIsMobile(window.innerWidth < 768)
          checkMobile()
          window.addEventListener('resize', checkMobile)
          return () => window.removeEventListener('resize', checkMobile)
        }, [])

        return (
          <div data-testid="accessible-mobile">
            <button
              data-testid="accessible-button"
              aria-label="Main action button"
              style={{
                minHeight: isMobile ? '44px' : '32px', // iOS minimum touch target
                minWidth: isMobile ? '44px' : '32px'
              }}
            >
              Action
            </button>
            <nav
              data-testid="accessible-nav"
              aria-label="Main navigation"
              role="navigation"
            >
              <ul>
                <li>
                  <a
                    href="/home"
                    aria-current={isMobile ? 'page' : undefined}
                    style={{
                      padding: isMobile ? '12px' : '8px'
                    }}
                  >
                    Home
                  </a>
                </li>
              </ul>
            </nav>
          </div>
        )
      }

      render(<MockAccessibleMobileComponent />)

      mockWindowResize(375, 667)
      await waitFor(() => {
        const button = screen.getByTestId('accessible-button')
        expect(button).toHaveStyle('min-height: 44px')
        expect(button).toHaveStyle('min-width: 44px')
      })

      // Check accessibility attributes are preserved
      expect(screen.getByTestId('accessible-button')).toHaveAttribute('aria-label', 'Main action button')
      expect(screen.getByTestId('accessible-nav')).toHaveAttribute('aria-label', 'Main navigation')
    })

    it('should handle focus management on mobile', async () => {
      const MockFocusComponent = () => {
        const [showModal, setShowModal] = React.useState(false)
        const modalRef = React.useRef<HTMLDivElement>(null)

        React.useEffect(() => {
          if (showModal && modalRef.current) {
            modalRef.current.focus()
          }
        }, [showModal])

        return (
          <div data-testid="focus-component">
            <button
              data-testid="open-modal"
              onClick={() => setShowModal(true)}
            >
              Open Modal
            </button>
            {showModal && (
              <div
                ref={modalRef}
                data-testid="modal"
                role="dialog"
                aria-modal="true"
                tabIndex={-1}
                style={{
                  position: 'fixed',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)'
                }}
              >
                <button
                  data-testid="modal-close"
                  onClick={() => setShowModal(false)}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        )
      }

      render(<MockFocusComponent />)

      const openButton = screen.getByTestId('open-modal')
      await user.click(openButton)

      const modal = screen.getByTestId('modal')
      expect(modal).toBeInTheDocument()
      expect(modal).toHaveFocus()
    })
  })

  describe('Performance on Mobile', () => {
    it('should handle viewport changes efficiently', async () => {
      let renderCount = 0

      const MockPerformanceComponent = React.memo(() => {
        renderCount++
        const [isMobile, setIsMobile] = React.useState(false)

        React.useEffect(() => {
          const checkMobile = () => setIsMobile(window.innerWidth < 768)
          checkMobile()
          window.addEventListener('resize', checkMobile)
          return () => window.removeEventListener('resize', checkMobile)
        }, [])

        return (
          <div data-testid="performance-component">
            {isMobile ? 'Mobile' : 'Desktop'}
          </div>
        )
      })

      render(<MockPerformanceComponent />)

      const initialRenderCount = renderCount

      // Multiple rapid resize events
      for (let i = 0; i < 10; i++) {
        mockWindowResize(375 + i, 667)
      }

      await waitFor(() => {
        expect(screen.getByTestId('performance-component')).toHaveTextContent('Mobile')
      })

      // Should not cause excessive re-renders
      expect(renderCount - initialRenderCount).toBeLessThan(15) // Allow some re-renders but not excessive
    })

    it('should debounce resize events', async () => {
      jest.useFakeTimers()

      let resizeCallCount = 0

      const MockDebouncedComponent = () => {
        const [size, setSize] = React.useState({ width: 1024, height: 768 })

        React.useEffect(() => {
          let timeoutId: NodeJS.Timeout

          const handleResize = () => {
            clearTimeout(timeoutId)
            timeoutId = setTimeout(() => {
              resizeCallCount++
              setSize({ width: window.innerWidth, height: window.innerHeight })
            }, 100) // 100ms debounce
          }

          window.addEventListener('resize', handleResize)
          return () => {
            window.removeEventListener('resize', handleResize)
            clearTimeout(timeoutId)
          }
        }, [])

        return (
          <div data-testid="debounced-component">
            {size.width}x{size.height}
          </div>
        )
      }

      render(<MockDebouncedComponent />)

      // Trigger multiple rapid resize events
      mockWindowResize(375, 667)
      mockWindowResize(768, 1024)
      mockWindowResize(1024, 768)

      // Should not call resize handler immediately
      expect(resizeCallCount).toBe(0)

      // Fast forward debounce delay
      jest.advanceTimersByTime(100)

      expect(resizeCallCount).toBe(1) // Should only call once after debounce

      jest.useRealTimers()
    })
  })
})