import React, { useState, useRef, useEffect, useCallback } from 'react';
import PDFPreview from './PDFPreview';
import './SideBySidePreview.css';

interface SideBySidePreviewProps {
  documentContent: string;
  pdfUrl: string;
  enableSyncScroll?: boolean;
  minPanelWidth?: number;
  initialSplit?: number; // Percentage (0-100) for initial split position
  onPanelResize?: (sizes: { documentWidth: number; pdfWidth: number }) => void;
  className?: string;
}


type ViewMode = 'document' | 'pdf';

const SideBySidePreview: React.FC<SideBySidePreviewProps> = ({
  documentContent,
  pdfUrl,
  enableSyncScroll = true,
  minPanelWidth = 200,
  initialSplit = 50,
  onPanelResize,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const documentPanelRef = useRef<HTMLDivElement>(null);
  const pdfPanelRef = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  
  const [splitPosition, setSplitPosition] = useState(initialSplit);
  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [activeView, setActiveView] = useState<ViewMode>('document');
  const [syncScrolling, setSyncScrolling] = useState(false);

  // Check if screen is mobile sized
  const checkMobileScreen = useCallback(() => {
    const mobile = window.innerWidth <= 768;
    setIsMobile(mobile);
  }, []);

  // Handle window resize
  useEffect(() => {
    checkMobileScreen();
    window.addEventListener('resize', checkMobileScreen);
    
    return () => {
      window.removeEventListener('resize', checkMobileScreen);
    };
  }, [checkMobileScreen]);

  // Set up resize observer to track panel dimensions
  useEffect(() => {
    if (!containerRef.current || !onPanelResize) return;

    resizeObserverRef.current = new ResizeObserver((entries) => {
      const containerEntry = entries[0];
      if (containerEntry) {
        const containerWidth = containerEntry.contentRect.width;
        const documentWidth = (containerWidth * splitPosition) / 100;
        const pdfWidth = containerWidth - documentWidth;
        
        onPanelResize({ documentWidth, pdfWidth });
      }
    });

    resizeObserverRef.current.observe(containerRef.current);

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
    };
  }, [splitPosition, onPanelResize]);

  // Handle divider drag start
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const mouseX = e.clientX - containerRect.left;
      
      // Calculate new split percentage
      let newSplit = (mouseX / containerWidth) * 100;
      
      // Apply minimum width constraints
      const minSplitLeft = (minPanelWidth / containerWidth) * 100;
      const minSplitRight = 100 - (minPanelWidth / containerWidth) * 100;
      
      newSplit = Math.max(minSplitLeft, Math.min(newSplit, minSplitRight));
      
      setSplitPosition(newSplit);
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [minPanelWidth]);

  // Synchronized scrolling handler
  const handleScroll = useCallback((source: 'document' | 'pdf') => {
    if (!enableSyncScroll || syncScrolling) return;
    
    const documentPanel = documentPanelRef.current;
    const pdfPanel = pdfPanelRef.current;
    
    if (!documentPanel || !pdfPanel) return;
    
    setSyncScrolling(true);
    
    if (source === 'document') {
      const scrollPercentage = documentPanel.scrollTop / (documentPanel.scrollHeight - documentPanel.clientHeight);
      const targetScrollTop = scrollPercentage * (pdfPanel.scrollHeight - pdfPanel.clientHeight);
      pdfPanel.scrollTop = targetScrollTop;
    } else {
      const scrollPercentage = pdfPanel.scrollTop / (pdfPanel.scrollHeight - pdfPanel.clientHeight);
      const targetScrollTop = scrollPercentage * (documentPanel.scrollHeight - documentPanel.clientHeight);
      documentPanel.scrollTop = targetScrollTop;
    }
    
    // Reset sync flag after a brief delay
    setTimeout(() => setSyncScrolling(false), 50);
  }, [enableSyncScroll, syncScrolling]);

  // Handle view toggle for mobile
  const handleViewToggle = useCallback((view: ViewMode) => {
    setActiveView(view);
  }, []);

  const containerClasses = [
    'side-by-side-preview',
    className,
    isMobile ? 'responsive-mobile' : 'responsive-desktop',
    isDragging ? 'dragging' : ''
  ].filter(Boolean).join(' ');

  if (isMobile) {
    return (
      <div 
        className={containerClasses}
        data-testid="side-by-side-preview"
        ref={containerRef}
      >
        <div className="mobile-toggle-bar">
          <button
            className={`toggle-btn ${activeView === 'document' ? 'active' : ''}`}
            onClick={() => handleViewToggle('document')}
            data-testid="view-toggle-document"
          >
            Document
          </button>
          <button
            className={`toggle-btn ${activeView === 'pdf' ? 'active' : ''}`}
            onClick={() => handleViewToggle('pdf')}
            data-testid="view-toggle-pdf"
          >
            PDF Preview
          </button>
        </div>
        
        <div className="mobile-content">
          <div
            className={`document-panel ${activeView === 'document' ? 'active' : ''}`}
            data-testid="document-panel"
            ref={documentPanelRef}
            onScroll={() => handleScroll('document')}
          >
            <div className="document-content" dangerouslySetInnerHTML={{ __html: documentContent }} />
          </div>
          
          <div
            className={`pdf-panel ${activeView === 'pdf' ? 'active' : ''}`}
            data-testid="pdf-panel"
            ref={pdfPanelRef}
            onScroll={() => handleScroll('pdf')}
          >
            <PDFPreview pdfUrl={pdfUrl} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={containerClasses}
      data-testid="side-by-side-preview"
      ref={containerRef}
    >
      <div
        className="document-panel"
        data-testid="document-panel"
        ref={documentPanelRef}
        style={{ 
          width: `${splitPosition}%`,
          minWidth: `${minPanelWidth}px`
        }}
        onScroll={() => handleScroll('document')}
      >
        <div className="panel-header">
          <h3>Document</h3>
        </div>
        <div className="document-content" dangerouslySetInnerHTML={{ __html: documentContent }} />
      </div>
      
      <div
        className="split-divider"
        data-testid="split-pane-divider"
        ref={dividerRef}
        onMouseDown={handleDragStart}
        draggable={true}
      >
        <div className="divider-handle">
          <div className="divider-grip"></div>
        </div>
      </div>
      
      <div
        className="pdf-panel"
        data-testid="pdf-panel"
        ref={pdfPanelRef}
        style={{ 
          width: `${100 - splitPosition}%`,
          minWidth: `${minPanelWidth}px`
        }}
        onScroll={() => handleScroll('pdf')}
      >
        <div className="panel-header">
          <h3>PDF Preview</h3>
        </div>
        <PDFPreview pdfUrl={pdfUrl} />
      </div>
    </div>
  );
};

export default SideBySidePreview;