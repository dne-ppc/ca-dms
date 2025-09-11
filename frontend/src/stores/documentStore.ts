import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Document } from '../types'

interface DocumentState {
  documents: Document[]
  currentDocument: Document | null
  isLoading: boolean
  error: string | null
}

interface DocumentActions {
  setDocuments: (documents: Document[]) => void
  setCurrentDocument: (document: Document | null) => void
  setLoading: (isLoading: boolean) => void
  setError: (error: string | null) => void
  addDocument: (document: Document) => void
  updateDocument: (id: string, updates: Partial<Document>) => void
  removeDocument: (id: string) => void
}

type DocumentStore = DocumentState & DocumentActions

export const useDocumentStore = create<DocumentStore>()(
  devtools(
    set => ({
      // State
      documents: [],
      currentDocument: null,
      isLoading: false,
      error: null,

      // Actions
      setDocuments: documents => set({ documents }),
      setCurrentDocument: document => set({ currentDocument: document }),
      setLoading: isLoading => set({ isLoading }),
      setError: error => set({ error }),

      addDocument: document =>
        set(state => ({
          documents: [...state.documents, document],
        })),

      updateDocument: (id, updates) =>
        set(state => ({
          documents: state.documents.map(doc =>
            doc.id === id ? { ...doc, ...updates } : doc
          ),
          currentDocument:
            state.currentDocument?.id === id
              ? { ...state.currentDocument, ...updates }
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
