import type { Document } from '../types'
import type { DeltaOperation } from 'quill'

export function createMockDocument(overrides: Partial<Document> = {}): Document {
  const defaultDoc: Document = {
    id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title: 'Mock Document',
    content: JSON.stringify([
      { insert: 'Sample document content\n' }
    ]),
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    status: 'draft',
    // Legacy fields for backward compatibility
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    author_id: 'user-1'
  }

  return { ...defaultDoc, ...overrides }
}

export function createMockDelta(): DeltaOperation[] {
  return [
    { insert: 'Hello ' },
    { insert: 'World', attributes: { bold: true } },
    { insert: '\n' }
  ]
}

export function createComplexMockDelta(): DeltaOperation[] {
  return [
    { insert: 'Document with placeholders\n' },
    { 
      insert: { 
        'version-table': { 
          version: '1.0', 
          date: '2024-01-01', 
          author: 'Test Author' 
        }
      }
    },
    { insert: '\nSome content with ' },
    { insert: { 'signature': { name: '', date: '', title: '' }}},
    { insert: '\nAnd a line segment: ' },
    { insert: { 'line-segment': { length: 'medium' }}},
    { insert: '\n' }
  ]
}

export function deltaToString(delta: DeltaOperation[]): string {
  return JSON.stringify(delta)
}

export function stringToDelta(content: string): DeltaOperation[] {
  try {
    return JSON.parse(content)
  } catch {
    // Fallback for plain text content
    return [{ insert: content }]
  }
}