/**
 * Enhanced comprehensive test suite for Document Service
 */
import { documentService } from '../../services/documentService'
import { apiClient } from '../../services/api'
import type { Document, PlaceholderObject } from '../../types'

// Mock the API client
jest.mock('../../services/api')
const mockApiClient = apiClient as jest.Mocked<typeof apiClient>

describe('DocumentService Enhanced Tests', () => {
  const mockDocument: Document = {
    id: 'doc-123',
    title: 'Test Document',
    content: '{"ops":[{"insert":"Hello World"}]}',
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
    version: 1,
    status: 'draft'
  }

  const mockPlaceholder: PlaceholderObject = {
    id: 'placeholder-1',
    type: 'signature',
    data: { label: 'Sign here', required: true },
    position: 0
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Basic CRUD Operations', () => {
    describe('getDocuments', () => {
      it('should fetch documents successfully', async () => {
        const mockDocuments = [mockDocument]
        mockApiClient.get.mockResolvedValueOnce({
          success: true,
          data: mockDocuments,
          status: 200
        })

        const result = await documentService.getDocuments()

        expect(mockApiClient.get).toHaveBeenCalledWith('/documents')
        expect(result).toEqual(mockDocuments)
      })

      it('should return empty array when no data', async () => {
        mockApiClient.get.mockResolvedValueOnce({
          success: true,
          data: null,
          status: 200
        })

        const result = await documentService.getDocuments()

        expect(result).toEqual([])
      })

      it('should handle API errors', async () => {
        mockApiClient.get.mockResolvedValueOnce({
          success: false,
          message: 'Server error',
          status: 500
        })

        await expect(documentService.getDocuments()).rejects.toThrow('Server error')
      })

      it('should handle network errors', async () => {
        mockApiClient.get.mockRejectedValueOnce(new Error('Network error'))

        await expect(documentService.getDocuments()).rejects.toThrow('Network error')
      })
    })

    describe('getDocument', () => {
      it('should fetch single document successfully', async () => {
        mockApiClient.get.mockResolvedValueOnce({
          success: true,
          data: mockDocument,
          status: 200
        })

        const result = await documentService.getDocument('doc-123')

        expect(mockApiClient.get).toHaveBeenCalledWith('/documents/doc-123')
        expect(result).toEqual(mockDocument)
      })

      it('should handle document not found', async () => {
        mockApiClient.get.mockResolvedValueOnce({
          success: false,
          message: 'Document not found',
          status: 404
        })

        await expect(documentService.getDocument('nonexistent')).rejects.toThrow('Document not found')
      })
    })

    describe('createDocument', () => {
      const createData = {
        title: 'New Document',
        content: '{"ops":[{"insert":"New content"}]}'
      }

      it('should create document successfully', async () => {
        const newDocument = { ...mockDocument, ...createData }
        mockApiClient.post.mockResolvedValueOnce({
          success: true,
          data: newDocument,
          status: 201
        })

        const result = await documentService.createDocument(createData)

        expect(mockApiClient.post).toHaveBeenCalledWith('/documents', createData)
        expect(result).toEqual(newDocument)
      })

      it('should handle validation errors', async () => {
        mockApiClient.post.mockResolvedValueOnce({
          success: false,
          message: 'Title is required',
          status: 422
        })

        await expect(documentService.createDocument(createData)).rejects.toThrow('Title is required')
      })
    })

    describe('updateDocument', () => {
      const updateData = { title: 'Updated Title' }

      it('should update document successfully', async () => {
        const updatedDocument = { ...mockDocument, ...updateData }
        mockApiClient.put.mockResolvedValueOnce({
          success: true,
          data: updatedDocument,
          status: 200
        })

        const result = await documentService.updateDocument('doc-123', updateData)

        expect(mockApiClient.put).toHaveBeenCalledWith('/documents/doc-123', updateData)
        expect(result).toEqual(updatedDocument)
      })

      it('should handle update conflicts', async () => {
        mockApiClient.put.mockResolvedValueOnce({
          success: false,
          message: 'Document has been modified by another user',
          status: 409
        })

        await expect(documentService.updateDocument('doc-123', updateData)).rejects.toThrow('Document has been modified by another user')
      })
    })

    describe('deleteDocument', () => {
      it('should delete document successfully', async () => {
        mockApiClient.delete.mockResolvedValueOnce({
          success: true,
          status: 204
        })

        await documentService.deleteDocument('doc-123')

        expect(mockApiClient.delete).toHaveBeenCalledWith('/documents/doc-123')
      })

      it('should handle delete errors', async () => {
        mockApiClient.delete.mockResolvedValueOnce({
          success: false,
          message: 'Cannot delete published document',
          status: 403
        })

        await expect(documentService.deleteDocument('doc-123')).rejects.toThrow('Cannot delete published document')
      })
    })
  })

  describe('Enhanced Operations with Placeholders', () => {
    describe('getDocumentsWithPlaceholders', () => {
      it('should fetch documents with placeholder data', async () => {
        const documentsWithPlaceholders = [{ ...mockDocument, placeholders: [mockPlaceholder] }]
        mockApiClient.get.mockResolvedValueOnce({
          success: true,
          data: documentsWithPlaceholders,
          status: 200
        })

        const result = await documentService.getDocumentsWithPlaceholders()

        expect(mockApiClient.get).toHaveBeenCalledWith('/documents?include=placeholders')
        expect(result).toEqual(documentsWithPlaceholders)
      })
    })

    describe('createDocumentWithPlaceholders', () => {
      const createData = {
        title: 'Document with Placeholders',
        content: '{"ops":[{"insert":"Content"}]}',
        placeholders: [mockPlaceholder]
      }

      it('should create document with valid placeholders', async () => {
        mockApiClient.post.mockResolvedValueOnce({
          success: true,
          data: { ...mockDocument, ...createData },
          status: 201
        })

        const result = await documentService.createDocumentWithPlaceholders(createData)

        expect(mockApiClient.post).toHaveBeenCalledWith('/documents', createData)
        expect(result).toEqual({ ...mockDocument, ...createData })
      })

      it('should validate placeholders before creation', async () => {
        const invalidPlaceholder = { ...mockPlaceholder, id: '' }
        const dataWithInvalidPlaceholder = {
          ...createData,
          placeholders: [invalidPlaceholder]
        }

        await expect(
          documentService.createDocumentWithPlaceholders(dataWithInvalidPlaceholder)
        ).rejects.toThrow('Invalid placeholder: ID cannot be empty')
      })

      it('should handle placeholders with invalid types', async () => {
        const invalidTypePlaceholder = { ...mockPlaceholder, type: 'invalid' as any }
        const dataWithInvalidType = {
          ...createData,
          placeholders: [invalidTypePlaceholder]
        }

        await expect(
          documentService.createDocumentWithPlaceholders(dataWithInvalidType)
        ).rejects.toThrow('Invalid placeholder: Type is required')
      })
    })

    describe('updateDocumentWithPlaceholders', () => {
      const updateData = {
        title: 'Updated Document',
        placeholders: [mockPlaceholder]
      }

      it('should update document with valid placeholders', async () => {
        mockApiClient.put.mockResolvedValueOnce({
          success: true,
          data: { ...mockDocument, ...updateData },
          status: 200
        })

        const result = await documentService.updateDocumentWithPlaceholders('doc-123', updateData)

        expect(mockApiClient.put).toHaveBeenCalledWith('/documents/doc-123', updateData)
        expect(result).toEqual({ ...mockDocument, ...updateData })
      })
    })
  })

  describe('Placeholder Data Validation', () => {
    describe('validatePlaceholderData', () => {
      it('should validate placeholder with valid data', () => {
        expect(() => documentService.validatePlaceholderData(mockPlaceholder)).not.toThrow()
      })

      it('should reject placeholder with empty ID', () => {
        const invalidPlaceholder = { ...mockPlaceholder, id: '' }
        expect(() => documentService.validatePlaceholderData(invalidPlaceholder))
          .toThrow('Invalid placeholder: ID cannot be empty')
      })

      it('should reject placeholder with missing type', () => {
        const invalidPlaceholder = { ...mockPlaceholder, type: null as any }
        expect(() => documentService.validatePlaceholderData(invalidPlaceholder))
          .toThrow('Invalid placeholder: Type is required')
      })

      it('should reject placeholder with negative position', () => {
        const invalidPlaceholder = { ...mockPlaceholder, position: -1 }
        expect(() => documentService.validatePlaceholderData(invalidPlaceholder))
          .toThrow('Invalid placeholder: Position cannot be negative')
      })

      it('should reject placeholder with missing data', () => {
        const invalidPlaceholder = { ...mockPlaceholder, data: null }
        expect(() => documentService.validatePlaceholderData(invalidPlaceholder))
          .toThrow('Invalid placeholder: Data is required')
      })
    })
  })

  describe('Placeholder Serialization', () => {
    describe('serializePlaceholders', () => {
      it('should serialize placeholders with string data', () => {
        const placeholders = [{
          ...mockPlaceholder,
          data: '{"label":"Sign here","required":true}'
        }]

        const result = documentService.serializePlaceholders(placeholders)

        expect(result[0].data).toEqual({ label: 'Sign here', required: true })
      })

      it('should keep object data unchanged', () => {
        const placeholders = [mockPlaceholder]

        const result = documentService.serializePlaceholders(placeholders)

        expect(result[0].data).toEqual(mockPlaceholder.data)
      })
    })

    describe('deserializePlaceholders', () => {
      it('should deserialize placeholders from API format', () => {
        const apiPlaceholders = [{
          id: 'placeholder-1',
          type: 'signature',
          data: '{"label":"Sign here","required":true}',
          position: 0
        }]

        const result = documentService.deserializePlaceholders(apiPlaceholders)

        expect(result[0]).toEqual({
          id: 'placeholder-1',
          type: 'signature',
          data: { label: 'Sign here', required: true },
          position: 0
        })
      })

      it('should handle object data', () => {
        const apiPlaceholders = [mockPlaceholder]

        const result = documentService.deserializePlaceholders(apiPlaceholders)

        expect(result[0]).toEqual(mockPlaceholder)
      })
    })
  })

  describe('Retry Operations', () => {
    describe('getDocumentsWithRetry', () => {
      it('should succeed on first attempt', async () => {
        mockApiClient.get.mockResolvedValueOnce({
          success: true,
          data: [mockDocument],
          status: 200
        })

        const result = await documentService.getDocumentsWithRetry(3)

        expect(mockApiClient.get).toHaveBeenCalledTimes(1)
        expect(result).toEqual([mockDocument])
      })

      it('should retry on failure and eventually succeed', async () => {
        mockApiClient.get
          .mockResolvedValueOnce({
            success: false,
            message: 'Server error',
            status: 500
          })
          .mockResolvedValueOnce({
            success: true,
            data: [mockDocument],
            status: 200
          })

        const result = await documentService.getDocumentsWithRetry(3)

        expect(mockApiClient.get).toHaveBeenCalledTimes(2)
        expect(result).toEqual([mockDocument])
      }, 10000) // Increase timeout for retry delays

      it('should fail after max attempts', async () => {
        mockApiClient.get
          .mockResolvedValueOnce({
            success: false,
            message: 'Server error',
            status: 500
          })
          .mockResolvedValueOnce({
            success: false,
            message: 'Server error',
            status: 500
          })
          .mockResolvedValueOnce({
            success: false,
            message: 'Server error',
            status: 500
          })

        await expect(documentService.getDocumentsWithRetry(3)).rejects.toThrow('Server error')
        expect(mockApiClient.get).toHaveBeenCalledTimes(3)
      }, 15000) // Increase timeout for retry delays
    })
  })

  describe('Bulk Operations', () => {
    describe('bulkCreateDocuments', () => {
      const bulkData = [
        { title: 'Doc 1', content: 'Content 1' },
        { title: 'Doc 2', content: 'Content 2' }
      ]

      it('should create multiple documents successfully', async () => {
        const bulkResult = { created: 2, failed: 0 }
        mockApiClient.post.mockResolvedValueOnce({
          success: true,
          data: bulkResult,
          status: 200
        })

        const result = await documentService.bulkCreateDocuments(bulkData)

        expect(mockApiClient.post).toHaveBeenCalledWith('/documents/bulk', { documents: bulkData })
        expect(result).toEqual(bulkResult)
      })

      it('should handle partial failures', async () => {
        const bulkResult = {
          created: 1,
          failed: 1,
          errors: ['Title already exists']
        }
        mockApiClient.post.mockResolvedValueOnce({
          success: true,
          data: bulkResult,
          status: 200
        })

        const result = await documentService.bulkCreateDocuments(bulkData)

        expect(result.created).toBe(1)
        expect(result.failed).toBe(1)
        expect(result.errors).toEqual(['Title already exists'])
      })
    })
  })

  describe('Search Operations', () => {
    describe('searchDocuments', () => {
      const searchParams = {
        query: 'test',
        status: 'draft' as const,
        authorId: 'user-123'
      }

      it('should search documents with all parameters', async () => {
        mockApiClient.get.mockResolvedValueOnce({
          success: true,
          data: [mockDocument],
          status: 200
        })

        const result = await documentService.searchDocuments(searchParams)

        expect(mockApiClient.get).toHaveBeenCalledWith(
          '/documents/search?query=test&status=draft&authorId=user-123'
        )
        expect(result).toEqual([mockDocument])
      })

      it('should search with partial parameters', async () => {
        mockApiClient.get.mockResolvedValueOnce({
          success: true,
          data: [mockDocument],
          status: 200
        })

        await documentService.searchDocuments({ query: 'test' })

        expect(mockApiClient.get).toHaveBeenCalledWith('/documents/search?query=test')
      })

      it('should handle empty search results', async () => {
        mockApiClient.get.mockResolvedValueOnce({
          success: true,
          data: [],
          status: 200
        })

        const result = await documentService.searchDocuments({ query: 'nonexistent' })

        expect(result).toEqual([])
      })
    })

    describe('advancedSearch', () => {
      const searchParams = {
        query: 'advanced test',
        documentType: 'report',
        createdBy: 'user-123',
        sortBy: 'relevance' as const,
        limit: 10,
        highlight: true,
        fuzzy: true
      }

      it('should perform advanced search successfully', async () => {
        const searchResponse = {
          results: [{
            document: mockDocument,
            relevance_score: 0.95,
            highlights: [{ field: 'title', content: 'Test Document' }],
            preview: 'Hello World...'
          }],
          total: 1,
          offset: 0,
          limit: 10,
          statistics: {
            total_matches: 1,
            search_time_ms: 15,
            document_type_breakdown: { report: 1 },
            query: 'advanced test',
            timestamp: '2023-01-01T00:00:00Z'
          }
        }

        mockApiClient.get.mockResolvedValueOnce(searchResponse)

        const result = await documentService.advancedSearch(searchParams)

        expect(mockApiClient.get).toHaveBeenCalledWith(
          expect.stringContaining('/documents/advanced-search?')
        )
        expect(result).toEqual(searchResponse)
      })

      it('should handle wrapped response format', async () => {
        const searchResponse = {
          results: [{ document: mockDocument, relevance_score: 0.9, highlights: [] }],
          total: 1,
          offset: 0,
          limit: 10
        }

        mockApiClient.get.mockResolvedValueOnce({
          success: true,
          data: searchResponse,
          status: 200
        })

        const result = await documentService.advancedSearch(searchParams)

        expect(result).toEqual(searchResponse)
      })

      it('should handle search errors gracefully', async () => {
        mockApiClient.get.mockRejectedValueOnce(new Error('Search service unavailable'))

        await expect(documentService.advancedSearch(searchParams))
          .rejects.toThrow('Search service unavailable')
      })

      it('should build correct query string for all parameters', async () => {
        const fullParams = {
          query: 'test query',
          documentType: 'policy',
          createdBy: 'user-456',
          createdAfter: '2023-01-01',
          createdBefore: '2023-12-31',
          sortBy: 'created_at' as const,
          sortOrder: 'desc' as const,
          limit: 20,
          offset: 40,
          highlight: true,
          contextLength: 100,
          searchPlaceholders: true,
          fuzzy: false,
          includeStats: true
        }

        mockApiClient.get.mockResolvedValueOnce({
          results: [],
          total: 0,
          offset: 40,
          limit: 20
        })

        await documentService.advancedSearch(fullParams)

        const expectedParams = [
          'query=test%20query',
          'document_type=policy',
          'created_by=user-456',
          'created_after=2023-01-01',
          'created_before=2023-12-31',
          'sort_by=created_at',
          'sort_order=desc',
          'limit=20',
          'offset=40',
          'highlight=true',
          'context_length=100',
          'search_placeholders=true',
          'fuzzy=false',
          'include_stats=true'
        ].join('&')

        expect(mockApiClient.get).toHaveBeenCalledWith(
          `/documents/advanced-search?${expectedParams}`
        )
      })
    })
  })

  describe('Error Handling Edge Cases', () => {
    it('should handle undefined API response', async () => {
      mockApiClient.get.mockResolvedValueOnce(undefined as any)

      await expect(documentService.getDocuments()).rejects.toThrow('Failed to get documents')
    })

    it('should handle null API response', async () => {
      mockApiClient.get.mockResolvedValueOnce(null as any)

      await expect(documentService.getDocuments()).rejects.toThrow('Failed to get documents')
    })

    it('should handle response without success field', async () => {
      mockApiClient.get.mockResolvedValueOnce({
        data: [mockDocument],
        status: 200
      } as any)

      await expect(documentService.getDocuments()).rejects.toThrow('Failed to get documents')
    })
  })

  describe('Performance and Memory', () => {
    it('should handle large document sets efficiently', async () => {
      const largeDocumentSet = Array.from({ length: 1000 }, (_, i) => ({
        ...mockDocument,
        id: `doc-${i}`,
        title: `Document ${i}`
      }))

      mockApiClient.get.mockResolvedValueOnce({
        success: true,
        data: largeDocumentSet,
        status: 200
      })

      const startTime = Date.now()
      const result = await documentService.getDocuments()
      const endTime = Date.now()

      expect(result).toHaveLength(1000)
      expect(endTime - startTime).toBeLessThan(100) // Should be fast
    })

    it('should handle documents with large content efficiently', async () => {
      const largeContent = JSON.stringify({
        ops: Array.from({ length: 10000 }, (_, i) => ({ insert: `Content block ${i} ` }))
      })

      const largeDocument = { ...mockDocument, content: largeContent }

      mockApiClient.get.mockResolvedValueOnce({
        success: true,
        data: largeDocument,
        status: 200
      })

      const result = await documentService.getDocument('large-doc')

      expect(result.content).toBe(largeContent)
      expect(result.content.length).toBeGreaterThan(100000)
    })
  })
})