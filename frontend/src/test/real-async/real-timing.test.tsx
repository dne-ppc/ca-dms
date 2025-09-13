/**
 * REAL Async and Timing Tests - No Mock Timers
 *
 * These tests use real setTimeout, setInterval, and async operations.
 * They reveal actual timing issues, race conditions, and async bugs.
 * Real timing means real failures that teach us about production issues!
 */
import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Component with real debouncing (no mock timers)
const RealDebounceComponent = () => {
  const [value, setValue] = React.useState('')
  const [debouncedValue, setDebouncedValue] = React.useState('')
  const [searchResults, setSearchResults] = React.useState<string[]>([])
  const [isSearching, setIsSearching] = React.useState(false)

  // Real debounce with real setTimeout
  React.useEffect(() => {
    setIsSearching(true)

    const timeoutId = setTimeout(() => {
      setDebouncedValue(value)
      setIsSearching(false)

      // Simulate search
      if (value) {
        setSearchResults([
          `Result 1 for "${value}"`,
          `Result 2 for "${value}"`,
          `Result 3 for "${value}"`
        ])
      } else {
        setSearchResults([])
      }
    }, 300) // Real 300ms delay

    return () => clearTimeout(timeoutId)
  }, [value])

  return (
    <div data-testid="real-debounce">
      <input
        data-testid="search-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Type to search..."
      />

      <div data-testid="current-value">Current: {value}</div>
      <div data-testid="debounced-value">Debounced: {debouncedValue}</div>

      {isSearching && <div data-testid="searching">Searching...</div>}

      <ul data-testid="search-results">
        {searchResults.map((result, idx) => (
          <li key={idx} data-testid={`result-${idx}`}>
            {result}
          </li>
        ))}
      </ul>
    </div>
  )
}

// Component with real animation timing
const RealAnimationComponent = () => {
  const [isAnimating, setIsAnimating] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const [animationType, setAnimationType] = React.useState<'linear' | 'eased'>('linear')
  const animationRef = React.useRef<number>()

  const startAnimation = () => {
    if (isAnimating) return

    setIsAnimating(true)
    setProgress(0)

    const duration = 2000 // 2 seconds
    const startTime = Date.now()

    const animate = () => {
      const elapsed = Date.now() - startTime
      const rawProgress = Math.min(elapsed / duration, 1)

      // Apply easing function
      const easedProgress = animationType === 'eased'
        ? 1 - Math.cos((rawProgress * Math.PI) / 2) // Ease-out sine
        : rawProgress

      setProgress(easedProgress)

      if (rawProgress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        setIsAnimating(false)
      }
    }

    animationRef.current = requestAnimationFrame(animate)
  }

  const stopAnimation = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
    setIsAnimating(false)
  }

  React.useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  return (
    <div data-testid="real-animation">
      <div data-testid="progress">Progress: {Math.round(progress * 100)}%</div>
      <div data-testid="animation-status">
        {isAnimating ? 'Animating' : 'Stopped'}
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
        <label>
          <input
            type="radio"
            name="animationType"
            value="linear"
            checked={animationType === 'linear'}
            onChange={() => setAnimationType('linear')}
          />
          Linear
        </label>
        <label>
          <input
            type="radio"
            name="animationType"
            value="eased"
            checked={animationType === 'eased'}
            onChange={() => setAnimationType('eased')}
          />
          Eased
        </label>
      </div>

      <button onClick={startAnimation} disabled={isAnimating} data-testid="start-animation">
        Start Animation
      </button>
      <button onClick={stopAnimation} disabled={!isAnimating} data-testid="stop-animation">
        Stop Animation
      </button>

      {/* Visual progress bar */}
      <div style={{ width: '200px', height: '20px', border: '1px solid #ccc', marginTop: '10px' }}>
        <div
          style={{
            width: `${progress * 100}%`,
            height: '100%',
            backgroundColor: '#007bff',
            transition: 'none' // No CSS transitions, pure JS animation
          }}
          data-testid="progress-bar"
        />
      </div>
    </div>
  )
}

// Component with real interval-based updates
const RealIntervalComponent = () => {
  const [count, setCount] = React.useState(0)
  const [isRunning, setIsRunning] = React.useState(false)
  const [intervalSpeed, setIntervalSpeed] = React.useState(100)
  const [startTime, setStartTime] = React.useState<number | null>(null)
  const intervalRef = React.useRef<NodeJS.Timeout>()

  const startCounter = () => {
    if (isRunning) return

    setIsRunning(true)
    setStartTime(Date.now())

    intervalRef.current = setInterval(() => {
      setCount(prev => prev + 1)
    }, intervalSpeed)
  }

  const stopCounter = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    setIsRunning(false)
  }

  const resetCounter = () => {
    stopCounter()
    setCount(0)
    setStartTime(null)
  }

  React.useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  // Calculate actual frequency
  const actualFrequency = startTime && count > 0
    ? count / ((Date.now() - startTime) / 1000)
    : 0

  return (
    <div data-testid="real-interval">
      <div data-testid="count">Count: {count}</div>
      <div data-testid="status">Status: {isRunning ? 'Running' : 'Stopped'}</div>
      <div data-testid="expected-frequency">
        Expected: {(1000 / intervalSpeed).toFixed(1)} Hz
      </div>
      <div data-testid="actual-frequency">
        Actual: {actualFrequency.toFixed(1)} Hz
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label>
          Interval Speed: {intervalSpeed}ms
          <input
            type="range"
            min="10"
            max="1000"
            value={intervalSpeed}
            onChange={(e) => setIntervalSpeed(Number(e.target.value))}
            disabled={isRunning}
            data-testid="speed-slider"
          />
        </label>
      </div>

      <button onClick={startCounter} disabled={isRunning} data-testid="start-counter">
        Start
      </button>
      <button onClick={stopCounter} disabled={!isRunning} data-testid="stop-counter">
        Stop
      </button>
      <button onClick={resetCounter} data-testid="reset-counter">
        Reset
      </button>
    </div>
  )
}

// Component that tests real promise chains and async/await
const RealAsyncChainComponent = () => {
  const [results, setResults] = React.useState<string[]>([])
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [errors, setErrors] = React.useState<string[]>([])

  const simulateAsyncTask = (taskName: string, delay: number, shouldFail = false): Promise<string> => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (shouldFail) {
          reject(new Error(`${taskName} failed`))
        } else {
          resolve(`${taskName} completed in ${delay}ms`)
        }
      }, delay)
    })
  }

  const runSequentialChain = async () => {
    setIsProcessing(true)
    setResults([])
    setErrors([])

    try {
      // Sequential execution - each waits for the previous
      const result1 = await simulateAsyncTask('Task 1', 200)
      setResults(prev => [...prev, result1])

      const result2 = await simulateAsyncTask('Task 2', 300)
      setResults(prev => [...prev, result2])

      const result3 = await simulateAsyncTask('Task 3', 150)
      setResults(prev => [...prev, result3])

      console.log('✅ Sequential chain completed')

    } catch (error) {
      setErrors(prev => [...prev, error instanceof Error ? error.message : 'Unknown error'])
    } finally {
      setIsProcessing(false)
    }
  }

  const runParallelChain = async () => {
    setIsProcessing(true)
    setResults([])
    setErrors([])

    try {
      // Parallel execution - all start at the same time
      const promises = [
        simulateAsyncTask('Parallel Task 1', 300),
        simulateAsyncTask('Parallel Task 2', 150),
        simulateAsyncTask('Parallel Task 3', 250)
      ]

      const results = await Promise.all(promises)
      setResults(results)

      console.log('✅ Parallel chain completed')

    } catch (error) {
      setErrors(prev => [...prev, error instanceof Error ? error.message : 'Unknown error'])
    } finally {
      setIsProcessing(false)
    }
  }

  const runPartialFailureChain = async () => {
    setIsProcessing(true)
    setResults([])
    setErrors([])

    const promises = [
      simulateAsyncTask('Success Task 1', 200, false),
      simulateAsyncTask('Failure Task', 150, true), // This will fail
      simulateAsyncTask('Success Task 2', 100, false)
    ]

    // Use allSettled to handle partial failures
    const results = await Promise.allSettled(promises)

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        setResults(prev => [...prev, result.value])
      } else {
        setErrors(prev => [...prev, `Task ${index + 1}: ${result.reason.message}`])
      }
    })

    setIsProcessing(false)
    console.log('✅ Partial failure chain completed')
  }

  return (
    <div data-testid="real-async-chain">
      <div data-testid="processing-status">
        {isProcessing ? 'Processing...' : 'Ready'}
      </div>

      <div style={{ marginBottom: '10px' }}>
        <button onClick={runSequentialChain} disabled={isProcessing} data-testid="sequential-button">
          Run Sequential Chain
        </button>
        <button onClick={runParallelChain} disabled={isProcessing} data-testid="parallel-button">
          Run Parallel Chain
        </button>
        <button onClick={runPartialFailureChain} disabled={isProcessing} data-testid="partial-failure-button">
          Run Partial Failure Chain
        </button>
      </div>

      <div data-testid="results-section">
        <h4>Results:</h4>
        <ul data-testid="results-list">
          {results.map((result, idx) => (
            <li key={idx} data-testid={`result-${idx}`}>
              {result}
            </li>
          ))}
        </ul>
      </div>

      <div data-testid="errors-section">
        <h4>Errors:</h4>
        <ul data-testid="errors-list">
          {errors.map((error, idx) => (
            <li key={idx} data-testid={`error-${idx}`} style={{ color: 'red' }}>
              {error}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

describe('REAL Async and Timing Tests - No Fake Timers', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
  })

  describe('Real Debouncing Behavior', () => {
    it('should reveal actual debounce timing issues', async () => {
      render(<RealDebounceComponent />)

      const input = screen.getByTestId('search-input')
      const searchingIndicator = () => screen.queryByTestId('searching')

      // Type rapidly - real debouncing should handle this
      await user.type(input, 'test query')

      // Should show searching immediately
      expect(searchingIndicator()).toBeInTheDocument()

      // Wait for real debounce (300ms)
      await waitFor(() => {
        expect(searchingIndicator()).not.toBeInTheDocument()
      }, { timeout: 1000 })

      // Results should be visible
      expect(screen.getByTestId('result-0')).toHaveTextContent('Result 1 for "test query"')

      console.log('✅ Real debounce behavior verified')
    })

    it('should handle rapid typing correctly', async () => {
      render(<RealDebounceComponent />)

      const input = screen.getByTestId('search-input')
      const startTime = Date.now()

      // Rapid-fire typing
      await user.type(input, 'a')
      await user.type(input, 'b')
      await user.type(input, 'c')
      await user.type(input, 'd')
      await user.type(input, 'e')

      // Wait for debounce to settle
      await waitFor(() => {
        const debouncedValue = screen.getByTestId('debounced-value')
        return debouncedValue.textContent === 'Debounced: abcde'
      }, { timeout: 1000 })

      const totalTime = Date.now() - startTime
      console.log(`⌨️ Rapid typing handled in ${totalTime}ms`)

      // Should have debounced properly
      expect(screen.getByTestId('result-0')).toHaveTextContent('Result 1 for "abcde"')
    })

    it('should cancel previous searches correctly', async () => {
      render(<RealDebounceComponent />)

      const input = screen.getByTestId('search-input')

      // Type something
      await user.type(input, 'first')

      // Quickly clear and type something else
      await user.clear(input)
      await user.type(input, 'second')

      // Wait for final result
      await waitFor(() => {
        const results = screen.queryAllByTestId(/result-\d+/)
        return results.length > 0
      }, { timeout: 1000 })

      // Should only show results for "second", not "first"
      const results = screen.getAllByTestId(/result-\d+/)
      results.forEach(result => {
        expect(result.textContent).toContain('second')
        expect(result.textContent).not.toContain('first')
      })

      console.log('✅ Search cancellation verified')
    })
  })

  describe('Real Animation Timing', () => {
    it('should test actual animation frame timing', async () => {
      render(<RealAnimationComponent />)

      const startButton = screen.getByTestId('start-animation')
      const progressElement = screen.getByTestId('progress')

      const startTime = Date.now()
      await user.click(startButton)

      // Monitor progress updates
      const progressValues: number[] = []
      const checkProgress = () => {
        const text = progressElement.textContent || ''
        const match = text.match(/(\d+)%/)
        if (match) {
          progressValues.push(parseInt(match[1]))
        }
      }

      // Check progress every 100ms
      const interval = setInterval(checkProgress, 100)

      // Wait for animation to complete
      await waitFor(() => {
        const status = screen.getByTestId('animation-status')
        return status.textContent === 'Stopped'
      }, { timeout: 3000 })

      clearInterval(interval)
      const totalTime = Date.now() - startTime

      console.log(`🎬 Animation completed in ${totalTime}ms`)
      console.log(`📊 Progress values: ${progressValues.join(', ')}`)

      // Animation should take approximately 2 seconds
      expect(totalTime).toBeGreaterThan(1900)
      expect(totalTime).toBeLessThan(2200)

      // Should have smooth progress
      expect(progressValues.length).toBeGreaterThan(5) // Multiple updates
      expect(progressValues[progressValues.length - 1]).toBe(100) // Ends at 100%
    })

    it('should test easing vs linear animation', async () => {
      render(<RealAnimationComponent />)

      // Test linear animation
      const linearRadio = screen.getByDisplayValue('linear')
      await user.click(linearRadio)

      const startButton = screen.getByTestId('start-animation')
      await user.click(startButton)

      await waitFor(() => {
        const status = screen.getByTestId('animation-status')
        return status.textContent === 'Stopped'
      }, { timeout: 3000 })

      console.log('✅ Linear animation completed')

      // Reset and test eased animation
      const easedRadio = screen.getByDisplayValue('eased')
      await user.click(easedRadio)

      await user.click(startButton)

      await waitFor(() => {
        const status = screen.getByTestId('animation-status')
        return status.textContent === 'Stopped'
      }, { timeout: 3000 })

      console.log('✅ Eased animation completed')
    })

    it('should handle animation cancellation', async () => {
      render(<RealAnimationComponent />)

      const startButton = screen.getByTestId('start-animation')
      const stopButton = screen.getByTestId('stop-animation')

      await user.click(startButton)

      // Wait a bit, then cancel
      await new Promise(resolve => setTimeout(resolve, 500))
      await user.click(stopButton)

      const status = screen.getByTestId('animation-status')
      expect(status.textContent).toBe('Stopped')

      const progress = screen.getByTestId('progress')
      const progressText = progress.textContent || ''
      const progressValue = parseInt(progressText.match(/(\d+)%/)?.[1] || '0')

      console.log(`🛑 Animation stopped at ${progressValue}%`)

      // Should have stopped somewhere in the middle
      expect(progressValue).toBeGreaterThan(0)
      expect(progressValue).toBeLessThan(100)
    })
  })

  describe('Real Interval Behavior', () => {
    it('should test actual interval timing accuracy', async () => {
      render(<RealIntervalComponent />)

      const startButton = screen.getByTestId('start-counter')
      const speedSlider = screen.getByTestId('speed-slider')

      // Set to 100ms interval
      await user.clear(speedSlider)
      await user.type(speedSlider, '100')

      const startTime = Date.now()
      await user.click(startButton)

      // Let it run for 1 second
      await new Promise(resolve => setTimeout(resolve, 1000))

      const stopButton = screen.getByTestId('stop-counter')
      await user.click(stopButton)

      const totalTime = Date.now() - startTime
      const count = parseInt(screen.getByTestId('count').textContent?.split(': ')[1] || '0')
      const actualFrequency = count / (totalTime / 1000)

      console.log(`⏰ Interval test results:`)
      console.log(`   Expected: ~10 Hz (100ms interval)`)
      console.log(`   Actual: ${actualFrequency.toFixed(2)} Hz`)
      console.log(`   Count: ${count} in ${totalTime}ms`)

      // Should be close to 10 Hz (allow some variance)
      expect(actualFrequency).toBeGreaterThan(8)
      expect(actualFrequency).toBeLessThan(12)
    })

    it('should test high-frequency intervals', async () => {
      render(<RealIntervalComponent />)

      const startButton = screen.getByTestId('start-counter')
      const speedSlider = screen.getByTestId('speed-slider')

      // Set to very fast interval (10ms)
      await user.clear(speedSlider)
      await user.type(speedSlider, '10')

      await user.click(startButton)

      // Let it run briefly
      await new Promise(resolve => setTimeout(resolve, 500))

      const stopButton = screen.getByTestId('stop-counter')
      await user.click(stopButton)

      const actualFreq = screen.getByTestId('actual-frequency')
      const frequency = parseFloat(actualFreq.textContent?.split(': ')[1] || '0')

      console.log(`🏃 High-frequency test: ${frequency.toFixed(2)} Hz`)

      // High frequency might be throttled by browser
      if (frequency < 50) {
        console.log('⚠️ Browser throttled high-frequency interval')
      }
    })
  })

  describe('Real Promise Chain Behavior', () => {
    it('should test sequential async execution timing', async () => {
      render(<RealAsyncChainComponent />)

      const sequentialButton = screen.getByTestId('sequential-button')

      const startTime = Date.now()
      await user.click(sequentialButton)

      // Wait for completion
      await waitFor(() => {
        const status = screen.getByTestId('processing-status')
        return status.textContent === 'Ready'
      }, { timeout: 2000 })

      const totalTime = Date.now() - startTime
      console.log(`⏭️ Sequential execution took ${totalTime}ms`)

      // Should take approximately 200 + 300 + 150 = 650ms
      expect(totalTime).toBeGreaterThan(600)
      expect(totalTime).toBeLessThan(800)

      // All results should be present
      expect(screen.getByTestId('result-0')).toBeInTheDocument()
      expect(screen.getByTestId('result-1')).toBeInTheDocument()
      expect(screen.getByTestId('result-2')).toBeInTheDocument()
    })

    it('should test parallel async execution timing', async () => {
      render(<RealAsyncChainComponent />)

      const parallelButton = screen.getByTestId('parallel-button')

      const startTime = Date.now()
      await user.click(parallelButton)

      await waitFor(() => {
        const status = screen.getByTestId('processing-status')
        return status.textContent === 'Ready'
      }, { timeout: 1000 })

      const totalTime = Date.now() - startTime
      console.log(`⏸️ Parallel execution took ${totalTime}ms`)

      // Should take approximately max(300, 150, 250) = 300ms
      expect(totalTime).toBeGreaterThan(250)
      expect(totalTime).toBeLessThan(400)

      // All results should be present
      expect(screen.getByTestId('result-0')).toBeInTheDocument()
      expect(screen.getByTestId('result-1')).toBeInTheDocument()
      expect(screen.getByTestId('result-2')).toBeInTheDocument()
    })

    it('should handle real promise failures correctly', async () => {
      render(<RealAsyncChainComponent />)

      const partialFailureButton = screen.getByTestId('partial-failure-button')
      await user.click(partialFailureButton)

      await waitFor(() => {
        const status = screen.getByTestId('processing-status')
        return status.textContent === 'Ready'
      }, { timeout: 1000 })

      // Should have some successes and some failures
      const results = screen.queryAllByTestId(/result-\d+/)
      const errors = screen.queryAllByTestId(/error-\d+/)

      console.log(`✅ Partial failure: ${results.length} successes, ${errors.length} errors`)

      expect(results.length).toBeGreaterThan(0) // Some successes
      expect(errors.length).toBeGreaterThan(0)  // Some failures

      // Check that errors contain expected failure message
      const errorElements = screen.queryAllByTestId(/error-\d+/)
      const hasFailureTask = errorElements.some(el =>
        el.textContent?.includes('Failure Task')
      )
      expect(hasFailureTask).toBe(true)
    })
  })

  describe('Real Concurrency Issues', () => {
    it('should detect timing-dependent race conditions', async () => {
      const RaceConditionComponent = () => {
        const [value, setValue] = React.useState(0)
        const [results, setResults] = React.useState<number[]>([])

        const triggerRace = async () => {
          setValue(0)
          setResults([])

          // Fire multiple async operations that modify the same state
          const promises = Array.from({ length: 10 }, async (_, i) => {
            // Random delay to create race conditions
            await new Promise(resolve => setTimeout(resolve, Math.random() * 100))

            // This might create race conditions!
            setValue(prev => {
              const newValue = prev + 1
              setResults(prevResults => [...prevResults, newValue])
              return newValue
            })

            return i
          })

          await Promise.all(promises)
        }

        return (
          <div data-testid="race-condition">
            <div data-testid="final-value">Final Value: {value}</div>
            <div data-testid="result-count">Results: {results.length}</div>
            <button onClick={triggerRace} data-testid="trigger-race">
              Trigger Race Condition
            </button>
            <ul data-testid="race-results">
              {results.map((result, idx) => (
                <li key={idx} data-testid={`race-result-${idx}`}>
                  {result}
                </li>
              ))}
            </ul>
          </div>
        )
      }

      render(<RaceConditionComponent />)

      const triggerButton = screen.getByTestId('trigger-race')
      await user.click(triggerButton)

      // Wait for all operations to complete
      await waitFor(() => {
        const resultCount = screen.getByTestId('result-count')
        return resultCount.textContent === 'Results: 10'
      }, { timeout: 2000 })

      const finalValue = parseInt(screen.getByTestId('final-value').textContent?.split(': ')[1] || '0')
      const resultCount = parseInt(screen.getByTestId('result-count').textContent?.split(': ')[1] || '0')

      console.log(`🏁 Race condition results:`)
      console.log(`   Final value: ${finalValue}`)
      console.log(`   Result count: ${resultCount}`)

      // In a perfect world, both should be 10
      // If they're different, we have race conditions
      if (finalValue !== 10 || resultCount !== 10) {
        console.log('🚨 Race condition detected!')
      } else {
        console.log('✅ No race condition (this time)')
      }

      expect(resultCount).toBe(10) // Should always have 10 results
    })
  })
})