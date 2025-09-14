export interface DocumentTemplate {
  id: string
  name: string
  description: string
  category: 'governance' | 'legal' | 'hr' | 'finance' | 'general'
  icon: string
  preview: string
  content: any // Quill Delta format
  placeholders: string[] // Array of placeholder IDs used in template
  metadata: {
    author: string
    version: string
    created: string
    tags: string[]
    difficulty: 'beginner' | 'intermediate' | 'advanced'
    estimatedTime: string // e.g., "15 minutes"
  }
  popularity: number
  isCustom?: boolean
}

export class DocumentTemplateManager {
  private static templates: DocumentTemplate[] = [
    // Governance Templates
    {
      id: 'board-resolution',
      name: 'Board Resolution',
      description: 'Standard board resolution template for governance decisions',
      category: 'governance',
      icon: '🏛️',
      preview: 'Formal board resolution with voting record',
      content: {
        ops: [
          { insert: 'BOARD RESOLUTION\n', attributes: { header: 1, align: 'center' } },
          { insert: '\n' },
          { insert: 'Resolution No: ' },
          { insert: 'RESOLUTION_NUMBER', attributes: { 'enhanced-line': { id: 'res-number', label: 'Resolution Number', length: 'medium' } } },
          { insert: '\nDate: ' },
          { insert: 'RESOLUTION_DATE', attributes: { 'enhanced-date': { id: 'res-date', label: 'Resolution Date' } } },
          { insert: '\n\n' },
          { insert: 'WHEREAS, ', attributes: { bold: true } },
          { insert: 'WHEREAS_CLAUSE', attributes: { 'enhanced-response': { id: 'whereas', label: 'Whereas Clause', lines: 3 } } },
          { insert: '\n\n' },
          { insert: 'NOW, THEREFORE, BE IT RESOLVED, ', attributes: { bold: true } },
          { insert: 'that ' },
          { insert: 'RESOLUTION_TEXT', attributes: { 'enhanced-response': { id: 'resolution', label: 'Resolution Text', lines: 5 } } },
          { insert: '\n\n' },
          { insert: 'This resolution was adopted by the following vote:\n\n', attributes: { bold: true } },
          { insert: 'For: _____ Against: _____ Abstain: _____\n\n' },
          { insert: 'SECRETARY_SIGNATURE', attributes: { 'enhanced-signature': { id: 'secretary', label: 'Secretary Signature', preset: 'standard' } } },
          { insert: '\n' },
          { insert: 'CHAIRMAN_SIGNATURE', attributes: { 'enhanced-signature': { id: 'chairman', label: 'Chairman Signature', preset: 'executive' } } },
          { insert: '\n' }
        ]
      },
      placeholders: ['res-number', 'res-date', 'whereas', 'resolution', 'secretary', 'chairman'],
      metadata: {
        author: 'CA-DMS System',
        version: '1.0',
        created: '2024-01-15',
        tags: ['governance', 'board', 'resolution', 'voting'],
        difficulty: 'intermediate',
        estimatedTime: '20 minutes'
      },
      popularity: 95
    },

    {
      id: 'meeting-minutes',
      name: 'Meeting Minutes',
      description: 'Comprehensive meeting minutes template with attendance and action items',
      category: 'governance',
      icon: '📝',
      preview: 'Structured meeting minutes with attendance tracking',
      content: {
        ops: [
          { insert: 'MEETING MINUTES\n', attributes: { header: 1, align: 'center' } },
          { insert: '\n' },
          { insert: 'Meeting Type: ' },
          { insert: 'MEETING_TYPE', attributes: { 'enhanced-line': { id: 'meeting-type', label: 'Meeting Type', length: 'medium' } } },
          { insert: '\nDate: ' },
          { insert: 'MEETING_DATE', attributes: { 'enhanced-date': { id: 'meeting-date', label: 'Meeting Date' } } },
          { insert: '\nTime: ' },
          { insert: 'MEETING_TIME', attributes: { 'enhanced-line': { id: 'meeting-time', label: 'Meeting Time', length: 'short' } } },
          { insert: '\nLocation: ' },
          { insert: 'MEETING_LOCATION', attributes: { 'enhanced-line': { id: 'location', label: 'Location', length: 'long' } } },
          { insert: '\n\n' },

          { insert: 'ATTENDANCE\n', attributes: { header: 2 } },
          { insert: 'Present:\n' },
          { insert: 'ATTENDEES_PRESENT', attributes: { 'enhanced-response': { id: 'present', label: 'Attendees Present', lines: 4 } } },
          { insert: '\nAbsent:\n' },
          { insert: 'ATTENDEES_ABSENT', attributes: { 'enhanced-response': { id: 'absent', label: 'Attendees Absent', lines: 2 } } },
          { insert: '\n\n' },

          { insert: 'AGENDA ITEMS\n', attributes: { header: 2 } },
          { insert: 'AGENDA_ITEMS', attributes: { 'enhanced-response': { id: 'agenda', label: 'Agenda Items', lines: 8 } } },
          { insert: '\n\n' },

          { insert: 'DECISIONS MADE\n', attributes: { header: 2 } },
          { insert: 'DECISIONS', attributes: { 'enhanced-response': { id: 'decisions', label: 'Decisions Made', lines: 5 } } },
          { insert: '\n\n' },

          { insert: 'ACTION ITEMS\n', attributes: { header: 2 } },
          { insert: 'ACTION_ITEMS', attributes: { 'enhanced-response': { id: 'actions', label: 'Action Items', lines: 6 } } },
          { insert: '\n\n' },

          { insert: 'Next Meeting: ' },
          { insert: 'NEXT_MEETING', attributes: { 'enhanced-date': { id: 'next-meeting', label: 'Next Meeting Date' } } },
          { insert: '\n\n' },
          { insert: 'SECRETARY_SIGNATURE', attributes: { 'enhanced-signature': { id: 'minutes-secretary', label: 'Secretary Signature' } } },
          { insert: '\n' }
        ]
      },
      placeholders: ['meeting-type', 'meeting-date', 'meeting-time', 'location', 'present', 'absent', 'agenda', 'decisions', 'actions', 'next-meeting', 'minutes-secretary'],
      metadata: {
        author: 'CA-DMS System',
        version: '1.0',
        created: '2024-01-15',
        tags: ['governance', 'meeting', 'minutes', 'attendance'],
        difficulty: 'beginner',
        estimatedTime: '30 minutes'
      },
      popularity: 92
    },

    // Legal Templates
    {
      id: 'contract-template',
      name: 'Service Contract',
      description: 'Standard service agreement template with terms and conditions',
      category: 'legal',
      icon: '📄',
      preview: 'Professional service contract with signature blocks',
      content: {
        ops: [
          { insert: 'SERVICE AGREEMENT\n', attributes: { header: 1, align: 'center' } },
          { insert: '\n' },
          { insert: 'This Service Agreement ("Agreement") is entered into on ' },
          { insert: 'CONTRACT_DATE', attributes: { 'enhanced-date': { id: 'contract-date', label: 'Contract Date' } } },
          { insert: ' between:\n\n' },

          { insert: 'CLIENT:\n', attributes: { bold: true } },
          { insert: 'CLIENT_NAME', attributes: { 'enhanced-line': { id: 'client-name', label: 'Client Name', length: 'long' } } },
          { insert: '\nAddress: ' },
          { insert: 'CLIENT_ADDRESS', attributes: { 'enhanced-response': { id: 'client-address', label: 'Client Address', lines: 2 } } },
          { insert: '\n\n' },

          { insert: 'SERVICE PROVIDER:\n', attributes: { bold: true } },
          { insert: 'PROVIDER_NAME', attributes: { 'enhanced-line': { id: 'provider-name', label: 'Service Provider Name', length: 'long' } } },
          { insert: '\nAddress: ' },
          { insert: 'PROVIDER_ADDRESS', attributes: { 'enhanced-response': { id: 'provider-address', label: 'Provider Address', lines: 2 } } },
          { insert: '\n\n' },

          { insert: '1. SERVICES\n', attributes: { header: 2 } },
          { insert: 'The Service Provider agrees to provide the following services:\n' },
          { insert: 'SERVICES_DESCRIPTION', attributes: { 'enhanced-response': { id: 'services', label: 'Services Description', lines: 5 } } },
          { insert: '\n\n' },

          { insert: '2. COMPENSATION\n', attributes: { header: 2 } },
          { insert: 'Total compensation: $' },
          { insert: 'TOTAL_AMOUNT', attributes: { 'enhanced-line': { id: 'amount', label: 'Total Amount', length: 'medium' } } },
          { insert: '\nPayment terms: ' },
          { insert: 'PAYMENT_TERMS', attributes: { 'enhanced-response': { id: 'payment-terms', label: 'Payment Terms', lines: 2 } } },
          { insert: '\n\n' },

          { insert: '3. TERM\n', attributes: { header: 2 } },
          { insert: 'This Agreement shall commence on ' },
          { insert: 'START_DATE', attributes: { 'enhanced-date': { id: 'start-date', label: 'Start Date' } } },
          { insert: ' and continue until ' },
          { insert: 'END_DATE', attributes: { 'enhanced-date': { id: 'end-date', label: 'End Date' } } },
          { insert: '.\n\n' },

          { insert: 'CLIENT SIGNATURE:\n' },
          { insert: 'CLIENT_SIGNATURE', attributes: { 'enhanced-signature': { id: 'client-sig', label: 'Client Signature' } } },
          { insert: '\n\n' },
          { insert: 'SERVICE PROVIDER SIGNATURE:\n' },
          { insert: 'PROVIDER_SIGNATURE', attributes: { 'enhanced-signature': { id: 'provider-sig', label: 'Provider Signature' } } },
          { insert: '\n' }
        ]
      },
      placeholders: ['contract-date', 'client-name', 'client-address', 'provider-name', 'provider-address', 'services', 'amount', 'payment-terms', 'start-date', 'end-date', 'client-sig', 'provider-sig'],
      metadata: {
        author: 'CA-DMS System',
        version: '1.0',
        created: '2024-01-15',
        tags: ['legal', 'contract', 'service', 'agreement'],
        difficulty: 'advanced',
        estimatedTime: '45 minutes'
      },
      popularity: 88
    },

    // HR Templates
    {
      id: 'employee-evaluation',
      name: 'Employee Performance Review',
      description: 'Comprehensive employee performance evaluation template',
      category: 'hr',
      icon: '👥',
      preview: 'Structured performance review with rating sections',
      content: {
        ops: [
          { insert: 'EMPLOYEE PERFORMANCE REVIEW\n', attributes: { header: 1, align: 'center' } },
          { insert: '\n' },
          { insert: 'Employee Name: ' },
          { insert: 'EMPLOYEE_NAME', attributes: { 'enhanced-line': { id: 'emp-name', label: 'Employee Name', length: 'long' } } },
          { insert: '\nPosition: ' },
          { insert: 'POSITION', attributes: { 'enhanced-line': { id: 'position', label: 'Position', length: 'medium' } } },
          { insert: '\nDepartment: ' },
          { insert: 'DEPARTMENT', attributes: { 'enhanced-line': { id: 'department', label: 'Department', length: 'medium' } } },
          { insert: '\nReview Period: ' },
          { insert: 'REVIEW_PERIOD', attributes: { 'enhanced-line': { id: 'period', label: 'Review Period', length: 'long' } } },
          { insert: '\nReview Date: ' },
          { insert: 'REVIEW_DATE', attributes: { 'enhanced-date': { id: 'review-date', label: 'Review Date' } } },
          { insert: '\n\n' },

          { insert: 'PERFORMANCE AREAS\n', attributes: { header: 2 } },

          { insert: '1. Job Knowledge & Skills\n', attributes: { bold: true } },
          { insert: 'Rating: ' },
          { insert: 'KNOWLEDGE_RATING', attributes: { 'enhanced-select': { id: 'knowledge-rating', label: 'Knowledge Rating', options: ['Excellent', 'Good', 'Satisfactory', 'Needs Improvement'] } } },
          { insert: '\nComments: ' },
          { insert: 'KNOWLEDGE_COMMENTS', attributes: { 'enhanced-response': { id: 'knowledge-comments', label: 'Knowledge Comments', lines: 3 } } },
          { insert: '\n\n' },

          { insert: '2. Quality of Work\n', attributes: { bold: true } },
          { insert: 'Rating: ' },
          { insert: 'QUALITY_RATING', attributes: { 'enhanced-select': { id: 'quality-rating', label: 'Quality Rating', options: ['Excellent', 'Good', 'Satisfactory', 'Needs Improvement'] } } },
          { insert: '\nComments: ' },
          { insert: 'QUALITY_COMMENTS', attributes: { 'enhanced-response': { id: 'quality-comments', label: 'Quality Comments', lines: 3 } } },
          { insert: '\n\n' },

          { insert: '3. Communication\n', attributes: { bold: true } },
          { insert: 'Rating: ' },
          { insert: 'COMMUNICATION_RATING', attributes: { 'enhanced-select': { id: 'comm-rating', label: 'Communication Rating', options: ['Excellent', 'Good', 'Satisfactory', 'Needs Improvement'] } } },
          { insert: '\nComments: ' },
          { insert: 'COMMUNICATION_COMMENTS', attributes: { 'enhanced-response': { id: 'comm-comments', label: 'Communication Comments', lines: 3 } } },
          { insert: '\n\n' },

          { insert: 'GOALS FOR NEXT PERIOD\n', attributes: { header: 2 } },
          { insert: 'GOALS', attributes: { 'enhanced-response': { id: 'goals', label: 'Goals for Next Period', lines: 5 } } },
          { insert: '\n\n' },

          { insert: 'OVERALL RATING: ' },
          { insert: 'OVERALL_RATING', attributes: { 'enhanced-select': { id: 'overall-rating', label: 'Overall Rating', options: ['Excellent', 'Good', 'Satisfactory', 'Needs Improvement'] } } },
          { insert: '\n\n' },

          { insert: 'EMPLOYEE SIGNATURE:\n' },
          { insert: 'EMPLOYEE_SIGNATURE', attributes: { 'enhanced-signature': { id: 'emp-sig', label: 'Employee Signature' } } },
          { insert: '\n\n' },
          { insert: 'SUPERVISOR SIGNATURE:\n' },
          { insert: 'SUPERVISOR_SIGNATURE', attributes: { 'enhanced-signature': { id: 'supervisor-sig', label: 'Supervisor Signature' } } },
          { insert: '\n' }
        ]
      },
      placeholders: ['emp-name', 'position', 'department', 'period', 'review-date', 'knowledge-rating', 'knowledge-comments', 'quality-rating', 'quality-comments', 'comm-rating', 'comm-comments', 'goals', 'overall-rating', 'emp-sig', 'supervisor-sig'],
      metadata: {
        author: 'CA-DMS System',
        version: '1.0',
        created: '2024-01-15',
        tags: ['hr', 'performance', 'evaluation', 'review'],
        difficulty: 'intermediate',
        estimatedTime: '25 minutes'
      },
      popularity: 85
    },

    // General Templates
    {
      id: 'memo-template',
      name: 'Business Memorandum',
      description: 'Professional business memo template for internal communications',
      category: 'general',
      icon: '📋',
      preview: 'Standard business memo format',
      content: {
        ops: [
          { insert: 'MEMORANDUM\n', attributes: { header: 1, align: 'center' } },
          { insert: '\n' },
          { insert: 'TO: ' },
          { insert: 'MEMO_TO', attributes: { 'enhanced-line': { id: 'memo-to', label: 'To', length: 'long' } } },
          { insert: '\nFROM: ' },
          { insert: 'MEMO_FROM', attributes: { 'enhanced-line': { id: 'memo-from', label: 'From', length: 'long' } } },
          { insert: '\nDATE: ' },
          { insert: 'MEMO_DATE', attributes: { 'enhanced-date': { id: 'memo-date', label: 'Memo Date' } } },
          { insert: '\nSUBJECT: ' },
          { insert: 'MEMO_SUBJECT', attributes: { 'enhanced-line': { id: 'memo-subject', label: 'Subject', length: 'long' } } },
          { insert: '\n\n' },
          { insert: '---\n\n' },

          { insert: 'PURPOSE\n', attributes: { header: 2 } },
          { insert: 'MEMO_PURPOSE', attributes: { 'enhanced-response': { id: 'purpose', label: 'Purpose', lines: 2 } } },
          { insert: '\n\n' },

          { insert: 'DETAILS\n', attributes: { header: 2 } },
          { insert: 'MEMO_DETAILS', attributes: { 'enhanced-response': { id: 'details', label: 'Details', lines: 6 } } },
          { insert: '\n\n' },

          { insert: 'ACTION REQUIRED\n', attributes: { header: 2 } },
          { insert: 'ACTION_REQUIRED', attributes: { 'enhanced-response': { id: 'action', label: 'Action Required', lines: 3 } } },
          { insert: '\n\n' },

          { insert: 'If you have any questions, please contact me at ' },
          { insert: 'CONTACT_INFO', attributes: { 'enhanced-line': { id: 'contact', label: 'Contact Information', length: 'medium' } } },
          { insert: '.\n\n' },
          { insert: 'SENDER_SIGNATURE', attributes: { 'enhanced-signature': { id: 'sender-sig', label: 'Sender Signature' } } },
          { insert: '\n' }
        ]
      },
      placeholders: ['memo-to', 'memo-from', 'memo-date', 'memo-subject', 'purpose', 'details', 'action', 'contact', 'sender-sig'],
      metadata: {
        author: 'CA-DMS System',
        version: '1.0',
        created: '2024-01-15',
        tags: ['general', 'memo', 'communication', 'business'],
        difficulty: 'beginner',
        estimatedTime: '15 minutes'
      },
      popularity: 90
    }
  ]

  static getAllTemplates(): DocumentTemplate[] {
    return [...this.templates].sort((a, b) => b.popularity - a.popularity)
  }

  static getTemplatesByCategory(category: string): DocumentTemplate[] {
    return this.templates
      .filter(template => template.category === category)
      .sort((a, b) => b.popularity - a.popularity)
  }

  static getTemplateById(id: string): DocumentTemplate | null {
    return this.templates.find(template => template.id === id) || null
  }

  static searchTemplates(query: string): DocumentTemplate[] {
    const lowercaseQuery = query.toLowerCase()
    return this.templates.filter(template =>
      template.name.toLowerCase().includes(lowercaseQuery) ||
      template.description.toLowerCase().includes(lowercaseQuery) ||
      template.metadata.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))
    ).sort((a, b) => b.popularity - a.popularity)
  }

  static getPopularTemplates(limit = 5): DocumentTemplate[] {
    return [...this.templates]
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, limit)
  }

  static getRecentlyUsedTemplates(): DocumentTemplate[] {
    // In a real implementation, this would fetch from localStorage or user preferences
    const recentIds = ['memo-template', 'board-resolution', 'meeting-minutes']
    return recentIds
      .map(id => this.getTemplateById(id))
      .filter(template => template !== null) as DocumentTemplate[]
  }

  static getTemplateCategories(): Array<{id: string, name: string, count: number, icon: string}> {
    const categories = new Map()

    // Count templates by category
    this.templates.forEach(template => {
      const category = template.category
      if (!categories.has(category)) {
        categories.set(category, {
          id: category,
          name: this.getCategoryDisplayName(category),
          count: 0,
          icon: this.getCategoryIcon(category)
        })
      }
      categories.get(category).count++
    })

    return Array.from(categories.values()).sort((a, b) => b.count - a.count)
  }

  private static getCategoryDisplayName(category: string): string {
    const names: Record<string, string> = {
      governance: 'Governance',
      legal: 'Legal Documents',
      hr: 'Human Resources',
      finance: 'Financial',
      general: 'General Business'
    }
    return names[category] || category
  }

  private static getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
      governance: '🏛️',
      legal: '⚖️',
      hr: '👥',
      finance: '💰',
      general: '📄'
    }
    return icons[category] || '📄'
  }

  static addCustomTemplate(template: Omit<DocumentTemplate, 'id' | 'isCustom'>): DocumentTemplate {
    const newTemplate: DocumentTemplate = {
      ...template,
      id: `custom-${Date.now()}`,
      isCustom: true,
      popularity: 1
    }

    this.templates.push(newTemplate)
    this.saveToStorage()
    return newTemplate
  }

  static updateTemplate(id: string, updates: Partial<DocumentTemplate>): boolean {
    const index = this.templates.findIndex(t => t.id === id)
    if (index === -1) return false

    this.templates[index] = { ...this.templates[index], ...updates }
    this.saveToStorage()
    return true
  }

  static deleteTemplate(id: string): boolean {
    const index = this.templates.findIndex(t => t.id === id)
    if (index === -1) return false

    // Only allow deletion of custom templates
    if (!this.templates[index].isCustom) return false

    this.templates.splice(index, 1)
    this.saveToStorage()
    return true
  }

  static incrementPopularity(id: string): void {
    const template = this.templates.find(t => t.id === id)
    if (template) {
      template.popularity += 1
      this.saveToStorage()
    }
  }

  private static saveToStorage(): void {
    // Save custom templates to localStorage
    const customTemplates = this.templates.filter(t => t.isCustom)
    localStorage.setItem('customDocumentTemplates', JSON.stringify(customTemplates))
  }

  static loadFromStorage(): void {
    // Load custom templates from localStorage
    try {
      const stored = localStorage.getItem('customDocumentTemplates')
      if (stored) {
        const customTemplates = JSON.parse(stored) as DocumentTemplate[]
        // Remove existing custom templates and add loaded ones
        this.templates = this.templates.filter(t => !t.isCustom)
        this.templates.push(...customTemplates)
      }
    } catch (error) {
      console.warn('Failed to load custom document templates from storage:', error)
    }
  }

  static exportTemplates(): string {
    const customTemplates = this.templates.filter(t => t.isCustom)
    return JSON.stringify({
      version: '1.0',
      exported: new Date().toISOString(),
      templates: customTemplates
    }, null, 2)
  }

  static importTemplates(jsonData: string): { success: boolean; imported: number; errors: string[] } {
    const result = { success: false, imported: 0, errors: [] as string[] }

    try {
      const data = JSON.parse(jsonData)

      if (!data.templates || !Array.isArray(data.templates)) {
        result.errors.push('Invalid template format')
        return result
      }

      let imported = 0
      data.templates.forEach((template: any, index: number) => {
        try {
          // Validate template structure
          if (!template.name || !template.content || !template.category) {
            result.errors.push(`Template ${index + 1}: Missing required fields`)
            return
          }

          // Create new template with unique ID
          const newTemplate = this.addCustomTemplate({
            name: template.name,
            description: template.description || '',
            category: template.category,
            icon: template.icon || '📄',
            preview: template.preview || '',
            content: template.content,
            placeholders: template.placeholders || [],
            metadata: template.metadata || {
              author: 'Imported',
              version: '1.0',
              created: new Date().toISOString(),
              tags: [],
              difficulty: 'beginner',
              estimatedTime: '15 minutes'
            },
            popularity: 1
          })

          imported++
        } catch (error) {
          result.errors.push(`Template ${index + 1}: ${error}`)
        }
      })

      result.success = imported > 0
      result.imported = imported

      return result
    } catch (error) {
      result.errors.push(`Parse error: ${error}`)
      return result
    }
  }
}

// Initialize templates from storage when module loads
DocumentTemplateManager.loadFromStorage()