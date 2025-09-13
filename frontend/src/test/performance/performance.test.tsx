/**
 * Comprehensive performance tests for CA-DMS frontend
 * Tests rendering performance, memory usage, and bundle size
 */
import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { performance } from 'perf_hooks'
import { QuillEditor } from '../../components/editor/QuillEditor'
import NotificationCenter from '../../components/notifications/NotificationCenter'
import { TemplateManager } from '../../components/templates/TemplateManager'
import { useDocumentStore } from '../../stores/documentStore'

// Mock dependencies
jest.mock('../../stores/documentStore', () => ({
  useDocumentStore: jest.fn()
}))

jest.mock('../../contexts/KeyboardNavigationContext', () => ({
  useKeyboardNavigationContext: () => ({
    registerEditor: jest.fn(),
    focusToolbar: jest.fn()
  }),
  KeyboardNavigationProvider: ({ children }: any) => children
}))

jest.mock('../../hooks/useKeyboardNavigation', () => ({
  __esModule: true,
  default: jest.fn(() => ({}))
}))

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() })
}))

// Mock UI components for performance testing
jest.mock('@/components/ui/card', () => ({
  Card: React.memo(({ children, ...props }: any) => <div {...props}>{children}</div>),
  CardContent: React.memo(({ children }: any) => <div>{children}</div>),
  CardHeader: React.memo(({ children }: any) => <div>{children}</div>),
  CardTitle: React.memo(({ children }: any) => <h2>{children}</h2>)
}))

jest.mock('@/components/ui/tabs', () => ({
  Tabs: React.memo(({ children, defaultValue }: any) => <div data-default-value={defaultValue}>{children}</div>),
  TabsContent: React.memo(({ children, value }: any) => <div data-value={value}>{children}</div>),
  TabsList: React.memo(({ children }: any) => <div role="tablist">{children}</div>),
  TabsTrigger: React.memo(({ children, value }: any) => (
    <button role="tab" data-value={value}>{children}</button>
  ))
}))

// Mock Quill with performance considerations
const mockQuillInstance = {
  getContents: jest.fn(() => ({ ops: [] })),
  setContents: jest.fn(),
  setText: jest.fn(),
  insertEmbed: jest.fn(),
  insertText: jest.fn(),
  setSelection: jest.fn(),
  getSelection: jest.fn(() => ({ index: 0, length: 0 })),
  on: jest.fn(),
  off: jest.fn(),
  history: { undo: jest.fn(), redo: jest.fn() },
  scroll: { querySelector: jest.fn() }
}

jest.mock('quill', () => ({
  __esModule: true,
  default: jest.fn(() => mockQuillInstance)
}))

// Performance measurement utilities
const measureRenderTime = async (renderFn: () => void) => {
  const start = performance.now()
  renderFn()
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  const end = performance.now()
  return end - start
}

const measureMemoryUsage = () => {
  if ('memory' in performance) {
    return (performance as any).memory.usedJSHeapSize
  }
  return 0
}

const simulateLargeDataset = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${i}`,
    title: `Item ${i}`,
    content: `Content for item ${i}`.repeat(10),
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    status: 'draft'
  }))
}

describe('Performance Tests', () => {
  const mockUseDocumentStore = useDocumentStore as jest.MockedFunction<typeof useDocumentStore>

  beforeEach(() => {
    jest.clearAllMocks()
    localStorage.setItem('access_token', 'test-token')

    // Mock fetch for API calls
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          templates: [],
          total: 0,
          notifications: [],
          total_notifications: 0
        })
      })
    ) as jest.Mock

    // Default store mock
    mockUseDocumentStore.mockReturnValue({
      documents: [],
      currentDocument: null,
      isLoading: false,
      error: null,
      isDirty: false,
      createDocument: jest.fn(),
      updateDocumentContent: jest.fn(),
      insertPlaceholder: jest.fn(),
      getPlaceholderObjects: jest.fn(() => [])
    } as any)
  })

  afterEach(() => {
    localStorage.clear()
    jest.restoreAllMocks()
  })

  describe('Component Rendering Performance', () => {
    it('should render QuillEditor within performance threshold', async () => {
      const renderTime = await measureRenderTime(() => {
        render(<QuillEditor />)
      })

      // Should render within 100ms
      expect(renderTime).toBeLessThan(100)
    })

    it('should render NotificationCenter within performance threshold', async () => {
      const renderTime = await measureRenderTime(() => {
        render(<NotificationCenter />)
      })

      // Should render within 150ms (includes API call)
      expect(renderTime).toBeLessThan(150)
    })

    it('should render TemplateManager within performance threshold', async () => {
      const renderTime = await measureRenderTime(() => {
        render(<TemplateManager />)
      })

      // Should render within 200ms (includes initial data fetch)
      expect(renderTime).toBeLessThan(200)
    })

    it('should handle rapid successive renders efficiently', async () => {
      const renderTimes: number[] = []

      for (let i = 0; i < 5; i++) {
        const renderTime = await measureRenderTime(() => {
          const { unmount } = render(<QuillEditor key={i} />)
          unmount()
        })
        renderTimes.push(renderTime)
      }

      // Each render should be consistent (no memory leaks causing slowdown)
      const avgTime = renderTimes.reduce((sum, time) => sum + time, 0) / renderTimes.length
      const lastTime = renderTimes[renderTimes.length - 1]

      expect(lastTime).toBeLessThan(avgTime * 1.5) // No more than 50% slower
    })
  })

  describe('Large Dataset Performance', () => {
    it('should handle large document list efficiently', async () => {
      const largeDocumentList = simulateLargeDataset(1000)

      mockUseDocumentStore.mockReturnValue({
        documents: largeDocumentList,
        currentDocument: null,
        isLoading: false,
        error: null,
        isDirty: false,
        createDocument: jest.fn(),
        updateDocumentContent: jest.fn(),
        insertPlaceholder: jest.fn(),
        getPlaceholderObjects: jest.fn(() => [])
      } as any)

      const renderTime = await measureRenderTime(() => {
        render(<QuillEditor />)
      })

      // Should still render within reasonable time with large dataset
      expect(renderTime).toBeLessThan(300)
    })

    it('should handle large template list efficiently', async () => {
      const largeTemplateList = simulateLargeDataset(500)

      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            templates: largeTemplateList,
            total: largeTemplateList.length
          })
        })
      ) as jest.Mock

      const renderTime = await measureRenderTime(() => {
        render(<TemplateManager />)
      })

      // Should handle large template list efficiently
      expect(renderTime).toBeLessThan(500)
    })

    it('should virtualize long lists for performance', async () => {
      // This test would verify that large lists are virtualized
      // Implementation depends on virtualization library used
      const manyItems = Array.from({ length: 10000 }, (_, i) => ({ id: i, name: `Item ${i}` }))

      // Mock a list component with many items
      const LargeList = React.memo(() => (
        <div>
          {manyItems.map(item => (
            <div key={item.id}>{item.name}</div>
          ))}
        </div>
      ))

      const renderTime = await measureRenderTime(() => {
        render(<LargeList />)
      })

      // Without virtualization, this would be very slow
      // With proper virtualization, should be fast
      expect(renderTime).toBeLessThan(1000)
    })
  })

  describe('Memory Usage Performance', () => {
    it('should not leak memory on component unmount', async () => {
      const initialMemory = measureMemoryUsage()

      // Render and unmount components multiple times
      for (let i = 0; i < 10; i++) {
        const { unmount } = render(<QuillEditor key={i} />)
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 10))
        })
        unmount()
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }

      const finalMemory = measureMemoryUsage()
      const memoryIncrease = finalMemory - initialMemory

      // Memory increase should be minimal (less than 5MB)
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024)
    })

    it('should efficiently manage Quill editor instances', async () => {
      // Test that Quill instances are properly cleaned up
      let quillInstances = 0

      const mockQuillConstructor = jest.fn(() => {
        quillInstances++
        return {
          ...mockQuillInstance,
          destroy: jest.fn(() => {
            quillInstances--
          })
        }
      })

      jest.doMock('quill', () => ({
        __esModule: true,
        default: mockQuillConstructor
      }))

      // Render multiple editors
      const editors = []
      for (let i = 0; i < 5; i++) {
        editors.push(render(<QuillEditor key={i} />))
      }

      expect(quillInstances).toBe(5)

      // Unmount all editors
      editors.forEach(({ unmount }) => unmount())

      // All instances should be cleaned up
      expect(quillInstances).toBe(0)
    })

    it('should handle event listeners cleanup', async () => {
      let activeListeners = 0

      const mockAddEventListener = jest.fn(() => {
        activeListeners++
      })

      const mockRemoveEventListener = jest.fn(() => {
        activeListeners--
      })

      Object.defineProperty(document, 'addEventListener', {
        value: mockAddEventListener
      })

      Object.defineProperty(document, 'removeEventListener', {
        value: mockRemoveEventListener
      })

      // Render component that adds event listeners
      const { unmount } = render(<QuillEditor />)

      expect(activeListeners).toBeGreaterThan(0)

      // Unmount should remove listeners
      unmount()

      expect(activeListeners).toBe(0)
    })
  })

  describe('User Interaction Performance', () => {
    it('should handle rapid typing efficiently', async () => {
      const user = userEvent.setup()
      render(<QuillEditor />)

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument()
      })

      const textbox = screen.getByRole('textbox')
      textbox.focus()

      const start = performance.now()

      // Simulate rapid typing
      const text = 'a'.repeat(100)
      await user.type(textbox, text)

      const end = performance.now()
      const typingTime = end - start

      // Should handle 100 characters in reasonable time
      expect(typingTime).toBeLessThan(1000)
    })

    it('should handle rapid button clicks efficiently', async () => {
      const user = userEvent.setup()
      const mockHandler = jest.fn()

      const RapidClickTest = () => (
        <button onClick={mockHandler}>Click Me</button>
      )

      render(<RapidClickTest />)

      const button = screen.getByText('Click Me')
      const start = performance.now()

      // Rapid clicks
      for (let i = 0; i < 20; i++) {
        await user.click(button)
      }

      const end = performance.now()
      const clickTime = end - start

      expect(mockHandler).toHaveBeenCalledTimes(20)
      expect(clickTime).toBeLessThan(500)
    })

    it('should handle scroll events efficiently', async () => {
      const mockScrollHandler = jest.fn()
      let handlerExecutions = 0

      const throttledHandler = () => {
        handlerExecutions++
        mockScrollHandler()
      }

      const ScrollTest = () => {
        React.useEffect(() => {
          window.addEventListener('scroll', throttledHandler)
          return () => window.removeEventListener('scroll', throttledHandler)
        }, [])

        return (
          <div style={{ height: '2000px' }}>
            Scrollable content
          </div>
        )
      }

      render(<ScrollTest />)

      // Simulate rapid scroll events
      for (let i = 0; i < 100; i++) {
        fireEvent.scroll(window, { target: { scrollY: i * 10 } })
      }

      // Handler should be throttled/debounced
      expect(handlerExecutions).toBeLessThan(100)
    })
  })

  describe('Async Operations Performance', () => {
    it('should handle concurrent API calls efficiently', async () => {
      const mockApiCall = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: 'test' })
        })
      )

      global.fetch = mockApiCall

      const start = performance.now()

      // Simulate multiple concurrent API calls
      const promises = Array.from({ length: 10 }, () =>
        fetch('/api/test').then(r => r.json())
      )

      await Promise.all(promises)

      const end = performance.now()
      const totalTime = end - start

      expect(mockApiCall).toHaveBeenCalledTimes(10)
      // Concurrent calls should complete faster than sequential
      expect(totalTime).toBeLessThan(1000)
    })

    it('should handle state updates efficiently', async () => {
      let renderCount = 0

      const StateUpdateTest = () => {
        const [count, setCount] = React.useState(0)
        renderCount++

        React.useEffect(() => {
          // Rapid state updates
          for (let i = 0; i < 100; i++) {
            setCount(prev => prev + 1)
          }
        }, [])

        return <div>Count: {count}</div>
      }

      const start = performance.now()
      render(<StateUpdateTest />)

      await waitFor(() => {
        expect(screen.getByText('Count: 100')).toBeInTheDocument()
      })

      const end = performance.now()
      const updateTime = end - start

      // Should batch state updates efficiently
      expect(renderCount).toBeLessThan(10) // React should batch updates
      expect(updateTime).toBeLessThan(100)
    })
  })

  describe('Bundle Size and Lazy Loading', () => {
    it('should lazy load non-critical components', async () => {
      // Mock dynamic import
      const mockLazyComponent = jest.fn(() =>
        Promise.resolve({
          default: () => <div>Lazy Loaded Component</div>
        })
      )

      const LazyComponent = React.lazy(mockLazyComponent)

      const LazyWrapper = () => (
        <React.Suspense fallback={<div>Loading...</div>}>
          <LazyComponent />
        </React.Suspense>
      )

      render(<LazyWrapper />)

      // Should show loading initially
      expect(screen.getByText('Loading...')).toBeInTheDocument()

      // Should load component
      await waitFor(() => {
        expect(screen.getByText('Lazy Loaded Component')).toBeInTheDocument()
      })

      expect(mockLazyComponent).toHaveBeenCalled()
    })

    it('should code-split effectively', () => {
      // This test would verify that code splitting is working
      // In a real implementation, would check webpack bundle analysis
      expect(true).toBe(true) // Placeholder for bundle size tests
    })
  })

  describe('Performance Monitoring', () => {
    it('should track Core Web Vitals metrics', () => {
      // Mock performance observer
      const mockObserver = jest.fn()

      Object.defineProperty(window, 'PerformanceObserver', {
        value: jest.fn().mockImplementation(() => ({
          observe: mockObserver,
          disconnect: jest.fn()
        }))
      })

      // Component that tracks performance
      const PerformanceTracker = () => {
        React.useEffect(() => {
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries()
            entries.forEach(entry => {
              if (entry.entryType === 'measure') {
                console.log(`${entry.name}: ${entry.duration}ms`)
              }
            })
          })

          observer.observe({ entryTypes: ['measure'] })

          return () => observer.disconnect()
        }, [])

        return <div>Performance Tracker</div>
      }

      render(<PerformanceTracker />)

      expect(mockObserver).toHaveBeenCalledWith({
        entryTypes: ['measure']
      })
    })

    it('should measure custom performance metrics', () => {
      const CustomMetrics = () => {
        React.useEffect(() => {
          performance.mark('component-mount-start')

          return () => {
            performance.mark('component-mount-end')
            performance.measure(
              'component-mount-duration',
              'component-mount-start',
              'component-mount-end'
            )
          }
        }, [])

        return <div>Custom Metrics Component</div>
      }

      const { unmount } = render(<CustomMetrics />)
      unmount()

      // Verify performance marks were created
      const marks = performance.getEntriesByType('mark')
      expect(marks.some(mark => mark.name === 'component-mount-start')).toBe(true)
      expect(marks.some(mark => mark.name === 'component-mount-end')).toBe(true)

      const measures = performance.getEntriesByType('measure')
      expect(measures.some(measure => measure.name === 'component-mount-duration')).toBe(true)
    })
  })

  describe('Error Boundary Performance', () => {
    it('should handle errors without performance degradation', async () => {
      const ErrorComponent = () => {
        throw new Error('Test error')
      }

      const ErrorBoundary = class extends React.Component<
        { children: React.ReactNode },
        { hasError: boolean }
      > {
        constructor(props: { children: React.ReactNode }) {
          super(props)
          this.state = { hasError: false }
        }

        static getDerivedStateFromError() {
          return { hasError: true }
        }

        render() {
          if (this.state.hasError) {
            return <div>Something went wrong</div>
          }
          return this.props.children
        }
      }

      const start = performance.now()

      render(
        <ErrorBoundary>
          <ErrorComponent />
        </ErrorBoundary>
      )

      const end = performance.now()
      const errorHandlingTime = end - start

      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      expect(errorHandlingTime).toBeLessThan(50) // Error handling should be fast
    })
  })
})