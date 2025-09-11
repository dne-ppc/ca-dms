import { describe, it, expect, beforeEach } from 'vitest'
import Quill from 'quill'
import { VersionTableBlot } from '../../components/editor/blots/VersionTableBlot'

// Mock DOM environment for testing
const createQuillInstance = () => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  return new Quill(container, { theme: 'snow' })
}

describe('VersionTableBlot', () => {
  let quill: Quill

  beforeEach(() => {
    // Register the blot before each test
    Quill.register('formats/version-table', VersionTableBlot)
    quill = createQuillInstance()
  })

  it('should be registered as a custom blot format', () => {
    expect(VersionTableBlot.blotName).toBe('version-table')
    expect(VersionTableBlot.tagName).toBe('DIV')
    expect(VersionTableBlot.className).toBe('ql-version-table')
  })

  it('should create version table with default data', () => {
    const defaultData = [
      { version: '1.0', date: '2024-01-01', description: 'Initial version', author: 'System' }
    ]
    
    const blot = VersionTableBlot.create(defaultData)
    expect(blot).toBeInstanceOf(HTMLElement)
    expect(blot.classList.contains('ql-version-table')).toBe(true)
    expect(blot.textContent).toContain('1.0')
    expect(blot.textContent).toContain('Initial version')
  })

  it('should render table with proper structure', () => {
    const testData = [
      { version: '1.0', date: '2024-01-01', description: 'Initial version', author: 'John Doe' },
      { version: '1.1', date: '2024-01-15', description: 'Bug fixes', author: 'Jane Smith' }
    ]
    
    const blot = VersionTableBlot.create(testData)
    const table = blot.querySelector('table')
    const rows = blot.querySelectorAll('tbody tr')
    
    expect(table).toBeTruthy()
    expect(rows).toHaveLength(2)
    expect(blot.textContent).toContain('Version')
    expect(blot.textContent).toContain('Date')
    expect(blot.textContent).toContain('Description')
    expect(blot.textContent).toContain('Author')
  })

  it('should be immutable - prevent deletion', () => {
    const testData = [
      { version: '1.0', date: '2024-01-01', description: 'Initial version', author: 'System' }
    ]
    
    const blot = VersionTableBlot.create(testData)
    
    // Should have immutable attributes
    expect(blot.getAttribute('contenteditable')).toBe('false')
    expect(blot.getAttribute('data-immutable')).toBe('true')
    expect(blot.classList.contains('ql-version-table')).toBe(true)
  })

  it('should extract correct data from DOM element', () => {
    const testData = [
      { version: '2.0', date: '2024-02-01', description: 'Major update', author: 'Admin' }
    ]
    
    const blot = VersionTableBlot.create(testData)
    const extractedData = VersionTableBlot.value(blot)
    
    expect(extractedData).toEqual(testData)
  })

  it('should only allow placement at document start', () => {
    // Insert some content first
    quill.setText('Some existing content')
    
    // Try to insert version table at position 0 (start)
    const versionData = [{ version: '1.0', date: '2024-01-01', description: 'Test', author: 'User' }]
    
    expect(() => {
      quill.formatText(0, 0, 'version-table', versionData)
    }).not.toThrow()
  })
})