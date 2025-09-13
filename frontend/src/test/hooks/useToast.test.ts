/**
 * Comprehensive tests for useToast hook
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useToast } from '../../hooks/use-toast'
import { setupTimerMocks, setupHookTest } from '../utils/hookTestUtils'

describe('useToast', () => {
  setupHookTest()

  let timerMocks: ReturnType<typeof setupTimerMocks>

  beforeEach(() => {
    timerMocks = setupTimerMocks()
    vi.clearAllMocks()
  })

  afterEach(() => {
    timerMocks.clearAllTimers()
    vi.restoreAllMocks()
  })

  describe('Basic Functionality', () => {
    it('should return toast function, toasts array, and dismiss function', () => {
      const { result } = renderHook(() => useToast())

      expect(result.current).toHaveProperty('toast')
      expect(result.current).toHaveProperty('toasts')
      expect(result.current).toHaveProperty('dismiss')
      expect(typeof result.current.toast).toBe('function')
      expect(typeof result.current.dismiss).toBe('function')
      expect(Array.isArray(result.current.toasts)).toBe(true)
    })

    it('should start with empty toasts array', () => {
      const { result } = renderHook(() => useToast())

      expect(result.current.toasts).toEqual([])
      expect(result.current.toasts.length).toBe(0)
    })
  })

  describe('Toast Creation', () => {
    it('should create a toast with title only', () => {
      const { result } = renderHook(() => useToast())
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})

      act(() => {
        result.current.toast({ title: 'Test Toast' })
      })

      expect(result.current.toasts).toHaveLength(1)
      expect(result.current.toasts[0]).toMatchObject({
        title: 'Test Toast',
        variant: 'default'
      })
      expect(result.current.toasts[0].id).toMatch(/^toast-\d+$/)
      expect(consoleLog).toHaveBeenCalledWith('Toast [default]: Test Toast')

      consoleLog.mockRestore()
    })

    it('should create a toast with title and description', () => {
      const { result } = renderHook(() => useToast())
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})

      act(() => {
        result.current.toast({
          title: 'Test Toast',
          description: 'Test Description'
        })
      })

      expect(result.current.toasts).toHaveLength(1)
      expect(result.current.toasts[0]).toMatchObject({
        title: 'Test Toast',
        description: 'Test Description',
        variant: 'default'
      })
      expect(consoleLog).toHaveBeenCalledWith('Toast [default]: Test Toast - Test Description')

      consoleLog.mockRestore()
    })

    it('should create a toast with custom variant', () => {
      const { result } = renderHook(() => useToast())
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})

      act(() => {
        result.current.toast({
          title: 'Error Toast',
          variant: 'destructive'
        })
      })

      expect(result.current.toasts).toHaveLength(1)
      expect(result.current.toasts[0]).toMatchObject({
        title: 'Error Toast',
        variant: 'destructive'
      })
      expect(consoleLog).toHaveBeenCalledWith('Toast [destructive]: Error Toast')

      consoleLog.mockRestore()
    })

    it('should return toast ID when creating a toast', () => {
      const { result } = renderHook(() => useToast())

      let toastId: string
      act(() => {
        toastId = result.current.toast({ title: 'Test Toast' })
      })

      expect(toastId!).toBeDefined()
      expect(typeof toastId!).toBe('string')
      expect(toastId!).toMatch(/^toast-\d+$/)
      expect(result.current.toasts[0].id).toBe(toastId!)
    })
  })

  describe('Multiple Toasts', () => {
    it('should handle multiple toasts correctly', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        result.current.toast({ title: 'First Toast' })
        result.current.toast({ title: 'Second Toast' })
        result.current.toast({ title: 'Third Toast' })
      })

      expect(result.current.toasts).toHaveLength(3)
      expect(result.current.toasts[0].title).toBe('First Toast')
      expect(result.current.toasts[1].title).toBe('Second Toast')
      expect(result.current.toasts[2].title).toBe('Third Toast')
    })

    it('should assign unique IDs to multiple toasts', () => {
      const { result } = renderHook(() => useToast())

      const ids: string[] = []
      act(() => {
        ids.push(result.current.toast({ title: 'Toast 1' }))
        ids.push(result.current.toast({ title: 'Toast 2' }))
        ids.push(result.current.toast({ title: 'Toast 3' }))
      })

      expect(new Set(ids).size).toBe(3) // All IDs should be unique
      expect(result.current.toasts.map(t => t.id)).toEqual(ids)
    })

    it('should increment toast counter correctly', () => {
      const { result } = renderHook(() => useToast())

      const ids: string[] = []
      act(() => {
        ids.push(result.current.toast({ title: 'Toast 1' }))
        ids.push(result.current.toast({ title: 'Toast 2' }))
      })

      // IDs should contain incrementing numbers
      expect(ids[0]).toMatch(/toast-\d+/)
      expect(ids[1]).toMatch(/toast-\d+/)

      const num1 = parseInt(ids[0].replace('toast-', ''))
      const num2 = parseInt(ids[1].replace('toast-', ''))
      expect(num2).toBe(num1 + 1)
    })
  })

  describe('Auto-Dismissal', () => {
    it('should auto-dismiss toast after 5 seconds', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        result.current.toast({ title: 'Auto Dismiss Toast' })
      })

      expect(result.current.toasts).toHaveLength(1)

      // Fast-forward 5 seconds
      act(() => {
        timerMocks.advanceTimers(5000)
      })

      expect(result.current.toasts).toHaveLength(0)
    })

    it('should auto-dismiss multiple toasts independently', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        result.current.toast({ title: 'First Toast' })
      })

      // Advance 2 seconds
      act(() => {
        timerMocks.advanceTimers(2000)
      })

      act(() => {
        result.current.toast({ title: 'Second Toast' })
      })

      expect(result.current.toasts).toHaveLength(2)

      // Advance 3 more seconds (5 total for first toast)
      act(() => {
        timerMocks.advanceTimers(3000)
      })

      // First toast should be dismissed, second should remain
      expect(result.current.toasts).toHaveLength(1)
      expect(result.current.toasts[0].title).toBe('Second Toast')

      // Advance 2 more seconds (5 total for second toast)
      act(() => {
        timerMocks.advanceTimers(2000)
      })

      // Second toast should now be dismissed
      expect(result.current.toasts).toHaveLength(0)
    })

    it('should not auto-dismiss if manually dismissed first', () => {
      const { result } = renderHook(() => useToast())

      let toastId: string
      act(() => {
        toastId = result.current.toast({ title: 'Manual Dismiss Toast' })
      })

      expect(result.current.toasts).toHaveLength(1)

      // Manually dismiss after 2 seconds
      act(() => {
        timerMocks.advanceTimers(2000)
        result.current.dismiss(toastId)
      })

      expect(result.current.toasts).toHaveLength(0)

      // Continue to 5 seconds - should remain empty
      act(() => {
        timerMocks.advanceTimers(3000)
      })

      expect(result.current.toasts).toHaveLength(0)
    })
  })

  describe('Manual Dismissal', () => {
    it('should manually dismiss toast by ID', () => {
      const { result } = renderHook(() => useToast())

      let toastId: string
      act(() => {
        toastId = result.current.toast({ title: 'Dismiss Me' })
      })

      expect(result.current.toasts).toHaveLength(1)

      act(() => {
        result.current.dismiss(toastId)
      })

      expect(result.current.toasts).toHaveLength(0)
    })

    it('should dismiss only the specified toast when multiple exist', () => {
      const { result } = renderHook(() => useToast())

      let firstId: string, secondId: string, thirdId: string
      act(() => {
        firstId = result.current.toast({ title: 'Keep Me' })
        secondId = result.current.toast({ title: 'Dismiss Me' })
        thirdId = result.current.toast({ title: 'Keep Me Too' })
      })

      expect(result.current.toasts).toHaveLength(3)

      act(() => {
        result.current.dismiss(secondId)
      })

      expect(result.current.toasts).toHaveLength(2)
      expect(result.current.toasts.map(t => t.id)).toEqual([firstId, thirdId])
      expect(result.current.toasts.map(t => t.title)).toEqual(['Keep Me', 'Keep Me Too'])
    })

    it('should handle dismissing non-existent toast gracefully', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        result.current.toast({ title: 'Existing Toast' })
      })

      expect(result.current.toasts).toHaveLength(1)

      // Try to dismiss non-existent toast
      act(() => {
        result.current.dismiss('non-existent-id')
      })

      // Should not affect existing toasts
      expect(result.current.toasts).toHaveLength(1)
      expect(result.current.toasts[0].title).toBe('Existing Toast')
    })

    it('should handle empty toast list dismissal gracefully', () => {
      const { result } = renderHook(() => useToast())

      expect(result.current.toasts).toHaveLength(0)

      // Should not throw error
      expect(() => {
        act(() => {
          result.current.dismiss('any-id')
        })
      }).not.toThrow()

      expect(result.current.toasts).toHaveLength(0)
    })
  })

  describe('Console Logging', () => {
    it('should log default variant toasts correctly', () => {
      const { result } = renderHook(() => useToast())
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})

      act(() => {
        result.current.toast({ title: 'Default Toast' })
      })

      expect(consoleLog).toHaveBeenCalledWith('Toast [default]: Default Toast')

      consoleLog.mockRestore()
    })

    it('should log destructive variant toasts correctly', () => {
      const { result } = renderHook(() => useToast())
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})

      act(() => {
        result.current.toast({
          title: 'Error Toast',
          variant: 'destructive'
        })
      })

      expect(consoleLog).toHaveBeenCalledWith('Toast [destructive]: Error Toast')

      consoleLog.mockRestore()
    })

    it('should log toasts with description correctly', () => {
      const { result } = renderHook(() => useToast())
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})

      act(() => {
        result.current.toast({
          title: 'Toast Title',
          description: 'Toast Description',
          variant: 'default'
        })
      })

      expect(consoleLog).toHaveBeenCalledWith('Toast [default]: Toast Title - Toast Description')

      consoleLog.mockRestore()
    })

    it('should log toasts without description correctly', () => {
      const { result } = renderHook(() => useToast())
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})

      act(() => {
        result.current.toast({
          title: 'Toast Title Only',
          variant: 'destructive'
        })
      })

      expect(consoleLog).toHaveBeenCalledWith('Toast [destructive]: Toast Title Only')

      consoleLog.mockRestore()
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty title gracefully', () => {
      const { result } = renderHook(() => useToast())
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})

      act(() => {
        result.current.toast({ title: '' })
      })

      expect(result.current.toasts).toHaveLength(1)
      expect(result.current.toasts[0].title).toBe('')
      expect(consoleLog).toHaveBeenCalledWith('Toast [default]: ')

      consoleLog.mockRestore()
    })

    it('should handle empty description gracefully', () => {
      const { result } = renderHook(() => useToast())
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})

      act(() => {
        result.current.toast({
          title: 'Title',
          description: ''
        })
      })

      expect(result.current.toasts).toHaveLength(1)
      expect(result.current.toasts[0].description).toBe('')
      expect(consoleLog).toHaveBeenCalledWith('Toast [default]: Title - ')

      consoleLog.mockRestore()
    })

    it('should handle undefined description gracefully', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        result.current.toast({
          title: 'Title',
          description: undefined
        })
      })

      expect(result.current.toasts).toHaveLength(1)
      expect(result.current.toasts[0].description).toBeUndefined()
    })

    it('should handle very long titles and descriptions', () => {
      const { result } = renderHook(() => useToast())
      const longTitle = 'A'.repeat(1000)
      const longDescription = 'B'.repeat(1000)

      act(() => {
        result.current.toast({
          title: longTitle,
          description: longDescription
        })
      })

      expect(result.current.toasts).toHaveLength(1)
      expect(result.current.toasts[0].title).toBe(longTitle)
      expect(result.current.toasts[0].description).toBe(longDescription)
    })

    it('should handle special characters in title and description', () => {
      const { result } = renderHook(() => useToast())
      const specialTitle = '🎉 Success! <script>alert("xss")</script>'
      const specialDescription = 'Special chars: @#$%^&*(){}[]|\\:";\'<>?,./'

      act(() => {
        result.current.toast({
          title: specialTitle,
          description: specialDescription
        })
      })

      expect(result.current.toasts).toHaveLength(1)
      expect(result.current.toasts[0].title).toBe(specialTitle)
      expect(result.current.toasts[0].description).toBe(specialDescription)
    })
  })

  describe('Performance', () => {
    it('should handle rapid toast creation efficiently', () => {
      const { result } = renderHook(() => useToast())

      const startTime = performance.now()

      act(() => {
        for (let i = 0; i < 100; i++) {
          result.current.toast({ title: `Toast ${i}` })
        }
      })

      const endTime = performance.now()
      const duration = endTime - startTime

      expect(result.current.toasts).toHaveLength(100)
      expect(duration).toBeLessThan(50) // Should complete quickly
    })

    it('should handle rapid dismissals efficiently', () => {
      const { result } = renderHook(() => useToast())

      const ids: string[] = []
      act(() => {
        for (let i = 0; i < 100; i++) {
          ids.push(result.current.toast({ title: `Toast ${i}` }))
        }
      })

      const startTime = performance.now()

      act(() => {
        ids.forEach(id => result.current.dismiss(id))
      })

      const endTime = performance.now()
      const duration = endTime - startTime

      expect(result.current.toasts).toHaveLength(0)
      expect(duration).toBeLessThan(50) // Should complete quickly
    })

    it('should handle mixed operations efficiently', () => {
      const { result } = renderHook(() => useToast())

      const startTime = performance.now()

      act(() => {
        // Create, dismiss, create pattern
        for (let i = 0; i < 50; i++) {
          const id = result.current.toast({ title: `Toast ${i}` })
          if (i % 2 === 0) {
            result.current.dismiss(id)
          }
        }
      })

      const endTime = performance.now()
      const duration = endTime - startTime

      expect(result.current.toasts).toHaveLength(25) // Half should remain
      expect(duration).toBeLessThan(50) // Should complete quickly
    })
  })

  describe('Memory Leaks Prevention', () => {
    it('should clear all timers when component unmounts', () => {
      const { result, unmount } = renderHook(() => useToast())

      act(() => {
        result.current.toast({ title: 'Toast 1' })
        result.current.toast({ title: 'Toast 2' })
        result.current.toast({ title: 'Toast 3' })
      })

      expect(result.current.toasts).toHaveLength(3)

      // Unmount before auto-dismissal
      unmount()

      // Advance timers - should not cause issues
      act(() => {
        timerMocks.advanceTimers(5000)
      })

      // Should not crash or cause memory leaks
    })

    it('should not leak memory with many toasts over time', () => {
      const { result } = renderHook(() => useToast())

      // Create and auto-dismiss many toasts
      for (let batch = 0; batch < 10; batch++) {
        act(() => {
          for (let i = 0; i < 10; i++) {
            result.current.toast({ title: `Batch ${batch} Toast ${i}` })
          }
        })

        // Let them auto-dismiss
        act(() => {
          timerMocks.advanceTimers(5000)
        })

        expect(result.current.toasts).toHaveLength(0)
      }

      // Should not accumulate memory or timers
    })
  })
})