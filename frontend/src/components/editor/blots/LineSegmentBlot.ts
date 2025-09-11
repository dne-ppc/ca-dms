import Quill from 'quill'
import './LineSegmentBlot.css'

const Inline = Quill.import('blots/inline')

export interface LineSegmentData {
  length?: 'short' | 'medium' | 'long'
}

export class LineSegmentBlot extends Inline {
  static blotName = 'line-segment'
  static tagName = 'span'
  static className = 'ql-line-segment'

  static create(value: LineSegmentData): HTMLElement {
    const node = super.create() as HTMLElement
    node.classList.add(this.className)
    
    // Default to medium if no length specified
    const length = value?.length || 'medium'
    node.classList.add(`length-${length}`)
    
    // Set the width based on length (72px = 1 inch at 72 DPI)
    const pixelWidth = this.getPixelWidth(length)
    node.style.width = `${pixelWidth}px`
    
    // Add bottom border to create the line appearance
    node.style.borderBottom = '1px solid #000'
    node.style.display = 'inline-block'
    node.style.minHeight = '1em'
    
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
      case 'short': return 144  // 2 inches * 72 DPI
      case 'medium': return 288 // 4 inches * 72 DPI  
      case 'long': return 432   // 6 inches * 72 DPI
      default: return 288
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