/**
 * Test setup utilities for consistent mock configuration
 * Provides easy setup for different testing scenarios
 */
import { beforeEach, afterEach, vi } from 'vitest'
import MockServiceProvider from './mockServiceProvider'
import { setupBrowserMocks } from '../utils/hookTestUtils'

// Global mock service provider instance
let mockServices: MockServiceProvider

// Test setup configurations
export interface TestConfig {
  authenticated?: boolean
  withDocuments?: number
  withTemplates?: number
  withNotifications?: number
  networkDelay?: number
  simulateErrors?: boolean
  enableBrowserMocks?: boolean
}

// Default test configuration
const defaultConfig: TestConfig = {
  authenticated: true,
  withDocuments: 3,
  withTemplates: 2,
  withNotifications: 5,
  networkDelay: 0,
  simulateErrors: false,
  enableBrowserMocks: true
}

/**
 * Setup comprehensive test environment with mocks
 */
export const setupTestEnvironment = (config: TestConfig = {}) => {
  const finalConfig = { ...defaultConfig, ...config }

  beforeEach(() => {
    // Initialize mock services
    mockServices = new MockServiceProvider()

    // Setup browser mocks if enabled
    if (finalConfig.enableBrowserMocks) {
      setupBrowserMocks()
    }

    // Setup authenticated user if requested
    if (finalConfig.authenticated) {
      mockServices.setupAuthenticatedUser({
        email: 'test@example.com',
        name: 'Test User',
        role: 'user'
      })
    }

    // Setup mock data
    if (finalConfig.withDocuments && finalConfig.withDocuments > 0) {
      mockServices.setupDocuments(finalConfig.withDocuments)
    }

    if (finalConfig.withTemplates && finalConfig.withTemplates > 0) {
      mockServices.setupTemplates(finalConfig.withTemplates)
    }

    if (finalConfig.withNotifications && finalConfig.withNotifications > 0) {
      mockServices.setupNotifications(finalConfig.withNotifications)
    }

    // Setup network simulation
    if (finalConfig.networkDelay && finalConfig.networkDelay > 0) {
      simulateNetworkDelay(finalConfig.networkDelay)
    }

    if (finalConfig.simulateErrors) {
      simulateRandomErrors()
    }

    // Mock global dependencies
    mockGlobalDependencies()
  })

  afterEach(() => {
    if (mockServices) {
      mockServices.reset()
    }
    vi.clearAllMocks()
    vi.restoreAllMocks()
    localStorage.clear()
    sessionStorage.clear()
  })

  return {
    getMockServices: () => mockServices,
    updateConfig: (newConfig: Partial<TestConfig>) => {
      Object.assign(finalConfig, newConfig)
    }
  }
}

/**
 * Setup for authentication-focused tests
 */
export const setupAuthTests = () => {
  return setupTestEnvironment({
    authenticated: false,
    withDocuments: 0,
    withTemplates: 0,
    withNotifications: 0
  })
}

/**
 * Setup for document management tests
 */
export const setupDocumentTests = () => {
  return setupTestEnvironment({
    authenticated: true,
    withDocuments: 5,
    withTemplates: 3,
    withNotifications: 2
  })
}

/**
 * Setup for template management tests
 */
export const setupTemplateTests = () => {
  return setupTestEnvironment({
    authenticated: true,
    withDocuments: 1,
    withTemplates: 10,
    withNotifications: 1
  })
}

/**
 * Setup for notification tests
 */
export const setupNotificationTests = () => {
  return setupTestEnvironment({
    authenticated: true,
    withDocuments: 0,
    withTemplates: 0,
    withNotifications: 15
  })
}

/**
 * Setup for performance tests
 */
export const setupPerformanceTests = () => {
  return setupTestEnvironment({
    authenticated: true,
    withDocuments: 50,
    withTemplates: 20,
    withNotifications: 100,
    networkDelay: 100
  })
}

/**
 * Setup for error handling tests
 */
export const setupErrorTests = () => {
  return setupTestEnvironment({
    authenticated: true,
    withDocuments: 3,
    withTemplates: 2,
    withNotifications: 5,
    simulateErrors: true
  })
}

/**
 * Setup for offline/PWA tests
 */
export const setupPWATests = () => {
  const setup = setupTestEnvironment({
    authenticated: true,
    withDocuments: 2,
    withTemplates: 1,
    withNotifications: 3
  })

  beforeEach(() => {
    // Setup PWA-specific mocks
    mockServices.pwaService._setInstallable(true)
    mockServices.pwaService._setDeferredPrompt({
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'accepted' })
    })

    // Mock offline/online events
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    })
  })

  return setup
}

// Helper functions

/**
 * Simulate network delay for all service calls
 */
const simulateNetworkDelay = (delay: number) => {
  const services = ['apiClient', 'documentService', 'authService', 'notificationService', 'templateService']
  const methods = ['get', 'post', 'put', 'delete', 'createDocument', 'updateDocument', 'login', 'getNotifications']

  services.forEach(service => {
    methods.forEach(method => {
      try {
        mockServices.simulateSlowResponse(service as any, method, delay)
      } catch {
        // Ignore if service/method doesn't exist
      }
    })
  })
}

/**
 * Simulate random network errors
 */
const simulateRandomErrors = () => {
  const errorScenarios = [
    { service: 'apiClient', method: 'post', error: new Error('Network timeout') },
    { service: 'documentService', method: 'createDocument', error: new Error('Validation failed') },
    { service: 'authService', method: 'login', error: new Error('Invalid credentials') },
    { service: 'templateService', method: 'updateTemplate', error: new Error('Permission denied') }
  ]

  // Randomly apply one error scenario
  const scenario = errorScenarios[Math.floor(Math.random() * errorScenarios.length)]
  try {
    mockServices.simulateNetworkError(scenario.service as any, scenario.method)
  } catch {
    // Ignore if service/method doesn't exist
  }
}

/**
 * Mock global dependencies and APIs
 */
const mockGlobalDependencies = () => {
  // Mock fetch globally
  global.fetch = mockServices.apiClient.get as any

  // Mock React Router hooks
  vi.mock('react-router-dom', () => ({
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/test' }),
    useParams: () => ({}),
    BrowserRouter: ({ children }: any) => children,
    Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
    NavLink: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>
  }))

  // Mock Zustand stores
  vi.mock('../../stores/documentStore', () => ({
    useDocumentStore: () => ({
      documents: mockServices.documentService._getMockDocuments(),
      currentDocument: null,
      createDocument: mockServices.documentService.createDocument,
      updateDocument: mockServices.documentService.updateDocument,
      deleteDocument: mockServices.documentService.deleteDocument,
      setCurrentDocument: vi.fn(),
      isLoading: false,
      error: null
    })
  }))

  // Mock API services
  vi.mock('../../services/api', () => ({
    apiClient: mockServices.apiClient
  }))

  vi.mock('../../services/authService', () => ({
    authService: mockServices.authService
  }))

  vi.mock('../../services/documentService', () => ({
    documentService: mockServices.documentService
  }))

  // Mock UI libraries
  vi.mock('@/hooks/use-toast', () => ({
    useToast: () => ({
      toast: vi.fn()
    })
  }))

  // Mock Quill editor
  vi.mock('quill', () => ({
    default: vi.fn().mockImplementation(() => ({
      getContents: vi.fn(() => ({ ops: [] })),
      setContents: vi.fn(),
      setText: vi.fn(),
      insertEmbed: vi.fn(),
      insertText: vi.fn(),
      setSelection: vi.fn(),
      getSelection: vi.fn(() => ({ index: 0, length: 0 })),
      on: vi.fn(),
      off: vi.fn(),
      history: {
        undo: vi.fn(),
        redo: vi.fn()
      }
    }))
  }))
}

/**
 * Create a test user with specific permissions
 */
export const createTestUser = (role: string = 'user', permissions: string[] = []) => {
  return mockServices.authService._setCurrentUser({
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    role,
    permissions,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })
}

/**
 * Setup specific API response scenarios
 */
export const setupApiScenario = (scenario: 'success' | 'error' | 'timeout' | 'unauthorized') => {
  const services = mockServices

  switch (scenario) {
    case 'success':
      // All services return successful responses (default)
      break

    case 'error':
      services.apiClient.get.mockRejectedValue(new Error('Server error'))
      services.apiClient.post.mockRejectedValue(new Error('Server error'))
      services.apiClient.put.mockRejectedValue(new Error('Server error'))
      services.apiClient.delete.mockRejectedValue(new Error('Server error'))
      break

    case 'timeout':
      const timeoutError = new Error('Request timeout')
      services.apiClient.get.mockRejectedValue(timeoutError)
      services.apiClient.post.mockRejectedValue(timeoutError)
      services.apiClient.put.mockRejectedValue(timeoutError)
      services.apiClient.delete.mockRejectedValue(timeoutError)
      break

    case 'unauthorized':
      const unauthorizedError = new Error('Unauthorized')
      services.apiClient.get.mockResolvedValue({
        success: false,
        status: 401,
        message: 'Unauthorized'
      })
      services.apiClient.post.mockResolvedValue({
        success: false,
        status: 401,
        message: 'Unauthorized'
      })
      break
  }
}

/**
 * Verify that specific service interactions occurred
 */
export const verifyServiceInteractions = (interactions: Array<{
  service: keyof MockServiceProvider
  method: string
  args?: any[]
  callCount?: number
}>) => {
  interactions.forEach(({ service, method, args, callCount }) => {
    if (args) {
      mockServices.verifyServiceCall(service, method, ...args)
    }
    if (callCount !== undefined) {
      const actualCount = mockServices.getServiceCallCount(service, method)
      expect(actualCount).toBe(callCount)
    }
  })
}

/**
 * Wait for all pending promises to resolve
 */
export const flushPromises = () => {
  return new Promise(resolve => setTimeout(resolve, 0))
}

/**
 * Create a mock file for upload testing
 */
export const createMockFile = (name: string = 'test.txt', type: string = 'text/plain', content: string = 'test content') => {
  return new File([content], name, { type })
}

/**
 * Setup for testing drag and drop functionality
 */
export const setupDragDropTests = () => {
  const setup = setupTestEnvironment()

  beforeEach(() => {
    // Mock DataTransfer
    global.DataTransfer = vi.fn().mockImplementation(() => ({
      files: [],
      items: [],
      types: [],
      setData: vi.fn(),
      getData: vi.fn(),
      clearData: vi.fn(),
      setDragImage: vi.fn()
    })) as any

    // Mock FileList
    global.FileList = vi.fn().mockImplementation(() => []) as any
  })

  return setup
}

// Export commonly used mocks
export { MockServiceProvider }
export type { TestConfig }