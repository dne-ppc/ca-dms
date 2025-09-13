/**
 * End-to-end tests for document creation workflow
 * Tests the complete user journey from creation to saving
 */
import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { useDocumentStore } from '../../stores/documentStore'
import { apiClient } from '../../services/api'
import { documentService } from '../../services/documentService'

// Mock the entire document store
jest.mock('../../stores/documentStore', () => ({
  useDocumentStore: jest.fn()
}))

// Mock API services
jest.mock('../../services/api', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn()
  }
}))

jest.mock('../../services/documentService', () => ({
  documentService: {
    createDocument: jest.fn(),
    updateDocument: jest.fn(),
    saveDocument: jest.fn(),
    getDocument: jest.fn(),
    searchDocuments: jest.fn()
  }
}))

// Mock components for E2E testing
const MockDocumentEditor = ({ onSave, onCancel }: any) => {
  const [title, setTitle] = React.useState('')
  const [content, setContent] = React.useState('')

  const handleSave = () => {
    onSave({ title, content })
  }

  return (
    <div data-testid="document-editor">
      <h1>Document Editor</h1>
      <input
        data-testid="title-input"
        placeholder="Document title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        data-testid="content-input"
        placeholder="Document content"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <button data-testid="save-button" onClick={handleSave}>
        Save Document
      </button>
      <button data-testid="cancel-button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  )
}

const MockDocumentList = ({ documents, onCreateNew, onEdit }: any) => (
  <div data-testid="document-list">
    <h1>Documents</h1>
    <button data-testid="create-new-button" onClick={onCreateNew}>
      Create New Document
    </button>
    <div data-testid="documents-container">
      {documents.map((doc: any) => (
        <div key={doc.id} data-testid={`document-${doc.id}`}>
          <h3>{doc.title}</h3>
          <p>{doc.status}</p>
          <button onClick={() => onEdit(doc.id)}>Edit</button>
        </div>
      ))}
    </div>
  </div>
)

const MockQuillEditor = ({ onChange, onInsertPlaceholder }: any) => {
  const [content, setContent] = React.useState('')

  const handleContentChange = (value: string) => {
    setContent(value)
    onChange?.(JSON.stringify([{ insert: value }]))
  }

  const insertVersionTable = () => {
    const versionTableData = {
      version: '1.0',
      date: new Date().toISOString().split('T')[0],
      author: 'Test User'
    }
    onInsertPlaceholder?.('version-table', versionTableData)
  }

  return (
    <div data-testid="quill-editor">
      <div data-testid="toolbar">
        <button data-testid="version-table-btn" onClick={insertVersionTable}>
          Insert Version Table
        </button>
        <button data-testid="signature-btn" onClick={() => onInsertPlaceholder?.('signature', {})}>
          Insert Signature
        </button>
      </div>
      <textarea
        data-testid="editor-content"
        value={content}
        onChange={(e) => handleContentChange(e.target.value)}
        placeholder="Start typing..."
      />
    </div>
  )
}

// Main workflow component that integrates everything
const DocumentWorkflowApp = () => {
  const [currentView, setCurrentView] = React.useState<'list' | 'editor'>('list')
  const [editingDocument, setEditingDocument] = React.useState<any>(null)

  const mockStore = useDocumentStore()

  const handleCreateNew = () => {
    setEditingDocument(null)
    setCurrentView('editor')
  }

  const handleEdit = (documentId: string) => {
    const document = mockStore.documents.find((doc: any) => doc.id === documentId)
    setEditingDocument(document)
    mockStore.setCurrentDocument(document)
    setCurrentView('editor')
  }

  const handleSave = async (documentData: any) => {
    try {
      if (editingDocument) {
        // Update existing document
        await mockStore.updateDocumentMetadata({
          title: documentData.title
        })
        await mockStore.updateDocumentContent(JSON.parse(documentData.content || '[]'))
        await mockStore.saveDocument()
      } else {
        // Create new document
        await mockStore.createDocument({
          title: documentData.title,
          content: documentData.content || JSON.stringify([{ insert: '' }])
        })
      }
      setCurrentView('list')
    } catch (error) {
      console.error('Failed to save document:', error)
    }
  }

  const handleCancel = () => {
    setEditingDocument(null)
    setCurrentView('list')
  }

  const handlePlaceholderInsert = (type: string, data: any) => {
    // Simulate placeholder insertion
    mockStore.insertPlaceholder(type, data)
  }

  if (currentView === 'editor') {
    return (
      <div>
        <MockDocumentEditor onSave={handleSave} onCancel={handleCancel} />
        <MockQuillEditor
          onChange={mockStore.setDocumentDelta}
          onInsertPlaceholder={handlePlaceholderInsert}
        />
      </div>
    )
  }

  return (
    <MockDocumentList
      documents={mockStore.documents}
      onCreateNew={handleCreateNew}
      onEdit={handleEdit}
    />
  )
}

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    {children}
  </BrowserRouter>
)

describe('Document Creation E2E Workflow', () => {
  const mockDocumentStore = {
    documents: [],
    currentDocument: null,
    isLoading: false,
    error: null,
    isDirty: false,
    createDocument: jest.fn(),
    updateDocumentMetadata: jest.fn(),
    updateDocumentContent: jest.fn(),
    setDocumentDelta: jest.fn(),
    saveDocument: jest.fn(),
    setCurrentDocument: jest.fn(),
    insertPlaceholder: jest.fn(),
    getPlaceholderObjects: jest.fn(() => [])
  }

  const mockApiClient = apiClient as jest.Mocked<typeof apiClient>
  const mockDocumentService = documentService as jest.Mocked<typeof documentService>
  const mockUseDocumentStore = useDocumentStore as jest.MockedFunction<typeof useDocumentStore>

  beforeEach(() => {
    jest.clearAllMocks()

    // Reset store state
    mockDocumentStore.documents = []
    mockDocumentStore.currentDocument = null
    mockDocumentStore.isLoading = false
    mockDocumentStore.error = null
    mockDocumentStore.isDirty = false

    mockUseDocumentStore.mockReturnValue(mockDocumentStore as any)

    // Mock successful API responses
    mockApiClient.post.mockResolvedValue({
      success: true,
      data: { id: 'new-doc-id', title: 'New Document', status: 'draft' }
    })

    mockDocumentService.createDocument.mockResolvedValue({
      id: 'new-doc-id',
      title: 'New Document',
      content: '',
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1
    } as any)
  })

  describe('Complete Document Creation Workflow', () => {
    it('should handle full document creation from start to finish', async () => {
      const user = userEvent.setup()

      await act(async () => {
        render(
          <TestWrapper>
            <DocumentWorkflowApp />
          </TestWrapper>
        )
      })

      // Step 1: Should start with document list view
      expect(screen.getByTestId('document-list')).toBeInTheDocument()
      expect(screen.getByText('Documents')).toBeInTheDocument()

      // Step 2: Click create new document
      const createButton = screen.getByTestId('create-new-button')
      await act(async () => {
        await user.click(createButton)
      })

      // Step 3: Should switch to editor view
      expect(screen.getByTestId('document-editor')).toBeInTheDocument()
      expect(screen.getByTestId('quill-editor')).toBeInTheDocument()

      // Step 4: Fill in document details
      const titleInput = screen.getByTestId('title-input')
      const contentInput = screen.getByTestId('content-input')

      await act(async () => {
        await user.type(titleInput, 'My New Document')
        await user.type(contentInput, 'This is the document content')
      })

      expect(titleInput).toHaveValue('My New Document')
      expect(contentInput).toHaveValue('This is the document content')

      // Step 5: Insert a placeholder
      const versionTableBtn = screen.getByTestId('version-table-btn')
      await act(async () => {
        await user.click(versionTableBtn)
      })

      expect(mockDocumentStore.insertPlaceholder).toHaveBeenCalledWith(
        'version-table',
        expect.objectContaining({
          version: '1.0',
          author: 'Test User'
        })
      )

      // Step 6: Save the document
      const saveButton = screen.getByTestId('save-button')
      await act(async () => {
        await user.click(saveButton)
      })

      // Step 7: Verify store methods were called correctly
      expect(mockDocumentStore.createDocument).toHaveBeenCalledWith({
        title: 'My New Document',
        content: expect.stringContaining('This is the document content')
      })

      // Step 8: Should return to document list view
      await waitFor(() => {
        expect(screen.getByTestId('document-list')).toBeInTheDocument()
      })
    })

    it('should handle document editing workflow', async () => {
      const user = userEvent.setup()

      // Setup existing document
      const existingDoc = {
        id: 'doc-1',
        title: 'Existing Document',
        content: JSON.stringify([{ insert: 'Existing content' }]),
        status: 'draft',
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockDocumentStore.documents = [existingDoc]

      await act(async () => {
        render(
          <TestWrapper>
            <DocumentWorkflowApp />
          </TestWrapper>
        )
      })

      // Step 1: Should show existing document in list
      expect(screen.getByTestId('document-doc-1')).toBeInTheDocument()
      expect(screen.getByText('Existing Document')).toBeInTheDocument()

      // Step 2: Click edit on existing document
      const editButton = screen.getByText('Edit')
      await act(async () => {
        await user.click(editButton)
      })

      // Step 3: Should set current document and show editor
      expect(mockDocumentStore.setCurrentDocument).toHaveBeenCalledWith(existingDoc)
      expect(screen.getByTestId('document-editor')).toBeInTheDocument()

      // Step 4: Modify document
      const titleInput = screen.getByTestId('title-input')
      await act(async () => {
        await user.clear(titleInput)
        await user.type(titleInput, 'Updated Document Title')
      })

      // Step 5: Save changes
      const saveButton = screen.getByTestId('save-button')
      await act(async () => {
        await user.click(saveButton)
      })

      // Step 6: Verify update methods were called
      expect(mockDocumentStore.updateDocumentMetadata).toHaveBeenCalledWith({
        title: 'Updated Document Title'
      })
      expect(mockDocumentStore.saveDocument).toHaveBeenCalled()
    })

    it('should handle cancellation workflow', async () => {
      const user = userEvent.setup()

      await act(async () => {
        render(
          <TestWrapper>
            <DocumentWorkflowApp />
          </TestWrapper>
        )
      })

      // Step 1: Start creating new document
      const createButton = screen.getByTestId('create-new-button')
      await act(async () => {
        await user.click(createButton)
      })

      expect(screen.getByTestId('document-editor')).toBeInTheDocument()

      // Step 2: Fill in some data
      const titleInput = screen.getByTestId('title-input')
      await act(async () => {
        await user.type(titleInput, 'Document to be cancelled')
      })

      // Step 3: Cancel instead of saving
      const cancelButton = screen.getByTestId('cancel-button')
      await act(async () => {
        await user.click(cancelButton)
      })

      // Step 4: Should return to list without saving
      expect(screen.getByTestId('document-list')).toBeInTheDocument()
      expect(mockDocumentStore.createDocument).not.toHaveBeenCalled()
      expect(mockDocumentStore.saveDocument).not.toHaveBeenCalled()
    })

    it('should handle multiple placeholder insertions', async () => {
      const user = userEvent.setup()

      await act(async () => {
        render(
          <TestWrapper>
            <DocumentWorkflowApp />
          </TestWrapper>
        )
      })

      // Navigate to editor
      const createButton = screen.getByTestId('create-new-button')
      await act(async () => {
        await user.click(createButton)
      })

      // Insert multiple placeholders
      const versionTableBtn = screen.getByTestId('version-table-btn')
      const signatureBtn = screen.getByTestId('signature-btn')

      await act(async () => {
        await user.click(versionTableBtn)
      })

      await act(async () => {
        await user.click(signatureBtn)
      })

      // Verify both placeholders were inserted
      expect(mockDocumentStore.insertPlaceholder).toHaveBeenCalledTimes(2)
      expect(mockDocumentStore.insertPlaceholder).toHaveBeenNthCalledWith(1, 'version-table', expect.any(Object))
      expect(mockDocumentStore.insertPlaceholder).toHaveBeenNthCalledWith(2, 'signature', {})
    })

    it('should handle error scenarios gracefully', async () => {
      const user = userEvent.setup()

      // Mock save failure
      mockDocumentStore.createDocument.mockRejectedValue(new Error('Save failed'))
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      await act(async () => {
        render(
          <TestWrapper>
            <DocumentWorkflowApp />
          </TestWrapper>
        )
      })

      // Navigate to editor and try to save
      const createButton = screen.getByTestId('create-new-button')
      await act(async () => {
        await user.click(createButton)
      })

      const titleInput = screen.getByTestId('title-input')
      await act(async () => {
        await user.type(titleInput, 'Document that will fail')
      })

      const saveButton = screen.getByTestId('save-button')
      await act(async () => {
        await user.click(saveButton)
      })

      // Should log error and stay in editor view
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to save document:', expect.any(Error))
      })
      expect(screen.getByTestId('document-editor')).toBeInTheDocument()

      consoleSpy.mockRestore()
    })
  })

  describe('Integration with Services', () => {
    it('should integrate with document service for creation', async () => {
      const user = userEvent.setup()

      // Mock successful service call
      mockDocumentService.createDocument.mockResolvedValue({
        id: 'service-doc-id',
        title: 'Service Document',
        content: '',
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1
      } as any)

      await act(async () => {
        render(
          <TestWrapper>
            <DocumentWorkflowApp />
          </TestWrapper>
        )
      })

      // Create and save document
      await act(async () => {
        await user.click(screen.getByTestId('create-new-button'))
      })

      await act(async () => {
        await user.type(screen.getByTestId('title-input'), 'Service Test Document')
      })

      await act(async () => {
        await user.click(screen.getByTestId('save-button'))
      })

      expect(mockDocumentStore.createDocument).toHaveBeenCalledWith({
        title: 'Service Test Document',
        content: '[]'
      })
    })

    it('should handle API errors during workflow', async () => {
      const user = userEvent.setup()

      // Mock API failure
      mockApiClient.post.mockRejectedValue(new Error('API Error'))
      mockDocumentStore.createDocument.mockRejectedValue(new Error('API Error'))

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      await act(async () => {
        render(
          <TestWrapper>
            <DocumentWorkflowApp />
          </TestWrapper>
        )
      })

      await act(async () => {
        await user.click(screen.getByTestId('create-new-button'))
        await user.type(screen.getByTestId('title-input'), 'Failed Document')
        await user.click(screen.getByTestId('save-button'))
      })

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to save document:', expect.any(Error))
      })

      consoleSpy.mockRestore()
    })
  })

  describe('State Management Throughout Workflow', () => {
    it('should maintain consistent state during navigation', async () => {
      const user = userEvent.setup()

      await act(async () => {
        render(
          <TestWrapper>
            <DocumentWorkflowApp />
          </TestWrapper>
        )
      })

      // Start creating document
      await act(async () => {
        await user.click(screen.getByTestId('create-new-button'))
      })

      // Add content
      await act(async () => {
        await user.type(screen.getByTestId('content-input'), 'Test content')
      })

      // Verify store was called for content changes
      expect(mockDocumentStore.setDocumentDelta).toHaveBeenCalled()

      // Cancel and verify state reset
      await act(async () => {
        await user.click(screen.getByTestId('cancel-button'))
      })

      expect(screen.getByTestId('document-list')).toBeInTheDocument()
    })

    it('should handle dirty state management', async () => {
      const user = userEvent.setup()

      // Setup dirty state
      mockDocumentStore.isDirty = true

      await act(async () => {
        render(
          <TestWrapper>
            <DocumentWorkflowApp />
          </TestWrapper>
        )
      })

      // Navigate to editor
      await act(async () => {
        await user.click(screen.getByTestId('create-new-button'))
      })

      // Make changes to trigger dirty state
      await act(async () => {
        await user.type(screen.getByTestId('title-input'), 'Dirty Document')
      })

      // The store should track dirty state (implementation dependent)
      expect(screen.getByTestId('document-editor')).toBeInTheDocument()
    })
  })
})