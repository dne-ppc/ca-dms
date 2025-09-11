import Quill from 'quill'
import './VersionTableBlot.css'

const Block = Quill.import('blots/block')

export interface VersionTableData {
  version: string
  date: string
  description: string
  author: string
}

export class VersionTableBlot extends Block {
  static blotName = 'version-table'
  static tagName = 'div'
  static className = 'ql-version-table'

  private isImmutable = true

  static create(value: VersionTableData[]): HTMLElement {
    const node = super.create() as HTMLElement
    node.classList.add(this.className)
    
    // Create the version table structure
    const table = document.createElement('table')
    table.className = 'version-table'
    
    // Create header
    const thead = document.createElement('thead')
    const headerRow = document.createElement('tr')
    
    const headers = ['Version', 'Date', 'Description', 'Author']
    headers.forEach(headerText => {
      const th = document.createElement('th')
      th.textContent = headerText
      headerRow.appendChild(th)
    })
    
    thead.appendChild(headerRow)
    table.appendChild(thead)
    
    // Create body with data
    const tbody = document.createElement('tbody')
    
    const data = value && value.length > 0 ? value : [
      { version: '1.0', date: new Date().toISOString().split('T')[0], description: 'Initial version', author: 'System' }
    ]
    
    data.forEach(row => {
      const tr = document.createElement('tr')
      
      const versionCell = document.createElement('td')
      versionCell.textContent = row.version
      tr.appendChild(versionCell)
      
      const dateCell = document.createElement('td')
      dateCell.textContent = row.date
      tr.appendChild(dateCell)
      
      const descCell = document.createElement('td')
      descCell.textContent = row.description
      tr.appendChild(descCell)
      
      const authorCell = document.createElement('td')
      authorCell.textContent = row.author
      tr.appendChild(authorCell)
      
      tbody.appendChild(tr)
    })
    
    table.appendChild(tbody)
    node.appendChild(table)
    
    // Add immutability marker
    node.setAttribute('contenteditable', 'false')
    node.setAttribute('data-immutable', 'true')
    
    return node
  }

  static value(node: HTMLElement): VersionTableData[] {
    const rows = node.querySelectorAll('tbody tr')
    const data: VersionTableData[] = []
    
    rows.forEach(row => {
      const cells = row.querySelectorAll('td')
      if (cells.length >= 4) {
        data.push({
          version: cells[0].textContent || '',
          date: cells[1].textContent || '',
          description: cells[2].textContent || '',
          author: cells[3].textContent || ''
        })
      }
    })
    
    return data
  }

  // Override methods to prevent deletion and editing
  deleteAt(): void {
    // Prevent deletion of version table
    console.warn('Version table is immutable and cannot be deleted')
    return
  }

  formatAt(index: number, length: number, name: string, value: unknown): void {
    // Prevent formatting changes to version table
    if (name === this.constructor.blotName) {
      return
    }
    super.formatAt(index, length, name, value)
  }

  // Ensure version table can only be at document start
  static allowedChildren = []
  
  constructor(scroll: unknown, domNode: HTMLElement) {
    super(scroll, domNode)
    
    // Make the entire element non-editable
    domNode.setAttribute('contenteditable', 'false')
    domNode.setAttribute('data-immutable', 'true')
  }

  // Override length to report correct length for Quill operations
  length(): number {
    return 1
  }

  // Ensure proper Delta representation
  delta(): unknown {
    const Delta = Quill.import('delta')
    return new Delta().insert({ [VersionTableBlot.blotName]: this.value() })
  }

  value(): VersionTableData[] {
    return VersionTableBlot.value(this.domNode as HTMLElement)
  }
}