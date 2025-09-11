import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SideBySidePreview from './SideBySidePreview';

// Mock PDF.js
vi.mock('pdfjs-dist', () => ({
  getDocument: vi.fn(),
  GlobalWorkerOptions: {
    workerSrc: ''
  },
  version: '4.8.69'
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

const mockDocument = `
  <h1>Test Document</h1>
  <p>This is a test document content.</p>
  <div>More content here</div>
`;

describe('SideBySidePreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render side-by-side preview container', () => {
    render(
      <SideBySidePreview 
        documentContent={mockDocument} 
        pdfUrl="test.pdf" 
      />
    );
    
    expect(screen.getByTestId('side-by-side-preview')).toBeInTheDocument();
  });

  it('should render split-pane layout with document and PDF panels', () => {
    // Set desktop width for this test
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
    
    render(
      <SideBySidePreview 
        documentContent={mockDocument} 
        pdfUrl="test.pdf" 
      />
    );
    
    expect(screen.getByTestId('document-panel')).toBeInTheDocument();
    expect(screen.getByTestId('pdf-panel')).toBeInTheDocument();
    expect(screen.getByTestId('split-pane-divider')).toBeInTheDocument();
  });

  it('should display document content in the left panel', () => {
    render(
      <SideBySidePreview 
        documentContent={mockDocument} 
        pdfUrl="test.pdf" 
      />
    );
    
    const documentPanel = screen.getByTestId('document-panel');
    expect(documentPanel).toHaveTextContent('Test Document');
    expect(documentPanel).toHaveTextContent('This is a test document content.');
  });

  it('should render PDF preview in the right panel', () => {
    render(
      <SideBySidePreview 
        documentContent={mockDocument} 
        pdfUrl="test.pdf" 
      />
    );
    
    const pdfPanel = screen.getByTestId('pdf-panel');
    expect(pdfPanel.querySelector('[data-testid="pdf-preview-container"]')).toBeInTheDocument();
  });

  it('should allow resizing the split panels', () => {
    // Set desktop width for this test
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
    
    render(
      <SideBySidePreview 
        documentContent={mockDocument} 
        pdfUrl="test.pdf" 
      />
    );
    
    const divider = screen.getByTestId('split-pane-divider');
    expect(divider).toHaveAttribute('draggable', 'true');
  });

  it('should handle divider drag to resize panels', () => {
    // Set desktop width for this test
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
    
    render(
      <SideBySidePreview 
        documentContent={mockDocument} 
        pdfUrl="test.pdf" 
      />
    );
    
    const divider = screen.getByTestId('split-pane-divider');
    
    fireEvent.mouseDown(divider, { clientX: 500 });
    fireEvent.mouseMove(document, { clientX: 600 });
    fireEvent.mouseUp(document);
    
    // Verify that panels have adjusted their sizes
    const documentPanel = screen.getByTestId('document-panel');
    const pdfPanel = screen.getByTestId('pdf-panel');
    
    // Check that panels have width styles applied
    expect(documentPanel.style.width).toBeTruthy();
    expect(pdfPanel.style.width).toBeTruthy();
  });

  it('should synchronize scrolling between document and PDF panels', async () => {
    render(
      <SideBySidePreview 
        documentContent={mockDocument} 
        pdfUrl="test.pdf" 
        enableSyncScroll={true}
      />
    );
    
    const documentPanel = screen.getByTestId('document-panel');
    const pdfPanel = screen.getByTestId('pdf-panel');
    
    // Mock scrollTop properties
    Object.defineProperty(documentPanel, 'scrollTop', { value: 100, writable: true });
    Object.defineProperty(documentPanel, 'scrollHeight', { value: 1000, writable: true });
    Object.defineProperty(documentPanel, 'clientHeight', { value: 500, writable: true });
    
    Object.defineProperty(pdfPanel, 'scrollTop', { value: 0, writable: true });
    Object.defineProperty(pdfPanel, 'scrollHeight', { value: 1000, writable: true });
    Object.defineProperty(pdfPanel, 'clientHeight', { value: 500, writable: true });
    
    fireEvent.scroll(documentPanel);
    
    await waitFor(() => {
      // Verify that PDF panel scroll position was updated
      expect(pdfPanel.scrollTop).toBeGreaterThan(0);
    });
  });

  it('should disable scroll synchronization when enableSyncScroll is false', () => {
    render(
      <SideBySidePreview 
        documentContent={mockDocument} 
        pdfUrl="test.pdf" 
        enableSyncScroll={false}
      />
    );
    
    const documentPanel = screen.getByTestId('document-panel');
    const pdfPanel = screen.getByTestId('pdf-panel');
    
    Object.defineProperty(documentPanel, 'scrollTop', { value: 100, writable: true });
    Object.defineProperty(pdfPanel, 'scrollTop', { value: 0, writable: true });
    
    fireEvent.scroll(documentPanel);
    
    // PDF panel should not scroll when sync is disabled
    expect(pdfPanel.scrollTop).toBe(0);
  });

  it('should handle responsive layout on small screens', () => {
    // Mock window.innerWidth to simulate mobile screen
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 768,
    });
    
    render(
      <SideBySidePreview 
        documentContent={mockDocument} 
        pdfUrl="test.pdf" 
      />
    );
    
    const container = screen.getByTestId('side-by-side-preview');
    expect(container).toHaveClass('responsive-mobile');
  });

  it('should allow toggling between document and PDF view on mobile', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 768,
    });
    
    render(
      <SideBySidePreview 
        documentContent={mockDocument} 
        pdfUrl="test.pdf" 
      />
    );
    
    // Should show toggle buttons on mobile
    expect(screen.getByTestId('view-toggle-document')).toBeInTheDocument();
    expect(screen.getByTestId('view-toggle-pdf')).toBeInTheDocument();
    
    // Initially should show document view
    expect(screen.getByTestId('document-panel')).toHaveClass('active');
    
    // Click PDF toggle
    fireEvent.click(screen.getByTestId('view-toggle-pdf'));
    
    expect(screen.getByTestId('pdf-panel')).toHaveClass('active');
    expect(screen.getByTestId('document-panel')).not.toHaveClass('active');
  });

  it('should handle panel resize by adjusting split position', () => {
    // Set desktop width for this test
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
    
    const onPanelResize = vi.fn();
    
    render(
      <SideBySidePreview 
        documentContent={mockDocument} 
        pdfUrl="test.pdf" 
        onPanelResize={onPanelResize}
      />
    );
    
    const divider = screen.getByTestId('split-pane-divider');
    const documentPanel = screen.getByTestId('document-panel');
    const pdfPanel = screen.getByTestId('pdf-panel');
    
    // Get initial widths
    const initialDocWidth = documentPanel.style.width;
    const initialPdfWidth = pdfPanel.style.width;
    
    // Mock container getBoundingClientRect
    const mockGetBoundingClientRect = vi.fn().mockReturnValue({
      width: 1000,
      left: 0,
      right: 1000,
      top: 0,
      bottom: 500,
      height: 500,
    });
    
    const container = screen.getByTestId('side-by-side-preview');
    container.getBoundingClientRect = mockGetBoundingClientRect;
    
    fireEvent.mouseDown(divider, { clientX: 500 });
    fireEvent.mouseMove(document, { clientX: 600 });
    fireEvent.mouseUp(document);
    
    // Verify that panel widths have changed
    const newDocWidth = documentPanel.style.width;
    const newPdfWidth = pdfPanel.style.width;
    
    expect(newDocWidth).not.toBe(initialDocWidth);
    expect(newPdfWidth).not.toBe(initialPdfWidth);
  });

  it('should maintain minimum panel widths during resize', () => {
    // Set desktop width for this test
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
    
    render(
      <SideBySidePreview 
        documentContent={mockDocument} 
        pdfUrl="test.pdf" 
        minPanelWidth={200}
      />
    );
    
    const divider = screen.getByTestId('split-pane-divider');
    
    // Try to drag divider to make document panel too small
    fireEvent.mouseDown(divider, { clientX: 500 });
    fireEvent.mouseMove(document, { clientX: 100 }); // Very small position
    fireEvent.mouseUp(document);
    
    const documentPanel = screen.getByTestId('document-panel');
    const computedStyle = window.getComputedStyle(documentPanel);
    
    // Should respect minimum width constraint
    expect(parseInt(computedStyle.minWidth) || 0).toBeGreaterThanOrEqual(200);
  });
});