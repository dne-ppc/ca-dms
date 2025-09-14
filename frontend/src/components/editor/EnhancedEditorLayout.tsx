import React from 'react'
import { useDeviceDetection } from '../../hooks/useDeviceDetection'
import { EnhancedToolbar } from './EnhancedToolbar'
import { MobileEditor } from './MobileEditor'
import { DocumentEditor } from './DocumentEditor'
import { EnhancedQuillEditor } from './EnhancedQuillEditor'
import './EnhancedEditorLayout.css'

interface EnhancedEditorLayoutProps {
  documentId?: string
  value?: string
  onChange?: (value: string) => void
  readOnly?: boolean
  className?: string
}

export const EnhancedEditorLayout: React.FC<EnhancedEditorLayoutProps> = ({
  documentId,
  value,
  onChange,
  readOnly = false,
  className = ''
}) => {
  const { isMobile, isDesktop, deviceType } = useDeviceDetection()

  // For now, let's always show the desktop layout to avoid duplication issues
  // Mobile detection can be enabled later once the layout is stable

  return (
    <div
      data-testid="editor-error-boundary"
      className="google-docs-layout"
      style={{
        minHeight: '100vh',
        backgroundColor: '#f9fbfd',
        fontFamily: '"Google Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}
    >
      {/* Google Docs style header toolbar */}
      <EnhancedToolbar
        documentTitle={documentId || "Untitled Document"}
        documentType="general"
        headerFormat="standard"
        onTitleChange={() => {}}
        onTypeChange={() => {}}
        onHeaderFormatChange={() => {}}
        onSave={() => {}}
        onBold={() => {}}
        onItalic={() => {}}
        onUnderline={() => {}}
        onUndo={() => {}}
        onRedo={() => {}}
      />

      {/* Main content area like Google Docs */}
      <main
        role="main"
        aria-label="Document editor"
        className="google-docs-main"
        data-testid="enhanced-editor-layout"
        style={{
          display: 'flex',
          justifyContent: 'center',
          backgroundColor: '#f9fbfd',
          minHeight: 'calc(100vh - 120px)',
          padding: '20px 0'
        }}
      >
        <div
          className="document-container"
          style={{
            width: '8.5in',
            minHeight: '11in',
            backgroundColor: 'white',
            boxShadow: '0 1px 3px 0 rgba(60,64,67,.15), 0 4px 8px 3px rgba(60,64,67,.1)',
            borderRadius: '8px',
            margin: '0 auto',
            padding: '1in',
            position: 'relative'
          }}
        >
          <EnhancedQuillEditor
            value={value}
            onChange={onChange}
            readOnly={readOnly}
          />
        </div>
      </main>
    </div>
  )
}