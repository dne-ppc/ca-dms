import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Sidebar } from '../components/layout/Sidebar'
import { MainContent } from '../components/layout/MainContent'

interface Document {
  id: string
  title: string
  document_type: string
  version: number
  created_at: string
  updated_at: string
}

const Dashboard = () => {
  const [documents, setDocuments] = useState<Document[]>([])
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [sortBy, setSortBy] = useState('updated_at')
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([])
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [selectMode, setSelectMode] = useState(false)

  useEffect(() => {
    fetchDocuments()
  }, [])

  useEffect(() => {
    filterAndSortDocuments()
  }, [documents, searchQuery, filterType, sortBy])

  const filterAndSortDocuments = () => {
    let filtered = [...documents]

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(doc => 
        doc.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(doc => doc.document_type === filterType)
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title)
        case 'created_at':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'updated_at':
        default:
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      }
    })

    setFilteredDocuments(filtered)
  }

  const fetchDocuments = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/v1/documents/')
      if (!response.ok) {
        throw new Error('Failed to fetch documents')
      }
      const data = await response.json()
      setDocuments(data.documents)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const toggleSelectMode = () => {
    setSelectMode(!selectMode)
    setSelectedDocuments([])
  }

  const toggleDocumentSelection = (docId: string) => {
    setSelectedDocuments(prev => 
      prev.includes(docId) 
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    )
  }

  const selectAllDocuments = () => {
    if (selectedDocuments.length === filteredDocuments.length) {
      setSelectedDocuments([])
    } else {
      setSelectedDocuments(filteredDocuments.map(doc => doc.id))
    }
  }

  const bulkDeleteDocuments = async () => {
    if (selectedDocuments.length === 0) return
    
    const confirmMessage = `Are you sure you want to delete ${selectedDocuments.length} document(s)?`
    if (!window.confirm(confirmMessage)) return

    setBulkActionLoading(true)
    try {
      const deletePromises = selectedDocuments.map(docId => 
        fetch(`http://localhost:8000/api/v1/documents/${docId}`, {
          method: 'DELETE'
        })
      )
      
      await Promise.all(deletePromises)
      setSelectedDocuments([])
      setSelectMode(false)
      fetchDocuments()
    } catch (error) {
      setError('Failed to delete documents: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setBulkActionLoading(false)
    }
  }

  const bulkExportDocuments = async () => {
    if (selectedDocuments.length === 0) return
    
    setBulkActionLoading(true)
    try {
      const exportPromises = selectedDocuments.map(docId => 
        window.open(`http://localhost:8000/api/v1/documents/${docId}/pdf`, '_blank')
      )
      
      await Promise.all(exportPromises)
      setSelectedDocuments([])
    } catch (error) {
      setError('Failed to export documents: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setBulkActionLoading(false)
    }
  }

  if (loading) return <div className="dashboard loading">Loading documents...</div>
  if (error) return <div className="dashboard error">Error: {error}</div>

  return (
    <>
      <Sidebar title="Document Controls">
        <div className="document-controls">
          <div className="control-section">
            <h4>Actions</h4>
            <div className="dashboard-actions">
              <Link to="/editor" className="create-button">
                Create New Document
              </Link>
              <button 
                onClick={toggleSelectMode} 
                className={`select-mode-button ${selectMode ? 'active' : ''}`}
              >
                {selectMode ? 'Cancel Selection' : 'Select Documents'}
              </button>
              <button onClick={fetchDocuments} className="refresh-button" disabled={loading}>
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>

          <div className="control-section">
            <h4>Search & Filter</h4>
            <div className="search-box">
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>
            
            <div className="filter-controls">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Types</option>
                <option value="governance">Governance</option>
                <option value="policy">Policy</option>
                <option value="meeting">Meeting</option>
                <option value="notice">Notice</option>
                <option value="form">Form</option>
              </select>
              
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="sort-select"
              >
                <option value="updated_at">Last Updated</option>
                <option value="created_at">Date Created</option>
                <option value="title">Title A-Z</option>
              </select>
            </div>
          </div>

          {selectMode && (
            <div className="control-section">
              <h4>Bulk Actions</h4>
              <div className="bulk-actions">
                <button 
                  onClick={selectAllDocuments}
                  className="select-all-button"
                  disabled={filteredDocuments.length === 0}
                >
                  {selectedDocuments.length === filteredDocuments.length ? 'Deselect All' : 'Select All'}
                </button>
                <button 
                  onClick={bulkExportDocuments}
                  className="bulk-export-button"
                  disabled={selectedDocuments.length === 0 || bulkActionLoading}
                >
                  {bulkActionLoading ? 'Exporting...' : `Export (${selectedDocuments.length})`}
                </button>
                <button 
                  onClick={bulkDeleteDocuments}
                  className="bulk-delete-button"
                  disabled={selectedDocuments.length === 0 || bulkActionLoading}
                >
                  {bulkActionLoading ? 'Deleting...' : `Delete (${selectedDocuments.length})`}
                </button>
              </div>
            </div>
          )}
        </div>
      </Sidebar>

      <MainContent>
        <div className="dashboard">
          <div className="dashboard-header">
            <h1>CA-DMS Dashboard</h1>
            <p>Welcome to the Community Association Document Management System</p>
          </div>

          <div className="documents-section">
            <div className="section-header">
              <h2>Documents ({filteredDocuments.length} of {documents.length})
                {selectMode && selectedDocuments.length > 0 && (
                  <span className="selection-count"> - {selectedDocuments.length} selected</span>
                )}
              </h2>
            </div>
        
        {filteredDocuments.length === 0 && documents.length === 0 ? (
          <div className="empty-state">
            <p>No documents found. Create your first document to get started.</p>
            <Link to="/editor" className="create-button">
              Create Document
            </Link>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="no-results">
            <p>No documents match your search criteria.</p>
            <button 
              onClick={() => {
                setSearchQuery('')
                setFilterType('all')
              }}
              className="clear-filters-button"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="documents-grid">
            {filteredDocuments.map((doc) => (
              <div 
                key={doc.id} 
                className={`document-card ${selectMode ? 'select-mode' : ''} ${selectedDocuments.includes(doc.id) ? 'selected' : ''}`}
              >
                {selectMode && (
                  <div className="document-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedDocuments.includes(doc.id)}
                      onChange={() => toggleDocumentSelection(doc.id)}
                      className="doc-select-checkbox"
                    />
                  </div>
                )}
                <div className="document-header">
                  <h3>{doc.title}</h3>
                  <div className="document-badges">
                    <span className="document-type">{doc.document_type}</span>
                    <span className="version-badge">v{doc.version}</span>
                  </div>
                </div>
                <div className="document-meta">
                  <div className="meta-row">
                    <span className="meta-label">Created:</span>
                    <span className="meta-value">{formatDate(doc.created_at)}</span>
                  </div>
                  <div className="meta-row">
                    <span className="meta-label">Updated:</span>
                    <span className="meta-value">{formatDate(doc.updated_at)}</span>
                  </div>
                  {doc.created_at !== doc.updated_at && (
                    <div className="meta-row">
                      <span className="meta-label">Status:</span>
                      <span className="meta-value status-modified">Modified</span>
                    </div>
                  )}
                </div>
                <div className="document-actions">
                  <Link to={`/editor/${doc.id}`} className="edit-button">
                    Edit
                  </Link>
                  <button 
                    onClick={() => window.open(`http://localhost:8000/api/v1/documents/${doc.id}/pdf`, '_blank')}
                    className="pdf-button"
                  >
                    View PDF
                  </button>
                </div>
              </div>
            ))}
            </div>
          )}
          </div>
        </div>
      </MainContent>
    </>
  )
}

export default Dashboard
