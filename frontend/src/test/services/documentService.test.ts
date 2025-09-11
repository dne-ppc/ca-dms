import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { documentService } from '../../services/documentService'
import { apiClient } from '../../services/api'
import type { Document, PlaceholderObject } from '../../types'

// Mock the API client
vi.mock('../../services/api')

describe('Document API Services', () => {
  const mockApiClient = vi.mocked(apiClient)
  
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Document CRUD API calls', () => {
    const mockDocument: Document = {
      id: '1',
      title: 'Test Document',
      content: JSON.stringify([{ insert: 'Hello world' }]),
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      status: 'draft',
      authorId: 'user1'
    }

    it('should handle document creation with placeholder data', async () => {
      const createData = {
        title: 'New Document',
        content: JSON.stringify([{ insert: 'Content' }]),
        placeholders: [
          {
            id: 'placeholder1',
            type: 'signature' as const,
            data: { label: 'Sign here' },
            position: 10
          }
        ]
      }

      mockApiClient.post.mockResolvedValue({
        data: mockDocument,
        success: true
      })

      const result = await documentService.createDocumentWithPlaceholders(createData)

      expect(mockApiClient.post).toHaveBeenCalledWith('/documents', createData)
      expect(result).toEqual(mockDocument)
    })

    it('should handle document updates preserving placeholder data', async () => {
      const updateData = {
        title: 'Updated Document',
        content: JSON.stringify([{ insert: 'Updated content' }]),
        placeholders: [
          {
            id: 'placeholder1',
            type: 'signature' as const,
            data: { label: 'Updated signature' },
            position: 15
          }
        ]
      }

      mockApiClient.put.mockResolvedValue({
        data: { ...mockDocument, ...updateData },
        success: true
      })

      const result = await documentService.updateDocumentWithPlaceholders('1', updateData)

      expect(mockApiClient.put).toHaveBeenCalledWith('/documents/1', updateData)
      expect(result.title).toEqual('Updated Document')
    })

    it('should retrieve documents with placeholder data included', async () => {
      const documentsWithPlaceholders = [
        {
          ...mockDocument,
          placeholders: [
            {
              id: 'placeholder1',
              type: 'version-table' as const,
              data: { version: '1.0' },
              position: 0
            }
          ]
        }
      ]

      mockApiClient.get.mockResolvedValue({
        data: documentsWithPlaceholders,
        success: true
      })

      const result = await documentService.getDocumentsWithPlaceholders()

      expect(mockApiClient.get).toHaveBeenCalledWith('/documents?include=placeholders')
      expect(result).toEqual(documentsWithPlaceholders)
      expect(result[0].placeholders).toBeDefined()
      expect(result[0].placeholders![0].type).toBe('version-table')
    })
  })

  describe('Placeholder data serialization', () => {
    it('should properly serialize placeholder objects for API calls', async () => {
      const placeholders: PlaceholderObject[] = [
        {
          id: 'sig1',
          type: 'signature',
          data: {
            label: 'Administrator Signature',
            required: true,
            includeTitle: true
          },
          position: 100
        },
        {
          id: 'resp1',
          type: 'long-response',
          data: {
            label: 'Detailed Response',
            lineCount: 10,
            placeholder: 'Enter your response here...'
          },
          position: 200
        }
      ]

      const serialized = documentService.serializePlaceholders(placeholders)

      expect(serialized).toEqual(placeholders)
      expect(serialized[0].data.label).toBe('Administrator Signature')
      expect(serialized[1].data.lineCount).toBe(10)
    })

    it('should deserialize placeholder objects from API responses', async () => {
      const apiResponse = {
        placeholders: [
          {
            id: 'line1',
            type: 'line-segment',
            data: {
              label: 'Name',
              length: 'medium',
              width: 288
            },
            position: 50
          }
        ]
      }

      const deserialized = documentService.deserializePlaceholders(apiResponse.placeholders)

      expect(deserialized).toHaveLength(1)
      expect(deserialized[0].type).toBe('line-segment')
      expect(deserialized[0].data.length).toBe('medium')
    })

    it('should validate placeholder data before serialization', async () => {
      const invalidPlaceholder: PlaceholderObject = {
        id: '',
        type: 'signature',
        data: {},
        position: -1
      }

      expect(() => {
        documentService.validatePlaceholderData(invalidPlaceholder)
      }).toThrow('Invalid placeholder: ID cannot be empty')
    })
  })

  describe('Error handling and retries', () => {
    it('should handle API errors gracefully', async () => {
      const error = new Error('Network error')
      mockApiClient.get.mockRejectedValue(error)

      await expect(documentService.getDocuments()).rejects.toThrow('Network error')
      expect(mockApiClient.get).toHaveBeenCalledTimes(1)
    })

    it('should implement retry logic for transient failures', async () => {
      // First two calls fail, third succeeds
      mockApiClient.get
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValue({
          data: [],
          success: true
        })

      const result = await documentService.getDocumentsWithRetry()

      expect(mockApiClient.get).toHaveBeenCalledTimes(3)
      expect(result).toEqual([])
    })

    it('should stop retrying after maximum attempts', async () => {
      const error = new Error('Persistent failure')
      mockApiClient.get.mockRejectedValue(error)

      await expect(documentService.getDocumentsWithRetry(3)).rejects.toThrow('Persistent failure')
      expect(mockApiClient.get).toHaveBeenCalledTimes(3)
    })

    it('should handle malformed API responses', async () => {
      mockApiClient.get.mockResolvedValue({
        data: null,
        success: false,
        message: 'Invalid response format'
      })

      await expect(documentService.getDocuments()).rejects.toThrow('Invalid response format')
    })

    it('should handle timeout errors with appropriate messaging', async () => {
      const timeoutError = new Error('Request timeout')
      timeoutError.name = 'TimeoutError'
      mockApiClient.post.mockRejectedValue(timeoutError)

      await expect(
        documentService.createDocument({ title: 'Test', content: '{}' })
      ).rejects.toThrow('Request timeout')
    })
  })

  describe('Advanced document operations', () => {
    it('should support document bulk operations', async () => {
      const documents = [
        { title: 'Doc 1', content: '{}' },
        { title: 'Doc 2', content: '{}' }
      ]

      mockApiClient.post.mockResolvedValue({
        data: { created: 2, failed: 0 },
        success: true
      })

      const result = await documentService.bulkCreateDocuments(documents)

      expect(mockApiClient.post).toHaveBeenCalledWith('/documents/bulk', { documents })
      expect(result.created).toBe(2)
    })

    it('should support document search with filters', async () => {
      const searchParams = {
        query: 'test',
        status: 'published' as const,
        authorId: 'user1'
      }

      mockApiClient.get.mockResolvedValue({
        data: [],
        success: true
      })

      await documentService.searchDocuments(searchParams)

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/documents/search?query=test&status=published&authorId=user1'
      )
    })
  })
})