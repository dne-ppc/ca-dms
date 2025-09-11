import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useDocumentStore } from '../../stores/documentStore'
import { createMockDocument, createComplexMockDelta, deltaToString } from '../utils'
import type { PlaceholderObject, PlaceholderType, CreateDocumentData } from '../../types'
import type { DeltaOperation } from 'quill'

describe('DocumentStore - Task 3.1.2: Enhanced Placeholder State Management', () => {
  beforeEach(() => {
    // Reset the store state before each test
    const { result } = renderHook(() => useDocumentStore())
    act(() => {
      result.current.clearStore()
    })
  })

  describe('Placeholder Object Tracking', () => {
    it('should extract placeholder objects from document Delta content', () => {
      const { result } = renderHook(() => useDocumentStore())
      
      const complexDelta = createComplexMockDelta()
      
      act(() => {
        result.current.createDocument({
          title: 'Document with Placeholders',
          content: deltaToString(complexDelta)
        })
      })

      const placeholders = result.current.getPlaceholderObjects()
      expect(placeholders).toBeDefined()
      expect(placeholders.length).toBeGreaterThan(0)
      
      // Should find version table, signature, and line segment placeholders
      const placeholderTypes = placeholders.map(p => p.type)
      expect(placeholderTypes).toContain('version-table')
      expect(placeholderTypes).toContain('signature')
      expect(placeholderTypes).toContain('line-segment')
    })

    it('should track placeholder positions within document Delta', () => {
      const { result } = renderHook(() => useDocumentStore())
      
      const deltaWithPlaceholders: DeltaOperation[] = [
        { insert: 'Introduction text\n' },
        { insert: { 'version-table': { version: '1.0', date: '2024-01-01', author: 'Test' }}},
        { insert: '\nMiddle content\n' },
        { insert: { 'signature': { name: '', date: '', title: '' }}},
        { insert: '\nConclusion\n' }
      ]

      act(() => {
        result.current.createDocument({
          title: 'Position Test Document',
          content: deltaToString(deltaWithPlaceholders)
        })
      })

      const placeholders = result.current.getPlaceholderObjects()
      expect(placeholders).toHaveLength(2)
      
      const versionTable = placeholders.find(p => p.type === 'version-table')
      const signature = placeholders.find(p => p.type === 'signature')
      
      expect(versionTable?.position).toBe(1) // Second operation in Delta
      expect(signature?.position).toBe(3) // Fourth operation in Delta
    })

    it('should handle documents with no placeholder objects', () => {
      const { result } = renderHook(() => useDocumentStore())
      
      const simpleDelta: DeltaOperation[] = [
        { insert: 'Just plain text content\n' },
        { insert: 'No placeholders here\n' }
      ]

      act(() => {
        result.current.createDocument({
          title: 'Simple Document',
          content: deltaToString(simpleDelta)
        })
      })

      const placeholders = result.current.getPlaceholderObjects()
      expect(placeholders).toHaveLength(0)
    })

    it('should provide placeholder statistics', () => {
      const { result } = renderHook(() => useDocumentStore())
      
      const deltaWithMultiplePlaceholders: DeltaOperation[] = [
        { insert: 'Document with multiple placeholders\n' },
        { insert: { 'version-table': { version: '1.0', date: '2024-01-01', author: 'Test' }}},
        { insert: '\n' },
        { insert: { 'signature': { name: '', date: '', title: '' }}},
        { insert: '\n' },
        { insert: { 'signature': { name: '', date: '', title: 'Manager' }}},
        { insert: '\n' },
        { insert: { 'line-segment': { length: 'medium' }}},
        { insert: '\n' },
        { insert: { 'long-response': { minLength: 100, maxLength: 500, label: 'Response' }}},
        { insert: '\n' }
      ]

      act(() => {
        result.current.createDocument({
          title: 'Multi-Placeholder Document',
          content: deltaToString(deltaWithMultiplePlaceholders)
        })
      })

      const stats = result.current.getPlaceholderStats()
      expect(stats.totalPlaceholders).toBe(5)
      expect(stats.versionTables).toBe(1)
      expect(stats.signatures).toBe(2)
      expect(stats.lineSegments).toBe(1)
      expect(stats.longResponses).toBe(1)
    })
  })

  describe('Placeholder Insertion', () => {
    it('should insert placeholder object at specific position', () => {
      const { result } = renderHook(() => useDocumentStore())
      
      const initialDelta: DeltaOperation[] = [
        { insert: 'Start of document\n' },
        { insert: 'End of document\n' }
      ]

      act(() => {
        result.current.createDocument({
          title: 'Insert Test Document',
          content: deltaToString(initialDelta)
        })
      })

      const placeholderData = {
        name: 'John Doe',
        date: '2024-01-01',
        title: 'Manager'
      }

      act(() => {
        result.current.insertPlaceholder('signature', placeholderData, 1)
      })

      const placeholders = result.current.getPlaceholderObjects()
      expect(placeholders).toHaveLength(1)
      expect(placeholders[0].type).toBe('signature')
      expect(placeholders[0].data).toEqual(placeholderData)
      expect(placeholders[0].position).toBe(1)
      expect(result.current.isDirty).toBe(true)
    })

    it('should append placeholder object to end of document', () => {
      const { result } = renderHook(() => useDocumentStore())
      
      const initialDelta: DeltaOperation[] = [
        { insert: 'Document content\n' }
      ]

      act(() => {
        result.current.createDocument({
          title: 'Append Test Document',
          content: deltaToString(initialDelta)
        })
      })

      const placeholderData = {
        length: 'long'
      }

      act(() => {
        result.current.appendPlaceholder('line-segment', placeholderData)
      })

      const delta = result.current.getDocumentDelta()
      expect(delta).toHaveLength(2)
      expect(delta[1].insert).toEqual({ 'line-segment': placeholderData })
      expect(result.current.isDirty).toBe(true)
    })

    it('should validate placeholder data before insertion', () => {
      const { result } = renderHook(() => useDocumentStore())
      
      act(() => {
        result.current.createDocument({
          title: 'Validation Test Document',
          content: deltaToString([{ insert: 'Test\n' }])
        })
      })

      // Invalid signature data (missing required fields)
      const invalidSignatureData = {
        name: 'John Doe'
        // Missing date and title
      }

      act(() => {
        const isValid = result.current.validatePlaceholderData('signature', invalidSignatureData)
        expect(isValid.isValid).toBe(false)
        expect(isValid.errors.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Placeholder Updates', () => {
    it('should update placeholder object data', () => {
      const { result } = renderHook(() => useDocumentStore())
      
      const deltaWithPlaceholder: DeltaOperation[] = [
        { insert: 'Document with signature\n' },
        { insert: { 'signature': { name: 'John Doe', date: '2024-01-01', title: 'Employee' }}},
        { insert: '\n' }
      ]

      act(() => {
        result.current.createDocument({
          title: 'Update Test Document',
          content: deltaToString(deltaWithPlaceholder)
        })
      })

      const placeholders = result.current.getPlaceholderObjects()
      const placeholderId = placeholders[0].id

      const updatedData = {
        name: 'Jane Smith',
        date: '2024-02-01',
        title: 'Manager'
      }

      act(() => {
        result.current.updatePlaceholder(placeholderId, updatedData)
      })

      const updatedPlaceholders = result.current.getPlaceholderObjects()
      const updatedPlaceholder = updatedPlaceholders.find(p => p.id === placeholderId)
      expect(updatedPlaceholder?.data).toEqual(updatedData)
      expect(result.current.isDirty).toBe(true)
    })

    it('should update version table with immutability constraints', () => {
      const { result } = renderHook(() => useDocumentStore())
      
      const deltaWithVersionTable: DeltaOperation[] = [
        { insert: { 'version-table': { version: '1.0', date: '2024-01-01', author: 'Original Author' }}},
        { insert: 'Document content\n' }
      ]

      act(() => {
        result.current.createDocument({
          title: 'Version Table Test',
          content: deltaToString(deltaWithVersionTable)
        })
      })

      const placeholders = result.current.getPlaceholderObjects()
      const versionTableId = placeholders[0].id

      // Version table should allow specific updates but maintain constraints
      const updatedData = {
        version: '1.1',
        date: '2024-02-01',
        author: 'Updated Author'
      }

      act(() => {
        result.current.updatePlaceholder(versionTableId, updatedData)
      })

      const updatedPlaceholders = result.current.getPlaceholderObjects()
      const updatedVersionTable = updatedPlaceholders.find(p => p.id === versionTableId)
      expect(updatedVersionTable?.data.version).toBe('1.1')
      expect(updatedVersionTable?.data.author).toBe('Updated Author')
    })

    it('should validate placeholder updates', () => {
      const { result } = renderHook(() => useDocumentStore())
      
      const deltaWithLineSegment: DeltaOperation[] = [
        { insert: 'Text with ' },
        { insert: { 'line-segment': { length: 'medium' }}},
        { insert: '\n' }
      ]

      act(() => {
        result.current.createDocument({
          title: 'Line Segment Update Test',
          content: deltaToString(deltaWithLineSegment)
        })
      })

      const placeholders = result.current.getPlaceholderObjects()
      const lineSegmentId = placeholders[0].id

      // Invalid length value
      const invalidData = {
        length: 'extra-long' // Not a valid length
      }

      act(() => {
        const validation = result.current.validatePlaceholderData('line-segment', invalidData)
        expect(validation.isValid).toBe(false)
        expect(validation.errors).toContain('Invalid length value')
      })
    })
  })

  describe('Placeholder Deletion', () => {
    it('should remove placeholder object from document', () => {
      const { result } = renderHook(() => useDocumentStore())
      
      const deltaWithPlaceholders: DeltaOperation[] = [
        { insert: 'Start\n' },
        { insert: { 'signature': { name: 'John', date: '2024-01-01', title: 'Manager' }}},
        { insert: '\nMiddle\n' },
        { insert: { 'line-segment': { length: 'short' }}},
        { insert: '\nEnd\n' }
      ]

      act(() => {
        result.current.createDocument({
          title: 'Deletion Test Document',
          content: deltaToString(deltaWithPlaceholders)
        })
      })

      const placeholders = result.current.getPlaceholderObjects()
      expect(placeholders).toHaveLength(2)
      
      const signatureId = placeholders.find(p => p.type === 'signature')?.id!

      act(() => {
        result.current.removePlaceholder(signatureId)
      })

      const remainingPlaceholders = result.current.getPlaceholderObjects()
      expect(remainingPlaceholders).toHaveLength(1)
      expect(remainingPlaceholders[0].type).toBe('line-segment')
      expect(result.current.isDirty).toBe(true)
    })

    it('should prevent deletion of version table placeholders', () => {
      const { result } = renderHook(() => useDocumentStore())
      
      const deltaWithVersionTable: DeltaOperation[] = [
        { insert: { 'version-table': { version: '1.0', date: '2024-01-01', author: 'Author' }}},
        { insert: 'Document content\n' }
      ]

      act(() => {
        result.current.createDocument({
          title: 'Version Table Deletion Test',
          content: deltaToString(deltaWithVersionTable)
        })
      })

      const placeholders = result.current.getPlaceholderObjects()
      const versionTableId = placeholders[0].id

      act(() => {
        const canDelete = result.current.canDeletePlaceholder(versionTableId)
        expect(canDelete).toBe(false)
      })
    })

    it('should clean up placeholder references after deletion', () => {
      const { result } = renderHook(() => useDocumentStore())
      
      const deltaWithMultiplePlaceholders: DeltaOperation[] = [
        { insert: 'Text\n' },
        { insert: { 'signature': { name: 'A', date: '2024-01-01', title: 'Title A' }}},
        { insert: '\n' },
        { insert: { 'signature': { name: 'B', date: '2024-01-01', title: 'Title B' }}},
        { insert: '\n' }
      ]

      act(() => {
        result.current.createDocument({
          title: 'Cleanup Test Document',
          content: deltaToString(deltaWithMultiplePlaceholders)
        })
      })

      const placeholders = result.current.getPlaceholderObjects()
      const firstSignatureId = placeholders[0].id

      act(() => {
        result.current.removePlaceholder(firstSignatureId)
      })

      // Verify positions are updated correctly after deletion
      const remainingPlaceholders = result.current.getPlaceholderObjects()
      expect(remainingPlaceholders).toHaveLength(1)
      expect(remainingPlaceholders[0].position).toBe(1) // Position adjusted after deletion
    })
  })

  describe('Placeholder Validation Logic', () => {
    it('should validate version table data structure', () => {
      const { result } = renderHook(() => useDocumentStore())
      
      const validVersionTableData = {
        version: '1.0',
        date: '2024-01-01',
        author: 'John Doe'
      }

      const invalidVersionTableData = {
        version: '', // Empty version
        date: 'invalid-date', // Invalid date format
        // Missing author
      }

      act(() => {
        const validResult = result.current.validatePlaceholderData('version-table', validVersionTableData)
        expect(validResult.isValid).toBe(true)
        expect(validResult.errors).toHaveLength(0)

        const invalidResult = result.current.validatePlaceholderData('version-table', invalidVersionTableData)
        expect(invalidResult.isValid).toBe(false)
        expect(invalidResult.errors.length).toBeGreaterThan(0)
      })
    })

    it('should validate signature field requirements', () => {
      const { result } = renderHook(() => useDocumentStore())
      
      const validSignatureData = {
        name: 'John Doe',
        date: '2024-01-01',
        title: 'Manager'
      }

      const partialSignatureData = {
        name: 'John Doe',
        date: '',
        title: 'Manager'
      }

      act(() => {
        const validResult = result.current.validatePlaceholderData('signature', validSignatureData)
        expect(validResult.isValid).toBe(true)

        const partialResult = result.current.validatePlaceholderData('signature', partialSignatureData)
        expect(partialResult.isValid).toBe(true) // Partial data should be allowed for drafts
        expect(partialResult.warnings.length).toBeGreaterThan(0)
      })
    })

    it('should validate long response area constraints', () => {
      const { result } = renderHook(() => useDocumentStore())
      
      const validLongResponseData = {
        label: 'Response Area',
        placeholder: 'Enter your response...',
        minLength: 50,
        maxLength: 500
      }

      const invalidLongResponseData = {
        label: '',
        minLength: 500,
        maxLength: 50 // Max less than min
      }

      act(() => {
        const validResult = result.current.validatePlaceholderData('long-response', validLongResponseData)
        expect(validResult.isValid).toBe(true)

        const invalidResult = result.current.validatePlaceholderData('long-response', invalidLongResponseData)
        expect(invalidResult.isValid).toBe(false)
        expect(invalidResult.errors).toContain('Maximum length must be greater than minimum length')
      })
    })

    it('should validate line segment length options', () => {
      const { result } = renderHook(() => useDocumentStore())
      
      const validLengths = ['short', 'medium', 'long']
      const invalidLength = 'extra-long'

      validLengths.forEach(length => {
        act(() => {
          const result_inner = result.current.validatePlaceholderData('line-segment', { length })
          expect(result_inner.isValid).toBe(true)
        })
      })

      act(() => {
        const invalidResult = result.current.validatePlaceholderData('line-segment', { length: invalidLength })
        expect(invalidResult.isValid).toBe(false)
        expect(invalidResult.errors).toContain('Invalid length value')
      })
    })
  })

  describe('Complex Placeholder Operations', () => {
    it('should handle multiple placeholder operations in sequence', () => {
      const { result } = renderHook(() => useDocumentStore())
      
      act(() => {
        result.current.createDocument({
          title: 'Complex Operations Test',
          content: deltaToString([{ insert: 'Document start\n' }])
        })
      })

      // Insert multiple placeholders
      act(() => {
        result.current.appendPlaceholder('signature', { name: 'John', date: '2024-01-01', title: 'Manager' })
        result.current.appendPlaceholder('line-segment', { length: 'medium' })
        result.current.appendPlaceholder('signature', { name: 'Jane', date: '2024-01-02', title: 'Director' })
      })

      let placeholders = result.current.getPlaceholderObjects()
      expect(placeholders).toHaveLength(3)

      // Update middle placeholder
      const lineSegmentId = placeholders.find(p => p.type === 'line-segment')?.id!
      act(() => {
        result.current.updatePlaceholder(lineSegmentId, { length: 'long' })
      })

      // Remove first placeholder
      const firstSignatureId = placeholders.find(p => p.type === 'signature')?.id!
      act(() => {
        result.current.removePlaceholder(firstSignatureId)
      })

      placeholders = result.current.getPlaceholderObjects()
      expect(placeholders).toHaveLength(2)
      expect(placeholders.find(p => p.type === 'line-segment')?.data.length).toBe('long')
    })

    it('should maintain document integrity during placeholder operations', () => {
      const { result } = renderHook(() => useDocumentStore())
      
      const complexDelta = createComplexMockDelta()
      
      act(() => {
        result.current.createDocument({
          title: 'Integrity Test Document',
          content: deltaToString(complexDelta)
        })
      })

      const originalPlaceholders = result.current.getPlaceholderObjects()
      const originalDelta = result.current.getDocumentDelta()

      // Perform various operations
      const signatureId = originalPlaceholders.find(p => p.type === 'signature')?.id!
      act(() => {
        result.current.updatePlaceholder(signatureId, { name: 'Updated Name', date: '2024-12-31', title: 'Updated Title' })
      })

      const updatedDelta = result.current.getDocumentDelta()
      
      // Document structure should remain intact
      expect(updatedDelta.length).toBe(originalDelta.length)
      expect(updatedDelta[0]).toEqual(originalDelta[0]) // First text insert unchanged
      
      // Only signature data should be updated
      const updatedSignatureOp = updatedDelta.find(op => 
        op.insert && typeof op.insert === 'object' && 'signature' in op.insert
      )
      expect(updatedSignatureOp).toBeDefined()
      expect(updatedSignatureOp?.insert).toHaveProperty('signature')
    })
  })
})