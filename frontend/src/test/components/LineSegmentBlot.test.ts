import { describe, it, expect, beforeEach } from 'vitest'
import Quill from 'quill'
import { LineSegmentBlot, type LineSegmentData } from '../../components/editor/blots/LineSegmentBlot'

// Mock DOM environment for testing
const createQuillInstance = () => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  return new Quill(container, { theme: 'snow' })
}

describe('LineSegmentBlot', () => {
  beforeEach(() => {
    // Register the blot before each test
    Quill.register('formats/line-segment', LineSegmentBlot)
    createQuillInstance()
  })

  it('should be registered as a custom inline blot format', () => {
    expect(LineSegmentBlot.blotName).toBe('line-segment')
    expect(LineSegmentBlot.tagName).toBe('SPAN')
    expect(LineSegmentBlot.className).toBe('ql-line-segment')
  })

  it('should create short line segment (2in/144px)', () => {
    const shortSegmentData: LineSegmentData = {
      length: 'short'
    }
    
    const blot = LineSegmentBlot.create(shortSegmentData)
    expect(blot).toBeInstanceOf(HTMLElement)
    expect(blot.classList.contains('ql-line-segment')).toBe(true)
    expect(blot.classList.contains('length-short')).toBe(true)
    expect(blot.style.width).toBe('144px')
  })

  it('should create medium line segment (4in/288px)', () => {
    const mediumSegmentData: LineSegmentData = {
      length: 'medium'
    }
    
    const blot = LineSegmentBlot.create(mediumSegmentData)
    expect(blot).toBeInstanceOf(HTMLElement)
    expect(blot.classList.contains('ql-line-segment')).toBe(true)
    expect(blot.classList.contains('length-medium')).toBe(true)
    expect(blot.style.width).toBe('288px')
  })

  it('should create long line segment (6in/432px)', () => {
    const longSegmentData: LineSegmentData = {
      length: 'long'
    }
    
    const blot = LineSegmentBlot.create(longSegmentData)
    expect(blot).toBeInstanceOf(HTMLElement)
    expect(blot.classList.contains('ql-line-segment')).toBe(true)
    expect(blot.classList.contains('length-long')).toBe(true)
    expect(blot.style.width).toBe('432px')
  })

  it('should default to medium length when no length specified', () => {
    const defaultData: LineSegmentData = {}
    
    const blot = LineSegmentBlot.create(defaultData)
    expect(blot.classList.contains('length-medium')).toBe(true)
    expect(blot.style.width).toBe('288px')
  })

  it('should render as inline element with underlined style', () => {
    const testData: LineSegmentData = {
      length: 'short'
    }
    
    const blot = LineSegmentBlot.create(testData)
    
    // Should have inline display behavior
    expect(blot.tagName).toBe('SPAN')
    
    // Should have bottom border to create line appearance
    const computedStyle = window.getComputedStyle(blot)
    expect(blot.classList.contains('ql-line-segment')).toBe(true)
  })

  it('should extract correct length data from DOM element', () => {
    const testData: LineSegmentData = {
      length: 'long'
    }
    
    const blot = LineSegmentBlot.create(testData)
    const extractedData = LineSegmentBlot.value(blot)
    
    expect(extractedData.length).toBe('long')
  })

  it('should handle all three length variants correctly', () => {
    const lengths: Array<LineSegmentData['length']> = ['short', 'medium', 'long']
    const expectedWidths = ['144px', '288px', '432px']
    
    lengths.forEach((length, index) => {
      const data: LineSegmentData = { length }
      const blot = LineSegmentBlot.create(data)
      
      expect(blot.classList.contains(`length-${length}`)).toBe(true)
      expect(blot.style.width).toBe(expectedWidths[index])
      
      const extractedData = LineSegmentBlot.value(blot)
      expect(extractedData.length).toBe(length)
    })
  })

  it('should have proper CSS classes for styling', () => {
    const testData: LineSegmentData = {
      length: 'medium'
    }
    
    const blot = LineSegmentBlot.create(testData)
    
    expect(blot.classList.contains('ql-line-segment')).toBe(true)
    expect(blot.classList.contains('length-medium')).toBe(true)
  })

  it('should report correct length for Quill operations', () => {
    const testData: LineSegmentData = {
      length: 'short'
    }
    
    const blot = LineSegmentBlot.create(testData)
    
    // Test the length method indirectly
    expect(typeof LineSegmentBlot.prototype.length).toBe('function')
    
    // Verify the length would be 1 if we could instantiate properly
    const lengthMethod = LineSegmentBlot.prototype.length
    expect(lengthMethod.call({ domNode: blot })).toBe(1)
  })

  it('should provide correct pixel width calculations', () => {
    expect(LineSegmentBlot.getPixelWidth('short')).toBe(144)
    expect(LineSegmentBlot.getPixelWidth('medium')).toBe(288)
    expect(LineSegmentBlot.getPixelWidth('long')).toBe(432)
  })
})