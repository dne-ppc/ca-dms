import Quill from 'quill'
import './LineSegmentBlot.css'

const Inline = Quill.import('blots/inline')

export interface LineSegmentData {
  length?: 'short' | 'medium' | 'long'
}

export interface LineSegmentConfig {
  label: string
  pixels: number
  inches: number
}

export interface LineSegmentOption {
  value: 'short' | 'medium' | 'long'
  label: string
  pixels: number
}

export interface PDFFieldMetadata {
  fieldId: string
  fieldType: 'text'
  fieldSubtype: 'single-line'
  width: number
  height: number
  required: boolean
  maxLength: number | null
  placeholder: string
  fontSize: number
}

export interface PDFPositioning {
  placement: 'inline'
  verticalAlign: 'baseline'
  marginLeft: number
  marginRight: number
  preserveAspectRatio: boolean
  allowBreaking: boolean
}

export interface PDFValidationOptions {
  required: boolean
  format: 'text'
  maxLength: number | null
  pattern: string | null
  customValidation: boolean
}

export interface PDFDimensions {
  width: number
  height: number
}

export interface PDFFieldCustomOptions {
  required?: boolean
  placeholder?: string
  maxLength?: number | null
  fontSize?: number
}

export interface PDFFieldData {
  fieldType: string
  width: number
  height: number
  fieldId: string
  length: 'short' | 'medium' | 'long'
  positioning: {
    placement: 'inline'
    verticalAlign: 'baseline'
    marginLeft: number
    marginRight: number
  }
}

export class LineSegmentBlot extends Inline {
  static blotName = 'line-segment'
  static tagName = 'span'
  static className = 'ql-line-segment'

  // DPI constant for pixel calculations (72 DPI standard)
  static readonly DPI = 72

  // Length constants in pixels
  static readonly LENGTH_CONSTANTS = {
    SHORT: 144,   // 2 inches * 72 DPI
    MEDIUM: 288,  // 4 inches * 72 DPI
    LONG: 432     // 6 inches * 72 DPI
  } as const

  // Length configuration metadata
  static readonly LENGTH_CONFIG: Record<'short' | 'medium' | 'long', LineSegmentConfig> = {
    short: {
      label: 'Short (2 inches)',
      pixels: 144,
      inches: 2
    },
    medium: {
      label: 'Medium (4 inches)',
      pixels: 288,
      inches: 4
    },
    long: {
      label: 'Long (6 inches)',
      pixels: 432,
      inches: 6
    }
  } as const

  static create(value: LineSegmentData): HTMLElement {
    const node = super.create() as HTMLElement
    node.classList.add(this.className)
    
    // Default to medium if no length specified
    const length = value?.length || 'medium'
    node.classList.add(`length-${length}`)
    
    // Set the width based on length (72px = 1 inch at 72 DPI)
    const pixelWidth = this.getPixelWidth(length)
    node.style.width = `${pixelWidth}px`
    
    // Add styling for proper text flow and line appearance
    node.style.borderBottom = '1px solid #000'
    node.style.display = 'inline-block'
    node.style.minHeight = '1em'
    node.style.verticalAlign = 'baseline'
    
    // Add PDF field attributes for form generation
    const fieldId = this.generateFieldId()
    node.setAttribute('data-field-type', 'single-line-text')
    node.setAttribute('data-field-width', pixelWidth.toString())
    node.setAttribute('data-field-height', this.PDF_FIELD_HEIGHT.toString())
    node.setAttribute('data-field-id', fieldId)
    
    // Add a non-breaking space for content
    node.innerHTML = '&nbsp;'
    
    return node
  }

  static value(node: HTMLElement): LineSegmentData {
    // Extract length from class names
    let length: LineSegmentData['length'] = 'medium'
    
    if (node.classList.contains('length-short')) {
      length = 'short'
    } else if (node.classList.contains('length-long')) {
      length = 'long'
    } else if (node.classList.contains('length-medium')) {
      length = 'medium'
    }
    
    return { length }
  }

  static getPixelWidth(length: LineSegmentData['length']): number {
    switch (length) {
      case 'short': return this.LENGTH_CONFIG.short.pixels
      case 'medium': return this.LENGTH_CONFIG.medium.pixels
      case 'long': return this.LENGTH_CONFIG.long.pixels
      default: return this.LENGTH_CONFIG.medium.pixels
    }
  }

  /**
   * Get available length options for UI selection
   */
  static getAvailableLengths(): LineSegmentOption[] {
    return [
      { value: 'short', label: this.LENGTH_CONFIG.short.label, pixels: this.LENGTH_CONFIG.short.pixels },
      { value: 'medium', label: this.LENGTH_CONFIG.medium.label, pixels: this.LENGTH_CONFIG.medium.pixels },
      { value: 'long', label: this.LENGTH_CONFIG.long.label, pixels: this.LENGTH_CONFIG.long.pixels }
    ]
  }

  /**
   * Validate if a length configuration is valid
   */
  static isValidLength(length: any): length is 'short' | 'medium' | 'long' {
    return length === 'short' || length === 'medium' || length === 'long'
  }

  /**
   * Convert inches to pixels using DPI
   */
  static inchesToPixels(inches: number): number {
    return Math.round(inches * this.DPI)
  }

  /**
   * Convert pixels to inches using DPI
   */
  static pixelsToInches(pixels: number): number {
    return Math.round((pixels / this.DPI) * 100) / 100 // Round to 2 decimal places
  }

  /**
   * Get length type from pixel width (with fallback to medium)
   */
  static getLengthFromPixels(pixels: number): 'short' | 'medium' | 'long' {
    if (pixels === this.LENGTH_CONFIG.short.pixels) return 'short'
    if (pixels === this.LENGTH_CONFIG.long.pixels) return 'long'
    return 'medium' // Default fallback
  }

  // Responsive behavior constants and utilities
  static readonly MIN_SEGMENT_WIDTH = 60 // Minimum readable width in pixels
  
  static readonly BREAKPOINTS = {
    desktop: 1024,
    tablet: 768,
    mobile: 480
  } as const

  static readonly VIEWPORT_CONSTRAINTS = {
    desktop: 0.9,  // 90% of viewport width max
    tablet: 0.85,  // 85% of viewport width max
    mobile: 0.8    // 80% of viewport width max
  } as const

  // PDF field constants
  static readonly PDF_FIELD_HEIGHT = 20 // Standard single-line height in points
  static readonly PDF_DEFAULT_FONT_SIZE = 12
  static readonly PDF_FIELD_MARGIN = 2

  /**
   * Get responsive breakpoint category for given width
   */
  static getBreakpoint(width: number): 'desktop' | 'tablet' | 'mobile' {
    if (width >= this.BREAKPOINTS.desktop) return 'desktop'
    if (width >= this.BREAKPOINTS.tablet) return 'tablet'
    return 'mobile'
  }

  /**
   * Get maximum width constraint for viewport
   */
  static getMaxWidthForViewport(viewportWidth: number): number {
    const breakpoint = this.getBreakpoint(viewportWidth)
    return Math.round(viewportWidth * this.VIEWPORT_CONSTRAINTS[breakpoint])
  }

  /**
   * Get responsive multiplier for viewport width
   */
  static getResponsiveMultiplier(viewportWidth: number): number {
    const breakpoint = this.getBreakpoint(viewportWidth)
    
    if (breakpoint === 'desktop') return 1.0
    if (breakpoint === 'tablet') return 1.0
    
    // Mobile: scale down based on how small the viewport is
    const mobileRatio = Math.min(viewportWidth / this.BREAKPOINTS.mobile, 1.0)
    return Math.max(0.6, mobileRatio) // Never go below 60% of original size
  }

  /**
   * Get responsive width for line segment
   */
  static getResponsiveWidth(length: 'short' | 'medium' | 'long', viewportWidth: number): number {
    const originalWidth = this.LENGTH_CONFIG[length].pixels
    const maxWidth = this.getMaxWidthForViewport(viewportWidth)
    
    // If original width fits within constraint, use it
    if (originalWidth <= maxWidth) {
      return originalWidth
    }
    
    // Otherwise, scale down but respect minimum width
    const scaledWidth = Math.round(originalWidth * this.getResponsiveMultiplier(viewportWidth))
    return Math.max(this.MIN_SEGMENT_WIDTH, Math.min(scaledWidth, maxWidth))
  }

  /**
   * Get width for specific container constraints
   */
  static getWidthForContainer(length: 'short' | 'medium' | 'long', containerWidth: number): number {
    const originalWidth = this.LENGTH_CONFIG[length].pixels
    const breakpoint = this.getBreakpoint(containerWidth)
    const maxContainerWidth = Math.round(containerWidth * this.VIEWPORT_CONSTRAINTS[breakpoint])
    
    // If it fits, use original width
    if (originalWidth <= maxContainerWidth) {
      return originalWidth
    }
    
    // Scale down but maintain minimum width
    return Math.max(this.MIN_SEGMENT_WIDTH, maxContainerWidth)
  }

  /**
   * Check if line segments support text wrapping
   */
  static supportsTextWrapping(): boolean {
    return true // Inline-block elements support text wrapping
  }

  // PDF Field Integration Methods
  
  /**
   * Generate unique field ID for PDF form fields
   */
  static generateFieldId(): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substr(2, 9)
    return `line-segment-${timestamp}-${random}`
  }

  /**
   * Generate PDF field metadata for line segments
   */
  static generatePDFFieldMetadata(
    data: LineSegmentData, 
    fieldId: string,
    customOptions?: PDFFieldCustomOptions
  ): PDFFieldMetadata {
    const length = data.length || 'medium'
    const width = this.LENGTH_CONFIG[length].pixels
    
    return {
      fieldId,
      fieldType: 'text',
      fieldSubtype: 'single-line',
      width,
      height: this.PDF_FIELD_HEIGHT,
      required: customOptions?.required || false,
      maxLength: customOptions?.maxLength || null,
      placeholder: customOptions?.placeholder || '',
      fontSize: customOptions?.fontSize || this.PDF_DEFAULT_FONT_SIZE
    }
  }

  /**
   * Get PDF positioning data for inline placement
   */
  static getPDFPositioning(data: LineSegmentData): PDFPositioning {
    return {
      placement: 'inline',
      verticalAlign: 'baseline',
      marginLeft: this.PDF_FIELD_MARGIN,
      marginRight: this.PDF_FIELD_MARGIN,
      preserveAspectRatio: true,
      allowBreaking: false // Don't break line segments across pages
    }
  }

  /**
   * Get PDF form field validation options
   */
  static getPDFValidationOptions(): PDFValidationOptions {
    return {
      required: false,
      format: 'text',
      maxLength: null,
      pattern: null,
      customValidation: false
    }
  }

  /**
   * Calculate PDF field dimensions
   */
  static getPDFDimensions(length: 'short' | 'medium' | 'long'): PDFDimensions {
    return {
      width: this.LENGTH_CONFIG[length].pixels,
      height: this.PDF_FIELD_HEIGHT
    }
  }

  /**
   * Extract PDF field data from DOM element
   */
  static extractPDFFieldData(element: HTMLElement): PDFFieldData {
    const lengthClass = element.classList.contains('length-short') ? 'short' :
                       element.classList.contains('length-long') ? 'long' : 'medium'
    
    return {
      fieldType: element.getAttribute('data-field-type') || 'single-line-text',
      width: parseInt(element.getAttribute('data-field-width') || '288'),
      height: parseInt(element.getAttribute('data-field-height') || '20'),
      fieldId: element.getAttribute('data-field-id') || '',
      length: lengthClass,
      positioning: {
        placement: 'inline',
        verticalAlign: 'baseline',
        marginLeft: this.PDF_FIELD_MARGIN,
        marginRight: this.PDF_FIELD_MARGIN
      }
    }
  }

  // Override methods for proper Quill integration
  static allowedChildren = []
  
  constructor(scroll: unknown, domNode: HTMLElement) {
    super(scroll, domNode)
  }

  // Override length to report correct length for Quill operations
  length(): number {
    return 1
  }

  // Ensure proper Delta representation
  delta(): unknown {
    const Delta = Quill.import('delta')
    return new Delta().insert({ [LineSegmentBlot.blotName]: this.value() })
  }

  value(): LineSegmentData {
    return LineSegmentBlot.value(this.domNode as HTMLElement)
  }
}