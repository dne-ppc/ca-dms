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

  // Task 2.3.3: Responsive Line Segments Tests
  describe('Responsive Behavior', () => {
    let originalInnerWidth: number

    beforeEach(() => {
      // Store original window width
      originalInnerWidth = window.innerWidth
    })

    afterEach(() => {
      // Restore original window width
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: originalInnerWidth
      })
    })

    it('should maintain proportions on different screen sizes', () => {
      const testData: LineSegmentData = { length: 'medium' }
      const blot = LineSegmentBlot.create(testData)
      
      // Test desktop proportion
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1200
      })
      
      const desktopWidth = LineSegmentBlot.getResponsiveWidth('medium', 1200)
      expect(desktopWidth).toBe(288) // Full width on desktop
      
      // Test tablet proportion
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768
      })
      
      const tabletWidth = LineSegmentBlot.getResponsiveWidth('medium', 768)
      expect(tabletWidth).toBe(288) // Still full width on tablet
      
      // Test mobile proportion
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 320
      })
      
      const mobileWidth = LineSegmentBlot.getResponsiveWidth('medium', 320)
      expect(mobileWidth).toBeLessThan(288) // Constrained on mobile
    })

    it('should handle overflow gracefully on small screens', () => {
      // Test long segment on very small screen
      const longSegmentWidth = LineSegmentBlot.getResponsiveWidth('long', 300)
      expect(longSegmentWidth).toBeLessThanOrEqual(300 * 0.8) // Max 80% of viewport
      
      // Test medium segment should fit better
      const mediumSegmentWidth = LineSegmentBlot.getResponsiveWidth('medium', 300)
      expect(mediumSegmentWidth).toBeLessThanOrEqual(longSegmentWidth)
      
      // Test short segment should always fit
      const shortSegmentWidth = LineSegmentBlot.getResponsiveWidth('short', 300)
      expect(shortSegmentWidth).toBeLessThanOrEqual(mediumSegmentWidth)
    })

    it('should provide viewport-aware sizing utilities', () => {
      expect(LineSegmentBlot.getMaxWidthForViewport(1200)).toBe(Math.round(1200 * 0.9)) // 90% on desktop
      expect(LineSegmentBlot.getMaxWidthForViewport(768)).toBe(Math.round(768 * 0.85)) // 85% on tablet
      expect(LineSegmentBlot.getMaxWidthForViewport(480)).toBe(Math.round(480 * 0.8)) // 80% on mobile
    })

    it('should integrate with text flow properly', () => {
      const testData: LineSegmentData = { length: 'short' }
      const blot = LineSegmentBlot.create(testData)
      
      // Should have inline-block display for proper text flow
      expect(blot.style.display).toBe('inline-block')
      
      // Should have proper vertical alignment
      expect(blot.style.verticalAlign).toBe('baseline')
      
      // Should support text wrapping behavior
      expect(LineSegmentBlot.supportsTextWrapping()).toBe(true)
    })

    it('should provide responsive breakpoint utilities', () => {
      expect(LineSegmentBlot.getBreakpoint(1200)).toBe('desktop')
      expect(LineSegmentBlot.getBreakpoint(768)).toBe('tablet')
      expect(LineSegmentBlot.getBreakpoint(480)).toBe('mobile')
      expect(LineSegmentBlot.getBreakpoint(320)).toBe('mobile')
    })

    it('should calculate responsive multipliers', () => {
      // Desktop: full size
      expect(LineSegmentBlot.getResponsiveMultiplier(1200)).toBe(1.0)
      
      // Tablet: slightly reduced
      expect(LineSegmentBlot.getResponsiveMultiplier(768)).toBe(1.0)
      
      // Mobile: significantly reduced for long segments
      const mobileMult = LineSegmentBlot.getResponsiveMultiplier(320)
      expect(mobileMult).toBeLessThan(1.0)
      expect(mobileMult).toBeGreaterThan(0.5)
    })

    it('should handle container constraints', () => {
      const containerWidth = 400
      
      // Long segment should be constrained by container
      const longInContainer = LineSegmentBlot.getWidthForContainer('long', containerWidth)
      expect(longInContainer).toBeLessThanOrEqual(containerWidth * 0.8)
      
      // Medium segment might fit
      const mediumInContainer = LineSegmentBlot.getWidthForContainer('medium', containerWidth)
      expect(mediumInContainer).toBeLessThanOrEqual(containerWidth * 0.9)
      
      // Short segment should always fit
      const shortInContainer = LineSegmentBlot.getWidthForContainer('short', containerWidth)
      expect(shortInContainer).toBe(144) // Original width when it fits
    })

    it('should maintain minimum readable sizes', () => {
      // Even on tiny screens, segments should have minimum width
      const tinyScreenWidth = LineSegmentBlot.getResponsiveWidth('short', 200)
      expect(tinyScreenWidth).toBeGreaterThanOrEqual(LineSegmentBlot.MIN_SEGMENT_WIDTH)
      
      const tinyMediumWidth = LineSegmentBlot.getResponsiveWidth('medium', 200)
      expect(tinyMediumWidth).toBeGreaterThanOrEqual(LineSegmentBlot.MIN_SEGMENT_WIDTH)
      
      const tinyLongWidth = LineSegmentBlot.getResponsiveWidth('long', 200)
      expect(tinyLongWidth).toBeGreaterThanOrEqual(LineSegmentBlot.MIN_SEGMENT_WIDTH)
    })
  })

  // Task 2.3.4: PDF Single-Line Field Integration Tests
  describe('PDF Field Integration', () => {
    it('should generate PDF field metadata for line segments', () => {
      const testData: LineSegmentData = { length: 'medium' }
      const blot = LineSegmentBlot.create(testData)
      
      const pdfMetadata = LineSegmentBlot.generatePDFFieldMetadata(testData, 'field-001')
      
      expect(pdfMetadata).toEqual({
        fieldId: 'field-001',
        fieldType: 'text',
        fieldSubtype: 'single-line',
        width: 288,
        height: 20, // Standard single-line height
        required: false,
        maxLength: null,
        placeholder: '',
        fontSize: 12
      })
    })

    it('should add PDF field attributes to DOM elements', () => {
      const testData: LineSegmentData = { length: 'short' }
      const blot = LineSegmentBlot.create(testData)
      
      // Should have data-field-type attribute
      expect(blot.getAttribute('data-field-type')).toBe('single-line-text')
      
      // Should have data-field-width attribute matching segment width
      expect(blot.getAttribute('data-field-width')).toBe('144')
      
      // Should have data-field-height for PDF generation
      expect(blot.getAttribute('data-field-height')).toBe('20')
      
      // Should have unique field ID
      const fieldId = blot.getAttribute('data-field-id')
      expect(fieldId).toBeTruthy()
      expect(fieldId).toMatch(/^line-segment-\d+-\w+$/)
    })

    it('should handle different field widths for different segment lengths', () => {
      const shortMeta = LineSegmentBlot.generatePDFFieldMetadata({ length: 'short' }, 'short-1')
      const mediumMeta = LineSegmentBlot.generatePDFFieldMetadata({ length: 'medium' }, 'medium-1')
      const longMeta = LineSegmentBlot.generatePDFFieldMetadata({ length: 'long' }, 'long-1')
      
      expect(shortMeta.width).toBe(144)
      expect(mediumMeta.width).toBe(288)
      expect(longMeta.width).toBe(432)
      
      // All should be single-line text fields
      expect(shortMeta.fieldSubtype).toBe('single-line')
      expect(mediumMeta.fieldSubtype).toBe('single-line')
      expect(longMeta.fieldSubtype).toBe('single-line')
    })

    it('should provide PDF positioning data for inline placement', () => {
      const testData: LineSegmentData = { length: 'long' }
      const positioning = LineSegmentBlot.getPDFPositioning(testData)
      
      expect(positioning).toEqual({
        placement: 'inline',
        verticalAlign: 'baseline',
        marginLeft: 2,
        marginRight: 2,
        preserveAspectRatio: true,
        allowBreaking: false // Don't break line segments across pages
      })
    })

    it('should generate unique field IDs for multiple segments', () => {
      const ids = new Set()
      
      // Create 5 line segments and ensure all have unique IDs
      for (let i = 0; i < 5; i++) {
        const blot = LineSegmentBlot.create({ length: 'medium' })
        const fieldId = blot.getAttribute('data-field-id')
        
        expect(fieldId).toBeTruthy()
        expect(ids.has(fieldId)).toBe(false)
        ids.add(fieldId)
      }
      
      expect(ids.size).toBe(5)
    })

    it('should provide PDF form field validation options', () => {
      const validation = LineSegmentBlot.getPDFValidationOptions()
      
      expect(validation).toEqual({
        required: false,
        format: 'text',
        maxLength: null,
        pattern: null,
        customValidation: false
      })
    })

    it('should calculate PDF field dimensions based on DPI', () => {
      const shortDimensions = LineSegmentBlot.getPDFDimensions('short')
      const mediumDimensions = LineSegmentBlot.getPDFDimensions('medium') 
      const longDimensions = LineSegmentBlot.getPDFDimensions('long')
      
      // Width should match pixel values converted to PDF points (72 DPI)
      expect(shortDimensions.width).toBe(144)
      expect(mediumDimensions.width).toBe(288)
      expect(longDimensions.width).toBe(432)
      
      // Height should be consistent for single-line fields
      expect(shortDimensions.height).toBe(20)
      expect(mediumDimensions.height).toBe(20)
      expect(longDimensions.height).toBe(20)
    })

    it('should support PDF field customization options', () => {
      const customOptions = {
        required: true,
        placeholder: 'Enter text here',
        maxLength: 50,
        fontSize: 10
      }
      
      const metadata = LineSegmentBlot.generatePDFFieldMetadata(
        { length: 'medium' }, 
        'custom-field',
        customOptions
      )
      
      expect(metadata.required).toBe(true)
      expect(metadata.placeholder).toBe('Enter text here')
      expect(metadata.maxLength).toBe(50)
      expect(metadata.fontSize).toBe(10)
    })

    it('should extract PDF field data from DOM for serialization', () => {
      const testData: LineSegmentData = { length: 'short' }
      const blot = LineSegmentBlot.create(testData)
      
      const extractedData = LineSegmentBlot.extractPDFFieldData(blot)
      
      expect(extractedData).toEqual({
        fieldType: 'single-line-text',
        width: 144,
        height: 20,
        fieldId: expect.stringMatching(/^line-segment-\d+-\w+$/),
        length: 'short',
        positioning: {
          placement: 'inline',
          verticalAlign: 'baseline',
          marginLeft: 2,
          marginRight: 2
        }
      })
    })
  })
})