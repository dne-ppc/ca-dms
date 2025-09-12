import { useEffect, useCallback } from 'react'

interface KeyboardNavigationOptions {
  onEscape?: () => void
  onEnter?: () => void
  onTab?: () => void
  onArrowKeys?: (direction: 'up' | 'down' | 'left' | 'right') => void
  onAlt1?: () => void  // Alt+1 for toolbar focus
  onCtrlS?: () => void // Ctrl+S for save
  onCtrlZ?: () => void // Ctrl+Z for undo
  onCtrlY?: () => void // Ctrl+Y for redo
}

export const useKeyboardNavigation = (options: KeyboardNavigationOptions) => {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const {
      onEscape,
      onEnter,
      onTab,
      onArrowKeys,
      onAlt1,
      onCtrlS,
      onCtrlZ,
      onCtrlY
    } = options

    // Prevent conflicts with form inputs and contenteditable elements
    const target = event.target as HTMLElement
    const isFormElement = target.tagName === 'INPUT' || 
                         target.tagName === 'TEXTAREA' || 
                         target.tagName === 'SELECT' ||
                         target.contentEditable === 'true' ||
                         target.classList.contains('ql-editor')

    switch (event.key) {
      case 'Escape':
        onEscape?.()
        break
        
      case 'Enter':
        if (!isFormElement && onEnter) {
          event.preventDefault()
          onEnter()
        }
        break
        
      case 'Tab':
        if (onTab) {
          onTab()
        }
        break
        
      case 'ArrowUp':
        if (!isFormElement && onArrowKeys) {
          event.preventDefault()
          onArrowKeys('up')
        }
        break
        
      case 'ArrowDown':
        if (!isFormElement && onArrowKeys) {
          event.preventDefault()
          onArrowKeys('down')
        }
        break
        
      case 'ArrowLeft':
        if (!isFormElement && onArrowKeys) {
          event.preventDefault()
          onArrowKeys('left')
        }
        break
        
      case 'ArrowRight':
        if (!isFormElement && onArrowKeys) {
          event.preventDefault()
          onArrowKeys('right')
        }
        break
        
      case '1':
        if (event.altKey && onAlt1) {
          event.preventDefault()
          onAlt1()
        }
        break
        
      case 's':
        if (event.ctrlKey && onCtrlS) {
          event.preventDefault()
          onCtrlS()
        }
        break
        
      case 'z':
        if (event.ctrlKey && !event.shiftKey && onCtrlZ) {
          event.preventDefault()
          onCtrlZ()
        }
        break
        
      case 'y':
        if (event.ctrlKey && onCtrlY) {
          event.preventDefault()
          onCtrlY()
        }
        break
    }
  }, [options])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

export default useKeyboardNavigation