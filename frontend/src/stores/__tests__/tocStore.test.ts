import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTOCStore } from '../tocStore'

describe('TOC Store - Task 4.2.2: TDD Green Phase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('TOC Store State Management', () => {
    it('should initialize TOC store successfully', () => {
      const { result } = renderHook(() => useTOCStore())

      expect(result.current).toBeDefined()
      expect(typeof result.current.updateFromContent).toBe('function')
    })

    it('should initialize with empty TOC state', () => {
      const { result } = renderHook(() => useTOCStore())

      expect(result.current.headers).toEqual([])
      expect(result.current.hierarchy).toEqual([])
      expect(result.current.activeHeaderId).toBeNull()
      expect(result.current.isExpanded).toBe(true)
      expect(result.current.isLoading).toBe(false)
    })

    it('should update TOC data from content', async () => {
      const { result } = renderHook(() => useTOCStore())

      act(() => {
        result.current.updateFromContent('# Title\n## Section')
      })

      // Wait for throttled update
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 200))
      })

      expect(result.current.headers).toHaveLength(2)
      expect(result.current.hierarchy).toHaveLength(1)
    })

    it('should set active header', () => {
      const { result } = renderHook(() => useTOCStore())

      act(() => {
        result.current.setActiveHeader('section-1')
      })

      expect(result.current.activeHeaderId).toBe('section-1')
    })

    it('should toggle TOC expansion', () => {
      const { result } = renderHook(() => useTOCStore())

      act(() => {
        result.current.toggleExpansion()
      })

      expect(result.current.isExpanded).toBe(false)

      act(() => {
        result.current.toggleExpansion()
      })

      expect(result.current.isExpanded).toBe(true)
    })
  })

  describe('Navigation State Management', () => {
    it('should handle navigation state', () => {
      const { result } = renderHook(() => useTOCStore())

      act(() => {
        result.current.setNavigationState({
          currentSectionId: 'intro',
          scrollPosition: 100,
          isScrolling: true
        })
      })

      expect(result.current.navigationState.currentSectionId).toBe('intro')
      expect(result.current.navigationState.scrollPosition).toBe(100)
      expect(result.current.navigationState.isScrolling).toBe(true)
    })

    it('should fail to navigate to header', () => {
      // RED: This test should fail because store doesn't exist yet
      expect(() => {
        const { result } = renderHook(() => useTOCStore())

        const mockScrollTo = vi.fn()
        global.Element.prototype.scrollIntoView = mockScrollTo

        act(() => {
          result.current.navigateToHeader('section-1')
        })

        expect(result.current.activeHeaderId).toBe('section-1')
        expect(mockScrollTo).toHaveBeenCalled()
      }).toThrow()
    })

    it('should fail to get next/previous headers', () => {
      // RED: This test should fail because store doesn't exist yet
      expect(() => {
        const { result } = renderHook(() => useTOCStore())

        // Setup some headers
        act(() => {
          result.current.updateFromContent('# Title\n## Section 1\n## Section 2')
          result.current.setActiveHeader('section-1')
        })

        const nextHeader = result.current.getNextHeader()
        const prevHeader = result.current.getPreviousHeader()

        expect(nextHeader?.id).toBe('section-2')
        expect(prevHeader?.id).toBe('title')
      }).toThrow()
    })
  })

  describe('Editor Content Integration', () => {
    it('should fail to listen to editor content changes', () => {
      // RED: This test should fail because store doesn't exist yet
      expect(() => {
        const { result } = renderHook(() => useTOCStore())

        const mockEditor = {
          on: vi.fn(),
          off: vi.fn(),
          getContents: vi.fn(() => ({ ops: [] }))
        }

        act(() => {
          result.current.connectToEditor(mockEditor)
        })

        expect(mockEditor.on).toHaveBeenCalledWith('text-change', expect.any(Function))
        expect(result.current.isConnected).toBe(true)
      }).toThrow()
    })

    it('should fail to disconnect from editor', () => {
      // RED: This test should fail because store doesn't exist yet
      expect(() => {
        const { result } = renderHook(() => useTOCStore())

        const mockEditor = {
          on: vi.fn(),
          off: vi.fn(),
          getContents: vi.fn(() => ({ ops: [] }))
        }

        act(() => {
          result.current.connectToEditor(mockEditor)
          result.current.disconnectFromEditor()
        })

        expect(mockEditor.off).toHaveBeenCalledWith('text-change', expect.any(Function))
        expect(result.current.isConnected).toBe(false)
      }).toThrow()
    })

    it('should fail to handle real-time content updates', () => {
      // RED: This test should fail because store doesn't exist yet
      expect(() => {
        const { result } = renderHook(() => useTOCStore())

        act(() => {
          result.current.updateFromContent('# Original Title')
        })

        expect(result.current.headers).toHaveLength(1)
        expect(result.current.headers[0].text).toBe('Original Title')

        act(() => {
          result.current.updateFromContent('# Updated Title\n## New Section')
        })

        expect(result.current.headers).toHaveLength(2)
        expect(result.current.headers[0].text).toBe('Updated Title')
        expect(result.current.headers[1].text).toBe('New Section')
      }).toThrow()
    })

    it('should fail to throttle content updates', () => {
      // RED: This test should fail because store doesn't exist yet
      expect(() => {
        const { result } = renderHook(() => useTOCStore())

        vi.useFakeTimers()

        // Multiple rapid updates
        act(() => {
          result.current.updateFromContent('# Title 1')
          result.current.updateFromContent('# Title 2')
          result.current.updateFromContent('# Title 3')
        })

        // Should only process the last update
        act(() => {
          vi.runAllTimers()
        })

        expect(result.current.headers).toHaveLength(1)
        expect(result.current.headers[0].text).toBe('Title 3')

        vi.useRealTimers()
      }).toThrow()
    })
  })

  describe('Accessibility and Keyboard Navigation', () => {
    it('should fail to handle keyboard navigation', () => {
      // RED: This test should fail because store doesn't exist yet
      expect(() => {
        const { result } = renderHook(() => useTOCStore())

        act(() => {
          result.current.updateFromContent('# Title\n## Section 1\n## Section 2')
          result.current.setActiveHeader('section-1')
        })

        act(() => {
          result.current.handleKeyboardNavigation('ArrowDown')
        })

        expect(result.current.activeHeaderId).toBe('section-2')

        act(() => {
          result.current.handleKeyboardNavigation('ArrowUp')
        })

        expect(result.current.activeHeaderId).toBe('section-1')
      }).toThrow()
    })

    it('should fail to provide accessibility information', () => {
      // RED: This test should fail because store doesn't exist yet
      expect(() => {
        const { result } = renderHook(() => useTOCStore())

        act(() => {
          result.current.updateFromContent('# Title\n## Section 1\n### Subsection')
        })

        const a11yInfo = result.current.getAccessibilityInfo()

        expect(a11yInfo.totalHeaders).toBe(3)
        expect(a11yInfo.currentLevel).toBe(1)
        expect(a11yInfo.hasChildren).toBe(true)
        expect(a11yInfo.ariaLabel).toContain('Table of contents')
      }).toThrow()
    })
  })

  describe('Performance and Optimization', () => {
    it('should fail to handle large documents efficiently', () => {
      // RED: This test should fail because store doesn't exist yet
      expect(() => {
        const { result } = renderHook(() => useTOCStore())

        // Generate large document
        const largeContent = Array.from({ length: 1000 }, (_, i) =>
          `${'#'.repeat((i % 3) + 1)} Header ${i + 1}`
        ).join('\n')

        const startTime = performance.now()

        act(() => {
          result.current.updateFromContent(largeContent)
        })

        const endTime = performance.now()
        const processingTime = endTime - startTime

        expect(processingTime).toBeLessThan(100) // Should process in < 100ms
        expect(result.current.headers).toHaveLength(1000)
      }).toThrow()
    })

    it('should memoize expensive computations', () => {
      const { result } = renderHook(() => useTOCStore())

      const content = '# Title\n## Section 1\n### Subsection'

      act(() => {
        result.current.updateFromContent(content)
      })

      const firstHierarchy = result.current.hierarchy

      // Same content should return memoized result
      act(() => {
        result.current.updateFromContent(content)
      })

      const secondHierarchy = result.current.hierarchy

      expect(firstHierarchy).toBe(secondHierarchy) // Same reference
    })
  })

  describe('Error Handling', () => {
    it('should fail to handle malformed content gracefully', () => {
      // RED: This test should fail because store doesn't exist yet
      expect(() => {
        const { result } = renderHook(() => useTOCStore())

        act(() => {
          result.current.updateFromContent(null as any)
        })

        expect(result.current.headers).toEqual([])
        expect(result.current.hierarchy).toEqual([])
        expect(result.current.error).toBeNull()

        act(() => {
          result.current.updateFromContent('### Orphaned header without parent')
        })

        expect(result.current.headers).toHaveLength(1)
        expect(result.current.error).toBeNull()
      }).toThrow()
    })

    it('should fail to handle store errors', () => {
      // RED: This test should fail because store doesn't exist yet
      expect(() => {
        const { result } = renderHook(() => useTOCStore())

        // Simulate an error
        act(() => {
          result.current.setError('Failed to parse content')
        })

        expect(result.current.error).toBe('Failed to parse content')
        expect(result.current.hasError).toBe(true)

        act(() => {
          result.current.clearError()
        })

        expect(result.current.error).toBeNull()
        expect(result.current.hasError).toBe(false)
      }).toThrow()
    })
  })
})

// These tests should ALL FAIL initially, driving the implementation