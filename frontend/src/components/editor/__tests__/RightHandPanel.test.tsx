import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { RightHandPanel } from '../RightHandPanel'
import { tocService } from '../../../services/tocService'
import { versionService } from '../../../services/versionService'

// Mock the services
vi.mock('../../../services/tocService', () => ({
  tocService: {
    extractHeaders: vi.fn(),
    generateHierarchy: vi.fn()
  }
}))

vi.mock('../../../services/versionService', () => ({
  versionService: {
    fetchVersionHistory: vi.fn(),
    restoreVersion: vi.fn(),
    generateContentPreview: vi.fn(),
    sortVersionsByDate: vi.fn()
  }
}))

describe('RightHandPanel', () => {
  const mockDocument = {
    id: 'doc123',
    title: 'Test Document',
    content: '# Main Title\n## Section One\nContent here\n## Section Two\nMore content'
  }

  const mockHeaders = [
    {
      id: 'main-title',
      text: 'Main Title',
      level: 1,
      lineNumber: 1,
      anchor: '#main-title'
    },
    {
      id: 'section-one',
      text: 'Section One',
      level: 2,
      lineNumber: 2,
      anchor: '#section-one'
    },
    {
      id: 'section-two',
      text: 'Section Two',
      level: 2,
      lineNumber: 4,
      anchor: '#section-two'
    }
  ]

  const mockVersions = [
    {
      id: 'v1',
      version: 1,
      title: 'Initial Document',
      content: '# Initial Title\nOriginal content.',
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
      title: 'Current Document',
      content: mockDocument.content,
      author: 'Jane Smith',
      authorId: 'user2',
      createdAt: '2024-01-02T14:30:00Z',
      updatedAt: '2024-01-02T14:30:00Z',
      isHead: true,
      size: 512,
      changesSummary: 'Added sections'
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(tocService.extractHeaders).mockReturnValue(mockHeaders)
    vi.mocked(versionService.fetchVersionHistory).mockResolvedValue(mockVersions)
    vi.mocked(versionService.sortVersionsByDate).mockReturnValue([...mockVersions].reverse())
    vi.mocked(versionService.generateContentPreview).mockReturnValue({
      title: 'Test Document',
      excerpt: 'Test content excerpt',
      headerCount: 2,
      wordCount: 15,
      characterCount: 120
    })
  })

  describe('Panel Structure', () => {
    it('should render right-hand panel with tab navigation', () => {
      render(<RightHandPanel document={mockDocument} />)

      expect(screen.getByRole('tablist', { name: 'Document navigation' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Table of Contents' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Version History' })).toBeInTheDocument()
    })

    it('should show TOC tab as active by default', () => {
      render(<RightHandPanel document={mockDocument} />)

      const tocTab = screen.getByRole('tab', { name: 'Table of Contents' })
      const versionTab = screen.getByRole('tab', { name: 'Version History' })

      expect(tocTab).toHaveAttribute('aria-selected', 'true')
      expect(versionTab).toHaveAttribute('aria-selected', 'false')
    })

    it('should display TOC content by default', () => {
      render(<RightHandPanel document={mockDocument} />)

      expect(screen.getByRole('tabpanel', { name: 'Table of Contents' })).toBeInTheDocument()
      expect(screen.getByText('Main Title')).toBeInTheDocument()
      expect(screen.getByText('Section One')).toBeInTheDocument()
      expect(screen.getByText('Section Two')).toBeInTheDocument()
    })
  })

  describe('Tab Navigation', () => {
    it('should switch to version history tab when clicked', async () => {
      render(<RightHandPanel document={mockDocument} />)

      const versionTab = screen.getByRole('tab', { name: 'Version History' })
      fireEvent.click(versionTab)

      await waitFor(() => {
        expect(versionTab).toHaveAttribute('aria-selected', 'true')
        expect(screen.getByRole('tab', { name: 'Table of Contents' })).toHaveAttribute('aria-selected', 'false')
      })

      expect(screen.getByRole('tabpanel', { name: 'Version History' })).toBeInTheDocument()
      expect(screen.getByText('Version History')).toBeInTheDocument()
    })

    it('should maintain tab state when switching back and forth', async () => {
      render(<RightHandPanel document={mockDocument} />)

      const tocTab = screen.getByRole('tab', { name: 'Table of Contents' })
      const versionTab = screen.getByRole('tab', { name: 'Version History' })

      // Switch to version history
      fireEvent.click(versionTab)
      await waitFor(() => {
        expect(versionTab).toHaveAttribute('aria-selected', 'true')
      })

      // Switch back to TOC
      fireEvent.click(tocTab)
      await waitFor(() => {
        expect(tocTab).toHaveAttribute('aria-selected', 'true')
        expect(versionTab).toHaveAttribute('aria-selected', 'false')
      })

      expect(screen.getByRole('tabpanel', { name: 'Table of Contents' })).toBeInTheDocument()
    })

    it('should support keyboard navigation between tabs', () => {
      render(<RightHandPanel document={mockDocument} />)

      const tocTab = screen.getByRole('tab', { name: 'Table of Contents' })
      const versionTab = screen.getByRole('tab', { name: 'Version History' })

      // Focus on TOC tab
      tocTab.focus()
      expect(document.activeElement).toBe(tocTab)

      // Arrow right to version tab
      fireEvent.keyDown(tocTab, { key: 'ArrowRight' })
      expect(document.activeElement).toBe(versionTab)

      // Arrow left back to TOC tab
      fireEvent.keyDown(versionTab, { key: 'ArrowLeft' })
      expect(document.activeElement).toBe(tocTab)
    })

    it('should activate tab with Enter or Space key', () => {
      render(<RightHandPanel document={mockDocument} />)

      const versionTab = screen.getByRole('tab', { name: 'Version History' })

      // Activate with Enter key
      fireEvent.keyDown(versionTab, { key: 'Enter' })
      expect(versionTab).toHaveAttribute('aria-selected', 'true')

      // Switch back with mouse
      fireEvent.click(screen.getByRole('tab', { name: 'Table of Contents' }))

      // Activate with Space key
      fireEvent.keyDown(versionTab, { key: ' ' })
      expect(versionTab).toHaveAttribute('aria-selected', 'true')
    })
  })

  describe('TOC Integration', () => {
    it('should display table of contents from document content', () => {
      render(<RightHandPanel document={mockDocument} />)

      expect(tocService.extractHeaders).toHaveBeenCalledWith(mockDocument.content)
      expect(screen.getByText('Main Title')).toBeInTheDocument()
      expect(screen.getByText('Section One')).toBeInTheDocument()
      expect(screen.getByText('Section Two')).toBeInTheDocument()
    })

    it('should handle header clicks for navigation', () => {
      const onHeaderClick = vi.fn()
      render(<RightHandPanel document={mockDocument} onHeaderClick={onHeaderClick} />)

      const headerLink = screen.getByText('Section One')
      fireEvent.click(headerLink)

      expect(onHeaderClick).toHaveBeenCalledWith('section-one')
    })

    it('should update TOC when document content changes', () => {
      const { rerender } = render(<RightHandPanel document={mockDocument} />)

      const updatedDocument = {
        ...mockDocument,
        content: '# New Title\n## New Section\nUpdated content'
      }

      const updatedHeaders = [
        {
          id: 'new-title',
          text: 'New Title',
          level: 1,
          lineNumber: 1,
          anchor: '#new-title'
        }
      ]

      vi.mocked(tocService.extractHeaders).mockReturnValue(updatedHeaders)

      rerender(<RightHandPanel document={updatedDocument} />)

      expect(tocService.extractHeaders).toHaveBeenCalledWith(updatedDocument.content)
    })

    it('should show empty state when no headers exist', () => {
      vi.mocked(tocService.extractHeaders).mockReturnValue([])

      render(<RightHandPanel document={{ ...mockDocument, content: 'No headers here' }} />)

      expect(screen.getByText('No table of contents available')).toBeInTheDocument()
    })
  })

  describe('Version History Integration', () => {
    it('should display version history when tab is active', async () => {
      render(<RightHandPanel document={mockDocument} />)

      const versionTab = screen.getByRole('tab', { name: 'Version History' })
      fireEvent.click(versionTab)

      await waitFor(() => {
        expect(versionService.fetchVersionHistory).toHaveBeenCalledWith(mockDocument.id)
        expect(screen.getByText('Version History')).toBeInTheDocument()
      })
    })

    it('should handle version selection', async () => {
      const onVersionSelect = vi.fn()
      render(<RightHandPanel document={mockDocument} onVersionSelect={onVersionSelect} />)

      // Switch to version history tab
      fireEvent.click(screen.getByRole('tab', { name: 'Version History' }))

      await waitFor(() => {
        const versionItem = screen.getByText('v1')
        fireEvent.click(versionItem)
        expect(onVersionSelect).toHaveBeenCalledWith(mockVersions[0])
      })
    })

    it('should handle version restoration', async () => {
      const onVersionRestore = vi.fn()
      vi.mocked(versionService.restoreVersion).mockResolvedValue({
        success: true,
        newHeadVersion: 3,
        message: 'Version restored successfully'
      })

      render(<RightHandPanel document={mockDocument} onVersionRestore={onVersionRestore} />)

      // Switch to version history tab
      fireEvent.click(screen.getByRole('tab', { name: 'Version History' }))

      await waitFor(() => {
        const restoreButton = screen.getByLabelText('Restore version 1 to head')
        fireEvent.click(restoreButton)
      })

      // Confirm restoration
      const confirmButton = screen.getByText('Restore')
      fireEvent.click(confirmButton)

      await waitFor(() => {
        expect(onVersionRestore).toHaveBeenCalled()
      })
    })
  })

  describe('Responsive Design', () => {
    it('should be collapsible on smaller screens', () => {
      render(<RightHandPanel document={mockDocument} collapsed={true} />)

      expect(screen.getByRole('button', { name: 'Expand panel' })).toBeInTheDocument()
      expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    })

    it('should toggle collapse state when button clicked', () => {
      const onToggleCollapse = vi.fn()
      render(<RightHandPanel document={mockDocument} collapsed={true} onToggleCollapse={onToggleCollapse} />)

      const expandButton = screen.getByRole('button', { name: 'Expand panel' })
      fireEvent.click(expandButton)

      expect(onToggleCollapse).toHaveBeenCalledWith(false)
    })

    it('should show collapse button when expanded', () => {
      const onToggleCollapse = vi.fn()
      render(<RightHandPanel document={mockDocument} onToggleCollapse={onToggleCollapse} />)

      const collapseButton = screen.getByRole('button', { name: 'Collapse panel' })
      fireEvent.click(collapseButton)

      expect(onToggleCollapse).toHaveBeenCalledWith(true)
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      render(<RightHandPanel document={mockDocument} />)

      expect(screen.getByRole('tablist', { name: 'Document navigation' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Table of Contents' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Version History' })).toBeInTheDocument()
      expect(screen.getByRole('tabpanel', { name: 'Table of Contents' })).toBeInTheDocument()
    })

    it('should maintain focus management during tab switching', () => {
      render(<RightHandPanel document={mockDocument} />)

      const versionTab = screen.getByRole('tab', { name: 'Version History' })
      versionTab.focus()
      fireEvent.click(versionTab)

      expect(document.activeElement).toBe(versionTab)
    })

    it('should support screen reader announcements', async () => {
      render(<RightHandPanel document={mockDocument} />)

      const versionTab = screen.getByRole('tab', { name: 'Version History' })
      fireEvent.click(versionTab)

      await waitFor(() => {
        const tabPanel = screen.getByRole('tabpanel', { name: 'Version History' })
        expect(tabPanel).toHaveAttribute('aria-live')
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle TOC extraction errors gracefully', () => {
      vi.mocked(tocService.extractHeaders).mockImplementation(() => {
        throw new Error('TOC extraction failed')
      })

      render(<RightHandPanel document={mockDocument} />)

      expect(screen.getByText('Failed to load table of contents')).toBeInTheDocument()
    })

    it('should handle version history fetch errors', async () => {
      vi.mocked(versionService.fetchVersionHistory).mockRejectedValue(new Error('Network error'))

      render(<RightHandPanel document={mockDocument} />)

      fireEvent.click(screen.getByRole('tab', { name: 'Version History' }))

      await waitFor(() => {
        expect(screen.getByText('Failed to load version history')).toBeInTheDocument()
      })
    })
  })

  describe('Performance', () => {
    it('should not re-extract TOC unnecessarily', () => {
      const { rerender } = render(<RightHandPanel document={mockDocument} />)

      // Re-render with same document
      rerender(<RightHandPanel document={mockDocument} />)

      expect(tocService.extractHeaders).toHaveBeenCalledTimes(1)
    })

    it('should lazy load version history until tab is activated', () => {
      render(<RightHandPanel document={mockDocument} />)

      // Should not fetch versions until tab is clicked
      expect(versionService.fetchVersionHistory).not.toHaveBeenCalled()

      fireEvent.click(screen.getByRole('tab', { name: 'Version History' }))

      expect(versionService.fetchVersionHistory).toHaveBeenCalledWith(mockDocument.id)
    })
  })
})