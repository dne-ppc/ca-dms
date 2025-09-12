import { useEffect, useRef } from 'react'
import './QuillEditor.css'
import { CustomToolbar } from './CustomToolbar'
import { useKeyboardNavigationContext } from '../../contexts/KeyboardNavigationContext'
import useKeyboardNavigation from '../../hooks/useKeyboardNavigation'

// Dynamically import Quill to avoid SSR issues
let Quill: any = null
let Font: any = null  
let Size: any = null

const initializeQuill = async () => {
  if (typeof window === 'undefined') return null
  
  try {
    const QuillModule = await import('quill')
    Quill = QuillModule.default
    
    // Import CSS
    await import('quill/dist/quill.snow.css')
    
    // Configure font families
    Font = Quill.import('formats/font')
    Font.whitelist = ['serif', 'monospace', 'helvetica', 'arial', 'georgia', 'calibri']
    Quill.register(Font, true)

    // Configure font sizes  
    Size = Quill.import('formats/size')
    Size.whitelist = ['small', 'large', 'huge']
    Quill.register(Size, true)

    return Quill
  } catch (error) {
    console.error('Failed to initialize Quill:', error)
    return null
  }
}

interface QuillEditorProps {
  initialContent?: string
  onChange?: (content: string) => void
  readOnly?: boolean
  onInsertPlaceholder?: (type: string) => void
}

export const QuillEditor = ({
  initialContent = '',
  onChange,
  readOnly = false,
  onInsertPlaceholder,
}: QuillEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const quillRef = useRef<Quill | null>(null)
  const { registerEditor, focusToolbar } = useKeyboardNavigationContext()

  const handlePlaceholderInsertion = (type: string) => {
    const quill = quillRef.current
    if (!quill) return

    switch (type) {
      case 'version-table':
        insertVersionTable(quill)
        break
      case 'signature-field':
        insertSignatureField(quill)
        break
      case 'long-response':
        insertLongResponse(quill)
        break
      case 'line-segment':
        // TODO: Implement line segment insertion
        console.log('Line segment insertion not yet implemented')
        break
      default:
        console.warn(`Unknown placeholder type: ${type}`)
    }
  }

  const insertVersionTable = (quill: Quill) => {
    // Version tables can only be inserted at the beginning of the document
    const selection = quill.getSelection()
    if (!selection) return

    // Check if document already has a version table
    const existingVersionTable = quill.scroll.querySelector('.ql-version-table')
    if (existingVersionTable) {
      console.warn('Document already contains a version table')
      return
    }

    // Create default version table data
    const versionData: VersionTableData[] = [
      {
        version: '1.0',
        date: new Date().toISOString().split('T')[0],
        description: 'Initial version',
        author: 'Current User'
      }
    ]

    // Insert at the beginning of the document
    quill.insertEmbed(0, 'version-table', versionData)
    quill.insertText(1, '\n') // Add newline after version table
    quill.setSelection(2) // Move cursor after the version table
  }

  const insertSignatureField = (quill: Quill) => {
    const selection = quill.getSelection()
    if (!selection) return

    // Create default signature field data
    const signatureData: SignatureData = {
      name: '',
      date: '',
      title: ''
    }

    // Insert at current cursor position
    quill.insertEmbed(selection.index, 'signature-field', signatureData)
    quill.insertText(selection.index + 1, '\n') // Add newline after signature field
    quill.setSelection(selection.index + 2) // Move cursor after the signature field
  }

  const insertLongResponse = (quill: Quill) => {
    const selection = quill.getSelection()
    if (!selection) return

    // Create default long response data
    const longResponseData: LongResponseData = {
      label: 'Response',
      content: '',
      height: 'medium'
    }

    // Insert at current cursor position
    quill.insertEmbed(selection.index, 'long-response', longResponseData)
    quill.insertText(selection.index + 1, '\n') // Add newline after long response
    quill.setSelection(selection.index + 2) // Move cursor after the long response
  }

  useEffect(() => {
    if (!editorRef.current) return

    const initEditor = async () => {
      try {
        const QuillClass = await initializeQuill()
        if (!QuillClass || !editorRef.current) return

        // Initialize Quill editor with custom toolbar
        const quill = new QuillClass(editorRef.current, {
          theme: 'snow',
          readOnly,
          modules: {
            toolbar: '#custom-toolbar',
          },
        })

        quillRef.current = quill

        // Set initial content if provided
        if (initialContent) {
          try {
            const delta = JSON.parse(initialContent)
            quill.setContents(delta)
          } catch {
            // If not valid JSON, treat as plain text
            quill.setText(initialContent)
          }
        }

        // Listen for content changes
        const handleTextChange = () => {
          const content = JSON.stringify(quill.getContents())
          onChange?.(content)
        }

        quill.on('text-change', handleTextChange)

        // Store cleanup function
        quillRef.current.cleanup = () => {
          quill.off('text-change', handleTextChange)
        }
      } catch (error) {
        console.error('Error initializing Quill editor:', error)
      }
    }

    initEditor()

    // Cleanup on unmount
    return () => {
      if (quillRef.current?.cleanup) {
        quillRef.current.cleanup()
      }
      quillRef.current = null
    }
  }, [initialContent, onChange, readOnly])

  // Register editor for keyboard navigation
  useEffect(() => {
    registerEditor(containerRef.current)
  }, [])

  // Setup keyboard shortcuts
  useKeyboardNavigation({
    onAlt1: focusToolbar,
    onCtrlS: () => {
      // Trigger save functionality (if available)
      console.log('Save shortcut pressed')
    },
    onCtrlZ: () => {
      // Quill handles undo internally
      if (quillRef.current && !readOnly) {
        quillRef.current.history.undo()
      }
    },
    onCtrlY: () => {
      // Quill handles redo internally  
      if (quillRef.current && !readOnly) {
        quillRef.current.history.redo()
      }
    },
  })

  // Combine internal placeholder handler with external one
  const handleCombinedPlaceholderInsertion = (type: string) => {
    handlePlaceholderInsertion(type)
    onInsertPlaceholder?.(type)
  }

  return (
    <div 
      ref={containerRef}
      className="quill-editor-container" 
      role="main" 
      aria-label="Document editor"
    >
      <CustomToolbar onInsertPlaceholder={handleCombinedPlaceholderInsertion} />
      <div 
        ref={editorRef} 
        data-testid="quill-editor"
        role="textbox"
        aria-label={readOnly ? "Document content (read-only)" : "Document content (editable)"}
        aria-multiline="true"
        aria-describedby="editor-instructions"
        tabIndex={readOnly ? -1 : 0}
      />
      <div id="editor-instructions" className="sr-only">
        {readOnly 
          ? "This is a read-only document. Use arrow keys to navigate through the content."
          : "Rich text editor for document content. Use the toolbar above to format text and insert placeholders. Press Alt+1 to focus toolbar, Ctrl+S to save, Ctrl+Z to undo, Ctrl+Y to redo."
        }
      </div>
    </div>
  )
}