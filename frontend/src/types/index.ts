// Core document types
export interface Document {
  id: string
  title: string
  content: string // Quill Delta JSON
  createdAt: Date
  updatedAt: Date
  version: number
  status: 'draft' | 'published' | 'archived'
  authorId?: string
  // Legacy fields for backward compatibility
  created_at?: string
  updated_at?: string
  author_id?: string
}

// Document creation data
export interface CreateDocumentData {
  title: string
  content: string
}

// Document metadata updates
export interface DocumentMetadataUpdate {
  title?: string
  status?: 'draft' | 'published' | 'archived'
}

// Document statistics
export interface DocumentStats {
  totalDocuments: number
  draftDocuments: number
  publishedDocuments: number
  archivedDocuments: number
}

// Store state for import/export
export interface DocumentStoreState {
  documents: Document[]
  currentDocument: Document | null
}

// Placeholder object types and management
export type PlaceholderType = 'version-table' | 'signature' | 'long-response' | 'line-segment'

export interface PlaceholderObject {
  id: string
  type: PlaceholderType
  data: any
  position?: number // Position within the document Delta
}

export interface PlaceholderValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export interface PlaceholderStats {
  totalPlaceholders: number
  versionTables: number
  signatures: number
  longResponses: number
  lineSegments: number
}

// User types
export interface User {
  id: string
  email: string
  role: 'admin' | 'editor' | 'viewer'
  created_at: string
}

// Placeholder object types
export interface VersionTableData {
  version: string
  date: string
  description: string
  author: string
}

export interface SignatureField {
  id: string
  label: string
  required: boolean
  signed_by?: string
  signed_at?: string
}

export interface LongResponseArea {
  id: string
  label: string
  placeholder: string
  min_length?: number
  max_length?: number
  content?: string
}

export interface LineSegment {
  id: string
  label: string
  type: 'short' | 'medium' | 'long'
  content?: string
}

// API response types
export interface ApiResponse<T> {
  data: T
  success: boolean
  message?: string
}
