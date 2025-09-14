import { useEffect, useRef } from 'react'
import './CustomToolbar.css'
import { useKeyboardNavigationContext } from '../../contexts/KeyboardNavigationContext'

type PlaceholderType = 'version-table' | 'signature-field' | 'long-response' | 'line-segment'

interface CustomToolbarProps {
  onInsertPlaceholder?: (type: PlaceholderType) => void
}

export const CustomToolbar = ({ onInsertPlaceholder }: CustomToolbarProps) => {
  const toolbarRef = useRef<HTMLDivElement>(null)
  const { registerToolbar } = useKeyboardNavigationContext()

  const handlePlaceholderClick = (type: PlaceholderType) => {
    console.log('TDD Debug: CustomToolbar handlePlaceholderClick called with:', type)
    console.log('TDD Debug: onInsertPlaceholder prop is:', onInsertPlaceholder)
    onInsertPlaceholder?.(type)
  }

  // Register toolbar for keyboard navigation
  useEffect(() => {
    registerToolbar(toolbarRef.current)
  }, [])

  return (
    <div 
      ref={toolbarRef}
      id="custom-toolbar" 
      data-testid="custom-toolbar" 
      className="custom-toolbar"
      role="toolbar"
      aria-label="Text formatting toolbar"
      aria-describedby="toolbar-help"
      tabIndex={0}
    >
      {/* Standard Quill formatting tools */}
      <span className="ql-formats" role="group" aria-label="Text styles">
        <select className="ql-header" defaultValue="" aria-label="Heading level">
          <option value="1">Heading 1</option>
          <option value="2">Heading 2</option>
          <option value="3">Heading 3</option>
          <option value="">Normal</option>
        </select>
      </span>

      <span className="ql-formats" role="group" aria-label="Font family">
        <select className="ql-font" defaultValue="" aria-label="Font family">
          <option value="">Default</option>
          <option value="serif">Times New Roman</option>
          <option value="monospace">Courier New</option>
          <option value="helvetica">Helvetica</option>
          <option value="arial">Arial</option>
          <option value="georgia">Georgia</option>
          <option value="calibri">Calibri</option>
        </select>
      </span>

      <span className="ql-formats" role="group" aria-label="Font size">
        <select className="ql-size" defaultValue="" aria-label="Font size">
          <option value="small">Small</option>
          <option value="">Normal</option>
          <option value="large">Large</option>
          <option value="huge">Huge</option>
        </select>
      </span>
      
      <span className="ql-formats" role="group" aria-label="Text formatting">
        <button className="ql-bold" data-testid="toolbar-button-bold" aria-label="Bold (Ctrl+B)" title="Bold" />
        <button className="ql-italic" data-testid="toolbar-button-italic" aria-label="Italic (Ctrl+I)" title="Italic" />
        <button className="ql-underline" data-testid="toolbar-button-underline" aria-label="Underline (Ctrl+U)" title="Underline" />
        <button className="ql-strike" data-testid="toolbar-button-strike" aria-label="Strikethrough" title="Strikethrough" />
      </span>

      <span className="ql-formats" role="group" aria-label="Script formatting">
        <button className="ql-script" value="sub" title="Subscript" aria-label="Subscript">X₂</button>
        <button className="ql-script" value="super" title="Superscript" aria-label="Superscript">X²</button>
      </span>

      <span className="ql-formats" role="group" aria-label="Text and background colors">
        <select className="ql-color" defaultValue="" aria-label="Text color">
          <option value="" aria-label="Default text color" />
          <option value="#000000" aria-label="Black" />
          <option value="#e60000" aria-label="Red" />
          <option value="#ff9900" aria-label="Orange" />
          <option value="#ffff00" aria-label="Yellow" />
          <option value="#008a00" aria-label="Green" />
          <option value="#0066cc" aria-label="Blue" />
          <option value="#9933ff" aria-label="Purple" />
          <option value="#ffffff" aria-label="White" />
          <option value="#facccc" aria-label="Light red" />
          <option value="#ffebcc" aria-label="Light orange" />
          <option value="#ffffcc" aria-label="Light yellow" />
          <option value="#cce8cc" aria-label="Light green" />
          <option value="#cce0f5" aria-label="Light blue" />
          <option value="#ebd6ff" aria-label="Light purple" />
          <option value="#bbbbbb" aria-label="Light gray" />
          <option value="#f06666" aria-label="Medium red" />
          <option value="#ffc266" aria-label="Medium orange" />
          <option value="#ffff66" aria-label="Medium yellow" />
          <option value="#66b266" aria-label="Medium green" />
          <option value="#66a3e0" aria-label="Medium blue" />
          <option value="#c285ff" aria-label="Medium purple" />
          <option value="#888888" aria-label="Medium gray" />
          <option value="#a10000" aria-label="Dark red" />
          <option value="#b26b00" aria-label="Dark orange" />
          <option value="#b2b200" aria-label="Dark yellow" />
          <option value="#006100" aria-label="Dark green" />
          <option value="#0047b2" aria-label="Dark blue" />
          <option value="#6b24b2" aria-label="Dark purple" />
          <option value="#444444" aria-label="Dark gray" />
          <option value="#5c0000" aria-label="Very dark red" />
          <option value="#663d00" aria-label="Very dark orange" />
          <option value="#666600" aria-label="Very dark yellow" />
          <option value="#003700" aria-label="Very dark green" />
          <option value="#002966" aria-label="Very dark blue" />
          <option value="#3d1466" aria-label="Very dark purple" />
        </select>
        
        <select className="ql-background" defaultValue="" aria-label="Background color">
          <option value="" aria-label="Default background" />
          <option value="#000000" aria-label="Black background" />
          <option value="#e60000" aria-label="Red background" />
          <option value="#ff9900" aria-label="Orange background" />
          <option value="#ffff00" aria-label="Yellow background" />
          <option value="#008a00" aria-label="Green background" />
          <option value="#0066cc" aria-label="Blue background" />
          <option value="#9933ff" aria-label="Purple background" />
          <option value="#ffffff" aria-label="White background" />
          <option value="#facccc" aria-label="Light red background" />
          <option value="#ffebcc" aria-label="Light orange background" />
          <option value="#ffffcc" aria-label="Light yellow background" />
          <option value="#cce8cc" aria-label="Light green background" />
          <option value="#cce0f5" aria-label="Light blue background" />
          <option value="#ebd6ff" aria-label="Light purple background" />
          <option value="#bbbbbb" aria-label="Light gray background" />
          <option value="#f06666" aria-label="Medium red background" />
          <option value="#ffc266" aria-label="Medium orange background" />
          <option value="#ffff66" aria-label="Medium yellow background" />
          <option value="#66b266" aria-label="Medium green background" />
          <option value="#66a3e0" aria-label="Medium blue background" />
          <option value="#c285ff" aria-label="Medium purple background" />
          <option value="#888888" aria-label="Medium gray background" />
          <option value="#a10000" aria-label="Dark red background" />
          <option value="#b26b00" aria-label="Dark orange background" />
          <option value="#b2b200" aria-label="Dark yellow background" />
          <option value="#006100" aria-label="Dark green background" />
          <option value="#0047b2" aria-label="Dark blue background" />
          <option value="#6b24b2" aria-label="Dark purple background" />
          <option value="#444444" aria-label="Dark gray background" />
          <option value="#5c0000" aria-label="Very dark red background" />
          <option value="#663d00" aria-label="Very dark orange background" />
          <option value="#666600" aria-label="Very dark yellow background" />
          <option value="#003700" aria-label="Very dark green background" />
          <option value="#002966" aria-label="Very dark blue background" />
          <option value="#3d1466" aria-label="Very dark purple background" />
        </select>
      </span>
      
      <span className="ql-formats" role="group" aria-label="Lists">
        <button className="ql-list" value="ordered" aria-label="Numbered list" title="Numbered list" />
        <button className="ql-list" value="bullet" aria-label="Bullet list" title="Bullet list" />
      </span>
      
      <span className="ql-formats" role="group" aria-label="Block formatting">
        <button className="ql-blockquote" aria-label="Blockquote" title="Blockquote" />
        <button className="ql-code-block" aria-label="Code block" title="Code block" />
      </span>
      
      <span className="ql-formats" role="group" aria-label="Links">
        <button className="ql-link" aria-label="Insert link" title="Insert link (Ctrl+K)" />
      </span>

      {/* Custom placeholder insertion buttons */}
      <span className="ql-formats placeholder-tools" role="group" aria-label="Placeholder insertions">
        <button
          type="button"
          className="ql-placeholder-btn ql-version-table"
          data-testid="insert-version-table"
          onClick={() => handlePlaceholderClick('version-table')}
          title="Insert Version Table"
          aria-label="Insert version table - document versioning placeholder"
        >
          📋
        </button>
        <button
          type="button"
          className="ql-placeholder-btn ql-signature-field"
          data-testid="insert-signature-field"
          onClick={() => handlePlaceholderClick('signature-field')}
          title="Insert Signature Field"
          aria-label="Insert signature field - name, title, and date placeholder"
        >
          ✍️
        </button>
        <button
          type="button"
          className="ql-placeholder-btn ql-long-response"
          data-testid="insert-long-response"
          onClick={() => handlePlaceholderClick('long-response')}
          title="Insert Long Response Area"
          aria-label="Insert long response area - multi-line text placeholder"
        >
          📝
        </button>
        <button
          type="button"
          className="ql-placeholder-btn ql-line-segment"
          data-testid="insert-line-segment"
          onClick={() => handlePlaceholderClick('line-segment')}
          title="Insert Line Segment"
          aria-label="Insert line segment - short line placeholder"
        >
          ___
        </button>
      </span>
      
      <span className="ql-formats" role="group" aria-label="Clear formatting">
        <button className="ql-clean" aria-label="Remove formatting" title="Clear formatting" />
      </span>
      
      <div id="toolbar-help" className="sr-only">
        Use keyboard navigation with Tab and arrow keys to access formatting options. 
        Press Space or Enter to activate buttons. Use Shift+Tab to navigate backwards.
      </div>
    </div>
  )
}