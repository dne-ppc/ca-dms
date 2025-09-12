import { PlaceholderConfig } from './blots/DraggablePlaceholderBlot';
import { SignatureConfig } from './blots/EnhancedSignatureBlot';

export interface PlaceholderTemplate {
  id: string;
  name: string;
  description: string;
  category: 'signature' | 'response' | 'line' | 'table' | 'custom';
  icon: string;
  preview: string;
  config: Partial<PlaceholderConfig>;
  tags: string[];
  popularity: number;
}

export class PlaceholderTemplateManager {
  private static templates: PlaceholderTemplate[] = [
    // Signature Templates
    {
      id: 'signature-standard',
      name: 'Standard Signature',
      description: 'Basic signature field with name, date, and title',
      category: 'signature',
      icon: '✍️',
      preview: 'Name, Date, Title signature layout',
      config: {
        type: 'enhanced-signature',
        label: 'Signature',
        isDraggable: true,
        isResizable: false,
        validation: {
          required: true,
          errorMessage: 'Signature is required'
        }
      } as Partial<SignatureConfig>,
      tags: ['signature', 'basic', 'standard'],
      popularity: 95
    },
    {
      id: 'signature-executive',
      name: 'Executive Signature',
      description: 'Premium signature with enhanced styling for executive documents',
      category: 'signature',
      icon: '🏢',
      preview: 'Formal executive signature with box styling',
      config: {
        type: 'enhanced-signature',
        label: 'Executive Signature',
        preset: 'executive',
        isDraggable: true,
        isResizable: true,
        customStyles: {
          border: '2px solid #1f2937',
          padding: '20px',
          background: '#f9fafb',
          borderRadius: '8px'
        },
        validation: {
          required: true,
          errorMessage: 'Executive signature required'
        }
      } as Partial<SignatureConfig>,
      tags: ['signature', 'executive', 'formal', 'premium'],
      popularity: 75
    },
    {
      id: 'signature-witness',
      name: 'Witness Signature',
      description: 'Simple witness signature without title field',
      category: 'signature',
      icon: '👁️',
      preview: 'Name and date only for witnesses',
      config: {
        type: 'enhanced-signature',
        label: 'Witness',
        preset: 'witness',
        isDraggable: true,
        isResizable: false,
        validation: {
          required: false
        }
      } as Partial<SignatureConfig>,
      tags: ['signature', 'witness', 'simple'],
      popularity: 60
    },
    {
      id: 'signature-digital',
      name: 'Digital Signature',
      description: 'Canvas-based signature for digital signing',
      category: 'signature',
      icon: '📱',
      preview: 'Digital signature pad with drawing capability',
      config: {
        type: 'enhanced-signature',
        label: 'Digital Signature',
        signatureStyle: 'box',
        isDraggable: true,
        isResizable: true,
        validation: {
          required: true,
          errorMessage: 'Digital signature required'
        }
      } as Partial<SignatureConfig>,
      tags: ['signature', 'digital', 'canvas', 'modern'],
      popularity: 85
    },
    {
      id: 'signature-image',
      name: 'Image Signature',
      description: 'Upload signature as image file',
      category: 'signature',
      icon: '🖼️',
      preview: 'Upload signature image from file',
      config: {
        type: 'enhanced-signature',
        label: 'Signature Image',
        signatureStyle: 'image',
        isDraggable: true,
        isResizable: false,
        validation: {
          required: true,
          errorMessage: 'Signature image required'
        }
      } as Partial<SignatureConfig>,
      tags: ['signature', 'image', 'upload'],
      popularity: 70
    },
    
    // Response Field Templates
    {
      id: 'response-short',
      name: 'Short Response',
      description: 'Single line response field',
      category: 'response',
      icon: '📝',
      preview: 'Brief answer field',
      config: {
        type: 'enhanced-response',
        label: 'Response',
        lines: 1,
        isDraggable: true,
        isResizable: true,
        validation: {
          required: false,
          maxLength: 100
        }
      },
      tags: ['response', 'short', 'single-line'],
      popularity: 90
    },
    {
      id: 'response-paragraph',
      name: 'Paragraph Response',
      description: 'Multi-line response area for detailed answers',
      category: 'response',
      icon: '📄',
      preview: 'Multiple line response area',
      config: {
        type: 'enhanced-response',
        label: 'Detailed Response',
        lines: 5,
        isDraggable: true,
        isResizable: true,
        validation: {
          required: false,
          minLength: 10,
          maxLength: 1000
        }
      },
      tags: ['response', 'paragraph', 'multi-line', 'detailed'],
      popularity: 85
    },
    {
      id: 'response-essay',
      name: 'Essay Response',
      description: 'Large text area for comprehensive responses',
      category: 'response',
      icon: '📖',
      preview: 'Extended writing area',
      config: {
        type: 'enhanced-response',
        label: 'Essay Response',
        lines: 10,
        isDraggable: true,
        isResizable: true,
        validation: {
          required: false,
          minLength: 50,
          maxLength: 5000
        }
      },
      tags: ['response', 'essay', 'long', 'comprehensive'],
      popularity: 65
    },
    
    // Line Segment Templates
    {
      id: 'line-short',
      name: 'Short Line',
      description: 'Short fill-in-the-blank line',
      category: 'line',
      icon: '➖',
      preview: 'Brief fill-in line',
      config: {
        type: 'enhanced-line',
        label: '',
        length: 'short',
        isDraggable: true,
        isResizable: true,
        validation: {
          required: false,
          maxLength: 20
        }
      },
      tags: ['line', 'short', 'fill-in'],
      popularity: 80
    },
    {
      id: 'line-medium',
      name: 'Medium Line',
      description: 'Medium length fill-in line',
      category: 'line',
      icon: '➖➖',
      preview: 'Standard fill-in line',
      config: {
        type: 'enhanced-line',
        label: '',
        length: 'medium',
        isDraggable: true,
        isResizable: true,
        validation: {
          required: false,
          maxLength: 50
        }
      },
      tags: ['line', 'medium', 'fill-in'],
      popularity: 75
    },
    {
      id: 'line-long',
      name: 'Long Line',
      description: 'Extended fill-in-the-blank line',
      category: 'line',
      icon: '➖➖➖',
      preview: 'Extended fill-in line',
      config: {
        type: 'enhanced-line',
        label: '',
        length: 'long',
        isDraggable: true,
        isResizable: true,
        validation: {
          required: false,
          maxLength: 100
        }
      },
      tags: ['line', 'long', 'fill-in'],
      popularity: 70
    },
    
    // Custom Templates
    {
      id: 'date-picker',
      name: 'Date Field',
      description: 'Standardized date input field',
      category: 'custom',
      icon: '📅',
      preview: 'Date selection field',
      config: {
        type: 'enhanced-date',
        label: 'Date',
        isDraggable: true,
        isResizable: false,
        validation: {
          required: false,
          pattern: '^\\d{4}-\\d{2}-\\d{2}$',
          errorMessage: 'Please enter a valid date'
        }
      },
      tags: ['date', 'input', 'calendar'],
      popularity: 85
    },
    {
      id: 'checkbox-group',
      name: 'Checkbox Group',
      description: 'Multiple selection checkbox group',
      category: 'custom',
      icon: '☑️',
      preview: 'Multiple checkbox options',
      config: {
        type: 'enhanced-checkbox',
        label: 'Select Options',
        isDraggable: true,
        isResizable: true,
        options: ['Option 1', 'Option 2', 'Option 3'],
        validation: {
          required: false
        }
      },
      tags: ['checkbox', 'multiple', 'selection'],
      popularity: 75
    },
    {
      id: 'dropdown-select',
      name: 'Dropdown Selection',
      description: 'Single choice dropdown menu',
      category: 'custom',
      icon: '🔽',
      preview: 'Dropdown selection menu',
      config: {
        type: 'enhanced-select',
        label: 'Select Option',
        isDraggable: true,
        isResizable: false,
        options: ['Choose...', 'Option 1', 'Option 2', 'Option 3'],
        validation: {
          required: false,
          errorMessage: 'Please make a selection'
        }
      },
      tags: ['dropdown', 'select', 'choice'],
      popularity: 80
    }
  ];

  static getAllTemplates(): PlaceholderTemplate[] {
    return [...this.templates].sort((a, b) => b.popularity - a.popularity);
  }

  static getTemplatesByCategory(category: string): PlaceholderTemplate[] {
    return this.templates
      .filter(template => template.category === category)
      .sort((a, b) => b.popularity - a.popularity);
  }

  static getTemplateById(id: string): PlaceholderTemplate | null {
    return this.templates.find(template => template.id === id) || null;
  }

  static searchTemplates(query: string): PlaceholderTemplate[] {
    const lowercaseQuery = query.toLowerCase();
    return this.templates.filter(template => 
      template.name.toLowerCase().includes(lowercaseQuery) ||
      template.description.toLowerCase().includes(lowercaseQuery) ||
      template.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))
    ).sort((a, b) => b.popularity - a.popularity);
  }

  static getPopularTemplates(limit = 6): PlaceholderTemplate[] {
    return [...this.templates]
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, limit);
  }

  static getRecentlyUsedTemplates(): PlaceholderTemplate[] {
    // In a real implementation, this would fetch from localStorage or user preferences
    const recentIds = ['signature-standard', 'response-short', 'line-medium'];
    return recentIds
      .map(id => this.getTemplateById(id))
      .filter(template => template !== null) as PlaceholderTemplate[];
  }

  static addCustomTemplate(template: Omit<PlaceholderTemplate, 'id'>): PlaceholderTemplate {
    const newTemplate: PlaceholderTemplate = {
      ...template,
      id: `custom-${Date.now()}`,
      category: 'custom',
      popularity: 1
    };
    
    this.templates.push(newTemplate);
    this.saveToStorage();
    return newTemplate;
  }

  static updateTemplate(id: string, updates: Partial<PlaceholderTemplate>): boolean {
    const index = this.templates.findIndex(t => t.id === id);
    if (index === -1) return false;

    this.templates[index] = { ...this.templates[index], ...updates };
    this.saveToStorage();
    return true;
  }

  static deleteTemplate(id: string): boolean {
    const index = this.templates.findIndex(t => t.id === id);
    if (index === -1) return false;

    // Only allow deletion of custom templates
    if (!id.startsWith('custom-')) return false;

    this.templates.splice(index, 1);
    this.saveToStorage();
    return true;
  }

  static incrementPopularity(id: string): void {
    const template = this.templates.find(t => t.id === id);
    if (template) {
      template.popularity += 1;
      this.saveToStorage();
    }
  }

  static getTemplateCategories(): Array<{id: string, name: string, count: number, icon: string}> {
    const categories = new Map();
    
    // Count templates by category
    this.templates.forEach(template => {
      const category = template.category;
      if (!categories.has(category)) {
        categories.set(category, {
          id: category,
          name: this.getCategoryDisplayName(category),
          count: 0,
          icon: this.getCategoryIcon(category)
        });
      }
      categories.get(category).count++;
    });

    return Array.from(categories.values()).sort((a, b) => b.count - a.count);
  }

  private static getCategoryDisplayName(category: string): string {
    const names: Record<string, string> = {
      signature: 'Signatures',
      response: 'Response Fields',
      line: 'Fill-in Lines',
      table: 'Tables',
      custom: 'Custom Fields'
    };
    return names[category] || category;
  }

  private static getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
      signature: '✍️',
      response: '📝',
      line: '➖',
      table: '📊',
      custom: '⚙️'
    };
    return icons[category] || '📄';
  }

  private static saveToStorage(): void {
    // Save custom templates to localStorage
    const customTemplates = this.templates.filter(t => t.id.startsWith('custom-'));
    localStorage.setItem('customPlaceholderTemplates', JSON.stringify(customTemplates));
  }

  static loadFromStorage(): void {
    // Load custom templates from localStorage
    try {
      const stored = localStorage.getItem('customPlaceholderTemplates');
      if (stored) {
        const customTemplates = JSON.parse(stored) as PlaceholderTemplate[];
        // Remove existing custom templates and add loaded ones
        this.templates = this.templates.filter(t => !t.id.startsWith('custom-'));
        this.templates.push(...customTemplates);
      }
    } catch (error) {
      console.warn('Failed to load custom templates from storage:', error);
    }
  }

  static exportTemplates(): string {
    const customTemplates = this.templates.filter(t => t.id.startsWith('custom-'));
    return JSON.stringify({
      version: '1.0',
      exported: new Date().toISOString(),
      templates: customTemplates
    }, null, 2);
  }

  static importTemplates(jsonData: string): { success: boolean; imported: number; errors: string[] } {
    const result = { success: false, imported: 0, errors: [] as string[] };
    
    try {
      const data = JSON.parse(jsonData);
      
      if (!data.templates || !Array.isArray(data.templates)) {
        result.errors.push('Invalid template format');
        return result;
      }

      let imported = 0;
      data.templates.forEach((template: any, index: number) => {
        try {
          // Validate template structure
          if (!template.name || !template.config || !template.category) {
            result.errors.push(`Template ${index + 1}: Missing required fields`);
            return;
          }

          // Create new template with unique ID
          const newTemplate = this.addCustomTemplate({
            name: template.name,
            description: template.description || '',
            category: template.category,
            icon: template.icon || '📄',
            preview: template.preview || '',
            config: template.config,
            tags: template.tags || [],
            popularity: 1
          });

          imported++;
        } catch (error) {
          result.errors.push(`Template ${index + 1}: ${error}`);
        }
      });

      result.success = imported > 0;
      result.imported = imported;
      
      return result;
    } catch (error) {
      result.errors.push(`Parse error: ${error}`);
      return result;
    }
  }
}

// Initialize templates from storage when module loads
PlaceholderTemplateManager.loadFromStorage();