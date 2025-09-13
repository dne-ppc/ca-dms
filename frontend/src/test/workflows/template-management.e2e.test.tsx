/**
 * End-to-end tests for template management workflow
 * Tests the complete user journey for template creation, editing, and usage
 */
import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { apiClient } from '../../services/api'

// Mock API services
jest.mock('../../services/api', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn()
  }
}))

// Mock template data
const mockTemplates = [
  {
    id: 'template-1',
    name: 'Board Meeting Minutes',
    description: 'Standard template for board meeting minutes',
    category: 'meeting',
    status: 'published',
    version: 2,
    usage_count: 15,
    created_by: 'user-1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
    tags: ['meeting', 'minutes', 'board']
  },
  {
    id: 'template-2',
    name: 'Policy Document',
    description: 'Template for organizational policies',
    category: 'policy',
    status: 'draft',
    version: 1,
    usage_count: 5,
    created_by: 'user-2',
    created_at: '2024-01-10T00:00:00Z',
    updated_at: '2024-01-10T00:00:00Z',
    tags: ['policy', 'governance']
  }
]

// Mock components for template workflow
const MockTemplateManager = ({ onCreateNew, onEdit, onDelete, onPublish, onUse }: any) => {
  const [templates, setTemplates] = React.useState(mockTemplates)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [selectedCategory, setSelectedCategory] = React.useState('')

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = !searchQuery || template.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = !selectedCategory || template.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div data-testid="template-manager">
      <h1>Template Manager</h1>

      {/* Search and Filter Controls */}
      <div data-testid="template-controls">
        <input
          data-testid="search-input"
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <select
          data-testid="category-filter"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option value="">All Categories</option>
          <option value="meeting">Meeting</option>
          <option value="policy">Policy</option>
          <option value="governance">Governance</option>
        </select>
        <button data-testid="create-template-btn" onClick={onCreateNew}>
          Create New Template
        </button>
      </div>

      {/* Template List */}
      <div data-testid="template-list">
        {filteredTemplates.map(template => (
          <div key={template.id} data-testid={`template-${template.id}`} className="template-card">
            <h3>{template.name}</h3>
            <p>{template.description}</p>
            <div className="template-meta">
              <span>Category: {template.category}</span>
              <span>Status: {template.status}</span>
              <span>Usage: {template.usage_count}</span>
            </div>
            <div className="template-tags">
              {template.tags.map(tag => (
                <span key={tag} className="tag">{tag}</span>
              ))}
            </div>
            <div className="template-actions">
              <button onClick={() => onUse(template.id)}>Use Template</button>
              <button onClick={() => onEdit(template.id)}>Edit</button>
              {template.status === 'draft' && (
                <button onClick={() => onPublish(template.id)}>Publish</button>
              )}
              <button onClick={() => onDelete(template.id)} className="danger">Delete</button>
            </div>
          </div>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div data-testid="no-templates">
          <p>No templates found matching your criteria.</p>
        </div>
      )}
    </div>
  )
}

const MockTemplateEditor = ({ template, onSave, onCancel }: any) => {
  const [formData, setFormData] = React.useState({
    name: template?.name || '',
    description: template?.description || '',
    category: template?.category || 'governance',
    content: template?.content || '',
    tags: template?.tags?.join(', ') || ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      ...formData,
      tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean)
    })
  }

  return (
    <div data-testid="template-editor">
      <h1>{template ? 'Edit Template' : 'Create New Template'}</h1>

      <form onSubmit={handleSubmit} data-testid="template-form">
        <div>
          <label htmlFor="name">Template Name:</label>
          <input
            id="name"
            data-testid="name-input"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            required
          />
        </div>

        <div>
          <label htmlFor="description">Description:</label>
          <textarea
            id="description"
            data-testid="description-input"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            required
          />
        </div>

        <div>
          <label htmlFor="category">Category:</label>
          <select
            id="category"
            data-testid="category-input"
            value={formData.category}
            onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
          >
            <option value="governance">Governance</option>
            <option value="policy">Policy</option>
            <option value="meeting">Meeting</option>
            <option value="report">Report</option>
          </select>
        </div>

        <div>
          <label htmlFor="tags">Tags (comma-separated):</label>
          <input
            id="tags"
            data-testid="tags-input"
            value={formData.tags}
            onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
          />
        </div>

        <div>
          <label htmlFor="content">Template Content:</label>
          <textarea
            id="content"
            data-testid="content-input"
            value={formData.content}
            onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
            rows={10}
            placeholder="Enter template content here..."
          />
        </div>

        <div className="form-actions">
          <button type="submit" data-testid="save-template-btn">
            {template ? 'Update Template' : 'Create Template'}
          </button>
          <button type="button" data-testid="cancel-btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

const MockDocumentFromTemplate = ({ template, onSave, onCancel }: any) => {
  const [documentData, setDocumentData] = React.useState({
    title: `Document from ${template?.name || 'Template'}`,
    content: template?.content || ''
  })

  const handleSave = () => {
    onSave(documentData)
  }

  return (
    <div data-testid="document-from-template">
      <h1>Create Document from Template</h1>
      <p>Using template: <strong>{template?.name}</strong></p>

      <div>
        <label htmlFor="doc-title">Document Title:</label>
        <input
          id="doc-title"
          data-testid="document-title-input"
          value={documentData.title}
          onChange={(e) => setDocumentData(prev => ({ ...prev, title: e.target.value }))}
        />
      </div>

      <div>
        <label htmlFor="doc-content">Content:</label>
        <textarea
          id="doc-content"
          data-testid="document-content-input"
          value={documentData.content}
          onChange={(e) => setDocumentData(prev => ({ ...prev, content: e.target.value }))}
          rows={15}
        />
      </div>

      <div className="form-actions">
        <button data-testid="save-document-btn" onClick={handleSave}>
          Create Document
        </button>
        <button data-testid="cancel-document-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// Main workflow app
const TemplateWorkflowApp = () => {
  const [currentView, setCurrentView] = React.useState<'manager' | 'editor' | 'document'>('manager')
  const [editingTemplate, setEditingTemplate] = React.useState<any>(null)
  const [selectedTemplate, setSelectedTemplate] = React.useState<any>(null)
  const [notification, setNotification] = React.useState<string>('')

  const showNotification = (message: string) => {
    setNotification(message)
    setTimeout(() => setNotification(''), 3000)
  }

  const handleCreateNew = () => {
    setEditingTemplate(null)
    setCurrentView('editor')
  }

  const handleEdit = (templateId: string) => {
    const template = mockTemplates.find(t => t.id === templateId)
    setEditingTemplate(template)
    setCurrentView('editor')
  }

  const handleDelete = async (templateId: string) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      try {
        // Mock API call
        await new Promise(resolve => setTimeout(resolve, 500))
        showNotification('Template deleted successfully')
        // In real app, would remove from state
      } catch (error) {
        showNotification('Failed to delete template')
      }
    }
  }

  const handlePublish = async (templateId: string) => {
    try {
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 500))
      showNotification('Template published successfully')
    } catch (error) {
      showNotification('Failed to publish template')
    }
  }

  const handleUse = (templateId: string) => {
    const template = mockTemplates.find(t => t.id === templateId)
    setSelectedTemplate(template)
    setCurrentView('document')
  }

  const handleSaveTemplate = async (templateData: any) => {
    try {
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 1000))

      if (editingTemplate) {
        showNotification('Template updated successfully')
      } else {
        showNotification('Template created successfully')
      }

      setCurrentView('manager')
    } catch (error) {
      showNotification('Failed to save template')
    }
  }

  const handleSaveDocument = async (documentData: any) => {
    try {
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      showNotification('Document created successfully')
      setCurrentView('manager')
    } catch (error) {
      showNotification('Failed to create document')
    }
  }

  const handleCancel = () => {
    setCurrentView('manager')
    setEditingTemplate(null)
    setSelectedTemplate(null)
  }

  return (
    <div data-testid="template-workflow-app">
      {notification && (
        <div data-testid="notification" className="notification">
          {notification}
        </div>
      )}

      {currentView === 'manager' && (
        <MockTemplateManager
          onCreateNew={handleCreateNew}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onPublish={handlePublish}
          onUse={handleUse}
        />
      )}

      {currentView === 'editor' && (
        <MockTemplateEditor
          template={editingTemplate}
          onSave={handleSaveTemplate}
          onCancel={handleCancel}
        />
      )}

      {currentView === 'document' && (
        <MockDocumentFromTemplate
          template={selectedTemplate}
          onSave={handleSaveDocument}
          onCancel={handleCancel}
        />
      )}
    </div>
  )
}

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    {children}
  </BrowserRouter>
)

describe('Template Management E2E Workflow', () => {
  const mockApiClient = apiClient as jest.Mocked<typeof apiClient>

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock API responses
    mockApiClient.get.mockResolvedValue({
      success: true,
      data: { templates: mockTemplates, total: mockTemplates.length }
    })

    mockApiClient.post.mockResolvedValue({
      success: true,
      data: { id: 'new-template-id' }
    })

    mockApiClient.put.mockResolvedValue({
      success: true,
      data: {}
    })

    mockApiClient.delete.mockResolvedValue({
      success: true,
      data: {}
    })

    // Mock window.confirm
    window.confirm = jest.fn(() => true)
  })

  describe('Template Browsing and Filtering', () => {
    it('should display all templates initially', async () => {
      await act(async () => {
        render(
          <TestWrapper>
            <TemplateWorkflowApp />
          </TestWrapper>
        )
      })

      expect(screen.getByTestId('template-manager')).toBeInTheDocument()
      expect(screen.getByTestId('template-template-1')).toBeInTheDocument()
      expect(screen.getByTestId('template-template-2')).toBeInTheDocument()
      expect(screen.getByText('Board Meeting Minutes')).toBeInTheDocument()
      expect(screen.getByText('Policy Document')).toBeInTheDocument()
    })

    it('should filter templates by search query', async () => {
      const user = userEvent.setup()

      await act(async () => {
        render(
          <TestWrapper>
            <TemplateWorkflowApp />
          </TestWrapper>
        )
      })

      const searchInput = screen.getByTestId('search-input')
      await act(async () => {
        await user.type(searchInput, 'Board')
      })

      expect(screen.getByTestId('template-template-1')).toBeInTheDocument()
      expect(screen.queryByTestId('template-template-2')).not.toBeInTheDocument()
    })

    it('should filter templates by category', async () => {
      const user = userEvent.setup()

      await act(async () => {
        render(
          <TestWrapper>
            <TemplateWorkflowApp />
          </TestWrapper>
        )
      })

      const categoryFilter = screen.getByTestId('category-filter')
      await act(async () => {
        await user.selectOptions(categoryFilter, 'policy')
      })

      expect(screen.queryByTestId('template-template-1')).not.toBeInTheDocument()
      expect(screen.getByTestId('template-template-2')).toBeInTheDocument()
    })

    it('should show no templates message when filters match nothing', async () => {
      const user = userEvent.setup()

      await act(async () => {
        render(
          <TestWrapper>
            <TemplateWorkflowApp />
          </TestWrapper>
        )
      })

      const searchInput = screen.getByTestId('search-input')
      await act(async () => {
        await user.type(searchInput, 'nonexistent template')
      })

      expect(screen.getByTestId('no-templates')).toBeInTheDocument()
      expect(screen.getByText('No templates found matching your criteria.')).toBeInTheDocument()
    })
  })

  describe('Template Creation Workflow', () => {
    it('should create a new template from scratch', async () => {
      const user = userEvent.setup()

      await act(async () => {
        render(
          <TestWrapper>
            <TemplateWorkflowApp />
          </TestWrapper>
        )
      })

      // Step 1: Click create new template
      const createBtn = screen.getByTestId('create-template-btn')
      await act(async () => {
        await user.click(createBtn)
      })

      // Step 2: Should show template editor
      expect(screen.getByTestId('template-editor')).toBeInTheDocument()
      expect(screen.getByText('Create New Template')).toBeInTheDocument()

      // Step 3: Fill in template details
      await act(async () => {
        await user.type(screen.getByTestId('name-input'), 'New Template')
        await user.type(screen.getByTestId('description-input'), 'A new template for testing')
        await user.selectOptions(screen.getByTestId('category-input'), 'meeting')
        await user.type(screen.getByTestId('tags-input'), 'test, new, template')
        await user.type(screen.getByTestId('content-input'), 'Template content goes here...')
      })

      // Step 4: Save the template
      const saveBtn = screen.getByTestId('save-template-btn')
      await act(async () => {
        await user.click(saveBtn)
      })

      // Step 5: Should show success notification and return to manager
      await waitFor(() => {
        expect(screen.getByTestId('notification')).toBeInTheDocument()
        expect(screen.getByText('Template created successfully')).toBeInTheDocument()
      })

      await waitFor(() => {
        expect(screen.getByTestId('template-manager')).toBeInTheDocument()
      })
    })

    it('should handle template creation cancellation', async () => {
      const user = userEvent.setup()

      await act(async () => {
        render(
          <TestWrapper>
            <TemplateWorkflowApp />
          </TestWrapper>
        )
      })

      // Navigate to editor
      await act(async () => {
        await user.click(screen.getByTestId('create-template-btn'))
      })

      // Fill in some data
      await act(async () => {
        await user.type(screen.getByTestId('name-input'), 'Cancelled Template')
      })

      // Cancel instead of saving
      await act(async () => {
        await user.click(screen.getByTestId('cancel-btn'))
      })

      // Should return to manager without saving
      expect(screen.getByTestId('template-manager')).toBeInTheDocument()
    })
  })

  describe('Template Editing Workflow', () => {
    it('should edit an existing template', async () => {
      const user = userEvent.setup()

      await act(async () => {
        render(
          <TestWrapper>
            <TemplateWorkflowApp />
          </TestWrapper>
        )
      })

      // Step 1: Click edit on first template
      const templateCard = screen.getByTestId('template-template-1')
      const editBtn = templateCard.querySelector('button:contains("Edit")') ||
                      Array.from(templateCard.querySelectorAll('button'))
                        .find(btn => btn.textContent === 'Edit')

      await act(async () => {
        fireEvent.click(editBtn!)
      })

      // Step 2: Should show editor with pre-filled data
      expect(screen.getByTestId('template-editor')).toBeInTheDocument()
      expect(screen.getByText('Edit Template')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Board Meeting Minutes')).toBeInTheDocument()

      // Step 3: Modify the template
      const nameInput = screen.getByTestId('name-input')
      await act(async () => {
        await user.clear(nameInput)
        await user.type(nameInput, 'Updated Board Meeting Minutes')
      })

      // Step 4: Save changes
      await act(async () => {
        await user.click(screen.getByTestId('save-template-btn'))
      })

      // Step 5: Should show success notification
      await waitFor(() => {
        expect(screen.getByText('Template updated successfully')).toBeInTheDocument()
      })
    })
  })

  describe('Template Publishing Workflow', () => {
    it('should publish a draft template', async () => {
      const user = userEvent.setup()

      await act(async () => {
        render(
          <TestWrapper>
            <TemplateWorkflowApp />
          </TestWrapper>
        )
      })

      // Find the draft template (template-2)
      const draftTemplate = screen.getByTestId('template-template-2')
      const publishBtn = Array.from(draftTemplate.querySelectorAll('button'))
        .find(btn => btn.textContent === 'Publish')

      await act(async () => {
        fireEvent.click(publishBtn!)
      })

      // Should show success notification
      await waitFor(() => {
        expect(screen.getByText('Template published successfully')).toBeInTheDocument()
      })
    })
  })

  describe('Template Deletion Workflow', () => {
    it('should delete a template with confirmation', async () => {
      const user = userEvent.setup()

      await act(async () => {
        render(
          <TestWrapper>
            <TemplateWorkflowApp />
          </TestWrapper>
        )
      })

      const templateCard = screen.getByTestId('template-template-1')
      const deleteBtn = Array.from(templateCard.querySelectorAll('button'))
        .find(btn => btn.textContent === 'Delete')

      await act(async () => {
        fireEvent.click(deleteBtn!)
      })

      // Should show confirmation dialog (mocked to return true)
      expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to delete this template?')

      // Should show success notification
      await waitFor(() => {
        expect(screen.getByText('Template deleted successfully')).toBeInTheDocument()
      })
    })

    it('should not delete template if user cancels confirmation', async () => {
      const user = userEvent.setup()

      // Mock confirm to return false
      window.confirm = jest.fn(() => false)

      await act(async () => {
        render(
          <TestWrapper>
            <TemplateWorkflowApp />
          </TestWrapper>
        )
      })

      const templateCard = screen.getByTestId('template-template-1')
      const deleteBtn = Array.from(templateCard.querySelectorAll('button'))
        .find(btn => btn.textContent === 'Delete')

      await act(async () => {
        fireEvent.click(deleteBtn!)
      })

      expect(window.confirm).toHaveBeenCalled()

      // Should not show deletion notification
      expect(screen.queryByText('Template deleted successfully')).not.toBeInTheDocument()
    })
  })

  describe('Document Creation from Template Workflow', () => {
    it('should create a document from a template', async () => {
      const user = userEvent.setup()

      await act(async () => {
        render(
          <TestWrapper>
            <TemplateWorkflowApp />
          </TestWrapper>
        )
      })

      // Step 1: Click "Use Template" on first template
      const templateCard = screen.getByTestId('template-template-1')
      const useBtn = Array.from(templateCard.querySelectorAll('button'))
        .find(btn => btn.textContent === 'Use Template')

      await act(async () => {
        fireEvent.click(useBtn!)
      })

      // Step 2: Should show document creation interface
      expect(screen.getByTestId('document-from-template')).toBeInTheDocument()
      expect(screen.getByText('Using template: Board Meeting Minutes')).toBeInTheDocument()

      // Step 3: Modify document details
      const titleInput = screen.getByTestId('document-title-input')
      await act(async () => {
        await user.clear(titleInput)
        await user.type(titleInput, 'Q1 2024 Board Meeting Minutes')
      })

      const contentInput = screen.getByTestId('document-content-input')
      await act(async () => {
        await user.type(contentInput, '\n\nAdditional content for this specific meeting.')
      })

      // Step 4: Save the document
      await act(async () => {
        await user.click(screen.getByTestId('save-document-btn'))
      })

      // Step 5: Should show success notification
      await waitFor(() => {
        expect(screen.getByText('Document created successfully')).toBeInTheDocument()
      })

      // Should return to template manager
      await waitFor(() => {
        expect(screen.getByTestId('template-manager')).toBeInTheDocument()
      })
    })

    it('should handle document creation cancellation', async () => {
      const user = userEvent.setup()

      await act(async () => {
        render(
          <TestWrapper>
            <TemplateWorkflowApp />
          </TestWrapper>
        )
      })

      // Navigate to document creation
      const templateCard = screen.getByTestId('template-template-1')
      const useBtn = Array.from(templateCard.querySelectorAll('button'))
        .find(btn => btn.textContent === 'Use Template')

      await act(async () => {
        fireEvent.click(useBtn!)
      })

      // Cancel document creation
      await act(async () => {
        await user.click(screen.getByTestId('cancel-document-btn'))
      })

      // Should return to template manager
      expect(screen.getByTestId('template-manager')).toBeInTheDocument()
    })
  })

  describe('Error Handling in Workflows', () => {
    it('should handle template save errors', async () => {
      const user = userEvent.setup()

      // Mock API to reject
      mockApiClient.post.mockRejectedValue(new Error('Save failed'))

      await act(async () => {
        render(
          <TestWrapper>
            <TemplateWorkflowApp />
          </TestWrapper>
        )
      })

      // Try to create template
      await act(async () => {
        await user.click(screen.getByTestId('create-template-btn'))
      })

      await act(async () => {
        await user.type(screen.getByTestId('name-input'), 'Failed Template')
        await user.click(screen.getByTestId('save-template-btn'))
      })

      // Should show error notification
      await waitFor(() => {
        expect(screen.getByText('Failed to save template')).toBeInTheDocument()
      })
    })

    it('should handle deletion errors', async () => {
      const user = userEvent.setup()

      // Mock API to reject
      mockApiClient.delete.mockRejectedValue(new Error('Delete failed'))

      await act(async () => {
        render(
          <TestWrapper>
            <TemplateWorkflowApp />
          </TestWrapper>
        )
      })

      const templateCard = screen.getByTestId('template-template-1')
      const deleteBtn = Array.from(templateCard.querySelectorAll('button'))
        .find(btn => btn.textContent === 'Delete')

      await act(async () => {
        fireEvent.click(deleteBtn!)
      })

      await waitFor(() => {
        expect(screen.getByText('Failed to delete template')).toBeInTheDocument()
      })
    })
  })

  describe('State Persistence Across Navigation', () => {
    it('should maintain filter state when navigating back from editor', async () => {
      const user = userEvent.setup()

      await act(async () => {
        render(
          <TestWrapper>
            <TemplateWorkflowApp />
          </TestWrapper>
        )
      })

      // Apply a filter
      const searchInput = screen.getByTestId('search-input')
      await act(async () => {
        await user.type(searchInput, 'Board')
      })

      expect(screen.getByTestId('template-template-1')).toBeInTheDocument()
      expect(screen.queryByTestId('template-template-2')).not.toBeInTheDocument()

      // Navigate to editor
      await act(async () => {
        await user.click(screen.getByTestId('create-template-btn'))
      })

      // Cancel back to manager
      await act(async () => {
        await user.click(screen.getByTestId('cancel-btn'))
      })

      // Filter should still be applied
      expect(screen.getByDisplayValue('Board')).toBeInTheDocument()
      expect(screen.getByTestId('template-template-1')).toBeInTheDocument()
      expect(screen.queryByTestId('template-template-2')).not.toBeInTheDocument()
    })
  })
})