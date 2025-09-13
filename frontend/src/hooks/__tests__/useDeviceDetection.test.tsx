import { renderHook, act } from '@testing-library/react'
import { useDeviceDetection } from '../useDeviceDetection'
import { vi } from 'vitest'
import * as deviceServiceModule from '../../services/deviceService'

// Mock the entire deviceService module
vi.mock('../../services/deviceService', () => ({
  deviceService: {
    isMobile: vi.fn(),
    isDesktop: vi.fn(),
    getBreakpoint: vi.fn(),
    isBreakpointUp: vi.fn(),
    isBreakpointDown: vi.fn()
  }
}))

describe('useDeviceDetection', () => {
  const mockDeviceService = vi.mocked(deviceServiceModule.deviceService)

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: 1024
    })

    // Mock addEventListener and removeEventListener
    window.addEventListener = vi.fn()
    window.removeEventListener = vi.fn()
  })

  it('should return current device type and breakpoint', () => {
    mockDeviceService.isMobile.mockReturnValue(false)
    mockDeviceService.isDesktop.mockReturnValue(true)
    mockDeviceService.getBreakpoint.mockReturnValue('lg')

    const { result } = renderHook(() => useDeviceDetection())

    expect(result.current.isMobile).toBe(false)
    expect(result.current.isDesktop).toBe(true)
    expect(result.current.breakpoint).toBe('lg')
    expect(result.current.windowWidth).toBe(1024)
  })

  it('should detect mobile device correctly', () => {
    mockDeviceService.isMobile.mockReturnValue(true)
    mockDeviceService.isDesktop.mockReturnValue(false)
    mockDeviceService.getBreakpoint.mockReturnValue('sm')

    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: 480
    })

    const { result } = renderHook(() => useDeviceDetection())

    expect(result.current.isMobile).toBe(true)
    expect(result.current.isDesktop).toBe(false)
    expect(result.current.breakpoint).toBe('sm')
    expect(result.current.windowWidth).toBe(480)
  })

  it('should update when window resizes across breakpoints', async () => {
    vi.useFakeTimers()

    // Initial state - desktop
    mockDeviceService.isMobile.mockReturnValue(false)
    mockDeviceService.isDesktop.mockReturnValue(true)
    mockDeviceService.getBreakpoint.mockReturnValue('lg')

    const { result, rerender } = renderHook(() => useDeviceDetection())

    // Verify initial state
    expect(result.current.isMobile).toBe(false)
    expect(result.current.isDesktop).toBe(true)
    expect(result.current.breakpoint).toBe('lg')

    // Simulate window resize to mobile
    act(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        value: 480
      })

      // Update mocks for mobile
      mockDeviceService.isMobile.mockReturnValue(true)
      mockDeviceService.isDesktop.mockReturnValue(false)
      mockDeviceService.getBreakpoint.mockReturnValue('sm')

      // Get the resize handler and call it
      const addEventListenerCall = (window.addEventListener as any).mock.calls.find(
        (call: any[]) => call[0] === 'resize'
      )
      if (addEventListenerCall) {
        // Simulate debounced resize by calling the handler directly
        addEventListenerCall[1]()

        // Wait for debounce timeout
        vi.advanceTimersByTime(100)
      }
    })

    rerender()

    // Verify updated state
    expect(result.current.isMobile).toBe(true)
    expect(result.current.isDesktop).toBe(false)
    expect(result.current.breakpoint).toBe('sm')
    expect(result.current.windowWidth).toBe(480)

    vi.useRealTimers()
  })

  it('should add and remove resize event listener', () => {
    const { unmount } = renderHook(() => useDeviceDetection())

    // Verify event listener was added
    expect(window.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function))

    // Unmount and verify event listener was removed
    unmount()
    expect(window.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function))
  })

  it('should provide breakpoint utility functions', () => {
    mockDeviceService.isMobile.mockReturnValue(false)
    mockDeviceService.isDesktop.mockReturnValue(true)
    mockDeviceService.getBreakpoint.mockReturnValue('lg')
    mockDeviceService.isBreakpointUp.mockReturnValue(true)
    mockDeviceService.isBreakpointDown.mockReturnValue(false)

    const { result } = renderHook(() => useDeviceDetection())

    expect(typeof result.current.isBreakpointUp).toBe('function')
    expect(typeof result.current.isBreakpointDown).toBe('function')

    // Test breakpoint utility functions
    expect(result.current.isBreakpointUp('md')).toBe(true)
    expect(result.current.isBreakpointDown('xl')).toBe(false)

    expect(mockDeviceService.isBreakpointUp).toHaveBeenCalledWith('md')
    expect(mockDeviceService.isBreakpointDown).toHaveBeenCalledWith('xl')
  })
})