/**
 * Comprehensive mock service provider for frontend testing
 * Provides consistent mock implementations for all services
 */
import { vi } from 'vitest'
import type { Document } from '../../types'
import type { DeltaOperation } from 'quill'

// Mock data generators
export const generateMockDocument = (overrides: Partial<Document> = {}): Document => ({
  id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  title: 'Mock Document',
  content: JSON.stringify([{ insert: 'Mock content\n' }]),
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1,
  status: 'draft',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  author_id: 'mock-user-1',
  ...overrides
})

export const generateMockTemplate = (overrides: any = {}) => ({
  id: `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  name: 'Mock Template',
  description: 'A mock template for testing',
  category: 'governance',
  status: 'published',
  version: 1,
  usage_count: 0,
  created_by: 'mock-user-1',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  tags: ['mock', 'test'],
  content: JSON.stringify([{ insert: 'Template content\n' }]),
  ...overrides
})

export const generateMockNotification = (overrides: any = {}) => ({
  id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  title: 'Mock Notification',
  message: 'This is a mock notification',
  type: 'info',
  read: false,
  created_at: new Date().toISOString(),
  document_id: null,
  ...overrides
})

export const generateMockUser = (overrides: any = {}) => ({
  id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  email: 'mock@example.com',
  name: 'Mock User',
  role: 'user',
  active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides
})

// Mock API client
export const createMockApiClient = () => {
  const mockApiClient = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }

  // Default successful responses
  mockApiClient.get.mockResolvedValue({
    success: true,
    data: {},
    status: 200
  })

  mockApiClient.post.mockResolvedValue({
    success: true,
    data: { id: 'new-id' },
    status: 201
  })

  mockApiClient.put.mockResolvedValue({
    success: true,
    data: {},
    status: 200
  })

  mockApiClient.delete.mockResolvedValue({
    success: true,
    data: {},
    status: 204
  })

  return mockApiClient
}

// Mock document service
export const createMockDocumentService = () => {
  const mockDocuments: Document[] = []

  return {
    createDocument: vi.fn().mockImplementation(async (data: any) => {
      const doc = generateMockDocument(data)
      mockDocuments.push(doc)
      return doc
    }),

    getDocument: vi.fn().mockImplementation(async (id: string) => {
      return mockDocuments.find(doc => doc.id === id) || null
    }),

    updateDocument: vi.fn().mockImplementation(async (id: string, updates: Partial<Document>) => {
      const index = mockDocuments.findIndex(doc => doc.id === id)
      if (index >= 0) {
        mockDocuments[index] = { ...mockDocuments[index], ...updates, updatedAt: new Date() }
        return mockDocuments[index]
      }
      throw new Error('Document not found')
    }),

    deleteDocument: vi.fn().mockImplementation(async (id: string) => {
      const index = mockDocuments.findIndex(doc => doc.id === id)
      if (index >= 0) {
        mockDocuments.splice(index, 1)
        return true
      }
      throw new Error('Document not found')
    }),

    searchDocuments: vi.fn().mockImplementation(async (query: any) => {
      let filtered = mockDocuments

      if (query.title) {
        filtered = filtered.filter(doc =>
          doc.title.toLowerCase().includes(query.title.toLowerCase())
        )
      }

      if (query.status) {
        filtered = filtered.filter(doc => doc.status === query.status)
      }

      return {
        documents: filtered,
        total: filtered.length,
        page: query.page || 1,
        limit: query.limit || 10
      }
    }),

    getDocumentVersions: vi.fn().mockResolvedValue([]),

    exportToPDF: vi.fn().mockResolvedValue({
      url: 'mock-pdf-url',
      filename: 'mock-document.pdf'
    }),

    // Add some initial mock documents
    _addMockDocument: (doc: Document) => mockDocuments.push(doc),
    _clearMockDocuments: () => mockDocuments.splice(0),
    _getMockDocuments: () => [...mockDocuments]
  }
}

// Mock authentication service
export const createMockAuthService = () => {
  let currentUser: any = null
  let isAuthenticated = false

  return {
    login: vi.fn().mockImplementation(async (email: string, password: string) => {
      if (email === 'test@example.com' && password === 'password') {
        currentUser = generateMockUser({ email })
        isAuthenticated = true
        localStorage.setItem('access_token', 'mock-jwt-token')
        localStorage.setItem('refresh_token', 'mock-refresh-token')
        return { user: currentUser, token: 'mock-jwt-token' }
      }
      throw new Error('Invalid credentials')
    }),

    logout: vi.fn().mockImplementation(async () => {
      currentUser = null
      isAuthenticated = false
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
    }),

    register: vi.fn().mockImplementation(async (userData: any) => {
      currentUser = generateMockUser(userData)
      isAuthenticated = true
      return { user: currentUser, token: 'mock-jwt-token' }
    }),

    getCurrentUser: vi.fn().mockImplementation(() => currentUser),

    isAuthenticated: vi.fn().mockImplementation(() => isAuthenticated),

    refreshToken: vi.fn().mockImplementation(async () => {
      if (localStorage.getItem('refresh_token')) {
        localStorage.setItem('access_token', 'new-mock-jwt-token')
        return 'new-mock-jwt-token'
      }
      throw new Error('No refresh token')
    }),

    resetPassword: vi.fn().mockResolvedValue(true),

    changePassword: vi.fn().mockResolvedValue(true),

    // Test utilities
    _setCurrentUser: (user: any) => {
      currentUser = user
      isAuthenticated = !!user
    },
    _setAuthenticated: (auth: boolean) => {
      isAuthenticated = auth
    }
  }
}

// Mock notification service
export const createMockNotificationService = () => {
  const mockNotifications: any[] = []

  return {
    getNotifications: vi.fn().mockImplementation(async (params: any = {}) => {
      let filtered = mockNotifications

      if (params.read !== undefined) {
        filtered = filtered.filter(n => n.read === params.read)
      }

      if (params.type) {
        filtered = filtered.filter(n => n.type === params.type)
      }

      return {
        notifications: filtered,
        total: filtered.length
      }
    }),

    markAsRead: vi.fn().mockImplementation(async (id: string) => {
      const notification = mockNotifications.find(n => n.id === id)
      if (notification) {
        notification.read = true
        return notification
      }
      throw new Error('Notification not found')
    }),

    markAllAsRead: vi.fn().mockImplementation(async () => {
      mockNotifications.forEach(n => { n.read = true })
      return mockNotifications.length
    }),

    deleteNotification: vi.fn().mockImplementation(async (id: string) => {
      const index = mockNotifications.findIndex(n => n.id === id)
      if (index >= 0) {
        mockNotifications.splice(index, 1)
        return true
      }
      throw new Error('Notification not found')
    }),

    getPreferences: vi.fn().mockResolvedValue({
      email_notifications: true,
      push_notifications: false,
      document_approved: true,
      document_rejected: true,
      review_required: true,
      system_updates: false
    }),

    updatePreferences: vi.fn().mockResolvedValue(true),

    sendTestNotification: vi.fn().mockResolvedValue(true),

    getStats: vi.fn().mockResolvedValue({
      total_notifications: mockNotifications.length,
      unread_notifications: mockNotifications.filter(n => !n.read).length,
      pending_notifications: 0,
      sent_notifications: mockNotifications.length,
      failed_notifications: 0,
      delivery_rate: 100
    }),

    // Test utilities
    _addMockNotification: (notification: any) => mockNotifications.push(notification),
    _clearMockNotifications: () => mockNotifications.splice(0),
    _getMockNotifications: () => [...mockNotifications]
  }
}

// Mock template service
export const createMockTemplateService = () => {
  const mockTemplates: any[] = []

  return {
    getTemplates: vi.fn().mockImplementation(async (params: any = {}) => {
      let filtered = mockTemplates

      if (params.category) {
        filtered = filtered.filter(t => t.category === params.category)
      }

      if (params.status) {
        filtered = filtered.filter(t => t.status === params.status)
      }

      if (params.query) {
        filtered = filtered.filter(t =>
          t.name.toLowerCase().includes(params.query.toLowerCase()) ||
          t.description.toLowerCase().includes(params.query.toLowerCase())
        )
      }

      // Sort
      if (params.sort_by) {
        filtered.sort((a, b) => {
          const order = params.sort_order === 'desc' ? -1 : 1
          return a[params.sort_by] > b[params.sort_by] ? order : -order
        })
      }

      return {
        templates: filtered,
        total: filtered.length,
        page: params.page || 1,
        limit: params.limit || 10
      }
    }),

    getTemplate: vi.fn().mockImplementation(async (id: string) => {
      return mockTemplates.find(t => t.id === id) || null
    }),

    createTemplate: vi.fn().mockImplementation(async (data: any) => {
      const template = generateMockTemplate(data)
      mockTemplates.push(template)
      return template
    }),

    updateTemplate: vi.fn().mockImplementation(async (id: string, updates: any) => {
      const index = mockTemplates.findIndex(t => t.id === id)
      if (index >= 0) {
        mockTemplates[index] = {
          ...mockTemplates[index],
          ...updates,
          updated_at: new Date().toISOString()
        }
        return mockTemplates[index]
      }
      throw new Error('Template not found')
    }),

    deleteTemplate: vi.fn().mockImplementation(async (id: string) => {
      const index = mockTemplates.findIndex(t => t.id === id)
      if (index >= 0) {
        mockTemplates.splice(index, 1)
        return true
      }
      throw new Error('Template not found')
    }),

    publishTemplate: vi.fn().mockImplementation(async (id: string) => {
      const template = mockTemplates.find(t => t.id === id)
      if (template) {
        template.status = 'published'
        template.published_at = new Date().toISOString()
        return template
      }
      throw new Error('Template not found')
    }),

    createDocumentFromTemplate: vi.fn().mockImplementation(async (templateId: string, data: any) => {
      const template = mockTemplates.find(t => t.id === templateId)
      if (template) {
        return generateMockDocument({
          title: data.title || `Document from ${template.name}`,
          content: template.content
        })
      }
      throw new Error('Template not found')
    }),

    // Test utilities
    _addMockTemplate: (template: any) => mockTemplates.push(template),
    _clearMockTemplates: () => mockTemplates.splice(0),
    _getMockTemplates: () => [...mockTemplates]
  }
}

// Mock PWA service
export const createMockPWAService = () => {
  let isInstalled = false
  let isInstallable = true
  let deferredPrompt: any = null

  return {
    isInstalled: vi.fn().mockImplementation(() => isInstalled),

    isInstallable: vi.fn().mockImplementation(() => isInstallable),

    install: vi.fn().mockImplementation(async () => {
      if (deferredPrompt) {
        await deferredPrompt.prompt()
        const choiceResult = await deferredPrompt.userChoice
        if (choiceResult.outcome === 'accepted') {
          isInstalled = true
          isInstallable = false
        }
        deferredPrompt = null
        return choiceResult.outcome === 'accepted'
      }
      return false
    }),

    registerServiceWorker: vi.fn().mockResolvedValue(true),

    updateServiceWorker: vi.fn().mockResolvedValue(true),

    enableNotifications: vi.fn().mockImplementation(async () => {
      const permission = await Notification.requestPermission()
      return permission === 'granted'
    }),

    subscribeToNotifications: vi.fn().mockResolvedValue({
      endpoint: 'mock-endpoint',
      keys: { p256dh: 'mock-key', auth: 'mock-auth' }
    }),

    // Test utilities
    _setInstalled: (installed: boolean) => {
      isInstalled = installed
    },
    _setInstallable: (installable: boolean) => {
      isInstallable = installable
    },
    _setDeferredPrompt: (prompt: any) => {
      deferredPrompt = prompt
    }
  }
}

// Mock file service
export const createMockFileService = () => {
  const mockFiles: any[] = []

  return {
    uploadFile: vi.fn().mockImplementation(async (file: File, options: any = {}) => {
      const mockFile = {
        id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: file.name,
        size: file.size,
        type: file.type,
        url: `mock://files/${file.name}`,
        created_at: new Date().toISOString()
      }
      mockFiles.push(mockFile)
      return mockFile
    }),

    downloadFile: vi.fn().mockImplementation(async (id: string) => {
      const file = mockFiles.find(f => f.id === id)
      if (file) {
        return new Blob(['mock file content'], { type: file.type })
      }
      throw new Error('File not found')
    }),

    deleteFile: vi.fn().mockImplementation(async (id: string) => {
      const index = mockFiles.findIndex(f => f.id === id)
      if (index >= 0) {
        mockFiles.splice(index, 1)
        return true
      }
      throw new Error('File not found')
    }),

    getFiles: vi.fn().mockImplementation(async () => mockFiles),

    // Test utilities
    _addMockFile: (file: any) => mockFiles.push(file),
    _clearMockFiles: () => mockFiles.splice(0),
    _getMockFiles: () => [...mockFiles]
  }
}

// Mock search service
export const createMockSearchService = () => {
  return {
    searchDocuments: vi.fn().mockImplementation(async (query: string, filters: any = {}) => {
      // Mock search results
      return {
        results: [
          {
            id: 'doc-1',
            title: 'Search Result 1',
            content: 'Content containing the search term',
            score: 0.95,
            highlights: [`Content containing the <mark>${query}</mark> term`]
          }
        ],
        total: 1,
        query,
        filters
      }
    }),

    searchTemplates: vi.fn().mockImplementation(async (query: string, filters: any = {}) => {
      return {
        results: [
          {
            id: 'template-1',
            name: 'Template Result 1',
            description: 'Template description',
            score: 0.85
          }
        ],
        total: 1,
        query,
        filters
      }
    }),

    getSearchSuggestions: vi.fn().mockImplementation(async (query: string) => {
      return [
        `${query} suggestion 1`,
        `${query} suggestion 2`,
        `${query} suggestion 3`
      ]
    }),

    indexDocument: vi.fn().mockResolvedValue(true),

    reindexAll: vi.fn().mockResolvedValue(true)
  }
}

// Complete mock service provider
export class MockServiceProvider {
  public apiClient: ReturnType<typeof createMockApiClient>
  public documentService: ReturnType<typeof createMockDocumentService>
  public authService: ReturnType<typeof createMockAuthService>
  public notificationService: ReturnType<typeof createMockNotificationService>
  public templateService: ReturnType<typeof createMockTemplateService>
  public pwaService: ReturnType<typeof createMockPWAService>
  public fileService: ReturnType<typeof createMockFileService>
  public searchService: ReturnType<typeof createMockSearchService>

  constructor() {
    this.apiClient = createMockApiClient()
    this.documentService = createMockDocumentService()
    this.authService = createMockAuthService()
    this.notificationService = createMockNotificationService()
    this.templateService = createMockTemplateService()
    this.pwaService = createMockPWAService()
    this.fileService = createMockFileService()
    this.searchService = createMockSearchService()
  }

  // Setup common test scenarios
  setupAuthenticatedUser(userData?: any) {
    const user = generateMockUser(userData)
    this.authService._setCurrentUser(user)
    this.authService._setAuthenticated(true)
    localStorage.setItem('access_token', 'mock-jwt-token')
    return user
  }

  setupDocuments(count: number = 3, overrides?: Partial<Document>) {
    const documents = Array.from({ length: count }, (_, i) =>
      generateMockDocument({
        title: `Test Document ${i + 1}`,
        ...overrides
      })
    )
    documents.forEach(doc => this.documentService._addMockDocument(doc))
    return documents
  }

  setupTemplates(count: number = 3, overrides?: any) {
    const templates = Array.from({ length: count }, (_, i) =>
      generateMockTemplate({
        name: `Test Template ${i + 1}`,
        ...overrides
      })
    )
    templates.forEach(template => this.templateService._addMockTemplate(template))
    return templates
  }

  setupNotifications(count: number = 5, overrides?: any) {
    const notifications = Array.from({ length: count }, (_, i) =>
      generateMockNotification({
        title: `Test Notification ${i + 1}`,
        read: i % 2 === 0, // Mix of read/unread
        ...overrides
      })
    )
    notifications.forEach(notification => this.notificationService._addMockNotification(notification))
    return notifications
  }

  // Simulate network errors
  simulateNetworkError(service: keyof MockServiceProvider, method: string) {
    const serviceInstance = this[service] as any
    if (serviceInstance && serviceInstance[method]) {
      serviceInstance[method].mockRejectedValue(new Error('Network error'))
    }
  }

  // Simulate slow responses
  simulateSlowResponse(service: keyof MockServiceProvider, method: string, delay: number = 2000) {
    const serviceInstance = this[service] as any
    if (serviceInstance && serviceInstance[method]) {
      const originalImplementation = serviceInstance[method].getMockImplementation()
      serviceInstance[method].mockImplementation(async (...args: any[]) => {
        await new Promise(resolve => setTimeout(resolve, delay))
        return originalImplementation ? originalImplementation(...args) : undefined
      })
    }
  }

  // Reset all mocks
  reset() {
    Object.values(this).forEach(service => {
      if (service && typeof service === 'object') {
        Object.values(service).forEach(method => {
          if (method && typeof method.mockReset === 'function') {
            method.mockReset()
          }
        })
      }
    })

    // Clear mock data
    this.documentService._clearMockDocuments()
    this.templateService._clearMockTemplates()
    this.notificationService._clearMockNotifications()
    this.fileService._clearMockFiles()

    // Clear auth state
    this.authService._setCurrentUser(null)
    this.authService._setAuthenticated(false)
    localStorage.clear()
  }

  // Verify interactions
  verifyServiceCall(service: keyof MockServiceProvider, method: string, ...args: any[]) {
    const serviceInstance = this[service] as any
    if (serviceInstance && serviceInstance[method]) {
      return expect(serviceInstance[method]).toHaveBeenCalledWith(...args)
    }
    throw new Error(`Service ${service} or method ${method} not found`)
  }

  getServiceCallCount(service: keyof MockServiceProvider, method: string): number {
    const serviceInstance = this[service] as any
    if (serviceInstance && serviceInstance[method] && serviceInstance[method].mock) {
      return serviceInstance[method].mock.calls.length
    }
    return 0
  }
}

// Default export for easy importing
export default MockServiceProvider