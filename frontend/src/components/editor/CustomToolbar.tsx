import './CustomToolbar.css'

type PlaceholderType = 'version-table' | 'signature-field' | 'long-response' | 'line-segment'

interface CustomToolbarProps {
  onInsertPlaceholder?: (type: PlaceholderType) => void
}

export const CustomToolbar = ({ onInsertPlaceholder }: CustomToolbarProps) => {
  const handlePlaceholderClick = (type: PlaceholderType) => {
    onInsertPlaceholder?.(type)
  }

  return (
    <div id="custom-toolbar" data-testid="custom-toolbar" className="custom-toolbar">
      {/* Standard Quill formatting tools */}
      <span className="ql-formats">
        <select className="ql-header" defaultValue="">
          <option value="1">Heading 1</option>
          <option value="2">Heading 2</option>
          <option value="3">Heading 3</option>
          <option value="">Normal</option>
        </select>
      </span>
      
      <span className="ql-formats">
        <button className="ql-bold" />
        <button className="ql-italic" />
        <button className="ql-underline" />
        <button className="ql-strike" />
      </span>
      
      <span className="ql-formats">
        <button className="ql-list" value="ordered" />
        <button className="ql-list" value="bullet" />
      </span>
      
      <span className="ql-formats">
        <button className="ql-blockquote" />
        <button className="ql-code-block" />
      </span>
      
      <span className="ql-formats">
        <button className="ql-link" />
      </span>

      {/* Custom placeholder insertion buttons */}
      <span className="ql-formats placeholder-tools">
        <button
          type="button"
          className="ql-placeholder-btn ql-version-table"
          data-testid="insert-version-table"
          onClick={() => handlePlaceholderClick('version-table')}
          title="Insert Version Table"
        >
          📋
        </button>
        <button
          type="button"
          className="ql-placeholder-btn ql-signature-field"
          data-testid="insert-signature-field"
          onClick={() => handlePlaceholderClick('signature-field')}
          title="Insert Signature Field"
        >
          ✍️
        </button>
        <button
          type="button"
          className="ql-placeholder-btn ql-long-response"
          data-testid="insert-long-response"
          onClick={() => handlePlaceholderClick('long-response')}
          title="Insert Long Response Area"
        >
          📝
        </button>
        <button
          type="button"
          className="ql-placeholder-btn ql-line-segment"
          data-testid="insert-line-segment"
          onClick={() => handlePlaceholderClick('line-segment')}
          title="Insert Line Segment"
        >
          ___
        </button>
      </span>
      
      <span className="ql-formats">
        <button className="ql-clean" />
      </span>
    </div>
  )
}