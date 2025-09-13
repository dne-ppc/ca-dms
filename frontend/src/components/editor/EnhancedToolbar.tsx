import React from 'react'
import {
  Bold,
  Italic,
  Underline,
  Undo,
  Redo,
  Save,
  AlertCircle
} from 'lucide-react'
import { DocumentTitleInput } from './DocumentTitleInput'
import { DocumentTypeSelector } from './DocumentTypeSelector'
import { HeaderFormatSelector } from './HeaderFormatSelector'
import { AdvancedReportingButton } from './AdvancedReportingButton'
import './EnhancedToolbar.css'

interface EnhancedToolbarProps {
  documentTitle: string
  documentType: string
  headerFormat: string
  onTitleChange: (title: string) => void
  onTypeChange: (type: string) => void
  onHeaderFormatChange: (format: string) => void
  onSave: () => void
  onBold: () => void
  onItalic: () => void
  onUnderline: () => void
  onUndo: () => void
  onRedo: () => void
  isSaving?: boolean
  hasUnsavedChanges?: boolean
  className?: string
}

export const EnhancedToolbar: React.FC<EnhancedToolbarProps> = ({
  documentTitle,
  documentType,
  headerFormat,
  onTitleChange,
  onTypeChange,
  onHeaderFormatChange,
  onSave,
  onBold,
  onItalic,
  onUnderline,
  onUndo,
  onRedo,
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
        shadow-sm
        responsive-toolbar
        flex-col md:flex-row
        p-3
        gap-4
        ${className}
      `}
      style={{ width: '100%' }}
    >
      {/* Top Row - Document Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-1">
        {/* Document Title and Type */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-1">
          <DocumentTitleInput
            value={documentTitle}
            onChange={onTitleChange}
          />
          <DocumentTypeSelector
            value={documentType}
            onChange={onTypeChange}
          />
        </div>

        {/* Save Controls */}
        <div className="flex items-center gap-2">
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
            <div className="flex items-center gap-2">
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save'}
            </div>
          </button>
        </div>
      </div>

      {/* Bottom Row - Formatting Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Header Format Selector */}
        <HeaderFormatSelector
          value={headerFormat}
          onChange={onHeaderFormatChange}
        />

        {/* Formatting Buttons */}
        <div className="flex items-center gap-1 border-l border-gray-200 pl-3">
          <button
            data-testid="bold-button"
            onClick={onBold}
            className="p-2 rounded-md hover:bg-gray-100 transition-colors"
            title="Bold (Ctrl+B)"
          >
            <Bold className="h-4 w-4" />
          </button>

          <button
            data-testid="italic-button"
            onClick={onItalic}
            className="p-2 rounded-md hover:bg-gray-100 transition-colors"
            title="Italic (Ctrl+I)"
          >
            <Italic className="h-4 w-4" />
          </button>

          <button
            data-testid="underline-button"
            onClick={onUnderline}
            className="p-2 rounded-md hover:bg-gray-100 transition-colors"
            title="Underline (Ctrl+U)"
          >
            <Underline className="h-4 w-4" />
          </button>
        </div>

        {/* History Controls */}
        <div className="flex items-center gap-1 border-l border-gray-200 pl-3">
          <button
            data-testid="undo-button"
            onClick={onUndo}
            className="p-2 rounded-md hover:bg-gray-100 transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <Undo className="h-4 w-4" />
          </button>

          <button
            data-testid="redo-button"
            onClick={onRedo}
            className="p-2 rounded-md hover:bg-gray-100 transition-colors"
            title="Redo (Ctrl+Y)"
          >
            <Redo className="h-4 w-4" />
          </button>
        </div>

        {/* Advanced Reporting */}
        <div className="border-l border-gray-200 pl-3">
          <AdvancedReportingButton />
        </div>
      </div>
    </div>
  )
}