/**
 * Comprehensive tests for useKeyboardNavigation hook
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation'
import {
  setupHookTest,
  createKeyboardEvent,
  createFormElement,
  mockEventListeners
} from '../utils/hookTestUtils'

describe('useKeyboardNavigation', () => {
  setupHookTest()

  let mockCallbacks: {
    onEscape: ReturnType<typeof vi.fn>
    onEnter: ReturnType<typeof vi.fn>
    onTab: ReturnType<typeof vi.fn>
    onArrowKeys: ReturnType<typeof vi.fn>
    onAlt1: ReturnType<typeof vi.fn>
    onCtrlS: ReturnType<typeof vi.fn>
    onCtrlZ: ReturnType<typeof vi.fn>
    onCtrlY: ReturnType<typeof vi.fn>
  }

  let eventListeners: ReturnType<typeof mockEventListeners>

  beforeEach(() => {
    mockCallbacks = {
      onEscape: vi.fn(),
      onEnter: vi.fn(),
      onTab: vi.fn(),
      onArrowKeys: vi.fn(),
      onAlt1: vi.fn(),
      onCtrlS: vi.fn(),
      onCtrlZ: vi.fn(),
      onCtrlY: vi.fn()
    }

    eventListeners = mockEventListeners()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Hook Registration', () => {
    it('should register keydown event listener on mount', () => {
      renderHook(() => useKeyboardNavigation(mockCallbacks))

      expect(eventListeners.addEventListener).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      )
    })

    it('should remove keydown event listener on unmount', () => {
      const { unmount } = renderHook(() => useKeyboardNavigation(mockCallbacks))

      unmount()

      expect(eventListeners.removeEventListener).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      )
    })

    it('should update event listener when options change', () => {
      const { rerender } = renderHook(
        ({ options }) => useKeyboardNavigation(options),
        { initialProps: { options: { onEscape: mockCallbacks.onEscape } } }
      )

      const newCallback = vi.fn()
      rerender({ options: { onEscape: newCallback } })

      // Should remove old listener and add new one
      expect(eventListeners.removeEventListener).toHaveBeenCalled()
      expect(eventListeners.addEventListener).toHaveBeenCalledTimes(2)
    })
  })

  describe('Basic Key Handlers', () => {
    it('should call onEscape when Escape key is pressed', () => {
      renderHook(() => useKeyboardNavigation(mockCallbacks))

      const event = createKeyboardEvent('Escape')
      eventListeners.dispatchEvent('keydown', event)

      expect(mockCallbacks.onEscape).toHaveBeenCalledTimes(1)
    })

    it('should call onEnter when Enter key is pressed on non-form elements', () => {
      renderHook(() => useKeyboardNavigation(mockCallbacks))

      const event = createKeyboardEvent('Enter', {
        target: { tagName: 'DIV' }
      })
      eventListeners.dispatchEvent('keydown', event)

      expect(mockCallbacks.onEnter).toHaveBeenCalledTimes(1)
      expect(event.preventDefault).toHaveBeenCalled()
    })

    it('should call onTab when Tab key is pressed', () => {
      renderHook(() => useKeyboardNavigation(mockCallbacks))

      const event = createKeyboardEvent('Tab')
      eventListeners.dispatchEvent('keydown', event)

      expect(mockCallbacks.onTab).toHaveBeenCalledTimes(1)
    })
  })

  describe('Arrow Key Handlers', () => {
    it('should call onArrowKeys with "up" when ArrowUp is pressed on non-form elements', () => {
      renderHook(() => useKeyboardNavigation(mockCallbacks))

      const event = createKeyboardEvent('ArrowUp', {
        target: { tagName: 'DIV' }
      })
      eventListeners.dispatchEvent('keydown', event)

      expect(mockCallbacks.onArrowKeys).toHaveBeenCalledWith('up')
      expect(event.preventDefault).toHaveBeenCalled()
    })

    it('should call onArrowKeys with "down" when ArrowDown is pressed', () => {
      renderHook(() => useKeyboardNavigation(mockCallbacks))

      const event = createKeyboardEvent('ArrowDown', {
        target: { tagName: 'DIV' }
      })
      eventListeners.dispatchEvent('keydown', event)

      expect(mockCallbacks.onArrowKeys).toHaveBeenCalledWith('down')
      expect(event.preventDefault).toHaveBeenCalled()
    })

    it('should call onArrowKeys with "left" when ArrowLeft is pressed', () => {
      renderHook(() => useKeyboardNavigation(mockCallbacks))

      const event = createKeyboardEvent('ArrowLeft', {
        target: { tagName: 'SPAN' }
      })
      eventListeners.dispatchEvent('keydown', event)

      expect(mockCallbacks.onArrowKeys).toHaveBeenCalledWith('left')
    })

    it('should call onArrowKeys with "right" when ArrowRight is pressed', () => {
      renderHook(() => useKeyboardNavigation(mockCallbacks))

      const event = createKeyboardEvent('ArrowRight', {
        target: { tagName: 'P' }
      })
      eventListeners.dispatchEvent('keydown', event)

      expect(mockCallbacks.onArrowKeys).toHaveBeenCalledWith('right')
    })
  })

  describe('Modifier Key Combinations', () => {
    it('should call onAlt1 when Alt+1 is pressed', () => {
      renderHook(() => useKeyboardNavigation(mockCallbacks))

      const event = createKeyboardEvent('1', { altKey: true })
      eventListeners.dispatchEvent('keydown', event)

      expect(mockCallbacks.onAlt1).toHaveBeenCalledTimes(1)
      expect(event.preventDefault).toHaveBeenCalled()
    })

    it('should call onCtrlS when Ctrl+S is pressed', () => {
      renderHook(() => useKeyboardNavigation(mockCallbacks))

      const event = createKeyboardEvent('s', { ctrlKey: true })
      eventListeners.dispatchEvent('keydown', event)

      expect(mockCallbacks.onCtrlS).toHaveBeenCalledTimes(1)
      expect(event.preventDefault).toHaveBeenCalled()
    })

    it('should call onCtrlZ when Ctrl+Z is pressed (without Shift)', () => {
      renderHook(() => useKeyboardNavigation(mockCallbacks))

      const event = createKeyboardEvent('z', { ctrlKey: true, shiftKey: false })
      eventListeners.dispatchEvent('keydown', event)

      expect(mockCallbacks.onCtrlZ).toHaveBeenCalledTimes(1)
      expect(event.preventDefault).toHaveBeenCalled()
    })

    it('should NOT call onCtrlZ when Ctrl+Shift+Z is pressed', () => {
      renderHook(() => useKeyboardNavigation(mockCallbacks))

      const event = createKeyboardEvent('z', { ctrlKey: true, shiftKey: true })
      eventListeners.dispatchEvent('keydown', event)

      expect(mockCallbacks.onCtrlZ).not.toHaveBeenCalled()
    })

    it('should call onCtrlY when Ctrl+Y is pressed', () => {
      renderHook(() => useKeyboardNavigation(mockCallbacks))

      const event = createKeyboardEvent('y', { ctrlKey: true })
      eventListeners.dispatchEvent('keydown', event)

      expect(mockCallbacks.onCtrlY).toHaveBeenCalledTimes(1)
      expect(event.preventDefault).toHaveBeenCalled()
    })
  })

  describe('Form Element Prevention', () => {
    it('should NOT call onEnter when Enter is pressed on INPUT element', () => {
      renderHook(() => useKeyboardNavigation(mockCallbacks))

      const event = createKeyboardEvent('Enter', {
        target: { tagName: 'INPUT' }
      })
      eventListeners.dispatchEvent('keydown', event)

      expect(mockCallbacks.onEnter).not.toHaveBeenCalled()
      expect(event.preventDefault).not.toHaveBeenCalled()
    })

    it('should NOT call onEnter when Enter is pressed on TEXTAREA element', () => {
      renderHook(() => useKeyboardNavigation(mockCallbacks))

      const event = createKeyboardEvent('Enter', {
        target: { tagName: 'TEXTAREA' }
      })
      eventListeners.dispatchEvent('keydown', event)

      expect(mockCallbacks.onEnter).not.toHaveBeenCalled()
    })

    it('should NOT call onEnter when Enter is pressed on SELECT element', () => {
      renderHook(() => useKeyboardNavigation(mockCallbacks))

      const event = createKeyboardEvent('Enter', {
        target: { tagName: 'SELECT' }
      })
      eventListeners.dispatchEvent('keydown', event)

      expect(mockCallbacks.onEnter).not.toHaveBeenCalled()
    })

    it('should NOT call onEnter when Enter is pressed on contentEditable element', () => {
      renderHook(() => useKeyboardNavigation(mockCallbacks))

      const event = createKeyboardEvent('Enter', {
        target: { tagName: 'DIV', contentEditable: 'true' }
      })
      eventListeners.dispatchEvent('keydown', event)

      expect(mockCallbacks.onEnter).not.toHaveBeenCalled()
    })

    it('should NOT call onEnter when Enter is pressed on Quill editor element', () => {
      renderHook(() => useKeyboardNavigation(mockCallbacks))

      const event = createKeyboardEvent('Enter', {
        target: {
          tagName: 'DIV',
          classList: { contains: vi.fn().mockReturnValue(true) }
        }
      })
      eventListeners.dispatchEvent('keydown', event)

      expect(mockCallbacks.onEnter).not.toHaveBeenCalled()
    })

    it('should NOT call onArrowKeys when arrow keys are pressed on INPUT element', () => {
      renderHook(() => useKeyboardNavigation(mockCallbacks))

      const event = createKeyboardEvent('ArrowUp', {
        target: { tagName: 'INPUT' }
      })
      eventListeners.dispatchEvent('keydown', event)

      expect(mockCallbacks.onArrowKeys).not.toHaveBeenCalled()
      expect(event.preventDefault).not.toHaveBeenCalled()
    })

    it('should NOT call onArrowKeys when arrow keys are pressed on TEXTAREA element', () => {
      renderHook(() => useKeyboardNavigation(mockCallbacks))

      const event = createKeyboardEvent('ArrowDown', {
        target: { tagName: 'TEXTAREA' }
      })
      eventListeners.dispatchEvent('keydown', event)

      expect(mockCallbacks.onArrowKeys).not.toHaveBeenCalled()
    })

    it('should NOT call onArrowKeys when arrow keys are pressed on contentEditable element', () => {
      renderHook(() => useKeyboardNavigation(mockCallbacks))

      const event = createKeyboardEvent('ArrowLeft', {
        target: { tagName: 'DIV', contentEditable: 'true' }
      })
      eventListeners.dispatchEvent('keydown', event)

      expect(mockCallbacks.onArrowKeys).not.toHaveBeenCalled()
    })
  })

  describe('Optional Callbacks', () => {
    it('should work with only some callbacks provided', () => {
      const partialCallbacks = {
        onEscape: mockCallbacks.onEscape,
        onCtrlS: mockCallbacks.onCtrlS
      }

      renderHook(() => useKeyboardNavigation(partialCallbacks))

      // Should work for provided callbacks
      const escapeEvent = createKeyboardEvent('Escape')
      eventListeners.dispatchEvent('keydown', escapeEvent)
      expect(mockCallbacks.onEscape).toHaveBeenCalled()

      const ctrlSEvent = createKeyboardEvent('s', { ctrlKey: true })
      eventListeners.dispatchEvent('keydown', ctrlSEvent)
      expect(mockCallbacks.onCtrlS).toHaveBeenCalled()

      // Should not crash for missing callbacks
      const enterEvent = createKeyboardEvent('Enter')
      eventListeners.dispatchEvent('keydown', enterEvent)
      // Should not throw error
    })

    it('should work with empty options object', () => {
      expect(() => {
        renderHook(() => useKeyboardNavigation({}))
      }).not.toThrow()

      // Events should not crash the hook
      const event = createKeyboardEvent('Escape')
      eventListeners.dispatchEvent('keydown', event)
    })
  })

  describe('Event Bubbling and Prevention', () => {
    it('should prevent default for Enter on non-form elements', () => {
      renderHook(() => useKeyboardNavigation(mockCallbacks))

      const event = createKeyboardEvent('Enter', {
        target: { tagName: 'DIV' }
      })
      event.preventDefault = vi.fn()

      eventListeners.dispatchEvent('keydown', event)

      expect(event.preventDefault).toHaveBeenCalled()
    })

    it('should prevent default for arrow keys on non-form elements', () => {
      renderHook(() => useKeyboardNavigation(mockCallbacks))

      const event = createKeyboardEvent('ArrowUp', {
        target: { tagName: 'DIV' }
      })
      event.preventDefault = vi.fn()

      eventListeners.dispatchEvent('keydown', event)

      expect(event.preventDefault).toHaveBeenCalled()
    })

    it('should prevent default for modifier key combinations', () => {
      renderHook(() => useKeyboardNavigation(mockCallbacks))

      const events = [
        createKeyboardEvent('1', { altKey: true }),
        createKeyboardEvent('s', { ctrlKey: true }),
        createKeyboardEvent('z', { ctrlKey: true }),
        createKeyboardEvent('y', { ctrlKey: true })
      ]

      events.forEach(event => {
        event.preventDefault = vi.fn()
        eventListeners.dispatchEvent('keydown', event)
        expect(event.preventDefault).toHaveBeenCalled()
      })
    })

    it('should NOT prevent default for Tab key', () => {
      renderHook(() => useKeyboardNavigation(mockCallbacks))

      const event = createKeyboardEvent('Tab')
      event.preventDefault = vi.fn()

      eventListeners.dispatchEvent('keydown', event)

      expect(event.preventDefault).not.toHaveBeenCalled()
    })

    it('should NOT prevent default for Escape key', () => {
      renderHook(() => useKeyboardNavigation(mockCallbacks))

      const event = createKeyboardEvent('Escape')
      event.preventDefault = vi.fn()

      eventListeners.dispatchEvent('keydown', event)

      expect(event.preventDefault).not.toHaveBeenCalled()
    })
  })

  describe('Complex Scenarios', () => {
    it('should handle rapid key presses correctly', () => {
      renderHook(() => useKeyboardNavigation(mockCallbacks))

      // Simulate rapid key presses
      for (let i = 0; i < 10; i++) {
        const event = createKeyboardEvent('Escape')
        eventListeners.dispatchEvent('keydown', event)
      }

      expect(mockCallbacks.onEscape).toHaveBeenCalledTimes(10)
    })

    it('should handle mixed key combinations', () => {
      renderHook(() => useKeyboardNavigation(mockCallbacks))

      // Test various combinations
      const events = [
        createKeyboardEvent('s', { ctrlKey: true }),
        createKeyboardEvent('ArrowUp'),
        createKeyboardEvent('1', { altKey: true }),
        createKeyboardEvent('Enter'),
        createKeyboardEvent('z', { ctrlKey: true }),
        createKeyboardEvent('Tab')
      ]

      events.forEach(event => {
        eventListeners.dispatchEvent('keydown', event)
      })

      expect(mockCallbacks.onCtrlS).toHaveBeenCalledTimes(1)
      expect(mockCallbacks.onArrowKeys).toHaveBeenCalledWith('up')
      expect(mockCallbacks.onAlt1).toHaveBeenCalledTimes(1)
      expect(mockCallbacks.onEnter).toHaveBeenCalledTimes(1)
      expect(mockCallbacks.onCtrlZ).toHaveBeenCalledTimes(1)
      expect(mockCallbacks.onTab).toHaveBeenCalledTimes(1)
    })

    it('should handle case sensitivity correctly', () => {
      renderHook(() => useKeyboardNavigation(mockCallbacks))

      // Test both uppercase and lowercase
      const lowerEvent = createKeyboardEvent('s', { ctrlKey: true })
      const upperEvent = createKeyboardEvent('S', { ctrlKey: true })

      eventListeners.dispatchEvent('keydown', lowerEvent)
      eventListeners.dispatchEvent('keydown', upperEvent)

      // Should work for both cases
      expect(mockCallbacks.onCtrlS).toHaveBeenCalledTimes(2)
    })
  })

  describe('Edge Cases', () => {
    it('should handle null/undefined target gracefully', () => {
      renderHook(() => useKeyboardNavigation(mockCallbacks))

      const event = createKeyboardEvent('Enter')
      Object.defineProperty(event, 'target', { value: null })

      expect(() => {
        eventListeners.dispatchEvent('keydown', event)
      }).not.toThrow()
    })

    it('should handle unknown key presses without errors', () => {
      renderHook(() => useKeyboardNavigation(mockCallbacks))

      const unknownKeys = ['F1', 'Home', 'End', 'PageUp', 'PageDown', 'Insert', 'Delete']

      unknownKeys.forEach(key => {
        expect(() => {
          const event = createKeyboardEvent(key)
          eventListeners.dispatchEvent('keydown', event)
        }).not.toThrow()
      })
    })

    it('should handle events with missing properties', () => {
      renderHook(() => useKeyboardNavigation(mockCallbacks))

      const malformedEvent = {
        key: 's',
        target: { tagName: 'DIV' },
        preventDefault: vi.fn()
        // Missing ctrlKey, altKey, shiftKey
      }

      expect(() => {
        eventListeners.dispatchEvent('keydown', malformedEvent as any)
      }).not.toThrow()
    })
  })

  describe('Performance', () => {
    it('should not create new handler on every render when options are stable', () => {
      const stableOptions = {
        onEscape: mockCallbacks.onEscape,
        onEnter: mockCallbacks.onEnter
      }

      const { rerender } = renderHook(() => useKeyboardNavigation(stableOptions))

      const initialCallCount = eventListeners.addEventListener.mock.calls.length

      // Re-render with same options
      rerender()

      // Should not add new event listeners
      expect(eventListeners.addEventListener.mock.calls.length).toBe(initialCallCount)
    })

    it('should handle high-frequency events efficiently', () => {
      renderHook(() => useKeyboardNavigation(mockCallbacks))

      const startTime = performance.now()

      // Simulate 1000 rapid events
      for (let i = 0; i < 1000; i++) {
        const event = createKeyboardEvent('Escape')
        eventListeners.dispatchEvent('keydown', event)
      }

      const endTime = performance.now()
      const duration = endTime - startTime

      // Should complete in reasonable time (less than 100ms)
      expect(duration).toBeLessThan(100)
      expect(mockCallbacks.onEscape).toHaveBeenCalledTimes(1000)
    })
  })
})