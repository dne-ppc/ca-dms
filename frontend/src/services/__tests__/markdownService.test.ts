import { markdownService } from '../markdownService'

describe('MarkdownService', () => {
  describe('Header Conversion', () => {
    it('should convert H1 header formatting', () => {
      const input = 'Main Title'
      const result = markdownService.convertToMarkdown(input, 'h1')

      expect(result).toBe('# Main Title')
    })

    it('should convert H2 header formatting', () => {
      const input = 'Section Title'
      const result = markdownService.convertToMarkdown(input, 'h2')

      expect(result).toBe('## Section Title')
    })

    it('should convert H3 header formatting', () => {
      const input = 'Subsection Title'
      const result = markdownService.convertToMarkdown(input, 'h3')

      expect(result).toBe('### Subsection Title')
    })

    it('should handle normal text without markdown prefix', () => {
      const input = 'Regular paragraph text'
      const result = markdownService.convertToMarkdown(input, 'normal')

      expect(result).toBe('Regular paragraph text')
    })

    it('should handle empty input gracefully', () => {
      const result = markdownService.convertToMarkdown('', 'h1')

      expect(result).toBe('# ')
    })
  })

  describe('Bi-directional Conversion', () => {
    it('should parse H1 markdown back to format and text', () => {
      const input = '# Main Title'
      const result = markdownService.parseMarkdown(input)

      expect(result.format).toBe('h1')
      expect(result.text).toBe('Main Title')
    })

    it('should parse H2 markdown back to format and text', () => {
      const input = '## Section Title'
      const result = markdownService.parseMarkdown(input)

      expect(result.format).toBe('h2')
      expect(result.text).toBe('Section Title')
    })

    it('should parse H3 markdown back to format and text', () => {
      const input = '### Subsection Title'
      const result = markdownService.parseMarkdown(input)

      expect(result.format).toBe('h3')
      expect(result.text).toBe('Subsection Title')
    })

    it('should parse normal text as normal format', () => {
      const input = 'Regular paragraph text'
      const result = markdownService.parseMarkdown(input)

      expect(result.format).toBe('normal')
      expect(result.text).toBe('Regular paragraph text')
    })

    it('should handle text with multiple hash symbols correctly', () => {
      const input = '## Title with # hash in content'
      const result = markdownService.parseMarkdown(input)

      expect(result.format).toBe('h2')
      expect(result.text).toBe('Title with # hash in content')
    })

    it('should handle markdown with extra spaces', () => {
      const input = '###   Spaced Title   '
      const result = markdownService.parseMarkdown(input)

      expect(result.format).toBe('h3')
      expect(result.text).toBe('Spaced Title')
    })
  })

  describe('Content Preservation', () => {
    it('should preserve non-header content in mixed documents', () => {
      const content = [
        '# Main Title',
        'Regular paragraph content',
        '## Section',
        'More content here',
        '### Subsection',
        'Final content'
      ]

      const results = content.map(line => markdownService.parseMarkdown(line))

      expect(results[0]).toEqual({ format: 'h1', text: 'Main Title' })
      expect(results[1]).toEqual({ format: 'normal', text: 'Regular paragraph content' })
      expect(results[2]).toEqual({ format: 'h2', text: 'Section' })
      expect(results[3]).toEqual({ format: 'normal', text: 'More content here' })
      expect(results[4]).toEqual({ format: 'h3', text: 'Subsection' })
      expect(results[5]).toEqual({ format: 'normal', text: 'Final content' })
    })

    it('should handle special characters in headers', () => {
      const input = '# Title with @#$%^&*() special chars!'
      const result = markdownService.parseMarkdown(input)

      expect(result.format).toBe('h1')
      expect(result.text).toBe('Title with @#$%^&*() special chars!')
    })

    it('should handle unicode characters in headers', () => {
      const input = '## Título con acentos y émojis 🚀'
      const result = markdownService.parseMarkdown(input)

      expect(result.format).toBe('h2')
      expect(result.text).toBe('Título con acentos y émojis 🚀')
    })
  })

  describe('Utility Methods', () => {
    it('should detect if text is markdown header', () => {
      expect(markdownService.isMarkdownHeader('# Title')).toBe(true)
      expect(markdownService.isMarkdownHeader('## Title')).toBe(true)
      expect(markdownService.isMarkdownHeader('### Title')).toBe(true)
      expect(markdownService.isMarkdownHeader('Regular text')).toBe(false)
      expect(markdownService.isMarkdownHeader('#### Title')).toBe(false) // H4 not supported
    })

    it('should get header level from markdown', () => {
      expect(markdownService.getHeaderLevel('# Title')).toBe(1)
      expect(markdownService.getHeaderLevel('## Title')).toBe(2)
      expect(markdownService.getHeaderLevel('### Title')).toBe(3)
      expect(markdownService.getHeaderLevel('Regular text')).toBe(0)
    })

    it('should strip markdown formatting from text', () => {
      expect(markdownService.stripMarkdown('# Title')).toBe('Title')
      expect(markdownService.stripMarkdown('## Section')).toBe('Section')
      expect(markdownService.stripMarkdown('### Subsection')).toBe('Subsection')
      expect(markdownService.stripMarkdown('Regular text')).toBe('Regular text')
    })
  })

  describe('Edge Cases', () => {
    it('should handle malformed markdown gracefully', () => {
      const result = markdownService.parseMarkdown('#Title without space')
      expect(result.format).toBe('normal')
      expect(result.text).toBe('#Title without space')
    })

    it('should handle only hash symbols', () => {
      const result = markdownService.parseMarkdown('###')
      expect(result.format).toBe('h3')
      expect(result.text).toBe('')
    })

    it('should handle very long headers', () => {
      const longTitle = 'A'.repeat(200)
      const input = `## ${longTitle}`
      const result = markdownService.parseMarkdown(input)

      expect(result.format).toBe('h2')
      expect(result.text).toBe(longTitle)
    })
  })
})