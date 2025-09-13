export interface Document {
  id: string
  title: string
  content: any
  created_at: string
  updated_at: string
  author_id?: string
  status?: 'draft' | 'published' | 'archived'
  version?: number
}

export interface DocumentVersion {
  id: string
  document_id: string
  version_number: number
  content: any
  created_at: string
  created_by: string
  change_summary?: string
}