import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '../utils'
import { CustomToolbar } from '../../components/editor/CustomToolbar'

describe('CustomToolbar', () => {
  it('should render all standard formatting buttons', () => {
    render(<CustomToolbar />)
    
    expect(screen.getByTestId('custom-toolbar')).toBeInTheDocument()
  })

  it('should render placeholder insertion buttons', () => {
    render(<CustomToolbar />)
    
    // Check for the four specialized placeholder buttons
    expect(screen.getByTestId('insert-version-table')).toBeInTheDocument()
    expect(screen.getByTestId('insert-signature-field')).toBeInTheDocument()
    expect(screen.getByTestId('insert-long-response')).toBeInTheDocument()
    expect(screen.getByTestId('insert-line-segment')).toBeInTheDocument()
  })

  it('should call onInsertPlaceholder when placeholder buttons are clicked', () => {
    const mockInsertPlaceholder = vi.fn()
    render(<CustomToolbar onInsertPlaceholder={mockInsertPlaceholder} />)
    
    fireEvent.click(screen.getByTestId('insert-version-table'))
    expect(mockInsertPlaceholder).toHaveBeenCalledWith('version-table')
    
    fireEvent.click(screen.getByTestId('insert-signature-field'))
    expect(mockInsertPlaceholder).toHaveBeenCalledWith('signature-field')
    
    fireEvent.click(screen.getByTestId('insert-long-response'))
    expect(mockInsertPlaceholder).toHaveBeenCalledWith('long-response')
    
    fireEvent.click(screen.getByTestId('insert-line-segment'))
    expect(mockInsertPlaceholder).toHaveBeenCalledWith('line-segment')
  })
})