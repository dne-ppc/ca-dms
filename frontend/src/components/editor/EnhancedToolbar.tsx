import React from 'react'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Undo,
  Redo,
  Save,
  AlertCircle,
  FileText,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify
} from 'lucide-react'
import { DocumentTitleInput } from './DocumentTitleInput'
import { DocumentTypeSelector } from './DocumentTypeSelector'
import { HeaderFormatSelector } from './HeaderFormatSelector'
import { AdvancedReportingButton } from './AdvancedReportingButton'
import { DigitalSignatureButton } from './DigitalSignatureButton'
import './EnhancedToolbar.css'

interface EnhancedToolbarProps {
  documentTitle: string
  documentType: string
  headerFormat: string
  documentId?: string
  onTitleChange: (title: string) => void
  onTypeChange: (type: string) => void
  onHeaderFormatChange: (format: string) => void
  onSave: () => void
  onBold: () => void
  onItalic: () => void
  onUnderline: () => void
  onStrikethrough: () => void
  onUndo: () => void
  onRedo: () => void
  onBulletList: () => void
  onNumberedList: () => void
  onAlignLeft: () => void
  onAlignCenter: () => void
  onAlignRight: () => void
  onAlignJustify: () => void
  onRequestSignature?: (participants: any[]) => void
  onOpenTemplates?: () => void
  isSaving?: boolean
  hasUnsavedChanges?: boolean
  className?: string
}

export const EnhancedToolbar: React.FC<EnhancedToolbarProps> = ({
  documentTitle,
  documentType,
  headerFormat,
  documentId,
  onTitleChange,
  onTypeChange,
  onHeaderFormatChange,
  onSave,
  onBold,
  onItalic,
  onUnderline,
  onStrikethrough,
  onUndo,
  onRedo,
  onBulletList,
  onNumberedList,
  onAlignLeft,
  onAlignCenter,
  onAlignRight,
  onAlignJustify,
  onRequestSignature,
  onOpenTemplates,
  isSaving = false,
  hasUnsavedChanges = false,
  className = ''
}) => {
  return (
    <div
      role="toolbar"
      aria-label="Document editing toolbar"
      aria-orientation="horizontal"
      data-testid="enhanced-toolbar"
      className={`
        enhanced-toolbar
        w-full
        google-docs-style
        border-b
        bg-white
        text-gray-700
        shadow-sm
        flex flex-row
        ${className}
      `}
      style={{ width: '100%' }}
    >
      {/* Document Title and Type */}
      <DocumentTitleInput
        value={documentTitle}
        onChange={onTitleChange}
      />
      <DocumentTypeSelector
        value={documentType}
        onChange={onTypeChange}
      />


      {/* Save Controls */}
      {hasUnsavedChanges && (
        <div
          data-testid="unsaved-indicator"
          className="flex items-center gap-1 text-orange-600 text-sm"
        >
          <AlertCircle className="h-4 w-4" />
          <span>Unsaved changes</span>
        </div>
      )}

      <button
        data-testid="save-button"
        onClick={onSave}
        disabled={isSaving}
        className={`
            px-4 py-2 rounded-md text-sm font-medium transition-colors
            ${isSaving
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700'
          }
          `}
      >
        <Save className="h-4 w-4" />
        {isSaving ? 'Saving...' : 'Save'}
      </button>



      {/* Header Format Selector */}
      <HeaderFormatSelector
        value={headerFormat}
        onChange={onHeaderFormatChange}
      />

      {/* Separator */}
      <div className="h-6 w-px bg-gray-300 mx-2"></div>

      {/* Text Formatting Buttons */}
      <button
        data-testid="bold-button"
        onClick={onBold}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onBold()
          }
        }}
        className="p-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        title="Bold (Ctrl+B)"
        aria-label="Bold (Ctrl+B)"
      >
        <Bold className="h-4 w-4" />
      </button>
      

      <button
        data-testid="italic-button"
        onClick={onItalic}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onItalic()
          }
        }}
        className="p-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        title="Italic (Ctrl+I)"
        aria-label="Italic (Ctrl+I)"
      >
        <Italic className="h-4 w-4" />
      </button>

      <button
        data-testid="underline-button"
        onClick={onUnderline}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onUnderline()
          }
        }}
        className="p-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        title="Underline (Ctrl+U)"
        aria-label="Underline (Ctrl+U)"
      >
        <Underline className="h-4 w-4" />
      </button>

      <button
        data-testid="strikethrough-button"
        onClick={onStrikethrough}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onStrikethrough()
          }
        }}
        className="p-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        title="Strikethrough"
        aria-label="Strikethrough"
      >
        <Strikethrough className="h-4 w-4" />
      </button>

      {/* Separator */}
      <div className="h-6 w-px bg-gray-300 mx-2"></div>

      {/* History Controls */}
      <button
        data-testid="undo-button"
        onClick={onUndo}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onUndo()
          }
        }}
        className="p-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        title="Undo (Ctrl+Z)"
        aria-label="Undo (Ctrl+Z)"
      >
        <Undo className="h-4 w-4" />
      </button>

      <button
        data-testid="redo-button"
        onClick={onRedo}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onRedo()
          }
        }}
        className="p-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        title="Redo (Ctrl+Y)"
        aria-label="Redo (Ctrl+Y)"
      >
        <Redo className="h-4 w-4" />
      </button>

      {/* Separator */}
      <div className="h-6 w-px bg-gray-300 mx-2"></div>

      {/* List Controls */}
      <button
        data-testid="bullet-list-button"
        onClick={onBulletList}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onBulletList()
          }
        }}
        className="p-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        title="Bullet List"
        aria-label="Bullet List"
      >
        <List className="h-4 w-4" />
      </button>

      <button
        data-testid="numbered-list-button"
        onClick={onNumberedList}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onNumberedList()
          }
        }}
        className="p-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        title="Numbered List"
        aria-label="Numbered List"
      >
        <ListOrdered className="h-4 w-4" />
      </button>

      {/* Separator */}
      <div className="h-6 w-px bg-gray-300 mx-2"></div>

      {/* Alignment Controls */}
      <button
        data-testid="align-left-button"
        onClick={onAlignLeft}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onAlignLeft()
          }
        }}
        className="p-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        title="Align Left"
        aria-label="Align Left"
      >
        <AlignLeft className="h-4 w-4" />
      </button>

      <button
        data-testid="align-center-button"
        onClick={onAlignCenter}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onAlignCenter()
          }
        }}
        className="p-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        title="Align Center"
        aria-label="Align Center"
      >
        <AlignCenter className="h-4 w-4" />
      </button>

      <button
        data-testid="align-right-button"
        onClick={onAlignRight}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onAlignRight()
          }
        }}
        className="p-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        title="Align Right"
        aria-label="Align Right"
      >
        <AlignRight className="h-4 w-4" />
      </button>

      <button
        data-testid="align-justify-button"
        onClick={onAlignJustify}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onAlignJustify()
          }
        }}
        className="p-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        title="Align Justify"
        aria-label="Align Justify"
      >
        <AlignJustify className="h-4 w-4" />
      </button>

      {/* Separator */}
      <div className="h-6 w-px bg-gray-300 mx-2"></div>

      {/* Document Templates */}
      {onOpenTemplates && (
        <button
          data-testid="templates-button"
          onClick={onOpenTemplates}
          className="p-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          title="Browse Document Templates (Ctrl+T)"
          aria-label="Browse Document Templates (Ctrl+T)"
        >
          <FileText className="h-4 w-4" />
        </button>
      )}

      {/* Digital Signature */}
      <DigitalSignatureButton
        documentId={documentId}
        onRequestSignature={onRequestSignature}
        disabled={!documentId || isSaving}
      />


      {/* Advanced Reporting */}
      <AdvancedReportingButton />
    </div>
  )
}