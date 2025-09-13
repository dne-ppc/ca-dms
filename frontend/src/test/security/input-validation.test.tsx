/**
 * Security and input validation tests
 * Tests XSS prevention, data sanitization, and input validation
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DOMPurify from 'dompurify'

// Mock components that handle user input
const MockEditor = ({ onContentChange }: { onContentChange: (content: string) => void }) => (
  <div
    contentEditable
    data-testid="mock-editor"
    onInput={(e) => onContentChange((e.target as HTMLElement).innerHTML)}
  />
)

const MockForm = ({ onSubmit }: { onSubmit: (data: any) => void }) => {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    onSubmit(Object.fromEntries(formData))
  }

  return (
    <form onSubmit={handleSubmit} data-testid="mock-form">
      <input name="title" data-testid="title-input" />
      <textarea name="description" data-testid="description-input" />
      <input name="email" type="email" data-testid="email-input" />
      <input name="url" type="url" data-testid="url-input" />
      <button type="submit" data-testid="submit-button">Submit</button>
    </form>
  )
}

describe('Security and Input Validation Tests', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
    jest.clearAllMocks()
  })

  describe('XSS Prevention', () => {
    it('should sanitize script tags in content', async () => {
      const mockOnContentChange = jest.fn()
      render(<MockEditor onContentChange={mockOnContentChange} />)

      const editor = screen.getByTestId('mock-editor')

      // Attempt to inject script tag
      const maliciousContent = '<script>alert("XSS")</script><p>Safe content</p>'
      editor.innerHTML = maliciousContent

      fireEvent.input(editor)

      // Verify content is sanitized
      const sanitizedContent = DOMPurify.sanitize(mockOnContentChange.mock.calls[0][0])
      expect(sanitizedContent).not.toContain('<script>')
      expect(sanitizedContent).toContain('<p>Safe content</p>')
    })

    it('should prevent javascript: protocol in links', async () => {
      const mockOnContentChange = jest.fn()
      render(<MockEditor onContentChange={mockOnContentChange} />)

      const editor = screen.getByTestId('mock-editor')

      // Attempt to inject malicious link
      const maliciousContent = '<a href="javascript:alert(\'XSS\')">Click me</a>'
      editor.innerHTML = maliciousContent

      fireEvent.input(editor)

      const sanitizedContent = DOMPurify.sanitize(mockOnContentChange.mock.calls[0][0])
      expect(sanitizedContent).not.toContain('javascript:')
      expect(sanitizedContent).toMatch(/<a[^>]*>Click me<\/a>/)
    })

    it('should sanitize event handlers', async () => {
      const mockOnContentChange = jest.fn()
      render(<MockEditor onContentChange={mockOnContentChange} />)

      const editor = screen.getByTestId('mock-editor')

      // Attempt to inject event handlers
      const maliciousContent = '<div onclick="alert(\'XSS\')" onmouseover="steal()">Content</div>'
      editor.innerHTML = maliciousContent

      fireEvent.input(editor)

      const sanitizedContent = DOMPurify.sanitize(mockOnContentChange.mock.calls[0][0])
      expect(sanitizedContent).not.toContain('onclick')
      expect(sanitizedContent).not.toContain('onmouseover')
      expect(sanitizedContent).toContain('Content')
    })

    it('should prevent data URLs with scripts', async () => {
      const mockOnContentChange = jest.fn()
      render(<MockEditor onContentChange={mockOnContentChange} />)

      const editor = screen.getByTestId('mock-editor')

      // Attempt to inject data URL with script
      const maliciousContent = '<img src="data:text/html,<script>alert(\'XSS\')</script>">'
      editor.innerHTML = maliciousContent

      fireEvent.input(editor)

      const sanitizedContent = DOMPurify.sanitize(mockOnContentChange.mock.calls[0][0])
      expect(sanitizedContent).not.toContain('data:text/html')
      expect(sanitizedContent).not.toContain('<script>')
    })

    it('should handle nested XSS attempts', async () => {
      const mockOnContentChange = jest.fn()
      render(<MockEditor onContentChange={mockOnContentChange} />)

      const editor = screen.getByTestId('mock-editor')

      // Complex nested XSS attempt
      const maliciousContent = '<div><iframe src="javascript:alert(\'XSS\')"></iframe><script>/*<![CDATA[*/alert("XSS")/*]]>*/</script></div>'
      editor.innerHTML = maliciousContent

      fireEvent.input(editor)

      const sanitizedContent = DOMPurify.sanitize(mockOnContentChange.mock.calls[0][0])
      expect(sanitizedContent).not.toContain('<script>')
      expect(sanitizedContent).not.toContain('<iframe')
      expect(sanitizedContent).not.toContain('javascript:')
    })
  })

  describe('Input Validation', () => {
    it('should validate email format', async () => {
      const mockOnSubmit = jest.fn()
      render(<MockForm onSubmit={mockOnSubmit} />)

      const emailInput = screen.getByTestId('email-input')
      const submitButton = screen.getByTestId('submit-button')

      // Test invalid email
      await user.type(emailInput, 'invalid-email')
      await user.click(submitButton)

      // HTML5 validation should prevent submission
      expect(mockOnSubmit).not.toHaveBeenCalled()
      expect(emailInput).toBeInvalid()
    })

    it('should validate URL format', async () => {
      const mockOnSubmit = jest.fn()
      render(<MockForm onSubmit={mockOnSubmit} />)

      const urlInput = screen.getByTestId('url-input')
      const submitButton = screen.getByTestId('submit-button')

      // Test invalid URL
      await user.type(urlInput, 'not-a-url')
      await user.click(submitButton)

      expect(mockOnSubmit).not.toHaveBeenCalled()
      expect(urlInput).toBeInvalid()
    })

    it('should prevent SQL injection patterns', () => {
      const sqlInjectionPatterns = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "admin'--",
        "' UNION SELECT * FROM users --",
        "); DROP TABLE users; --"
      ]

      sqlInjectionPatterns.forEach(pattern => {
        // Simulate input sanitization function
        const sanitizeInput = (input: string) => {
          return input
            .replace(/['"]/g, '') // Remove quotes
            .replace(/--/g, '') // Remove SQL comments
            .replace(/;/g, '') // Remove semicolons
            .replace(/\b(DROP|DELETE|TRUNCATE|ALTER|CREATE)\b/gi, '') // Remove dangerous SQL keywords
        }

        const sanitized = sanitizeInput(pattern)
        expect(sanitized).not.toMatch(/['"]/);
        expect(sanitized).not.toContain('--')
        expect(sanitized).not.toContain(';')
        expect(sanitized).not.toMatch(/\b(DROP|DELETE|TRUNCATE|ALTER|CREATE)\b/i)
      })
    })

    it('should limit input length', async () => {
      const MockLimitedInput = () => {
        const [value, setValue] = React.useState('')
        const maxLength = 100

        const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
          const newValue = e.target.value
          if (newValue.length <= maxLength) {
            setValue(newValue)
          }
        }

        return (
          <div>
            <textarea
              value={value}
              onChange={handleChange}
              data-testid="limited-input"
            />
            <span data-testid="char-count">{value.length}/{maxLength}</span>
          </div>
        )
      }

      render(<MockLimitedInput />)

      const input = screen.getByTestId('limited-input')
      const charCount = screen.getByTestId('char-count')

      // Type more than the limit
      const longText = 'a'.repeat(150)
      await user.type(input, longText)

      // Should be truncated to limit
      expect(input).toHaveValue('a'.repeat(100))
      expect(charCount).toHaveTextContent('100/100')
    })

    it('should sanitize file uploads', () => {
      const dangerousFilenames = [
        '../../../etc/passwd',
        'file.php.jpg',
        'script.exe',
        'malware.bat',
        'file<script>.txt',
        'file"with"quotes.txt'
      ]

      const sanitizeFilename = (filename: string) => {
        return filename
          .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special chars with underscore
          .replace(/^\.+/, '') // Remove leading dots
          .replace(/\.+$/, '') // Remove trailing dots
          .substring(0, 255) // Limit length
      }

      dangerousFilenames.forEach(filename => {
        const sanitized = sanitizeFilename(filename)
        expect(sanitized).not.toContain('../')
        expect(sanitized).not.toContain('<')
        expect(sanitized).not.toContain('>')
        expect(sanitized).not.toContain('"')
        expect(sanitized.length).toBeLessThanOrEqual(255)
      })
    })
  })

  describe('Content Security Policy (CSP)', () => {
    it('should prevent inline script execution', () => {
      const mockCSP = {
        'script-src': "'self'",
        'style-src': "'self' 'unsafe-inline'",
        'img-src': "'self' data: https:",
        'connect-src': "'self'",
        'font-src': "'self'",
        'object-src': "'none'",
        'media-src': "'self'",
        'frame-src': "'none'"
      }

      // Simulate CSP validation
      const validateCSP = (content: string, policy: typeof mockCSP) => {
        const violations = []

        // Check for inline scripts
        if (content.includes('<script>') && !policy['script-src'].includes("'unsafe-inline'")) {
          violations.push('Inline script blocked by CSP')
        }

        // Check for external scripts from unauthorized domains
        const scriptSrcRegex = /<script[^>]+src=['"]([^'"]+)['"][^>]*>/g
        let match
        while ((match = scriptSrcRegex.exec(content)) !== null) {
          const src = match[1]
          if (!src.startsWith('/') && !src.startsWith('https://trusted-domain.com')) {
            violations.push(`External script from ${src} blocked by CSP`)
          }
        }

        return violations
      }

      const maliciousContent = `
        <script>alert('XSS')</script>
        <script src="https://evil-domain.com/malware.js"></script>
        <script src="/safe-script.js"></script>
      `

      const violations = validateCSP(maliciousContent, mockCSP)
      expect(violations).toContain('Inline script blocked by CSP')
      expect(violations).toContain(expect.stringContaining('External script from https://evil-domain.com/malware.js blocked by CSP'))
      expect(violations).not.toContain(expect.stringContaining('/safe-script.js'))
    })

    it('should validate image sources', () => {
      const mockCSP = { 'img-src': "'self' data: https:" }

      const validateImageSrc = (src: string, policy: typeof mockCSP) => {
        const imgSrc = policy['img-src']

        if (src.startsWith('data:') && imgSrc.includes('data:')) return true
        if (src.startsWith('https:') && imgSrc.includes('https:')) return true
        if (src.startsWith('/') && imgSrc.includes("'self'")) return true
        if (src.startsWith('http:') && !imgSrc.includes('http:')) return false

        return false
      }

      expect(validateImageSrc('data:image/png;base64,abc123', mockCSP)).toBe(true)
      expect(validateImageSrc('https://example.com/image.png', mockCSP)).toBe(true)
      expect(validateImageSrc('/local/image.png', mockCSP)).toBe(true)
      expect(validateImageSrc('http://unsecure.com/image.png', mockCSP)).toBe(false)
    })
  })

  describe('Authentication & Authorization', () => {
    it('should validate JWT token format', () => {
      const validateJWTFormat = (token: string) => {
        const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/
        return jwtRegex.test(token)
      }

      expect(validateJWTFormat('valid.jwt.token')).toBe(true)
      expect(validateJWTFormat('header.payload.signature')).toBe(true)
      expect(validateJWTFormat('invalid-token')).toBe(false)
      expect(validateJWTFormat('too.few.parts')).toBe(false)
      expect(validateJWTFormat('')).toBe(false)
    })

    it('should handle token expiration', () => {
      const checkTokenExpiration = (token: string) => {
        try {
          // Simulate JWT decode (normally would use a JWT library)
          const payload = JSON.parse(atob(token.split('.')[1]))
          const currentTime = Math.floor(Date.now() / 1000)
          return payload.exp && payload.exp > currentTime
        } catch {
          return false
        }
      }

      // Create mock tokens
      const futureExp = Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
      const pastExp = Math.floor(Date.now() / 1000) - 3600   // 1 hour ago

      const validToken = `header.${btoa(JSON.stringify({ exp: futureExp }))}.signature`
      const expiredToken = `header.${btoa(JSON.stringify({ exp: pastExp }))}.signature`

      expect(checkTokenExpiration(validToken)).toBe(true)
      expect(checkTokenExpiration(expiredToken)).toBe(false)
    })

    it('should validate user permissions', () => {
      const checkPermission = (userRoles: string[], requiredPermission: string, permissions: Record<string, string[]>) => {
        return userRoles.some(role =>
          permissions[role] && permissions[role].includes(requiredPermission)
        )
      }

      const rolePermissions = {
        admin: ['read', 'write', 'delete', 'manage_users'],
        editor: ['read', 'write'],
        viewer: ['read']
      }

      expect(checkPermission(['admin'], 'delete', rolePermissions)).toBe(true)
      expect(checkPermission(['editor'], 'write', rolePermissions)).toBe(true)
      expect(checkPermission(['viewer'], 'write', rolePermissions)).toBe(false)
      expect(checkPermission(['viewer'], 'read', rolePermissions)).toBe(true)
    })
  })

  describe('Rate Limiting', () => {
    it('should implement rate limiting for API calls', () => {
      const rateLimiter = {
        requests: new Map<string, { count: number; resetTime: number }>(),

        checkLimit(clientId: string, limit: number = 100, windowMs: number = 60000) {
          const now = Date.now()
          const clientData = this.requests.get(clientId)

          if (!clientData || now > clientData.resetTime) {
            this.requests.set(clientId, { count: 1, resetTime: now + windowMs })
            return true
          }

          if (clientData.count >= limit) {
            return false
          }

          clientData.count++
          return true
        }
      }

      const clientId = 'test-client'

      // Should allow requests within limit
      for (let i = 0; i < 100; i++) {
        expect(rateLimiter.checkLimit(clientId)).toBe(true)
      }

      // Should block request over limit
      expect(rateLimiter.checkLimit(clientId)).toBe(false)
    })
  })

  describe('Data Sanitization', () => {
    it('should sanitize HTML content', () => {
      const sanitizeHTML = (html: string) => {
        return DOMPurify.sanitize(html, {
          ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li'],
          ALLOWED_ATTR: ['class'],
          FORBID_SCRIPT: true
        })
      }

      const maliciousHTML = `
        <script>alert('XSS')</script>
        <p class="safe">Safe content</p>
        <iframe src="javascript:alert('XSS')"></iframe>
        <strong>Bold text</strong>
        <img onerror="alert('XSS')" src="x">
      `

      const sanitized = sanitizeHTML(maliciousHTML)

      expect(sanitized).not.toContain('<script>')
      expect(sanitized).not.toContain('<iframe>')
      expect(sanitized).not.toContain('<img>')
      expect(sanitized).not.toContain('onerror')
      expect(sanitized).toContain('<p class="safe">Safe content</p>')
      expect(sanitized).toContain('<strong>Bold text</strong>')
    })

    it('should encode special characters', () => {
      const encodeSpecialChars = (text: string) => {
        return text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;')
      }

      const input = `<script>alert("XSS & 'malicious' code")</script>`
      const encoded = encodeSpecialChars(input)

      expect(encoded).toBe('&lt;script&gt;alert(&quot;XSS &amp; &#x27;malicious&#x27; code&quot;)&lt;/script&gt;')
      expect(encoded).not.toContain('<')
      expect(encoded).not.toContain('>')
      expect(encoded).not.toContain('"')
      expect(encoded).not.toContain('&')
    })

    it('should validate and sanitize URLs', () => {
      const sanitizeURL = (url: string) => {
        try {
          const parsed = new URL(url)

          // Block dangerous protocols
          if (['javascript:', 'data:', 'vbscript:', 'file:'].includes(parsed.protocol)) {
            return ''
          }

          // Only allow http and https
          if (!['http:', 'https:'].includes(parsed.protocol)) {
            return ''
          }

          return parsed.href
        } catch {
          return ''
        }
      }

      expect(sanitizeURL('https://example.com')).toBe('https://example.com/')
      expect(sanitizeURL('http://example.com')).toBe('http://example.com/')
      expect(sanitizeURL('javascript:alert("XSS")')).toBe('')
      expect(sanitizeURL('data:text/html,<script>alert("XSS")</script>')).toBe('')
      expect(sanitizeURL('file:///etc/passwd')).toBe('')
      expect(sanitizeURL('invalid-url')).toBe('')
    })
  })
})