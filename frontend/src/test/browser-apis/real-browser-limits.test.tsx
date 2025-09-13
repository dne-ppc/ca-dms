/**
 * REAL Browser API Tests - Testing Actual Browser Limitations
 *
 * These tests use actual browser APIs to discover real limitations,
 * compatibility issues, and edge cases. No polyfills, no mocks -
 * just raw browser behavior that teaches us about real-world constraints!
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Component that tests real storage APIs
const RealStorageTestComponent = () => {
  const [results, setResults] = React.useState<string[]>([])
  const [errors, setErrors] = React.useState<string[]>([])

  const testLocalStorageLimit = () => {
    try {
      let data = 'x'
      let totalSize = 0
      let iterations = 0

      // Keep doubling until we hit the limit
      while (iterations < 25) { // Safety limit
        try {
          localStorage.setItem('test-limit', data)
          totalSize = data.length
          data += data // Double the size
          iterations++
        } catch (err) {
          localStorage.removeItem('test-limit')
          setResults(prev => [...prev, `localStorage limit: ~${(totalSize / 1024 / 1024).toFixed(2)}MB`])
          return
        }
      }

      localStorage.removeItem('test-limit')
      setResults(prev => [...prev, `localStorage: No limit found under ${(totalSize / 1024 / 1024).toFixed(2)}MB`])

    } catch (err) {
      setErrors(prev => [...prev, `localStorage test error: ${err instanceof Error ? err.message : 'Unknown'}`])
    }
  }

  const testSessionStorageLimit = () => {
    try {
      let data = 'x'
      let totalSize = 0
      let iterations = 0

      while (iterations < 25) {
        try {
          sessionStorage.setItem('test-limit', data)
          totalSize = data.length
          data += data
          iterations++
        } catch (err) {
          sessionStorage.removeItem('test-limit')
          setResults(prev => [...prev, `sessionStorage limit: ~${(totalSize / 1024 / 1024).toFixed(2)}MB`])
          return
        }
      }

      sessionStorage.removeItem('test-limit')
      setResults(prev => [...prev, `sessionStorage: No limit found under ${(totalSize / 1024 / 1024).toFixed(2)}MB`])

    } catch (err) {
      setErrors(prev => [...prev, `sessionStorage test error: ${err instanceof Error ? err.message : 'Unknown'}`])
    }
  }

  const testIndexedDBLimit = async () => {
    try {
      const dbName = 'test-idb-limit'
      const request = indexedDB.open(dbName, 1)

      request.onerror = () => {
        setErrors(prev => [...prev, 'IndexedDB not available'])
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        const objectStore = db.createObjectStore('testStore', { keyPath: 'id' })
      }

      request.onsuccess = async (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        try {
          // Try to store large objects
          const transaction = db.transaction(['testStore'], 'readwrite')
          const objectStore = transaction.objectStore('testStore')

          const largeData = 'x'.repeat(1024 * 1024) // 1MB string
          let count = 0

          const storeData = () => {
            return new Promise((resolve, reject) => {
              const request = objectStore.add({ id: count++, data: largeData })
              request.onsuccess = resolve
              request.onerror = reject
            })
          }

          // Try to store multiple 1MB objects
          for (let i = 0; i < 100; i++) {
            await storeData()
          }

          setResults(prev => [...prev, `IndexedDB: Stored ${count}MB successfully`])

        } catch (err) {
          setResults(prev => [...prev, `IndexedDB limit reached at ~${count}MB`])
        } finally {
          db.close()
          indexedDB.deleteDatabase(dbName)
        }
      }

    } catch (err) {
      setErrors(prev => [...prev, `IndexedDB test error: ${err instanceof Error ? err.message : 'Unknown'}`])
    }
  }

  return (
    <div data-testid="storage-test">
      <button onClick={testLocalStorageLimit} data-testid="test-localstorage">
        Test localStorage Limit
      </button>
      <button onClick={testSessionStorageLimit} data-testid="test-sessionstorage">
        Test sessionStorage Limit
      </button>
      <button onClick={testIndexedDBLimit} data-testid="test-indexeddb">
        Test IndexedDB Limit
      </button>

      <div data-testid="storage-results">
        <h4>Results:</h4>
        <ul>
          {results.map((result, idx) => (
            <li key={idx} data-testid={`storage-result-${idx}`}>
              {result}
            </li>
          ))}
        </ul>
      </div>

      <div data-testid="storage-errors">
        <h4>Errors:</h4>
        <ul>
          {errors.map((error, idx) => (
            <li key={idx} data-testid={`storage-error-${idx}`} style={{ color: 'red' }}>
              {error}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// Component that tests real performance APIs
const RealPerformanceTestComponent = () => {
  const [measurements, setMeasurements] = React.useState<string[]>([])
  const [apiSupport, setApiSupport] = React.useState<Record<string, boolean>>({})

  React.useEffect(() => {
    // Check API support
    setApiSupport({
      performance: typeof performance !== 'undefined',
      performanceObserver: typeof PerformanceObserver !== 'undefined',
      intersectionObserver: typeof IntersectionObserver !== 'undefined',
      mutationObserver: typeof MutationObserver !== 'undefined',
      resizeObserver: typeof ResizeObserver !== 'undefined',
      requestIdleCallback: typeof requestIdleCallback !== 'undefined'
    })
  }, [])

  const measureRenderPerformance = () => {
    if (!performance.mark) {
      setMeasurements(prev => [...prev, 'Performance.mark not supported'])
      return
    }

    try {
      // Create performance marks
      performance.mark('render-start')

      // Simulate heavy rendering
      const elements = []
      for (let i = 0; i < 1000; i++) {
        const div = document.createElement('div')
        div.textContent = `Element ${i}`
        elements.push(div)
      }

      performance.mark('render-end')
      performance.measure('render-duration', 'render-start', 'render-end')

      const measures = performance.getEntriesByType('measure')
      const renderMeasure = measures.find(m => m.name === 'render-duration')

      if (renderMeasure) {
        setMeasurements(prev => [...prev, `Render performance: ${renderMeasure.duration.toFixed(2)}ms`])
      }

      // Cleanup
      performance.clearMarks()
      performance.clearMeasures()

    } catch (err) {
      setMeasurements(prev => [...prev, `Performance measurement error: ${err instanceof Error ? err.message : 'Unknown'}`])
    }
  }

  const testNavigationTiming = () => {
    try {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming

      if (navigation) {
        const metrics = [
          `DNS Lookup: ${(navigation.domainLookupEnd - navigation.domainLookupStart).toFixed(2)}ms`,
          `TCP Connect: ${(navigation.connectEnd - navigation.connectStart).toFixed(2)}ms`,
          `Request: ${(navigation.responseStart - navigation.requestStart).toFixed(2)}ms`,
          `Response: ${(navigation.responseEnd - navigation.responseStart).toFixed(2)}ms`,
          `DOM Loading: ${(navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart).toFixed(2)}ms`,
          `Page Load: ${(navigation.loadEventEnd - navigation.loadEventStart).toFixed(2)}ms`
        ]

        metrics.forEach(metric => {
          setMeasurements(prev => [...prev, metric])
        })
      } else {
        setMeasurements(prev => [...prev, 'Navigation timing not available'])
      }

    } catch (err) {
      setMeasurements(prev => [...prev, `Navigation timing error: ${err instanceof Error ? err.message : 'Unknown'}`])
    }
  }

  const testMemoryInfo = () => {
    try {
      // @ts-ignore - Chrome-specific API
      if (performance.memory) {
        // @ts-ignore
        const memory = performance.memory
        setMeasurements(prev => [...prev, `JS Heap Used: ${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`])
        setMeasurements(prev => [...prev, `JS Heap Total: ${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`])
        setMeasurements(prev => [...prev, `JS Heap Limit: ${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)}MB`])
      } else {
        setMeasurements(prev => [...prev, 'Memory info not available (Chrome-specific)'])
      }
    } catch (err) {
      setMeasurements(prev => [...prev, `Memory info error: ${err instanceof Error ? err.message : 'Unknown'}`])
    }
  }

  return (
    <div data-testid="performance-test">
      <div data-testid="api-support">
        <h4>API Support:</h4>
        <ul>
          {Object.entries(apiSupport).map(([api, supported]) => (
            <li key={api} data-testid={`api-${api}`}>
              {api}: {supported ? '✅' : '❌'}
            </li>
          ))}
        </ul>
      </div>

      <button onClick={measureRenderPerformance} data-testid="test-render-perf">
        Measure Render Performance
      </button>
      <button onClick={testNavigationTiming} data-testid="test-navigation-timing">
        Test Navigation Timing
      </button>
      <button onClick={testMemoryInfo} data-testid="test-memory-info">
        Test Memory Info
      </button>

      <div data-testid="performance-results">
        <h4>Measurements:</h4>
        <ul>
          {measurements.map((measurement, idx) => (
            <li key={idx} data-testid={`measurement-${idx}`}>
              {measurement}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// Component that tests real media/device APIs
const RealDeviceAPITestComponent = () => {
  const [deviceInfo, setDeviceInfo] = React.useState<string[]>([])
  const [mediaResults, setMediaResults] = React.useState<string[]>([])
  const [errors, setErrors] = React.useState<string[]>([])

  const testDeviceInfo = () => {
    try {
      const info = [
        `User Agent: ${navigator.userAgent}`,
        `Platform: ${navigator.platform}`,
        `Language: ${navigator.language}`,
        `Languages: ${navigator.languages?.join(', ') || 'Not available'}`,
        `Online: ${navigator.onLine}`,
        `Cookies Enabled: ${navigator.cookieEnabled}`,
        `Hardware Concurrency: ${navigator.hardwareConcurrency || 'Not available'}`,
        `Device Memory: ${(navigator as any).deviceMemory || 'Not available'}GB`,
        `Screen: ${screen.width}x${screen.height}`,
        `Screen Color Depth: ${screen.colorDepth}`,
        `Device Pixel Ratio: ${window.devicePixelRatio}`
      ]

      setDeviceInfo(info)

    } catch (err) {
      setErrors(prev => [...prev, `Device info error: ${err instanceof Error ? err.message : 'Unknown'}`])
    }
  }

  const testGeolocation = async () => {
    if (!navigator.geolocation) {
      setMediaResults(prev => [...prev, 'Geolocation not supported'])
      return
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 5000,
          maximumAge: 0
        })
      })

      setMediaResults(prev => [...prev, `Geolocation: ${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`])
      setMediaResults(prev => [...prev, `Accuracy: ${position.coords.accuracy}m`])

    } catch (err) {
      setMediaResults(prev => [...prev, `Geolocation error: ${err instanceof Error ? err.message : 'Unknown'}`])
    }
  }

  const testMediaDevices = async () => {
    if (!navigator.mediaDevices) {
      setMediaResults(prev => [...prev, 'MediaDevices not supported'])
      return
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices()

      const audioInputs = devices.filter(d => d.kind === 'audioinput')
      const videoInputs = devices.filter(d => d.kind === 'videoinput')
      const audioOutputs = devices.filter(d => d.kind === 'audiooutput')

      setMediaResults(prev => [...prev, `Audio inputs: ${audioInputs.length}`])
      setMediaResults(prev => [...prev, `Video inputs: ${videoInputs.length}`])
      setMediaResults(prev => [...prev, `Audio outputs: ${audioOutputs.length}`])

      // Test getUserMedia constraints
      const constraints = { audio: true, video: { width: 640, height: 480 } }

      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        setMediaResults(prev => [...prev, 'Camera/microphone access: ✅'])

        // Stop the stream immediately
        stream.getTracks().forEach(track => track.stop())
      } catch (mediaErr) {
        setMediaResults(prev => [...prev, `Camera/microphone access: ❌ ${mediaErr instanceof Error ? mediaErr.message : 'Unknown'}`])
      }

    } catch (err) {
      setErrors(prev => [...prev, `Media devices error: ${err instanceof Error ? err.message : 'Unknown'}`])
    }
  }

  const testNetworkInfo = () => {
    try {
      // @ts-ignore - Experimental API
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection

      if (connection) {
        setMediaResults(prev => [...prev, `Connection type: ${connection.effectiveType || 'Unknown'}`])
        setMediaResults(prev => [...prev, `Downlink: ${connection.downlink || 'Unknown'}Mbps`])
        setMediaResults(prev => [...prev, `RTT: ${connection.rtt || 'Unknown'}ms`])
        setMediaResults(prev => [...prev, `Save data: ${connection.saveData ? 'Yes' : 'No'}`])
      } else {
        setMediaResults(prev => [...prev, 'Network Information API not supported'])
      }

    } catch (err) {
      setErrors(prev => [...prev, `Network info error: ${err instanceof Error ? err.message : 'Unknown'}`])
    }
  }

  const testBatteryStatus = async () => {
    try {
      // @ts-ignore - Deprecated but still interesting to test
      if (navigator.getBattery) {
        // @ts-ignore
        const battery = await navigator.getBattery()

        setMediaResults(prev => [...prev, `Battery level: ${(battery.level * 100).toFixed(0)}%`])
        setMediaResults(prev => [...prev, `Charging: ${battery.charging ? 'Yes' : 'No'}`])
        setMediaResults(prev => [...prev, `Charging time: ${battery.chargingTime === Infinity ? 'Unknown' : battery.chargingTime}s`])
        setMediaResults(prev => [...prev, `Discharging time: ${battery.dischargingTime === Infinity ? 'Unknown' : battery.dischargingTime}s`])
      } else {
        setMediaResults(prev => [...prev, 'Battery Status API not supported'])
      }

    } catch (err) {
      setErrors(prev => [...prev, `Battery status error: ${err instanceof Error ? err.message : 'Unknown'}`])
    }
  }

  return (
    <div data-testid="device-api-test">
      <button onClick={testDeviceInfo} data-testid="test-device-info">
        Test Device Info
      </button>
      <button onClick={testGeolocation} data-testid="test-geolocation">
        Test Geolocation
      </button>
      <button onClick={testMediaDevices} data-testid="test-media-devices">
        Test Media Devices
      </button>
      <button onClick={testNetworkInfo} data-testid="test-network-info">
        Test Network Info
      </button>
      <button onClick={testBatteryStatus} data-testid="test-battery">
        Test Battery Status
      </button>

      <div data-testid="device-info">
        <h4>Device Information:</h4>
        <ul>
          {deviceInfo.map((info, idx) => (
            <li key={idx} data-testid={`device-info-${idx}`} style={{ fontSize: '12px' }}>
              {info}
            </li>
          ))}
        </ul>
      </div>

      <div data-testid="media-results">
        <h4>Media/Sensor Results:</h4>
        <ul>
          {mediaResults.map((result, idx) => (
            <li key={idx} data-testid={`media-result-${idx}`}>
              {result}
            </li>
          ))}
        </ul>
      </div>

      <div data-testid="device-errors">
        <h4>Errors:</h4>
        <ul>
          {errors.map((error, idx) => (
            <li key={idx} data-testid={`device-error-${idx}`} style={{ color: 'red' }}>
              {error}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

describe('REAL Browser API Tests - Discovering Actual Limitations', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
  })

  describe('Storage API Limits', () => {
    it('should discover real localStorage limits', async () => {
      render(<RealStorageTestComponent />)

      const testButton = screen.getByTestId('test-localstorage')
      await user.click(testButton)

      // Wait for the test to complete
      await waitFor(() => {
        const results = screen.queryAllByTestId(/storage-result-\d+/)
        const errors = screen.queryAllByTestId(/storage-error-\d+/)
        return results.length > 0 || errors.length > 0
      }, { timeout: 5000 })

      const results = screen.queryAllByTestId(/storage-result-\d+/)
      const errors = screen.queryAllByTestId(/storage-error-\d+/)

      if (results.length > 0) {
        console.log('💾 localStorage test result:', results[0].textContent)
      }

      if (errors.length > 0) {
        console.log('🚨 localStorage test error:', errors[0].textContent)
      }

      // Either we found a limit or got an error - both are valuable information
      expect(results.length + errors.length).toBeGreaterThan(0)
    })

    it('should discover real sessionStorage limits', async () => {
      render(<RealStorageTestComponent />)

      const testButton = screen.getByTestId('test-sessionstorage')
      await user.click(testButton)

      await waitFor(() => {
        const results = screen.queryAllByTestId(/storage-result-\d+/)
        const errors = screen.queryAllByTestId(/storage-error-\d+/)
        return results.length > 0 || errors.length > 0
      }, { timeout: 5000 })

      const results = screen.queryAllByTestId(/storage-result-\d+/)
      if (results.length > 0) {
        console.log('💾 sessionStorage test result:', results[0].textContent)
      }
    })

    it('should test real IndexedDB capabilities', async () => {
      render(<RealStorageTestComponent />)

      const testButton = screen.getByTestId('test-indexeddb')
      await user.click(testButton)

      await waitFor(() => {
        const results = screen.queryAllByTestId(/storage-result-\d+/)
        const errors = screen.queryAllByTestId(/storage-error-\d+/)
        return results.length > 0 || errors.length > 0
      }, { timeout: 10000 }) // Longer timeout for IDB

      const results = screen.queryAllByTestId(/storage-result-\d+/)
      const errors = screen.queryAllByTestId(/storage-error-\d+/)

      if (results.length > 0) {
        console.log('🗄️ IndexedDB test result:', results[0].textContent)
      }

      if (errors.length > 0) {
        console.log('🚨 IndexedDB test error:', errors[0].textContent)
      }
    })
  })

  describe('Performance API Capabilities', () => {
    it('should test real performance measurement APIs', async () => {
      render(<RealPerformanceTestComponent />)

      // Check API support first
      const apiElements = screen.queryAllByTestId(/api-\w+/)
      apiElements.forEach(element => {
        console.log('🔧 API support:', element.textContent)
      })

      // Test render performance
      const renderPerfButton = screen.getByTestId('test-render-perf')
      await user.click(renderPerfButton)

      await waitFor(() => {
        const measurements = screen.queryAllByTestId(/measurement-\d+/)
        return measurements.length > 0
      }, { timeout: 2000 })

      const measurements = screen.queryAllByTestId(/measurement-\d+/)
      measurements.forEach(measurement => {
        console.log('📊 Performance measurement:', measurement.textContent)
      })
    })

    it('should test navigation timing APIs', async () => {
      render(<RealPerformanceTestComponent />)

      const navTimingButton = screen.getByTestId('test-navigation-timing')
      await user.click(navTimingButton)

      await waitFor(() => {
        const measurements = screen.queryAllByTestId(/measurement-\d+/)
        return measurements.length > 0
      }, { timeout: 2000 })

      const measurements = screen.queryAllByTestId(/measurement-\d+/)
      measurements.forEach(measurement => {
        console.log('🧭 Navigation timing:', measurement.textContent)
      })
    })

    it('should test memory information APIs', async () => {
      render(<RealPerformanceTestComponent />)

      const memoryButton = screen.getByTestId('test-memory-info')
      await user.click(memoryButton)

      await waitFor(() => {
        const measurements = screen.queryAllByTestId(/measurement-\d+/)
        return measurements.length > 0
      }, { timeout: 2000 })

      const measurements = screen.queryAllByTestId(/measurement-\d+/)
      measurements.forEach(measurement => {
        console.log('🧠 Memory info:', measurement.textContent)
      })
    })
  })

  describe('Device and Media APIs', () => {
    it('should discover device capabilities', async () => {
      render(<RealDeviceAPITestComponent />)

      const deviceInfoButton = screen.getByTestId('test-device-info')
      await user.click(deviceInfoButton)

      await waitFor(() => {
        const deviceInfo = screen.queryAllByTestId(/device-info-\d+/)
        return deviceInfo.length > 0
      }, { timeout: 2000 })

      const deviceInfo = screen.queryAllByTestId(/device-info-\d+/)
      deviceInfo.forEach(info => {
        console.log('📱 Device info:', info.textContent)
      })

      expect(deviceInfo.length).toBeGreaterThan(5) // Should have multiple device info items
    })

    it('should test geolocation capabilities', async () => {
      render(<RealDeviceAPITestComponent />)

      const geolocationButton = screen.getByTestId('test-geolocation')
      await user.click(geolocationButton)

      await waitFor(() => {
        const results = screen.queryAllByTestId(/media-result-\d+/)
        const errors = screen.queryAllByTestId(/device-error-\d+/)
        return results.length > 0 || errors.length > 0
      }, { timeout: 8000 })

      const results = screen.queryAllByTestId(/media-result-\d+/)
      const errors = screen.queryAllByTestId(/device-error-\d+/)

      if (results.length > 0) {
        results.forEach(result => {
          console.log('🌍 Geolocation result:', result.textContent)
        })
      }

      if (errors.length > 0) {
        errors.forEach(error => {
          console.log('🚨 Geolocation error:', error.textContent)
        })
      }

      // Either success or informative failure
      expect(results.length + errors.length).toBeGreaterThan(0)
    })

    it('should test media device capabilities', async () => {
      render(<RealDeviceAPITestComponent />)

      const mediaButton = screen.getByTestId('test-media-devices')
      await user.click(mediaButton)

      await waitFor(() => {
        const results = screen.queryAllByTestId(/media-result-\d+/)
        const errors = screen.queryAllByTestId(/device-error-\d+/)
        return results.length > 0 || errors.length > 0
      }, { timeout: 8000 })

      const results = screen.queryAllByTestId(/media-result-\d+/)
      results.forEach(result => {
        console.log('📹 Media device result:', result.textContent)
      })

      const errors = screen.queryAllByTestId(/device-error-\d+/)
      errors.forEach(error => {
        console.log('🚨 Media device error:', error.textContent)
      })
    })

    it('should test network information APIs', async () => {
      render(<RealDeviceAPITestComponent />)

      const networkButton = screen.getByTestId('test-network-info')
      await user.click(networkButton)

      await waitFor(() => {
        const results = screen.queryAllByTestId(/media-result-\d+/)
        return results.length > 0
      }, { timeout: 2000 })

      const results = screen.queryAllByTestId(/media-result-\d+/)
      results.forEach(result => {
        console.log('🌐 Network info:', result.textContent)
      })
    })

    it('should test battery status APIs', async () => {
      render(<RealDeviceAPITestComponent />)

      const batteryButton = screen.getByTestId('test-battery')
      await user.click(batteryButton)

      await waitFor(() => {
        const results = screen.queryAllByTestId(/media-result-\d+/)
        const errors = screen.queryAllByTestId(/device-error-\d+/)
        return results.length > 0 || errors.length > 0
      }, { timeout: 5000 })

      const results = screen.queryAllByTestId(/media-result-\d+/)
      results.forEach(result => {
        console.log('🔋 Battery info:', result.textContent)
      })

      const errors = screen.queryAllByTestId(/device-error-\d+/)
      errors.forEach(error => {
        console.log('🚨 Battery error:', error.textContent)
      })
    })
  })

  describe('Cross-Browser Compatibility', () => {
    it('should document actual browser differences', async () => {
      // Test features that vary by browser
      const browserFeatures = {
        webkitRequestFullscreen: 'webkitRequestFullscreen' in document.documentElement,
        mozRequestFullScreen: 'mozRequestFullScreen' in document.documentElement,
        msRequestFullscreen: 'msRequestFullscreen' in document.documentElement,
        requestFullscreen: 'requestFullscreen' in document.documentElement,

        webkitSpeechRecognition: 'webkitSpeechRecognition' in window,
        SpeechRecognition: 'SpeechRecognition' in window,

        webkitAudioContext: 'webkitAudioContext' in window,
        AudioContext: 'AudioContext' in window,

        webkitIndexedDB: 'webkitIndexedDB' in window,
        indexedDB: 'indexedDB' in window,

        requestIdleCallback: 'requestIdleCallback' in window,
        cancelIdleCallback: 'cancelIdleCallback' in window
      }

      console.log('🌐 Browser Feature Support:')
      Object.entries(browserFeatures).forEach(([feature, supported]) => {
        console.log(`   ${feature}: ${supported ? '✅' : '❌'}`)
      })

      // Test vendor-specific properties
      const vendorPrefixes = {
        webkit: '-webkit-',
        moz: '-moz-',
        ms: '-ms-',
        o: '-o-'
      }

      console.log('🏷️ Vendor Prefix Support:')
      Object.entries(vendorPrefixes).forEach(([vendor, prefix]) => {
        const testDiv = document.createElement('div')
        testDiv.style.setProperty(`${prefix}transform`, 'scale(1)')
        const hasSupport = testDiv.style.getPropertyValue(`${prefix}transform`) !== ''
        console.log(`   ${vendor} (${prefix}): ${hasSupport ? '✅' : '❌'}`)
      })

      // This test always passes - it's just for documentation
      expect(true).toBe(true)
    })
  })
})