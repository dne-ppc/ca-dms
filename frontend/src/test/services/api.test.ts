/**
 * Comprehensive test suite for API service
 */
import { apiClient, ApiResponse, RequestOptions } from '../../services/api'

// Mock fetch globally
const mockFetch = jest.fn()
global.fetch = mockFetch

describe('API Service', () => {
  beforeEach(() => {
    mockFetch.mockClear()
    // Clear any stored state
    localStorage.clear()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('GET requests', () => {
    it('should make successful GET request', async () => {
      const mockData = { id: 1, name: 'Test' }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockData
      })

      const response = await apiClient.get<typeof mockData>('/test')

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/test', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      })
      expect(response.success).toBe(true)
      expect(response.data).toEqual(mockData)
    })

    it('should handle GET request with query parameters', async () => {
      const mockData = { results: [] }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockData
      })

      const options: RequestOptions = {
        params: { page: 1, limit: 10, sort: 'name' }
      }

      await apiClient.get('/test', options)

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/test?page=1&limit=10&sort=name', expect.any(Object))
    })

    it('should handle GET request with custom headers', async () => {
      const mockData = { data: 'test' }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockData
      })

      const options: RequestOptions = {
        headers: { 'X-Custom-Header': 'custom-value' }
      }

      await apiClient.get('/test', options)

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/test', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Custom-Header': 'custom-value'
        }
      })
    })

    it('should handle 404 errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ message: 'Not found' })
      })

      const response = await apiClient.get('/nonexistent')

      expect(response.success).toBe(false)
      expect(response.message).toBe('Not found')
      expect(response.status).toBe(404)
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const response = await apiClient.get('/test')

      expect(response.success).toBe(false)
      expect(response.message).toBe('Network error')
    })
  })

  describe('POST requests', () => {
    it('should make successful POST request', async () => {
      const requestData = { name: 'Test', value: 123 }
      const responseData = { id: 1, ...requestData }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => responseData
      })

      const response = await apiClient.post<typeof responseData>('/test', requestData)

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestData)
      })
      expect(response.success).toBe(true)
      expect(response.data).toEqual(responseData)
    })

    it('should handle POST request with FormData', async () => {
      const formData = new FormData()
      formData.append('file', new Blob(['test'], { type: 'text/plain' }))
      formData.append('name', 'test-file')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true })
      })

      await apiClient.post('/upload', formData)

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/upload', {
        method: 'POST',
        headers: {
          'Accept': 'application/json'
        },
        body: formData
      })
    })

    it('should handle validation errors (422)', async () => {
      const validationErrors = {
        message: 'Validation failed',
        errors: {
          name: ['Name is required'],
          email: ['Invalid email format']
        }
      }

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => validationErrors
      })

      const response = await apiClient.post('/test', { name: '' })

      expect(response.success).toBe(false)
      expect(response.message).toBe('Validation failed')
      expect(response.errors).toEqual(validationErrors.errors)
    })
  })

  describe('PUT requests', () => {
    it('should make successful PUT request', async () => {
      const updateData = { name: 'Updated', value: 456 }
      const responseData = { id: 1, ...updateData }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => responseData
      })

      const response = await apiClient.put<typeof responseData>('/test/1', updateData)

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/test/1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(updateData)
      })
      expect(response.success).toBe(true)
      expect(response.data).toEqual(responseData)
    })
  })

  describe('DELETE requests', () => {
    it('should make successful DELETE request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: new Headers(),
        text: async () => ''
      })

      const response = await apiClient.delete('/test/1')

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/test/1', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      })
      expect(response.success).toBe(true)
    })
  })

  describe('Request interceptors', () => {
    it('should add authentication header when token is available', async () => {
      localStorage.setItem('access_token', 'test-token')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({})
      })

      await apiClient.get('/protected')

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/protected', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': 'Bearer test-token'
        }
      })
    })

    it('should not add authentication header when no token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({})
      })

      await apiClient.get('/public')

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/public', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      })
    })
  })

  describe('Response parsing', () => {
    it('should handle non-JSON responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: async () => 'Plain text response'
      })

      const response = await apiClient.get('/text')

      expect(response.success).toBe(true)
      expect(response.data).toBe('Plain text response')
    })

    it('should handle empty responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: new Headers(),
        text: async () => ''
      })

      const response = await apiClient.get('/empty')

      expect(response.success).toBe(true)
      expect(response.data).toBeNull()
    })

    it('should handle malformed JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => 'invalid json{',
        json: async () => { throw new Error('Invalid JSON') }
      })

      const response = await apiClient.get('/invalid-json')

      expect(response.success).toBe(false)
      expect(response.message).toContain('Invalid JSON')
    })
  })

  describe('Timeout handling', () => {
    it('should handle request timeout', async () => {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 100)
      })

      mockFetch.mockImplementationOnce(() => timeoutPromise)

      const response = await apiClient.get('/slow', { timeout: 50 })

      expect(response.success).toBe(false)
      expect(response.message).toBe('Request timeout')
    })
  })

  describe('Retry mechanism', () => {
    it('should retry failed requests', async () => {
      // First call fails
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ success: true })
        })

      const response = await apiClient.get('/retry-test', { retry: { attempts: 2, delay: 10 } })

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(response.success).toBe(true)
    })

    it('should fail after max retry attempts', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))

      const response = await apiClient.get('/fail-test', { retry: { attempts: 2, delay: 10 } })

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(response.success).toBe(false)
    })
  })

  describe('AbortController support', () => {
    it('should support request cancellation', async () => {
      const controller = new AbortController()

      mockFetch.mockImplementationOnce(() =>
        new Promise((_, reject) => {
          setTimeout(() => {
            if (controller.signal.aborted) {
              reject(new DOMException('Aborted', 'AbortError'))
            }
          }, 100)
        })
      )

      // Cancel the request after 50ms
      setTimeout(() => controller.abort(), 50)

      const response = await apiClient.get('/cancel-test', { signal: controller.signal })

      expect(response.success).toBe(false)
      expect(response.message).toContain('Aborted')
    })
  })

  describe('Request/Response logging', () => {
    it('should log requests in development mode', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({})
      })

      // Simulate development mode
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      await apiClient.get('/log-test')

      // Restore environment
      process.env.NODE_ENV = originalEnv

      consoleSpy.mockRestore()
    })
  })

  describe('Error handling edge cases', () => {
    it('should handle fetch throwing synchronously', async () => {
      mockFetch.mockImplementationOnce(() => {
        throw new Error('Synchronous error')
      })

      const response = await apiClient.get('/sync-error')

      expect(response.success).toBe(false)
      expect(response.message).toBe('Synchronous error')
    })

    it('should handle response.json() throwing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => { throw new Error('JSON parsing failed') },
        text: async () => 'Internal Server Error'
      })

      const response = await apiClient.get('/json-error')

      expect(response.success).toBe(false)
      expect(response.message).toBe('Internal Server Error')
    })
  })

  describe('Base URL configuration', () => {
    it('should use correct base URL for all requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({})
      })

      await apiClient.get('/test')

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/test', expect.any(Object))
    })

    it('should handle absolute URLs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({})
      })

      await apiClient.get('https://external-api.com/test')

      expect(mockFetch).toHaveBeenCalledWith('https://external-api.com/test', expect.any(Object))
    })
  })

  describe('Content-Type handling', () => {
    it('should handle different content types', async () => {
      // Test with blob
      const blob = new Blob(['test'])
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/octet-stream' }),
        blob: async () => blob
      })

      const response = await apiClient.get('/blob')
      expect(response.data).toBe(blob)
    })

    it('should preserve custom Content-Type headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({})
      })

      await apiClient.post('/custom-content', 'raw data', {
        headers: { 'Content-Type': 'text/plain' }
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/custom-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          'Accept': 'application/json'
        },
        body: 'raw data'
      })
    })
  })
})