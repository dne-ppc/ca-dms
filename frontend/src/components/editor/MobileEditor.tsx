import { useState, useRef, useEffect } from 'react'
import { 
  Type, 
  Bold, 
  Italic, 
  List, 
  MoreHorizontal, 
  Undo, 
  Redo,
  Save,
  Eye,
  EyeOff,
  Maximize,
  Minimize,
  Keyboard
} from 'lucide-react'
import { QuillEditor } from './QuillEditor'

interface MobileEditorProps {
  documentId: string
  initialContent?: any
  onContentChange?: (content: any) => void
  onSave?: () => void
  readOnly?: boolean
  className?: string
}

export const MobileEditor = ({
  documentId,
  initialContent,
  onContentChange,
  onSave,
  readOnly = false,
  className = ''
}: MobileEditorProps) => {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showToolbar, setShowToolbar] = useState(true)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const editorRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Handle virtual keyboard on mobile
  useEffect(() => {
    const handleResize = () => {
      const windowHeight = window.innerHeight
      const documentHeight = document.documentElement.clientHeight
      
      // Detect virtual keyboard
      const keyboardHeight = documentHeight - windowHeight
      if (keyboardHeight > 150) { // Likely virtual keyboard
        setKeyboardHeight(keyboardHeight)
        setShowToolbar(false) // Hide toolbar when keyboard is open
      } else {
        setKeyboardHeight(0)
        setShowToolbar(true)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Handle fullscreen mode
  const toggleFullscreen = () => {
    if (!isFullscreen && containerRef.current) {
      containerRef.current.requestFullscreen?.()
      setIsFullscreen(true)
    } else if (document.fullscreenElement) {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  const mobileToolbarItems = [
    {
      id: 'bold',
      icon: Bold,
      label: 'Bold',
      action: () => editorRef.current?.getEditor()?.format('bold')
    },
    {
      id: 'italic',
      icon: Italic,
      label: 'Italic', 
      action: () => editorRef.current?.getEditor()?.format('italic')
    },
    {
      id: 'list',
      icon: List,
      label: 'List',
      action: () => editorRef.current?.getEditor()?.format('list', 'bullet')
    },
    {
      id: 'undo',
      icon: Undo,
      label: 'Undo',
      action: () => editorRef.current?.getEditor()?.history?.undo()
    },
    {
      id: 'redo',
      icon: Redo,
      label: 'Redo',
      action: () => editorRef.current?.getEditor()?.history?.redo()
    }
  ]

  return (
    <div
      ref={containerRef}
      className={`
        mobile-editor flex flex-col h-full bg-white
        ${isFullscreen ? 'fixed inset-0 z-50' : ''}
        ${className}
      `}
      style={{ 
        paddingBottom: keyboardHeight > 0 ? `${keyboardHeight}px` : undefined 
      }}
    >
      {/* Mobile Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsPreviewMode(!isPreviewMode)}
            className="p-2 rounded-md hover:bg-gray-200 transition-colors"
            title={isPreviewMode ? 'Edit Mode' : 'Preview Mode'}
          >
            {isPreviewMode ? (
              <Type className="h-5 w-5 text-gray-700" />
            ) : (
              <Eye className="h-5 w-5 text-gray-700" />
            )}
          </button>
          
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-md hover:bg-gray-200 transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <Minimize className="h-5 w-5 text-gray-700" />
            ) : (
              <Maximize className="h-5 w-5 text-gray-700" />
            )}
          </button>
        </div>

        <div className="text-sm font-medium text-gray-700 truncate max-w-32">
          Document {documentId}
        </div>

        <button
          onClick={onSave}
          disabled={readOnly}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Save className="h-4 w-4" />
        </button>
      </div>

      {/* Mobile Toolbar */}
      {showToolbar && !isPreviewMode && !readOnly && (
        <div className="flex items-center justify-between p-2 bg-white border-b border-gray-200">
          <div className="flex items-center space-x-1 overflow-x-auto">
            {mobileToolbarItems.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  onClick={item.action}
                  className="p-2.5 rounded-md hover:bg-gray-100 active:bg-gray-200 transition-colors flex-shrink-0"
                  title={item.label}
                >
                  <Icon className="h-5 w-5 text-gray-700" />
                </button>
              )
            })}
          </div>

          <button
            onClick={() => setShowToolbar(false)}
            className="p-2 rounded-md hover:bg-gray-100 transition-colors ml-2"
            title="Hide Toolbar"
          >
            <MoreHorizontal className="h-5 w-5 text-gray-500" />
          </button>
        </div>
      )}

      {/* Collapsed Toolbar Indicator */}
      {!showToolbar && keyboardHeight === 0 && (
        <div className="flex justify-center py-1 bg-gray-50 border-b border-gray-200">
          <button
            onClick={() => setShowToolbar(true)}
            className="flex items-center space-x-1 px-3 py-1 rounded-full bg-white border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Type className="h-3 w-3" />
            <span>Show Toolbar</span>
          </button>
        </div>
      )}

      {/* Editor Container */}
      <div className="flex-1 overflow-hidden">
        <QuillEditor
          ref={editorRef}
          documentId={documentId}
          initialContent={initialContent}
          onContentChange={onContentChange}
          readOnly={readOnly || isPreviewMode}
          showToolbar={false} // We use our custom mobile toolbar
          className="h-full mobile-optimized"
          theme="snow"
          modules={{
            toolbar: false, // Disable default toolbar
            history: {
              delay: 2000,
              maxStack: 500,
              userOnly: true
            }
          }}
        />
      </div>

      {/* Mobile Status Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
        <div className="flex items-center space-x-3">
          <span>{isPreviewMode ? 'Preview' : 'Edit'} Mode</span>
          {keyboardHeight > 0 && (
            <div className="flex items-center space-x-1">
              <Keyboard className="h-3 w-3" />
              <span>Keyboard Active</span>
            </div>
          )}
        </div>
        
        <div>
          {readOnly ? 'Read Only' : 'Editing'}
        </div>
      </div>
    </div>
  )
}

// Touch gesture hooks for mobile editor
export const useTouchGestures = (editorRef: React.RefObject<any>) => {
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null)
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.targetTouches[0]
    setTouchEnd(null)
    setTouchStart({ x: touch.clientX, y: touch.clientY })
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.targetTouches[0]
    setTouchEnd({ x: touch.clientX, y: touch.clientY })
  }

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return

    const deltaX = touchStart.x - touchEnd.x
    const deltaY = touchStart.y - touchEnd.y

    // Detect swipe gestures
    const minSwipeDistance = 50
    
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      // Horizontal swipe
      if (deltaX > minSwipeDistance) {
        // Left swipe - could trigger undo
        return { type: 'swipe-left', deltaX, deltaY }
      } else if (deltaX < -minSwipeDistance) {
        // Right swipe - could trigger redo
        return { type: 'swipe-right', deltaX, deltaY }
      }
    } else {
      // Vertical swipe
      if (deltaY > minSwipeDistance) {
        // Up swipe - could hide toolbar
        return { type: 'swipe-up', deltaX, deltaY }
      } else if (deltaY < -minSwipeDistance) {
        // Down swipe - could show toolbar
        return { type: 'swipe-down', deltaX, deltaY }
      }
    }

    return null
  }

  return {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd
  }
}