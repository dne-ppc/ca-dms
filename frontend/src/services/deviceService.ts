export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

class DeviceService {
  /**
   * Check if the current device is mobile based on user agent
   */
  isMobile(): boolean {
    const userAgent = window.navigator.userAgent
    const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i
    return mobileRegex.test(userAgent)
  }

  /**
   * Check if the current device is desktop (opposite of mobile)
   */
  isDesktop(): boolean {
    return !this.isMobile()
  }

  /**
   * Get the current responsive breakpoint based on window width
   */
  getBreakpoint(): Breakpoint {
    const width = window.innerWidth

    if (width < 480) return 'xs'
    if (width < 768) return 'sm'
    if (width < 1024) return 'md'
    if (width < 1280) return 'lg'
    return 'xl'
  }

  /**
   * Check if the current breakpoint matches or is larger than the given breakpoint
   */
  isBreakpointUp(breakpoint: Breakpoint): boolean {
    const breakpoints: Record<Breakpoint, number> = {
      xs: 0,
      sm: 480,
      md: 768,
      lg: 1024,
      xl: 1280
    }

    return window.innerWidth >= breakpoints[breakpoint]
  }

  /**
   * Check if the current breakpoint matches or is smaller than the given breakpoint
   */
  isBreakpointDown(breakpoint: Breakpoint): boolean {
    const breakpoints: Record<Breakpoint, number> = {
      xs: 479,
      sm: 767,
      md: 1023,
      lg: 1279,
      xl: Infinity
    }

    return window.innerWidth <= breakpoints[breakpoint]
  }
}

export const deviceService = new DeviceService()