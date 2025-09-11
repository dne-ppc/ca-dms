import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useDocumentStore } from '../../stores/documentStore'
import { createMockDocument, createMockDelta, createComplexMockDelta, deltaToString } from '../utils'
import type { CreateDocumentData, DocumentMetadataUpdate } from '../../types'
import type { DeltaOperation } from 'quill'

describe('DocumentStore - Task 3.1.1: Document Store Foundation', () => {
  beforeEach(() => {
    // Reset the store state before each test
    const { result } = renderHook(() => useDocumentStore())
    act(() => {
      result.current.clearStore()
    })
  })

  describe('Store Initialization', () => {
    it('should initialize with empty state', () => {
      const { result } = renderHook(() => useDocumentStore())
      const state = result.current

      expect(state.currentDocument).toBeNull()
      expect(state.documents).toEqual([])
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeNull()
      expect(state.isDirty).toBe(false)
    })

    it('should provide correct initial state structure', () => {
      const { result } = renderHook(() => useDocumentStore())
      const state = result.current

      // Verify all required state properties exist
      expect(typeof state.currentDocument).toBe('object')
      expect(Array.isArray(state.documents)).toBe(true)
      expect(typeof state.isLoading).toBe('boolean')
      expect(typeof state.isDirty).toBe('boolean')
      expect(state.error === null || typeof state.error === 'string').toBe(true)
    })
  })

  describe('Document Loading', () => {
    it('should set current document', () => {
      const { result } = renderHook(() => useDocumentStore())
      
      const testDocument = createMockDocument({
        id: 'doc-1',
        title: 'Test Document',
        content: deltaToString(createMockDelta())
      })

      act(() => {
        result.current.setCurrentDocument(testDocument)
      })

      expect(result.current.currentDocument).toEqual(testDocument)
      expect(result.current.isDirty).toBe(false)
    })

    it('should handle loading state during document operations', () => {
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

    it('should handle error states', () => {
      const { result } = renderHook(() => useDocumentStore())
      const errorMessage = 'Failed to load document'

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
    it('should create new document', () => {
      const { result } = renderHook(() => useDocumentStore())
      
      const documentData: CreateDocumentData = {
        title: 'New Document',
        content: deltaToString(createMockDelta())
      }

      act(() => {
        result.current.createDocument(documentData)
      })

      const currentDoc = result.current.currentDocument
      expect(currentDoc).not.toBeNull()
      expect(currentDoc!.title).toBe(documentData.title)
      expect(currentDoc!.content).toEqual(documentData.content)
      expect(currentDoc!.id).toBeTruthy()
      expect(currentDoc!.status).toBe('draft')
      expect(currentDoc!.version).toBe(1)
      expect(result.current.isDirty).toBe(false)
    })

    it('should update document content', () => {
      const { result } = renderHook(() => useDocumentStore())
      
      // Create initial document
      const initialData: CreateDocumentData = {
        title: 'Initial Document',
        content: deltaToString(createMockDelta())
      }

      act(() => {
        result.current.createDocument(initialData)
      })

      const updatedContent: DeltaOperation[] = [
        { insert: 'Updated content\n' }
      ]

      act(() => {
        result.current.updateDocumentContent(updatedContent)
      })

      expect(result.current.currentDocument!.content).toEqual(deltaToString(updatedContent))
      expect(result.current.isDirty).toBe(true)
    })

    it('should update document metadata', () => {
      const { result } = renderHook(() => useDocumentStore())
      
      const initialData: CreateDocumentData = {
        title: 'Initial Document',
        content: deltaToString(createMockDelta())
      }

      act(() => {
        result.current.createDocument(initialData)
      })

      const updates: DocumentMetadataUpdate = {
        title: 'Updated Title',
        status: 'published'
      }

      act(() => {
        result.current.updateDocumentMetadata(updates)
      })

      expect(result.current.currentDocument!.title).toBe(updates.title)
      expect(result.current.currentDocument!.status).toBe(updates.status)
      expect(result.current.isDirty).toBe(true)
    })

    it('should save document and clear dirty flag', () => {
      const { result } = renderHook(() => useDocumentStore())
      
      const documentData: CreateDocumentData = {
        title: 'Test Document',
        content: deltaToString(createMockDelta())
      }

      act(() => {
        result.current.createDocument(documentData)
      })

      // Make some changes
      act(() => {
        result.current.updateDocumentContent([{ insert: 'Modified\n' }])
      })

      expect(result.current.isDirty).toBe(true)

      act(() => {
        result.current.saveDocument()
      })

      expect(result.current.isDirty).toBe(false)
      expect(result.current.currentDocument!.version).toBe(2)
    })

    it('should delete document', () => {
      const { result } = renderHook(() => useDocumentStore())
      
      const documentData: CreateDocumentData = {
        title: 'Document to Delete',
        content: deltaToString(createMockDelta())
      }

      act(() => {
        result.current.createDocument(documentData)
      })

      const docId = result.current.currentDocument!.id

      act(() => {
        result.current.deleteDocument(docId)
      })

      expect(result.current.currentDocument).toBeNull()
      expect(result.current.documents.find(d => d.id === docId)).toBeUndefined()
    })
  })

  describe('Document List Management', () => {
    it('should manage multiple documents', () => {
      const { result } = renderHook(() => useDocumentStore())

      // Create multiple documents
      const docs: CreateDocumentData[] = [
        { title: 'Doc 1', content: deltaToString(createMockDelta()) },
        { title: 'Doc 2', content: deltaToString(createComplexMockDelta()) },
        { title: 'Doc 3', content: deltaToString([{ insert: 'Third doc\n' }]) }
      ]

      docs.forEach(doc => {
        act(() => {
          result.current.createDocument(doc)
        })
      })

      expect(result.current.documents).toHaveLength(3)
      expect(result.current.documents.map(d => d.title)).toEqual(['Doc 1', 'Doc 2', 'Doc 3'])
    })

    it('should load document by ID', () => {
      const { result } = renderHook(() => useDocumentStore())

      // Create a document
      const docData: CreateDocumentData = { 
        title: 'Loadable Doc', 
        content: deltaToString(createMockDelta()) 
      }
      
      act(() => {
        result.current.createDocument(docData)
      })

      const docId = result.current.currentDocument!.id

      // Create another document (changes current)
      act(() => {
        result.current.createDocument({ 
          title: 'Other Doc', 
          content: deltaToString(createMockDelta()) 
        })
      })

      // Load the first document by ID
      act(() => {
        result.current.loadDocumentById(docId)
      })

      expect(result.current.currentDocument!.id).toBe(docId)
      expect(result.current.currentDocument!.title).toBe('Loadable Doc')
    })

    it('should get all documents list', () => {
      const { result } = renderHook(() => useDocumentStore())

      const docs: CreateDocumentData[] = [
        { title: 'Alpha', content: deltaToString(createMockDelta()) },
        { title: 'Beta', content: deltaToString(createMockDelta()) },
        { title: 'Gamma', content: deltaToString(createMockDelta()) }
      ]

      docs.forEach(doc => {
        act(() => {
          result.current.createDocument(doc)
        })
      })

      const allDocs = result.current.getAllDocuments()
      expect(allDocs).toHaveLength(3)
      expect(allDocs.every(doc => doc.id && doc.title && doc.content)).toBe(true)
    })
  })

  describe('Quill Delta Integration', () => {
    it('should handle complex Delta operations with custom blots', () => {
      const { result } = renderHook(() => useDocumentStore())

      const complexDelta = createComplexMockDelta()

      act(() => {
        result.current.createDocument({
          title: 'Complex Document',
          content: deltaToString(complexDelta)
        })
      })

      const doc = result.current.currentDocument!
      expect(doc.content).toEqual(deltaToString(complexDelta))
      
      // Test Quill Delta integration methods
      const retrievedDelta = result.current.getDocumentDelta()
      expect(retrievedDelta).toEqual(complexDelta)
    })

    it('should track content changes for auto-save', () => {
      const { result } = renderHook(() => useDocumentStore())

      act(() => {
        result.current.createDocument({
          title: 'Auto-save Test',
          content: deltaToString(createMockDelta())
        })
      })

      expect(result.current.isDirty).toBe(false)

      // Simulate Quill content change using setDocumentDelta
      const newDelta = [
        ...createMockDelta(),
        { insert: 'Added content\n' }
      ]

      act(() => {
        result.current.setDocumentDelta(newDelta)
      })

      expect(result.current.isDirty).toBe(true)
    })

    it('should provide document statistics', () => {
      const { result } = renderHook(() => useDocumentStore())

      // Create documents with different statuses
      act(() => {
        result.current.createDocument({
          title: 'Draft Doc',
          content: deltaToString(createMockDelta())
        })
      })

      act(() => {
        result.current.createDocument({
          title: 'Published Doc',
          content: deltaToString(createMockDelta())
        })
        result.current.updateDocumentMetadata({ status: 'published' })
      })

      const stats = result.current.getDocumentStats()
      expect(stats).toBeDefined()
      expect(stats.totalDocuments).toBe(2)
      expect(stats.draftDocuments).toBe(1)
      expect(stats.publishedDocuments).toBe(1)
      expect(stats.archivedDocuments).toBe(0)
    })
  })

  describe('Store Actions', () => {
    it('should clear entire store', () => {
      const { result } = renderHook(() => useDocumentStore())

      // Add some data
      act(() => {
        result.current.createDocument({ 
          title: 'Test', 
          content: deltaToString(createMockDelta()) 
        })
        result.current.setError('Some error')
      })

      expect(result.current.currentDocument).not.toBeNull()
      expect(result.current.error).not.toBeNull()

      act(() => {
        result.current.clearStore()
      })

      expect(result.current.currentDocument).toBeNull()
      expect(result.current.documents).toEqual([])
      expect(result.current.error).toBeNull()
      expect(result.current.isDirty).toBe(false)
    })

    it('should export/import store state', () => {
      const { result } = renderHook(() => useDocumentStore())

      // Create test data
      const testDocs: CreateDocumentData[] = [
        { title: 'Export Test 1', content: deltaToString(createMockDelta()) },
        { title: 'Export Test 2', content: deltaToString(createComplexMockDelta()) }
      ]

      testDocs.forEach(doc => {
        act(() => {
          result.current.createDocument(doc)
        })
      })

      const exportedState = result.current.exportState()
      expect(exportedState.documents).toHaveLength(2)

      // Clear and import
      act(() => {
        result.current.clearStore()
        result.current.importState(exportedState)
      })

      expect(result.current.documents).toHaveLength(2)
      expect(result.current.documents.map(d => d.title)).toEqual(['Export Test 1', 'Export Test 2'])
    })
  })

  // Legacy backward compatibility tests
  describe('Legacy Compatibility', () => {
    it('should support legacy addDocument method', () => {
      const { result } = renderHook(() => useDocumentStore())
      
      const mockDoc = createMockDocument({ id: '1', title: 'Legacy Test Doc' })
      
      act(() => {
        result.current.addDocument(mockDoc)
      })

      const state = result.current
      expect(state.documents).toHaveLength(1)
      expect(state.documents[0]).toEqual(mockDoc)
    })

    it('should support legacy updateDocument method', () => {
      const { result } = renderHook(() => useDocumentStore())
      
      const mockDoc = createMockDocument({ id: '1', title: 'Original Title' })
      
      act(() => {
        result.current.addDocument(mockDoc)
        result.current.updateDocument('1', { title: 'Updated Title' })
      })

      const state = result.current
      expect(state.documents[0].title).toBe('Updated Title')
    })

    it('should support legacy removeDocument method', () => {
      const { result } = renderHook(() => useDocumentStore())
      
      const mockDoc = createMockDocument({ id: '1', title: 'Test Doc' })
      
      act(() => {
        result.current.addDocument(mockDoc)
        result.current.removeDocument('1')
      })

      const state = result.current
      expect(state.documents).toHaveLength(0)
    })
  })
})
