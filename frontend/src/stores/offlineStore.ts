import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Document, DocumentVersion } from '@/types/document'

interface OfflineDocument extends Document {
  localChanges?: boolean
  lastSynced?: number
  conflictStatus?: 'none' | 'pending' | 'resolved'
}

interface OfflineAction {
  id: string
  type: 'create' | 'update' | 'delete'
  documentId: string
  data: any
  timestamp: number
  synced: boolean
  retryCount: number
}

interface OfflineStore {
  // Offline documents cache
  documents: OfflineDocument[]
  documentVersions: Record<string, DocumentVersion[]>
  
  // Offline actions queue
  pendingActions: OfflineAction[]
  
  // Offline state
  isOffline: boolean
  lastSyncTime: number | null
  syncInProgress: boolean
  
  // Document operations
  addDocument: (document: Document) => void
  updateDocument: (id: string, updates: Partial<Document>) => void
  removeDocument: (id: string) => void
  getDocument: (id: string) => OfflineDocument | undefined
  
  // Version operations
  addDocumentVersion: (documentId: string, version: DocumentVersion) => void
  getDocumentVersions: (documentId: string) => DocumentVersion[]
  
  // Offline actions
  queueAction: (action: Omit<OfflineAction, 'id' | 'timestamp' | 'synced' | 'retryCount'>) => void
  markActionSynced: (actionId: string) => void
  clearSyncedActions: () => void
  retryFailedAction: (actionId: string) => void
  
  // Sync operations
  setOfflineStatus: (offline: boolean) => void
  startSync: () => void
  endSync: (success: boolean) => void
  
  // Conflict resolution
  markConflict: (documentId: string) => void
  resolveConflict: (documentId: string, resolution: 'local' | 'remote' | 'merge') => void
  
  // Storage management
  clearOfflineData: () => void
  getStorageSize: () => number
}

export const useOfflineStore = create<OfflineStore>()(
  persist(
    (set, get) => ({
      // Initial state
      documents: [],
      documentVersions: {},
      pendingActions: [],
      isOffline: false,
      lastSyncTime: null,
      syncInProgress: false,

      // Document operations
      addDocument: (document: Document) => {
        set((state) => ({
          documents: [
            ...state.documents.filter(d => d.id !== document.id),
            { ...document, lastSynced: Date.now(), localChanges: false }
          ]
        }))
      },

      updateDocument: (id: string, updates: Partial<Document>) => {
        set((state) => ({
          documents: state.documents.map(doc => 
            doc.id === id 
              ? { ...doc, ...updates, localChanges: true }
              : doc
          )
        }))
        
        // Queue update action if offline
        if (get().isOffline) {
          get().queueAction({
            type: 'update',
            documentId: id,
            data: updates
          })
        }
      },

      removeDocument: (id: string) => {
        set((state) => ({
          documents: state.documents.filter(d => d.id !== id),
          documentVersions: Object.fromEntries(
            Object.entries(state.documentVersions).filter(([key]) => key !== id)
          )
        }))
        
        // Queue delete action if offline
        if (get().isOffline) {
          get().queueAction({
            type: 'delete',
            documentId: id,
            data: null
          })
        }
      },

      getDocument: (id: string) => {
        return get().documents.find(d => d.id === id)
      },

      // Version operations
      addDocumentVersion: (documentId: string, version: DocumentVersion) => {
        set((state) => ({
          documentVersions: {
            ...state.documentVersions,
            [documentId]: [
              ...(state.documentVersions[documentId] || []),
              version
            ].sort((a, b) => b.version_number - a.version_number)
          }
        }))
      },

      getDocumentVersions: (documentId: string) => {
        return get().documentVersions[documentId] || []
      },

      // Offline actions
      queueAction: (actionData) => {
        const action: OfflineAction = {
          id: crypto.randomUUID(),
          ...actionData,
          timestamp: Date.now(),
          synced: false,
          retryCount: 0
        }
        
        set((state) => ({
          pendingActions: [...state.pendingActions, action]
        }))
      },

      markActionSynced: (actionId: string) => {
        set((state) => ({
          pendingActions: state.pendingActions.map(action =>
            action.id === actionId ? { ...action, synced: true } : action
          )
        }))
      },

      clearSyncedActions: () => {
        set((state) => ({
          pendingActions: state.pendingActions.filter(action => !action.synced)
        }))
      },

      retryFailedAction: (actionId: string) => {
        set((state) => ({
          pendingActions: state.pendingActions.map(action =>
            action.id === actionId 
              ? { ...action, retryCount: action.retryCount + 1 }
              : action
          )
        }))
      },

      // Sync operations
      setOfflineStatus: (offline: boolean) => {
        set({ isOffline: offline })
        
        // Trigger sync when coming back online
        if (!offline && get().pendingActions.length > 0) {
          setTimeout(() => get().startSync(), 1000)
        }
      },

      startSync: () => {
        set({ syncInProgress: true })
      },

      endSync: (success: boolean) => {
        set({ 
          syncInProgress: false,
          lastSyncTime: success ? Date.now() : get().lastSyncTime
        })
        
        if (success) {
          get().clearSyncedActions()
        }
      },

      // Conflict resolution
      markConflict: (documentId: string) => {
        set((state) => ({
          documents: state.documents.map(doc =>
            doc.id === documentId 
              ? { ...doc, conflictStatus: 'pending' }
              : doc
          )
        }))
      },

      resolveConflict: (documentId: string, resolution: 'local' | 'remote' | 'merge') => {
        set((state) => ({
          documents: state.documents.map(doc =>
            doc.id === documentId 
              ? { 
                  ...doc, 
                  conflictStatus: 'resolved',
                  localChanges: resolution === 'local'
                }
              : doc
          )
        }))
      },

      // Storage management
      clearOfflineData: () => {
        set({
          documents: [],
          documentVersions: {},
          pendingActions: [],
          lastSyncTime: null
        })
      },

      getStorageSize: () => {
        const state = get()
        const dataString = JSON.stringify({
          documents: state.documents,
          documentVersions: state.documentVersions,
          pendingActions: state.pendingActions
        })
        return new Blob([dataString]).size
      }
    }),
    {
      name: 'ca-dms-offline-storage',
      version: 1,
      
      // Only persist offline data, not sync state
      partialize: (state) => ({
        documents: state.documents,
        documentVersions: state.documentVersions,
        pendingActions: state.pendingActions,
        lastSyncTime: state.lastSyncTime
      })
    }
  )
)