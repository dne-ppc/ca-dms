/**
 * Search Page - Showcasing Advanced Search Functionality
 * Task EXTRA.4: Advanced Search and Filtering
 */
import React, { useState } from 'react'
import AdvancedSearch from '../components/search/AdvancedSearch'
import { useNavigate } from 'react-router-dom'
import './Search.css'

const Search: React.FC = () => {
  const navigate = useNavigate()
  const [selectedDocument, setSelectedDocument] = useState<any>(null)

  const handleDocumentSelect = (document: any) => {
    setSelectedDocument(document)
    // Navigate to document editor or viewer
    navigate(`/editor/${document.id}`)
  }

  return (
    <div className="search-page">
      <div className="search-header">
        <h1>Advanced Document Search</h1>
        <p>Search across all documents with powerful filtering, highlighting, and relevance scoring</p>
      </div>
      
      <div className="search-container">
        <AdvancedSearch
          onResultSelect={handleDocumentSelect}
          className="advanced-search-component"
        />
      </div>
    </div>
  )
}

export default Search