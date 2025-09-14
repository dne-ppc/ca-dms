import React, { useState, useCallback, useEffect, useRef } from 'react'
import { EnhancedToolbar } from './EnhancedToolbar'
import { EnhancedQuillEditor } from './EnhancedQuillEditor'
import { RightHandPanel } from './RightHandPanel'
import { AutoSave, useAutoSave } from './AutoSave'
import { DocumentStats, useDocumentStats } from './DocumentStats'
import { CommandPalette, useCommandPalette, createDefaultEditorCommands } from './CommandPalette'
import { DocumentTemplateSelector, useDocumentTemplateSelector } from './DocumentTemplateSelector'
import { DocumentTemplateManager } from './DocumentTemplateManager'
import type { DocumentTemplate } from './DocumentTemplateManager'
import { FormatControls } from './FormatControls'
import { markdownService } from '../../services/markdownService'
import type { HeaderFormat } from '../../services/markdownService'
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
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true)
  const [showStats, setShowStats] = useState(false)

  // Ref for debouncing timeout
  const titleDebounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Ref for Quill editor instance
  const quillEditorRef = useRef<any>(null)

  // Advanced editor hooks
  const documentStats = useDocumentStats(document.content)
  const commandPalette = useCommandPalette()
  const templateSelector = useDocumentTemplateSelector()
  const autoSave = useAutoSave(document, onSave, {
    enabled: autoSaveEnabled && !isReadOnly,
    intervalSeconds: 30
  })

  // Handle document title changes
  const handleTitleChange = useCallback((title: string) => {
    const updatedDocument = { ...document, title }
    setHasUnsavedChanges(true)

    // Clear existing timeout
    if (titleDebounceTimeoutRef.current) {
      clearTimeout(titleDebounceTimeoutRef.current)
    }

    // Debounce the actual update call
    titleDebounceTimeoutRef.current = setTimeout(async () => {
      try {
        setUpdateError(null)
        await onDocumentUpdate(updatedDocument)
      } catch (error) {
        setUpdateError('Failed to save')
        console.error('Document update failed:', error)
      }
    }, 300)
  }, [document, onDocumentUpdate])

  // Handle document type changes
  const handleTypeChange = useCallback((type: string) => {
    const updatedDocument = { ...document, type }
    setHasUnsavedChanges(true)
    onDocumentUpdate(updatedDocument)
  }, [document, onDocumentUpdate])

  // Handle header format changes with markdown integration
  const handleHeaderFormatChange = useCallback((format: string) => {
    setHeaderFormat(format)

    // Apply markdown formatting if editor is available
    if (quillEditorRef.current && format) {
      const editor = quillEditorRef.current
      const selection = editor.getSelection()

      if (selection) {
        try {
          // Get current line
          const [line, offset] = editor.getLine(selection.index)
          if (line && line.domNode) {
            const lineText = line.domNode.textContent || ''
            const lineStart = offset
            const lineLength = lineText.length

            // Parse current line to extract content without markdown
            const parsed = markdownService.parseMarkdown(lineText)

            // Generate new markdown text
            const newText = markdownService.convertToMarkdown(parsed.text, format as HeaderFormat)

            // Replace the entire line
            if (lineLength > 0) {
              editor.deleteText(lineStart, lineLength)
            }
            editor.insertText(lineStart, newText)

            // Set cursor position at end of line
            editor.setSelection(lineStart + newText.length)
          }
        } catch (error) {
          console.debug('Header format application error:', error)
        }
      }
    }
  }, [])

  // Handle editor instance reference
  const handleEditorReady = useCallback((editorInstance: any) => {
    quillEditorRef.current = editorInstance
  }, [])

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
    if (quillEditorRef.current) {
      const format = quillEditorRef.current.getFormat()
      quillEditorRef.current.format('bold', !format.bold)
    }
  }, [])

  const handleItalic = useCallback(() => {
    if (quillEditorRef.current) {
      const format = quillEditorRef.current.getFormat()
      quillEditorRef.current.format('italic', !format.italic)
    }
  }, [])

  const handleUnderline = useCallback(() => {
    if (quillEditorRef.current) {
      const format = quillEditorRef.current.getFormat()
      quillEditorRef.current.format('underline', !format.underline)
    }
  }, [])

  const handleUndo = useCallback(() => {
    if (quillEditorRef.current) {
      quillEditorRef.current.history.undo()
    }
  }, [])

  const handleRedo = useCallback(() => {
    if (quillEditorRef.current) {
      quillEditorRef.current.history.redo()
    }
  }, [])

  const handleStrikethrough = useCallback(() => {
    if (quillEditorRef.current) {
      const format = quillEditorRef.current.getFormat()
      quillEditorRef.current.format('strike', !format.strike)
    }
  }, [])

  const handleBulletList = useCallback(() => {
    if (quillEditorRef.current) {
      const format = quillEditorRef.current.getFormat()
      quillEditorRef.current.format('list', format.list === 'bullet' ? false : 'bullet')
    }
  }, [])

  const handleNumberedList = useCallback(() => {
    if (quillEditorRef.current) {
      const format = quillEditorRef.current.getFormat()
      quillEditorRef.current.format('list', format.list === 'ordered' ? false : 'ordered')
    }
  }, [])

  const handleAlignLeft = useCallback(() => {
    if (quillEditorRef.current) {
      quillEditorRef.current.format('align', 'left')
    }
  }, [])

  const handleAlignCenter = useCallback(() => {
    if (quillEditorRef.current) {
      quillEditorRef.current.format('align', 'center')
    }
  }, [])

  const handleAlignRight = useCallback(() => {
    if (quillEditorRef.current) {
      quillEditorRef.current.format('align', 'right')
    }
  }, [])

  const handleAlignJustify = useCallback(() => {
    if (quillEditorRef.current) {
      quillEditorRef.current.format('align', 'justify')
    }
  }, [])

  const handleRequestSignature = useCallback(async (participants: any[]) => {
    console.log('Signature request initiated for document:', document.id, 'participants:', participants)

    // TODO: Integrate with signature service
    // For now, just show success message
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))

      // In the future, this would call our signature service
      // const signatureService = new SignatureService()
      // await signatureService.createSignatureRequest(document.id, participants)

      console.log('Signature request created successfully')
    } catch (error) {
      console.error('Failed to create signature request:', error)
      throw error
    }
  }, [document.id])

  // Handle template selection
  const handleTemplateSelect = useCallback((template: DocumentTemplate) => {
    const updatedDocument = {
      ...document,
      title: template.name,
      content: JSON.stringify(template.content),
      type: template.category
    }

    onDocumentUpdate(updatedDocument)
    setHasUnsavedChanges(true)

    // Increment template popularity
    DocumentTemplateManager.incrementPopularity(template.id)
  }, [document, onDocumentUpdate])

  // Create command palette commands
  const commandPaletteCommands = [
    ...createDefaultEditorCommands({
      onSave: handleSave,
      onUndo: handleUndo,
      onRedo: handleRedo,
      onBold: handleBold,
      onItalic: handleItalic,
      onUnderline: handleUnderline,
      onRequestSignature: isReadOnly ? undefined : () => {
        // This would trigger the signature request modal
        console.log('Open signature request modal')
      },
      onDownloadPDF: () => {
        // This would trigger PDF download
        console.log('Download PDF')
      }
    }),
    // Template commands
    {
      id: 'template-selector',
      label: 'Browse Document Templates',
      description: 'Choose from pre-built document templates',
      shortcut: 'Ctrl+T',
      category: 'document' as const,
      action: () => templateSelector.open(),
      enabled: !isReadOnly
    },
    {
      id: 'template-board-resolution',
      label: 'New Board Resolution',
      description: 'Create a new board resolution from template',
      category: 'insert' as const,
      action: () => {
        const template = DocumentTemplateManager.getTemplateById('board-resolution')
        if (template) handleTemplateSelect(template)
      },
      enabled: !isReadOnly
    },
    {
      id: 'template-meeting-minutes',
      label: 'New Meeting Minutes',
      description: 'Create meeting minutes from template',
      category: 'insert' as const,
      action: () => {
        const template = DocumentTemplateManager.getTemplateById('meeting-minutes')
        if (template) handleTemplateSelect(template)
      },
      enabled: !isReadOnly
    },
    {
      id: 'template-memo',
      label: 'New Business Memo',
      description: 'Create a business memorandum from template',
      category: 'insert' as const,
      action: () => {
        const template = DocumentTemplateManager.getTemplateById('memo-template')
        if (template) handleTemplateSelect(template)
      },
      enabled: !isReadOnly
    }
  ]

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key.toLowerCase()) {
          case 'k':
            event.preventDefault()
            commandPalette.open()
            break
          case 't':
            event.preventDefault()
            if (!isReadOnly) {
              templateSelector.open()
            }
            break
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
          case '\\':
            event.preventDefault()
            setShowStats(!showStats)
            break
        }
      }

      if (event.key === 'Escape') {
        // Close panels or dialogs
        if (commandPalette.isOpen) {
          commandPalette.close()
        } else {
          setIsCollapsed(true)
        }
      }
    }

    globalThis.document?.addEventListener('keydown', handleKeyDown)
    return () => globalThis.document?.removeEventListener('keydown', handleKeyDown)
  }, [handleSave, handleUndo, handleRedo, commandPalette, showStats])

  // Auto-collapse panel on mobile
  useEffect(() => {
    if (isMobile) {
      setIsCollapsed(true)
    }
  }, [isMobile])

  // Sync internal state with rightPanelCollapsed prop
  useEffect(() => {
    setIsCollapsed(rightPanelCollapsed || isMobile)
  }, [rightPanelCollapsed, isMobile])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (titleDebounceTimeoutRef.current) {
        clearTimeout(titleDebounceTimeoutRef.current)
      }
    }
  }, [])

  return (
    <div
      className="google-docs-layout"

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

      {/* Google Docs style header toolbar */}
      <EnhancedToolbar
        documentTitle={document.title}
        documentType={document.type}
        headerFormat={headerFormat}
        documentId={document.id}
        onTitleChange={isReadOnly ? () => { } : handleTitleChange}
        onTypeChange={isReadOnly ? () => { } : handleTypeChange}
        onHeaderFormatChange={isReadOnly ? () => { } : handleHeaderFormatChange}
        onSave={handleSave}
        onBold={handleBold}
        onItalic={handleItalic}
        onUnderline={handleUnderline}
        onStrikethrough={handleStrikethrough}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onBulletList={handleBulletList}
        onNumberedList={handleNumberedList}
        onAlignLeft={handleAlignLeft}
        onAlignCenter={handleAlignCenter}
        onAlignRight={handleAlignRight}
        onAlignJustify={handleAlignJustify}
        onRequestSignature={isReadOnly ? undefined : handleRequestSignature}
        onOpenTemplates={isReadOnly ? undefined : templateSelector.open}
        isSaving={isSaving}
        hasUnsavedChanges={hasUnsavedChanges}
      />

      {/* Main content area like Google Docs */}
      <main
        role="main"
        aria-label="Document editor"
        className="google-docs-main"
        style={{
          display: 'flex',
          justifyContent: 'center',
          backgroundColor: '#f9fbfd',
          minHeight: 'calc(100vh - 120px)',
          padding: '20px 0'
        }}
      >
        {/* <div
          className="document-container"
          style={{
            width: isMobile ? '100%' : '8.5in',
            maxWidth: isMobile ? '100%' : '8.5in',
            minHeight: '11in',
            backgroundColor: 'white',
            boxShadow: isMobile ? 'none' : '0 1px 3px 0 rgba(60,64,67,.15), 0 4px 8px 3px rgba(60,64,67,.1)',
            borderRadius: isMobile ? '0' : '8px',
            margin: '0 auto',
            padding: isMobile ? '0.5in' : '1in',
            position: 'relative'
          }}
        > */}
          <EnhancedQuillEditor
            value={document.content}
            onChange={isReadOnly ? () => { } : handleContentChange}
            onEditorReady={handleEditorReady}
            readOnly={isReadOnly}
          />
        {/* </div> */}
      </main>

      {/* Command Palette */}
      <CommandPalette
        isOpen={commandPalette.isOpen}
        onClose={commandPalette.close}
        commands={commandPaletteCommands}
      />

      {/* Document Template Selector */}
      <DocumentTemplateSelector
        isOpen={templateSelector.isOpen}
        onClose={templateSelector.close}
        onTemplateSelect={handleTemplateSelect}
      />
    </div>
  )
}