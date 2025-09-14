import React, { useEffect, useCallback } from 'react'
import { markdownService } from '../../services/markdownService'
import type { HeaderFormat } from '../../services/markdownService'

interface FormatControlsProps {
  editor: any // Quill editor instance
  headerFormat: string
  onHeaderFormatChange: (format: string) => void
}

export const FormatControls: React.FC<FormatControlsProps> = ({
  editor,
  headerFormat,
  onHeaderFormatChange
}) => {
  // Apply header formatting to current selection/line
  const applyHeaderFormat = useCallback((format: HeaderFormat) => {
    if (!editor) return

    const selection = editor.getSelection()
    if (!selection) return

    // Get current line
    const currentLine = editor.getLine(selection.index)
    if (!currentLine || !currentLine[0]) return

    const lineText = currentLine[0].domNode.textContent || ''
    const lineStart = currentLine[1]
    const lineLength = lineText.length

    // Parse current line to check if it's already formatted
    const parsed = markdownService.parseMarkdown(lineText)

    // Generate new markdown text
    const newText = markdownService.convertToMarkdown(parsed.text, format)

    // Replace the entire line
    editor.deleteText(lineStart, lineLength)
    editor.insertText(lineStart, newText)

    // Apply Quill formatting based on header level
    if (format !== 'normal') {
      const headerLevel = markdownService.formatToLevel(format)
      editor.formatLine(lineStart, 1, 'header', headerLevel)
    } else {
      // Remove header formatting
      editor.formatLine(lineStart, 1, 'header', false)
    }

    // Update cursor position
    editor.setSelection(lineStart + newText.length)

  }, [editor])

  // Detect current format based on cursor position
  const detectCurrentFormat = useCallback(() => {
    if (!editor) return

    const selection = editor.getSelection()
    if (!selection) return

    try {
      // Get current line
      const currentLine = editor.getLine(selection.index)
      if (!currentLine || !currentLine[0]) return

      const lineText = currentLine[0].domNode.textContent || ''
      const parsed = markdownService.parseMarkdown(lineText)

      // Update header format if it differs from current
      if (parsed.format !== headerFormat) {
        onHeaderFormatChange(parsed.format)
      }
    } catch (error) {
      // Silently handle any errors in format detection
      console.debug('Format detection error:', error)
    }
  }, [editor, headerFormat, onHeaderFormatChange])

  // Listen to selection changes to detect current format
  useEffect(() => {
    if (!editor) return

    const handleSelectionChange = () => {
      detectCurrentFormat()
    }

    // Listen to both selection and text changes
    editor.on('selection-change', handleSelectionChange)
    editor.on('text-change', handleSelectionChange)

    return () => {
      editor.off('selection-change', handleSelectionChange)
      editor.off('text-change', handleSelectionChange)
    }
  }, [editor, detectCurrentFormat])

  // Apply formatting when headerFormat changes externally
  useEffect(() => {
    if (headerFormat && headerFormat !== 'normal' && editor) {
      try {
        applyHeaderFormat(headerFormat as HeaderFormat)
      } catch (error) {
        console.debug('Header format application error:', error)
      }
    }
  }, [headerFormat, applyHeaderFormat, editor])

  // Format controls don't render UI - they just manage editor state
  return null
}

// Hook for easier integration with document editor
export const useFormatControls = (editor: any) => {
  const [headerFormat, setHeaderFormat] = React.useState<string>('normal')

  const FormatControlsComponent = React.useCallback(() => (
    <FormatControls
      editor={editor}
      headerFormat={headerFormat}
      onHeaderFormatChange={setHeaderFormat}
    />
  ), [editor, headerFormat])

  return {
    headerFormat,
    setHeaderFormat,
    FormatControlsComponent
  }
}