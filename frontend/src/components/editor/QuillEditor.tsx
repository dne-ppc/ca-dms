import { useEffect, useRef } from 'react'
import Quill from 'quill'
import 'quill/dist/quill.snow.css'
import { CustomToolbar } from './CustomToolbar'
import { VersionTableBlot, VersionTableData } from './blots/VersionTableBlot'
import { SignatureBlot, SignatureData } from './blots/SignatureBlot'

// Register custom blots
Quill.register('formats/version-table', VersionTableBlot)
Quill.register('formats/signature-field', SignatureBlot)

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
        insertSignatureField(quill)
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