import { markdownService } from './markdownService'

export interface TOCHeader {
  id: string
  text: string
  level: number
  lineNumber: number
  anchor: string
}

export interface TOCHierarchyItem {
  id: string
  text: string
  level: number
  anchor: string
  children: TOCHierarchyItem[]
}

class TOCService {
  /**
   * Extract headers from document content and generate TOC data
   */
  extractHeaders(content: string): TOCHeader[] {
    if (!content.trim()) {
      return []
    }

    const lines = content.split('\n')
    const headers: TOCHeader[] = []
    const seenIds = new Set<string>()

    lines.forEach((line, index) => {
      const level = markdownService.getHeaderLevel(line)
      if (level > 0) {
        const parsed = markdownService.parseMarkdown(line)
        let baseId = this.generateId(parsed.text)
        let uniqueId = baseId
        let counter = 0

        // Ensure unique IDs for duplicate headers
        while (seenIds.has(uniqueId)) {
          counter++
          uniqueId = `${baseId}-${counter}`
        }

        seenIds.add(uniqueId)

        headers.push({
          id: uniqueId,
          text: parsed.text,
          level,
          lineNumber: index + 1,
          anchor: `#${uniqueId}`
        })
      }
    })

    return headers
  }

  /**
   * Generate hierarchical structure from flat header list
   */
  generateHierarchy(content: string): TOCHierarchyItem[] {
    const headers = this.extractHeaders(content)
    if (headers.length === 0) {
      return []
    }

    const hierarchy: TOCHierarchyItem[] = []
    const stack: TOCHierarchyItem[] = []

    headers.forEach(header => {
      const item: TOCHierarchyItem = {
        id: header.id,
        text: header.text,
        level: header.level,
        anchor: header.anchor,
        children: []
      }

      // Find the correct parent level
      while (stack.length > 0 && stack[stack.length - 1].level >= header.level) {
        stack.pop()
      }

      if (stack.length === 0) {
        // Top-level item
        hierarchy.push(item)
      } else {
        // Child item
        stack[stack.length - 1].children.push(item)
      }

      stack.push(item)
    })

    return hierarchy
  }

  /**
   * Generate URL-safe ID from header text
   */
  private generateId(text: string): string {
    return text
      .toLowerCase()
      .trim()
      // Replace spaces and special characters with hyphens
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      // Remove multiple consecutive hyphens
      .replace(/-+/g, '-')
      // Remove leading/trailing hyphens
      .replace(/^-+|-+$/g, '')
      // Fallback for empty strings
      || 'header'
  }

  /**
   * Find header by ID in header list
   */
  findHeaderById(headers: TOCHeader[], id: string): TOCHeader | null {
    return headers.find(header => header.id === id) || null
  }

  /**
   * Get breadcrumb path to a header (for nested navigation)
   */
  getHeaderPath(hierarchy: TOCHierarchyItem[], targetId: string): string[] {
    const path: string[] = []

    const findPath = (items: TOCHierarchyItem[], currentPath: string[]): boolean => {
      for (const item of items) {
        const newPath = [...currentPath, item.text]

        if (item.id === targetId) {
          path.push(...newPath)
          return true
        }

        if (item.children.length > 0 && findPath(item.children, newPath)) {
          return true
        }
      }
      return false
    }

    findPath(hierarchy, [])
    return path
  }

  /**
   * Validate header hierarchy (check for proper nesting)
   */
  validateHierarchy(content: string): boolean {
    const lines = content.split('\n')

    // First check for invalid header levels (H4 and beyond)
    for (const line of lines) {
      if (line.trim().match(/^#{4,}/)) {
        return false
      }
    }

    const headers = this.extractHeaders(content)

    for (let i = 1; i < headers.length; i++) {
      const current = headers[i]
      const previous = headers[i - 1]

      // Check if level jump is too large (e.g., H1 -> H3 without H2)
      if (current.level > previous.level + 1) {
        return false
      }
    }

    return true
  }

  /**
   * Get next header in sequence
   */
  getNextHeader(headers: TOCHeader[], currentId: string): TOCHeader | null {
    const currentIndex = headers.findIndex(h => h.id === currentId)
    if (currentIndex >= 0 && currentIndex < headers.length - 1) {
      return headers[currentIndex + 1]
    }
    return null
  }

  /**
   * Get previous header in sequence
   */
  getPreviousHeader(headers: TOCHeader[], currentId: string): TOCHeader | null {
    const currentIndex = headers.findIndex(h => h.id === currentId)
    if (currentIndex > 0) {
      return headers[currentIndex - 1]
    }
    return null
  }

  /**
   * Get table of contents as markdown list
   */
  generateMarkdownTOC(content: string): string {
    const hierarchy = this.generateHierarchy(content)

    const generateMarkdownList = (items: TOCHierarchyItem[], indent = 0): string => {
      let result = ''

      items.forEach(item => {
        const prefix = '  '.repeat(indent) + '- '
        const link = `[${item.text}](${item.anchor})`
        result += prefix + link + '\n'

        if (item.children.length > 0) {
          result += generateMarkdownList(item.children, indent + 1)
        }
      })

      return result
    }

    return generateMarkdownList(hierarchy).trim()
  }

  /**
   * Find headers within a specific level range
   */
  getHeadersByLevel(content: string, minLevel: number, maxLevel: number): TOCHeader[] {
    const headers = this.extractHeaders(content)
    return headers.filter(header =>
      header.level >= minLevel && header.level <= maxLevel
    )
  }

  /**
   * Get document outline statistics
   */
  getOutlineStats(content: string): {
    totalHeaders: number
    headersByLevel: Record<number, number>
    maxDepth: number
    hasOrphans: boolean
  } {
    const headers = this.extractHeaders(content)
    const headersByLevel: Record<number, number> = {}
    let maxDepth = 0

    headers.forEach(header => {
      headersByLevel[header.level] = (headersByLevel[header.level] || 0) + 1
      maxDepth = Math.max(maxDepth, header.level)
    })

    // Check for orphaned headers (e.g., H3 without parent H2)
    const hasOrphans = !this.validateHierarchy(content)

    return {
      totalHeaders: headers.length,
      headersByLevel,
      maxDepth,
      hasOrphans
    }
  }
}

export const tocService = new TOCService()