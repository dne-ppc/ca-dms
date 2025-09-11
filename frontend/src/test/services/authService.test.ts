import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { authService } from '../../services/authService'
import { apiClient } from '../../services/api'

// Mock the API client
vi.mock('../../services/api')

// Mock localStorage
const mockLocalStorage = {
  store: {} as Record<string, string>,
  getItem: (key: string) => mockLocalStorage.store[key] || null,
  setItem: (key: string, value: string) => {
    mockLocalStorage.store[key] = value
  },
  removeItem: (key: string) => {
    delete mockLocalStorage.store[key]
  },
  clear: () => {
    mockLocalStorage.store = {}
  }
}

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
})

describe('Authentication Integration', () => {
  const mockApiClient = vi.mocked(apiClient)
  
  beforeEach(() => {
    vi.clearAllMocks()
    mockLocalStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.resetAllMocks()
    vi.useRealTimers()
  })

  describe('JWT Token Management', () => {
    const mockTokenData = {
      access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      refresh_token: 'refresh_token_example',
      expires_in: 3600,
      token_type: 'Bearer'
    }

    it('should store JWT token in localStorage after login', async () => {
      mockApiClient.post.mockResolvedValue({
        data: mockTokenData,
        success: true
      })

      await authService.login('test@example.com', 'password')

      expect(localStorage.getItem('access_token')).toBe(mockTokenData.access_token)
      expect(localStorage.getItem('refresh_token')).toBe(mockTokenData.refresh_token)
    })

    it('should retrieve stored token from localStorage', () => {
      localStorage.setItem('access_token', mockTokenData.access_token)
      
      const token = authService.getStoredToken()
      
      expect(token).toBe(mockTokenData.access_token)
    })

    it('should check if user is authenticated based on token presence', () => {
      expect(authService.isAuthenticated()).toBe(false)
      
      localStorage.setItem('access_token', mockTokenData.access_token)
      
      expect(authService.isAuthenticated()).toBe(true)
    })

    it('should parse JWT token payload correctly', () => {
      const payload = authService.parseTokenPayload(mockTokenData.access_token)
      
      expect(payload).toEqual({
        sub: '1234567890',
        name: 'John Doe',
        iat: 1516239022
      })
    })

    it('should detect expired tokens', () => {
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjoxNTE2MjM5MDIyfQ.4Adcj3UFYzPUVaVF43FmMab6RlaQD8A9V8wFzzht-KQ'
      
      expect(authService.isTokenExpired(expiredToken)).toBe(true)
    })

    it('should clear token data on logout', async () => {
      localStorage.setItem('access_token', mockTokenData.access_token)
      localStorage.setItem('refresh_token', mockTokenData.refresh_token)
      
      await authService.logout()
      
      expect(localStorage.getItem('access_token')).toBeNull()
      expect(localStorage.getItem('refresh_token')).toBeNull()
    })
  })

  describe('Automatic Token Refresh', () => {
    const mockRefreshResponse = {
      access_token: 'new_access_token',
      expires_in: 3600,
      token_type: 'Bearer'
    }

    it('should automatically refresh token when expired', async () => {
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjoxNTE2MjM5MDIyfQ.4Adcj3UFYzPUVaQD8A9V8wFzzht-KQ'
      const refreshToken = 'refresh_token_example'
      
      localStorage.setItem('access_token', expiredToken)
      localStorage.setItem('refresh_token', refreshToken)
      
      mockApiClient.post.mockResolvedValue({
        data: mockRefreshResponse,
        success: true
      })

      const newToken = await authService.refreshTokenIfNeeded()

      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/refresh', {
        refresh_token: refreshToken
      })
      expect(newToken).toBe(mockRefreshResponse.access_token)
      expect(localStorage.getItem('access_token')).toBe(mockRefreshResponse.access_token)
    })

    it('should not refresh token if still valid', async () => {
      const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjo5OTk5OTk5OTk5fQ.Pk8_9WQyFy7y7wvR9F9XqY7TfGk8MoCCyLjJhLOYAj8'
      
      localStorage.setItem('access_token', validToken)
      
      const token = await authService.refreshTokenIfNeeded()
      
      expect(mockApiClient.post).not.toHaveBeenCalled()
      expect(token).toBe(validToken)
    })

    it('should handle refresh token expiration gracefully', async () => {
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjoxNTE2MjM5MDIyfQ.4Adcj3UFYzPUVaQD8A9V8wFzzht-KQ'
      const expiredRefreshToken = 'expired_refresh_token'
      
      localStorage.setItem('access_token', expiredToken)
      localStorage.setItem('refresh_token', expiredRefreshToken)
      
      mockApiClient.post.mockRejectedValue({
        status: 401,
        message: 'Refresh token expired'
      })

      await expect(authService.refreshTokenIfNeeded()).rejects.toThrow()
      
      // Should clear tokens on refresh failure
      expect(localStorage.getItem('access_token')).toBeNull()
      expect(localStorage.getItem('refresh_token')).toBeNull()
    })

    it('should setup automatic refresh timer', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjo5OTk5OTk5OTk5fQ.Pk8_9WQyFy7y7wvR9F9XqY7TfGk8MoCCyLjJhLOYAj8'
      
      localStorage.setItem('access_token', token)
      
      authService.setupAutoRefresh()
      
      expect(vi.getTimerCount()).toBeGreaterThan(0)
    })
  })

  describe('Authenticated Request Handling', () => {
    const mockToken = 'valid_access_token'

    it('should add Authorization header to authenticated requests', async () => {
      localStorage.setItem('access_token', mockToken)
      
      mockApiClient.get.mockResolvedValue({
        data: [],
        success: true
      })

      await authService.makeAuthenticatedRequest('get', '/protected-endpoint')

      expect(mockApiClient.get).toHaveBeenCalledWith('/protected-endpoint', {
        headers: {
          'Authorization': `Bearer ${mockToken}`
        }
      })
    })

    it('should handle 401 responses by attempting token refresh', async () => {
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjoxNTE2MjM5MDIyfQ.4Adcj3UFYzPUVaQD8A9V8wFzzht-KQ'
      const refreshToken = 'refresh_token_example'
      const newToken = 'new_access_token'
      
      localStorage.setItem('access_token', expiredToken)
      localStorage.setItem('refresh_token', refreshToken)
      
      // First call fails with 401
      mockApiClient.get
        .mockRejectedValueOnce({
          status: 401,
          message: 'Token expired'
        })
        .mockResolvedValue({
          data: { message: 'Success' },
          success: true
        })
      
      // Mock successful token refresh
      mockApiClient.post.mockResolvedValue({
        data: { access_token: newToken, expires_in: 3600 },
        success: true
      })

      const result = await authService.makeAuthenticatedRequest('get', '/protected-endpoint')

      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/refresh', {
        refresh_token: refreshToken
      })
      expect(mockApiClient.get).toHaveBeenCalledTimes(2)
      expect(result.data.message).toBe('Success')
    })

    it('should throw authentication error when no token is available', async () => {
      await expect(
        authService.makeAuthenticatedRequest('get', '/protected-endpoint')
      ).rejects.toThrow('No authentication token available')
    })

    it('should support different HTTP methods for authenticated requests', async () => {
      localStorage.setItem('access_token', mockToken)
      
      const testData = { test: 'data' }
      
      mockApiClient.post.mockResolvedValue({
        data: testData,
        success: true
      })

      await authService.makeAuthenticatedRequest('post', '/protected-endpoint', testData)

      expect(mockApiClient.post).toHaveBeenCalledWith('/protected-endpoint', testData, {
        headers: {
          'Authorization': `Bearer ${mockToken}`
        }
      })
    })

    it('should handle network errors during authenticated requests', async () => {
      localStorage.setItem('access_token', mockToken)
      
      mockApiClient.get.mockRejectedValue(new Error('Network error'))

      await expect(
        authService.makeAuthenticatedRequest('get', '/protected-endpoint')
      ).rejects.toThrow('Network error')
    })
  })

  describe('Integration with existing API client', () => {
    it('should integrate seamlessly with documentService', async () => {
      const mockToken = 'valid_token'
      localStorage.setItem('access_token', mockToken)
      
      mockApiClient.get.mockResolvedValue({
        data: [],
        success: true
      })

      // This should use authenticated requests automatically
      await authService.makeAuthenticatedRequest('get', '/documents')

      expect(mockApiClient.get).toHaveBeenCalledWith('/documents', {
        headers: {
          'Authorization': `Bearer ${mockToken}`
        }
      })
    })

    it('should provide user context from token', () => {
      const tokenWithUserData = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwicm9sZSI6ImVkaXRvciIsImV4cCI6OTk5OTk5OTk5OX0.example'
      localStorage.setItem('access_token', tokenWithUserData)
      
      const userContext = authService.getCurrentUserContext()
      
      expect(userContext).toEqual({
        sub: 'user123',
        email: 'test@example.com',
        role: 'editor',
        exp: 9999999999
      })
    })
  })
})