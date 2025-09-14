import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Search, Command, Zap, FileText, Save, PenTool, Download, Copy, Scissors, Redo, Undo } from 'lucide-react'

interface CommandAction {
  id: string
  label: string
  description?: string
  icon?: React.ReactNode
  shortcut?: string
  category: 'document' | 'edit' | 'format' | 'insert' | 'view' | 'help'
  action: () => void
  enabled?: boolean
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  commands: CommandAction[]
  className?: string
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  commands,
  className = ''
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const commandListRef = useRef<HTMLDivElement>(null)

  // Filter and sort commands based on search query
  const filteredCommands = useMemo(() => {
    if (!searchQuery.trim()) {
      return commands.filter(cmd => cmd.enabled !== false)
    }

    const query = searchQuery.toLowerCase()
    return commands
      .filter(cmd => cmd.enabled !== false)
      .filter(cmd =>
        cmd.label.toLowerCase().includes(query) ||
        cmd.description?.toLowerCase().includes(query) ||
        cmd.category.toLowerCase().includes(query) ||
        cmd.shortcut?.toLowerCase().includes(query)
      )
      .sort((a, b) => {
        // Prioritize exact matches in label
        const aLabelMatch = a.label.toLowerCase().startsWith(query)
        const bLabelMatch = b.label.toLowerCase().startsWith(query)
        if (aLabelMatch && !bLabelMatch) return -1
        if (!aLabelMatch && bLabelMatch) return 1
        return 0
      })
  }, [commands, searchQuery])

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandAction[]> = {}
    filteredCommands.forEach(cmd => {
      if (!groups[cmd.category]) {
        groups[cmd.category] = []
      }
      groups[cmd.category].push(cmd)
    })
    return groups
  }, [filteredCommands])

  // Reset search and selection when opened
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('')
      setSelectedIndex(0)
      // Focus the search input after a brief delay
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 100)
    }
  }, [isOpen])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault()
          onClose()
          break

        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex(prev =>
            prev < filteredCommands.length - 1 ? prev + 1 : 0
          )
          break

        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex(prev =>
            prev > 0 ? prev - 1 : filteredCommands.length - 1
          )
          break

        case 'Enter':
          e.preventDefault()
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action()
            onClose()
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, filteredCommands, selectedIndex, onClose])

  // Scroll selected item into view
  useEffect(() => {
    if (commandListRef.current && isOpen) {
      const selectedElement = commandListRef.current.querySelector(`[data-index="${selectedIndex}"]`)
      selectedElement?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      })
    }
  }, [selectedIndex, isOpen])

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'document':
        return <FileText className="h-4 w-4" />
      case 'edit':
        return <Scissors className="h-4 w-4" />
      case 'format':
        return <Zap className="h-4 w-4" />
      case 'insert':
        return <PenTool className="h-4 w-4" />
      case 'view':
        return <Search className="h-4 w-4" />
      default:
        return <Command className="h-4 w-4" />
    }
  }

  const getCategoryLabel = (category: string) => {
    return category.charAt(0).toUpperCase() + category.slice(1)
  }

  if (!isOpen) return null

  return (
    <div className={`command-palette-overlay fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center pt-[10vh] ${className}`}>
      <div className="command-palette bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[70vh] overflow-hidden">
        {/* Search header */}
        <div className="flex items-center gap-3 p-4 border-b">
          <Search className="h-5 w-5 text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setSelectedIndex(0)
            }}
            placeholder="Search commands... (Ctrl+K)"
            className="flex-1 outline-none text-lg placeholder-gray-400"
          />
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded">↑↓</kbd>
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded">Enter</kbd>
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded">Esc</kbd>
          </div>
        </div>

        {/* Commands list */}
        <div ref={commandListRef} className="max-h-96 overflow-y-auto">
          {Object.keys(groupedCommands).length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Search className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p>No commands found for "{searchQuery}"</p>
            </div>
          ) : (
            Object.entries(groupedCommands).map(([category, categoryCommands]) => (
              <div key={category}>
                {/* Category header */}
                <div className="px-4 py-2 text-xs font-medium text-gray-500 bg-gray-50 flex items-center gap-2">
                  {getCategoryIcon(category)}
                  {getCategoryLabel(category)}
                </div>

                {/* Category commands */}
                {categoryCommands.map((command, index) => {
                  const globalIndex = filteredCommands.indexOf(command)
                  return (
                    <button
                      key={command.id}
                      data-index={globalIndex}
                      onClick={() => {
                        command.action()
                        onClose()
                      }}
                      className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 text-left transition-colors ${
                        selectedIndex === globalIndex ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                      }`}
                    >
                      {/* Command icon */}
                      <div className="flex-shrink-0">
                        {command.icon || <Command className="h-4 w-4 text-gray-400" />}
                      </div>

                      {/* Command details */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900">{command.label}</div>
                        {command.description && (
                          <div className="text-sm text-gray-500 truncate">{command.description}</div>
                        )}
                      </div>

                      {/* Keyboard shortcut */}
                      {command.shortcut && (
                        <div className="flex-shrink-0 text-xs text-gray-400 font-mono">
                          {command.shortcut.split('+').map((key, i) => (
                            <span key={i}>
                              {i > 0 && ' + '}
                              <kbd className="px-1.5 py-0.5 bg-gray-100 rounded">{key}</kbd>
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t bg-gray-50 text-xs text-gray-500 text-center">
          Pro tip: Use <kbd className="px-1 py-0.5 bg-gray-200 rounded">Ctrl+K</kbd> to open command palette anytime
        </div>
      </div>
    </div>
  )
}

// Hook for command palette functionality
export const useCommandPalette = () => {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K or Cmd+K to open command palette
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen(prev => !prev)
  }
}

// Default commands for document editor
export const createDefaultEditorCommands = (callbacks: {
  onSave?: () => void
  onUndo?: () => void
  onRedo?: () => void
  onBold?: () => void
  onItalic?: () => void
  onUnderline?: () => void
  onCopy?: () => void
  onCut?: () => void
  onPaste?: () => void
  onSelectAll?: () => void
  onFind?: () => void
  onReplace?: () => void
  onRequestSignature?: () => void
  onDownloadPDF?: () => void
}): CommandAction[] => {
  return [
    {
      id: 'save',
      label: 'Save Document',
      description: 'Save the current document',
      icon: <Save className="h-4 w-4" />,
      shortcut: 'Ctrl+S',
      category: 'document',
      action: callbacks.onSave || (() => {}),
      enabled: !!callbacks.onSave
    },
    {
      id: 'undo',
      label: 'Undo',
      description: 'Undo the last action',
      icon: <Undo className="h-4 w-4" />,
      shortcut: 'Ctrl+Z',
      category: 'edit',
      action: callbacks.onUndo || (() => {}),
      enabled: !!callbacks.onUndo
    },
    {
      id: 'redo',
      label: 'Redo',
      description: 'Redo the last undone action',
      icon: <Redo className="h-4 w-4" />,
      shortcut: 'Ctrl+Y',
      category: 'edit',
      action: callbacks.onRedo || (() => {}),
      enabled: !!callbacks.onRedo
    },
    {
      id: 'bold',
      label: 'Bold',
      description: 'Make selected text bold',
      shortcut: 'Ctrl+B',
      category: 'format',
      action: callbacks.onBold || (() => {}),
      enabled: !!callbacks.onBold
    },
    {
      id: 'italic',
      label: 'Italic',
      description: 'Make selected text italic',
      shortcut: 'Ctrl+I',
      category: 'format',
      action: callbacks.onItalic || (() => {}),
      enabled: !!callbacks.onItalic
    },
    {
      id: 'underline',
      label: 'Underline',
      description: 'Make selected text underlined',
      shortcut: 'Ctrl+U',
      category: 'format',
      action: callbacks.onUnderline || (() => {}),
      enabled: !!callbacks.onUnderline
    },
    {
      id: 'copy',
      label: 'Copy',
      description: 'Copy selected content',
      icon: <Copy className="h-4 w-4" />,
      shortcut: 'Ctrl+C',
      category: 'edit',
      action: callbacks.onCopy || (() => {}),
      enabled: !!callbacks.onCopy
    },
    {
      id: 'cut',
      label: 'Cut',
      description: 'Cut selected content',
      icon: <Scissors className="h-4 w-4" />,
      shortcut: 'Ctrl+X',
      category: 'edit',
      action: callbacks.onCut || (() => {}),
      enabled: !!callbacks.onCut
    },
    {
      id: 'signature',
      label: 'Request Signature',
      description: 'Send document for digital signature',
      icon: <PenTool className="h-4 w-4" />,
      category: 'document',
      action: callbacks.onRequestSignature || (() => {}),
      enabled: !!callbacks.onRequestSignature
    },
    {
      id: 'download-pdf',
      label: 'Download PDF',
      description: 'Download document as PDF',
      icon: <Download className="h-4 w-4" />,
      category: 'document',
      action: callbacks.onDownloadPDF || (() => {}),
      enabled: !!callbacks.onDownloadPDF
    }
  ]
}