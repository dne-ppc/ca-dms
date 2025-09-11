import { describe, it, expect, beforeEach } from 'vitest'
import { useDocumentStore } from '../../stores/documentStore'
import { createMockDocument } from '../utils'

// Reset store before each test
beforeEach(() => {
  useDocumentStore.setState({
    documents: [],
    currentDocument: null,
    isLoading: false,
    error: null,
  })
})

describe('DocumentStore', () => {
  it('should initialize with empty state', () => {
    const state = useDocumentStore.getState()
    expect(state.documents).toEqual([])
    expect(state.currentDocument).toBeNull()
    expect(state.isLoading).toBe(false)
    expect(state.error).toBeNull()
  })

  it('should add a document', () => {
    const mockDoc = createMockDocument({ id: '1', title: 'Test Doc' })
    useDocumentStore.getState().addDocument(mockDoc)

    const state = useDocumentStore.getState()
    expect(state.documents).toHaveLength(1)
    expect(state.documents[0]).toEqual(mockDoc)
  })

  it('should set current document', () => {
    const mockDoc = createMockDocument({ id: '1', title: 'Test Doc' })
    useDocumentStore.getState().setCurrentDocument(mockDoc)

    const state = useDocumentStore.getState()
    expect(state.currentDocument).toEqual(mockDoc)
  })

  it('should update a document', () => {
    const mockDoc = createMockDocument({ id: '1', title: 'Original Title' })
    useDocumentStore.getState().addDocument(mockDoc)
    useDocumentStore.getState().updateDocument('1', { title: 'Updated Title' })

    const state = useDocumentStore.getState()
    expect(state.documents[0].title).toBe('Updated Title')
  })

  it('should remove a document', () => {
    const mockDoc = createMockDocument({ id: '1', title: 'Test Doc' })
    useDocumentStore.getState().addDocument(mockDoc)
    useDocumentStore.getState().removeDocument('1')

    const state = useDocumentStore.getState()
    expect(state.documents).toHaveLength(0)
  })
})
