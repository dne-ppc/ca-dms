import { useEffect, useRef } from 'react'
import Quill from 'quill'
import 'quill/dist/quill.snow.css'
import { CustomToolbar } from './CustomToolbar'
import { VersionTableBlot, VersionTableData } from './blots/VersionTableBlot'

// Register custom blots
Quill.register('formats/version-table', VersionTableBlot)

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
  const quillRef = useRef<Quill | null>(null)

  const handlePlaceholderInsertion = (type: string) => {
    const quill = quillRef.current
    if (!quill) return

    switch (type) {
      case 'version-table':
        insertVersionTable(quill)
        break
      case 'signature-field':
        // TODO: Implement signature field insertion
        console.log('Signature field insertion not yet implemented')
        break
      case 'long-response':
        // TODO: Implement long response insertion
        console.log('Long response insertion not yet implemented')
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

  useEffect(() => {
    if (!editorRef.current) return

    // Initialize Quill editor with custom toolbar
    const quill = new Quill(editorRef.current, {
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

    // Cleanup on unmount
    return () => {
      quill.off('text-change', handleTextChange)
      quillRef.current = null
    }
  }, [initialContent, onChange, readOnly])

  // Combine internal placeholder handler with external one
  const handleCombinedPlaceholderInsertion = (type: string) => {
    handlePlaceholderInsertion(type)
    onInsertPlaceholder?.(type)
  }

  return (
    <div className="quill-editor-container">
      <CustomToolbar onInsertPlaceholder={handleCombinedPlaceholderInsertion} />
      <div ref={editorRef} data-testid="quill-editor" />
    </div>
  )
}