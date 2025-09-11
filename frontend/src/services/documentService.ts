import { apiClient } from './api'
import type { Document } from '../types'

export const documentService = {
  async getDocuments(): Promise<Document[]> {
    const response = await apiClient.get<Document[]>('/documents')
    return response.data
  },

  async getDocument(id: string): Promise<Document> {
    const response = await apiClient.get<Document>(`/documents/${id}`)
    return response.data
  },

  async createDocument(
    data: Omit<Document, 'id' | 'created_at' | 'updated_at' | 'version'>
  ): Promise<Document> {
    const response = await apiClient.post<Document>('/documents', data)
    return response.data
  },

  async updateDocument(
    id: string,
    data: Partial<Omit<Document, 'id' | 'created_at'>>
  ): Promise<Document> {
    const response = await apiClient.put<Document>(`/documents/${id}`, data)
    return response.data
  },

  async deleteDocument(id: string): Promise<void> {
    await apiClient.delete(`/documents/${id}`)
  },
}
