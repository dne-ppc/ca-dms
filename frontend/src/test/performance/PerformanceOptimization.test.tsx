/**
 * Performance Optimization Tests - TDD Red Phase
 * Tests for React.memo, bundle optimization, and performance monitoring
 */
import { render, renderHook, screen, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { ReactNode, useState } from 'react'

import {
  usePerformanceOptimization,
  useComponentPerformance,
  useBundleOptimization,
  useRenderOptimization,
  PerformanceProvider,
  withPerformanceOptimization,
  optimizedMemo
} from '../../hooks/usePerformanceOptimization'

// Mock performance API
const mockPerformance = {
  now: vi.fn(() => Date.now()),
  mark: vi.fn(),
  measure: vi.fn(),
  getEntriesByType: vi.fn(() => []),
  getEntriesByName: vi.fn(() => []),
  observer: vi.fn()
}

Object.defineProperty(global, 'performance', {
  value: mockPerformance,
  writable: true
})

// Mock intersection observer for lazy loading
const mockIntersectionObserver = vi.fn()
mockIntersectionObserver.mockReturnValue({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
})
window.IntersectionObserver = mockIntersectionObserver

// Test components for performance testing
const ExpensiveComponent = React.memo(({ value, onRender }: { value: number; onRender?: () => void }) => {
  React.useEffect(() => {
    onRender?.()
  })

  // Simulate expensive calculation
  const expensiveValue = React.useMemo(() => {
    let result = value
    for (let i = 0; i < 10000; i++) {
      result += Math.sqrt(i)
    }
    return result
  }, [value])

  return <div data-testid="expensive-component">{expensiveValue}</div>
})

const OptimizedExpensiveComponent = optimizedMemo(ExpensiveComponent, {
  compareProps: (prevProps, nextProps) => prevProps.value === nextProps.value,
  displayName: 'OptimizedExpensiveComponent'
})

const TestComponentWithHOC = withPerformanceOptimization(ExpensiveComponent, {
  measureRender: true,
  measureMount: true,
  optimizeRerender: true
})

// Test wrapper with performance provider
const createPerformanceWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 }
    }
  })

  return ({ children }: { children: ReactNode }) => (
    <PerformanceProvider>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </PerformanceProvider>
  )
}

describe('Performance Optimization - TDD Red Phase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPerformance.now.mockReturnValue(Date.now())
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Performance Optimization Hook', () => {
    it('should provide performance monitoring capabilities', () => {
      const wrapper = createPerformanceWrapper()
      const { result } = renderHook(() => usePerformanceOptimization(), { wrapper })

      expect(typeof result.current.startMeasurement).toBe('function')
      expect(typeof result.current.endMeasurement).toBe('function')
      expect(typeof result.current.measureComponent).toBe('function')
      expect(typeof result.current.getPerformanceMetrics).toBe('function')
      expect(typeof result.current.optimizeBundle).toBe('function')
    })

    it('should measure component render times', async () => {
      const wrapper = createPerformanceWrapper()
      const { result } = renderHook(() => usePerformanceOptimization(), { wrapper })

      await act(async () => {
        result.current.startMeasurement('test-component')
        // Simulate some work
        await new Promise(resolve => setTimeout(resolve, 10))
        result.current.endMeasurement('test-component')
      })

      const metrics = result.current.getPerformanceMetrics()
      expect(metrics.measurements['test-component']).toBeDefined()
      expect(metrics.measurements['test-component'].duration).toBeGreaterThan(0)
    })

    it('should provide bundle optimization recommendations', async () => {
      const wrapper = createPerformanceWrapper()
      const { result } = renderHook(() => usePerformanceOptimization(), { wrapper })

      const recommendations = await act(async () => {
        return result.current.optimizeBundle()
      })

      expect(recommendations.codesplitting).toBeDefined()
      expect(recommendations.treeshaking).toBeDefined()
      expect(recommendations.bundleSize).toBeDefined()
      expect(recommendations.recommendations).toBeInstanceOf(Array)
    })

    it('should track performance metrics over time', async () => {
      const wrapper = createPerformanceWrapper()
      const { result } = renderHook(() => usePerformanceOptimization(), { wrapper })

      // Perform multiple measurements
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          result.current.startMeasurement(`test-${i}`)
          await new Promise(resolve => setTimeout(resolve, 5))
          result.current.endMeasurement(`test-${i}`)
        })
      }

      const metrics = result.current.getPerformanceMetrics()
      expect(Object.keys(metrics.measurements)).toHaveLength(5)
      expect(metrics.averageRenderTime).toBeGreaterThan(0)
      expect(metrics.totalMeasurements).toBe(5)
    })
  })

  describe('Component Performance Hook', () => {
    it('should monitor component render performance', () => {
      const wrapper = createPerformanceWrapper()
      const { result } = renderHook(() => useComponentPerformance('TestComponent'), { wrapper })

      expect(result.current.renderCount).toBe(0)
      expect(result.current.averageRenderTime).toBe(0)
      expect(result.current.lastRenderTime).toBe(0)
      expect(typeof result.current.recordRender).toBe('function')
    })

    it('should track render statistics', async () => {
      const wrapper = createPerformanceWrapper()
      const { result } = renderHook(() => useComponentPerformance('TestComponent'), { wrapper })

      await act(async () => {
        result.current.recordRender(10)
        result.current.recordRender(20)
        result.current.recordRender(30)
      })

      expect(result.current.renderCount).toBe(3)
      expect(result.current.averageRenderTime).toBe(20)
      expect(result.current.lastRenderTime).toBe(30)
    })

    it('should detect performance regressions', async () => {
      const wrapper = createPerformanceWrapper()
      const { result } = renderHook(() => useComponentPerformance('TestComponent', {
        warningThreshold: 50,
        errorThreshold: 100
      }), { wrapper })

      await act(async () => {
        result.current.recordRender(75) // Should trigger warning
      })

      expect(result.current.performanceWarnings).toHaveLength(1)
      expect(result.current.performanceWarnings[0].type).toBe('warning')

      await act(async () => {
        result.current.recordRender(150) // Should trigger error
      })

      expect(result.current.performanceWarnings).toHaveLength(2)
      expect(result.current.performanceWarnings[1].type).toBe('error')
    })
  })

  describe('Bundle Optimization Hook', () => {
    it('should provide bundle analysis capabilities', () => {
      const wrapper = createPerformanceWrapper()
      const { result } = renderHook(() => useBundleOptimization(), { wrapper })

      expect(typeof result.current.analyzeBundleSize).toBe('function')
      expect(typeof result.current.getCodeSplittingRecommendations).toBe('function')
      expect(typeof result.current.optimizeChunks).toBe('function')
      expect(typeof result.current.measureBundleImpact).toBe('function')
    })

    it('should analyze bundle size and provide recommendations', async () => {
      const wrapper = createPerformanceWrapper()
      const { result } = renderHook(() => useBundleOptimization(), { wrapper })

      const analysis = await act(async () => {
        return result.current.analyzeBundleSize()
      })

      expect(analysis.totalSize).toBeDefined()
      expect(analysis.gzippedSize).toBeDefined()
      expect(analysis.chunks).toBeInstanceOf(Array)
      expect(analysis.recommendations).toBeInstanceOf(Array)
    })

    it('should suggest code splitting opportunities', async () => {
      const wrapper = createPerformanceWrapper()
      const { result } = renderHook(() => useBundleOptimization(), { wrapper })

      const recommendations = await act(async () => {
        return result.current.getCodeSplittingRecommendations()
      })

      expect(recommendations.routes).toBeInstanceOf(Array)
      expect(recommendations.components).toBeInstanceOf(Array)
      expect(recommendations.libraries).toBeInstanceOf(Array)
      expect(recommendations.estimatedSavings).toBeGreaterThanOrEqual(0)
    })

    it('should measure bundle impact of changes', async () => {
      const wrapper = createPerformanceWrapper()
      const { result } = renderHook(() => useBundleOptimization(), { wrapper })

      const impact = await act(async () => {
        return result.current.measureBundleImpact(['new-component.js', 'new-library.js'])
      })

      expect(impact.sizeIncrease).toBeDefined()
      expect(impact.performanceImpact).toBeDefined()
      expect(impact.recommendations).toBeInstanceOf(Array)
    })
  })

  describe('Render Optimization Hook', () => {
    it('should provide render optimization utilities', () => {
      const wrapper = createPerformanceWrapper()
      const { result } = renderHook(() => useRenderOptimization(), { wrapper })

      expect(typeof result.current.optimizeComponent).toBe('function')
      expect(typeof result.current.memoizeProps).toBe('function')
      expect(typeof result.current.trackRerender).toBe('function')
      expect(typeof result.current.getOptimizationSuggestions).toBe('function')
    })

    it('should detect unnecessary rerenders', async () => {
      const wrapper = createPerformanceWrapper()
      const { result } = renderHook(() => useRenderOptimization(), { wrapper })

      await act(async () => {
        // Simulate component renders with same props
        result.current.trackRerender('TestComponent', { value: 1, stable: 'constant' })
        result.current.trackRerender('TestComponent', { value: 1, stable: 'constant' })
        result.current.trackRerender('TestComponent', { value: 2, stable: 'constant' })
      })

      const suggestions = result.current.getOptimizationSuggestions('TestComponent')
      expect(suggestions.unnecessaryRerenders).toBeGreaterThan(0)
      expect(suggestions.memoizationOpportunities).toContain('stable')
    })

    it('should suggest memoization strategies', async () => {
      const wrapper = createPerformanceWrapper()
      const { result } = renderHook(() => useRenderOptimization(), { wrapper })

      const memoizedProps = result.current.memoizeProps({
        expensiveObject: { data: 'test', computed: Math.random() },
        simpleValue: 'static',
        callback: () => console.log('test')
      })

      expect(memoizedProps.expensiveObject).toBeDefined()
      expect(memoizedProps.simpleValue).toBe('static')
      expect(typeof memoizedProps.callback).toBe('function')
    })
  })

  describe('Optimized Memo Component', () => {
    it('should prevent unnecessary rerenders', () => {
      const renderSpy = vi.fn()

      const { rerender } = render(
        <OptimizedExpensiveComponent value={10} onRender={renderSpy} />
      )

      expect(renderSpy).toHaveBeenCalledTimes(1)

      // Rerender with same props should not trigger render
      rerender(<OptimizedExpensiveComponent value={10} onRender={renderSpy} />)
      expect(renderSpy).toHaveBeenCalledTimes(1)

      // Rerender with different props should trigger render
      rerender(<OptimizedExpensiveComponent value={20} onRender={renderSpy} />)
      expect(renderSpy).toHaveBeenCalledTimes(2)
    })

    it('should use custom comparison function', () => {
      const renderSpy = vi.fn()

      const CustomOptimizedComponent = optimizedMemo(ExpensiveComponent, {
        compareProps: (prev, next) => Math.abs(prev.value - next.value) < 5,
        displayName: 'CustomOptimized'
      })

      const { rerender } = render(
        <CustomOptimizedComponent value={10} onRender={renderSpy} />
      )

      expect(renderSpy).toHaveBeenCalledTimes(1)

      // Small change should not trigger rerender
      rerender(<CustomOptimizedComponent value={12} onRender={renderSpy} />)
      expect(renderSpy).toHaveBeenCalledTimes(1)

      // Large change should trigger rerender
      rerender(<CustomOptimizedComponent value={20} onRender={renderSpy} />)
      expect(renderSpy).toHaveBeenCalledTimes(2)
    })
  })

  describe('Performance HOC', () => {
    it('should measure component performance automatically', async () => {
      const renderSpy = vi.fn()

      render(<TestComponentWithHOC value={10} onRender={renderSpy} />)

      expect(mockPerformance.mark).toHaveBeenCalled()
      expect(renderSpy).toHaveBeenCalledTimes(1)
    })

    it('should provide performance metrics for wrapped components', async () => {
      const wrapper = createPerformanceWrapper()
      const { result } = renderHook(() => usePerformanceOptimization(), { wrapper })

      const Wrapper = wrapper
      render(
        <Wrapper>
          <TestComponentWithHOC value={10} />
        </Wrapper>
      )

      await waitFor(() => {
        const metrics = result.current.getPerformanceMetrics()
        expect(metrics.componentMetrics.ExpensiveComponent).toBeDefined()
      })
    })
  })

  describe('Performance Provider Integration', () => {
    it('should provide global performance configuration', () => {
      const wrapper = createPerformanceWrapper()
      const { result } = renderHook(() => usePerformanceOptimization(), { wrapper })

      expect(result.current.config.enableProfiling).toBeDefined()
      expect(result.current.config.measureRenders).toBeDefined()
      expect(result.current.config.bundleOptimization).toBeDefined()
    })

    it('should collect performance data across components', async () => {
      const wrapper = createPerformanceWrapper()
      const { result } = renderHook(() => usePerformanceOptimization(), { wrapper })

      // Simulate multiple component measurements
      await act(async () => {
        result.current.measureComponent('Component1', () => {
          // Simulate work
          for (let i = 0; i < 1000; i++) Math.random()
        })
        result.current.measureComponent('Component2', () => {
          // Simulate work
          for (let i = 0; i < 2000; i++) Math.random()
        })
      })

      const metrics = result.current.getPerformanceMetrics()
      expect(metrics.componentMetrics.Component1).toBeDefined()
      expect(metrics.componentMetrics.Component2).toBeDefined()
      expect(metrics.componentMetrics.Component2.averageTime).toBeGreaterThan(
        metrics.componentMetrics.Component1.averageTime
      )
    })
  })

  describe('Performance Monitoring Integration', () => {
    it('should integrate with browser performance API', async () => {
      const wrapper = createPerformanceWrapper()
      const { result } = renderHook(() => usePerformanceOptimization(), { wrapper })

      await act(async () => {
        result.current.startMeasurement('browser-test')
        result.current.endMeasurement('browser-test')
      })

      expect(mockPerformance.mark).toHaveBeenCalledWith('browser-test-start')
      expect(mockPerformance.mark).toHaveBeenCalledWith('browser-test-end')
      expect(mockPerformance.measure).toHaveBeenCalledWith(
        'browser-test',
        'browser-test-start',
        'browser-test-end'
      )
    })

    it('should provide real-time performance monitoring', async () => {
      const wrapper = createPerformanceWrapper()
      const { result } = renderHook(() => usePerformanceOptimization(), { wrapper })

      // Enable real-time monitoring
      await act(async () => {
        result.current.enableRealTimeMonitoring({
          sampleRate: 1.0,
          thresholds: { warning: 16, error: 50 }
        })
      })

      expect(result.current.isMonitoring).toBe(true)
      expect(result.current.monitoringConfig.sampleRate).toBe(1.0)
    })

    it('should detect performance bottlenecks', async () => {
      const wrapper = createPerformanceWrapper()
      const { result } = renderHook(() => usePerformanceOptimization(), { wrapper })

      // Simulate slow operations
      await act(async () => {
        for (let i = 0; i < 5; i++) {
          result.current.recordSlowOperation(`slow-op-${i}`, 100 + i * 20)
        }
      })

      const bottlenecks = result.current.getPerformanceBottlenecks()
      expect(bottlenecks.length).toBeGreaterThan(0)
      expect(bottlenecks[0].operation).toBe('slow-op-4') // Slowest operation
      expect(bottlenecks[0].averageTime).toBeGreaterThan(180)
    })
  })

  describe('Bundle Optimization and Code Splitting', () => {
    it('should provide lazy loading utilities', async () => {
      const wrapper = createPerformanceWrapper()
      const { result } = renderHook(() => useBundleOptimization(), { wrapper })

      const LazyComponent = result.current.createLazyComponent(
        () => import('./MockComponent'),
        { fallback: <div>Loading...</div> }
      )

      expect(LazyComponent).toBeDefined()
      expect(LazyComponent.displayName).toContain('Lazy')
    })

    it('should optimize chunk loading strategy', async () => {
      const wrapper = createPerformanceWrapper()
      const { result } = renderHook(() => useBundleOptimization(), { wrapper })

      const strategy = await act(async () => {
        return result.current.optimizeChunks({
          priorityRoutes: ['/dashboard', '/intro'],
          preloadThreshold: 0.5,
          cacheStrategy: 'aggressive'
        })
      })

      expect(strategy.preloadChunks).toBeInstanceOf(Array)
      expect(strategy.lazyChunks).toBeInstanceOf(Array)
      expect(strategy.cacheConfiguration).toBeDefined()
    })

    it('should measure and optimize Core Web Vitals', async () => {
      const wrapper = createPerformanceWrapper()
      const { result } = renderHook(() => usePerformanceOptimization(), { wrapper })

      await act(async () => {
        result.current.measureWebVitals({
          FCP: 1200,
          LCP: 2400,
          FID: 50,
          CLS: 0.1,
          TTFB: 800
        })
      })

      const vitals = result.current.getWebVitals()
      expect(vitals.FCP.score).toBe('good') // < 1800ms
      expect(vitals.LCP.score).toBe('needs-improvement') // 1800-3000ms
      expect(vitals.FID.score).toBe('good') // < 100ms
      expect(vitals.CLS.score).toBe('good') // < 0.1
    })
  })
})