import React, { useState, useEffect, useCallback } from 'react'
import { Clock, Save, AlertCircle, CheckCircle } from 'lucide-react'

interface AutoSaveProps {
  document: {
    id: string
    title: string
    content: string
    type: string
  }
  onSave: (document: any) => Promise<void>
  enabled?: boolean
  intervalSeconds?: number
  onToggle?: (enabled: boolean) => void
  className?: string
}

interface AutoSaveStatus {
  status: 'idle' | 'saving' | 'saved' | 'error'
  lastSaved: Date | null
  lastSaveAttempt: Date | null
  error?: string
}

export const AutoSave: React.FC<AutoSaveProps> = ({
  document,
  onSave,
  enabled = true,
  intervalSeconds = 30,
  onToggle,
  className = ''
}) => {
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>({
    status: 'idle',
    lastSaved: null,
    lastSaveAttempt: null
  })
  const [lastContent, setLastContent] = useState(document.content)
  const [lastTitle, setLastTitle] = useState(document.title)

  // Check if document has changes
  const hasChanges = useCallback(() => {
    return document.content !== lastContent || document.title !== lastTitle
  }, [document.content, document.title, lastContent, lastTitle])

  // Perform auto-save
  const performAutoSave = useCallback(async () => {
    if (!enabled || !hasChanges() || !document.id) {
      return
    }

    setAutoSaveStatus(prev => ({
      ...prev,
      status: 'saving',
      lastSaveAttempt: new Date()
    }))

    try {
      await onSave(document)

      setAutoSaveStatus(prev => ({
        ...prev,
        status: 'saved',
        lastSaved: new Date(),
        error: undefined
      }))

      // Update last saved content
      setLastContent(document.content)
      setLastTitle(document.title)

      // Reset to idle after 2 seconds
      setTimeout(() => {
        setAutoSaveStatus(prev => ({ ...prev, status: 'idle' }))
      }, 2000)

    } catch (error) {
      setAutoSaveStatus(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Auto-save failed'
      }))

      // Reset to idle after 5 seconds
      setTimeout(() => {
        setAutoSaveStatus(prev => ({ ...prev, status: 'idle' }))
      }, 5000)
    }
  }, [enabled, hasChanges, document, onSave, lastContent, lastTitle])

  // Auto-save timer
  useEffect(() => {
    if (!enabled || !hasChanges()) {
      return
    }

    const timer = setTimeout(() => {
      performAutoSave()
    }, intervalSeconds * 1000)

    return () => clearTimeout(timer)
  }, [enabled, hasChanges, performAutoSave, intervalSeconds, document.content, document.title])

  // Update document reference when it changes
  useEffect(() => {
    if (!hasChanges()) {
      setLastContent(document.content)
      setLastTitle(document.title)
    }
  }, [document.content, document.title, hasChanges])

  const getStatusIcon = () => {
    switch (autoSaveStatus.status) {
      case 'saving':
        return <Clock className="h-3 w-3 animate-spin" />
      case 'saved':
        return <CheckCircle className="h-3 w-3 text-green-600" />
      case 'error':
        return <AlertCircle className="h-3 w-3 text-red-600" />
      default:
        return <Save className="h-3 w-3" />
    }
  }

  const getStatusText = () => {
    switch (autoSaveStatus.status) {
      case 'saving':
        return 'Auto-saving...'
      case 'saved':
        return 'Auto-saved'
      case 'error':
        return `Error: ${autoSaveStatus.error}`
      default:
        if (autoSaveStatus.lastSaved) {
          const timeAgo = Math.round((Date.now() - autoSaveStatus.lastSaved.getTime()) / 1000)
          if (timeAgo < 60) {
            return `Saved ${timeAgo}s ago`
          } else if (timeAgo < 3600) {
            return `Saved ${Math.round(timeAgo / 60)}m ago`
          } else {
            return `Saved ${autoSaveStatus.lastSaved.toLocaleTimeString()}`
          }
        }
        return hasChanges() ? 'Unsaved changes' : 'All changes saved'
    }
  }

  const getStatusColor = () => {
    switch (autoSaveStatus.status) {
      case 'saving':
        return 'text-blue-600'
      case 'saved':
        return 'text-green-600'
      case 'error':
        return 'text-red-600'
      default:
        return hasChanges() ? 'text-orange-600' : 'text-gray-600'
    }
  }

  return (
    <div className={`auto-save-indicator flex items-center gap-2 ${className}`}>
      {/* Auto-save toggle */}
      <div className="flex items-center gap-1">
        <label className="flex items-center gap-1 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggle?.(e.target.checked)}
            className="w-3 h-3"
          />
          <span className="text-gray-600">Auto-save</span>
        </label>
      </div>

      {/* Status indicator */}
      <div className={`flex items-center gap-1 text-xs ${getStatusColor()}`}>
        {getStatusIcon()}
        <span className="hidden sm:inline">{getStatusText()}</span>
      </div>

      {/* Save interval indicator for enabled state */}
      {enabled && (
        <div className="text-xs text-gray-500 hidden md:block">
          ({intervalSeconds}s)
        </div>
      )}

      {/* Manual save button for when auto-save is disabled */}
      {!enabled && hasChanges() && (
        <button
          onClick={performAutoSave}
          disabled={autoSaveStatus.status === 'saving'}
          className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          title="Save manually"
        >
          {autoSaveStatus.status === 'saving' ? 'Saving...' : 'Save'}
        </button>
      )}
    </div>
  )
}

// Hook for auto-save functionality
export const useAutoSave = (
  document: any,
  onSave: (doc: any) => Promise<void>,
  options: {
    enabled?: boolean
    intervalSeconds?: number
  } = {}
) => {
  const { enabled = true, intervalSeconds = 30 } = options
  const [isEnabled, setIsEnabled] = useState(enabled)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  return {
    isEnabled,
    setIsEnabled,
    status,
    AutoSaveComponent: (props: Partial<AutoSaveProps>) => (
      <AutoSave
        document={document}
        onSave={onSave}
        enabled={isEnabled}
        intervalSeconds={intervalSeconds}
        onToggle={setIsEnabled}
        {...props}
      />
    )
  }
}