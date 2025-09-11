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

  // Task 2.3.2: Length Configuration System Tests
  describe('Length Configuration System', () => {
    it('should have proper length constants defined', () => {
      expect(LineSegmentBlot.LENGTH_CONSTANTS).toBeDefined()
      expect(LineSegmentBlot.LENGTH_CONSTANTS.SHORT).toBe(144)
      expect(LineSegmentBlot.LENGTH_CONSTANTS.MEDIUM).toBe(288)
      expect(LineSegmentBlot.LENGTH_CONSTANTS.LONG).toBe(432)
    })

    it('should have length configuration metadata', () => {
      expect(LineSegmentBlot.LENGTH_CONFIG).toBeDefined()
      expect(LineSegmentBlot.LENGTH_CONFIG.short).toEqual({
        label: 'Short (2 inches)',
        pixels: 144,
        inches: 2
      })
      expect(LineSegmentBlot.LENGTH_CONFIG.medium).toEqual({
        label: 'Medium (4 inches)',
        pixels: 288,
        inches: 4
      })
      expect(LineSegmentBlot.LENGTH_CONFIG.long).toEqual({
        label: 'Long (6 inches)',
        pixels: 432,
        inches: 6
      })
    })

    it('should provide available length options for UI selection', () => {
      const options = LineSegmentBlot.getAvailableLengths()
      expect(options).toHaveLength(3)
      expect(options).toEqual([
        { value: 'short', label: 'Short (2 inches)', pixels: 144 },
        { value: 'medium', label: 'Medium (4 inches)', pixels: 288 },
        { value: 'long', label: 'Long (6 inches)', pixels: 432 }
      ])
    })

    it('should validate length configurations', () => {
      expect(LineSegmentBlot.isValidLength('short')).toBe(true)
      expect(LineSegmentBlot.isValidLength('medium')).toBe(true)
      expect(LineSegmentBlot.isValidLength('long')).toBe(true)
      expect(LineSegmentBlot.isValidLength('invalid' as any)).toBe(false)
      expect(LineSegmentBlot.isValidLength(undefined as any)).toBe(false)
    })

    it('should convert inches to pixels correctly', () => {
      expect(LineSegmentBlot.inchesToPixels(2)).toBe(144)
      expect(LineSegmentBlot.inchesToPixels(4)).toBe(288)
      expect(LineSegmentBlot.inchesToPixels(6)).toBe(432)
      expect(LineSegmentBlot.inchesToPixels(1.5)).toBe(108)
    })

    it('should convert pixels to inches correctly', () => {
      expect(LineSegmentBlot.pixelsToInches(144)).toBe(2)
      expect(LineSegmentBlot.pixelsToInches(288)).toBe(4)
      expect(LineSegmentBlot.pixelsToInches(432)).toBe(6)
      expect(LineSegmentBlot.pixelsToInches(108)).toBe(1.5)
    })

    it('should get length type from pixel width', () => {
      expect(LineSegmentBlot.getLengthFromPixels(144)).toBe('short')
      expect(LineSegmentBlot.getLengthFromPixels(288)).toBe('medium')
      expect(LineSegmentBlot.getLengthFromPixels(432)).toBe('long')
      expect(LineSegmentBlot.getLengthFromPixels(200)).toBe('medium') // Default fallback
    })

    it('should handle configuration-based creation', () => {
      const config = LineSegmentBlot.LENGTH_CONFIG.long
      const data: LineSegmentData = { length: 'long' }
      const blot = LineSegmentBlot.create(data)
      
      expect(blot.style.width).toBe(`${config.pixels}px`)
      expect(blot.classList.contains('length-long')).toBe(true)
    })

    it('should provide DPI constant for calculations', () => {
      expect(LineSegmentBlot.DPI).toBe(72)
    })
  })
})