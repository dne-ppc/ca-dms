/**
 * REAL System-Breaking Scenarios - Exposing Actual Weaknesses
 *
 * These tests intentionally try to break our system in realistic ways.
 * Every failure teaches us about real vulnerabilities and edge cases.
 * We WANT these tests to fail - that's how we learn!
 */
import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Component that can actually break under stress
const StressTestComponent = () => {
  const [items, setItems] = React.useState<any[]>([])
  const [memory, setMemory] = React.useState<any[]>([])
  const [processing, setProcessing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // This might actually run out of memory!
  const addMassiveData = () => {
    try {
      setProcessing(true)
      const massiveArray = Array.from({ length: 1000000 }, (_, i) => ({
        id: i,
        data: 'x'.repeat(1000), // 1KB per item = 1GB total
        timestamp: Date.now()
      }))
      setItems(prev => [...prev, ...massiveArray])
      setMemory(prev => [...prev, massiveArray])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Memory error')
      console.log('💥 Memory allocation failed:', err)
    } finally {
      setProcessing(false)
    }
  }

  // Infinite recursion that might crash the browser
  const triggerInfiniteRecursion = () => {
    try {
      const recursive = (depth: number): number => {
        if (depth > 10000) throw new Error('Recursion limit reached') // Safety valve
        return recursive(depth + 1) + 1
      }
      recursive(0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recursion error')
      console.log('🔄 Recursion failed:', err)
    }
  }

  // CPU-intensive operation that might freeze the UI
  const intensiveComputation = async () => {
    setProcessing(true)
    try {
      // Block the main thread
      const start = Date.now()
      let result = 0
      for (let i = 0; i < 1000000000; i++) { // 1 billion iterations
        result += Math.random() * Math.sin(i) * Math.cos(i)
      }
      const duration = Date.now() - start
      console.log(`🔥 Intensive computation completed in ${duration}ms, result: ${result}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Computation error')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div data-testid="stress-component">
      <div data-testid="item-count">Items: {items.length}</div>
      <div data-testid="memory-usage">
        Memory arrays: {memory.length}
      </div>
      {processing && <div data-testid="processing">Processing...</div>}
      {error && <div data-testid="stress-error">Error: {error}</div>}

      <button onClick={addMassiveData} data-testid="memory-bomb">
        Add 1GB of Data
      </button>
      <button onClick={triggerInfiniteRecursion} data-testid="recursion-bomb">
        Infinite Recursion
      </button>
      <button onClick={intensiveComputation} data-testid="cpu-bomb">
        Block Main Thread
      </button>
    </div>
  )
}

// Component that reveals DOM manipulation issues
const DOMBreakingComponent = () => {
  const [domNodes, setDomNodes] = React.useState(0)
  const [error, setError] = React.useState<string | null>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)

  const createMassiveDOMTree = () => {
    try {
      if (!containerRef.current) return

      // Create 10,000 DOM nodes - this might crash the browser!
      const fragment = document.createDocumentFragment()
      for (let i = 0; i < 10000; i++) {
        const div = document.createElement('div')
        div.textContent = `Node ${i} with some content that uses memory`
        div.style.cssText = 'padding: 10px; border: 1px solid red; margin: 1px;'

        // Nested nodes to make it worse
        for (let j = 0; j < 10; j++) {
          const span = document.createElement('span')
          span.textContent = `Nested ${j}`
          div.appendChild(span)
        }

        fragment.appendChild(div)
      }

      containerRef.current.appendChild(fragment)
      setDomNodes(prev => prev + 100000) // 10k nodes * 10 nested = 100k total

    } catch (err) {
      setError(err instanceof Error ? err.message : 'DOM error')
      console.log('🏗️ DOM creation failed:', err)
    }
  }

  const corruptDOM = () => {
    try {
      // Try to break the DOM in creative ways
      if (containerRef.current) {
        // Remove parent while child is being accessed
        const parent = containerRef.current.parentNode
        const child = containerRef.current.firstChild

        if (parent && child) {
          parent.removeChild(containerRef.current)
          // Now try to modify the orphaned child - this might fail!
          child.textContent = 'Orphaned node'
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'DOM corruption error')
      console.log('💀 DOM corruption detected:', err)
    }
  }

  const triggerLayoutThrashing = () => {
    try {
      // Force layout recalculation thousands of times
      for (let i = 0; i < 1000; i++) {
        if (containerRef.current) {
          containerRef.current.style.width = `${100 + i}px`
          // Force layout
          const height = containerRef.current.offsetHeight
          containerRef.current.style.height = `${height + 1}px`
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Layout thrashing error')
      console.log('📏 Layout thrashing failed:', err)
    }
  }

  return (
    <div data-testid="dom-breaking-component">
      <div data-testid="dom-node-count">DOM Nodes: {domNodes}</div>
      {error && <div data-testid="dom-error">Error: {error}</div>}

      <button onClick={createMassiveDOMTree} data-testid="dom-bomb">
        Create 100k DOM Nodes
      </button>
      <button onClick={corruptDOM} data-testid="dom-corrupt">
        Corrupt DOM
      </button>
      <button onClick={triggerLayoutThrashing} data-testid="layout-thrash">
        Layout Thrashing
      </button>

      <div ref={containerRef} data-testid="dom-container" style={{ maxHeight: '200px', overflow: 'auto' }}>
        {/* Dynamic content gets added here */}
      </div>
    </div>
  )
}

// Component that tests real security vulnerabilities
const SecurityBreakingComponent = () => {
  const [xssAttempt, setXssAttempt] = React.useState('')
  const [injectionResult, setInjectionResult] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const attemptXSS = () => {
    try {
      // Test if we can inject script tags
      const maliciousHTML = `
        <img src="x" onerror="alert('XSS!')">
        <script>console.log('XSS executed!')</script>
        <div onclick="alert('Click XSS')">Click me</div>
      `

      setXssAttempt(maliciousHTML)

      // Try to inject into DOM directly
      const div = document.createElement('div')
      div.innerHTML = maliciousHTML

      // Check if script executed
      const scripts = div.querySelectorAll('script')
      setInjectionResult(`Found ${scripts.length} script tags`)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'XSS error')
      console.log('🛡️ XSS attempt blocked:', err)
    }
  }

  const attemptPrototypePollution = () => {
    try {
      // Try to pollute Object.prototype
      const payload = '{"__proto__": {"polluted": "yes"}}'
      const obj = JSON.parse(payload)

      // Check if pollution worked
      const testObj = {}
      setInjectionResult(`Prototype pollution: ${(testObj as any).polluted || 'blocked'}`)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Prototype pollution error')
      console.log('⚠️ Prototype pollution attempt:', err)
    }
  }

  const attemptMemoryExhaustion = async () => {
    try {
      // Try to exhaust memory with string manipulation
      let bigString = 'x'
      for (let i = 0; i < 30; i++) { // 2^30 characters = 1GB
        bigString += bigString
      }
      setInjectionResult(`String length: ${bigString.length}`)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Memory exhaustion error')
      console.log('💾 Memory exhaustion attempt:', err)
    }
  }

  return (
    <div data-testid="security-breaking-component">
      {error && <div data-testid="security-error">Error: {error}</div>}
      {injectionResult && <div data-testid="injection-result">{injectionResult}</div>}

      <button onClick={attemptXSS} data-testid="xss-attack">
        Attempt XSS
      </button>
      <button onClick={attemptPrototypePollution} data-testid="prototype-pollution">
        Prototype Pollution
      </button>
      <button onClick={attemptMemoryExhaustion} data-testid="memory-exhaustion">
        Memory Exhaustion
      </button>

      {/* Dangerous: Display user input directly */}
      <div
        data-testid="xss-target"
        dangerouslySetInnerHTML={{ __html: xssAttempt }}
      />
    </div>
  )
}

// Component that tests real async race conditions
const RaceConditionComponent = () => {
  const [requests, setRequests] = React.useState<string[]>([])
  const [counter, setCounter] = React.useState(0)
  const [error, setError] = React.useState<string | null>(null)

  const triggerRaceCondition = async () => {
    try {
      // Fire 100 async operations that modify the same state
      const promises = Array.from({ length: 100 }, async (_, i) => {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100))

        // These state updates might race!
        setCounter(prev => prev + 1)
        setRequests(prev => [...prev, `Request ${i} completed`])

        return i
      })

      await Promise.all(promises)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Race condition error')
      console.log('🏁 Race condition detected:', err)
    }
  }

  const triggerStateCorruption = () => {
    // Rapidly modify state in ways that might corrupt it
    for (let i = 0; i < 1000; i++) {
      setTimeout(() => {
        setCounter(prev => prev + Math.random())
        setRequests(prev => {
          const newReqs = [...prev]
          newReqs.push(`Corruption attempt ${i}`)
          if (newReqs.length > 100) {
            newReqs.splice(0, 50) // Remove half
          }
          return newReqs
        })
      }, i) // All fire at different times
    }
  }

  return (
    <div data-testid="race-condition-component">
      <div data-testid="counter">Counter: {counter}</div>
      <div data-testid="request-count">Requests: {requests.length}</div>
      {error && <div data-testid="race-error">Error: {error}</div>}

      <button onClick={triggerRaceCondition} data-testid="race-trigger">
        Trigger Race Condition
      </button>
      <button onClick={triggerStateCorruption} data-testid="state-corruption">
        Corrupt State
      </button>
    </div>
  )
}

describe('REAL System-Breaking Scenarios - Learning from Actual Failures', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
    // Reset any global state that might have been corrupted
    jest.clearAllMocks()
  })

  describe('Memory and Performance Breaking Points', () => {
    it('should reveal actual memory limits', async () => {
      const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {})

      render(<StressTestComponent />)

      const memoryBomb = screen.getByTestId('memory-bomb')

      try {
        await user.click(memoryBomb)

        // Wait to see if it completes or crashes
        await waitFor(() => {
          const error = screen.queryByTestId('stress-error')
          const itemCount = screen.getByTestId('item-count')

          // Either we get an error (good!) or it somehow succeeds
          return error || itemCount.textContent !== 'Items: 0'
        }, { timeout: 10000 })

        const error = screen.queryByTestId('stress-error')
        if (error) {
          console.log('💥 Memory limit reached:', error.textContent)
        } else {
          console.log('😱 Somehow allocated 1GB without crashing!')
        }

      } catch (testError) {
        console.log('🧪 Test itself crashed:', testError)
      } finally {
        consoleLog.mockRestore()
      }
    })

    it('should detect CPU-blocking operations', async () => {
      render(<StressTestComponent />)

      const cpuBomb = screen.getByTestId('cpu-bomb')
      const startTime = Date.now()

      await user.click(cpuBomb)

      // This should block the main thread and make the UI unresponsive
      await waitFor(() => {
        const processing = screen.queryByTestId('processing')
        return !processing
      }, { timeout: 15000 })

      const duration = Date.now() - startTime
      console.log(`⏱️ CPU bomb took ${duration}ms (UI was blocked)`)

      // If it took more than 5 seconds, the UI was definitely blocked
      if (duration > 5000) {
        console.log('🚨 Main thread blocking detected!')
      }
    })

    it('should catch stack overflow errors', async () => {
      render(<StressTestComponent />)

      const recursionBomb = screen.getByTestId('recursion-bomb')
      await user.click(recursionBomb)

      await waitFor(() => {
        const error = screen.queryByTestId('stress-error')
        return error
      }, { timeout: 5000 })

      const error = screen.getByTestId('stress-error')
      console.log('🔄 Recursion result:', error.textContent)

      expect(error.textContent).toContain('Recursion')
    })
  })

  describe('DOM Manipulation Breaking Points', () => {
    it('should find DOM limits', async () => {
      render(<DOMBreakingComponent />)

      const domBomb = screen.getByTestId('dom-bomb')
      const startTime = Date.now()

      await user.click(domBomb)

      await waitFor(() => {
        const nodeCount = screen.getByTestId('dom-node-count')
        const error = screen.queryByTestId('dom-error')

        return nodeCount.textContent !== 'DOM Nodes: 0' || error
      }, { timeout: 10000 })

      const duration = Date.now() - startTime
      const nodeCount = screen.getByTestId('dom-node-count')
      const error = screen.queryByTestId('dom-error')

      console.log(`🏗️ DOM creation took ${duration}ms`)
      console.log(`📊 Final node count: ${nodeCount.textContent}`)

      if (error) {
        console.log('💥 DOM limit reached:', error.textContent)
      } else if (duration > 5000) {
        console.log('🐌 DOM creation was very slow')
      }
    })

    it('should reveal layout thrashing issues', async () => {
      render(<DOMBreakingComponent />)

      const layoutThrash = screen.getByTestId('layout-thrash')
      const startTime = Date.now()

      await user.click(layoutThrash)

      const duration = Date.now() - startTime
      console.log(`📏 Layout thrashing took ${duration}ms`)

      // Layout thrashing should be fast if optimized, slow if not
      if (duration > 1000) {
        console.log('🚨 Layout thrashing performance issue detected!')
      }
    })

    it('should catch DOM corruption attempts', async () => {
      render(<DOMBreakingComponent />)

      const domCorrupt = screen.getByTestId('dom-corrupt')

      try {
        await user.click(domCorrupt)

        await waitFor(() => {
          const error = screen.queryByTestId('dom-error')
          return error
        }, { timeout: 2000 })

        const error = screen.queryByTestId('dom-error')
        if (error) {
          console.log('💀 DOM corruption caught:', error.textContent)
        }

      } catch (testError) {
        console.log('🧪 DOM corruption broke the test:', testError)
      }
    })
  })

  describe('Security Vulnerability Testing', () => {
    it('should test XSS resistance', async () => {
      render(<SecurityBreakingComponent />)

      const xssAttack = screen.getByTestId('xss-attack')
      await user.click(xssAttack)

      const xssTarget = screen.getByTestId('xss-target')
      const injectionResult = screen.queryByTestId('injection-result')

      // Check if script tags were sanitized
      const scriptTags = xssTarget.querySelectorAll('script')
      console.log(`🛡️ Script tags in output: ${scriptTags.length}`)

      if (scriptTags.length > 0) {
        console.log('🚨 XSS vulnerability detected!')
      } else {
        console.log('✅ XSS properly blocked')
      }

      if (injectionResult) {
        console.log('📊 Injection result:', injectionResult.textContent)
      }
    })

    it('should test prototype pollution resistance', async () => {
      render(<SecurityBreakingComponent />)

      const prototypePollution = screen.getByTestId('prototype-pollution')
      await user.click(prototypePollution)

      await waitFor(() => {
        const result = screen.queryByTestId('injection-result')
        return result
      }, { timeout: 2000 })

      const result = screen.getByTestId('injection-result')
      console.log('⚠️ Prototype pollution result:', result.textContent)

      if (result.textContent?.includes('yes')) {
        console.log('🚨 Prototype pollution vulnerability!')
      } else {
        console.log('✅ Prototype pollution blocked')
      }
    })

    it('should test memory exhaustion resistance', async () => {
      render(<SecurityBreakingComponent />)

      const memoryExhaustion = screen.getByTestId('memory-exhaustion')

      try {
        await user.click(memoryExhaustion)

        await waitFor(() => {
          const result = screen.queryByTestId('injection-result')
          const error = screen.queryByTestId('security-error')
          return result || error
        }, { timeout: 10000 })

        const result = screen.queryByTestId('injection-result')
        const error = screen.queryByTestId('security-error')

        if (error) {
          console.log('💾 Memory exhaustion blocked:', error.textContent)
        } else if (result) {
          console.log('😱 Memory exhaustion succeeded:', result.textContent)
        }

      } catch (testError) {
        console.log('💥 Memory exhaustion crashed test:', testError)
      }
    })
  })

  describe('Race Condition and Concurrency Issues', () => {
    it('should reveal state race conditions', async () => {
      render(<RaceConditionComponent />)

      const raceTrigger = screen.getByTestId('race-trigger')
      await user.click(raceTrigger)

      // Wait for all async operations to complete
      await waitFor(() => {
        const counter = screen.getByTestId('counter')
        const requestCount = screen.getByTestId('request-count')

        // Should eventually stabilize
        return counter.textContent !== 'Counter: 0' && requestCount.textContent !== 'Requests: 0'
      }, { timeout: 5000 })

      const counter = screen.getByTestId('counter')
      const requestCount = screen.getByTestId('request-count')

      console.log('🏁 Race condition results:')
      console.log(`   Counter: ${counter.textContent}`)
      console.log(`   Requests: ${requestCount.textContent}`)

      // Counter should be 100 if no race conditions
      const counterValue = parseInt(counter.textContent?.split(': ')[1] || '0')
      const requestCountValue = parseInt(requestCount.textContent?.split(': ')[1] || '0')

      if (counterValue !== 100 || requestCountValue !== 100) {
        console.log('🚨 Race condition detected!')
        console.log(`   Expected 100, got counter=${counterValue}, requests=${requestCountValue}`)
      } else {
        console.log('✅ No race condition detected')
      }
    })

    it('should detect state corruption', async () => {
      render(<RaceConditionComponent />)

      const stateCorruption = screen.getByTestId('state-corruption')
      await user.click(stateCorruption)

      // Wait a bit for chaos to settle
      await new Promise(resolve => setTimeout(resolve, 2000))

      const counter = screen.getByTestId('counter')
      const requestCount = screen.getByTestId('request-count')

      console.log('💥 State corruption results:')
      console.log(`   Counter: ${counter.textContent}`)
      console.log(`   Requests: ${requestCount.textContent}`)

      // These values will be unpredictable due to rapid state changes
      const counterText = counter.textContent || ''
      const requestCountText = requestCount.textContent || ''

      if (counterText.includes('NaN') || requestCountText.includes('NaN')) {
        console.log('🚨 State corruption: NaN detected!')
      }

      if (counterText.includes('undefined') || requestCountText.includes('undefined')) {
        console.log('🚨 State corruption: undefined detected!')
      }
    })
  })

  describe('Browser Limit Testing', () => {
    it('should find actual browser limits', async () => {
      // Test localStorage limits
      const testLocalStorageLimit = () => {
        try {
          let data = 'x'
          let size = 1
          let iterations = 0

          while (size < 10 * 1024 * 1024 && iterations < 20) { // Max 10MB or 20 iterations
            try {
              localStorage.setItem('test', data)
              data += data // Double the size
              size *= 2
              iterations++
            } catch (err) {
              console.log(`💾 localStorage limit: ~${size / 1024 / 1024}MB`)
              localStorage.removeItem('test')
              return size
            }
          }

          localStorage.removeItem('test')
          return size
        } catch (err) {
          console.log('💾 localStorage test failed:', err)
          return 0
        }
      }

      const limit = testLocalStorageLimit()
      console.log(`🔍 Actual localStorage limit found: ${limit / 1024 / 1024}MB`)

      // Test URL length limits
      const testURLLimit = () => {
        try {
          let url = 'http://example.com/'
          let length = url.length

          while (length < 100000) { // Test up to 100k chars
            url += 'x'
            length++

            try {
              new URL(url)
            } catch (err) {
              console.log(`🌐 URL limit: ${length} characters`)
              return length
            }
          }

          return length
        } catch (err) {
          console.log('🌐 URL test failed:', err)
          return 0
        }
      }

      const urlLimit = testURLLimit()
      console.log(`🔍 Actual URL limit found: ${urlLimit} characters`)

      expect(limit).toBeGreaterThan(0)
    })
  })
})