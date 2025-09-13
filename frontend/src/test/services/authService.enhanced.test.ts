/**
 * Enhanced comprehensive test suite for Auth Service
 */
import { authService, AuthTokenData, TokenPayload } from '../../services/authService'
import { apiClient } from '../../services/api'

// Mock the API client
jest.mock('../../services/api')
const mockApiClient = apiClient as jest.Mocked<typeof apiClient>

// Mock localStorage
const mockLocalStorage = {
  store: {} as Record<string, string>,
  getItem: jest.fn((key: string) => mockLocalStorage.store[key] || null),
  setItem: jest.fn((key: string, value: string) => {
    mockLocalStorage.store[key] = value
  }),
  removeItem: jest.fn((key: string) => {
    delete mockLocalStorage.store[key]
  }),
  clear: jest.fn(() => {
    mockLocalStorage.store = {}
  })
}

// Mock console methods
const mockConsole = {
  warn: jest.fn(),
  error: jest.fn()
}

describe('AuthService Enhanced Tests', () => {
  const originalConsole = console
  const originalLocalStorage = global.localStorage

  beforeAll(() => {
    Object.defineProperty(global, 'localStorage', {
      value: mockLocalStorage,
      writable: true
    })
    console.warn = mockConsole.warn
    console.error = mockConsole.error
  })

  afterAll(() => {
    global.localStorage = originalLocalStorage
    console.warn = originalConsole.warn
    console.error = originalConsole.error
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockLocalStorage.clear()
    authService.clearAutoRefresh()
  })

  afterEach(() => {
    authService.clearAutoRefresh()
  })

  describe('Login functionality', () => {
    const mockTokenData: AuthTokenData = {
      access_token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwicm9sZSI6InVzZXIiLCJleHAiOjk5OTk5OTk5OTksImlhdCI6MTY5OTk5OTk5OX0.example',
      refresh_token: 'refresh_token_123',
      expires_in: 3600,
      token_type: 'Bearer'
    }

    it('should login successfully and store tokens', async () => {
      mockApiClient.post.mockResolvedValueOnce({
        success: true,
        data: mockTokenData,
        message: 'Login successful',
        status: 200
      })

      const result = await authService.login('test@example.com', 'password')

      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/login', {
        email: 'test@example.com',
        password: 'password'
      })
      expect(result).toEqual(mockTokenData)
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('access_token', mockTokenData.access_token)
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('refresh_token', mockTokenData.refresh_token)
    })

    it('should handle login failure', async () => {
      mockApiClient.post.mockResolvedValueOnce({
        success: false,
        message: 'Invalid credentials',
        status: 401
      })

      await expect(authService.login('test@example.com', 'wrong')).rejects.toThrow('Invalid credentials')
    })

    it('should handle network errors during login', async () => {
      mockApiClient.post.mockRejectedValueOnce(new Error('Network error'))

      await expect(authService.login('test@example.com', 'password')).rejects.toThrow('Network error')
    })

    it('should setup auto-refresh after successful login', async () => {
      const shortLivedToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjoxNzAwMDAwMDAwfQ.example'
      const tokenData = { ...mockTokenData, access_token: shortLivedToken }

      mockApiClient.post.mockResolvedValueOnce({
        success: true,
        data: tokenData,
        message: 'Login successful',
        status: 200
      })

      jest.spyOn(authService, 'setupAutoRefresh')

      await authService.login('test@example.com', 'password')

      expect(authService.setupAutoRefresh).toHaveBeenCalled()
    })
  })

  describe('Logout functionality', () => {
    beforeEach(() => {
      mockLocalStorage.setItem('access_token', 'test_token')
      mockLocalStorage.setItem('refresh_token', 'refresh_token')
    })

    it('should logout successfully and clear tokens', async () => {
      mockApiClient.post.mockResolvedValueOnce({
        success: true,
        message: 'Logged out',
        status: 200
      })

      await authService.logout()

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('access_token')
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('refresh_token')
      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/logout')
    })

    it('should clear tokens even if logout API call fails', async () => {
      mockApiClient.post.mockRejectedValueOnce(new Error('Server error'))

      await authService.logout()

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('access_token')
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('refresh_token')
      expect(mockConsole.warn).toHaveBeenCalledWith('Logout request failed:', expect.any(Error))
    })
  })

  describe('Token management', () => {
    it('should return stored token', () => {
      const token = 'test_token_123'
      mockLocalStorage.setItem('access_token', token)

      expect(authService.getStoredToken()).toBe(token)
    })

    it('should return null when no token stored', () => {
      expect(authService.getStoredToken()).toBeNull()
    })

    it('should return stored refresh token', () => {
      const refreshToken = 'refresh_token_123'
      mockLocalStorage.setItem('refresh_token', refreshToken)

      expect(authService.getStoredRefreshToken()).toBe(refreshToken)
    })
  })

  describe('Authentication status', () => {
    it('should return true for valid JWT token', () => {
      const validToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjo5OTk5OTk5OTk5fQ.example'
      mockLocalStorage.setItem('access_token', validToken)

      expect(authService.isAuthenticated()).toBe(true)
    })

    it('should return true for simple string token (test mode)', () => {
      mockLocalStorage.setItem('access_token', 'simple_token')

      expect(authService.isAuthenticated()).toBe(true)
    })

    it('should return false for expired token', () => {
      const expiredToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjoxNTAwMDAwMDAwfQ.example'
      mockLocalStorage.setItem('access_token', expiredToken)

      expect(authService.isAuthenticated()).toBe(false)
    })

    it('should return false when no token', () => {
      expect(authService.isAuthenticated()).toBe(false)
    })
  })

  describe('Token parsing', () => {
    it('should parse valid JWT token payload', () => {
      const token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwicm9sZSI6InVzZXIiLCJleHAiOjk5OTk5OTk5OTksImlhdCI6MTY5OTk5OTk5OX0.example'

      const payload = authService.parseTokenPayload(token)

      expect(payload).toEqual({
        sub: '1234567890',
        email: 'test@example.com',
        role: 'user',
        exp: 9999999999,
        iat: 1699999999
      })
    })

    it('should return null for invalid token format', () => {
      expect(authService.parseTokenPayload('invalid_token')).toBeNull()
      expect(authService.parseTokenPayload('')).toBeNull()
      expect(authService.parseTokenPayload('not.jwt.token')).toBeNull()
    })

    it('should handle malformed JWT gracefully', () => {
      const malformedToken = 'header.invalid_payload.signature'
      expect(authService.parseTokenPayload(malformedToken)).toBeNull()
      expect(mockConsole.error).toHaveBeenCalledWith('Failed to parse token payload:', expect.any(Error))
    })
  })

  describe('Token expiration checking', () => {
    it('should detect expired token', () => {
      const expiredToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjoxNTAwMDAwMDAwfQ.example'

      expect(authService.isTokenExpired(expiredToken)).toBe(true)
    })

    it('should detect valid token', () => {
      const validToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjo5OTk5OTk5OTk5fQ.example'

      expect(authService.isTokenExpired(validToken)).toBe(false)
    })

    it('should return true for invalid token', () => {
      expect(authService.isTokenExpired('invalid')).toBe(true)
    })
  })

  describe('User context', () => {
    it('should return current user context from token', () => {
      const token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwicm9sZSI6InVzZXIiLCJleHAiOjk5OTk5OTk5OTl9.example'
      mockLocalStorage.setItem('access_token', token)

      const context = authService.getCurrentUserContext()

      expect(context).toEqual({
        sub: '1234567890',
        email: 'test@example.com',
        role: 'user',
        exp: 9999999999
      })
    })

    it('should return null when no token', () => {
      expect(authService.getCurrentUserContext()).toBeNull()
    })
  })

  describe('Token refresh', () => {
    const refreshTokenData: AuthTokenData = {
      access_token: 'new_access_token',
      refresh_token: 'new_refresh_token',
      expires_in: 3600,
      token_type: 'Bearer'
    }

    beforeEach(() => {
      mockLocalStorage.setItem('access_token', 'old_token')
      mockLocalStorage.setItem('refresh_token', 'refresh_token')
    })

    it('should refresh token successfully', async () => {
      mockApiClient.post.mockResolvedValueOnce({
        success: true,
        data: refreshTokenData,
        message: 'Token refreshed',
        status: 200
      })

      const newToken = await authService.refreshTokenIfNeeded()

      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/refresh', {
        refresh_token: 'refresh_token'
      })
      expect(newToken).toBe(refreshTokenData.access_token)
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('access_token', refreshTokenData.access_token)
    })

    it('should return current token if still valid', async () => {
      const validToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjo5OTk5OTk5OTk5fQ.example'
      mockLocalStorage.setItem('access_token', validToken)

      const token = await authService.refreshTokenIfNeeded()

      expect(token).toBe(validToken)
      expect(mockApiClient.post).not.toHaveBeenCalled()
    })

    it('should clear tokens on refresh failure', async () => {
      mockApiClient.post.mockResolvedValueOnce({
        success: false,
        message: 'Refresh failed',
        status: 401
      })

      await expect(authService.refreshTokenIfNeeded()).rejects.toThrow('Refresh failed')
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('access_token')
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('refresh_token')
    })

    it('should throw error when no refresh token available', async () => {
      mockLocalStorage.removeItem('refresh_token')

      await expect(authService.refreshTokenIfNeeded()).rejects.toThrow('No refresh token available')
    })
  })

  describe('Auto-refresh mechanism', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('should setup auto-refresh timer', () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
      const token = `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjoke(futureTime)}.example`
      mockLocalStorage.setItem('access_token', token)

      authService.setupAutoRefresh()

      expect(jest.getTimerCount()).toBe(1)
    })

    it('should refresh immediately for soon-expiring token', async () => {
      const soonExpiring = Math.floor(Date.now() / 1000) + 60 // 1 minute from now
      const token = `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjoke(soonExpiring)}.example`
      mockLocalStorage.setItem('access_token', token)
      mockLocalStorage.setItem('refresh_token', 'refresh_token')

      const refreshSpy = jest.spyOn(authService, 'refreshTokenIfNeeded').mockResolvedValue('new_token')

      authService.setupAutoRefresh()

      expect(refreshSpy).toHaveBeenCalled()
    })

    it('should clear auto-refresh timer', () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600
      const token = `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjoke(futureTime)}.example`
      mockLocalStorage.setItem('access_token', token)

      authService.setupAutoRefresh()
      expect(jest.getTimerCount()).toBe(1)

      authService.clearAutoRefresh()
      expect(jest.getTimerCount()).toBe(0)
    })
  })

  describe('Authenticated requests', () => {
    const mockResponse = { success: true, data: { test: 'data' } }

    beforeEach(() => {
      const validToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjo5OTk5OTk5OTk5fQ.example'
      mockLocalStorage.setItem('access_token', validToken)
    })

    it('should make authenticated GET request', async () => {
      mockApiClient.get.mockResolvedValueOnce(mockResponse)

      const response = await authService.makeAuthenticatedRequest('get', '/test')

      expect(mockApiClient.get).toHaveBeenCalledWith('/test', {
        headers: { 'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjo5OTk5OTk5OTk5fQ.example' }
      })
      expect(response).toEqual(mockResponse)
    })

    it('should make authenticated POST request', async () => {
      const postData = { name: 'test' }
      mockApiClient.post.mockResolvedValueOnce(mockResponse)

      await authService.makeAuthenticatedRequest('post', '/test', postData)

      expect(mockApiClient.post).toHaveBeenCalledWith('/test', postData, {
        headers: { 'Authorization': expect.stringContaining('Bearer') }
      })
    })

    it('should retry with new token on 401 error', async () => {
      const refreshedTokenData = {
        access_token: 'new_token',
        refresh_token: 'new_refresh',
        expires_in: 3600,
        token_type: 'Bearer'
      }

      // First request fails with 401
      mockApiClient.get.mockRejectedValueOnce({ status: 401, message: 'Unauthorized' })

      // Token refresh succeeds
      mockApiClient.post.mockResolvedValueOnce({
        success: true,
        data: refreshedTokenData,
        status: 200
      })

      // Retry request succeeds
      mockApiClient.get.mockResolvedValueOnce(mockResponse)

      const response = await authService.makeAuthenticatedRequest('get', '/test')

      expect(mockApiClient.get).toHaveBeenCalledTimes(2)
      expect(response).toEqual(mockResponse)
    })

    it('should throw error when no token available', async () => {
      mockLocalStorage.clear()

      await expect(
        authService.makeAuthenticatedRequest('get', '/test')
      ).rejects.toThrow('No authentication token available')
    })

    it('should merge custom headers with auth header', async () => {
      mockApiClient.get.mockResolvedValueOnce(mockResponse)

      await authService.makeAuthenticatedRequest('get', '/test', undefined, {
        headers: { 'X-Custom': 'value' }
      })

      expect(mockApiClient.get).toHaveBeenCalledWith('/test', {
        headers: {
          'Authorization': expect.stringContaining('Bearer'),
          'X-Custom': 'value'
        }
      })
    })
  })

  describe('Edge cases and error handling', () => {
    it('should handle empty token payload gracefully', () => {
      const tokenWithEmptyPayload = 'header..signature'
      expect(authService.parseTokenPayload(tokenWithEmptyPayload)).toBeNull()
    })

    it('should handle very long tokens', () => {
      const longToken = 'a'.repeat(10000)
      expect(authService.parseTokenPayload(longToken)).toBeNull()
    })

    it('should handle special characters in token', () => {
      const specialToken = 'header.special!@#$%^&*()payload.signature'
      expect(authService.parseTokenPayload(specialToken)).toBeNull()
    })

    it('should handle undefined localStorage', () => {
      const originalLocalStorage = global.localStorage
      delete (global as any).localStorage

      expect(authService.getStoredToken()).toBeNull()

      global.localStorage = originalLocalStorage
    })
  })

  describe('Performance and memory leaks', () => {
    it('should not create multiple refresh timers', () => {
      jest.useFakeTimers()

      const validToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjo5OTk5OTk5OTk5fQ.example'
      mockLocalStorage.setItem('access_token', validToken)

      authService.setupAutoRefresh()
      authService.setupAutoRefresh()
      authService.setupAutoRefresh()

      expect(jest.getTimerCount()).toBe(1)

      jest.useRealTimers()
    })

    it('should clear timer on logout', async () => {
      jest.useFakeTimers()

      const validToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjo5OTk5OTk5OTk5fQ.example'
      mockLocalStorage.setItem('access_token', validToken)

      authService.setupAutoRefresh()
      expect(jest.getTimerCount()).toBe(1)

      mockApiClient.post.mockResolvedValueOnce({ success: true, status: 200 })
      await authService.logout()

      expect(jest.getTimerCount()).toBe(0)

      jest.useRealTimers()
    })
  })
})