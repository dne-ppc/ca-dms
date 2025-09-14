import Quill from 'quill'
import './LongResponseBlot.css'

// Safe import Block to avoid module-level execution issues
let Block: any;
try {
  Block = Quill.import('blots/block');
} catch (error) {
  console.warn('Quill block import failed, using fallback', error);
  Block = class extends HTMLElement {}; // Fallback class
}

export interface LongResponseData {
  label: string
  content: string
  height: 'small' | 'medium' | 'large'
}

export class LongResponseBlot extends Block {
  static blotName = 'long-response'
  static tagName = 'div'
  static className = 'ql-long-response'

  static create(value: LongResponseData): HTMLElement {
    const node = super.create() as HTMLElement
    node.classList.add(this.className)
    
    // Add height class
    const height = value?.height || 'medium'
    node.classList.add(`height-${height}`)
    
    // Create the response container
    const container = document.createElement('div')
    container.className = 'response-container'
    
    // Create label
    const label = document.createElement('label')
    label.className = 'response-label'
    label.textContent = value?.label || ''
    container.appendChild(label)
    
    // Create textarea
    const textarea = document.createElement('textarea')
    textarea.className = 'response-textarea'
    textarea.value = value?.content || ''
    textarea.placeholder = 'Enter your response here...'
    textarea.setAttribute('data-field', 'content')
    
    // Set textarea properties for better UX
    textarea.style.resize = 'vertical'
    textarea.setAttribute('rows', LongResponseBlot.getRowsForHeight(height).toString())
    
    // Auto-resize functionality
    const autoResize = () => {
      textarea.style.height = 'auto'
      textarea.style.height = Math.max(textarea.scrollHeight, 60) + 'px'
    }
    
    textarea.addEventListener('input', () => {
      autoResize()
      // Trigger change event to notify Quill of content changes
      const changeEvent = new Event('input', { bubbles: true })
      node.dispatchEvent(changeEvent)
    })
    
    // Initial resize
    setTimeout(autoResize, 0)
    
    container.appendChild(textarea)
    node.appendChild(container)
    
    return node
  }

  static value(node: HTMLElement): LongResponseData {
    const labelElement = node.querySelector('.response-label')
    const textarea = node.querySelector('.response-textarea') as HTMLTextAreaElement
    
    // Extract height from class
    let height: LongResponseData['height'] = 'medium'
    if (node.classList.contains('height-small')) height = 'small'
    else if (node.classList.contains('height-large')) height = 'large'
    
    return {
      label: labelElement?.textContent || '',
      content: textarea?.value || '',
      height
    }
  }

  static getRowsForHeight(height: LongResponseData['height']): number {
    switch (height) {
      case 'small': return 3
      case 'medium': return 6
      case 'large': return 10
      default: return 6
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
    return new Delta().insert({ [LongResponseBlot.blotName]: this.value() })
  }

  value(): LongResponseData {
    return LongResponseBlot.value(this.domNode as HTMLElement)
  }
}