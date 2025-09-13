import { versionService } from '../versionService'

describe('VersionService', () => {
  const mockVersionHistory = [
    {
      id: 'v1',
      version: 1,
      title: 'Initial Document',
      content: '# Initial Title\nOriginal content here.',
      author: 'John Doe',
      authorId: 'user1',
      createdAt: '2024-01-01T10:00:00Z',
      updatedAt: '2024-01-01T10:00:00Z',
      isHead: false,
      size: 256,
      changesSummary: 'Document created'
    },
    {
      id: 'v2',
      version: 2,
      title: 'Updated Document',
      content: '# Updated Title\nRevised content with more details.',
      author: 'Jane Smith',
      authorId: 'user2',
      createdAt: '2024-01-02T14:30:00Z',
      updatedAt: '2024-01-02T14:30:00Z',
      isHead: false,
      size: 512,
      changesSummary: 'Content expanded and title updated'
    },
    {
      id: 'v3',
      version: 3,
      title: 'Current Document',
      content: '# Current Title\n## Section One\nLatest content version.',
      author: 'John Doe',
      authorId: 'user1',
      createdAt: '2024-01-03T09:15:00Z',
      updatedAt: '2024-01-03T09:15:00Z',
      isHead: true,
      size: 768,
      changesSummary: 'Added section structure'
    }
  ]

  // Mock fetch for API calls
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Fetch Document Version History', () => {
    it('should fetch document version history', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ versions: mockVersionHistory })
      } as Response)

      const result = await versionService.fetchVersionHistory('doc123')

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/documents/doc123/versions')
      expect(result).toEqual(mockVersionHistory)
    })

    it('should handle API errors when fetching version history', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      } as Response)

      await expect(versionService.fetchVersionHistory('nonexistent'))
        .rejects.toThrow('Failed to fetch version history: 404 Not Found')
    })

    it('should handle network errors', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(versionService.fetchVersionHistory('doc123'))
        .rejects.toThrow('Network error')
    })
  })

  describe('Version Restoration', () => {
    it('should restore version to head (move selected version to head)', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          newHeadVersion: 4,
          message: 'Version v2 restored as new head version 4'
        })
      } as Response)

      const result = await versionService.restoreVersion('doc123', 'v2')

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/documents/doc123/versions/v2/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      expect(result.success).toBe(true)
      expect(result.newHeadVersion).toBe(4)
    })

    it('should handle restoration errors', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request'
      } as Response)

      await expect(versionService.restoreVersion('doc123', 'invalid'))
        .rejects.toThrow('Failed to restore version: 400 Bad Request')
    })

    it('should validate restore request parameters', async () => {
      await expect(versionService.restoreVersion('', 'v1'))
        .rejects.toThrow('Document ID and version ID are required')

      await expect(versionService.restoreVersion('doc123', ''))
        .rejects.toThrow('Document ID and version ID are required')
    })
  })

  describe('Version Comparison', () => {
    it('should compare two versions and return differences', () => {
      const v1Content = '# Original Title\nOriginal content.'
      const v2Content = '# Updated Title\nUpdated content with more details.'

      const diff = versionService.compareVersions(v1Content, v2Content)

      expect(diff.hasChanges).toBe(true)
      expect(diff.additions).toBeGreaterThan(0)
      expect(diff.deletions).toBeGreaterThan(0)
      expect(diff.changes).toHaveLength(2) // Title and content changes
    })

    it('should detect no changes between identical versions', () => {
      const content = '# Same Title\nSame content.'

      const diff = versionService.compareVersions(content, content)

      expect(diff.hasChanges).toBe(false)
      expect(diff.additions).toBe(0)
      expect(diff.deletions).toBe(0)
      expect(diff.changes).toHaveLength(0)
    })

    it('should identify different types of changes', () => {
      const oldContent = '# Title\n## Section\nOld content here.'
      const newContent = '# New Title\n## Section\n### Subsection\nNew content with more details.'

      const diff = versionService.compareVersions(oldContent, newContent)

      expect(diff.hasChanges).toBe(true)
      expect(diff.changes.some(c => c.type === 'title-change')).toBe(true)
      expect(diff.changes.some(c => c.type === 'structure-change')).toBe(true)
      expect(diff.changes.some(c => c.type === 'content-change')).toBe(true)
    })
  })

  describe('Version Metadata', () => {
    it('should get version metadata without full content', async () => {
      const mockFetch = vi.mocked(fetch)
      const metadata = {
        id: 'v2',
        version: 2,
        title: 'Updated Document',
        author: 'Jane Smith',
        createdAt: '2024-01-02T14:30:00Z',
        size: 512,
        changesSummary: 'Content expanded'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => metadata
      } as Response)

      const result = await versionService.getVersionMetadata('doc123', 'v2')

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/documents/doc123/versions/v2/metadata')
      expect(result).toEqual(metadata)
    })

    it('should calculate version statistics', () => {
      const stats = versionService.calculateVersionStats(mockVersionHistory)

      expect(stats.totalVersions).toBe(3)
      expect(stats.uniqueAuthors).toBe(2)
      expect(stats.currentVersion).toBe(3)
      expect(stats.sizeGrowth).toBeGreaterThan(0)
      expect(stats.averageTimeBetweenVersions).toBeGreaterThan(0)
    })
  })

  describe('Version Utilities', () => {
    it('should find current head version', () => {
      const head = versionService.findHeadVersion(mockVersionHistory)

      expect(head).toBeDefined()
      expect(head?.isHead).toBe(true)
      expect(head?.version).toBe(3)
    })

    it('should return null if no head version found', () => {
      const versionsWithoutHead = mockVersionHistory.map(v => ({ ...v, isHead: false }))
      const head = versionService.findHeadVersion(versionsWithoutHead)

      expect(head).toBeNull()
    })

    it('should sort versions by creation date', () => {
      const shuffled = [...mockVersionHistory].reverse()
      const sorted = versionService.sortVersionsByDate(shuffled, 'desc')

      expect(sorted[0].version).toBe(3) // Most recent first
      expect(sorted[2].version).toBe(1) // Oldest last
    })

    it('should filter versions by author', () => {
      const johnVersions = versionService.filterVersionsByAuthor(mockVersionHistory, 'user1')

      expect(johnVersions).toHaveLength(2)
      expect(johnVersions.every(v => v.authorId === 'user1')).toBe(true)
    })

    it('should filter versions by date range', () => {
      const startDate = '2024-01-01T00:00:00Z'
      const endDate = '2024-01-02T23:59:59Z'

      const filtered = versionService.filterVersionsByDateRange(
        mockVersionHistory,
        startDate,
        endDate
      )

      expect(filtered).toHaveLength(2) // v1 and v2
      expect(filtered.every(v => v.createdAt >= startDate && v.createdAt <= endDate)).toBe(true)
    })

    it('should get version by number', () => {
      const version = versionService.getVersionByNumber(mockVersionHistory, 2)

      expect(version).toBeDefined()
      expect(version?.version).toBe(2)
      expect(version?.title).toBe('Updated Document')
    })

    it('should return null for non-existent version number', () => {
      const version = versionService.getVersionByNumber(mockVersionHistory, 999)

      expect(version).toBeNull()
    })
  })

  describe('Content Preview', () => {
    it('should generate content preview from version', () => {
      const preview = versionService.generateContentPreview(mockVersionHistory[2])

      expect(preview.title).toBe('Current Document')
      expect(preview.excerpt).toContain('Latest content version')
      expect(preview.headerCount).toBe(2) // H1 and H2
      expect(preview.wordCount).toBeGreaterThan(0)
      expect(preview.characterCount).toBeGreaterThan(0)
    })

    it('should handle empty content gracefully', () => {
      const emptyVersion = { ...mockVersionHistory[0], content: '' }
      const preview = versionService.generateContentPreview(emptyVersion)

      expect(preview.excerpt).toBe('')
      expect(preview.headerCount).toBe(0)
      expect(preview.wordCount).toBe(0)
      expect(preview.characterCount).toBe(0)
    })
  })
})