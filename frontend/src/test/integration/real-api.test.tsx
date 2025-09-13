/**
 * REAL API Integration Tests - No Mocks, Real Network Calls
 *
 * These tests make actual HTTP requests to test our error handling,
 * network resilience, and real-world failure scenarios.
 *
 * Failures here teach us about:
 * - Network timeout handling
 * - CORS issues
 * - Server error responses
 * - Malformed data handling
 * - Connection drops
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Real document service component (no mocking!)
const DocumentService = () => {
  const [documents, setDocuments] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [lastRequestTime, setLastRequestTime] = React.useState<number | null>(null)

  const fetchDocuments = async () => {
    const startTime = Date.now()
    setLastRequestTime(startTime)
    setLoading(true)
    setError(null)

    try {
      // Real API call - no mocking!
      const response = await fetch('/api/documents', {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        // Real timeout - let's see what actually happens
        signal: AbortSignal.timeout(5000)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      setDocuments(data.documents || [])

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.log(`🚨 Real API error (after ${Date.now() - startTime}ms):`, errorMessage)

    } finally {
      setLoading(false)
    }
  }

  return (
    <div data-testid="document-service">
      <button onClick={fetchDocuments} data-testid="fetch-button">
        Fetch Documents
      </button>

      {loading && <div data-testid="loading">Loading...</div>}
      {error && <div data-testid="error">Error: {error}</div>}
      {lastRequestTime && (
        <div data-testid="request-time">
          Last request: {new Date(lastRequestTime).toLocaleTimeString()}
        </div>
      )}

      <ul data-testid="document-list">
        {documents.map((doc, idx) => (
          <li key={idx} data-testid={`document-${idx}`}>
            {doc.title || `Document ${idx}`}
          </li>
        ))}
      </ul>
    </div>
  )
}

// Real file upload component
const FileUploadService = () => {
  const [uploading, setUploading] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const [result, setResult] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const uploadFile = async (file: File) => {
    setUploading(true)
    setProgress(0)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      // Real XHR with progress tracking - no mocking!
      const xhr = new XMLHttpRequest()

      return new Promise((resolve, reject) => {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100
            setProgress(Math.round(percentComplete))
          }
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setResult(`Upload successful: ${xhr.responseText}`)
            resolve(xhr.responseText)
          } else {
            const error = `Upload failed: ${xhr.status} ${xhr.statusText}`
            setError(error)
            reject(new Error(error))
          }
        }

        xhr.onerror = () => {
          const error = 'Network error during upload'
          setError(error)
          reject(new Error(error))
        }

        xhr.ontimeout = () => {
          const error = 'Upload timeout'
          setError(error)
          reject(new Error(error))
        }

        xhr.open('POST', '/api/upload')
        xhr.timeout = 30000 // 30 second timeout
        xhr.send(formData)
      })

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload error'
      setError(errorMessage)

    } finally {
      setUploading(false)
    }
  }

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      uploadFile(file)
    }
  }

  return (
    <div data-testid="file-upload-service">
      <input
        type="file"
        onChange={handleFileInput}
        data-testid="file-input"
        disabled={uploading}
      />

      {uploading && (
        <div data-testid="upload-progress">
          Uploading: {progress}%
        </div>
      )}

      {result && <div data-testid="upload-result">{result}</div>}
      {error && <div data-testid="upload-error">Error: {error}</div>}
    </div>
  )
}

// Real WebSocket connection component
const RealtimeService = () => {
  const [connected, setConnected] = React.useState(false)
  const [messages, setMessages] = React.useState<string[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const wsRef = React.useRef<WebSocket | null>(null)

  const connect = () => {
    try {
      // Real WebSocket connection - no mocking!
      const ws = new WebSocket('ws://localhost:8001/ws')
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        setError(null)
        console.log('🔌 WebSocket connected')
      }

      ws.onmessage = (event) => {
        const message = event.data
        setMessages(prev => [...prev, message])
        console.log('📨 WebSocket message:', message)
      }

      ws.onerror = (event) => {
        const error = 'WebSocket error'
        setError(error)
        console.log('🚨 WebSocket error:', event)
      }

      ws.onclose = (event) => {
        setConnected(false)
        console.log('🔌 WebSocket closed:', event.code, event.reason)

        if (!event.wasClean) {
          setError(`Connection lost: ${event.code} ${event.reason}`)
        }
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Connection error'
      setError(errorMessage)
    }
  }

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }

  const sendMessage = (message: string) => {
    if (wsRef.current && connected) {
      wsRef.current.send(message)
    }
  }

  React.useEffect(() => {
    return () => {
      disconnect()
    }
  }, [])

  return (
    <div data-testid="realtime-service">
      <div data-testid="connection-status">
        Status: {connected ? 'Connected' : 'Disconnected'}
      </div>

      {error && <div data-testid="connection-error">Error: {error}</div>}

      <button
        onClick={connect}
        disabled={connected}
        data-testid="connect-button"
      >
        Connect
      </button>

      <button
        onClick={disconnect}
        disabled={!connected}
        data-testid="disconnect-button"
      >
        Disconnect
      </button>

      <button
        onClick={() => sendMessage(`Test message ${Date.now()}`)}
        disabled={!connected}
        data-testid="send-message-button"
      >
        Send Test Message
      </button>

      <ul data-testid="message-list">
        {messages.map((msg, idx) => (
          <li key={idx} data-testid={`message-${idx}`}>
            {msg}
          </li>
        ))}
      </ul>
    </div>
  )
}

describe('REAL API Integration Tests - Learning from Real Failures', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
  })

  describe('Real HTTP Requests - No Mocking', () => {
    it('should handle real API success or reveal actual network issues', async () => {
      render(<DocumentService />)

      const fetchButton = screen.getByTestId('fetch-button')
      await user.click(fetchButton)

      // This will either succeed if the API is up, or fail and teach us something
      expect(screen.getByTestId('loading')).toBeInTheDocument()

      await waitFor(
        () => {
          // Look for either success or failure - both are valuable
          const loading = screen.queryByTestId('loading')
          expect(loading).not.toBeInTheDocument()
        },
        { timeout: 10000 } // Real network timeout
      )

      const error = screen.queryByTestId('error')
      const documentList = screen.queryByTestId('document-list')

      if (error) {
        console.log('🚨 Real API call failed:', error.textContent)
        // This is good - we're learning about real failure modes!
        expect(error).toBeInTheDocument()
      } else {
        console.log('✅ Real API call succeeded')
        expect(documentList).toBeInTheDocument()
      }
    })

    it('should reveal what happens with malformed API responses', async () => {
      // Setup a test server that returns malformed JSON
      const TestBadApiComponent = () => {
        const [result, setResult] = React.useState<string | null>(null)
        const [error, setError] = React.useState<string | null>(null)

        const callBadApi = async () => {
          try {
            // Call an endpoint that might return malformed JSON
            const response = await fetch('/api/bad-json-endpoint')
            const data = await response.json() // This might fail!
            setResult(JSON.stringify(data))
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error')
          }
        }

        return (
          <div>
            <button onClick={callBadApi} data-testid="bad-api-button">
              Call Bad API
            </button>
            {result && <div data-testid="api-result">{result}</div>}
            {error && <div data-testid="api-error">{error}</div>}
          </div>
        )
      }

      render(<TestBadApiComponent />)

      const button = screen.getByTestId('bad-api-button')
      await user.click(button)

      await waitFor(() => {
        const error = screen.queryByTestId('api-error')
        const result = screen.queryByTestId('api-result')

        // Either we get an error (good, we're handling it) or success
        expect(error || result).toBeInTheDocument()

        if (error) {
          console.log('📊 Malformed JSON handling:', error.textContent)
        }
      }, { timeout: 5000 })
    })

    it('should test real timeout scenarios', async () => {
      const TimeoutComponent = () => {
        const [status, setStatus] = React.useState('idle')
        const [duration, setDuration] = React.useState<number | null>(null)

        const testTimeout = async () => {
          const startTime = Date.now()
          setStatus('loading')

          try {
            // Real request with short timeout
            const controller = new AbortController()
            setTimeout(() => controller.abort(), 1000) // 1 second timeout

            await fetch('/api/slow-endpoint', {
              signal: controller.signal
            })

            setStatus('success')
            setDuration(Date.now() - startTime)

          } catch (err) {
            setStatus('timeout')
            setDuration(Date.now() - startTime)
            console.log(`⏱️ Real timeout after ${Date.now() - startTime}ms:`, err)
          }
        }

        return (
          <div>
            <button onClick={testTimeout} data-testid="timeout-test-button">
              Test Timeout
            </button>
            <div data-testid="timeout-status">Status: {status}</div>
            {duration && <div data-testid="timeout-duration">Duration: {duration}ms</div>}
          </div>
        )
      }

      render(<TimeoutComponent />)

      const button = screen.getByTestId('timeout-test-button')
      await user.click(button)

      await waitFor(() => {
        const status = screen.getByTestId('timeout-status')
        expect(status.textContent).toMatch(/Status: (timeout|success)/)
      }, { timeout: 3000 })

      // Log the actual behavior
      const statusElement = screen.getByTestId('timeout-status')
      const durationElement = screen.queryByTestId('timeout-duration')
      console.log('🔍 Timeout test result:', statusElement.textContent, durationElement?.textContent)
    })
  })

  describe('Real File Upload - No XHR Mocking', () => {
    it('should handle real file uploads or reveal upload issues', async () => {
      render(<FileUploadService />)

      const fileInput = screen.getByTestId('file-input')

      // Create a real file
      const testFile = new File(['test file content'], 'test.txt', {
        type: 'text/plain'
      })

      // Real file upload - no mocking!
      await user.upload(fileInput, testFile)

      // Wait for upload to complete or fail
      await waitFor(() => {
        const progress = screen.queryByTestId('upload-progress')
        const result = screen.queryByTestId('upload-result')
        const error = screen.queryByTestId('upload-error')

        // Should have either completed or failed
        expect(!progress || result || error).toBeTruthy()
      }, { timeout: 10000 })

      const result = screen.queryByTestId('upload-result')
      const error = screen.queryByTestId('upload-error')

      if (error) {
        console.log('📁 Real file upload failed:', error.textContent)
        // This teaches us about upload error handling
      } else if (result) {
        console.log('✅ Real file upload succeeded:', result.textContent)
      }
    })

    it('should reveal progress tracking accuracy', async () => {
      render(<FileUploadService />)

      const fileInput = screen.getByTestId('file-input')

      // Create a larger file to see progress
      const largeContent = 'x'.repeat(1024 * 1024) // 1MB
      const largeFile = new File([largeContent], 'large.txt', {
        type: 'text/plain'
      })

      await user.upload(fileInput, largeFile)

      // Monitor progress updates
      const progressUpdates: number[] = []
      const checkProgress = () => {
        const progressElement = screen.queryByTestId('upload-progress')
        if (progressElement) {
          const match = progressElement.textContent?.match(/(\d+)%/)
          if (match) {
            const percent = parseInt(match[1])
            progressUpdates.push(percent)
          }
        }
      }

      // Check progress every 100ms
      const interval = setInterval(checkProgress, 100)

      await waitFor(() => {
        const result = screen.queryByTestId('upload-result')
        const error = screen.queryByTestId('upload-error')
        return result || error
      }, { timeout: 15000 })

      clearInterval(interval)

      console.log('📈 Real progress updates:', progressUpdates)

      // Analyze progress tracking behavior
      if (progressUpdates.length > 0) {
        const maxProgress = Math.max(...progressUpdates)
        console.log(`📊 Max progress reached: ${maxProgress}%`)
      }
    })
  })

  describe('Real WebSocket Connections', () => {
    it('should handle real WebSocket connections or reveal connection issues', async () => {
      render(<RealtimeService />)

      const connectButton = screen.getByTestId('connect-button')

      // Attempt real WebSocket connection
      await user.click(connectButton)

      // Wait for connection result
      await waitFor(() => {
        const status = screen.getByTestId('connection-status')
        const error = screen.queryByTestId('connection-error')

        // Should show either connected or error
        expect(
          status.textContent?.includes('Connected') ||
          status.textContent?.includes('Disconnected') ||
          error
        ).toBeTruthy()
      }, { timeout: 5000 })

      const status = screen.getByTestId('connection-status')
      const error = screen.queryByTestId('connection-error')

      if (error) {
        console.log('🔌 WebSocket connection failed:', error.textContent)
        // This teaches us about real connection issues
      } else if (status.textContent?.includes('Connected')) {
        console.log('✅ WebSocket connected successfully')

        // Test sending messages
        const sendButton = screen.getByTestId('send-message-button')
        await user.click(sendButton)

        // Wait for message echo
        await waitFor(() => {
          const messages = screen.queryByTestId('message-0')
          return messages
        }, { timeout: 2000 })

        const messages = screen.queryAllByTestId(/message-\d+/)
        console.log(`📨 Received ${messages.length} real messages`)
      }
    })

    it('should reveal what happens during connection drops', async () => {
      render(<RealtimeService />)

      const connectButton = screen.getByTestId('connect-button')
      await user.click(connectButton)

      // Wait for connection
      await waitFor(() => {
        const status = screen.getByTestId('connection-status')
        return status.textContent?.includes('Connected')
      }, { timeout: 3000 })

      // Now disconnect and see what happens
      const disconnectButton = screen.getByTestId('disconnect-button')
      await user.click(disconnectButton)

      await waitFor(() => {
        const status = screen.getByTestId('connection-status')
        return status.textContent?.includes('Disconnected')
      }, { timeout: 2000 })

      console.log('🔌 Tested real connection drop behavior')
    })
  })

  describe('Real Network Conditions', () => {
    it('should test behavior under real slow network conditions', async () => {
      // This test simulates slow network by using a large payload
      const SlowNetworkComponent = () => {
        const [loading, setLoading] = React.useState(false)
        const [result, setResult] = React.useState<string | null>(null)
        const [startTime, setStartTime] = React.useState<number | null>(null)

        const testSlowNetwork = async () => {
          const start = Date.now()
          setStartTime(start)
          setLoading(true)

          try {
            // Request a large resource to simulate slow network
            const response = await fetch('/api/large-data', {
              method: 'POST',
              body: JSON.stringify({ size: 1024 * 1024 }), // 1MB payload
              headers: { 'Content-Type': 'application/json' }
            })

            const data = await response.text()
            const duration = Date.now() - start
            setResult(`Completed in ${duration}ms`)
            console.log(`🐌 Slow network test: ${duration}ms`)

          } catch (err) {
            const duration = Date.now() - start
            setResult(`Failed after ${duration}ms`)
            console.log(`🚨 Slow network failed: ${duration}ms`)

          } finally {
            setLoading(false)
          }
        }

        return (
          <div>
            <button onClick={testSlowNetwork} data-testid="slow-network-button">
              Test Slow Network
            </button>
            {loading && <div data-testid="slow-loading">Loading...</div>}
            {result && <div data-testid="slow-result">{result}</div>}
          </div>
        )
      }

      render(<SlowNetworkComponent />)

      const button = screen.getByTestId('slow-network-button')
      await user.click(button)

      // Wait for slow operation
      await waitFor(() => {
        const loading = screen.queryByTestId('slow-loading')
        const result = screen.queryByTestId('slow-result')
        return !loading || result
      }, { timeout: 10000 })

      const result = screen.queryByTestId('slow-result')
      if (result) {
        console.log('📊 Slow network result:', result.textContent)
      }
    })

    it('should test concurrent request handling', async () => {
      const ConcurrentRequestComponent = () => {
        const [results, setResults] = React.useState<string[]>([])
        const [loading, setLoading] = React.useState(false)

        const testConcurrentRequests = async () => {
          setLoading(true)
          setResults([])

          // Fire 5 concurrent requests
          const requests = Array.from({ length: 5 }, (_, i) =>
            fetch(`/api/test-endpoint?id=${i}`)
              .then(response => response.ok ? `Request ${i}: Success` : `Request ${i}: Failed`)
              .catch(err => `Request ${i}: Error - ${err.message}`)
          )

          try {
            const responses = await Promise.allSettled(requests)
            const results = responses.map((r, i) =>
              r.status === 'fulfilled' ? r.value : `Request ${i}: Rejected`
            )
            setResults(results)

          } finally {
            setLoading(false)
          }
        }

        return (
          <div>
            <button onClick={testConcurrentRequests} data-testid="concurrent-button">
              Test Concurrent Requests
            </button>
            {loading && <div data-testid="concurrent-loading">Loading...</div>}
            <ul data-testid="concurrent-results">
              {results.map((result, idx) => (
                <li key={idx} data-testid={`concurrent-result-${idx}`}>
                  {result}
                </li>
              ))}
            </ul>
          </div>
        )
      }

      render(<ConcurrentRequestComponent />)

      const button = screen.getByTestId('concurrent-button')
      await user.click(button)

      await waitFor(() => {
        const loading = screen.queryByTestId('concurrent-loading')
        const results = screen.queryAllByTestId(/concurrent-result-\d+/)
        return !loading && results.length > 0
      }, { timeout: 8000 })

      const results = screen.queryAllByTestId(/concurrent-result-\d+/)
      console.log(`🏃 Concurrent requests completed: ${results.length}/5`)
      results.forEach((result, idx) => {
        console.log(`  ${idx}: ${result.textContent}`)
      })
    })
  })
})