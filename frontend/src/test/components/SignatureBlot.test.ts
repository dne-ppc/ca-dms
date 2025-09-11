import { describe, it, expect, beforeEach } from 'vitest'
import Quill from 'quill'
import { SignatureBlot, type SignatureData } from '../../components/editor/blots/SignatureBlot'

// Mock DOM environment for testing
const createQuillInstance = () => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  return new Quill(container, { theme: 'snow' })
}

describe('SignatureBlot', () => {
  beforeEach(() => {
    // Register the blot before each test
    Quill.register('formats/signature-field', SignatureBlot)
    createQuillInstance()
  })

  it('should be registered as a custom blot format', () => {
    expect(SignatureBlot.blotName).toBe('signature-field')
    expect(SignatureBlot.tagName).toBe('DIV')
    expect(SignatureBlot.className).toBe('ql-signature-field')
  })

  it('should create signature field with default empty data', () => {
    const defaultData: SignatureData = {
      name: '',
      date: '',
      title: ''
    }
    
    const blot = SignatureBlot.create(defaultData)
    expect(blot).toBeInstanceOf(HTMLElement)
    expect(blot.classList.contains('ql-signature-field')).toBe(true)
    expect(blot.textContent).toContain('Signature:')
    expect(blot.textContent).toContain('Date:')
    expect(blot.textContent).toContain('Title:')
  })

  it('should create signature field with provided data', () => {
    const testData: SignatureData = {
      name: 'John Doe',
      date: '2024-01-15',
      title: 'President'
    }
    
    const blot = SignatureBlot.create(testData)
    const nameInput = blot.querySelector('input[data-field="name"]') as HTMLInputElement
    const dateInput = blot.querySelector('input[data-field="date"]') as HTMLInputElement
    const titleInput = blot.querySelector('input[data-field="title"]') as HTMLInputElement
    
    expect(nameInput?.value).toBe('John Doe')
    expect(dateInput?.value).toBe('2024-01-15')
    expect(titleInput?.value).toBe('President')
  })

  it('should render proper form structure', () => {
    const testData: SignatureData = {
      name: 'Jane Smith',
      date: '2024-02-01',
      title: 'Secretary'
    }
    
    const blot = SignatureBlot.create(testData)
    
    // Check for signature line
    const signatureLine = blot.querySelector('.signature-line')
    expect(signatureLine).toBeTruthy()
    
    // Check for input fields
    const inputs = blot.querySelectorAll('input')
    expect(inputs).toHaveLength(3)
    
    // Check for labels
    const labels = blot.querySelectorAll('label')
    expect(labels).toHaveLength(3)
    
    // Check field structure
    const fieldGroups = blot.querySelectorAll('.signature-field')
    expect(fieldGroups).toHaveLength(3)
  })

  it('should extract correct data from DOM element', () => {
    const testData: SignatureData = {
      name: 'Alice Johnson',
      date: '2024-03-01',
      title: 'Treasurer'
    }
    
    const blot = SignatureBlot.create(testData)
    const extractedData = SignatureBlot.value(blot)
    
    expect(extractedData).toEqual(testData)
  })

  it('should be editable - inputs should not be readonly', () => {
    const testData: SignatureData = {
      name: 'Bob Wilson',
      date: '2024-04-01',
      title: 'Director'
    }
    
    const blot = SignatureBlot.create(testData)
    const inputs = blot.querySelectorAll('input')
    
    inputs.forEach(input => {
      expect(input.getAttribute('readonly')).toBeFalsy()
    })
  })

  it('should have proper styling classes', () => {
    const testData: SignatureData = {
      name: 'Carol Davis',
      date: '2024-05-01', 
      title: 'Board Member'
    }
    
    const blot = SignatureBlot.create(testData)
    
    expect(blot.classList.contains('ql-signature-field')).toBe(true)
    
    const signatureLine = blot.querySelector('.signature-line')
    expect(signatureLine).toBeTruthy()
    
    const fieldGroups = blot.querySelectorAll('.signature-field')
    fieldGroups.forEach(group => {
      expect(group.classList.contains('signature-field')).toBe(true)
    })
  })

  it('should handle empty values gracefully', () => {
    const emptyData: SignatureData = {
      name: '',
      date: '',
      title: ''
    }
    
    const blot = SignatureBlot.create(emptyData)
    const extractedData = SignatureBlot.value(blot)
    
    expect(extractedData).toEqual(emptyData)
  })

  it('should report correct length for Quill operations', () => {
    const testData: SignatureData = {
      name: 'David Miller',
      date: '2024-06-01',
      title: 'Vice President'
    }
    
    const blot = SignatureBlot.create(testData)
    
    // Test the static length method through the DOM node instead
    // since we can't easily mock the Quill scroll registry for constructor
    expect(typeof SignatureBlot.prototype.length).toBe('function')
    
    // Verify the length would be 1 if we could instantiate properly
    const lengthMethod = SignatureBlot.prototype.length
    expect(lengthMethod.call({ domNode: blot })).toBe(1)
  })
})