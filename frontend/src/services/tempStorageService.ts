export interface TempDocumentData {
  title: string
  content: string
  documentType: string
  savedAt: string
}

export interface TempDocumentInfo {
  id: string
  data: TempDocumentData
}

class TempStorageService {
  private readonly keyPrefix = 'ca-dms-temp-'

  /**
   * Save temporary document data to localStorage
   */
  saveTempDocument(documentId: string, data: Omit<TempDocumentData, 'savedAt'>): void {
    try {
      const tempData: TempDocumentData = {
        ...data,
        savedAt: new Date().toISOString()
      }
      
      const key = this.getTempKey(documentId)
      localStorage.setItem(key, JSON.stringify(tempData))
    } catch (error) {
      console.warn('Failed to save temp document data:', error)
    }
  }

  /**
   * Retrieve temporary document data from localStorage
   */
  getTempDocument(documentId: string): TempDocumentData | null {
    try {
      const key = this.getTempKey(documentId)
      const data = localStorage.getItem(key)
      
      if (!data) {
        return null
      }
      
      return JSON.parse(data)
    } catch (error) {
      console.warn('Failed to retrieve temp document data:', error)
      return null
    }
  }

  /**
   * Check if temporary document exists for given ID
   */
  hasTempDocument(documentId: string): boolean {
    const key = this.getTempKey(documentId)
    return localStorage.getItem(key) !== null
  }

  /**
   * Clear temporary document data when document is saved
   */
  clearTempDocument(documentId: string): void {
    try {
      const key = this.getTempKey(documentId)
      localStorage.removeItem(key)
    } catch (error) {
      console.warn('Failed to clear temp document data:', error)
    }
  }

  /**
   * Get all temporary documents
   */
  getAllTempDocuments(): TempDocumentInfo[] {
    const tempDocs: TempDocumentInfo[] = []
    
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        
        if (key && key.startsWith(this.keyPrefix)) {
          const documentId = key.replace(this.keyPrefix, '')
          const data = this.getTempDocument(documentId)
          
          if (data) {
            tempDocs.push({
              id: documentId,
              data
            })
          }
        }
      }
    } catch (error) {
      console.warn('Failed to retrieve temp documents:', error)
    }
    
    return tempDocs
  }

  /**
   * Clean up old temporary documents
   */
  cleanupOldTempDocuments(maxAge: number = 7 * 24 * 60 * 60 * 1000): void {
    try {
      const now = Date.now()
      const keysToRemove: string[] = []
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        
        if (key && key.startsWith(this.keyPrefix)) {
          const data = localStorage.getItem(key)
          
          if (data) {
            try {
              const tempData: TempDocumentData = JSON.parse(data)
              const savedTime = new Date(tempData.savedAt).getTime()
              
              if (now - savedTime > maxAge) {
                keysToRemove.push(key)
              }
            } catch {
              // Invalid data, mark for removal
              keysToRemove.push(key)
            }
          }
        }
      }
      
      // Remove old documents
      keysToRemove.forEach(key => localStorage.removeItem(key))
    } catch (error) {
      console.warn('Failed to cleanup old temp documents:', error)
    }
  }

  /**
   * Check if temp document is newer than last saved version
   */
  isTempDocumentNewer(documentId: string, lastSaved: Date): boolean {
    const tempData = this.getTempDocument(documentId)
    
    if (!tempData) {
      return false
    }
    
    const tempSavedTime = new Date(tempData.savedAt).getTime()
    const lastSavedTime = lastSaved.getTime()
    
    return tempSavedTime > lastSavedTime
  }

  /**
   * Generate localStorage key for document
   */
  private getTempKey(documentId: string): string {
    return `${this.keyPrefix}${documentId}`
  }
}

export const tempStorageService = new TempStorageService()