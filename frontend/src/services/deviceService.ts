export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
export type DeviceType = 'mobile' | 'tablet' | 'desktop'

class DeviceService {
  /**
   * Check if the current device is mobile based on user agent
   */
  isMobile(): boolean {
    try {
      if (!window.navigator || !window.navigator.userAgent) {
        return false
      }
      const userAgent = window.navigator.userAgent
      const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i
      return mobileRegex.test(userAgent)
    } catch (error) {
      return false
    }
  }

  /**
   * Check if the current device is desktop (opposite of mobile)
   */
  isDesktop(): boolean {
    return !this.isMobile()
  }

  /**
   * Get the device type: mobile, tablet, or desktop
   */
  getDeviceType(): DeviceType {
    try {
      if (!window.navigator || !window.navigator.userAgent) {
        return 'desktop'
      }

      const userAgent = window.navigator.userAgent

      // Check for tablet first (iPad, Android tablets)
      if (/iPad|Android.*(?!.*Mobile)/i.test(userAgent)) {
        return 'tablet'
      }

      // Check for mobile devices
      if (/Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i.test(userAgent)) {
        return 'mobile'
      }

      return 'desktop'
    } catch (error) {
      return 'desktop'
    }
  }

  /**
   * Check if the device supports touch
   */
  isTouchDevice(): boolean {
    try {
      return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0
    } catch (error) {
      return false
    }
  }

  /**
   * Get the current responsive breakpoint based on window width
   */
  getBreakpoint(): Breakpoint {
    const width = window.innerWidth

    if (width < 640) return 'xs'       // < 640px
    if (width < 768) return 'sm'       // 640px - 767px
    if (width < 1024) return 'md'      // 768px - 1023px
    if (width < 1280) return 'lg'      // 1024px - 1279px
    if (width < 1536) return 'xl'      // 1280px - 1535px
    return '2xl'                       // >= 1536px
  }

  /**
   * Check if the current breakpoint matches or is larger than the given breakpoint
   */
  isBreakpointUp(breakpoint: Breakpoint): boolean {
    const breakpoints: Record<Breakpoint, number> = {
      xs: 0,
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
      '2xl': 1536
    }

    return window.innerWidth >= breakpoints[breakpoint]
  }

  /**
   * Check if the current breakpoint matches or is smaller than the given breakpoint
   */
  isBreakpointDown(breakpoint: Breakpoint): boolean {
    const breakpoints: Record<Breakpoint, number> = {
      xs: 639,
      sm: 767,
      md: 1023,
      lg: 1279,
      xl: 1535,
      '2xl': Infinity
    }

    return window.innerWidth <= breakpoints[breakpoint]
  }
}

export const deviceService = new DeviceService()