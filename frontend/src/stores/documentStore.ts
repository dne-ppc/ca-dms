import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { DeltaOperation } from 'quill'
import type { 
  Document, 
  CreateDocumentData,
  DocumentMetadataUpdate,
  DocumentStats,
  DocumentStoreState
} from '../types'

interface DocumentState {
  documents: Document[]
  currentDocument: Document | null
  isLoading: boolean
  error: string | null
  isDirty: boolean
}

interface DocumentActions {
  // Basic state management
  setDocuments: (documents: Document[]) => void
  setCurrentDocument: (document: Document | null) => void
  setLoading: (isLoading: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
  
  // Document CRUD operations
  createDocument: (data: CreateDocumentData) => void
  updateDocumentContent: (content: DeltaOperation[]) => void
  updateDocumentMetadata: (updates: DocumentMetadataUpdate) => void
  saveDocument: () => void
  deleteDocument: (id: string) => void
  
  // Document list management
  loadDocumentById: (id: string) => void
  getAllDocuments: () => Document[]
  
  // Quill Delta integration
  getDocumentDelta: () => DeltaOperation[]
  setDocumentDelta: (delta: DeltaOperation[]) => void
  
  // Store utilities
  getDocumentStats: () => DocumentStats
  clearStore: () => void
  exportState: () => DocumentStoreState
  importState: (state: DocumentStoreState) => void
  
  // Legacy actions for backward compatibility
  addDocument: (document: Document) => void
  updateDocument: (id: string, updates: Partial<Document>) => void
  removeDocument: (id: string) => void
}

type DocumentStore = DocumentState & DocumentActions

// Utility functions
const generateDocumentId = (): string => {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substr(2, 9)
  return `doc-${timestamp}-${random}`
}

const deltaToString = (delta: DeltaOperation[]): string => {
  return JSON.stringify(delta)
}

const stringToDelta = (content: string): DeltaOperation[] => {
  try {
    return JSON.parse(content)
  } catch {
    // Fallback for plain text content
    return [{ insert: content }]
  }
}

export const useDocumentStore = create<DocumentStore>()(
  devtools(
    (set, get) => ({
      // State
      documents: [],
      currentDocument: null,
      isLoading: false,
      error: null,
      isDirty: false,

      // Basic state management
      setDocuments: documents => set({ documents }),
      
      setCurrentDocument: document => set({ 
        currentDocument: document,
        isDirty: false 
      }),
      
      setLoading: isLoading => set({ isLoading }),
      
      setError: error => set({ error }),
      
      clearError: () => set({ error: null }),

      // Document CRUD operations
      createDocument: (data: CreateDocumentData) => {
        const newDocument: Document = {
          id: generateDocumentId(),
          title: data.title,
          content: data.content,
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
          status: 'draft'
        }

        set(state => ({
          documents: [...state.documents, newDocument],
          currentDocument: newDocument,
          isDirty: false
        }))
      },

      updateDocumentContent: (delta: DeltaOperation[]) => {
        const state = get()
        if (!state.currentDocument) return

        const updatedDocument: Document = {
          ...state.currentDocument,
          content: deltaToString(delta),
          updatedAt: new Date()
        }

        set({
          currentDocument: updatedDocument,
          isDirty: true
        })
      },

      updateDocumentMetadata: (updates: DocumentMetadataUpdate) => {
        const state = get()
        if (!state.currentDocument) return

        const updatedDocument: Document = {
          ...state.currentDocument,
          ...updates,
          updatedAt: new Date()
        }

        set(state => ({
          documents: state.documents.map(doc =>
            doc.id === updatedDocument.id ? updatedDocument : doc
          ),
          currentDocument: updatedDocument,
          isDirty: true
        }))
      },

      saveDocument: () => {
        const state = get()
        if (!state.currentDocument || !state.isDirty) return

        const savedDocument: Document = {
          ...state.currentDocument,
          version: state.currentDocument.version + 1,
          updatedAt: new Date()
        }

        set(state => ({
          documents: state.documents.map(doc =>
            doc.id === savedDocument.id ? savedDocument : doc
          ),
          currentDocument: savedDocument,
          isDirty: false
        }))
      },

      deleteDocument: (id: string) => {
        set(state => ({
          documents: state.documents.filter(doc => doc.id !== id),
          currentDocument: state.currentDocument?.id === id ? null : state.currentDocument,
          isDirty: false
        }))
      },

      // Document list management
      loadDocumentById: (id: string) => {
        const state = get()
        const document = state.documents.find(doc => doc.id === id)
        if (document) {
          set({ 
            currentDocument: document,
            isDirty: false 
          })
        }
      },

      getAllDocuments: () => {
        return get().documents
      },

      // Quill Delta integration
      getDocumentDelta: (): DeltaOperation[] => {
        const state = get()
        if (!state.currentDocument) return []
        return stringToDelta(state.currentDocument.content)
      },

      setDocumentDelta: (delta: DeltaOperation[]) => {
        get().updateDocumentContent(delta)
      },

      // Store utilities
      getDocumentStats: (): DocumentStats => {
        const documents = get().documents
        return {
          totalDocuments: documents.length,
          draftDocuments: documents.filter(doc => doc.status === 'draft').length,
          publishedDocuments: documents.filter(doc => doc.status === 'published').length,
          archivedDocuments: documents.filter(doc => doc.status === 'archived').length
        }
      },

      clearStore: () => set({
        documents: [],
        currentDocument: null,
        isLoading: false,
        error: null,
        isDirty: false
      }),

      exportState: (): DocumentStoreState => {
        const state = get()
        return {
          documents: state.documents,
          currentDocument: state.currentDocument
        }
      },

      importState: (importedState: DocumentStoreState) => {
        set({
          documents: importedState.documents,
          currentDocument: importedState.currentDocument,
          isDirty: false
        })
      },

      // Legacy actions for backward compatibility
      addDocument: document =>
        set(state => ({
          documents: [...state.documents, document],
        })),

      updateDocument: (id, updates) =>
        set(state => ({
          documents: state.documents.map(doc =>
            doc.id === id ? { ...doc, ...updates, updatedAt: new Date() } : doc
          ),
          currentDocument:
            state.currentDocument?.id === id
              ? { ...state.currentDocument, ...updates, updatedAt: new Date() }
              : state.currentDocument,
        })),

      removeDocument: id =>
        set(state => ({
          documents: state.documents.filter(doc => doc.id !== id),
          currentDocument:
            state.currentDocument?.id === id ? null : state.currentDocument,
        })),
    }),
    {
      name: 'document-store',
    }
  )
)
