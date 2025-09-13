import React from 'react'
import { useDeviceDetection } from '../../hooks/useDeviceDetection'
import { EnhancedToolbar } from './EnhancedToolbar'
import { MobileEditor } from './MobileEditor'
import { DocumentEditor } from './DocumentEditor'
import './EnhancedEditorLayout.css'

interface EnhancedEditorLayoutProps {
  className?: string
}

export const EnhancedEditorLayout: React.FC<EnhancedEditorLayoutProps> = ({
  className = ''
}) => {
  const { isMobile, isDesktop } = useDeviceDetection()

  if (isMobile) {
    return (
      <main
        role="main"
        aria-label="Document editor"
        className={`enhanced-editor-layout mobile-layout ${className}`}
      >
        <div className="mobile-restriction-banner">
          <h2>Mobile Editing Restricted</h2>
          <p>
            Document editing is limited on mobile devices for the best user experience.
            Please use a desktop or tablet with a larger screen for full editing capabilities.
          </p>
          <p>
            You can still view documents, participate in approval workflows, and search content.
          </p>
        </div>
        <MobileEditor
          documentId="mobile-restricted"
          readOnly={true}
          onSave={() => {}}
        />
      </main>
    )
  }

  return (
    <main
      role="main"
      aria-label="Document editor"
      className={`enhanced-editor-layout desktop-layout ${className}`}
    >
      <div className="desktop-editor-container">
        <EnhancedToolbar />
        <div className="editor-content-area">
          <DocumentEditor />
        </div>
      </div>
    </main>
  )
}