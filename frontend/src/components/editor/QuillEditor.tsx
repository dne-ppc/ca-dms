import { useEffect, useRef } from 'react'
import Quill from 'quill'
import 'quill/dist/quill.snow.css'
import { CustomToolbar } from './CustomToolbar'

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

  return (
    <div className="quill-editor-container">
      <CustomToolbar onInsertPlaceholder={onInsertPlaceholder} />
      <div ref={editorRef} data-testid="quill-editor" />
    </div>
  )
}