import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { VersionHistory } from '../VersionHistory'
import { versionService } from '../../../services/versionService'

// Mock the version service
vi.mock('../../../services/versionService', () => ({
  versionService: {
    fetchVersionHistory: vi.fn(),
    restoreVersion: vi.fn(),
    generateContentPreview: vi.fn(),
    compareVersions: vi.fn(),
    sortVersionsByDate: vi.fn()
  }
}))

describe('VersionHistory', () => {
  const mockVersions = [
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

  const mockPreview = {
    title: 'Test Document',
    excerpt: 'Test content excerpt',
    headerCount: 2,
    wordCount: 15,
    characterCount: 120
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(versionService.fetchVersionHistory).mockResolvedValue(mockVersions)
    vi.mocked(versionService.generateContentPreview).mockReturnValue(mockPreview)
    vi.mocked(versionService.sortVersionsByDate).mockReturnValue([...mockVersions].reverse())
  })

  describe('Component Rendering', () => {
    it('should render version history panel', async () => {
      render(<VersionHistory documentId="doc123" />)

      expect(screen.getByText('Version History')).toBeInTheDocument()
      expect(screen.getByText('Loading versions...')).toBeInTheDocument()

      await waitFor(() => {
        expect(screen.queryByText('Loading versions...')).not.toBeInTheDocument()
      })
    })

    it('should display version list after loading', async () => {
      render(<VersionHistory documentId="doc123" />)

      await waitFor(() => {
        expect(screen.getByText('v3 (Current)')).toBeInTheDocument()
        expect(screen.getByText('v2')).toBeInTheDocument()
        expect(screen.getByText('v1')).toBeInTheDocument()
      })

      expect(screen.getAllByText('John Doe')).toHaveLength(2) // Appears in v1 and v3
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    })

    it('should highlight current head version', async () => {
      render(<VersionHistory documentId="doc123" />)

      await waitFor(() => {
        const currentVersion = screen.getByText('v3 (Current)')
        expect(currentVersion.closest('.version-item')).toHaveClass('head-version')
      })
    })

    it('should display version metadata', async () => {
      render(<VersionHistory documentId="doc123" />)

      await waitFor(() => {
        expect(screen.getByText('Document created')).toBeInTheDocument()
        expect(screen.getByText('Content expanded and title updated')).toBeInTheDocument()
        expect(screen.getByText('Added section structure')).toBeInTheDocument()
      })
    })
  })

  describe('Version Selection', () => {
    it('should allow selecting a version for preview', async () => {
      const onVersionSelect = vi.fn()
      render(<VersionHistory documentId="doc123" onVersionSelect={onVersionSelect} />)

      await waitFor(() => {
        const versionItem = screen.getByText('v2')
        fireEvent.click(versionItem)
      })

      expect(onVersionSelect).toHaveBeenCalledWith(mockVersions[1])
    })

    it('should show selected version with different styling', async () => {
      const onVersionSelect = vi.fn()
      render(<VersionHistory documentId="doc123" onVersionSelect={onVersionSelect} selectedVersionId="v2" />)

      await waitFor(() => {
        const selectedVersion = screen.getByText('v2')
        expect(selectedVersion.closest('.version-item')).toHaveClass('selected')
      })
    })

    it('should display version preview when selected', async () => {
      render(<VersionHistory documentId="doc123" selectedVersionId="v2" />)

      await waitFor(() => {
        expect(screen.getByText('Test content excerpt')).toBeInTheDocument()
        expect(screen.getByText('15 words')).toBeInTheDocument()
        expect(screen.getByText('2 headers')).toBeInTheDocument()
      })
    })
  })

  describe('Version Restoration', () => {
    it('should show restore button for non-head versions', async () => {
      render(<VersionHistory documentId="doc123" />)

      await waitFor(() => {
        const v2Section = screen.getByText('v2').closest('.version-item')
        expect(v2Section?.querySelector('button[title="Restore this version"]')).toBeInTheDocument()
      })
    })

    it('should not show restore button for head version', async () => {
      render(<VersionHistory documentId="doc123" />)

      await waitFor(() => {
        const v3Section = screen.getByText('v3 (Current)').closest('.version-item')
        expect(v3Section?.querySelector('button[title="Restore this version"]')).not.toBeInTheDocument()
      })
    })

    it('should handle version restoration', async () => {
      const onVersionRestore = vi.fn()
      vi.mocked(versionService.restoreVersion).mockResolvedValue({
        success: true,
        newHeadVersion: 4,
        message: 'Version v2 restored as new head version 4'
      })

      render(<VersionHistory documentId="doc123" onVersionRestore={onVersionRestore} />)

      await waitFor(() => {
        const restoreButton = screen.getByLabelText('Restore version 2 to head')
        fireEvent.click(restoreButton)
      })

      // Confirm the restoration in the dialog
      const confirmButton = screen.getByText('Restore')
      fireEvent.click(confirmButton)

      await waitFor(() => {
        expect(versionService.restoreVersion).toHaveBeenCalledWith('doc123', expect.any(String))
        expect(onVersionRestore).toHaveBeenCalled()
      })
    })

    it('should show confirmation dialog before restoration', async () => {
      render(<VersionHistory documentId="doc123" />)

      await waitFor(() => {
        const restoreButton = screen.getByLabelText('Restore version 2 to head')
        fireEvent.click(restoreButton)
      })

      expect(screen.getByText('Restore Version')).toBeInTheDocument()
      expect(screen.getByText(/Are you sure you want to restore/)).toBeInTheDocument()
      expect(screen.getByText('Cancel')).toBeInTheDocument()
      expect(screen.getByText('Restore')).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should handle fetch errors gracefully', async () => {
      vi.mocked(versionService.fetchVersionHistory).mockRejectedValue(new Error('Network error'))

      render(<VersionHistory documentId="doc123" />)

      await waitFor(() => {
        expect(screen.getByText('Failed to load version history')).toBeInTheDocument()
        expect(screen.getByText('Retry')).toBeInTheDocument()
      })
    })

    it('should handle restoration errors', async () => {
      vi.mocked(versionService.restoreVersion).mockRejectedValue(new Error('Restore failed'))

      render(<VersionHistory documentId="doc123" />)

      await waitFor(() => {
        const restoreButton = screen.getByLabelText('Restore version 2 to head')
        fireEvent.click(restoreButton)
      })

      // Confirm restoration
      const confirmButton = screen.getByText('Restore')
      fireEvent.click(confirmButton)

      await waitFor(() => {
        expect(screen.getByText('Failed to restore version')).toBeInTheDocument()
      })
    })

    it('should show empty state when no versions exist', async () => {
      vi.clearAllMocks()
      vi.mocked(versionService.fetchVersionHistory).mockResolvedValue([])

      render(<VersionHistory documentId="doc456" />)

      await waitFor(() => {
        expect(screen.getByText('No version history available')).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('should be keyboard navigable', async () => {
      render(<VersionHistory documentId="doc123" />)

      await waitFor(() => {
        const firstVersion = screen.getByText('v3 (Current)')
        expect(firstVersion).toBeInTheDocument()
      })

      // Test tab navigation
      const versionItems = screen.getAllByRole('button').filter(btn =>
        btn.getAttribute('aria-label')?.includes('Select version')
      )

      versionItems.forEach(item => {
        expect(item).not.toHaveAttribute('tabindex', '-1')
      })
    })

    it('should have proper ARIA labels', async () => {
      render(<VersionHistory documentId="doc123" />)

      await waitFor(() => {
        expect(screen.getByRole('region', { name: 'Version History' })).toBeInTheDocument()
        expect(screen.getByRole('list', { name: 'Document versions' })).toBeInTheDocument()
      })
    })

    it('should announce restore actions to screen readers', async () => {
      render(<VersionHistory documentId="doc123" />)

      await waitFor(() => {
        const restoreButton = screen.getByLabelText('Restore version 2 to head')
        expect(restoreButton).toHaveAttribute('aria-label', expect.stringMatching(/Restore version/))
      })
    })
  })

  describe('Performance', () => {
    it('should not re-fetch versions unnecessarily', async () => {
      const { rerender } = render(<VersionHistory documentId="doc123" />)

      await waitFor(() => {
        expect(versionService.fetchVersionHistory).toHaveBeenCalledTimes(1)
      })

      // Re-render with same document ID
      rerender(<VersionHistory documentId="doc123" />)

      expect(versionService.fetchVersionHistory).toHaveBeenCalledTimes(1)
    })

    it('should fetch new versions when document ID changes', async () => {
      const { rerender } = render(<VersionHistory documentId="doc123" />)

      await waitFor(() => {
        expect(versionService.fetchVersionHistory).toHaveBeenCalledWith('doc123')
      })

      // Change document ID
      rerender(<VersionHistory documentId="doc456" />)

      await waitFor(() => {
        expect(versionService.fetchVersionHistory).toHaveBeenCalledWith('doc456')
        expect(versionService.fetchVersionHistory).toHaveBeenCalledTimes(2)
      })
    })
  })
})