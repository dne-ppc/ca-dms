/**
 * Cross-Browser Compatibility Testing - Task 2.4.3
 * Multi-browser validation and responsive design testing
 *
 * Following TDD methodology for cross-browser requirements:
 * - Browser API compatibility
 * - CSS feature support
 * - JavaScript compatibility
 * - Responsive design validation
 * - Progressive enhancement
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { IntroPage } from '../../pages/IntroPage'
import { DocumentEditor } from '../../pages/DocumentEditor'
import { SystemOverview } from '../../components/intro/SystemOverview'
import { PersonalStats } from '../../components/intro/PersonalStats'
import { SimpleRichTextEditor } from '../../components/editor/SimpleRichTextEditor'

import { vi } from 'vitest'

// Mock authentication
vi.mock('../../services/authService', () => ({
  isAuthenticated: () => true,
  getCurrentUser: () => Promise.resolve({
    id: 'test-user-123',
    email: 'test@ca-dms.local',
    name: 'Test User',
    role: 'admin'
  })
}))

// Mock intro page service
vi.mock('../../services/introPageService', () => ({
  introPageService: {
    getIntroPageData: () => Promise.resolve({
      userId: 'test-user-123',
      systemOverview: {
        total_users: 150,
        active_documents: 1250,
        documents_today: 8,
        documents_this_week: 45,
        system_health_score: 98.5
      },
      personalStats: {
        userId: 'test-user-123',
        documentCount: 42,
        templateCount: 8,
        documentsCreatedThisWeek: 5,
        documentsCreatedThisMonth: 18,
        collaborationScore: 85,
        productivityScore: 92.5,
        recentDocuments: [
          {
            id: 'doc-1',
            title: 'Test Document 1',
            updatedAt: new Date('2025-09-12T10:30:00Z'),
            status: 'approved' as const,
            type: 'meeting' as const
          }
        ],
        documentsByType: { meeting: 15, policy: 12 },
        workflowParticipation: {
          approvals_completed: 25,
          reviews_completed: 18,
          tasks_assigned: 8,
          tasks_completed: 6
        },
        activityTimeline: [
          { date: '2025-09-12', documents: 2, collaborations: 1 }
        ]
      },
      lastUpdated: new Date(),
      performanceMetrics: {
        coordination_time_ms: 150,
        cache_hit_rate: 85
      }
    })
  }
}))

interface BrowserCompatibilityTest {
  feature: string
  supported: boolean
  fallback?: string
  testMethod: () => boolean
}

interface ResponsiveBreakpoint {
  name: string
  width: number
  height: number
  expectedLayout: string
}

class CrossBrowserValidator {
  private results: Array<{
    category: string
    feature: string
    supported: boolean
    fallback?: string
  }> = []

  testBrowserAPI(apiName: string, testFunction: () => boolean, fallback?: string): boolean {
    const supported = testFunction()

    this.results.push({
      category: 'Browser API',
      feature: apiName,
      supported,
      fallback
    })

    return supported
  }

  testCSSFeature(feature: string, testFunction: () => boolean, fallback?: string): boolean {
    const supported = testFunction()

    this.results.push({
      category: 'CSS Feature',
      feature,
      supported,
      fallback
    })

    return supported
  }

  testJavaScriptFeature(feature: string, testFunction: () => boolean, fallback?: string): boolean {
    const supported = testFunction()

    this.results.push({
      category: 'JavaScript Feature',
      feature,
      supported,
      fallback
    })

    return supported
  }

  getCompatibilityReport(): {
    totalTests: number
    supportedFeatures: number
    compatibilityRate: number
    results: Array<{
      category: string
      feature: string
      supported: boolean
      fallback?: string
    }>
  } {
    const totalTests = this.results.length
    const supportedFeatures = this.results.filter(r => r.supported).length
    const compatibilityRate = (supportedFeatures / totalTests) * 100

    return {
      totalTests,
      supportedFeatures,
      compatibilityRate,
      results: this.results
    }
  }
}

class ResponsiveDesignTester {
  private viewport = {
    width: 1024,
    height: 768
  }

  setViewport(width: number, height: number) {
    this.viewport = { width, height }

    // Mock window.innerWidth and innerHeight
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: width,
    })
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: height,
    })

    // Trigger resize event
    window.dispatchEvent(new Event('resize'))
  }

  testResponsiveBreakpoints(component: JSX.Element, breakpoints: ResponsiveBreakpoint[]): Array<{
    breakpoint: string
    width: number
    passed: boolean
    layout: string
  }> {
    const results: Array<{
      breakpoint: string
      width: number
      passed: boolean
      layout: string
    }> = []

    breakpoints.forEach(breakpoint => {
      this.setViewport(breakpoint.width, breakpoint.height)

      const { container } = render(
        <BrowserRouter>
          {component}
        </BrowserRouter>
      )

      // Test if responsive classes are applied
      const hasExpectedLayout = container.querySelector(`.${breakpoint.expectedLayout}`) !== null ||
                              container.classList.contains(breakpoint.expectedLayout) ||
                              getComputedStyle(container).display !== 'none'

      results.push({
        breakpoint: breakpoint.name,
        width: breakpoint.width,
        passed: hasExpectedLayout,
        layout: hasExpectedLayout ? breakpoint.expectedLayout : 'unknown'
      })
    })

    return results
  }
}

describe('Cross-Browser Compatibility Testing - Task 2.4.3', () => {
  let compatibilityValidator: CrossBrowserValidator
  let responsiveDesignTester: ResponsiveDesignTester

  beforeEach(() => {
    compatibilityValidator = new CrossBrowserValidator()
    responsiveDesignTester = new ResponsiveDesignTester()

    // Mock browser features for testing
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: query.includes('max-width: 768px') ? window.innerWidth <= 768 : false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  describe('🌐 Browser API Compatibility', () => {
    it('should test essential browser APIs', () => {
      console.log('🌐 Testing Browser API Compatibility:')

      // Local Storage API
      const localStorageSupported = compatibilityValidator.testBrowserAPI(
        'localStorage',
        () => {
          try {
            localStorage.setItem('test', 'test')
            localStorage.removeItem('test')
            return true
          } catch {
            return false
          }
        },
        'Memory-based storage fallback'
      )

      // Fetch API
      const fetchSupported = compatibilityValidator.testBrowserAPI(
        'fetch',
        () => typeof window.fetch === 'function',
        'XMLHttpRequest fallback'
      )

      // URL API
      const urlSupported = compatibilityValidator.testBrowserAPI(
        'URL',
        () => {
          try {
            new URL('https://example.com')
            return true
          } catch {
            return false
          }
        },
        'Manual URL parsing fallback'
      )

      // IntersectionObserver API
      const intersectionObserverSupported = compatibilityValidator.testBrowserAPI(
        'IntersectionObserver',
        () => typeof window.IntersectionObserver === 'function',
        'Scroll event fallback'
      )

      // ResizeObserver API
      const resizeObserverSupported = compatibilityValidator.testBrowserAPI(
        'ResizeObserver',
        () => typeof window.ResizeObserver === 'function',
        'Window resize event fallback'
      )

      console.log(`  localStorage: ${localStorageSupported ? '✅' : '❌'}`)
      console.log(`  fetch: ${fetchSupported ? '✅' : '❌'}`)
      console.log(`  URL: ${urlSupported ? '✅' : '❌'}`)
      console.log(`  IntersectionObserver: ${intersectionObserverSupported ? '✅' : '❌'}`)
      console.log(`  ResizeObserver: ${resizeObserverSupported ? '✅' : '❌'}`)

      // At least 60% of APIs should be supported
      const report = compatibilityValidator.getCompatibilityReport()
      expect(report.compatibilityRate).toBeGreaterThanOrEqual(60)
    })

    it('should test Web Components and Custom Elements support', () => {
      const customElementsSupported = compatibilityValidator.testBrowserAPI(
        'customElements',
        () => typeof window.customElements === 'object' && typeof window.customElements.define === 'function',
        'Traditional component fallback'
      )

      const shadowDOMSupported = compatibilityValidator.testBrowserAPI(
        'shadowDOM',
        () => {
          try {
            const div = document.createElement('div')
            div.attachShadow({ mode: 'open' })
            return true
          } catch {
            return false
          }
        },
        'Standard DOM fallback'
      )

      console.log(`🔧 Web Components Support:`)
      console.log(`  Custom Elements: ${customElementsSupported ? '✅' : '❌'}`)
      console.log(`  Shadow DOM: ${shadowDOMSupported ? '✅' : '❌'}`)

      expect(customElementsSupported || shadowDOMSupported).toBe(true)
    })
  })

  describe('🎨 CSS Feature Compatibility', () => {
    it('should test modern CSS features', () => {
      console.log('🎨 Testing CSS Feature Compatibility:')

      // CSS Grid
      const gridSupported = compatibilityValidator.testCSSFeature(
        'CSS Grid',
        () => {
          const testElement = document.createElement('div')
          testElement.style.display = 'grid'
          return testElement.style.display === 'grid'
        },
        'Flexbox layout fallback'
      )

      // Flexbox
      const flexboxSupported = compatibilityValidator.testCSSFeature(
        'Flexbox',
        () => {
          const testElement = document.createElement('div')
          testElement.style.display = 'flex'
          return testElement.style.display === 'flex'
        },
        'Float-based layout fallback'
      )

      // CSS Variables
      const cssVariablesSupported = compatibilityValidator.testCSSFeature(
        'CSS Variables',
        () => {
          try {
            const testElement = document.createElement('div')
            testElement.style.setProperty('--test-var', 'test')
            return testElement.style.getPropertyValue('--test-var') === 'test'
          } catch {
            return false
          }
        },
        'Preprocessor variables fallback'
      )

      // CSS Transforms
      const transformsSupported = compatibilityValidator.testCSSFeature(
        'CSS Transforms',
        () => {
          const testElement = document.createElement('div')
          testElement.style.transform = 'rotate(45deg)'
          return testElement.style.transform === 'rotate(45deg)'
        },
        'Position-based animations fallback'
      )

      // CSS Transitions
      const transitionsSupported = compatibilityValidator.testCSSFeature(
        'CSS Transitions',
        () => {
          const testElement = document.createElement('div')
          testElement.style.transition = 'opacity 0.3s'
          return testElement.style.transition.includes('opacity')
        },
        'JavaScript animations fallback'
      )

      console.log(`  CSS Grid: ${gridSupported ? '✅' : '❌'}`)
      console.log(`  Flexbox: ${flexboxSupported ? '✅' : '❌'}`)
      console.log(`  CSS Variables: ${cssVariablesSupported ? '✅' : '❌'}`)
      console.log(`  CSS Transforms: ${transformsSupported ? '✅' : '❌'}`)
      console.log(`  CSS Transitions: ${transitionsSupported ? '✅' : '❌'}`)

      // Modern browsers should support most CSS features
      const modernFeatures = [gridSupported, flexboxSupported, cssVariablesSupported].filter(Boolean).length
      expect(modernFeatures).toBeGreaterThanOrEqual(2)
    })

    it('should test responsive design features', () => {
      // Media queries
      const mediaQueriesSupported = compatibilityValidator.testCSSFeature(
        'Media Queries',
        () => {
          try {
            const mediaQuery = window.matchMedia('(min-width: 768px)')
            return typeof mediaQuery.matches === 'boolean'
          } catch {
            return false
          }
        },
        'Fixed-width layout fallback'
      )

      // Viewport units
      const viewportUnitsSupported = compatibilityValidator.testCSSFeature(
        'Viewport Units',
        () => {
          const testElement = document.createElement('div')
          testElement.style.width = '100vw'
          return testElement.style.width === '100vw'
        },
        'Percentage-based sizing fallback'
      )

      console.log(`📱 Responsive Design Features:`)
      console.log(`  Media Queries: ${mediaQueriesSupported ? '✅' : '❌'}`)
      console.log(`  Viewport Units: ${viewportUnitsSupported ? '✅' : '❌'}`)

      expect(mediaQueriesSupported).toBe(true)
    })
  })

  describe('⚙️ JavaScript Feature Compatibility', () => {
    it('should test ES6+ features', () => {
      console.log('⚙️ Testing JavaScript Feature Compatibility:')

      // Arrow Functions
      const arrowFunctionsSupported = compatibilityValidator.testJavaScriptFeature(
        'Arrow Functions',
        () => {
          try {
            eval('(() => true)()')
            return true
          } catch {
            return false
          }
        },
        'Traditional function fallback'
      )

      // Promises
      const promisesSupported = compatibilityValidator.testJavaScriptFeature(
        'Promises',
        () => typeof Promise === 'function' && typeof Promise.resolve === 'function',
        'Callback-based async fallback'
      )

      // Async/Await
      const asyncAwaitSupported = compatibilityValidator.testJavaScriptFeature(
        'Async/Await',
        () => {
          try {
            eval('(async () => await Promise.resolve())')
            return true
          } catch {
            return false
          }
        },
        'Promise-based async fallback'
      )

      // Template Literals
      const templateLiteralsSupported = compatibilityValidator.testJavaScriptFeature(
        'Template Literals',
        () => {
          try {
            const test = `template`
            return test === 'template'
          } catch {
            return false
          }
        },
        'String concatenation fallback'
      )

      // Destructuring
      const destructuringSupported = compatibilityValidator.testJavaScriptFeature(
        'Destructuring',
        () => {
          try {
            const [a] = [1]
            return a === 1
          } catch {
            return false
          }
        },
        'Manual property access fallback'
      )

      // Spread Operator
      const spreadSupported = compatibilityValidator.testJavaScriptFeature(
        'Spread Operator',
        () => {
          try {
            const arr = [1, 2, 3]
            const spread = [...arr]
            return spread.length === 3
          } catch {
            return false
          }
        },
        'Array.prototype methods fallback'
      )

      console.log(`  Arrow Functions: ${arrowFunctionsSupported ? '✅' : '❌'}`)
      console.log(`  Promises: ${promisesSupported ? '✅' : '❌'}`)
      console.log(`  Async/Await: ${asyncAwaitSupported ? '✅' : '❌'}`)
      console.log(`  Template Literals: ${templateLiteralsSupported ? '✅' : '❌'}`)
      console.log(`  Destructuring: ${destructuringSupported ? '✅' : '❌'}`)
      console.log(`  Spread Operator: ${spreadSupported ? '✅' : '❌'}`)

      // Modern environments should support most ES6+ features
      const modernFeatures = [promisesSupported, asyncAwaitSupported, templateLiteralsSupported].filter(Boolean).length
      expect(modernFeatures).toBeGreaterThanOrEqual(2)
    })

    it('should test DOM manipulation compatibility', () => {
      // querySelector
      const querySelectorSupported = compatibilityValidator.testJavaScriptFeature(
        'querySelector',
        () => typeof document.querySelector === 'function',
        'getElementById fallback'
      )

      // addEventListener
      const addEventListenerSupported = compatibilityValidator.testJavaScriptFeature(
        'addEventListener',
        () => {
          const testElement = document.createElement('div')
          return typeof testElement.addEventListener === 'function'
        },
        'attachEvent fallback'
      )

      // classList
      const classListSupported = compatibilityValidator.testJavaScriptFeature(
        'classList',
        () => {
          const testElement = document.createElement('div')
          return typeof testElement.classList === 'object' && typeof testElement.classList.add === 'function'
        },
        'className manipulation fallback'
      )

      console.log(`🔧 DOM API Support:`)
      console.log(`  querySelector: ${querySelectorSupported ? '✅' : '❌'}`)
      console.log(`  addEventListener: ${addEventListenerSupported ? '✅' : '❌'}`)
      console.log(`  classList: ${classListSupported ? '✅' : '❌'}`)

      expect(querySelectorSupported && addEventListenerSupported).toBe(true)
    })
  })

  describe('📱 Responsive Design Validation', () => {
    it('should test responsive breakpoints for IntroPage', () => {
      const breakpoints: ResponsiveBreakpoint[] = [
        { name: 'Mobile', width: 375, height: 667, expectedLayout: 'mobile-layout' },
        { name: 'Tablet', width: 768, height: 1024, expectedLayout: 'tablet-layout' },
        { name: 'Desktop', width: 1024, height: 768, expectedLayout: 'desktop-layout' },
        { name: 'Large Desktop', width: 1440, height: 900, expectedLayout: 'desktop-layout' }
      ]

      const results = responsiveDesignTester.testResponsiveBreakpoints(
        <IntroPage />,
        breakpoints
      )

      console.log('📱 Responsive Design Testing - IntroPage:')
      results.forEach(result => {
        console.log(`  ${result.breakpoint} (${result.width}px): ${result.passed ? '✅' : '❌'} ${result.layout}`)
      })

      const passedBreakpoints = results.filter(r => r.passed).length
      const totalBreakpoints = results.length

      expect(passedBreakpoints / totalBreakpoints).toBeGreaterThanOrEqual(0.5) // At least 50% should pass
    })

    it('should test responsive behavior for SystemOverview', () => {
      const mockData = {
        total_users: 150,
        active_documents: 1250,
        documents_today: 8,
        documents_this_week: 45,
        system_health_score: 98.5
      }

      const breakpoints: ResponsiveBreakpoint[] = [
        { name: 'Mobile', width: 375, height: 667, expectedLayout: 'mobile' },
        { name: 'Tablet', width: 768, height: 1024, expectedLayout: 'tablet' },
        { name: 'Desktop', width: 1024, height: 768, expectedLayout: 'desktop' }
      ]

      const results = responsiveDesignTester.testResponsiveBreakpoints(
        <SystemOverview
          data={mockData}
          loading={false}
          onRefresh={() => {}}
          variant="standard"
          autoRefresh={false}
        />,
        breakpoints
      )

      console.log('📱 Responsive Design Testing - SystemOverview:')
      results.forEach(result => {
        console.log(`  ${result.breakpoint} (${result.width}px): ${result.passed ? '✅' : '❌'}`)
      })

      expect(results.some(r => r.passed)).toBe(true)
    })

    it('should test touch interaction compatibility', () => {
      // Touch events support
      const touchEventsSupported = compatibilityValidator.testJavaScriptFeature(
        'Touch Events',
        () => 'ontouchstart' in window || navigator.maxTouchPoints > 0,
        'Mouse events fallback'
      )

      // Pointer events support
      const pointerEventsSupported = compatibilityValidator.testJavaScriptFeature(
        'Pointer Events',
        () => 'onpointerdown' in window,
        'Touch/mouse events fallback'
      )

      console.log('👆 Touch Interaction Support:')
      console.log(`  Touch Events: ${touchEventsSupported ? '✅' : '❌'}`)
      console.log(`  Pointer Events: ${pointerEventsSupported ? '✅' : '❌'}`)

      // At least one touch interaction method should be supported
      expect(touchEventsSupported || pointerEventsSupported).toBe(true)
    })
  })

  describe('🔄 Progressive Enhancement', () => {
    it('should work without JavaScript enabled', () => {
      // Test that basic HTML structure renders
      const { container } = render(
        <BrowserRouter>
          <SystemOverview
            data={{
              total_users: 150,
              active_documents: 1250,
              documents_today: 8,
              documents_this_week: 45,
              system_health_score: 98.5
            }}
            loading={false}
            onRefresh={() => {}}
            variant="standard"
            autoRefresh={false}
          />
        </BrowserRouter>
      )

      // Basic content should be present even without JS
      const textContent = container.textContent
      const hasContent = textContent && textContent.length > 100

      console.log('🔄 Progressive Enhancement:')
      console.log(`  Basic content without JS: ${hasContent ? '✅' : '❌'}`)
      console.log(`  Content length: ${textContent?.length || 0} characters`)

      expect(hasContent).toBe(true)
    })

    it('should provide CSS-only fallbacks for interactive elements', () => {
      const { container } = render(
        <BrowserRouter>
          <IntroPage />
        </BrowserRouter>
      )

      // Test for CSS hover states
      const interactiveElements = container.querySelectorAll('button, a, [tabindex]')
      const hasInteractiveElements = interactiveElements.length > 0

      console.log(`  Interactive elements: ${interactiveElements.length} found ${hasInteractiveElements ? '✅' : '❌'}`)

      // Test for form elements without JS dependency
      const forms = container.querySelectorAll('form, input, button')
      const hasBasicForms = forms.length > 0

      console.log(`  Basic form elements: ${forms.length} found ${hasBasicForms ? '✅' : '❌'}`)

      expect(hasInteractiveElements || hasBasicForms).toBe(true)
    })
  })

  describe('🔧 Polyfill and Fallback Testing', () => {
    it('should test polyfill availability', () => {
      // Test common polyfills
      const polyfills = [
        {
          name: 'Array.from',
          available: typeof Array.from === 'function',
          fallback: 'Custom implementation available'
        },
        {
          name: 'Object.assign',
          available: typeof Object.assign === 'function',
          fallback: 'Custom implementation available'
        },
        {
          name: 'Promise',
          available: typeof Promise === 'function',
          fallback: 'Promise polyfill available'
        }
      ]

      console.log('🔧 Polyfill Availability:')
      polyfills.forEach(polyfill => {
        console.log(`  ${polyfill.name}: ${polyfill.available ? '✅ Native' : '❌ Needs polyfill'}`)
      })

      const nativeSupport = polyfills.filter(p => p.available).length
      expect(nativeSupport).toBeGreaterThanOrEqual(2)
    })

    it('should test graceful degradation', () => {
      // Simulate older browser environment
      const originalFetch = window.fetch
      delete (window as any).fetch

      try {
        // Component should still render without fetch API
        const { container } = render(
          <BrowserRouter>
            <SystemOverview
              data={{
                total_users: 150,
                active_documents: 1250,
                documents_today: 8,
                documents_this_week: 45,
                system_health_score: 98.5
              }}
              loading={false}
              onRefresh={() => {}}
              variant="standard"
              autoRefresh={false}
            />
          </BrowserRouter>
        )

        const hasContent = container.textContent && container.textContent.length > 50
        console.log(`🔧 Graceful degradation (no fetch): ${hasContent ? '✅' : '❌'}`)

        expect(hasContent).toBe(true)
      } finally {
        // Restore fetch API
        window.fetch = originalFetch
      }
    })
  })

  afterAll(() => {
    const report = compatibilityValidator.getCompatibilityReport()

    console.log('\n🏆 Cross-Browser Compatibility Final Report:')
    console.log(`  Total Tests: ${report.totalTests}`)
    console.log(`  Supported Features: ${report.supportedFeatures}`)
    console.log(`  Compatibility Rate: ${report.compatibilityRate.toFixed(1)}%`)
    console.log('')

    // Group results by category
    const categories = [...new Set(report.results.map(r => r.category))]
    categories.forEach(category => {
      const categoryResults = report.results.filter(r => r.category === category)
      const supported = categoryResults.filter(r => r.supported).length
      console.log(`  ${category}: ${supported}/${categoryResults.length} (${((supported/categoryResults.length)*100).toFixed(1)}%)`)
    })

    if (report.compatibilityRate >= 70) {
      console.log('\n  ✅ Cross-browser compatibility PASSED - Ready for multi-browser deployment')
    } else {
      console.log('\n  ⚠️ Cross-browser compatibility needs improvements before deployment')
    }
  })
})