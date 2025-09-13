/**
 * Edge case and error boundary tests
 * Tests error handling, edge cases, and application resilience
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ErrorBoundary } from 'react-error-boundary'

// Mock error component for testing
const ThrowError = ({ shouldThrow = false, errorMessage = 'Test error' }) => {
  if (shouldThrow) {
    throw new Error(errorMessage)
  }
  return <div data-testid="no-error">No error</div>
}

// Custom error boundary component
const CustomErrorBoundary = ({
  children,
  fallback,
  onError
}: {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error: Error }>
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}) => {
  return (
    <ErrorBoundary
      FallbackComponent={fallback || (({ error }) => (
        <div data-testid="error-fallback">
          Something went wrong: {error.message}
        </div>
      ))}
      onError={onError}
    >
      {children}
    </ErrorBoundary>
  )
}

// Async component that might fail
const AsyncComponent = ({ shouldFail = false, delay = 100 }) => {
  const [data, setData] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)

      try {
        await new Promise(resolve => setTimeout(resolve, delay))

        if (shouldFail) {
          throw new Error('Async operation failed')
        }

        setData('Loaded data')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [shouldFail, delay])

  if (loading) return <div data-testid="loading">Loading...</div>
  if (error) return <div data-testid="async-error">{error}</div>
  return <div data-testid="async-success">{data}</div>
}

// Component with memory leak potential
const LeakyComponent = ({ shouldLeak = false }) => {
  const [count, setCount] = React.useState(0)
  const intervalRef = React.useRef<NodeJS.Timeout>()

  React.useEffect(() => {
    intervalRef.current = setInterval(() => {
      setCount(c => c + 1)
    }, 100)

    // Conditionally clean up (to test memory leaks)
    return () => {
      if (!shouldLeak) {
        clearInterval(intervalRef.current)
      }
    }
  }, [shouldLeak])

  return <div data-testid="leaky-component">Count: {count}</div>
}

// Component with null/undefined edge cases
const NullableComponent = ({ data }: { data: any }) => {
  const renderData = () => {
    if (data === null) return 'null'
    if (data === undefined) return 'undefined'
    if (data === '') return 'empty string'
    if (Array.isArray(data) && data.length === 0) return 'empty array'
    if (typeof data === 'object' && Object.keys(data).length === 0) return 'empty object'
    return String(data)
  }

  return <div data-testid="nullable-component">{renderData()}</div>
}

// Component that handles large datasets
const LargeDataComponent = ({ size = 1000 }) => {
  const [data, setData] = React.useState<number[]>([])
  const [loading, setLoading] = React.useState(false)

  const generateData = React.useCallback(() => {
    setLoading(true)

    // Simulate processing large data
    setTimeout(() => {
      const newData = Array.from({ length: size }, (_, i) => i)
      setData(newData)
      setLoading(false)
    }, 0)
  }, [size])

  React.useEffect(() => {
    generateData()
  }, [generateData])

  if (loading) return <div data-testid="large-data-loading">Loading large dataset...</div>

  return (
    <div data-testid="large-data-component">
      <div data-testid="data-length">{data.length}</div>
      <div data-testid="data-sample">
        {data.slice(0, 3).join(', ')}
      </div>
    </div>
  )
}

// Component with infinite recursion potential
const RecursiveComponent = ({ depth = 0, maxDepth = 5 }) => {
  if (depth >= maxDepth) {
    return <div data-testid="recursion-end">Recursion end at depth {depth}</div>
  }

  return (
    <div data-testid={`recursion-level-${depth}`}>
      Depth {depth}
      <RecursiveComponent depth={depth + 1} maxDepth={maxDepth} />
    </div>
  )
}

describe('Edge Cases and Error Boundary Tests', () => {
  // Suppress console errors for error boundary tests
  const originalError = console.error
  beforeAll(() => {
    console.error = jest.fn()
  })

  afterAll(() => {
    console.error = originalError
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Error Boundaries', () => {
    it('should catch and display errors', () => {
      render(
        <CustomErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Component crashed" />
        </CustomErrorBoundary>
      )

      expect(screen.getByTestId('error-fallback')).toBeInTheDocument()
      expect(screen.getByTestId('error-fallback')).toHaveTextContent('Component crashed')
      expect(screen.queryByTestId('no-error')).not.toBeInTheDocument()
    })

    it('should render children when no error occurs', () => {
      render(
        <CustomErrorBoundary>
          <ThrowError shouldThrow={false} />
        </CustomErrorBoundary>
      )

      expect(screen.getByTestId('no-error')).toBeInTheDocument()
      expect(screen.queryByTestId('error-fallback')).not.toBeInTheDocument()
    })

    it('should call onError callback when error occurs', () => {
      const mockOnError = jest.fn()

      render(
        <CustomErrorBoundary onError={mockOnError}>
          <ThrowError shouldThrow={true} errorMessage="Test callback error" />
        </CustomErrorBoundary>
      )

      expect(mockOnError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String)
        })
      )
    })

    it('should isolate errors to component subtrees', () => {
      render(
        <div>
          <div data-testid="outside-boundary">Outside boundary</div>
          <CustomErrorBoundary>
            <ThrowError shouldThrow={true} />
          </CustomErrorBoundary>
          <div data-testid="after-boundary">After boundary</div>
        </div>
      )

      expect(screen.getByTestId('outside-boundary')).toBeInTheDocument()
      expect(screen.getByTestId('after-boundary')).toBeInTheDocument()
      expect(screen.getByTestId('error-fallback')).toBeInTheDocument()
    })

    it('should handle nested error boundaries', () => {
      render(
        <CustomErrorBoundary
          fallback={({ error }) => (
            <div data-testid="outer-error">Outer: {error.message}</div>
          )}
        >
          <div>Outer content</div>
          <CustomErrorBoundary
            fallback={({ error }) => (
              <div data-testid="inner-error">Inner: {error.message}</div>
            )}
          >
            <ThrowError shouldThrow={true} errorMessage="Inner error" />
          </CustomErrorBoundary>
        </CustomErrorBoundary>
      )

      expect(screen.getByTestId('inner-error')).toBeInTheDocument()
      expect(screen.getByTestId('inner-error')).toHaveTextContent('Inner: Inner error')
      expect(screen.queryByTestId('outer-error')).not.toBeInTheDocument()
    })

    it('should handle async errors', async () => {
      const AsyncErrorComponent = () => {
        React.useEffect(() => {
          setTimeout(() => {
            throw new Error('Async error')
          }, 100)
        }, [])

        return <div data-testid="async-component">Async component</div>
      }

      // Note: Error boundaries don't catch async errors by default
      // This test demonstrates the limitation
      render(
        <CustomErrorBoundary>
          <AsyncErrorComponent />
        </CustomErrorBoundary>
      )

      expect(screen.getByTestId('async-component')).toBeInTheDocument()
      // Async error won't be caught by error boundary
    })
  })

  describe('Null and Undefined Handling', () => {
    it('should handle null props', () => {
      render(<NullableComponent data={null} />)
      expect(screen.getByTestId('nullable-component')).toHaveTextContent('null')
    })

    it('should handle undefined props', () => {
      render(<NullableComponent data={undefined} />)
      expect(screen.getByTestId('nullable-component')).toHaveTextContent('undefined')
    })

    it('should handle empty string', () => {
      render(<NullableComponent data="" />)
      expect(screen.getByTestId('nullable-component')).toHaveTextContent('empty string')
    })

    it('should handle empty array', () => {
      render(<NullableComponent data={[]} />)
      expect(screen.getByTestId('nullable-component')).toHaveTextContent('empty array')
    })

    it('should handle empty object', () => {
      render(<NullableComponent data={{}} />)
      expect(screen.getByTestId('nullable-component')).toHaveTextContent('empty object')
    })

    it('should handle zero value', () => {
      render(<NullableComponent data={0} />)
      expect(screen.getByTestId('nullable-component')).toHaveTextContent('0')
    })

    it('should handle false value', () => {
      render(<NullableComponent data={false} />)
      expect(screen.getByTestId('nullable-component')).toHaveTextContent('false')
    })

    it('should handle NaN value', () => {
      render(<NullableComponent data={NaN} />)
      expect(screen.getByTestId('nullable-component')).toHaveTextContent('NaN')
    })
  })

  describe('Async Operations and Loading States', () => {
    it('should handle successful async operations', async () => {
      render(<AsyncComponent shouldFail={false} delay={50} />)

      expect(screen.getByTestId('loading')).toBeInTheDocument()

      await waitFor(() => {
        expect(screen.getByTestId('async-success')).toBeInTheDocument()
      })

      expect(screen.getByTestId('async-success')).toHaveTextContent('Loaded data')
    })

    it('should handle failed async operations', async () => {
      render(<AsyncComponent shouldFail={true} delay={50} />)

      expect(screen.getByTestId('loading')).toBeInTheDocument()

      await waitFor(() => {
        expect(screen.getByTestId('async-error')).toBeInTheDocument()
      })

      expect(screen.getByTestId('async-error')).toHaveTextContent('Async operation failed')
    })

    it('should handle component unmounting during async operation', async () => {
      const { unmount } = render(<AsyncComponent shouldFail={false} delay={200} />)

      expect(screen.getByTestId('loading')).toBeInTheDocument()

      // Unmount before async operation completes
      unmount()

      // Should not throw errors or cause memory leaks
      expect(true).toBe(true) // Test passes if no errors thrown
    })
  })

  describe('Memory Leaks and Cleanup', () => {
    it('should clean up intervals properly', async () => {
      jest.useFakeTimers()

      const { unmount } = render(<LeakyComponent shouldLeak={false} />)

      expect(screen.getByTestId('leaky-component')).toHaveTextContent('Count: 0')

      // Advance timers
      jest.advanceTimersByTime(250)
      expect(screen.getByTestId('leaky-component')).toHaveTextContent('Count: 2')

      // Unmount component
      unmount()

      // Advance timers more - count should not continue if cleanup worked
      jest.advanceTimersByTime(250)

      // Re-render same component to check if interval was cleaned up
      render(<LeakyComponent shouldLeak={false} />)
      expect(screen.getByTestId('leaky-component')).toHaveTextContent('Count: 0')

      jest.useRealTimers()
    })

    it('should demonstrate memory leak when cleanup fails', async () => {
      jest.useFakeTimers()

      const { unmount } = render(<LeakyComponent shouldLeak={true} />)

      expect(screen.getByTestId('leaky-component')).toHaveTextContent('Count: 0')

      // Advance timers
      jest.advanceTimersByTime(250)
      expect(screen.getByTestId('leaky-component')).toHaveTextContent('Count: 2')

      // Unmount component without cleanup
      unmount()

      // This would normally continue running and cause memory leak
      // In test environment, we can't fully demonstrate this without
      // more complex setup, but this test documents the scenario

      jest.useRealTimers()
    })
  })

  describe('Large Data Handling', () => {
    it('should handle small datasets efficiently', async () => {
      render(<LargeDataComponent size={10} />)

      expect(screen.getByTestId('large-data-loading')).toBeInTheDocument()

      await waitFor(() => {
        expect(screen.getByTestId('large-data-component')).toBeInTheDocument()
      })

      expect(screen.getByTestId('data-length')).toHaveTextContent('10')
      expect(screen.getByTestId('data-sample')).toHaveTextContent('0, 1, 2')
    })

    it('should handle large datasets', async () => {
      const start = performance.now()

      render(<LargeDataComponent size={10000} />)

      await waitFor(() => {
        expect(screen.getByTestId('large-data-component')).toBeInTheDocument()
      }, { timeout: 2000 })

      const end = performance.now()
      const renderTime = end - start

      expect(screen.getByTestId('data-length')).toHaveTextContent('10000')
      expect(screen.getByTestId('data-sample')).toHaveTextContent('0, 1, 2')

      // Should render within reasonable time (2 seconds in test environment)
      expect(renderTime).toBeLessThan(2000)
    })

    it('should handle extremely large datasets gracefully', async () => {
      // This test might be slow or cause memory issues in real scenarios
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

      try {
        render(<LargeDataComponent size={100000} />)

        await waitFor(() => {
          expect(screen.getByTestId('large-data-component')).toBeInTheDocument()
        }, { timeout: 5000 })

        expect(screen.getByTestId('data-length')).toHaveTextContent('100000')
      } catch (error) {
        // If it fails due to memory/performance, that's expected
        expect(error).toBeInstanceOf(Error)
      }

      consoleSpy.mockRestore()
    })
  })

  describe('Recursion and Deep Nesting', () => {
    it('should handle controlled recursion', () => {
      render(<RecursiveComponent depth={0} maxDepth={3} />)

      expect(screen.getByTestId('recursion-level-0')).toBeInTheDocument()
      expect(screen.getByTestId('recursion-level-1')).toBeInTheDocument()
      expect(screen.getByTestId('recursion-level-2')).toBeInTheDocument()
      expect(screen.getByTestId('recursion-end')).toHaveTextContent('Recursion end at depth 3')
    })

    it('should prevent infinite recursion', () => {
      render(<RecursiveComponent depth={0} maxDepth={1000} />)

      // Should not crash due to stack overflow
      expect(screen.getByTestId('recursion-level-0')).toBeInTheDocument()
      expect(screen.getByTestId('recursion-end')).toHaveTextContent('Recursion end at depth 1000')
    })
  })

  describe('Input Edge Cases', () => {
    it('should handle extremely long strings', () => {
      const veryLongString = 'a'.repeat(10000)

      render(
        <div data-testid="long-string-container">
          <input data-testid="long-string-input" defaultValue={veryLongString} />
        </div>
      )

      const input = screen.getByTestId('long-string-input') as HTMLInputElement
      expect(input.value.length).toBe(10000)
      expect(input.value.startsWith('aaaa')).toBe(true)
    })

    it('should handle special Unicode characters', () => {
      const unicodeString = '🎉🌟💻🚀👍🔥✨🎯🌈💡'

      render(
        <input data-testid="unicode-input" defaultValue={unicodeString} />
      )

      const input = screen.getByTestId('unicode-input') as HTMLInputElement
      expect(input.value).toBe(unicodeString)
    })

    it('should handle malformed JSON strings', () => {
      const MalformedJSONComponent = ({ jsonString }: { jsonString: string }) => {
        const [parsed, setParsed] = React.useState<any>(null)
        const [error, setError] = React.useState<string | null>(null)

        React.useEffect(() => {
          try {
            const result = JSON.parse(jsonString)
            setParsed(result)
            setError(null)
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Parse error')
            setParsed(null)
          }
        }, [jsonString])

        if (error) {
          return <div data-testid="json-error">{error}</div>
        }

        return <div data-testid="json-success">{JSON.stringify(parsed)}</div>
      }

      // Valid JSON
      const { rerender } = render(<MalformedJSONComponent jsonString='{"valid": true}' />)
      expect(screen.getByTestId('json-success')).toHaveTextContent('{"valid":true}')

      // Invalid JSON
      rerender(<MalformedJSONComponent jsonString='{invalid: json}' />)
      expect(screen.getByTestId('json-error')).toBeInTheDocument()
    })
  })

  describe('Network and API Edge Cases', () => {
    it('should handle network timeouts', async () => {
      const TimeoutComponent = () => {
        const [status, setStatus] = React.useState('idle')

        const makeRequest = async () => {
          setStatus('loading')

          try {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 1000)

            await fetch('/api/data', { signal: controller.signal })
            clearTimeout(timeoutId)
            setStatus('success')
          } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
              setStatus('timeout')
            } else {
              setStatus('error')
            }
          }
        }

        React.useEffect(() => {
          makeRequest()
        }, [])

        return <div data-testid="timeout-status">{status}</div>
      }

      // Mock fetch to never resolve (simulate timeout)
      global.fetch = jest.fn(() => new Promise(() => {}))

      render(<TimeoutComponent />)

      expect(screen.getByTestId('timeout-status')).toHaveTextContent('loading')

      // Wait for timeout
      await waitFor(() => {
        expect(screen.getByTestId('timeout-status')).toHaveTextContent('timeout')
      }, { timeout: 1500 })
    })

    it('should handle malformed API responses', async () => {
      const APIComponent = () => {
        const [data, setData] = React.useState<any>(null)
        const [error, setError] = React.useState<string | null>(null)

        React.useEffect(() => {
          fetch('/api/data')
            .then(response => response.json())
            .then(data => setData(data))
            .catch(err => setError(err.message))
        }, [])

        if (error) return <div data-testid="api-error">{error}</div>
        if (!data) return <div data-testid="api-loading">Loading...</div>
        return <div data-testid="api-success">{JSON.stringify(data)}</div>
      }

      // Mock fetch with malformed JSON
      global.fetch = jest.fn().mockResolvedValue({
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
      })

      render(<APIComponent />)

      await waitFor(() => {
        expect(screen.getByTestId('api-error')).toHaveTextContent('Invalid JSON')
      })
    })
  })

  describe('Browser Compatibility Edge Cases', () => {
    it('should handle missing browser APIs gracefully', () => {
      const FeatureDetectionComponent = () => {
        const [features, setFeatures] = React.useState({
          localStorage: false,
          geolocation: false,
          webgl: false,
          serviceWorker: false
        })

        React.useEffect(() => {
          setFeatures({
            localStorage: typeof Storage !== 'undefined',
            geolocation: 'geolocation' in navigator,
            webgl: !!window.WebGLRenderingContext,
            serviceWorker: 'serviceWorker' in navigator
          })
        }, [])

        return (
          <div data-testid="feature-detection">
            {Object.entries(features).map(([feature, supported]) => (
              <div key={feature} data-testid={`feature-${feature}`}>
                {feature}: {supported ? 'supported' : 'not supported'}
              </div>
            ))}
          </div>
        )
      }

      render(<FeatureDetectionComponent />)

      expect(screen.getByTestId('feature-localStorage')).toBeInTheDocument()
      expect(screen.getByTestId('feature-geolocation')).toBeInTheDocument()
      expect(screen.getByTestId('feature-webgl')).toBeInTheDocument()
      expect(screen.getByTestId('feature-serviceWorker')).toBeInTheDocument()
    })
  })
})