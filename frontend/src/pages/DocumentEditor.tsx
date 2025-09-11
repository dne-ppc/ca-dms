import { useState } from 'react'
import { QuillEditor } from '../components/editor/QuillEditor'
import { useEditorStore } from '../stores/editorStore'
import './DocumentEditor.css'

const DocumentEditor = () => {
  const { content, setContent } = useEditorStore()
  const [isLoading] = useState(false)

  const handleContentChange = (newContent: string) => {
    setContent(newContent)
  }

  const handleInsertPlaceholder = (type: string) => {
    console.log(`Inserting placeholder of type: ${type}`)
    // TODO: Implement placeholder insertion logic
  }

  return (
    <div className="document-editor">
      <header className="editor-header">
        <h1>Document Editor</h1>
        <div className="editor-actions">
          <span className="save-status">
            {isLoading ? 'Saving...' : 'All changes saved'}
          </span>
        </div>
      </header>
      
      <main className="editor-content">
        <QuillEditor
          initialContent={content}
          onChange={handleContentChange}
          onInsertPlaceholder={handleInsertPlaceholder}
        />
      </main>
    </div>
  )
}

export default DocumentEditor
