/**
 * Enhanced comprehensive test suite for Document Store
 */
import { renderHook, act } from '@testing-library/react'
import { useDocumentStore } from '../../stores/documentStore'
import type { Document, CreateDocumentData, PlaceholderObject } from '../../types'

describe('DocumentStore Enhanced Tests', () => {
  const mockDocument: Document = {
    id: 'doc-123',
    title: 'Test Document',
    content: '{"ops":[{"insert":"Hello World"}]}',
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
    version: 1,
    status: 'draft'
  }

  const mockCreateData: CreateDocumentData = {
    title: 'New Document',
    content: '{"ops":[{"insert":"New content"}]}'
  }

  beforeEach(() => {
    const { result } = renderHook(() => useDocumentStore())
    act(() => {
      result.current.clearStore()
    })
  })

  describe('Basic State Management', () => {
    it('should initialize with empty state', () => {
      const { result } = renderHook(() => useDocumentStore())

      expect(result.current.documents).toEqual([])
      expect(result.current.currentDocument).toBeNull()
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.isDirty).toBe(false)
    })

    it('should set documents correctly', () => {
      const { result } = renderHook(() => useDocumentStore())
      const documents = [mockDocument]

      act(() => {
        result.current.setDocuments(documents)
      })

      expect(result.current.documents).toEqual(documents)
    })

    it('should set current document and clear dirty flag', () => {
      const { result } = renderHook(() => useDocumentStore())

      act(() => {
        result.current.setCurrentDocument(mockDocument)
      })

      expect(result.current.currentDocument).toEqual(mockDocument)
      expect(result.current.isDirty).toBe(false)
    })

    it('should set loading state', () => {
      const { result } = renderHook(() => useDocumentStore())

      act(() => {
        result.current.setLoading(true)
      })

      expect(result.current.isLoading).toBe(true)

      act(() => {
        result.current.setLoading(false)
      })

      expect(result.current.isLoading).toBe(false)
    })

    it('should set and clear error state', () => {
      const { result } = renderHook(() => useDocumentStore())
      const errorMessage = 'Test error'

      act(() => {
        result.current.setError(errorMessage)
      })

      expect(result.current.error).toBe(errorMessage)

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
    })
  })

  describe('Document CRUD Operations', () => {
    describe('createDocument', () => {
      it('should create new document with generated ID', () => {
        const { result } = renderHook(() => useDocumentStore())

        act(() => {
          result.current.createDocument(mockCreateData)
        })

        expect(result.current.documents).toHaveLength(1)
        expect(result.current.currentDocument).not.toBeNull()
        expect(result.current.currentDocument!.title).toBe(mockCreateData.title)
        expect(result.current.currentDocument!.content).toBe(mockCreateData.content)
        expect(result.current.currentDocument!.id).toMatch(/^doc-\d+-\w+$/)
        expect(result.current.currentDocument!.version).toBe(1)
        expect(result.current.currentDocument!.status).toBe('draft')
        expect(result.current.isDirty).toBe(false)
      })

      it('should generate unique IDs for multiple documents', () => {
        const { result } = renderHook(() => useDocumentStore())

        act(() => {
          result.current.createDocument(mockCreateData)
          result.current.createDocument({ ...mockCreateData, title: 'Document 2' })
        })

        const ids = result.current.documents.map(doc => doc.id)
        expect(new Set(ids).size).toBe(2) // All IDs should be unique
      })
    })

    describe('updateDocumentContent', () => {
      it('should update content and set dirty flag', () => {
        const { result } = renderHook(() => useDocumentStore())
        const newDelta = [{ insert: 'Updated content' }]

        act(() => {
          result.current.setCurrentDocument(mockDocument)
          result.current.updateDocumentContent(newDelta)
        })

        expect(result.current.currentDocument!.content).toBe(JSON.stringify(newDelta))
        expect(result.current.isDirty).toBe(true)
        expect(result.current.currentDocument!.updatedAt).not.toEqual(mockDocument.updatedAt)
      })

      it('should not update when no current document', () => {
        const { result } = renderHook(() => useDocumentStore())
        const newDelta = [{ insert: 'Updated content' }]

        act(() => {
          result.current.updateDocumentContent(newDelta)
        })

        expect(result.current.currentDocument).toBeNull()
        expect(result.current.isDirty).toBe(false)
      })
    })

    describe('updateDocumentMetadata', () => {
      it('should update metadata and sync with documents list', () => {
        const { result } = renderHook(() => useDocumentStore())
        const updates = { title: 'Updated Title', status: 'published' as const }

        act(() => {
          result.current.setDocuments([mockDocument])
          result.current.setCurrentDocument(mockDocument)
          result.current.updateDocumentMetadata(updates)
        })

        expect(result.current.currentDocument!.title).toBe('Updated Title')
        expect(result.current.currentDocument!.status).toBe('published')
        expect(result.current.documents[0].title).toBe('Updated Title')
        expect(result.current.documents[0].status).toBe('published')
        expect(result.current.isDirty).toBe(true)
      })

      it('should not update when no current document', () => {
        const { result } = renderHook(() => useDocumentStore())

        act(() => {
          result.current.updateDocumentMetadata({ title: 'New Title' })
        })

        expect(result.current.currentDocument).toBeNull()
      })
    })

    describe('saveDocument', () => {
      it('should save document and clear dirty flag', () => {
        const { result } = renderHook(() => useDocumentStore())

        act(() => {
          result.current.setDocuments([mockDocument])
          result.current.setCurrentDocument(mockDocument)
          result.current.updateDocumentContent([{ insert: 'Updated' }])
          result.current.saveDocument()
        })

        expect(result.current.currentDocument!.version).toBe(mockDocument.version + 1)
        expect(result.current.isDirty).toBe(false)
        expect(result.current.documents[0].version).toBe(mockDocument.version + 1)
      })

      it('should not save when not dirty', () => {
        const { result } = renderHook(() => useDocumentStore())
        const originalVersion = mockDocument.version

        act(() => {
          result.current.setCurrentDocument(mockDocument)
          result.current.saveDocument()
        })

        expect(result.current.currentDocument!.version).toBe(originalVersion)
      })

      it('should not save when no current document', () => {
        const { result } = renderHook(() => useDocumentStore())

        act(() => {
          result.current.saveDocument()
        })

        expect(result.current.currentDocument).toBeNull()
      })
    })

    describe('deleteDocument', () => {
      it('should delete document from list and clear current if deleted', () => {
        const { result } = renderHook(() => useDocumentStore())
        const doc2 = { ...mockDocument, id: 'doc-456', title: 'Document 2' }

        act(() => {
          result.current.setDocuments([mockDocument, doc2])
          result.current.setCurrentDocument(mockDocument)
          result.current.deleteDocument(mockDocument.id)
        })

        expect(result.current.documents).toHaveLength(1)
        expect(result.current.documents[0].id).toBe('doc-456')
        expect(result.current.currentDocument).toBeNull()
        expect(result.current.isDirty).toBe(false)
      })

      it('should delete document but keep current if different', () => {
        const { result } = renderHook(() => useDocumentStore())
        const doc2 = { ...mockDocument, id: 'doc-456', title: 'Document 2' }

        act(() => {
          result.current.setDocuments([mockDocument, doc2])
          result.current.setCurrentDocument(doc2)
          result.current.deleteDocument(mockDocument.id)
        })

        expect(result.current.documents).toHaveLength(1)
        expect(result.current.documents[0].id).toBe('doc-456')
        expect(result.current.currentDocument!.id).toBe('doc-456')
      })
    })
  })

  describe('Document List Management', () => {
    describe('loadDocumentById', () => {
      it('should load document by ID and set as current', () => {
        const { result } = renderHook(() => useDocumentStore())
        const doc2 = { ...mockDocument, id: 'doc-456', title: 'Document 2' }

        act(() => {
          result.current.setDocuments([mockDocument, doc2])
          result.current.loadDocumentById('doc-456')
        })

        expect(result.current.currentDocument).toEqual(doc2)
        expect(result.current.isDirty).toBe(false)
      })

      it('should not change current document if ID not found', () => {
        const { result } = renderHook(() => useDocumentStore())

        act(() => {
          result.current.setDocuments([mockDocument])
          result.current.setCurrentDocument(mockDocument)
          result.current.loadDocumentById('nonexistent')
        })

        expect(result.current.currentDocument).toEqual(mockDocument)
      })
    })

    describe('getAllDocuments', () => {
      it('should return all documents', () => {
        const { result } = renderHook(() => useDocumentStore())
        const documents = [mockDocument, { ...mockDocument, id: 'doc-456' }]

        act(() => {
          result.current.setDocuments(documents)
        })

        expect(result.current.getAllDocuments()).toEqual(documents)
      })
    })
  })

  describe('Quill Delta Integration', () => {
    describe('getDocumentDelta', () => {
      it('should return parsed delta from current document', () => {
        const { result } = renderHook(() => useDocumentStore())
        const delta = [{ insert: 'Hello ' }, { insert: 'World', attributes: { bold: true } }]
        const document = { ...mockDocument, content: JSON.stringify(delta) }

        act(() => {
          result.current.setCurrentDocument(document)
        })

        expect(result.current.getDocumentDelta()).toEqual(delta)
      })

      it('should return empty array when no current document', () => {
        const { result } = renderHook(() => useDocumentStore())

        expect(result.current.getDocumentDelta()).toEqual([])
      })

      it('should handle plain text content as fallback', () => {
        const { result } = renderHook(() => useDocumentStore())
        const document = { ...mockDocument, content: 'Plain text' }

        act(() => {
          result.current.setCurrentDocument(document)
        })

        expect(result.current.getDocumentDelta()).toEqual([{ insert: 'Plain text' }])
      })
    })

    describe('setDocumentDelta', () => {
      it('should update document content via updateDocumentContent', () => {
        const { result } = renderHook(() => useDocumentStore())
        const delta = [{ insert: 'New delta content' }]

        act(() => {
          result.current.setCurrentDocument(mockDocument)
          result.current.setDocumentDelta(delta)
        })

        expect(result.current.currentDocument!.content).toBe(JSON.stringify(delta))
        expect(result.current.isDirty).toBe(true)
      })
    })
  })

  describe('Store Utilities', () => {
    describe('getDocumentStats', () => {
      it('should return correct statistics', () => {
        const { result } = renderHook(() => useDocumentStore())
        const documents = [
          { ...mockDocument, status: 'draft' },
          { ...mockDocument, id: 'doc-2', status: 'published' },
          { ...mockDocument, id: 'doc-3', status: 'published' },
          { ...mockDocument, id: 'doc-4', status: 'archived' }
        ]

        act(() => {
          result.current.setDocuments(documents)
        })

        const stats = result.current.getDocumentStats()

        expect(stats.totalDocuments).toBe(4)
        expect(stats.draftDocuments).toBe(1)
        expect(stats.publishedDocuments).toBe(2)
        expect(stats.archivedDocuments).toBe(1)
      })

      it('should return zero stats for empty store', () => {
        const { result } = renderHook(() => useDocumentStore())

        const stats = result.current.getDocumentStats()

        expect(stats.totalDocuments).toBe(0)
        expect(stats.draftDocuments).toBe(0)
        expect(stats.publishedDocuments).toBe(0)
        expect(stats.archivedDocuments).toBe(0)
      })
    })

    describe('clearStore', () => {
      it('should reset all state to initial values', () => {
        const { result } = renderHook(() => useDocumentStore())

        act(() => {
          result.current.setDocuments([mockDocument])
          result.current.setCurrentDocument(mockDocument)
          result.current.setLoading(true)
          result.current.setError('Test error')
          result.current.updateDocumentContent([{ insert: 'Updated' }])
          result.current.clearStore()
        })

        expect(result.current.documents).toEqual([])
        expect(result.current.currentDocument).toBeNull()
        expect(result.current.isLoading).toBe(false)
        expect(result.current.error).toBeNull()
        expect(result.current.isDirty).toBe(false)
      })
    })

    describe('exportState and importState', () => {
      it('should export and import state correctly', () => {
        const { result } = renderHook(() => useDocumentStore())
        const documents = [mockDocument]

        act(() => {
          result.current.setDocuments(documents)
          result.current.setCurrentDocument(mockDocument)
        })

        const exportedState = result.current.exportState()

        act(() => {
          result.current.clearStore()
          result.current.importState(exportedState)
        })

        expect(result.current.documents).toEqual(documents)
        expect(result.current.currentDocument).toEqual(mockDocument)
        expect(result.current.isDirty).toBe(false)
      })
    })
  })

  describe('Placeholder Management', () => {
    const mockPlaceholder: PlaceholderObject = {
      id: 'placeholder-1',
      type: 'signature',
      data: { label: 'Sign here', required: true },
      position: 0
    }

    describe('getPlaceholderObjects', () => {
      it('should extract placeholders from document content', () => {
        const { result } = renderHook(() => useDocumentStore())
        const contentWithPlaceholder = JSON.stringify([
          { insert: 'Before placeholder' },
          { insert: { signature: mockPlaceholder.data } },
          { insert: 'After placeholder' }
        ])
        const document = { ...mockDocument, content: contentWithPlaceholder }

        act(() => {
          result.current.setCurrentDocument(document)
        })

        const placeholders = result.current.getPlaceholderObjects()

        expect(placeholders).toHaveLength(1)
        expect(placeholders[0]).toEqual({
          id: 'signature-1',
          type: 'signature',
          data: mockPlaceholder.data,
          position: 1
        })
      })

      it('should return empty array when no current document', () => {
        const { result } = renderHook(() => useDocumentStore())

        expect(result.current.getPlaceholderObjects()).toEqual([])
      })

      it('should extract multiple different placeholder types', () => {
        const { result } = renderHook(() => useDocumentStore())
        const contentWithPlaceholders = JSON.stringify([
          { insert: { 'version-table': { version: '1.0', date: '2023-01-01', author: 'Test' } } },
          { insert: { signature: { label: 'Sign here' } } },
          { insert: { 'long-response': { label: 'Response', lines: 5 } } },
          { insert: { 'line-segment': { label: 'Line', length: 'medium' } } }
        ])
        const document = { ...mockDocument, content: contentWithPlaceholders }

        act(() => {
          result.current.setCurrentDocument(document)
        })

        const placeholders = result.current.getPlaceholderObjects()

        expect(placeholders).toHaveLength(4)
        expect(placeholders[0].type).toBe('version-table')
        expect(placeholders[1].type).toBe('signature')
        expect(placeholders[2].type).toBe('long-response')
        expect(placeholders[3].type).toBe('line-segment')
      })
    })

    describe('insertPlaceholder', () => {
      it('should insert placeholder at specified position', () => {
        const { result } = renderHook(() => useDocumentStore())
        const initialDelta = [{ insert: 'Before' }, { insert: 'After' }]
        const document = { ...mockDocument, content: JSON.stringify(initialDelta) }

        act(() => {
          result.current.setCurrentDocument(document)
          result.current.insertPlaceholder('signature', mockPlaceholder.data, 1)
        })

        const newDelta = result.current.getDocumentDelta()
        expect(newDelta).toHaveLength(3)
        expect(newDelta[1]).toEqual({ insert: { signature: mockPlaceholder.data } })
        expect(result.current.isDirty).toBe(true)
      })

      it('should append placeholder when no position specified', () => {
        const { result } = renderHook(() => useDocumentStore())
        const initialDelta = [{ insert: 'Content' }]
        const document = { ...mockDocument, content: JSON.stringify(initialDelta) }

        act(() => {
          result.current.setCurrentDocument(document)
          result.current.insertPlaceholder('signature', mockPlaceholder.data)
        })

        const newDelta = result.current.getDocumentDelta()
        expect(newDelta).toHaveLength(2)
        expect(newDelta[1]).toEqual({ insert: { signature: mockPlaceholder.data } })
      })

      it('should not insert when no current document', () => {
        const { result } = renderHook(() => useDocumentStore())

        act(() => {
          result.current.insertPlaceholder('signature', mockPlaceholder.data)
        })

        expect(result.current.currentDocument).toBeNull()
      })
    })

    describe('updatePlaceholder', () => {
      it('should update existing placeholder', () => {
        const { result } = renderHook(() => useDocumentStore())
        const contentWithPlaceholder = JSON.stringify([
          { insert: { signature: { id: 'sig-1', label: 'Original' } } }
        ])
        const document = { ...mockDocument, content: contentWithPlaceholder }

        act(() => {
          result.current.setCurrentDocument(document)
          result.current.updatePlaceholder('sig-1', { label: 'Updated', required: true })
        })

        const newDelta = result.current.getDocumentDelta()
        expect(newDelta[0].insert.signature).toEqual({
          id: 'sig-1',
          label: 'Updated',
          required: true
        })
      })

      it('should update placeholder by position-based ID', () => {
        const { result } = renderHook(() => useDocumentStore())
        const contentWithPlaceholder = JSON.stringify([
          { insert: { signature: { label: 'Original' } } }
        ])
        const document = { ...mockDocument, content: contentWithPlaceholder }

        act(() => {
          result.current.setCurrentDocument(document)
          result.current.updatePlaceholder('signature-0', { label: 'Updated' })
        })

        const newDelta = result.current.getDocumentDelta()
        expect(newDelta[0].insert.signature).toEqual({
          id: 'signature-0',
          label: 'Updated'
        })
      })
    })

    describe('removePlaceholder', () => {
      it('should remove placeholder by ID', () => {
        const { result } = renderHook(() => useDocumentStore())
        const contentWithPlaceholders = JSON.stringify([
          { insert: 'Before' },
          { insert: { signature: { id: 'sig-1', label: 'Sign here' } } },
          { insert: 'After' }
        ])
        const document = { ...mockDocument, content: contentWithPlaceholders }

        act(() => {
          result.current.setCurrentDocument(document)
          result.current.removePlaceholder('sig-1')
        })

        const newDelta = result.current.getDocumentDelta()
        expect(newDelta).toHaveLength(2)
        expect(newDelta[0]).toEqual({ insert: 'Before' })
        expect(newDelta[1]).toEqual({ insert: 'After' })
      })

      it('should not remove version-table placeholders', () => {
        const { result } = renderHook(() => useDocumentStore())
        const contentWithVersionTable = JSON.stringify([
          { insert: { 'version-table': { id: 'vt-1', version: '1.0' } } }
        ])
        const document = { ...mockDocument, content: contentWithVersionTable }

        act(() => {
          result.current.setCurrentDocument(document)
          result.current.removePlaceholder('vt-1')
        })

        const newDelta = result.current.getDocumentDelta()
        expect(newDelta).toHaveLength(1) // Should not be removed
      })
    })

    describe('canDeletePlaceholder', () => {
      it('should return false for version-table placeholders', () => {
        const { result } = renderHook(() => useDocumentStore())
        const contentWithVersionTable = JSON.stringify([
          { insert: { 'version-table': { version: '1.0' } } }
        ])
        const document = { ...mockDocument, content: contentWithVersionTable }

        act(() => {
          result.current.setCurrentDocument(document)
        })

        expect(result.current.canDeletePlaceholder('version-table-0')).toBe(false)
      })

      it('should return true for other placeholder types', () => {
        const { result } = renderHook(() => useDocumentStore())
        const contentWithSignature = JSON.stringify([
          { insert: { signature: { label: 'Sign here' } } }
        ])
        const document = { ...mockDocument, content: contentWithSignature }

        act(() => {
          result.current.setCurrentDocument(document)
        })

        expect(result.current.canDeletePlaceholder('signature-0')).toBe(true)
      })
    })

    describe('validatePlaceholderData', () => {
      it('should validate version-table data', () => {
        const { result } = renderHook(() => useDocumentStore())

        const validData = { version: '1.0', date: '2023-01-01', author: 'Test' }
        const validResult = result.current.validatePlaceholderData('version-table', validData)
        expect(validResult.isValid).toBe(true)
        expect(validResult.errors).toEqual([])

        const invalidData = { version: '', date: '2023-01-01' }
        const invalidResult = result.current.validatePlaceholderData('version-table', invalidData)
        expect(invalidResult.isValid).toBe(false)
        expect(invalidResult.errors).toContain('Version is required')
        expect(invalidResult.errors).toContain('Author is required')
      })

      it('should validate signature data', () => {
        const { result } = renderHook(() => useDocumentStore())

        const validData = { label: 'Sign here', required: true }
        const validResult = result.current.validatePlaceholderData('signature', validData)
        expect(validResult.isValid).toBe(true)

        const invalidData = { required: 'not-boolean' }
        const invalidResult = result.current.validatePlaceholderData('signature', invalidData)
        expect(invalidResult.isValid).toBe(false)
        expect(invalidResult.errors).toContain('Required field must be boolean')
      })

      it('should validate long-response data', () => {
        const { result } = renderHook(() => useDocumentStore())

        const validData = { label: 'Response', placeholder: 'Enter response', minLength: 10, maxLength: 100 }
        const validResult = result.current.validatePlaceholderData('long-response', validData)
        expect(validResult.isValid).toBe(true)

        const invalidData = { minLength: 100, maxLength: 50 }
        const invalidResult = result.current.validatePlaceholderData('long-response', invalidData)
        expect(invalidResult.isValid).toBe(false)
        expect(invalidResult.errors).toContain('Label is required')
        expect(invalidResult.errors).toContain('Placeholder text is required')
        expect(invalidResult.errors).toContain('Maximum length must be greater than minimum length')
      })

      it('should validate line-segment data', () => {
        const { result } = renderHook(() => useDocumentStore())

        const validData = { label: 'Line', type: 'medium' }
        const validResult = result.current.validatePlaceholderData('line-segment', validData)
        expect(validResult.isValid).toBe(true)

        const invalidData = { type: 'invalid-length' }
        const invalidResult = result.current.validatePlaceholderData('line-segment', invalidData)
        expect(invalidResult.isValid).toBe(false)
        expect(invalidResult.errors).toContain('Invalid length value')
      })
    })

    describe('getPlaceholderStats', () => {
      it('should return correct placeholder statistics', () => {
        const { result } = renderHook(() => useDocumentStore())
        const contentWithPlaceholders = JSON.stringify([
          { insert: { 'version-table': { version: '1.0' } } },
          { insert: { signature: { label: 'Sign 1' } } },
          { insert: { signature: { label: 'Sign 2' } } },
          { insert: { 'long-response': { label: 'Response' } } }
        ])
        const document = { ...mockDocument, content: contentWithPlaceholders }

        act(() => {
          result.current.setCurrentDocument(document)
        })

        const stats = result.current.getPlaceholderStats()

        expect(stats.totalPlaceholders).toBe(4)
        expect(stats.versionTables).toBe(1)
        expect(stats.signatures).toBe(2)
        expect(stats.longResponses).toBe(1)
        expect(stats.lineSegments).toBe(0)
      })
    })
  })

  describe('Legacy Actions Compatibility', () => {
    describe('addDocument', () => {
      it('should add document to store', () => {
        const { result } = renderHook(() => useDocumentStore())

        act(() => {
          result.current.addDocument(mockDocument)
        })

        expect(result.current.documents).toContain(mockDocument)
      })
    })

    describe('updateDocument', () => {
      it('should update document in store and current document if same ID', () => {
        const { result } = renderHook(() => useDocumentStore())
        const updates = { title: 'Updated Title' }

        act(() => {
          result.current.setDocuments([mockDocument])
          result.current.setCurrentDocument(mockDocument)
          result.current.updateDocument(mockDocument.id, updates)
        })

        expect(result.current.documents[0].title).toBe('Updated Title')
        expect(result.current.currentDocument!.title).toBe('Updated Title')
        expect(result.current.documents[0].updatedAt).not.toEqual(mockDocument.updatedAt)
      })

      it('should update only in documents list if different current document', () => {
        const { result } = renderHook(() => useDocumentStore())
        const doc2 = { ...mockDocument, id: 'doc-456', title: 'Document 2' }
        const updates = { title: 'Updated Title' }

        act(() => {
          result.current.setDocuments([mockDocument, doc2])
          result.current.setCurrentDocument(doc2)
          result.current.updateDocument(mockDocument.id, updates)
        })

        expect(result.current.documents[0].title).toBe('Updated Title')
        expect(result.current.currentDocument!.title).toBe('Document 2')
      })
    })

    describe('removeDocument', () => {
      it('should remove document and clear current if same ID', () => {
        const { result } = renderHook(() => useDocumentStore())

        act(() => {
          result.current.setDocuments([mockDocument])
          result.current.setCurrentDocument(mockDocument)
          result.current.removeDocument(mockDocument.id)
        })

        expect(result.current.documents).toHaveLength(0)
        expect(result.current.currentDocument).toBeNull()
      })
    })
  })

  describe('Performance and Edge Cases', () => {
    it('should handle large numbers of documents efficiently', () => {
      const { result } = renderHook(() => useDocumentStore())
      const largeDocumentSet = Array.from({ length: 1000 }, (_, i) => ({
        ...mockDocument,
        id: `doc-${i}`,
        title: `Document ${i}`
      }))

      const startTime = Date.now()

      act(() => {
        result.current.setDocuments(largeDocumentSet)
      })

      const endTime = Date.now()

      expect(result.current.documents).toHaveLength(1000)
      expect(endTime - startTime).toBeLessThan(100) // Should be fast
    })

    it('should handle documents with complex placeholder content', () => {
      const { result } = renderHook(() => useDocumentStore())
      const complexContent = JSON.stringify([
        { insert: 'Complex document with ' },
        { insert: { 'version-table': { version: '2.0', date: '2023-01-01', author: 'Admin' } } },
        { insert: '\nContent with multiple ' },
        { insert: { signature: { label: 'CEO Signature', required: true, includeDate: true } } },
        { insert: ' and ' },
        { insert: { 'long-response': { label: 'Detailed Response', lines: 10, maxLength: 1000 } } },
        { insert: '\nFinal section with ' },
        { insert: { 'line-segment': { label: 'Approval Line', length: 'long' } } }
      ])
      const complexDocument = { ...mockDocument, content: complexContent }

      act(() => {
        result.current.setCurrentDocument(complexDocument)
      })

      const placeholders = result.current.getPlaceholderObjects()
      expect(placeholders).toHaveLength(4)

      const stats = result.current.getPlaceholderStats()
      expect(stats.totalPlaceholders).toBe(4)
      expect(stats.versionTables).toBe(1)
      expect(stats.signatures).toBe(1)
      expect(stats.longResponses).toBe(1)
      expect(stats.lineSegments).toBe(1)
    })

    it('should handle malformed content gracefully', () => {
      const { result } = renderHook(() => useDocumentStore())
      const malformedDocument = { ...mockDocument, content: 'not-json' }

      act(() => {
        result.current.setCurrentDocument(malformedDocument)
      })

      const delta = result.current.getDocumentDelta()
      expect(delta).toEqual([{ insert: 'not-json' }])

      const placeholders = result.current.getPlaceholderObjects()
      expect(placeholders).toEqual([])
    })
  })
})