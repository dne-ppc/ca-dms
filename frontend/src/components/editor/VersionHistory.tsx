import React, { useState, useEffect, useCallback } from 'react'
import { versionService, DocumentVersion } from '../../services/versionService'

interface VersionHistoryProps {
  documentId: string
  onVersionSelect?: (version: DocumentVersion) => void
  onVersionRestore?: () => void
  selectedVersionId?: string
}

interface ConfirmationDialogProps {
  isOpen: boolean
  version: DocumentVersion | null
  onConfirm: () => void
  onCancel: () => void
}

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  version,
  onConfirm,
  onCancel
}) => {
  if (!isOpen || !version) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">Restore Version</h3>
        <p className="text-gray-600 mb-6">
          Are you sure you want to restore version {version.version} to head? This will create a new version as the current head.
        </p>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Restore
          </button>
        </div>
      </div>
    </div>
  )
}

export const VersionHistory: React.FC<VersionHistoryProps> = ({
  documentId,
  onVersionSelect,
  onVersionRestore,
  selectedVersionId
}) => {
  const [versions, setVersions] = useState<DocumentVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    version: DocumentVersion | null
  }>({
    isOpen: false,
    version: null
  })
  const [restoring, setRestoring] = useState(false)

  const fetchVersions = useCallback(async () => {
    if (!documentId) return

    try {
      setLoading(true)
      setError(null)
      const fetchedVersions = await versionService.fetchVersionHistory(documentId)
      const sortedVersions = versionService.sortVersionsByDate(fetchedVersions, 'desc')
      setVersions(sortedVersions)
    } catch (err) {
      setError('Failed to load version history')
      console.error('Error fetching versions:', err)
    } finally {
      setLoading(false)
    }
  }, [documentId])

  useEffect(() => {
    fetchVersions()
  }, [fetchVersions])

  const handleVersionClick = (version: DocumentVersion) => {
    onVersionSelect?.(version)
  }

  const handleRestoreClick = (version: DocumentVersion) => {
    setConfirmDialog({
      isOpen: true,
      version
    })
  }

  const handleRestoreConfirm = async () => {
    if (!confirmDialog.version) return

    try {
      setRestoring(true)
      await versionService.restoreVersion(documentId, confirmDialog.version.id)
      onVersionRestore?.()
      setConfirmDialog({ isOpen: false, version: null })
      // Refresh version list
      await fetchVersions()
    } catch (err) {
      setError('Failed to restore version')
      console.error('Error restoring version:', err)
    } finally {
      setRestoring(false)
    }
  }

  const handleRestoreCancel = () => {
    setConfirmDialog({ isOpen: false, version: null })
  }

  const getVersionPreview = (version: DocumentVersion) => {
    return versionService.generateContentPreview(version)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="p-4">
        <h3 className="text-lg font-semibold mb-4">Version History</h3>
        <div className="text-gray-500">Loading versions...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4">
        <h3 className="text-lg font-semibold mb-4">Version History</h3>
        <div className="text-red-600 mb-4">{error}</div>
        <button
          onClick={fetchVersions}
          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    )
  }

  if (versions.length === 0) {
    return (
      <div className="p-4">
        <h3 className="text-lg font-semibold mb-4">Version History</h3>
        <div className="text-gray-500">No version history available</div>
      </div>
    )
  }

  return (
    <>
      <div className="p-4" role="region" aria-label="Version History">
        <h3 className="text-lg font-semibold mb-4">Version History</h3>

        <ul className="space-y-3" role="list" aria-label="Document versions">
          {versions.map((version) => {
            const preview = getVersionPreview(version)
            const isSelected = version.id === selectedVersionId
            const isHead = version.isHead

            return (
              <li key={version.id}>
                <div
                  className={`version-item p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                    isHead ? 'head-version border-blue-500 bg-blue-50' : 'border-gray-200'
                  } ${isSelected ? 'selected ring-2 ring-blue-300' : ''}`}
                  onClick={() => handleVersionClick(version)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleVersionClick(version)
                    }
                  }}
                  aria-label={`Select version ${version.version}${isHead ? ' (current)' : ''}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium text-gray-900">
                        v{version.version}{isHead ? ' (Current)' : ''}
                      </h4>
                      <p className="text-sm text-gray-600">{version.author}</p>
                      <p className="text-xs text-gray-500">{formatDate(version.createdAt)}</p>
                    </div>
                    {!isHead && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRestoreClick(version)
                        }}
                        title="Restore this version"
                        aria-label={`Restore version ${version.version} to head`}
                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                        disabled={restoring}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
                        </svg>
                      </button>
                    )}
                  </div>

                  <div className="text-sm text-gray-700 mb-2">
                    {version.changesSummary}
                  </div>

                  {isSelected && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="text-sm text-gray-600">
                        <p className="mb-2">{preview.excerpt}</p>
                        <div className="flex space-x-4 text-xs text-gray-500">
                          <span>{preview.wordCount} words</span>
                          <span>{preview.headerCount} headers</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        version={confirmDialog.version}
        onConfirm={handleRestoreConfirm}
        onCancel={handleRestoreCancel}
      />
    </>
  )
}