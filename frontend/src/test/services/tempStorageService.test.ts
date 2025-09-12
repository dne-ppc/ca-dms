import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { tempStorageService } from '../../services/tempStorageService'

describe('Temp Storage Service', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    vi.clearAllMocks()
    localStorage.clear()
    // Create spies for localStorage methods
    vi.spyOn(localStorage, 'setItem')
    vi.spyOn(localStorage, 'getItem')
    vi.spyOn(localStorage, 'removeItem')
    vi.spyOn(localStorage, 'clear')
  })

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  describe('Temp document storage', () => {
    it('should save temp document data to localStorage', () => {
      const documentId = 'doc-123'
      const tempData = {
        title: 'Draft Document',
        content: JSON.stringify([{ insert: 'Draft content' }]),
        documentType: 'governance'
      }

      tempStorageService.saveTempDocument(documentId, tempData)

      // Verify by retrieving the saved data
      const savedData = tempStorageService.getTempDocument(documentId)
      expect(savedData).toBeDefined()
      expect(savedData?.title).toBe('Draft Document')
      expect(savedData?.content).toBe(JSON.stringify([{ insert: 'Draft content' }]))
      expect(savedData?.documentType).toBe('governance')
      expect(savedData?.savedAt).toBeDefined()
    })

    it('should retrieve temp document data from localStorage', () => {
      const documentId = 'doc-123'
      const tempData = {
        title: 'Draft Document',
        content: JSON.stringify([{ insert: 'Draft content' }]),
        documentType: 'governance',
        savedAt: new Date().toISOString()
      }

      localStorage.setItem(`ca-dms-temp-${documentId}`, JSON.stringify(tempData))

      const result = tempStorageService.getTempDocument(documentId)

      expect(result).toEqual(tempData)
    })

    it('should return null when no temp document exists', () => {
      const result = tempStorageService.getTempDocument('non-existent')

      expect(result).toBeNull()
    })

    it('should handle malformed temp data gracefully', () => {
      const documentId = 'doc-123'
      localStorage.setItem(`ca-dms-temp-${documentId}`, 'invalid-json')

      const result = tempStorageService.getTempDocument(documentId)

      expect(result).toBeNull()
    })
  })

  describe('Temp document cleanup', () => {
    it('should clear temp document data when document is saved', () => {
      const documentId = 'doc-123'
      const tempData = {
        title: 'Draft Document',
        content: JSON.stringify([{ insert: 'Draft content' }]),
        documentType: 'governance'
      }

      // Save temp data first
      tempStorageService.saveTempDocument(documentId, tempData)
      expect(tempStorageService.getTempDocument(documentId)).toBeDefined()

      // Clear it
      tempStorageService.clearTempDocument(documentId)

      // Verify it's gone
      expect(tempStorageService.getTempDocument(documentId)).toBeNull()
    })

    it('should clear all temp documents older than specified time', () => {
      const oldDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days ago
      const recentDate = new Date().toISOString()

      localStorage.setItem('ca-dms-temp-old-doc', JSON.stringify({ 
        title: 'Old', 
        content: '{}', 
        documentType: 'governance',
        savedAt: oldDate 
      }))
      localStorage.setItem('ca-dms-temp-recent-doc', JSON.stringify({ 
        title: 'Recent', 
        content: '{}', 
        documentType: 'governance',
        savedAt: recentDate 
      }))
      localStorage.setItem('other-key', 'should-not-be-touched')

      tempStorageService.cleanupOldTempDocuments(3 * 24 * 60 * 60 * 1000) // 3 days

      // Verify old document was removed
      expect(tempStorageService.getTempDocument('old-doc')).toBeNull()
      // Verify recent document was kept
      expect(tempStorageService.getTempDocument('recent-doc')).toBeDefined()
      // Verify non-temp key was untouched
      expect(localStorage.getItem('other-key')).toBe('should-not-be-touched')
    })
  })

  describe('Temp document detection', () => {
    it('should detect when temp document exists for a document ID', () => {
      const documentId = 'doc-123'
      localStorage.setItem(`ca-dms-temp-${documentId}`, JSON.stringify({ 
        title: 'Draft', 
        content: '{}',
        documentType: 'governance',
        savedAt: new Date().toISOString() 
      }))

      const hasTempData = tempStorageService.hasTempDocument(documentId)

      expect(hasTempData).toBe(true)
    })

    it('should return false when no temp document exists', () => {
      const hasTempData = tempStorageService.hasTempDocument('non-existent')

      expect(hasTempData).toBe(false)
    })

    it('should list all temp documents', () => {
      localStorage.setItem('ca-dms-temp-doc1', JSON.stringify({ 
        title: 'Doc 1', 
        content: '{}',
        documentType: 'governance',
        savedAt: new Date().toISOString() 
      }))
      localStorage.setItem('ca-dms-temp-doc2', JSON.stringify({ 
        title: 'Doc 2', 
        content: '{}',
        documentType: 'policy',
        savedAt: new Date().toISOString() 
      }))
      localStorage.setItem('other-key', 'not-temp-doc')

      const tempDocs = tempStorageService.getAllTempDocuments()

      expect(tempDocs).toHaveLength(2)
      expect(tempDocs.find(doc => doc.id === 'doc1')).toBeDefined()
      expect(tempDocs.find(doc => doc.id === 'doc2')).toBeDefined()
    })
  })

  describe('Temp document metadata', () => {
    it('should automatically add timestamp when saving temp document', () => {
      const documentId = 'doc-123'
      const tempData = {
        title: 'Draft Document',
        content: JSON.stringify([{ insert: 'Draft content' }]),
        documentType: 'governance'
      }

      const beforeSave = Date.now()
      tempStorageService.saveTempDocument(documentId, tempData)
      const afterSave = Date.now()

      const savedData = tempStorageService.getTempDocument(documentId)
      
      expect(savedData?.savedAt).toBeDefined()
      const savedTimestamp = new Date(savedData!.savedAt).getTime()
      expect(savedTimestamp).toBeGreaterThanOrEqual(beforeSave)
      expect(savedTimestamp).toBeLessThanOrEqual(afterSave)
    })

    it('should determine if temp document is newer than last saved version', () => {
      const documentId = 'doc-123'
      const tempData = {
        title: 'Draft Document',
        content: JSON.stringify([{ insert: 'Draft content' }]),
        documentType: 'governance',
        savedAt: new Date().toISOString()
      }

      localStorage.setItem(`ca-dms-temp-${documentId}`, JSON.stringify(tempData))

      const lastSaved = new Date(Date.now() - 5000) // 5 seconds ago
      const isNewer = tempStorageService.isTempDocumentNewer(documentId, lastSaved)

      expect(isNewer).toBe(true)
    })
  })
})