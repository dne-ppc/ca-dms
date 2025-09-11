import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface EditorState {
  content: string
  isDirty: boolean
  isAutoSaving: boolean
  lastSaved: Date | null
  error: string | null
}

interface EditorActions {
  setContent: (content: string) => void
  setDirty: (isDirty: boolean) => void
  setAutoSaving: (isAutoSaving: boolean) => void
  setLastSaved: (lastSaved: Date | null) => void
  setError: (error: string | null) => void
  resetEditor: () => void
}

type EditorStore = EditorState & EditorActions

const initialState: EditorState = {
  content: '',
  isDirty: false,
  isAutoSaving: false,
  lastSaved: null,
  error: null,
}

export const useEditorStore = create<EditorStore>()(
  devtools(
    set => ({
      ...initialState,

      // Actions
      setContent: content =>
        set(state => ({
          content,
          isDirty: content !== state.content,
        })),

      setDirty: isDirty => set({ isDirty }),
      setAutoSaving: isAutoSaving => set({ isAutoSaving }),
      setLastSaved: lastSaved => set({ lastSaved, isDirty: false }),
      setError: error => set({ error }),

      resetEditor: () => set(initialState),
    }),
    {
      name: 'editor-store',
    }
  )
)
