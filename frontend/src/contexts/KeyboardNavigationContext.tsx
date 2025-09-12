import React, { createContext, useContext, useRef, useCallback } from 'react'

interface KeyboardNavigationContextType {
  focusToolbar: () => void
  focusEditor: () => void
  focusSidebar: () => void
  focusMain: () => void
  registerToolbar: (element: HTMLElement | null) => void
  registerEditor: (element: HTMLElement | null) => void
  registerSidebar: (element: HTMLElement | null) => void
  registerMain: (element: HTMLElement | null) => void
}

const KeyboardNavigationContext = createContext<KeyboardNavigationContextType | null>(null)

export const useKeyboardNavigationContext = () => {
  const context = useContext(KeyboardNavigationContext)
  if (!context) {
    // Return safe defaults instead of throwing
    return {
      focusToolbar: () => {},
      focusEditor: () => {},
      focusSidebar: () => {},
      focusMain: () => {},
      registerToolbar: () => {},
      registerEditor: () => {},
      registerSidebar: () => {},
      registerMain: () => {},
    }
  }
  return context
}

interface KeyboardNavigationProviderProps {
  children: React.ReactNode
}

export const KeyboardNavigationProvider: React.FC<KeyboardNavigationProviderProps> = ({ children }) => {
  const toolbarRef = useRef<HTMLElement | null>(null)
  const editorRef = useRef<HTMLElement | null>(null)
  const sidebarRef = useRef<HTMLElement | null>(null)
  const mainRef = useRef<HTMLElement | null>(null)

  const focusToolbar = useCallback(() => {
    if (toolbarRef.current) {
      const firstButton = toolbarRef.current.querySelector('button, select') as HTMLElement
      if (firstButton) {
        firstButton.focus()
      } else {
        toolbarRef.current.focus()
      }
    }
  }, [])

  const focusEditor = useCallback(() => {
    if (editorRef.current) {
      const editor = editorRef.current.querySelector('.ql-editor') as HTMLElement
      if (editor) {
        editor.focus()
      } else {
        editorRef.current.focus()
      }
    }
  }, [])

  const focusSidebar = useCallback(() => {
    if (sidebarRef.current) {
      const firstFocusable = sidebarRef.current.querySelector('button, input, select, [tabindex="0"]') as HTMLElement
      if (firstFocusable) {
        firstFocusable.focus()
      } else {
        sidebarRef.current.focus()
      }
    }
  }, [])

  const focusMain = useCallback(() => {
    if (mainRef.current) {
      const firstFocusable = mainRef.current.querySelector('button, input, select, [tabindex="0"]') as HTMLElement
      if (firstFocusable) {
        firstFocusable.focus()
      } else {
        mainRef.current.focus()
      }
    }
  }, [])

  const registerToolbar = useCallback((element: HTMLElement | null) => {
    toolbarRef.current = element
  }, [])

  const registerEditor = useCallback((element: HTMLElement | null) => {
    editorRef.current = element
  }, [])

  const registerSidebar = useCallback((element: HTMLElement | null) => {
    sidebarRef.current = element
  }, [])

  const registerMain = useCallback((element: HTMLElement | null) => {
    mainRef.current = element
  }, [])

  const value = {
    focusToolbar,
    focusEditor,
    focusSidebar,
    focusMain,
    registerToolbar,
    registerEditor,
    registerSidebar,
    registerMain,
  }

  return (
    <KeyboardNavigationContext.Provider value={value}>
      {children}
    </KeyboardNavigationContext.Provider>
  )
}

export default KeyboardNavigationProvider