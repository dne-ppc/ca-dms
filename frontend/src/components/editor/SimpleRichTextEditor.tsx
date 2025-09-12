import { useState, useEffect } from 'react'
import './SimpleRichTextEditor.css'

interface SimpleRichTextEditorProps {
  initialContent?: string
  onChange?: (content: string) => void
  readOnly?: boolean
  onInsertPlaceholder?: (type: string) => void
}

export const SimpleRichTextEditor = ({
  initialContent = '',
  onChange,
  readOnly = false,
  onInsertPlaceholder,
}: SimpleRichTextEditorProps) => {
  const [content, setContent] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (initialContent) {
      try {
        // Try to parse as JSON (Delta format)
        const delta = JSON.parse(initialContent)
        if (delta.ops) {
          // Convert Delta to plain text
          const text = delta.ops.map((op: any) => op.insert).join('')
          setContent(text.replace(/\n$/, '')) // Remove trailing newline
        }
      } catch {
        // Treat as plain text
        setContent(initialContent)
      }
    }
    setIsLoading(false)
  }, [initialContent])

  const handleContentChange = (newContent: string) => {
    setContent(newContent)
    if (onChange) {
      // Convert to basic Delta format for compatibility
      const delta = {
        ops: [{ insert: newContent + '\n' }]
      }
      onChange(JSON.stringify(delta))
    }
  }

  const handlePlaceholderClick = (type: string) => {
    onInsertPlaceholder?.(type)
    
    // Insert placeholder text at current cursor position or end
    const placeholderText = `[${type.replace('-', ' ').toUpperCase()}]`
    const newContent = content + (content ? ' ' : '') + placeholderText
    handleContentChange(newContent)
  }

  if (isLoading) {
    return <div className="simple-editor-loading">Loading editor...</div>
  }

  return (
    <div className="simple-rich-text-editor" dir="ltr" lang="en">
      {/* Simple Toolbar */}
      <div className="simple-toolbar">
        <div className="toolbar-group">
          <select 
            onChange={(e) => {
              // Font size is cosmetic only for now
              console.log('Font size changed:', e.target.value)
            }}
            className="font-size-select"
          >
            <option value="3">Normal</option>
            <option value="1">Small</option>
            <option value="5">Large</option>
            <option value="7">Huge</option>
          </select>
          
          <select 
            onChange={(e) => {
              // Font family is cosmetic only for now
              console.log('Font family changed:', e.target.value)
            }}
            className="font-family-select"
          >
            <option value="">Default</option>
            <option value="Times New Roman">Times New Roman</option>
            <option value="Arial">Arial</option>
            <option value="Georgia">Georgia</option>
            <option value="Courier New">Courier New</option>
          </select>
        </div>

        <div className="toolbar-group">
          <button onClick={() => console.log('Bold clicked')} className="toolbar-btn" title="Bold">
            <strong>B</strong>
          </button>
          <button onClick={() => console.log('Italic clicked')} className="toolbar-btn" title="Italic">
            <em>I</em>
          </button>
          <button onClick={() => console.log('Underline clicked')} className="toolbar-btn" title="Underline">
            <u>U</u>
          </button>
        </div>

        <div className="toolbar-group">
          <input 
            type="color" 
            onChange={(e) => console.log('Text color:', e.target.value)}
            className="color-input"
            title="Text Color"
          />
          <input 
            type="color" 
            onChange={(e) => console.log('Background color:', e.target.value)}
            className="color-input"
            title="Background Color"
          />
        </div>

        <div className="toolbar-group placeholder-group">
          <button 
            onClick={() => handlePlaceholderClick('version-table')}
            className="placeholder-btn"
            title="Insert Version Table"
          >
            📋
          </button>
          <button 
            onClick={() => handlePlaceholderClick('signature-field')}
            className="placeholder-btn"
            title="Insert Signature Field"
          >
            ✍️
          </button>
          <button 
            onClick={() => handlePlaceholderClick('long-response')}
            className="placeholder-btn"
            title="Insert Long Response"
          >
            📝
          </button>
          <button 
            onClick={() => handlePlaceholderClick('line-segment')}
            className="placeholder-btn"
            title="Insert Line Segment"
          >
            ___
          </button>
        </div>
      </div>

      {/* Editor Content - Using textarea instead of contentEditable */}
      <textarea
        value={content}
        onChange={(e) => handleContentChange(e.target.value)}
        disabled={readOnly}
        className="simple-editor-textarea"
        style={{
          width: '100%',
          minHeight: '300px',
          padding: '1rem',
          direction: 'ltr',
          textAlign: 'left',
          unicodeBidi: 'embed',
          writingMode: 'horizontal-tb',
          fontFamily: 'inherit',
          fontSize: '14px',
          border: 'none',
          borderTop: '1px solid var(--border-primary, #ccc)',
          outline: 'none',
          resize: 'vertical',
          backgroundColor: readOnly ? 'var(--bg-secondary, #f5f5f5)' : 'var(--bg-primary, white)',
          color: 'var(--text-primary, #333)'
        }}
        dir="ltr"
        lang="en"
        placeholder="Start typing your document content..."
      />
    </div>
  )
}