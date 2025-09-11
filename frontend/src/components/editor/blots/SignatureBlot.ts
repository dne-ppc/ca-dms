import Quill from 'quill'
import './SignatureBlot.css'

const Block = Quill.import('blots/block')

export interface SignatureData {
  name: string
  date: string
  title: string
}

export class SignatureBlot extends Block {
  static blotName = 'signature-field'
  static tagName = 'div'
  static className = 'ql-signature-field'

  static create(value: SignatureData): HTMLElement {
    const node = super.create() as HTMLElement
    node.classList.add(this.className)
    
    // Create the signature field structure
    const container = document.createElement('div')
    container.className = 'signature-container'
    
    // Signature line
    const signatureLine = document.createElement('div')
    signatureLine.className = 'signature-line'
    signatureLine.innerHTML = '&nbsp;'
    container.appendChild(signatureLine)
    
    // Signature label
    const signatureLabel = document.createElement('div')
    signatureLabel.className = 'signature-label'
    signatureLabel.textContent = 'Signature:'
    container.appendChild(signatureLabel)
    
    // Name field
    const nameField = document.createElement('div')
    nameField.className = 'signature-field'
    const nameLabel = document.createElement('label')
    nameLabel.textContent = 'Name:'
    const nameInput = document.createElement('input')
    nameInput.type = 'text'
    nameInput.setAttribute('data-field', 'name')
    nameInput.value = value?.name || ''
    nameInput.placeholder = 'Enter full name'
    nameField.appendChild(nameLabel)
    nameField.appendChild(nameInput)
    container.appendChild(nameField)
    
    // Date field
    const dateField = document.createElement('div')
    dateField.className = 'signature-field'
    const dateLabel = document.createElement('label')
    dateLabel.textContent = 'Date:'
    const dateInput = document.createElement('input')
    dateInput.type = 'date'
    dateInput.setAttribute('data-field', 'date')
    dateInput.value = value?.date || ''
    dateField.appendChild(dateLabel)
    dateField.appendChild(dateInput)
    container.appendChild(dateField)
    
    // Title field
    const titleField = document.createElement('div')
    titleField.className = 'signature-field'
    const titleLabel = document.createElement('label')
    titleLabel.textContent = 'Title:'
    const titleInput = document.createElement('input')
    titleInput.type = 'text'
    titleInput.setAttribute('data-field', 'title')
    titleInput.value = value?.title || ''
    titleInput.placeholder = 'Enter title/position'
    titleField.appendChild(titleLabel)
    titleField.appendChild(titleInput)
    container.appendChild(titleField)
    
    node.appendChild(container)
    
    // Add event listeners to inputs to update the blot value
    const inputs = node.querySelectorAll('input')
    inputs.forEach(input => {
      input.addEventListener('input', () => {
        // Trigger change event to notify Quill of content changes
        const changeEvent = new Event('input', { bubbles: true })
        node.dispatchEvent(changeEvent)
      })
    })
    
    return node
  }

  static value(node: HTMLElement): SignatureData {
    const nameInput = node.querySelector('input[data-field="name"]') as HTMLInputElement
    const dateInput = node.querySelector('input[data-field="date"]') as HTMLInputElement
    const titleInput = node.querySelector('input[data-field="title"]') as HTMLInputElement
    
    return {
      name: nameInput?.value || '',
      date: dateInput?.value || '',
      title: titleInput?.value || ''
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
    return new Delta().insert({ [SignatureBlot.blotName]: this.value() })
  }

  value(): SignatureData {
    return SignatureBlot.value(this.domNode as HTMLElement)
  }
}