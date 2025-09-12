import React, { useEffect } from 'react'
import PDFPreview from './PDFPreview'
import './PDFModal.css'

interface PDFModalProps {
  isOpen: boolean
  onClose: () => void
  pdfUrl: string
  documentTitle?: string
  documentId?: string
  onDownloadSuccess?: (result: { filename: string; size: number }) => void
  onDownloadError?: (error: Error) => void
}

const PDFModal: React.FC<PDFModalProps> = ({
  isOpen,
  onClose,
  pdfUrl,
  documentTitle = 'Document',
  documentId,
  onDownloadSuccess,
  onDownloadError
}) => {
  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden' // Prevent background scrolling
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const documentMetadata = documentId ? {
    id: documentId,
    title: documentTitle
  } : undefined

  return (
    <div 
      className="pdf-modal-backdrop" 
      onClick={handleBackdropClick}
      data-testid="pdf-modal-backdrop"
    >
      <div className="pdf-modal-container" data-testid="pdf-modal-container">
        <div className="pdf-modal-header">
          <h2 className="pdf-modal-title">{documentTitle} - PDF Preview</h2>
          <button 
            className="pdf-modal-close"
            onClick={onClose}
            aria-label="Close PDF preview"
            data-testid="pdf-modal-close"
          >
            ✕
          </button>
        </div>
        
        <div className="pdf-modal-content">
          <PDFPreview 
            pdfUrl={pdfUrl}
            className="modal-pdf-preview"
            scale={0.8} // Slightly smaller scale for modal view
            documentMetadata={documentMetadata}
            onDownloadSuccess={onDownloadSuccess}
            onDownloadError={onDownloadError}
          />
        </div>
      </div>
    </div>
  )
}

export default PDFModal