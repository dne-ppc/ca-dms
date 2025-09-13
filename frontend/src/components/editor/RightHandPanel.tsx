import React, { useState, useEffect, useMemo } from 'react'
import { tocService, TOCHeader } from '../../services/tocService'
import { VersionHistory } from './VersionHistory'
import { DocumentVersion } from '../../services/versionService'

export interface Document {
  id: string
  title: string
  content: string
}

interface RightHandPanelProps {
  document: Document
  onHeaderClick?: (headerId: string) => void
  onVersionSelect?: (version: DocumentVersion) => void
  onVersionRestore?: () => void
  collapsed?: boolean
  onToggleCollapse?: (collapsed: boolean) => void
  selectedVersionId?: string
}

type TabType = 'toc' | 'versions'

export const RightHandPanel: React.FC<RightHandPanelProps> = ({
  document,
  onHeaderClick,
  onVersionSelect,
  onVersionRestore,
  collapsed = false,
  onToggleCollapse,
  selectedVersionId
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('toc')
  const [tocError, setTocError] = useState<string | null>(null)

  // Extract headers from document content with error handling
  const headers = useMemo(() => {
    try {
      setTocError(null)
      return tocService.extractHeaders(document.content)
    } catch (error) {
      setTocError('Failed to load table of contents')
      console.error('TOC extraction error:', error)
      return []
    }
  }, [document.content])

  const handleTabClick = (tab: TabType) => {
    setActiveTab(tab)
  }

  const handleTabKeyDown = (event: React.KeyboardEvent, tab: TabType) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setActiveTab(tab)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      const nextTab = tab === 'toc' ? 'versions' : 'toc'
      setActiveTab(nextTab)
      // Focus the next tab
      const nextTabElement = event.currentTarget.parentElement?.querySelector(`[data-tab="${nextTab}"]`) as HTMLElement
      nextTabElement?.focus()
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      const prevTab = tab === 'toc' ? 'versions' : 'toc'
      setActiveTab(prevTab)
      // Focus the previous tab
      const prevTabElement = event.currentTarget.parentElement?.querySelector(`[data-tab="${prevTab}"]`) as HTMLElement
      prevTabElement?.focus()
    }
  }

  const handleHeaderClick = (headerId: string) => {
    onHeaderClick?.(headerId)
  }

  const handleToggleCollapse = () => {
    onToggleCollapse?.(!collapsed)
  }

  if (collapsed) {
    return (
      <div className="w-8 h-full bg-gray-50 border-l border-gray-200 flex items-start justify-center pt-4">
        <button
          onClick={handleToggleCollapse}
          aria-label="Expand panel"
          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
          </svg>
        </button>
      </div>
    )
  }

  return (
    <div className="w-80 h-full bg-white border-l border-gray-200 flex flex-col">
      {/* Header with collapse button */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Navigation</h2>
        {onToggleCollapse && (
          <button
            onClick={handleToggleCollapse}
            aria-label="Collapse panel"
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/>
            </svg>
          </button>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav role="tablist" aria-label="Document navigation" className="flex">
          <button
            role="tab"
            data-tab="toc"
            aria-selected={activeTab === 'toc'}
            aria-controls="toc-panel"
            className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'toc'
                ? 'border-blue-500 text-blue-600 bg-blue-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => handleTabClick('toc')}
            onKeyDown={(e) => handleTabKeyDown(e, 'toc')}
          >
            Table of Contents
          </button>
          <button
            role="tab"
            data-tab="versions"
            aria-selected={activeTab === 'versions'}
            aria-controls="versions-panel"
            className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'versions'
                ? 'border-blue-500 text-blue-600 bg-blue-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => handleTabClick('versions')}
            onKeyDown={(e) => handleTabKeyDown(e, 'versions')}
          >
            Version History
          </button>
        </nav>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-hidden">
        {/* Table of Contents Panel */}
        {activeTab === 'toc' && (
          <div
            role="tabpanel"
            id="toc-panel"
            aria-labelledby="toc-tab"
            aria-label="Table of Contents"
            className="h-full overflow-y-auto"
          >
            {tocError ? (
              <div className="p-4">
                <div className="text-red-600 text-sm">{tocError}</div>
              </div>
            ) : headers.length === 0 ? (
              <div className="p-4">
                <div className="text-gray-500 text-sm">No table of contents available</div>
              </div>
            ) : (
              <div className="p-4">
                <ul className="space-y-1" role="list">
                  {headers.map((header) => (
                    <li key={header.id}>
                      <button
                        onClick={() => handleHeaderClick(header.id)}
                        className={`w-full text-left p-2 rounded hover:bg-gray-100 transition-colors ${
                          header.level === 1 ? 'font-semibold text-gray-900' :
                          header.level === 2 ? 'font-medium text-gray-700 pl-4' :
                          'text-gray-600 pl-8'
                        }`}
                        style={{ paddingLeft: `${(header.level - 1) * 16 + 8}px` }}
                        title={`Navigate to ${header.text}`}
                      >
                        {header.text}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Version History Panel */}
        {activeTab === 'versions' && (
          <div
            role="tabpanel"
            id="versions-panel"
            aria-labelledby="versions-tab"
            aria-label="Version History"
            aria-live="polite"
            className="h-full overflow-y-auto"
          >
            <VersionHistory
              documentId={document.id}
              onVersionSelect={onVersionSelect}
              onVersionRestore={onVersionRestore}
              selectedVersionId={selectedVersionId}
            />
          </div>
        )}
      </div>
    </div>
  )
}