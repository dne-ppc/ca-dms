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
}