import React, { useState, useMemo } from 'react'
import { Search, FileText, Clock, User, X, ChevronDown, ChevronUp } from 'lucide-react'
import { DocumentTemplateManager } from './DocumentTemplateManager'
import type { DocumentTemplate } from './DocumentTemplateManager'

interface DocumentTemplateSelectorProps {
  isOpen: boolean
  onClose: () => void
  onTemplateSelect: (template: DocumentTemplate) => void
  className?: string
}

export const DocumentTemplateSelector: React.FC<DocumentTemplateSelectorProps> = ({
  isOpen,
  onClose,
  onTemplateSelect,
  className = ''
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  // Get all templates and categories
  const allTemplates = DocumentTemplateManager.getAllTemplates()
  const categories = DocumentTemplateManager.getTemplateCategories()
  const popularTemplates = DocumentTemplateManager.getPopularTemplates(3)
  const recentTemplates = DocumentTemplateManager.getRecentlyUsedTemplates()

  // Filter templates based on search and category
  const filteredTemplates = useMemo(() => {
    let templates = allTemplates

    // Filter by search query
    if (searchQuery.trim()) {
      templates = DocumentTemplateManager.searchTemplates(searchQuery)
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      templates = templates.filter(template => template.category === selectedCategory)
    }

    return templates
  }, [allTemplates, searchQuery, selectedCategory])

  const handleTemplateClick = (template: DocumentTemplate) => {
    setSelectedTemplate(template)
    setShowPreview(true)
  }

  const handleUseTemplate = (template: DocumentTemplate) => {
    DocumentTemplateManager.incrementPopularity(template.id)
    onTemplateSelect(template)
    onClose()
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-green-100 text-green-800'
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-800'
      case 'advanced':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (!isOpen) return null

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 ${className}`}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[80vh] flex overflow-hidden">
        {/* Left Panel - Template Browser */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900">Choose Document Template</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close template selector"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Search and Filters */}
          <div className="p-6 border-b border-gray-200">
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search templates..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Category Filter */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedCategory === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All Templates
                </button>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedCategory === category.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {category.icon} {category.name} ({category.count})
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Access Sections */}
            {!searchQuery && selectedCategory === 'all' && (
              <div className="mt-6 space-y-4">
                {/* Popular Templates */}
                {popularTemplates.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-2">🔥 Popular Templates</h3>
                    <div className="flex gap-2 overflow-x-auto">
                      {popularTemplates.map((template) => (
                        <button
                          key={template.id}
                          onClick={() => handleTemplateClick(template)}
                          className="flex-shrink-0 p-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          <div className="text-lg">{template.icon}</div>
                          <div className="text-xs font-medium text-blue-900 mt-1">{template.name}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Templates */}
                {recentTemplates.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-2">⏰ Recently Used</h3>
                    <div className="flex gap-2 overflow-x-auto">
                      {recentTemplates.map((template) => (
                        <button
                          key={template.id}
                          onClick={() => handleTemplateClick(template)}
                          className="flex-shrink-0 p-3 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                        >
                          <div className="text-lg">{template.icon}</div>
                          <div className="text-xs font-medium text-green-900 mt-1">{template.name}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Template List */}
          <div className="flex-1 overflow-y-auto p-6">
            {filteredTemplates.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No templates found matching your criteria.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredTemplates.map((template) => (
                  <div
                    key={template.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
                      selectedTemplate?.id === template.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleTemplateClick(template)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">{template.icon}</div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{template.name}</h3>
                        <p className="text-sm text-gray-600 line-clamp-2 mt-1">{template.description}</p>

                        <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                          <span className={`px-2 py-1 rounded-full ${getDifficultyColor(template.metadata.difficulty)}`}>
                            {template.metadata.difficulty}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {template.metadata.estimatedTime}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {template.metadata.author}
                          </span>
                        </div>

                        <div className="flex items-center justify-between mt-3">
                          <div className="flex flex-wrap gap-1">
                            {template.metadata.tags.slice(0, 2).map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded"
                              >
                                {tag}
                              </span>
                            ))}
                            {template.metadata.tags.length > 2 && (
                              <span className="text-xs text-gray-500">
                                +{template.metadata.tags.length - 2} more
                              </span>
                            )}
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleUseTemplate(template)
                            }}
                            className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                          >
                            Use Template
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Template Preview */}
        {selectedTemplate && (
          <div className="w-96 border-l border-gray-200 flex flex-col">
            {/* Preview Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Template Preview</h3>
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  {showPreview ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{selectedTemplate.icon}</span>
                  <div>
                    <h4 className="font-medium text-gray-900">{selectedTemplate.name}</h4>
                    <p className="text-sm text-gray-600">{selectedTemplate.category}</p>
                  </div>
                </div>

                <p className="text-sm text-gray-700">{selectedTemplate.description}</p>

                <div className="flex flex-wrap gap-2">
                  {selectedTemplate.metadata.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Difficulty:</span>
                    <span className={`px-2 py-1 rounded text-xs ${getDifficultyColor(selectedTemplate.metadata.difficulty)}`}>
                      {selectedTemplate.metadata.difficulty}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Estimated Time:</span>
                    <span className="text-gray-900">{selectedTemplate.metadata.estimatedTime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Placeholders:</span>
                    <span className="text-gray-900">{selectedTemplate.placeholders.length}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleUseTemplate(selectedTemplate)}
                  className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Use This Template
                </button>
              </div>
            </div>

            {/* Template Content Preview */}
            {showPreview && (
              <div className="flex-1 overflow-y-auto p-6">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Content Preview</h4>
                <div className="text-sm text-gray-700 space-y-2 bg-gray-50 p-4 rounded border">
                  <div className="font-mono text-xs">
                    {selectedTemplate.preview}
                  </div>
                  <div className="border-t pt-2 mt-2">
                    <div className="text-xs text-gray-500 mb-2">Placeholders included:</div>
                    <div className="flex flex-wrap gap-1">
                      {selectedTemplate.placeholders.map((placeholder, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                        >
                          {placeholder}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Hook for template selector functionality
export const useDocumentTemplateSelector = () => {
  const [isOpen, setIsOpen] = useState(false)

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen(prev => !prev)
  }
}