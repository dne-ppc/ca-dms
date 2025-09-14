import { describe, it, expect, beforeEach, vi } from 'vitest'
import { deviceService } from '../deviceService'

// Mock window.navigator for testing
const mockUserAgent = (userAgent: string) => {
  Object.defineProperty(window.navigator, 'userAgent', {
    writable: true,
    value: userAgent
  })
}

// Mock window.innerWidth for testing
const mockWindowWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width
  })
}

describe('Device Detection Service - Task 1.1.2: TDD Green Phase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Mobile Detection', () => {
    it('should detect iPhone as mobile device', () => {
      mockUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15')
      expect(deviceService.isMobile()).toBe(true)
    })

    it('should detect Android as mobile device', () => {
      mockUserAgent('Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36')
      expect(deviceService.isMobile()).toBe(true)
    })

    it('should detect iPad as mobile device', () => {
      mockUserAgent('Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15')
      expect(deviceService.isMobile()).toBe(true)
    })

    it('should detect BlackBerry as mobile device', () => {
      mockUserAgent('Mozilla/5.0 (BlackBerry; U; BlackBerry 9900; en) AppleWebKit/534.11')
      expect(deviceService.isMobile()).toBe(true)
    })
  })

  describe('Desktop Detection', () => {
    it('should detect Windows as desktop device', () => {
      mockUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36')
      expect(deviceService.isDesktop()).toBe(true)
    })

    it('should detect macOS as desktop device', () => {
      mockUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36')
      expect(deviceService.isDesktop()).toBe(true)
    })

    it('should detect Linux as desktop device', () => {
      mockUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36')
      expect(deviceService.isDesktop()).toBe(true)
    })
  })

  describe('Responsive Breakpoint Detection', () => {
    it('should return correct breakpoint based on window width', () => {
        mockWindowWidth(320)
        const result = deviceService.getBreakpoint()
        expect(result).toBe('xs')
    })

    it('should return xs breakpoint for extra small screens', () => {
        mockWindowWidth(320)
        expect(deviceService.getBreakpoint()).toBe('xs')
    })

    it('should return sm breakpoint for small screens', () => {
        mockWindowWidth(640)
        expect(deviceService.getBreakpoint()).toBe('sm')
    })

    it('should return md breakpoint for medium screens', () => {
        mockWindowWidth(768)
        expect(deviceService.getBreakpoint()).toBe('md')
    })

    it('should return lg breakpoint for large screens', () => {
        mockWindowWidth(1024)
        expect(deviceService.getBreakpoint()).toBe('lg')
    })

    it('should return xl breakpoint for extra large screens', () => {
        mockWindowWidth(1280)
        expect(deviceService.getBreakpoint()).toBe('xl')
    })

    it('should return 2xl breakpoint for 2x extra large screens', () => {
        mockWindowWidth(1536)
        expect(deviceService.getBreakpoint()).toBe('2xl')
    })
  })

  describe('Edge Cases', () => {
    it('should handle missing navigator gracefully', () => {
        const originalNavigator = window.navigator
        // @ts-ignore
        delete window.navigator
        expect(deviceService.isMobile()).toBe(false)
        expect(deviceService.isDesktop()).toBe(true)
        window.navigator = originalNavigator
    })

    it('should handle undefined user agent', () => {
        mockUserAgent('')
        expect(deviceService.isMobile()).toBe(false)
        expect(deviceService.isDesktop()).toBe(true)
    })

    it('should handle window resize scenarios', () => {
        mockWindowWidth(500)
        expect(deviceService.getBreakpoint()).toBe('xs')

        mockWindowWidth(800)
        expect(deviceService.getBreakpoint()).toBe('md')

        mockWindowWidth(1200)
        expect(deviceService.getBreakpoint()).toBe('lg')
    })
  })

  describe('Device Type Detection', () => {
    it('should return correct device type for mobile', () => {
        mockUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)')
        expect(deviceService.getDeviceType()).toBe('mobile')
    })

    it('should return correct device type for tablet', () => {
        mockUserAgent('Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)')
        expect(deviceService.getDeviceType()).toBe('tablet')
    })

    it('should return correct device type for desktop', () => {
        mockUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        expect(deviceService.getDeviceType()).toBe('desktop')
    })
  })

  describe('Touch Device Detection', () => {
    it('should detect touch capability', () => {
        Object.defineProperty(window, 'ontouchstart', {
          value: true,
          configurable: true
        })
        expect(deviceService.isTouchDevice()).toBe(true)
    })

    it('should detect non-touch devices', () => {
        // Temporarily backup original values
        const originalTouchStart = window.ontouchstart
        const originalMaxTouch = navigator.maxTouchPoints
        const originalMsMaxTouch = (navigator as any).msMaxTouchPoints

        try {
          // Remove touch properties
          delete (window as any).ontouchstart
          Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true })
          Object.defineProperty(navigator, 'msMaxTouchPoints', { value: 0, configurable: true })

          expect(deviceService.isTouchDevice()).toBe(false)
        } finally {
          // Restore original values
          if (originalTouchStart !== undefined) {
            (window as any).ontouchstart = originalTouchStart
          }
          Object.defineProperty(navigator, 'maxTouchPoints', { value: originalMaxTouch, configurable: true })
          Object.defineProperty(navigator, 'msMaxTouchPoints', { value: originalMsMaxTouch, configurable: true })
        }
    })
  })
})

// These tests should ALL FAIL initially, driving the implementation