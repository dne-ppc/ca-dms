import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import PDFModal from '../components/pdf/PDFModal'
import { SimpleRichTextEditor } from '../components/editor/SimpleRichTextEditor'
import { tempStorageService } from '../services/tempStorageService'

interface Document {
  id: string
  title: string
  content: {
    ops: Array<{ insert: string }>
  }
  document_type: string
  version: number
}

const DocumentEditor = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('Untitled Document')
  const [documentType, setDocumentType] = useState('governance')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true)
  const [isPDFModalOpen, setIsPDFModalOpen] = useState(false)

  useEffect(() => {
    if (id) {
      loadDocument(id)
    }
  }, [id])

  // Auto-save effect
  useEffect(() => {
    if (hasUnsavedChanges && autoSaveEnabled && id && title.trim()) {
      const autoSaveTimer = setTimeout(() => {
        autoSave()
      }, 3000) // Auto-save after 3 seconds of inactivity

      return () => clearTimeout(autoSaveTimer)
    }
  }, [hasUnsavedChanges, title, content, documentType, autoSaveEnabled, id])

  // Track changes to mark document as having unsaved changes
  useEffect(() => {
    if (!isLoading && (title !== 'Untitled Document' || content !== '')) {
      setHasUnsavedChanges(true)
    }
  }, [title, content, documentType, isLoading])

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
        return e.returnValue
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  const loadDocument = async (docId: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(`http://localhost:8000/api/v1/documents/${docId}`)
      if (response.ok) {
        const doc: Document = await response.json()
        
        // Check if there's newer temp data
        const tempData = tempStorageService.getTempDocument(docId)
        const documentLastUpdated = new Date(doc.version || Date.now()) // Use version as timestamp proxy
        
        if (tempData && tempStorageService.isTempDocumentNewer(docId, documentLastUpdated)) {
          // Show temp recovery option
          const shouldUseTempData = window.confirm(
            `Found unsaved changes from ${new Date(tempData.savedAt).toLocaleString()}. ` +
            'Would you like to restore these changes?'
          )
          
          if (shouldUseTempData) {
            setTitle(tempData.title)
            setDocumentType(tempData.documentType)
            setContent(tempData.content)
            setHasUnsavedChanges(true)
            setSaveMessage('Restored from unsaved changes')
            setTimeout(() => setSaveMessage(''), 3000)
          } else {
            // User chose to discard temp data
            tempStorageService.clearTempDocument(docId)
            setTitle(doc.title)
            setDocumentType(doc.document_type)
            setContent(JSON.stringify(doc.content))
            setHasUnsavedChanges(false)
            setLastSaved(new Date())
          }
        } else {
          // No temp data or temp data is older
          setTitle(doc.title)
          setDocumentType(doc.document_type)
          setContent(JSON.stringify(doc.content))
          setHasUnsavedChanges(false)
          setLastSaved(new Date())
        }
      } else {
        setSaveMessage('Error loading document')
      }
    } catch (error) {
      setSaveMessage('Error loading document: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setIsLoading(false)
    }
  }

  const autoSave = async () => {
    if (!id || !title.trim()) return
    
    try {
      setIsSaving(true)
      
      // Parse content as Delta if it's JSON, otherwise create simple Delta
      let deltaContent
      try {
        deltaContent = JSON.parse(content)
      } catch {
        deltaContent = {
          ops: [{ insert: content + '\n' }]
        }
      }

      // Save to temp storage instead of directly updating document version
      tempStorageService.saveTempDocument(id, {
        title: title.trim(),
        content: JSON.stringify(deltaContent),
        documentType: documentType
      })

      setHasUnsavedChanges(false)
      setLastSaved(new Date())
      setSaveMessage('Auto-saved to drafts')
      setTimeout(() => setSaveMessage(''), 2000)
    } catch (error) {
      // Silent fail for auto-save to avoid interrupting user
      console.error('Auto-save failed:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const saveDocument = async () => {
    if (!title.trim()) {
      setSaveMessage('Please enter a document title')
      return
    }

    setIsSaving(true)
    setSaveMessage('')

    try {
      // Parse content as Delta if it's JSON, otherwise create simple Delta
      let deltaContent
      try {
        deltaContent = JSON.parse(content)
      } catch {
        deltaContent = {
          ops: [{ insert: content + '\n' }]
        }
      }

      const documentData = {
        title: title.trim(),
        content: deltaContent,
        document_type: documentType,
        placeholders: {
          signatures: [],
          longResponses: [],
          lineSegments: [],
          versionTables: []
        }
      }

      const url = id 
        ? `http://localhost:8000/api/v1/documents/${id}` 
        : 'http://localhost:8000/api/v1/documents/'
      
      const method = id ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(documentData)
      })

      if (response.ok) {
        const result = await response.json()
        
        // Clear temp storage when document version is successfully saved
        if (id) {
          tempStorageService.clearTempDocument(id)
        }
        
        setSaveMessage('Document saved successfully!')
        setHasUnsavedChanges(false)
        setLastSaved(new Date())
        
        // If creating new document, redirect to edit mode
        if (!id && result.id) {
          setTimeout(() => {
            navigate(`/editor/${result.id}`)
          }, 1000)
        }
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Save failed' }))
        setSaveMessage('Error saving: ' + (errorData.detail || 'Unknown error'))
      }
    } catch (error) {
      setSaveMessage('Error saving: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setIsSaving(false)
      // Clear message after 3 seconds
      setTimeout(() => setSaveMessage(''), 3000)
    }
  }

  const previewPDF = () => {
    if (id) {
      setIsPDFModalOpen(true)
    } else {
      setSaveMessage('Please save the document first to preview PDF')
      setTimeout(() => setSaveMessage(''), 3000)
    }
  }

  const downloadPDF = () => {
    if (id) {
      window.open(`http://localhost:8000/api/v1/documents/${id}/pdf`, '_blank')
    } else {
      setSaveMessage('Please save the document first to download PDF')
      setTimeout(() => setSaveMessage(''), 3000)
    }
  }

  if (isLoading) {
    return (
      <div className="document-editor">
        <div className="loading">Loading document...</div>
      </div>
    )
  }

  return (
    <div className="document-editor">
      <header className="editor-header">
        <div className="editor-nav">
          <Link to="/dashboard" className="back-link">← Back to Dashboard</Link>
        </div>
        <h1>{id ? `Edit Document` : 'New Document'}</h1>
        <div className="editor-actions">
          <div className="save-info">
            <span className={`save-status ${saveMessage.includes('Error') ? 'error' : (saveMessage.includes('success') || saveMessage === 'Auto-saved') ? 'success' : hasUnsavedChanges ? 'warning' : ''}`}>
              {isSaving ? 'Saving...' : saveMessage || (hasUnsavedChanges ? 'Unsaved changes' : (lastSaved ? `Last saved: ${lastSaved.toLocaleTimeString()}` : (id ? 'Ready to edit' : 'Ready to create')))}
            </span>
            {id && (
              <div className="auto-save-toggle">
                <label>
                  <input
                    type="checkbox"
                    checked={autoSaveEnabled}
                    onChange={(e) => setAutoSaveEnabled(e.target.checked)}
                  />
                  <span className="toggle-label">Auto-save</span>
                </label>
              </div>
            )}
          </div>
        </div>
      </header>
      
      <main className="editor-content">
        <div className="document-form">
          <div className="form-group">
            <label htmlFor="title">Document Title</label>
            <input 
              id="title"
              type="text" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)}
              className="title-input"
              placeholder="Enter document title..."
              disabled={isSaving}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="document-type">Document Type</label>
            <select
              id="document-type"
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="type-select"
              disabled={isSaving}
            >
              <option value="governance">Governance</option>
              <option value="policy">Policy</option>
              <option value="meeting">Meeting Minutes</option>
              <option value="notice">Notice</option>
              <option value="form">Form</option>
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="content">Content</label>
            <SimpleRichTextEditor 
              initialContent={content}
              onChange={setContent}
              readOnly={isSaving}
              onInsertPlaceholder={(type) => {
                console.log(`Placeholder inserted: ${type}`)
              }}
            />
          </div>
          
          <div className="editor-toolbar">
            <button 
              className="save-button" 
              onClick={saveDocument}
              disabled={isSaving || !title.trim()}
            >
              {isSaving ? 'Saving...' : (id ? 'Update Document' : 'Save Document')}
            </button>
            <button 
              className="preview-button"
              onClick={previewPDF}
              disabled={!id}
            >
              Preview PDF
            </button>
            <button 
              className="download-button"
              onClick={downloadPDF}
              disabled={!id}
            >
              Download PDF
            </button>
            {id && (
              <button 
                className="delete-button"
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete this document?')) {
                    // TODO: Implement delete functionality
                    alert('Delete functionality not yet implemented')
                  }
                }}
                disabled={isSaving}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </main>

      {/* PDF Preview Modal */}
      <PDFModal 
        isOpen={isPDFModalOpen}
        onClose={() => setIsPDFModalOpen(false)}
        pdfUrl={`http://localhost:8000/api/v1/documents/${id}/pdf`}
        documentTitle={title}
        documentId={id}
        onDownloadSuccess={(result) => {
          setSaveMessage(`PDF downloaded successfully: ${result.filename}`)
          setTimeout(() => setSaveMessage(''), 3000)
        }}
        onDownloadError={(error) => {
          setSaveMessage(`Download failed: ${error.message}`)
          setTimeout(() => setSaveMessage(''), 3000)
        }}
      />
    </div>
  )
}

export default DocumentEditor
