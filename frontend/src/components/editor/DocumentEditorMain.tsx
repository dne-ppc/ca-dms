import React, { useState, useCallback, useEffect } from 'react'
import { EnhancedToolbar } from './EnhancedToolbar'
import { EnhancedQuillEditor } from './EnhancedQuillEditor'
import { RightHandPanel } from './RightHandPanel'
import { useDeviceDetection } from '../../hooks/useDeviceDetection'
import './DocumentEditorMain.css'

export interface Document {
  id: string
  title: string
  type: string
  content: string
  author: string
  createdAt: string
  updatedAt: string
}

export interface User {
  id: string
  name: string
  email: string
}

interface DocumentEditorMainProps {
  document: Document
  user: User
  onDocumentUpdate: (document: Document) => void | Promise<void>
  onSave: (document: Document) => void | Promise<void>
  isReadOnly?: boolean
  rightPanelCollapsed?: boolean
  showVersionComparison?: boolean
  isSaving?: boolean
}

export const DocumentEditorMain: React.FC<DocumentEditorMainProps> = ({
  document,
  user,
  onDocumentUpdate,
  onSave,
  isReadOnly = false,
  rightPanelCollapsed = false,
  showVersionComparison = false,
  isSaving = false
}) => {
  const { isMobile } = useDeviceDetection()
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [headerFormat, setHeaderFormat] = useState('normal')
  const [isCollapsed, setIsCollapsed] = useState(rightPanelCollapsed || isMobile)

  // Handle document title changes
  const handleTitleChange = useCallback((title: string) => {
    const updatedDocument = { ...document, title }
    setHasUnsavedChanges(true)

    // Debounce the actual update call
    const timeoutId = setTimeout(async () => {
      try {
        setUpdateError(null)
        await onDocumentUpdate(updatedDocument)
      } catch (error) {
        setUpdateError('Failed to save')
        console.error('Document update failed:', error)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [document, onDocumentUpdate])

  // Handle document type changes
  const handleTypeChange = useCallback((type: string) => {
    const updatedDocument = { ...document, type }
    setHasUnsavedChanges(true)
    onDocumentUpdate(updatedDocument)
  }, [document, onDocumentUpdate])

  // Handle content changes
  const handleContentChange = useCallback(async (content: string) => {
    const updatedDocument = { ...document, content }
    setHasUnsavedChanges(true)

    try {
      setUpdateError(null)
      await onDocumentUpdate(updatedDocument)
    } catch (error) {
      setUpdateError('Failed to save')
      console.error('Document update failed:', error)
    }
  }, [document, onDocumentUpdate])

  // Handle version selection from right panel
  const handleVersionSelect = useCallback((version: any) => {
    if (version && version.content) {
      const updatedDocument = { ...document, content: version.content }
      onDocumentUpdate(updatedDocument)
    }
  }, [document, onDocumentUpdate])

  // Handle save
  const handleSave = useCallback(async () => {
    try {
      setSaveError(null)
      await onSave(document)
      setHasUnsavedChanges(false)
    } catch (error) {
      setSaveError('Save failed')
      console.error('Save failed:', error)
    }
  }, [document, onSave])

  // Formatting handlers
  const handleBold = useCallback(() => {
    // Bold formatting would be handled by the Quill editor
  }, [])

  const handleItalic = useCallback(() => {
    // Italic formatting would be handled by the Quill editor
  }, [])

  const handleUnderline = useCallback(() => {
    // Underline formatting would be handled by the Quill editor
  }, [])

  const handleUndo = useCallback(() => {
    // Undo would be handled by the Quill editor
  }, [])

  const handleRedo = useCallback(() => {
    // Redo would be handled by the Quill editor
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key.toLowerCase()) {
          case 's':
            event.preventDefault()
            handleSave()
            break
          case 'z':
            if (!event.shiftKey) {
              event.preventDefault()
              handleUndo()
            }
            break
          case 'y':
            event.preventDefault()
            handleRedo()
            break
        }
      }

      if (event.key === 'Escape') {
        // Close panels or dialogs
        setIsCollapsed(true)
      }
    }

    globalThis.document?.addEventListener('keydown', handleKeyDown)
    return () => globalThis.document?.removeEventListener('keydown', handleKeyDown)
  }, [handleSave, handleUndo, handleRedo])

  // Auto-collapse panel on mobile
  useEffect(() => {
    if (isMobile) {
      setIsCollapsed(true)
    }
  }, [isMobile])

  // Mobile restriction message
  if (isMobile) {
    return (
      <div className="document-editor-main flex flex-col h-full">
        <div className="p-4 bg-yellow-50 border-b border-yellow-200">
          <p className="text-yellow-800 text-sm">
            Mobile editing is limited. Please use a desktop for full editing capabilities.
          </p>
        </div>

        <EnhancedToolbar
          documentTitle={document.title}
          documentType={document.type}
          headerFormat={headerFormat}
          onTitleChange={handleTitleChange}
          onTypeChange={handleTypeChange}
          onHeaderFormatChange={setHeaderFormat}
          onSave={handleSave}
          onBold={handleBold}
          onItalic={handleItalic}
          onUnderline={handleUnderline}
          onUndo={handleUndo}
          onRedo={handleRedo}
          isSaving={isSaving}
          hasUnsavedChanges={hasUnsavedChanges}
        />

        <div className="flex-1 p-4">
          <EnhancedQuillEditor
            content={document.content}
            onChange={handleContentChange}
            readOnly={true}
          />
        </div>
      </div>
    )
  }

  return (
    <main
      role="main"
      aria-label="Document editor"
      className="document-editor-main flex flex-col h-full"
    >
      {/* Status Region for Screen Readers */}
      <div role="status" aria-live="polite" className="sr-only">
        {isSaving && 'Saving document...'}
        {saveError && `Error: ${saveError}`}
        {updateError && `Error: ${updateError}`}
      </div>

      {/* Error Messages */}
      {(saveError || updateError) && (
        <div className="p-3 bg-red-50 border-b border-red-200">
          <p className="text-red-800 text-sm">
            {saveError || updateError}
          </p>
        </div>
      )}

      {/* Read-Only Indicator */}
      {isReadOnly && (
        <div className="p-3 bg-gray-50 border-b border-gray-200">
          <p className="text-gray-600 text-sm">
            Read Only - Editing is disabled
          </p>
        </div>
      )}

      {/* Enhanced Toolbar */}
      <EnhancedToolbar
        documentTitle={document.title}
        documentType={document.type}
        headerFormat={headerFormat}
        onTitleChange={isReadOnly ? () => {} : handleTitleChange}
        onTypeChange={isReadOnly ? () => {} : handleTypeChange}
        onHeaderFormatChange={setHeaderFormat}
        onSave={handleSave}
        onBold={handleBold}
        onItalic={handleItalic}
        onUnderline={handleUnderline}
        onUndo={handleUndo}
        onRedo={handleRedo}
        isSaving={isSaving}
        hasUnsavedChanges={hasUnsavedChanges}
      />

      {/* Main Editor Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor Content */}
        <div className="flex-1 flex flex-col">
          <EnhancedQuillEditor
            content={document.content}
            onChange={isReadOnly ? () => {} : handleContentChange}
            readOnly={isReadOnly}
          />
        </div>

        {/* Right Hand Panel */}
        <RightHandPanel
          document={document}
          onVersionSelect={handleVersionSelect}
          collapsed={isCollapsed}
          onCollapseChange={setIsCollapsed}
        />
      </div>
    </main>
  )
}