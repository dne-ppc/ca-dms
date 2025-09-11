import { describe, it, expect, beforeEach } from 'vitest'
import Quill from 'quill'
import { LongResponseBlot, type LongResponseData } from '../../components/editor/blots/LongResponseBlot'

// Mock DOM environment for testing
const createQuillInstance = () => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  return new Quill(container, { theme: 'snow' })
}

describe('LongResponseBlot', () => {
  beforeEach(() => {
    // Register the blot before each test
    Quill.register('formats/long-response', LongResponseBlot)
    createQuillInstance()
  })

  it('should be registered as a custom blot format', () => {
    expect(LongResponseBlot.blotName).toBe('long-response')
    expect(LongResponseBlot.tagName).toBe('DIV')
    expect(LongResponseBlot.className).toBe('ql-long-response')
  })

  it('should create long response area with default empty data', () => {
    const defaultData: LongResponseData = {
      label: '',
      content: '',
      height: 'medium'
    }
    
    const blot = LongResponseBlot.create(defaultData)
    expect(blot).toBeInstanceOf(HTMLElement)
    expect(blot.classList.contains('ql-long-response')).toBe(true)
    expect(blot.querySelector('textarea')).toBeTruthy()
    expect(blot.querySelector('label')).toBeTruthy()
  })

  it('should create long response area with provided data', () => {
    const testData: LongResponseData = {
      label: 'Explanation of Decision',
      content: 'Please provide a detailed explanation of your decision-making process...',
      height: 'large'
    }
    
    const blot = LongResponseBlot.create(testData)
    const labelElement = blot.querySelector('label')
    const textarea = blot.querySelector('textarea') as HTMLTextAreaElement
    
    expect(labelElement?.textContent).toBe('Explanation of Decision')
    expect(textarea?.value).toBe('Please provide a detailed explanation of your decision-making process...')
    expect(blot.classList.contains('height-large')).toBe(true)
  })

  it('should render proper form structure', () => {
    const testData: LongResponseData = {
      label: 'Board Comments',
      content: 'Initial comments...',
      height: 'small'
    }
    
    const blot = LongResponseBlot.create(testData)
    
    // Check for container structure
    const container = blot.querySelector('.response-container')
    expect(container).toBeTruthy()
    
    // Check for label
    const label = blot.querySelector('label')
    expect(label).toBeTruthy()
    
    // Check for textarea
    const textarea = blot.querySelector('textarea')
    expect(textarea).toBeTruthy()
    
    // Check for proper height class
    expect(blot.classList.contains('height-small')).toBe(true)
  })

  it('should support different height configurations', () => {
    const heights: Array<LongResponseData['height']> = ['small', 'medium', 'large']
    
    heights.forEach(height => {
      const testData: LongResponseData = {
        label: `Test ${height}`,
        content: 'Test content',
        height
      }
      
      const blot = LongResponseBlot.create(testData)
      expect(blot.classList.contains(`height-${height}`)).toBe(true)
    })
  })

  it('should extract correct data from DOM element', () => {
    const testData: LongResponseData = {
      label: 'Project Description',
      content: 'This project aims to improve community engagement through digital platforms.',
      height: 'medium'
    }
    
    const blot = LongResponseBlot.create(testData)
    const extractedData = LongResponseBlot.value(blot)
    
    expect(extractedData).toEqual(testData)
  })

  it('should be editable - textarea should not be readonly', () => {
    const testData: LongResponseData = {
      label: 'Editable Response',
      content: 'This should be editable',
      height: 'medium'
    }
    
    const blot = LongResponseBlot.create(testData)
    const textarea = blot.querySelector('textarea') as HTMLTextAreaElement
    
    expect(textarea.readOnly).toBe(false)
    expect(textarea.disabled).toBe(false)
  })

  it('should have proper styling classes', () => {
    const testData: LongResponseData = {
      label: 'Styled Response',
      content: 'Content with styling',
      height: 'large'
    }
    
    const blot = LongResponseBlot.create(testData)
    
    expect(blot.classList.contains('ql-long-response')).toBe(true)
    expect(blot.classList.contains('height-large')).toBe(true)
    
    const container = blot.querySelector('.response-container')
    expect(container).toBeTruthy()
  })

  it('should handle empty values gracefully', () => {
    const emptyData: LongResponseData = {
      label: '',
      content: '',
      height: 'medium'
    }
    
    const blot = LongResponseBlot.create(emptyData)
    const extractedData = LongResponseBlot.value(blot)
    
    expect(extractedData).toEqual(emptyData)
  })

  it('should auto-resize textarea based on content', () => {
    const testData: LongResponseData = {
      label: 'Auto-resize Test',
      content: 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5',
      height: 'medium'
    }
    
    const blot = LongResponseBlot.create(testData)
    const textarea = blot.querySelector('textarea') as HTMLTextAreaElement
    
    // Verify textarea has content
    expect(textarea.value).toBe(testData.content)
    
    // Verify auto-resize functionality exists (implementation detail)
    expect(textarea.style.resize).toBe('vertical')
  })

  it('should report correct length for Quill operations', () => {
    const testData: LongResponseData = {
      label: 'Length Test',
      content: 'Test content for length',
      height: 'medium'
    }
    
    const blot = LongResponseBlot.create(testData)
    
    // Test the length method through the DOM node
    expect(typeof LongResponseBlot.prototype.length).toBe('function')
    
    // Verify the length would be 1 if we could instantiate properly
    const lengthMethod = LongResponseBlot.prototype.length
    expect(lengthMethod.call({ domNode: blot })).toBe(1)
  })
})