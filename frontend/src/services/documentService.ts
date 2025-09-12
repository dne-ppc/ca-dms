import { apiClient } from './api'
import type { Document, PlaceholderObject, CreateDocumentData } from '../types'

// Enhanced document data with placeholder support
export interface DocumentWithPlaceholders extends Document {
  placeholders?: PlaceholderObject[]
}

export interface CreateDocumentWithPlaceholdersData {
  title: string
  content: string
  placeholders?: PlaceholderObject[]
}

export interface UpdateDocumentWithPlaceholdersData {
  title?: string
  content?: string
  placeholders?: PlaceholderObject[]
  status?: 'draft' | 'published' | 'archived'
}

export interface SearchDocumentParams {
  query?: string
  status?: 'draft' | 'published' | 'archived'
  authorId?: string
}

export interface BulkCreateResult {
  created: number
  failed: number
  errors?: string[]
}

// Advanced search types
export interface SearchHighlight {
  field: string
  content: string
}

export interface SearchResult {
  document: any // Use any for now to handle backend format
  relevance_score: number
  highlights: SearchHighlight[]
  preview?: string
}

export interface SearchStatistics {
  total_matches: number
  search_time_ms: number
  document_type_breakdown: Record<string, number>
  query?: string
  timestamp: string
}

export interface AdvancedSearchResponse {
  results: SearchResult[]
  total: number
  query?: string
  statistics?: SearchStatistics
  offset: number
  limit: number
}

export interface AdvancedSearchParams {
  query?: string
  documentType?: string
  createdBy?: string
  createdAfter?: string
  createdBefore?: string
  sortBy?: 'relevance' | 'created_at' | 'title'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
  highlight?: boolean
  contextLength?: number
  searchPlaceholders?: boolean
  fuzzy?: boolean
  includeStats?: boolean
}

// Utility function for retry logic
const retry = async <T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: Error
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      if (attempt === maxAttempts) {
        throw lastError
      }
      await new Promise(resolve => setTimeout(resolve, delay * attempt))
    }
  }
  
  throw lastError!
}

export const documentService = {
  // Basic CRUD operations
  async getDocuments(): Promise<Document[]> {
    const response = await apiClient.get<Document[]>('/documents')
    if (!response.success) {
      throw new Error(response.message || 'Failed to get documents')
    }
    return response.data || []
  },

  async getDocument(id: string): Promise<Document> {
    const response = await apiClient.get<Document>(`/documents/${id}`)
    if (!response.success) {
      throw new Error(response.message || 'Failed to get document')
    }
    return response.data
  },

  async createDocument(
    data: CreateDocumentData
  ): Promise<Document> {
    const response = await apiClient.post<Document>('/documents', data)
    if (!response.success) {
      throw new Error(response.message || 'Failed to create document')
    }
    return response.data
  },

  async updateDocument(
    id: string,
    data: Partial<Omit<Document, 'id' | 'created_at'>>
  ): Promise<Document> {
    const response = await apiClient.put<Document>(`/documents/${id}`, data)
    if (!response.success) {
      throw new Error(response.message || 'Failed to update document')
    }
    return response.data
  },

  async deleteDocument(id: string): Promise<void> {
    const response = await apiClient.delete(`/documents/${id}`)
    if (!response.success) {
      throw new Error(response.message || 'Failed to delete document')
    }
  },

  // Enhanced operations with placeholder support
  async getDocumentsWithPlaceholders(): Promise<DocumentWithPlaceholders[]> {
    const response = await apiClient.get<DocumentWithPlaceholders[]>('/documents?include=placeholders')
    if (!response.success) {
      throw new Error(response.message || 'Failed to get documents with placeholders')
    }
    return response.data || []
  },

  async createDocumentWithPlaceholders(
    data: CreateDocumentWithPlaceholdersData
  ): Promise<Document> {
    // Validate placeholders before sending
    if (data.placeholders) {
      data.placeholders.forEach(placeholder => {
        this.validatePlaceholderData(placeholder)
      })
    }
    
    const response = await apiClient.post<Document>('/documents', data)
    if (!response.success) {
      throw new Error(response.message || 'Failed to create document with placeholders')
    }
    return response.data
  },

  async updateDocumentWithPlaceholders(
    id: string,
    data: UpdateDocumentWithPlaceholdersData
  ): Promise<Document> {
    // Validate placeholders before sending
    if (data.placeholders) {
      data.placeholders.forEach(placeholder => {
        this.validatePlaceholderData(placeholder)
      })
    }
    
    const response = await apiClient.put<Document>(`/documents/${id}`, data)
    if (!response.success) {
      throw new Error(response.message || 'Failed to update document with placeholders')
    }
    return response.data
  },

  // Placeholder data serialization utilities
  serializePlaceholders(placeholders: PlaceholderObject[]): PlaceholderObject[] {
    return placeholders.map(placeholder => ({
      ...placeholder,
      data: typeof placeholder.data === 'string' 
        ? JSON.parse(placeholder.data) 
        : placeholder.data
    }))
  },

  deserializePlaceholders(placeholders: any[]): PlaceholderObject[] {
    return placeholders.map(placeholder => ({
      id: placeholder.id,
      type: placeholder.type,
      data: typeof placeholder.data === 'string' 
        ? JSON.parse(placeholder.data) 
        : placeholder.data,
      position: placeholder.position
    }))
  },

  validatePlaceholderData(placeholder: PlaceholderObject): void {
    if (!placeholder.id || placeholder.id.trim() === '') {
      throw new Error('Invalid placeholder: ID cannot be empty')
    }
    if (!placeholder.type) {
      throw new Error('Invalid placeholder: Type is required')
    }
    if (placeholder.position !== undefined && placeholder.position < 0) {
      throw new Error('Invalid placeholder: Position cannot be negative')
    }
    if (!placeholder.data) {
      throw new Error('Invalid placeholder: Data is required')
    }
  },

  // Error handling and retry operations
  async getDocumentsWithRetry(maxAttempts: number = 3): Promise<Document[]> {
    return retry(async () => {
      return this.getDocuments()
    }, maxAttempts)
  },

  // Advanced operations
  async bulkCreateDocuments(
    documents: CreateDocumentData[]
  ): Promise<BulkCreateResult> {
    const response = await apiClient.post<BulkCreateResult>('/documents/bulk', { documents })
    if (!response.success) {
      throw new Error(response.message || 'Failed to bulk create documents')
    }
    return response.data
  },

  async searchDocuments(params: SearchDocumentParams): Promise<Document[]> {
    const searchParams = new URLSearchParams()
    if (params.query) searchParams.append('query', params.query)
    if (params.status) searchParams.append('status', params.status)
    if (params.authorId) searchParams.append('authorId', params.authorId)
    
    const response = await apiClient.get<Document[]>(`/documents/search?${searchParams}`)
    if (!response.success) {
      throw new Error(response.message || 'Failed to search documents')
    }
    return response.data || []
  },

  // Advanced search with full-text, filtering, and highlighting
  async advancedSearch(params: AdvancedSearchParams): Promise<AdvancedSearchResponse> {
    const searchParams = new URLSearchParams()
    
    if (params.query) searchParams.append('query', params.query)
    if (params.documentType) searchParams.append('document_type', params.documentType)
    if (params.createdBy) searchParams.append('created_by', params.createdBy)
    if (params.createdAfter) searchParams.append('created_after', params.createdAfter)
    if (params.createdBefore) searchParams.append('created_before', params.createdBefore)
    if (params.sortBy) searchParams.append('sort_by', params.sortBy)
    if (params.sortOrder) searchParams.append('sort_order', params.sortOrder)
    if (params.limit) searchParams.append('limit', params.limit.toString())
    if (params.offset) searchParams.append('offset', params.offset.toString())
    if (params.highlight) searchParams.append('highlight', params.highlight.toString())
    if (params.contextLength) searchParams.append('context_length', params.contextLength.toString())
    if (params.searchPlaceholders !== undefined) searchParams.append('search_placeholders', params.searchPlaceholders.toString())
    if (params.fuzzy) searchParams.append('fuzzy', params.fuzzy.toString())
    if (params.includeStats) searchParams.append('include_stats', params.includeStats.toString())

    const url = `/documents/advanced-search?${searchParams}`
    try {
      const response = await apiClient.get<AdvancedSearchResponse>(url)
      
      // Handle direct response from backend (FastAPI returns data directly)
      if (response && typeof response === 'object' && 'results' in response) {
        return response as AdvancedSearchResponse
      }
      
      // Handle wrapped response format
      if (!response.success) {
        throw new Error(response.message || 'Failed to perform advanced search')
      }
      return response.data
    } catch (error) {
      // Enhanced error handling for debugging
      console.error('Advanced search error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to perform advanced search')
    }
  },
}