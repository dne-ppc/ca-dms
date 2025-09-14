import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDeviceDetection } from '../useDeviceDetection'

// Mock the deviceService
vi.mock('../../services/deviceService', () => ({
  deviceService: {
    isMobile: vi.fn(),
    isDesktop: vi.fn(),
    getBreakpoint: vi.fn(),
    getDeviceType: vi.fn(),
    isTouchDevice: vi.fn()
  }
}))

describe('useDeviceDetection Hook - Task 1.1.3: TDD Green Phase', () => {
  const { deviceService } = vi.mocked(await import('../../services/deviceService'))

  beforeEach(() => {
    vi.clearAllMocks()
    // Setup default mocks
    deviceService.isMobile.mockReturnValue(false)
    deviceService.isDesktop.mockReturnValue(true)
    deviceService.getDeviceType.mockReturnValue('desktop')
    deviceService.getBreakpoint.mockReturnValue('lg')
    deviceService.isTouchDevice.mockReturnValue(false)
    deviceService.isBreakpointUp.mockReturnValue(true)
    deviceService.isBreakpointDown.mockReturnValue(false)

    // Mock window.innerWidth
    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true })
  })

  describe('Hook Functionality Tests', () => {
    it('should return current device type', () => {
      deviceService.getDeviceType.mockReturnValue('mobile')
      const { result } = renderHook(() => useDeviceDetection())
      expect(result.current.deviceType).toBe('mobile')
    })

    it('should return mobile detection', () => {
      deviceService.isMobile.mockReturnValue(true)
      const { result } = renderHook(() => useDeviceDetection())
      expect(result.current.isMobile).toBe(true)
    })

    it('should return desktop detection', () => {
      deviceService.isDesktop.mockReturnValue(true)
      const { result } = renderHook(() => useDeviceDetection())
      expect(result.current.isDesktop).toBe(true)
    })

    it('should return breakpoint information', () => {
      deviceService.getBreakpoint.mockReturnValue('md')
      const { result } = renderHook(() => useDeviceDetection())
      expect(result.current.breakpoint).toBe('md')
    })

    it('should return window width', () => {
      const { result } = renderHook(() => useDeviceDetection())
      expect(result.current.windowWidth).toBe(1024)
    })

    it('should return touch device status', () => {
      deviceService.isTouchDevice.mockReturnValue(true)
      const { result } = renderHook(() => useDeviceDetection())
      expect(result.current.isTouchDevice).toBe(true)
    })

    it('should provide responsive helper functions', () => {
      deviceService.isBreakpointUp.mockReturnValue(true)
      deviceService.isBreakpointDown.mockReturnValue(false)

      const { result } = renderHook(() => useDeviceDetection())

      expect(result.current.isBreakpointUp('md')).toBe(true)
      expect(result.current.isBreakpointDown('lg')).toBe(false)
    })

    it('should update when window resizes', async () => {
      const { result } = renderHook(() => useDeviceDetection())

      // Initial values
      expect(result.current.windowWidth).toBe(1024)

      // Update mocks for resize
      deviceService.getBreakpoint.mockReturnValue('md')
      deviceService.isMobile.mockReturnValue(false)
      deviceService.isDesktop.mockReturnValue(true)

      // Mock window resize
      Object.defineProperty(window, 'innerWidth', { value: 768, configurable: true })

      act(() => {
        window.dispatchEvent(new Event('resize'))
      })

      // Wait for debounced update (100ms)
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150))
      })

      expect(result.current.windowWidth).toBe(768)
    })
  })
})

// These tests should ALL FAIL initially, driving the implementation