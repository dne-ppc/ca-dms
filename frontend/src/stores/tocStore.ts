import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { tocService, type TOCHeader, type TOCHierarchyItem } from '../services/tocService'

interface NavigationState {
  currentSectionId: string | null
  scrollPosition: number
  isScrolling: boolean
}

interface AccessibilityInfo {
  totalHeaders: number
  currentLevel: number
  hasChildren: boolean
  ariaLabel: string
}

interface TOCState {
  headers: TOCHeader[]
  hierarchy: TOCHierarchyItem[]
  activeHeaderId: string | null
  isExpanded: boolean
  isLoading: boolean
  isConnected: boolean
  navigationState: NavigationState
  error: string | null
  lastUpdated: Date | null
  contentHash: string | null
}

interface TOCActions {
  updateFromContent: (content: string) => void
  setActiveHeader: (headerId: string | null) => void
  toggleExpansion: () => void
  setNavigationState: (state: Partial<NavigationState>) => void
  navigateToHeader: (headerId: string) => void
  connectToEditor: (editor: any) => void
  disconnectFromEditor: () => void
  handleKeyboardNavigation: (key: string) => void
  getAccessibilityInfo: () => AccessibilityInfo
  getNextHeader: () => TOCHeader | null
  getPreviousHeader: () => TOCHeader | null
  setError: (error: string | null) => void
  clearError: () => void
  setLoading: (isLoading: boolean) => void
}

type TOCStore = TOCState & TOCActions

const initialNavigationState: NavigationState = {
  currentSectionId: null,
  scrollPosition: 0,
  isScrolling: false
}

const initialState: TOCState = {
  headers: [],
  hierarchy: [],
  activeHeaderId: null,
  isExpanded: true,
  isLoading: false,
  isConnected: false,
  navigationState: initialNavigationState,
  error: null,
  lastUpdated: null,
  contentHash: null
}

// Throttle helper function
const throttle = <T extends any[]>(
  func: (...args: T) => void,
  delay: number
): (...args: T) => void => {
  let timeoutId: NodeJS.Timeout | null = null
  let lastArgs: T | null = null

  return (...args: T) => {
    lastArgs = args

    if (timeoutId === null) {
      timeoutId = setTimeout(() => {
        if (lastArgs) {
          func(...lastArgs)
        }
        timeoutId = null
        lastArgs = null
      }, delay)
    }
  }
}

// Simple hash function for content comparison
const hashContent = (content: string): string => {
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return hash.toString()
}

export const useTOCStore = create<TOCStore>()(
  devtools(
    (set, get) => {
      let editorInstance: any = null
      let updateHandler: ((delta: any, oldContents: any, source: any) => void) | null = null

      // Throttled update function
      const throttledUpdate = throttle((content: string) => {
        const contentHash = hashContent(content)
        const currentHash = get().contentHash

        // Skip update if content hasn't changed
        if (contentHash === currentHash) {
          return
        }

        try {
          const headers = tocService.extractHeaders(content || '')
          const hierarchy = tocService.generateHierarchy(content || '')

          set({
            headers,
            hierarchy,
            lastUpdated: new Date(),
            contentHash,
            error: null,
            isLoading: false
          })
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to parse content',
            isLoading: false
          })
        }
      }, 150)

      return {
        ...initialState,

        // Actions
        updateFromContent: (content: string) => {
          if (content === null || content === undefined) {
            set({
              headers: [],
              hierarchy: [],
              error: null
            })
            return
          }

          set({ isLoading: true })
          throttledUpdate(content)
        },

        setActiveHeader: (headerId: string | null) => {
          set({ activeHeaderId: headerId })
        },

        toggleExpansion: () => {
          set(state => ({ isExpanded: !state.isExpanded }))
        },

        setNavigationState: (navState: Partial<NavigationState>) => {
          set(state => ({
            navigationState: { ...state.navigationState, ...navState }
          }))
        },

        navigateToHeader: (headerId: string) => {
          const { headers } = get()
          const header = headers.find(h => h.id === headerId)

          if (header) {
            set({ activeHeaderId: headerId })

            // Scroll to element if it exists
            const element = document.getElementById(headerId)
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          }
        },

        connectToEditor: (editor: any) => {
          if (editorInstance) {
            get().disconnectFromEditor()
          }

          editorInstance = editor

          updateHandler = (delta: any, oldContents: any, source: any) => {
            if (source === 'user') {
              const content = editor.getText()
              get().updateFromContent(content)
            }
          }

          editor.on('text-change', updateHandler)
          set({ isConnected: true })

          // Initial content update
          const initialContent = editor.getText()
          get().updateFromContent(initialContent)
        },

        disconnectFromEditor: () => {
          if (editorInstance && updateHandler) {
            editorInstance.off('text-change', updateHandler)
          }

          editorInstance = null
          updateHandler = null
          set({ isConnected: false })
        },

        handleKeyboardNavigation: (key: string) => {
          const { headers, activeHeaderId } = get()
          const currentIndex = headers.findIndex(h => h.id === activeHeaderId)

          switch (key) {
            case 'ArrowDown':
              if (currentIndex < headers.length - 1) {
                const nextHeader = headers[currentIndex + 1]
                get().setActiveHeader(nextHeader.id)
              }
              break
            case 'ArrowUp':
              if (currentIndex > 0) {
                const prevHeader = headers[currentIndex - 1]
                get().setActiveHeader(prevHeader.id)
              }
              break
            case 'Enter':
              if (activeHeaderId) {
                get().navigateToHeader(activeHeaderId)
              }
              break
          }
        },

        getAccessibilityInfo: (): AccessibilityInfo => {
          const { headers, activeHeaderId, hierarchy } = get()
          const activeHeader = headers.find(h => h.id === activeHeaderId)
          const hasChildren = hierarchy.some(item => item.children.length > 0)

          return {
            totalHeaders: headers.length,
            currentLevel: activeHeader?.level || 1,
            hasChildren,
            ariaLabel: `Table of contents with ${headers.length} headers`
          }
        },

        getNextHeader: (): TOCHeader | null => {
          const { headers, activeHeaderId } = get()
          if (!activeHeaderId) return headers[0] || null

          const currentIndex = headers.findIndex(h => h.id === activeHeaderId)
          return currentIndex < headers.length - 1 ? headers[currentIndex + 1] : null
        },

        getPreviousHeader: (): TOCHeader | null => {
          const { headers, activeHeaderId } = get()
          if (!activeHeaderId) return null

          const currentIndex = headers.findIndex(h => h.id === activeHeaderId)
          return currentIndex > 0 ? headers[currentIndex - 1] : null
        },

        setError: (error: string | null) => {
          set({ error })
        },

        clearError: () => {
          set({ error: null })
        },

        setLoading: (isLoading: boolean) => {
          set({ isLoading })
        }
      }
    },
    {
      name: 'toc-store',
    }
  )
)

// Add computed properties to the store for convenience
export const useTOCStoreSelectors = () => {
  const store = useTOCStore()

  return {
    ...store,
    hasError: !!store.error,
    isEmpty: store.headers.length === 0,
    hasActiveHeader: !!store.activeHeaderId,
    isReady: !store.isLoading && !store.error
  }
}