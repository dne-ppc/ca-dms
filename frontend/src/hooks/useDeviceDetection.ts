import { useState, useEffect, useCallback } from 'react'
import { deviceService, type Breakpoint } from '../services/deviceService'

interface DeviceDetectionState {
  isMobile: boolean
  isDesktop: boolean
  breakpoint: Breakpoint
  windowWidth: number
  isBreakpointUp: (breakpoint: Breakpoint) => boolean
  isBreakpointDown: (breakpoint: Breakpoint) => boolean
}

export const useDeviceDetection = (): DeviceDetectionState => {
  const [state, setState] = useState<Omit<DeviceDetectionState, 'isBreakpointUp' | 'isBreakpointDown'>>(() => ({
    isMobile: deviceService.isMobile(),
    isDesktop: deviceService.isDesktop(),
    breakpoint: deviceService.getBreakpoint(),
    windowWidth: window.innerWidth
  }))

  const updateDeviceState = useCallback(() => {
    setState({
      isMobile: deviceService.isMobile(),
      isDesktop: deviceService.isDesktop(),
      breakpoint: deviceService.getBreakpoint(),
      windowWidth: window.innerWidth
    })
  }, [])

  const isBreakpointUp = useCallback((breakpoint: Breakpoint) => {
    return deviceService.isBreakpointUp(breakpoint)
  }, [])

  const isBreakpointDown = useCallback((breakpoint: Breakpoint) => {
    return deviceService.isBreakpointDown(breakpoint)
  }, [])

  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    const handleResize = () => {
      // Debounce resize events to improve performance
      clearTimeout(timeoutId)
      timeoutId = setTimeout(updateDeviceState, 100)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      clearTimeout(timeoutId)
    }
  }, [updateDeviceState])

  return {
    ...state,
    isBreakpointUp,
    isBreakpointDown
  }
}