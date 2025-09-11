import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import './PDFPreview.css';

// Set up the worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;

interface PDFPreviewProps {
  pdfUrl: string;
  className?: string;
  onLoadSuccess?: (pdf: PDFDocumentProxy) => void;
  onLoadError?: (error: Error) => void;
  scale?: number;
}

interface FormField {
  id: string;
  type: string;
  rect: number[];
  name: string;
  pageNum: number;
}

interface PDFPreviewState {
  pdf: PDFDocumentProxy | null;
  currentPage: number;
  numPages: number;
  loading: boolean;
  error: string | null;
  formFields: FormField[];
}

const PDFPreview: React.FC<PDFPreviewProps> = ({
  pdfUrl,
  className = '',
  onLoadSuccess,
  onLoadError,
  scale = 1.0
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<PDFPreviewState>({
    pdf: null,
    currentPage: 1,
    numPages: 0,
    loading: false,
    error: null,
    formFields: []
  });

  const loadPDF = useCallback(async () => {
    if (!pdfUrl) {
      setState(prev => ({
        ...prev,
        error: 'No PDF URL provided',
        loading: false
      }));
      return;
    }

    setState(prev => ({
      ...prev,
      loading: true,
      error: null
    }));

    try {
      const loadingTask = pdfjsLib.getDocument(pdfUrl);
      const pdf = await loadingTask.promise;

      setState(prev => ({
        ...prev,
        pdf,
        numPages: pdf.numPages,
        loading: false,
        error: null,
        formFields: [] // Clear form fields for new PDF
      }));

      onLoadSuccess?.(pdf);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load PDF';
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }));

      onLoadError?.(error instanceof Error ? error : new Error(errorMessage));
    }
  }, [pdfUrl, onLoadSuccess, onLoadError]);

  const detectFormFields = useCallback(async (page: PDFPageProxy, pageNum: number): Promise<FormField[]> => {
    try {
      const annotations = await page.getAnnotations();
      
      return annotations
        .filter((annotation: any) => annotation.subtype === 'Widget')
        .map((annotation: any, index: number) => ({
          id: annotation.id || `field-${pageNum}-${index}`,
          type: annotation.fieldType || 'text',
          rect: annotation.rect,
          name: annotation.fieldName || annotation.alternativeText || `Field ${index + 1}`,
          pageNum: pageNum
        }));
    } catch (error) {
      console.warn(`Error detecting form fields on page ${pageNum}:`, error);
      return [];
    }
  }, []);

  const convertPDFCoordinatesToScreen = useCallback((rect: number[], viewport: any) => {
    // PDF coordinates: [x1, y1, x2, y2] where (0,0) is bottom-left
    // Screen coordinates: (0,0) is top-left
    const [x1, y1, x2, y2] = rect;
    const left = x1 * scale;
    const top = (viewport.height - y2) * scale; // Flip Y coordinate
    const width = (x2 - x1) * scale;
    const height = (y2 - y1) * scale;
    
    return { left, top, width, height };
  }, [scale]);

  const renderFormFieldOverlay = useCallback((pageContainer: HTMLElement, formFields: FormField[], viewport: any) => {
    // Remove existing overlay
    const existingOverlay = pageContainer.querySelector('.form-field-overlay');
    if (existingOverlay) {
      existingOverlay.remove();
    }

    if (formFields.length === 0) {
      return;
    }

    // Create overlay container
    const overlay = document.createElement('div');
    overlay.className = 'form-field-overlay';
    overlay.setAttribute('data-testid', 'form-field-overlay');
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '10';

    // Create indicators for each form field
    formFields.forEach(field => {
      const indicator = document.createElement('div');
      indicator.className = `form-field-indicator form-field-${field.type}`;
      indicator.setAttribute('data-testid', `form-field-${field.id}`);
      indicator.setAttribute('title', field.name);
      
      const coords = convertPDFCoordinatesToScreen(field.rect, viewport);
      indicator.style.position = 'absolute';
      indicator.style.left = `${coords.left}px`;
      indicator.style.top = `${coords.top}px`;
      indicator.style.width = `${coords.width}px`;
      indicator.style.height = `${coords.height}px`;
      indicator.style.border = '2px solid rgba(0, 123, 255, 0.7)';
      indicator.style.backgroundColor = 'rgba(0, 123, 255, 0.1)';
      indicator.style.boxSizing = 'border-box';
      
      // Different styling for different field types
      switch (field.type) {
        case 'signature':
          indicator.style.borderColor = 'rgba(255, 0, 0, 0.7)';
          indicator.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
          break;
        case 'text':
          indicator.style.borderColor = 'rgba(0, 123, 255, 0.7)';
          indicator.style.backgroundColor = 'rgba(0, 123, 255, 0.1)';
          break;
        case 'textarea':
          indicator.style.borderColor = 'rgba(40, 167, 69, 0.7)';
          indicator.style.backgroundColor = 'rgba(40, 167, 69, 0.1)';
          break;
      }
      
      overlay.appendChild(indicator);
    });

    pageContainer.appendChild(overlay);
  }, [convertPDFCoordinatesToScreen]);

  const renderPage = useCallback(async (pageNum: number): Promise<void> => {
    if (!state.pdf || !containerRef.current) return;

    try {
      const page: PDFPageProxy = await state.pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      // Detect form fields for this page
      const pageFormFields = await detectFormFields(page, pageNum);
      
      // Update form fields in state
      setState(prev => ({
        ...prev,
        formFields: [...prev.formFields.filter(f => f.pageNum !== pageNum), ...pageFormFields]
      }));

      // Create canvas element
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) {
        throw new Error('Could not get canvas context');
      }

      canvas.height = viewport.height;
      canvas.width = viewport.width;
      canvas.setAttribute('data-testid', `pdf-canvas-${pageNum}`);
      canvas.className = 'pdf-page-canvas';

      // Render PDF page into canvas context
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      await page.render(renderContext).promise;

      // Find or create page container
      let pageContainer = containerRef.current.querySelector(`[data-page="${pageNum}"]`) as HTMLDivElement;
      if (!pageContainer) {
        pageContainer = document.createElement('div');
        pageContainer.className = 'pdf-page-container';
        pageContainer.setAttribute('data-page', pageNum.toString());
        pageContainer.style.position = 'relative'; // Enable absolute positioning for overlays
        
        // Add page info
        const pageInfo = document.createElement('div');
        pageInfo.className = 'pdf-page-info';
        pageInfo.textContent = `Page ${pageNum} of ${state.numPages}`;
        
        pageContainer.appendChild(pageInfo);
        containerRef.current.appendChild(pageContainer);
      }

      // Replace existing canvas or add new one
      const existingCanvas = pageContainer.querySelector('canvas');
      if (existingCanvas) {
        pageContainer.replaceChild(canvas, existingCanvas);
      } else {
        pageContainer.appendChild(canvas);
      }

      // Render form field overlay for this page
      const currentPageFormFields = state.formFields.filter(f => f.pageNum === pageNum);
      renderFormFieldOverlay(pageContainer, currentPageFormFields, viewport);
    } catch (error) {
      console.error(`Error rendering page ${pageNum}:`, error);
    }
  }, [state.pdf, scale, state.numPages, state.formFields, detectFormFields, renderFormFieldOverlay]);

  const renderAllPages = useCallback(async () => {
    if (!state.pdf || state.numPages === 0) return;

    // Clear existing content
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }

    // Render all pages
    for (let pageNum = 1; pageNum <= state.numPages; pageNum++) {
      await renderPage(pageNum);
    }
  }, [state.pdf, state.numPages, renderPage]);

  // Load PDF when URL changes
  useEffect(() => {
    loadPDF();
  }, [loadPDF]);

  // Render pages when PDF is loaded
  useEffect(() => {
    if (state.pdf && state.numPages > 0) {
      renderAllPages();
    }
  }, [state.pdf, state.numPages, renderAllPages]);

  if (state.loading) {
    return (
      <div className={`pdf-preview ${className}`} data-testid="pdf-preview-container">
        <div className="pdf-loading-container" data-testid="pdf-loading">
          <div className="pdf-spinner"></div>
          <div className="pdf-loading-text">Loading PDF...</div>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className={`pdf-preview ${className}`} data-testid="pdf-preview-container">
        <div className="pdf-error-container" data-testid="pdf-error">
          <div className="pdf-error-icon">⚠️</div>
          <div className="pdf-error-text">{state.error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`pdf-preview ${className}`} data-testid="pdf-preview-container">
      <div className="pdf-document-container" ref={containerRef}>
        {state.numPages > 0 && (
          <div className="pdf-document-info">
            <div className="pdf-page-count">
              Page 1 of {state.numPages}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PDFPreview;