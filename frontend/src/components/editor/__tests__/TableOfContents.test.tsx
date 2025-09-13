import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { TableOfContents } from '../TableOfContents'
import { tocService } from '../../../services/tocService'

// Mock the TOC service
vi.mock('../../../services/tocService', () => ({
  tocService: {
    extractHeaders: vi.fn(),
    generateHierarchy: vi.fn(),
    validateHierarchy: vi.fn()
  }
}))

describe('TableOfContents', () => {
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
      lineNumber: 3,
      anchor: '#section-one'
    },
    {
      id: 'subsection-a',
      text: 'Subsection A',
      level: 3,
      lineNumber: 5,
      anchor: '#subsection-a'
    },
    {
      id: 'section-two',
      text: 'Section Two',
      level: 2,
      lineNumber: 8,
      anchor: '#section-two'
    }
  ]

  const mockHierarchy = [
    {
      id: 'main-title',
      text: 'Main Title',
      level: 1,
      anchor: '#main-title',
      children: [
        {
          id: 'section-one',
          text: 'Section One',
          level: 2,
          anchor: '#section-one',
          children: [
            {
              id: 'subsection-a',
              text: 'Subsection A',
              level: 3,
              anchor: '#subsection-a',
              children: []
            }
          ]
        },
        {
          id: 'section-two',
          text: 'Section Two',
          level: 2,
          anchor: '#section-two',
          children: []
        }
      ]
    }
  ]

  const mockContent = `# Main Title
Some intro content.

## Section One
Content for section one.

### Subsection A
Detailed content here.

## Section Two
More content here.`

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(tocService.extractHeaders).mockReturnValue(mockHeaders)
    vi.mocked(tocService.generateHierarchy).mockReturnValue(mockHierarchy)
    vi.mocked(tocService.validateHierarchy).mockReturnValue(true)
  })

  describe('Basic Rendering', () => {
    it('should render table of contents with headers', () => {
      render(<TableOfContents content={mockContent} />)

      expect(screen.getByText('Main Title')).toBeInTheDocument()
      expect(screen.getByText('Section One')).toBeInTheDocument()
      expect(screen.getByText('Subsection A')).toBeInTheDocument()
      expect(screen.getByText('Section Two')).toBeInTheDocument()
    })

    it('should extract headers from content', () => {
      render(<TableOfContents content={mockContent} />)

      expect(tocService.extractHeaders).toHaveBeenCalledWith(mockContent)
    })

    it('should display hierarchical structure by default', () => {
      render(<TableOfContents content={mockContent} />)

      const mainTitle = screen.getByText('Main Title')
      const sectionOne = screen.getByText('Section One')
      const subsectionA = screen.getByText('Subsection A')

      // Check hierarchy through CSS classes or structure
      expect(mainTitle.closest('li')).toHaveClass('level-1')
      expect(sectionOne.closest('li')).toHaveClass('level-2')
      expect(subsectionA.closest('li')).toHaveClass('level-3')
    })

    it('should show flat list when hierarchical is false', () => {
      render(<TableOfContents content={mockContent} hierarchical={false} />)

      expect(tocService.extractHeaders).toHaveBeenCalledWith(mockContent)
      expect(tocService.generateHierarchy).not.toHaveBeenCalled()
    })
  })

  describe('Navigation', () => {
    it('should handle header clicks for navigation', () => {
      const onHeaderClick = vi.fn()
      render(<TableOfContents content={mockContent} onHeaderClick={onHeaderClick} />)

      const sectionHeader = screen.getByText('Section One')
      fireEvent.click(sectionHeader)

      expect(onHeaderClick).toHaveBeenCalledWith('section-one')
    })

    it('should highlight active header', () => {
      render(<TableOfContents content={mockContent} activeHeaderId="section-one" />)

      const activeHeader = screen.getByText('Section One')
      expect(activeHeader.closest('button')).toHaveClass('active')
    })

    it('should support keyboard navigation', () => {
      const onHeaderClick = vi.fn()
      render(<TableOfContents content={mockContent} onHeaderClick={onHeaderClick} />)

      const sectionHeader = screen.getByText('Section One')
      fireEvent.keyDown(sectionHeader, { key: 'Enter' })

      expect(onHeaderClick).toHaveBeenCalledWith('section-one')
    })

    it('should generate proper anchor links', () => {
      render(<TableOfContents content={mockContent} showAnchors={true} />)

      const sectionHeader = screen.getByText('Section One')
      expect(sectionHeader.closest('button')).toHaveAttribute('title', 'Navigate to Section One')
    })
  })

  describe('Visual Customization', () => {
    it('should show line numbers when enabled', () => {
      render(<TableOfContents content={mockContent} showLineNumbers={true} />)

      expect(screen.getByText('1')).toBeInTheDocument() // Main Title line
      expect(screen.getByText('3')).toBeInTheDocument() // Section One line
      expect(screen.getByText('5')).toBeInTheDocument() // Subsection A line
      expect(screen.getByText('8')).toBeInTheDocument() // Section Two line
    })

    it('should filter headers by level when specified', () => {
      render(<TableOfContents content={mockContent} maxLevel={2} />)

      expect(screen.getByText('Main Title')).toBeInTheDocument()
      expect(screen.getByText('Section One')).toBeInTheDocument()
      expect(screen.queryByText('Subsection A')).not.toBeInTheDocument() // Level 3, should be filtered
      expect(screen.getByText('Section Two')).toBeInTheDocument()
    })

    it('should apply custom styling classes', () => {
      render(<TableOfContents content={mockContent} className="custom-toc" />)

      const tocContainer = screen.getByRole('list')
      expect(tocContainer).toHaveClass('custom-toc')
    })

    it('should show header counts by level when enabled', () => {
      render(<TableOfContents content={mockContent} showCounts={true} />)

      expect(screen.getByText('(1)')).toBeInTheDocument() // 1 H1
      expect(screen.getByText('(2)')).toBeInTheDocument() // 2 H2s
    })
  })

  describe('Interactive Features', () => {
    it('should support collapsible sections', () => {
      render(<TableOfContents content={mockContent} collapsible={true} />)

      const mainTitle = screen.getByText('Main Title')
      const collapseButton = mainTitle.parentElement?.querySelector('[aria-label="Collapse section"]')

      expect(collapseButton).toBeInTheDocument()

      // Click to collapse
      fireEvent.click(collapseButton!)

      // Check if children are hidden
      expect(screen.queryByText('Section One')).not.toBeVisible()
    })

    it('should support search functionality', () => {
      render(<TableOfContents content={mockContent} searchable={true} />)

      const searchInput = screen.getByPlaceholderText('Search headers...')
      expect(searchInput).toBeInTheDocument()

      // Search for "section"
      fireEvent.change(searchInput, { target: { value: 'section' } })

      expect(screen.getByText('Section One')).toBeInTheDocument()
      expect(screen.getByText('Section Two')).toBeInTheDocument()
      expect(screen.queryByText('Main Title')).not.toBeInTheDocument() // Should be filtered out
    })

    it('should update when content changes', () => {
      const { rerender } = render(<TableOfContents content={mockContent} />)

      const newContent = '# New Title\n## New Section'
      const newHeaders = [
        {
          id: 'new-title',
          text: 'New Title',
          level: 1,
          lineNumber: 1,
          anchor: '#new-title'
        }
      ]

      vi.mocked(tocService.extractHeaders).mockReturnValue(newHeaders)

      rerender(<TableOfContents content={newContent} />)

      expect(tocService.extractHeaders).toHaveBeenCalledWith(newContent)
    })
  })

  describe('Empty States', () => {
    it('should show empty state when no headers exist', () => {
      vi.mocked(tocService.extractHeaders).mockReturnValue([])

      render(<TableOfContents content="No headers in this content" />)

      expect(screen.getByText('No table of contents available')).toBeInTheDocument()
    })

    it('should handle empty content gracefully', () => {
      render(<TableOfContents content="" />)

      expect(screen.getByText('No table of contents available')).toBeInTheDocument()
    })

    it('should show custom empty message when provided', () => {
      vi.mocked(tocService.extractHeaders).mockReturnValue([])

      render(
        <TableOfContents
          content="No headers"
          emptyMessage="Custom empty message"
        />
      )

      expect(screen.getByText('Custom empty message')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      render(<TableOfContents content={mockContent} />)

      expect(screen.getByRole('list')).toBeInTheDocument()
      expect(screen.getByLabelText('Table of contents navigation')).toBeInTheDocument()

      const headers = screen.getAllByRole('button')
      headers.forEach(header => {
        expect(header).toHaveAttribute('aria-label')
      })
    })

    it('should support screen reader navigation', () => {
      render(<TableOfContents content={mockContent} />)

      const tocList = screen.getByRole('list')
      expect(tocList).toHaveAttribute('aria-label', 'Table of contents navigation')

      const firstHeader = screen.getByText('Main Title')
      expect(firstHeader).toHaveAttribute('tabIndex', '0')
    })

    it('should announce level changes to screen readers', () => {
      render(<TableOfContents content={mockContent} />)

      const h1Button = screen.getByText('Main Title')
      const h2Button = screen.getByText('Section One')
      const h3Button = screen.getByText('Subsection A')

      expect(h1Button).toHaveAttribute('aria-label', 'Navigate to Main Title, level 1')
      expect(h2Button).toHaveAttribute('aria-label', 'Navigate to Section One, level 2')
      expect(h3Button).toHaveAttribute('aria-label', 'Navigate to Subsection A, level 3')
    })
  })

  describe('Error Handling', () => {
    it('should handle extraction errors gracefully', () => {
      vi.mocked(tocService.extractHeaders).mockImplementation(() => {
        throw new Error('Extraction failed')
      })

      render(<TableOfContents content={mockContent} />)

      expect(screen.getByText('Failed to generate table of contents')).toBeInTheDocument()
    })

    it('should validate hierarchy and show warnings', () => {
      vi.mocked(tocService.validateHierarchy).mockReturnValue(false)

      render(<TableOfContents content={mockContent} showValidation={true} />)

      expect(screen.getByText(/Invalid header hierarchy detected/)).toBeInTheDocument()
    })
  })

  describe('Performance', () => {
    it('should not re-extract headers when content is unchanged', () => {
      const { rerender } = render(<TableOfContents content={mockContent} />)

      // Re-render with same content
      rerender(<TableOfContents content={mockContent} />)

      expect(tocService.extractHeaders).toHaveBeenCalledTimes(1)
    })

    it('should debounce search input', async () => {
      vi.useFakeTimers()

      render(<TableOfContents content={mockContent} searchable={true} />)

      const searchInput = screen.getByPlaceholderText('Search headers...')

      // Type multiple characters quickly
      fireEvent.change(searchInput, { target: { value: 's' } })
      fireEvent.change(searchInput, { target: { value: 'se' } })
      fireEvent.change(searchInput, { target: { value: 'sec' } })

      // Fast-forward time
      vi.advanceTimersByTime(300)

      // Should only filter once after debounce
      expect(screen.getByText('Section One')).toBeInTheDocument()

      vi.useRealTimers()
    })
  })
})