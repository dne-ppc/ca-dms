export interface DocumentVersion {
  id: string
  version: number
  title: string
  content: string
  author: string
  authorId: string
  createdAt: string
  updatedAt: string
  isHead: boolean
  size: number
  changesSummary: string
}

export interface VersionMetadata {
  id: string
  version: number
  title: string
  author: string
  createdAt: string
  size: number
  changesSummary: string
}

export interface VersionStats {
  totalVersions: number
  uniqueAuthors: number
  currentVersion: number
  sizeGrowth: number
  averageTimeBetweenVersions: number
}

export interface VersionComparison {
  hasChanges: boolean
  additions: number
  deletions: number
  changes: Array<{
    type: 'title-change' | 'structure-change' | 'content-change'
    description: string
    lineNumber?: number
  }>
}

export interface ContentPreview {
  title: string
  excerpt: string
  headerCount: number
  wordCount: number
  characterCount: number
}

export interface VersionRestoreResponse {
  success: boolean
  newHeadVersion: number
  message: string
}

class VersionService {
  /**
   * Fetch document version history from API
   */
  async fetchVersionHistory(documentId: string): Promise<DocumentVersion[]> {
    if (!documentId.trim()) {
      throw new Error('Document ID is required')
    }

    try {
      const response = await fetch(`/api/v1/documents/${documentId}/versions`)

      if (!response.ok) {
        throw new Error(`Failed to fetch version history: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      return data.versions
    } catch (error) {
      throw error
    }
  }

  /**
   * Restore a version to head (move selected version to head)
   */
  async restoreVersion(documentId: string, versionId: string): Promise<VersionRestoreResponse> {
    if (!documentId.trim() || !versionId.trim()) {
      throw new Error('Document ID and version ID are required')
    }

    try {
      const response = await fetch(`/api/v1/documents/${documentId}/versions/${versionId}/restore`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to restore version: ${response.status} ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      throw error
    }
  }

  /**
   * Compare two versions and return differences
   */
  compareVersions(oldContent: string, newContent: string): VersionComparison {
    if (oldContent === newContent) {
      return {
        hasChanges: false,
        additions: 0,
        deletions: 0,
        changes: []
      }
    }

    const oldLines = oldContent.split('\n')
    const newLines = newContent.split('\n')

    let additions = 0
    let deletions = 0
    const changes: VersionComparison['changes'] = []

    // Simple line-by-line comparison
    const maxLines = Math.max(oldLines.length, newLines.length)

    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i] || ''
      const newLine = newLines[i] || ''

      if (oldLine !== newLine) {
        if (!oldLine && newLine) {
          additions++
          // Check if it's a new header
          if (newLine.match(/^#{2,3}\s/)) {
            changes.push({
              type: 'structure-change',
              description: 'Document structure modified',
              lineNumber: i + 1
            })
          } else if (newLine.trim()) {
            changes.push({
              type: 'content-change',
              description: 'Content added',
              lineNumber: i + 1
            })
          }
        } else if (oldLine && !newLine) {
          deletions++
          changes.push({
            type: 'content-change',
            description: 'Content removed',
            lineNumber: i + 1
          })
        } else {
          // Line changed
          if (oldLine.match(/^#\s/) && newLine.match(/^#\s/)) {
            changes.push({
              type: 'title-change',
              description: `Title changed from "${oldLine.replace(/^#\s+/, '')}" to "${newLine.replace(/^#\s+/, '')}"`,
              lineNumber: i + 1
            })
          } else if (oldLine.match(/^#{2,3}\s/) || newLine.match(/^#{2,3}\s/)) {
            changes.push({
              type: 'structure-change',
              description: 'Document structure modified',
              lineNumber: i + 1
            })
          } else {
            changes.push({
              type: 'content-change',
              description: 'Content modified',
              lineNumber: i + 1
            })
          }

          if (newLine.length > oldLine.length) {
            additions += newLine.length - oldLine.length
          } else {
            deletions += oldLine.length - newLine.length
          }
        }
      }
    }

    return {
      hasChanges: true,
      additions,
      deletions,
      changes
    }
  }

  /**
   * Get version metadata without full content
   */
  async getVersionMetadata(documentId: string, versionId: string): Promise<VersionMetadata> {
    if (!documentId.trim() || !versionId.trim()) {
      throw new Error('Document ID and version ID are required')
    }

    try {
      const response = await fetch(`/api/v1/documents/${documentId}/versions/${versionId}/metadata`)

      if (!response.ok) {
        throw new Error(`Failed to fetch version metadata: ${response.status} ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      throw error
    }
  }

  /**
   * Calculate version statistics
   */
  calculateVersionStats(versions: DocumentVersion[]): VersionStats {
    if (versions.length === 0) {
      return {
        totalVersions: 0,
        uniqueAuthors: 0,
        currentVersion: 0,
        sizeGrowth: 0,
        averageTimeBetweenVersions: 0
      }
    }

    const uniqueAuthors = new Set(versions.map(v => v.authorId)).size
    const currentVersion = Math.max(...versions.map(v => v.version))

    // Calculate size growth
    const sortedByVersion = [...versions].sort((a, b) => a.version - b.version)
    const firstSize = sortedByVersion[0]?.size || 0
    const lastSize = sortedByVersion[sortedByVersion.length - 1]?.size || 0
    const sizeGrowth = lastSize - firstSize

    // Calculate average time between versions
    let totalTimeDiff = 0
    if (versions.length > 1) {
      const sortedByDate = [...versions].sort((a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )

      for (let i = 1; i < sortedByDate.length; i++) {
        const timeDiff = new Date(sortedByDate[i].createdAt).getTime() -
                        new Date(sortedByDate[i - 1].createdAt).getTime()
        totalTimeDiff += timeDiff
      }
    }

    const averageTimeBetweenVersions = versions.length > 1 ?
      totalTimeDiff / (versions.length - 1) : 0

    return {
      totalVersions: versions.length,
      uniqueAuthors,
      currentVersion,
      sizeGrowth,
      averageTimeBetweenVersions
    }
  }

  /**
   * Find current head version
   */
  findHeadVersion(versions: DocumentVersion[]): DocumentVersion | null {
    return versions.find(version => version.isHead) || null
  }

  /**
   * Sort versions by creation date
   */
  sortVersionsByDate(versions: DocumentVersion[], order: 'asc' | 'desc' = 'asc'): DocumentVersion[] {
    return [...versions].sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime()
      const timeB = new Date(b.createdAt).getTime()
      return order === 'asc' ? timeA - timeB : timeB - timeA
    })
  }

  /**
   * Filter versions by author
   */
  filterVersionsByAuthor(versions: DocumentVersion[], authorId: string): DocumentVersion[] {
    return versions.filter(version => version.authorId === authorId)
  }

  /**
   * Filter versions by date range
   */
  filterVersionsByDateRange(versions: DocumentVersion[], startDate: string, endDate: string): DocumentVersion[] {
    const start = new Date(startDate).getTime()
    const end = new Date(endDate).getTime()

    return versions.filter(version => {
      const versionDate = new Date(version.createdAt).getTime()
      return versionDate >= start && versionDate <= end
    })
  }

  /**
   * Get version by number
   */
  getVersionByNumber(versions: DocumentVersion[], versionNumber: number): DocumentVersion | null {
    return versions.find(version => version.version === versionNumber) || null
  }

  /**
   * Generate content preview from version
   */
  generateContentPreview(version: DocumentVersion): ContentPreview {
    const content = version.content || ''
    const lines = content.split('\n')

    // Count headers
    const headerCount = lines.filter(line => /^#{1,3}\s/.test(line.trim())).length

    // Count words and characters
    const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0
    const characterCount = content.length

    // Generate excerpt (first non-header line or first 100 chars)
    let excerpt = ''
    for (const line of lines) {
      const trimmedLine = line.trim()
      if (trimmedLine && !trimmedLine.match(/^#{1,3}\s/)) {
        excerpt = trimmedLine.length > 100 ? trimmedLine.substring(0, 100) + '...' : trimmedLine
        break
      }
    }

    if (!excerpt && content.trim()) {
      excerpt = content.length > 100 ? content.substring(0, 100) + '...' : content
    }

    return {
      title: version.title,
      excerpt,
      headerCount,
      wordCount,
      characterCount
    }
  }
}

export const versionService = new VersionService()