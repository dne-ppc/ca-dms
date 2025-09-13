import { deviceService } from '../deviceService'

describe('DeviceService', () => {
  beforeEach(() => {
    // Reset any mocks before each test
    Object.defineProperty(window, 'navigator', {
      writable: true,
      value: {
        userAgent: ''
      }
    })

    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: 1024
    })
  })

  describe('isMobile', () => {
    it('should return true for mobile user agents', () => {
      // Test iPhone
      Object.defineProperty(window.navigator, 'userAgent', {
        writable: true,
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
      })
      expect(deviceService.isMobile()).toBe(true)

      // Test Android
      Object.defineProperty(window.navigator, 'userAgent', {
        writable: true,
        value: 'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36'
      })
      expect(deviceService.isMobile()).toBe(true)

      // Test iPad
      Object.defineProperty(window.navigator, 'userAgent', {
        writable: true,
        value: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
      })
      expect(deviceService.isMobile()).toBe(true)
    })

    it('should return false for desktop user agents', () => {
      // Test Chrome on Windows
      Object.defineProperty(window.navigator, 'userAgent', {
        writable: true,
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      })
      expect(deviceService.isMobile()).toBe(false)

      // Test Firefox on Mac
      Object.defineProperty(window.navigator, 'userAgent', {
        writable: true,
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:89.0) Gecko/20100101 Firefox/89.0'
      })
      expect(deviceService.isMobile()).toBe(false)
    })
  })

  describe('isDesktop', () => {
    it('should return true for desktop user agents', () => {
      Object.defineProperty(window.navigator, 'userAgent', {
        writable: true,
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      })
      expect(deviceService.isDesktop()).toBe(true)
    })

    it('should return false for mobile user agents', () => {
      Object.defineProperty(window.navigator, 'userAgent', {
        writable: true,
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
      })
      expect(deviceService.isDesktop()).toBe(false)
    })
  })

  describe('getBreakpoint', () => {
    it('should return correct responsive breakpoint for small screens', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        value: 480
      })
      expect(deviceService.getBreakpoint()).toBe('sm')
    })

    it('should return correct responsive breakpoint for medium screens', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        value: 768
      })
      expect(deviceService.getBreakpoint()).toBe('md')
    })

    it('should return correct responsive breakpoint for large screens', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        value: 1024
      })
      expect(deviceService.getBreakpoint()).toBe('lg')
    })

    it('should return correct responsive breakpoint for extra large screens', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        value: 1440
      })
      expect(deviceService.getBreakpoint()).toBe('xl')
    })

    it('should return correct responsive breakpoint for extra small screens', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        value: 320
      })
      expect(deviceService.getBreakpoint()).toBe('xs')
    })
  })
})