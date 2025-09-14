import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { DocumentEditorMain } from '../components/editor/DocumentEditorMain'
import type { Document, User } from '../components/editor/DocumentEditorMain'

const DocumentEditor = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [document, setDocument] = useState<Document | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Mock user data - in a real app this would come from authentication context
  const mockUser: User = {
    id: 'user-1',
    name: 'John Doe',
    email: 'john.doe@example.com'
  }

  useEffect(() => {
    if (id) {
      loadDocument(id)
    } else {
      // Create new document
      createNewDocument()
    }
  }, [id])

  const createNewDocument = () => {
    const newDoc: Document = {
      id: '',
      title: 'Untitled Document',
      type: 'governance',
      content: JSON.stringify({
        ops: [{ insert: '\n' }]
      }),
      author: mockUser.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    setDocument(newDoc)
  }

  const loadDocument = async (docId: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`http://localhost:8000/api/v1/documents/${docId}`)
      if (response.ok) {
        const doc = await response.json()

        // Transform backend document format to frontend format
        const transformedDoc: Document = {
          id: doc.id,
          title: doc.title,
          type: doc.document_type,
          content: typeof doc.content === 'string' ? doc.content : JSON.stringify(doc.content),
          author: doc.created_by || mockUser.name,
          createdAt: doc.created_at,
          updatedAt: doc.updated_at
        }

        setDocument(transformedDoc)
      } else {
        setError('Failed to load document')
      }
    } catch (error) {
      setError('Error loading document: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleDocumentUpdate = async (updatedDoc: Document) => {
    setDocument(updatedDoc)
  }

  const handleSave = async (docToSave: Document) => {
    setIsSaving(true)
    setError(null)

    try {
      // Parse content as Delta if it's JSON, otherwise create simple Delta
      let deltaContent
      try {
        deltaContent = JSON.parse(docToSave.content)
      } catch {
        deltaContent = {
          ops: [{ insert: docToSave.content + '\n' }]
        }
      }

      const documentData = {
        title: docToSave.title.trim(),
        content: deltaContent,
        document_type: docToSave.type,
        placeholders: {
          signatures: [],
          longResponses: [],
          lineSegments: [],
          versionTables: []
        }
      }

      const url = docToSave.id
        ? `http://localhost:8000/api/v1/documents/${docToSave.id}`
        : 'http://localhost:8000/api/v1/documents/'

      const method = docToSave.id ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(documentData)
      })

      if (response.ok) {
        const result = await response.json()

        // Update document with saved data
        const savedDoc: Document = {
          ...docToSave,
          id: result.id || docToSave.id,
          updatedAt: result.updated_at || new Date().toISOString()
        }

        setDocument(savedDoc)

        // If creating new document, redirect to edit mode
        if (!docToSave.id && result.id) {
          setTimeout(() => {
            navigate(`/editor/${result.id}`)
          }, 1000)
        }
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Save failed' }))
        setError('Error saving: ' + (errorData.detail || 'Unknown error'))
      }
    } catch (error) {
      setError('Error saving: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading document...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-red-600">Error: {error}</div>
      </div>
    )
  }

  if (!document) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Document not found</div>
      </div>
    )
  }

  return (
    <DocumentEditorMain
      document={document}
      user={mockUser}
      onDocumentUpdate={handleDocumentUpdate}
      onSave={handleSave}
      isSaving={isSaving}
    />
  )
}

export default DocumentEditor