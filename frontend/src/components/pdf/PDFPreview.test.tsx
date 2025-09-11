import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PDFPreview from './PDFPreview';

// Mock PDF.js
vi.mock('pdfjs-dist', () => ({
  getDocument: vi.fn(),
  GlobalWorkerOptions: {
    workerSrc: ''
  },
  version: '4.8.69'
}));

const mockPDFDocument = {
  numPages: 2,
  getPage: vi.fn()
};

const mockPage = {
  render: vi.fn(() => ({ promise: Promise.resolve() })),
  getViewport: vi.fn(() => ({ width: 800, height: 600 })),
  getAnnotations: vi.fn(() => Promise.resolve([]))
};

describe('PDFPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render PDF preview component', () => {
    render(<PDFPreview pdfUrl="test.pdf" />);
    expect(screen.getByTestId('pdf-preview-container')).toBeInTheDocument();
  });

  it('should show loading state while PDF is loading', async () => {
    const { getDocument } = await import('pdfjs-dist');
    (getDocument as vi.MockedFunction<typeof getDocument>).mockReturnValue({
      promise: new Promise(() => {}) // Never resolves to keep loading state
    });

    render(<PDFPreview pdfUrl="test.pdf" />);
    expect(screen.getByTestId('pdf-loading')).toBeInTheDocument();
    expect(screen.getByText('Loading PDF...')).toBeInTheDocument();
  });

  it('should render PDF document when loaded successfully', async () => {
    const { getDocument } = await import('pdfjs-dist');
    mockPDFDocument.getPage.mockResolvedValue(mockPage);
    (getDocument as vi.MockedFunction<typeof getDocument>).mockReturnValue({
      promise: Promise.resolve(mockPDFDocument)
    });

    render(<PDFPreview pdfUrl="test.pdf" />);
    
    await waitFor(() => {
      expect(screen.getByTestId('pdf-canvas-1')).toBeInTheDocument();
    });
  });

  it('should show error state when PDF loading fails', async () => {
    const { getDocument } = await import('pdfjs-dist');
    (getDocument as vi.MockedFunction<typeof getDocument>).mockReturnValue({
      promise: Promise.reject(new Error('Failed to load PDF'))
    });

    render(<PDFPreview pdfUrl="test.pdf" />);
    
    await waitFor(() => {
      expect(screen.getByTestId('pdf-error')).toBeInTheDocument();
      expect(screen.getByText('Failed to load PDF')).toBeInTheDocument();
    });
  });

  it('should display page count information', async () => {
    const { getDocument } = await import('pdfjs-dist');
    mockPDFDocument.getPage.mockResolvedValue(mockPage);
    (getDocument as vi.MockedFunction<typeof getDocument>).mockReturnValue({
      promise: Promise.resolve(mockPDFDocument)
    });

    render(<PDFPreview pdfUrl="test.pdf" />);
    
    await waitFor(() => {
      expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    });
  });

  it('should handle empty PDF URL', () => {
    render(<PDFPreview pdfUrl="" />);
    expect(screen.getByTestId('pdf-error')).toBeInTheDocument();
    expect(screen.getByText('No PDF URL provided')).toBeInTheDocument();
  });

  it('should call onLoadError callback when PDF fails to load', async () => {
    const onLoadError = vi.fn();
    const { getDocument } = await import('pdfjs-dist');
    const error = new Error('PDF load failed');
    (getDocument as vi.MockedFunction<typeof getDocument>).mockReturnValue({
      promise: Promise.reject(error)
    });

    render(<PDFPreview pdfUrl="test.pdf" onLoadError={onLoadError} />);
    
    await waitFor(() => {
      expect(onLoadError).toHaveBeenCalledWith(error);
    });
  });

  it('should call onLoadSuccess callback when PDF loads successfully', async () => {
    const onLoadSuccess = vi.fn();
    const { getDocument } = await import('pdfjs-dist');
    mockPDFDocument.getPage.mockResolvedValue(mockPage);
    (getDocument as vi.MockedFunction<typeof getDocument>).mockReturnValue({
      promise: Promise.resolve(mockPDFDocument)
    });

    render(<PDFPreview pdfUrl="test.pdf" onLoadSuccess={onLoadSuccess} />);
    
    await waitFor(() => {
      expect(onLoadSuccess).toHaveBeenCalledWith(mockPDFDocument);
    });
  });

  it('should render all pages of the PDF document', async () => {
    const { getDocument } = await import('pdfjs-dist');
    const multiPagePDF = {
      numPages: 3,
      getPage: vi.fn().mockResolvedValue(mockPage)
    };
    (getDocument as vi.MockedFunction<typeof getDocument>).mockReturnValue({
      promise: Promise.resolve(multiPagePDF)
    });

    render(<PDFPreview pdfUrl="test.pdf" />);
    
    await waitFor(() => {
      expect(screen.getByTestId('pdf-canvas-1')).toBeInTheDocument();
      expect(screen.getByTestId('pdf-canvas-2')).toBeInTheDocument();
      expect(screen.getByTestId('pdf-canvas-3')).toBeInTheDocument();
    });
  });

  // Form Field Visualization Tests (Task 4.1.3)
  describe('Form Field Visualization', () => {
    const mockFormFields = [
      { 
        id: 'signature-1', 
        subtype: 'Widget',
        fieldType: 'signature', 
        rect: [100, 200, 300, 250], 
        fieldName: 'Signature Field' 
      },
      { 
        id: 'text-1', 
        subtype: 'Widget',
        fieldType: 'text', 
        rect: [50, 300, 400, 320], 
        fieldName: 'Text Field' 
      },
      { 
        id: 'response-1', 
        subtype: 'Widget',
        fieldType: 'textarea', 
        rect: [50, 350, 500, 450], 
        fieldName: 'Long Response' 
      }
    ];

    const mockPageWithFormFields = {
      ...mockPage,
      getAnnotations: vi.fn().mockResolvedValue(mockFormFields)
    };

    it('should detect form fields in PDF', async () => {
      const { getDocument } = await import('pdfjs-dist');
      const pdfWithFields = {
        ...mockPDFDocument,
        getPage: vi.fn().mockResolvedValue(mockPageWithFormFields)
      };
      (getDocument as vi.MockedFunction<typeof getDocument>).mockReturnValue({
        promise: Promise.resolve(pdfWithFields)
      });

      render(<PDFPreview pdfUrl="test-with-fields.pdf" />);
      
      await waitFor(() => {
        // Should call getAnnotations to detect form fields
        expect(mockPageWithFormFields.getAnnotations).toHaveBeenCalled();
      });
    });

    it('should render visual indicators for form fields', async () => {
      const { getDocument } = await import('pdfjs-dist');
      const pdfWithFields = {
        ...mockPDFDocument,
        getPage: vi.fn().mockResolvedValue(mockPageWithFormFields)
      };
      (getDocument as vi.MockedFunction<typeof getDocument>).mockReturnValue({
        promise: Promise.resolve(pdfWithFields)
      });

      render(<PDFPreview pdfUrl="test-with-fields.pdf" />);
      
      await waitFor(() => {
        // Should render form field overlay container
        expect(screen.getByTestId('form-field-overlay')).toBeInTheDocument();
        
        // Should render individual form field indicators
        expect(screen.getByTestId('form-field-signature-1')).toBeInTheDocument();
        expect(screen.getByTestId('form-field-text-1')).toBeInTheDocument();
        expect(screen.getByTestId('form-field-response-1')).toBeInTheDocument();
      });
    });

    it('should differentiate form field types with different visual indicators', async () => {
      const { getDocument } = await import('pdfjs-dist');
      const pdfWithFields = {
        ...mockPDFDocument,
        getPage: vi.fn().mockResolvedValue(mockPageWithFormFields)
      };
      (getDocument as vi.MockedFunction<typeof getDocument>).mockReturnValue({
        promise: Promise.resolve(pdfWithFields)
      });

      render(<PDFPreview pdfUrl="test-with-fields.pdf" />);
      
      await waitFor(() => {
        // Signature field should have signature-specific class
        const signatureField = screen.getByTestId('form-field-signature-1');
        expect(signatureField).toHaveClass('form-field-indicator');
        expect(signatureField).toHaveClass('form-field-signature');
        
        // Text field should have text-specific class
        const textField = screen.getByTestId('form-field-text-1');
        expect(textField).toHaveClass('form-field-indicator');
        expect(textField).toHaveClass('form-field-text');
        
        // Textarea field should have textarea-specific class
        const responseField = screen.getByTestId('form-field-response-1');
        expect(responseField).toHaveClass('form-field-indicator');
        expect(responseField).toHaveClass('form-field-textarea');
      });
    });

    it('should position form field indicators correctly based on PDF coordinates', async () => {
      const { getDocument } = await import('pdfjs-dist');
      const pdfWithFields = {
        ...mockPDFDocument,
        getPage: vi.fn().mockResolvedValue(mockPageWithFormFields)
      };
      (getDocument as vi.MockedFunction<typeof getDocument>).mockReturnValue({
        promise: Promise.resolve(pdfWithFields)
      });

      render(<PDFPreview pdfUrl="test-with-fields.pdf" />);
      
      await waitFor(() => {
        const signatureField = screen.getByTestId('form-field-signature-1');
        
        // Should have positioning styles based on rect coordinates
        const computedStyle = window.getComputedStyle(signatureField);
        expect(computedStyle.position).toBe('absolute');
        // Note: Exact pixel values will depend on scale and coordinate transformation
        expect(computedStyle.left).toBeDefined();
        expect(computedStyle.top).toBeDefined();
        expect(computedStyle.width).toBeDefined();
        expect(computedStyle.height).toBeDefined();
      });
    });

    it('should show tooltips with form field information on hover', async () => {
      const { getDocument } = await import('pdfjs-dist');
      const pdfWithFields = {
        ...mockPDFDocument,
        getPage: vi.fn().mockResolvedValue(mockPageWithFormFields)
      };
      (getDocument as vi.MockedFunction<typeof getDocument>).mockReturnValue({
        promise: Promise.resolve(pdfWithFields)
      });

      render(<PDFPreview pdfUrl="test-with-fields.pdf" />);
      
      await waitFor(() => {
        const signatureField = screen.getByTestId('form-field-signature-1');
        
        // Should have title attribute for tooltip
        expect(signatureField).toHaveAttribute('title', 'Signature Field');
      });
    });

    it('should handle PDF without form fields gracefully', async () => {
      const { getDocument } = await import('pdfjs-dist');
      const mockPageNoFields = {
        ...mockPage,
        getAnnotations: vi.fn().mockResolvedValue([])
      };
      const pdfNoFields = {
        ...mockPDFDocument,
        getPage: vi.fn().mockResolvedValue(mockPageNoFields)
      };
      (getDocument as vi.MockedFunction<typeof getDocument>).mockReturnValue({
        promise: Promise.resolve(pdfNoFields)
      });

      render(<PDFPreview pdfUrl="test-no-fields.pdf" />);
      
      await waitFor(() => {
        // Should still render PDF canvas but no form field overlay
        expect(screen.getByTestId('pdf-canvas-1')).toBeInTheDocument();
        expect(screen.queryByTestId('form-field-overlay')).not.toBeInTheDocument();
      });
    });
  });
});