import { tocService } from '../tocService'

describe('TOCService', () => {
  const sampleDocument = `# Main Title
This is some intro content.

## Section One
Content for section one here.

### Subsection A
More detailed content.

### Subsection B
Another subsection with content.

## Section Two
More content here.

Regular paragraph without header.

### Another Subsection
Final subsection content.

## Final Section
Conclusion content.`

  describe('Header Extraction', () => {
    it('should extract headers from document content', () => {
      const headers = tocService.extractHeaders(sampleDocument)

      expect(headers).toHaveLength(7)
      expect(headers[0]).toEqual({
        id: 'main-title',
        text: 'Main Title',
        level: 1,
        lineNumber: 1,
        anchor: '#main-title'
      })
      expect(headers[1]).toEqual({
        id: 'section-one',
        text: 'Section One',
        level: 2,
        lineNumber: 4,
        anchor: '#section-one'
      })
    })

    it('should generate unique IDs for duplicate headers', () => {
      const duplicateDoc = `# Title
## Section
### Subsection
## Section
### Subsection`

      const headers = tocService.extractHeaders(duplicateDoc)

      expect(headers[1].id).toBe('section')
      expect(headers[3].id).toBe('section-1')
      expect(headers[2].id).toBe('subsection')
      expect(headers[4].id).toBe('subsection-1')
    })

    it('should handle special characters in headers', () => {
      const specialDoc = `# Title with @#$%^&*() symbols!
## Section: "Quoted Text" & More
### 100% Complete (Final) [Draft]`

      const headers = tocService.extractHeaders(specialDoc)

      expect(headers[0].id).toBe('title-with-symbols')
      expect(headers[1].id).toBe('section-quoted-text-more')
      expect(headers[2].id).toBe('100-complete-final-draft')
    })

    it('should handle empty document gracefully', () => {
      const headers = tocService.extractHeaders('')
      expect(headers).toEqual([])
    })

    it('should handle document with no headers', () => {
      const noHeaderDoc = `Just regular text here.
And more regular text.
No headers at all.`

      const headers = tocService.extractHeaders(noHeaderDoc)
      expect(headers).toEqual([])
    })
  })

  describe('Hierarchical Structure Generation', () => {
    it('should generate hierarchical structure of headers', () => {
      const structure = tocService.generateHierarchy(sampleDocument)

      expect(structure).toHaveLength(1) // One top-level item
      expect(structure[0].text).toBe('Main Title')
      expect(structure[0].level).toBe(1)
      expect(structure[0].children).toHaveLength(3) // Three H2 sections

      // Check first H2 section
      const sectionOne = structure[0].children[0]
      expect(sectionOne.text).toBe('Section One')
      expect(sectionOne.level).toBe(2)
      expect(sectionOne.children).toHaveLength(2) // Two H3 subsections

      // Check subsections
      expect(sectionOne.children[0].text).toBe('Subsection A')
      expect(sectionOne.children[1].text).toBe('Subsection B')
    })

    it('should handle multiple top-level headers', () => {
      const multiTopDoc = `# First Title
## Section
# Second Title
## Another Section`

      const structure = tocService.generateHierarchy(multiTopDoc)

      expect(structure).toHaveLength(2)
      expect(structure[0].text).toBe('First Title')
      expect(structure[1].text).toBe('Second Title')
    })

    it('should handle orphaned subsections', () => {
      const orphanDoc = `### Orphaned H3
## Proper H2
### Under H2`

      const structure = tocService.generateHierarchy(orphanDoc)

      // Should create virtual parent for orphaned headers
      expect(structure).toHaveLength(2)
      expect(structure[0].level).toBe(3) // Orphaned H3 becomes top-level
      expect(structure[1].level).toBe(2) // Proper H2
    })
  })

  describe('Navigation Anchor Generation', () => {
    it('should create navigation anchors for each header', () => {
      const headers = tocService.extractHeaders(sampleDocument)

      headers.forEach(header => {
        expect(header.anchor).toMatch(/^#[a-z0-9-]+$/)
        expect(header.anchor).toBe(`#${header.id}`)
      })
    })

    it('should generate URL-safe anchor IDs', () => {
      const complexDoc = `# Title With Spaces & Symbols!
## 100% Complete (Final Version)
### "Quoted Section" [DRAFT]`

      const headers = tocService.extractHeaders(complexDoc)

      expect(headers[0].anchor).toBe('#title-with-spaces-symbols')
      expect(headers[1].anchor).toBe('#100-complete-final-version')
      expect(headers[2].anchor).toBe('#quoted-section-draft')
    })
  })

  describe('Real-time Content Analysis', () => {
    it('should detect changes in header content', () => {
      const originalHeaders = tocService.extractHeaders(sampleDocument)

      const updatedDoc = sampleDocument.replace('# Main Title', '# Updated Main Title')
      const updatedHeaders = tocService.extractHeaders(updatedDoc)

      expect(originalHeaders[0].text).toBe('Main Title')
      expect(updatedHeaders[0].text).toBe('Updated Main Title')
      expect(updatedHeaders[0].id).toBe('updated-main-title')
    })

    it('should handle header additions', () => {
      const originalHeaders = tocService.extractHeaders('# Title One\n## Section')
      const extendedDoc = '# Title One\n## Section\n### New Subsection'
      const extendedHeaders = tocService.extractHeaders(extendedDoc)

      expect(originalHeaders).toHaveLength(2)
      expect(extendedHeaders).toHaveLength(3)
      expect(extendedHeaders[2].text).toBe('New Subsection')
    })

    it('should handle header removals', () => {
      const originalHeaders = tocService.extractHeaders(sampleDocument)
      const reducedDoc = sampleDocument.replace('## Section Two\nMore content here.\n\nRegular paragraph without header.\n\n### Another Subsection\nFinal subsection content.\n\n', '')
      const reducedHeaders = tocService.extractHeaders(reducedDoc)

      expect(originalHeaders).toHaveLength(7)
      expect(reducedHeaders).toHaveLength(5)
    })
  })

  describe('Utility Methods', () => {
    it('should find header by ID', () => {
      const headers = tocService.extractHeaders(sampleDocument)
      const found = tocService.findHeaderById(headers, 'section-one')

      expect(found).toBeDefined()
      expect(found?.text).toBe('Section One')
      expect(found?.level).toBe(2)
    })

    it('should return null for non-existent header ID', () => {
      const headers = tocService.extractHeaders(sampleDocument)
      const found = tocService.findHeaderById(headers, 'non-existent')

      expect(found).toBeNull()
    })

    it('should get header path (breadcrumb)', () => {
      const structure = tocService.generateHierarchy(sampleDocument)
      const path = tocService.getHeaderPath(structure, 'subsection-a')

      expect(path).toEqual(['Main Title', 'Section One', 'Subsection A'])
    })

    it('should validate header hierarchy', () => {
      const validDoc = '# H1\n## H2\n### H3'
      const invalidDoc = '### H3\n# H1\n#### H4'

      expect(tocService.validateHierarchy(validDoc)).toBe(true)
      expect(tocService.validateHierarchy(invalidDoc)).toBe(false)
    })

    it('should get next/previous headers', () => {
      const headers = tocService.extractHeaders(sampleDocument)

      const firstHeader = headers[0]
      const secondHeader = headers[1]
      const lastHeader = headers[headers.length - 1]

      expect(tocService.getNextHeader(headers, firstHeader.id)).toBe(secondHeader)
      expect(tocService.getPreviousHeader(headers, secondHeader.id)).toBe(firstHeader)
      expect(tocService.getNextHeader(headers, lastHeader.id)).toBeNull()
      expect(tocService.getPreviousHeader(headers, firstHeader.id)).toBeNull()
    })
  })
})