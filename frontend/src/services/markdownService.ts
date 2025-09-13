export type HeaderFormat = 'normal' | 'h1' | 'h2' | 'h3'

export interface MarkdownParseResult {
  format: HeaderFormat
  text: string
}

class MarkdownService {
  /**
   * Convert text to markdown format with specified header level
   */
  convertToMarkdown(text: string, format: HeaderFormat): string {
    switch (format) {
      case 'h1':
        return `# ${text}`
      case 'h2':
        return `## ${text}`
      case 'h3':
        return `### ${text}`
      case 'normal':
      default:
        return text
    }
  }

  /**
   * Parse markdown text to extract format and clean text
   */
  parseMarkdown(input: string): MarkdownParseResult {
    const trimmedInput = input.trim()

    // Check for H1 (single #)
    const h1Match = trimmedInput.match(/^#\s+(.*)$/)
    if (h1Match) {
      return {
        format: 'h1',
        text: h1Match[1].trim()
      }
    }

    // Check for H2 (double ##)
    const h2Match = trimmedInput.match(/^##\s+(.*)$/)
    if (h2Match) {
      return {
        format: 'h2',
        text: h2Match[1].trim()
      }
    }

    // Check for H3 (triple ###)
    const h3Match = trimmedInput.match(/^###\s+(.*)$/)
    if (h3Match) {
      return {
        format: 'h3',
        text: h3Match[1].trim()
      }
    }

    // Check for empty header markers (just # symbols)
    if (trimmedInput === '#') {
      return { format: 'h1', text: '' }
    }
    if (trimmedInput === '##') {
      return { format: 'h2', text: '' }
    }
    if (trimmedInput === '###') {
      return { format: 'h3', text: '' }
    }

    // Default to normal text
    return {
      format: 'normal',
      text: trimmedInput
    }
  }

  /**
   * Check if text is a markdown header (H1, H2, or H3)
   */
  isMarkdownHeader(text: string): boolean {
    const trimmed = text.trim()
    return /^#{1,3}\s/.test(trimmed) || /^#{1,3}$/.test(trimmed)
  }

  /**
   * Get header level from markdown text (1, 2, 3, or 0 for non-header)
   */
  getHeaderLevel(text: string): number {
    const trimmed = text.trim()

    if (trimmed.startsWith('### ') || trimmed === '###') return 3
    if (trimmed.startsWith('## ') || trimmed === '##') return 2
    if (trimmed.startsWith('# ') || trimmed === '#') return 1

    return 0
  }

  /**
   * Strip markdown formatting from text, returning just the content
   */
  stripMarkdown(text: string): string {
    const result = this.parseMarkdown(text)
    return result.text
  }

  /**
   * Convert header level number to format string
   */
  levelToFormat(level: number): HeaderFormat {
    switch (level) {
      case 1: return 'h1'
      case 2: return 'h2'
      case 3: return 'h3'
      default: return 'normal'
    }
  }

  /**
   * Convert format string to header level number
   */
  formatToLevel(format: HeaderFormat): number {
    switch (format) {
      case 'h1': return 1
      case 'h2': return 2
      case 'h3': return 3
      default: return 0
    }
  }

  /**
   * Get markdown prefix for a given format
   */
  getMarkdownPrefix(format: HeaderFormat): string {
    switch (format) {
      case 'h1': return '# '
      case 'h2': return '## '
      case 'h3': return '### '
      default: return ''
    }
  }

  /**
   * Extract all headers from a document with their positions
   */
  extractHeaders(content: string): Array<{
    level: number
    text: string
    format: HeaderFormat
    lineNumber: number
    originalLine: string
  }> {
    const lines = content.split('\n')
    const headers: Array<{
      level: number
      text: string
      format: HeaderFormat
      lineNumber: number
      originalLine: string
    }> = []

    lines.forEach((line, index) => {
      const level = this.getHeaderLevel(line)
      if (level > 0) {
        const parsed = this.parseMarkdown(line)
        headers.push({
          level,
          text: parsed.text,
          format: parsed.format,
          lineNumber: index + 1,
          originalLine: line
        })
      }
    })

    return headers
  }
}

export const markdownService = new MarkdownService()