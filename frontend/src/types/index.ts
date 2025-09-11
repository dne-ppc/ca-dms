// Core document types
export interface Document {
  id: string
  title: string
  content: string // Quill Delta JSON
  created_at: string
  updated_at: string
  version: number
  author_id: string
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
