/**
 * Comprehensive tests for utility functions
 * Tests document mocking, delta operations, and string conversions
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  createMockDocument,
  createMockDelta,
  createComplexMockDelta,
  deltaToString,
  stringToDelta
} from '../utils'
import type { Document } from '../../types'
import type { DeltaOperation } from 'quill'

describe('Test Utility Functions', () => {
  describe('createMockDocument', () => {
    it('should create a document with default values', () => {
      const doc = createMockDocument()

      expect(doc).toHaveProperty('id')
      expect(doc.id).toMatch(/^doc-\d+-[a-z0-9]+$/)
      expect(doc.title).toBe('Mock Document')
      expect(doc.content).toBe(JSON.stringify([{ insert: 'Sample document content\n' }]))
      expect(doc.version).toBe(1)
      expect(doc.status).toBe('draft')
      expect(doc.createdAt).toBeInstanceOf(Date)
      expect(doc.updatedAt).toBeInstanceOf(Date)
    })

    it('should override default values with provided overrides', () => {
      const overrides: Partial<Document> = {
        title: 'Custom Title',
        version: 5,
        status: 'published',
        content: '{"ops":[{"insert":"Custom content\\n"}]}'
      }

      const doc = createMockDocument(overrides)

      expect(doc.title).toBe('Custom Title')
      expect(doc.version).toBe(5)
      expect(doc.status).toBe('published')
      expect(doc.content).toBe('{"ops":[{"insert":"Custom content\\n"}]}')
      // Should still have default values for non-overridden fields
      expect(doc.id).toMatch(/^doc-\d+-[a-z0-9]+$/)
    })

    it('should maintain legacy field compatibility', () => {
      const doc = createMockDocument()

      expect(doc).toHaveProperty('created_at')
      expect(doc).toHaveProperty('updated_at')
      expect(doc).toHaveProperty('author_id')
      expect(doc.author_id).toBe('user-1')
      expect(typeof doc.created_at).toBe('string')
      expect(typeof doc.updated_at).toBe('string')
    })

    it('should generate unique IDs for multiple documents', () => {
      const doc1 = createMockDocument()
      const doc2 = createMockDocument()
      const doc3 = createMockDocument()

      expect(doc1.id).not.toBe(doc2.id)
      expect(doc2.id).not.toBe(doc3.id)
      expect(doc1.id).not.toBe(doc3.id)
    })

    it('should allow overriding the ID', () => {
      const customId = 'custom-test-id'
      const doc = createMockDocument({ id: customId })

      expect(doc.id).toBe(customId)
    })

    it('should preserve date relationships', () => {
      const doc = createMockDocument()

      expect(doc.createdAt.getTime()).toBeLessThanOrEqual(doc.updatedAt.getTime())
    })

    it('should handle complex override scenarios', () => {
      const customDate = new Date('2024-01-01T00:00:00Z')
      const overrides: Partial<Document> = {
        id: 'test-123',
        title: 'Complex Document',
        content: JSON.stringify([
          { insert: 'Complex content with ' },
          { insert: 'formatting', attributes: { bold: true } },
          { insert: '\n' }
        ]),
        createdAt: customDate,
        updatedAt: customDate,
        version: 10,
        status: 'archived',
        created_at: customDate.toISOString(),
        updated_at: customDate.toISOString(),
        author_id: 'custom-author'
      }

      const doc = createMockDocument(overrides)

      Object.keys(overrides).forEach(key => {
        expect(doc[key as keyof Document]).toEqual(overrides[key as keyof Document])
      })
    })
  })

  describe('createMockDelta', () => {
    it('should create a basic delta with formatted text', () => {
      const delta = createMockDelta()

      expect(delta).toHaveLength(3)
      expect(delta[0]).toEqual({ insert: 'Hello ' })
      expect(delta[1]).toEqual({ insert: 'World', attributes: { bold: true } })
      expect(delta[2]).toEqual({ insert: '\n' })
    })

    it('should create consistent delta structure', () => {
      const delta1 = createMockDelta()
      const delta2 = createMockDelta()

      expect(delta1).toEqual(delta2)
    })

    it('should be valid Quill delta format', () => {
      const delta = createMockDelta()

      // Should be an array of operations
      expect(Array.isArray(delta)).toBe(true)

      // Each operation should have an insert property
      delta.forEach(op => {
        expect(op).toHaveProperty('insert')
        expect(typeof op.insert).toBe('string')
      })

      // Should end with newline
      expect(delta[delta.length - 1].insert).toBe('\n')
    })
  })

  describe('createComplexMockDelta', () => {
    it('should create delta with placeholder objects', () => {
      const delta = createComplexMockDelta()

      expect(delta).toHaveLength(7)

      // Should start with text
      expect(delta[0]).toEqual({ insert: 'Document with placeholders\n' })

      // Should contain version table
      expect(delta[1]).toEqual({
        insert: {
          'version-table': {
            version: '1.0',
            date: '2024-01-01',
            author: 'Test Author'
          }
        }
      })

      // Should contain signature placeholder
      expect(delta[3]).toEqual({
        insert: { 'signature': { name: '', date: '', title: '' } }
      })

      // Should contain line segment placeholder
      expect(delta[5]).toEqual({
        insert: { 'line-segment': { length: 'medium' } }
      })
    })

    it('should include all placeholder types', () => {
      const delta = createComplexMockDelta()
      const placeholderTypes = []

      delta.forEach(op => {
        if (op.insert && typeof op.insert === 'object' && typeof op.insert !== 'string') {
          placeholderTypes.push(...Object.keys(op.insert))
        }
      })

      expect(placeholderTypes).toContain('version-table')
      expect(placeholderTypes).toContain('signature')
      expect(placeholderTypes).toContain('line-segment')
    })

    it('should maintain proper structure for each placeholder', () => {
      const delta = createComplexMockDelta()

      // Version table structure
      const versionTableOp = delta.find(op =>
        op.insert && typeof op.insert === 'object' && 'version-table' in op.insert
      )
      expect(versionTableOp?.insert['version-table']).toHaveProperty('version')
      expect(versionTableOp?.insert['version-table']).toHaveProperty('date')
      expect(versionTableOp?.insert['version-table']).toHaveProperty('author')

      // Signature structure
      const signatureOp = delta.find(op =>
        op.insert && typeof op.insert === 'object' && 'signature' in op.insert
      )
      expect(signatureOp?.insert['signature']).toHaveProperty('name')
      expect(signatureOp?.insert['signature']).toHaveProperty('date')
      expect(signatureOp?.insert['signature']).toHaveProperty('title')

      // Line segment structure
      const lineSegmentOp = delta.find(op =>
        op.insert && typeof op.insert === 'object' && 'line-segment' in op.insert
      )
      expect(lineSegmentOp?.insert['line-segment']).toHaveProperty('length')
      expect(lineSegmentOp?.insert['line-segment'].length).toBe('medium')
    })

    it('should be serializable to JSON', () => {
      const delta = createComplexMockDelta()

      expect(() => JSON.stringify(delta)).not.toThrow()

      const serialized = JSON.stringify(delta)
      const parsed = JSON.parse(serialized)

      expect(parsed).toEqual(delta)
    })
  })

  describe('deltaToString', () => {
    it('should convert simple delta to JSON string', () => {
      const delta: DeltaOperation[] = [
        { insert: 'Hello World\n' }
      ]

      const result = deltaToString(delta)

      expect(typeof result).toBe('string')
      expect(result).toBe('[{"insert":"Hello World\\n"}]')
    })

    it('should convert complex delta with attributes', () => {
      const delta: DeltaOperation[] = [
        { insert: 'Hello ' },
        { insert: 'World', attributes: { bold: true, italic: true } },
        { insert: '\n' }
      ]

      const result = deltaToString(delta)
      const parsed = JSON.parse(result)

      expect(parsed).toEqual(delta)
    })

    it('should handle delta with placeholder objects', () => {
      const delta = createComplexMockDelta()

      const result = deltaToString(delta)
      const parsed = JSON.parse(result)

      expect(parsed).toEqual(delta)
    })

    it('should handle empty delta', () => {
      const delta: DeltaOperation[] = []

      const result = deltaToString(delta)

      expect(result).toBe('[]')
    })

    it('should be reversible with stringToDelta', () => {
      const originalDelta = createMockDelta()

      const stringified = deltaToString(originalDelta)
      const parsed = stringToDelta(stringified)

      expect(parsed).toEqual(originalDelta)
    })

    it('should handle special characters and unicode', () => {
      const delta: DeltaOperation[] = [
        { insert: 'Special chars: áéíóú ñ 中文 🌟 "quotes" \'apostrophes\' \n' }
      ]

      const result = deltaToString(delta)
      const parsed = JSON.parse(result)

      expect(parsed).toEqual(delta)
    })
  })

  describe('stringToDelta', () => {
    it('should parse valid JSON delta string', () => {
      const deltaString = '[{"insert":"Hello World\\n"}]'

      const result = stringToDelta(deltaString)

      expect(result).toEqual([{ insert: 'Hello World\n' }])
    })

    it('should parse complex delta with attributes', () => {
      const delta: DeltaOperation[] = [
        { insert: 'Hello ' },
        { insert: 'World', attributes: { bold: true } },
        { insert: '\n' }
      ]
      const deltaString = JSON.stringify(delta)

      const result = stringToDelta(deltaString)

      expect(result).toEqual(delta)
    })

    it('should parse delta with placeholder objects', () => {
      const originalDelta = createComplexMockDelta()
      const deltaString = deltaToString(originalDelta)

      const result = stringToDelta(deltaString)

      expect(result).toEqual(originalDelta)
    })

    it('should fallback to plain text for invalid JSON', () => {
      const plainText = 'This is not JSON'

      const result = stringToDelta(plainText)

      expect(result).toEqual([{ insert: 'This is not JSON' }])
    })

    it('should handle empty string', () => {
      const result = stringToDelta('')

      expect(result).toEqual([{ insert: '' }])
    })

    it('should handle malformed JSON gracefully', () => {
      const malformedJson = '{"insert":"incomplete'

      const result = stringToDelta(malformedJson)

      expect(result).toEqual([{ insert: '{"insert":"incomplete' }])
    })

    it('should handle null and undefined gracefully', () => {
      const resultNull = stringToDelta('null')
      const resultUndefined = stringToDelta('undefined')

      expect(resultNull).toEqual([{ insert: 'null' }])
      expect(resultUndefined).toEqual([{ insert: 'undefined' }])
    })

    it('should preserve data types in parsed delta', () => {
      const delta: DeltaOperation[] = [
        { insert: 'Text with number: ' },
        { insert: '42', attributes: { bold: true } },
        { insert: '\n' },
        { insert: { 'version-table': { version: '1.0', date: '2024-01-01' } } }
      ]
      const deltaString = JSON.stringify(delta)

      const result = stringToDelta(deltaString)

      // Check that attributes are preserved as objects
      expect(result[1].attributes).toEqual({ bold: true })

      // Check that placeholder objects are preserved
      expect(result[3].insert).toEqual({
        'version-table': { version: '1.0', date: '2024-01-01' }
      })
    })

    it('should be reversible with deltaToString', () => {
      const originalString = JSON.stringify(createMockDelta())

      const delta = stringToDelta(originalString)
      const backToString = deltaToString(delta)

      expect(backToString).toBe(originalString)
    })
  })

  describe('Integration between utility functions', () => {
    it('should work together for document creation workflow', () => {
      const delta = createComplexMockDelta()
      const content = deltaToString(delta)
      const document = createMockDocument({
        title: 'Integration Test Document',
        content
      })

      expect(document.content).toBe(content)

      const parsedDelta = stringToDelta(document.content)
      expect(parsedDelta).toEqual(delta)
    })

    it('should handle round-trip conversions without data loss', () => {
      const originalDelta = createComplexMockDelta()

      // Delta -> String -> Delta
      const stringified = deltaToString(originalDelta)
      const reparsed = stringToDelta(stringified)

      expect(reparsed).toEqual(originalDelta)

      // Document -> Content -> Delta -> String -> Delta
      const document = createMockDocument({ content: stringified })
      const documentDelta = stringToDelta(document.content)
      const documentString = deltaToString(documentDelta)
      const finalDelta = stringToDelta(documentString)

      expect(finalDelta).toEqual(originalDelta)
    })

    it('should maintain consistency across multiple operations', () => {
      const deltas = [
        createMockDelta(),
        createComplexMockDelta(),
        [{ insert: 'Simple text\n' }],
        []
      ]

      deltas.forEach(delta => {
        const stringified = deltaToString(delta)
        const parsed = stringToDelta(stringified)
        expect(parsed).toEqual(delta)
      })
    })

    it('should support building complex document scenarios', () => {
      // Simulate creating a document with complex content
      const versionTable = {
        insert: {
          'version-table': {
            version: '2.1',
            date: '2024-02-15',
            author: 'Integration Test Author'
          }
        }
      }

      const signature = {
        insert: {
          'signature': {
            name: 'John Doe',
            date: '2024-02-15',
            title: 'Manager'
          }
        }
      }

      const complexDelta: DeltaOperation[] = [
        { insert: 'Integration Test Document\n' },
        versionTable,
        { insert: '\nThis is the document content with ' },
        { insert: 'formatted text', attributes: { bold: true, underline: true } },
        { insert: ' and placeholders.\n\nSignature section:\n' },
        signature,
        { insert: '\nEnd of document.\n' }
      ]

      const document = createMockDocument({
        title: 'Complex Integration Document',
        content: deltaToString(complexDelta),
        status: 'published',
        version: 2
      })

      // Verify document structure
      expect(document.title).toBe('Complex Integration Document')
      expect(document.status).toBe('published')
      expect(document.version).toBe(2)

      // Verify content preservation
      const retrievedDelta = stringToDelta(document.content)
      expect(retrievedDelta).toEqual(complexDelta)

      // Verify specific placeholder data
      const versionTableOp = retrievedDelta.find(op =>
        op.insert && typeof op.insert === 'object' && 'version-table' in op.insert
      )
      expect(versionTableOp?.insert['version-table'].version).toBe('2.1')

      const signatureOp = retrievedDelta.find(op =>
        op.insert && typeof op.insert === 'object' && 'signature' in op.insert
      )
      expect(signatureOp?.insert['signature'].name).toBe('John Doe')
    })
  })
})