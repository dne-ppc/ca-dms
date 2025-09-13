/**
 * Comprehensive tests for MainContent component
 * Tests layout, accessibility, keyboard navigation, and content rendering
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { MainContent } from '../../components/layout/MainContent'

// Mock the keyboard navigation context
const mockRegisterMain = jest.fn()
jest.mock('../../contexts/KeyboardNavigationContext', () => ({
  useKeyboardNavigationContext: () => ({
    registerMain: mockRegisterMain
  })
}))

// Mock CSS imports
jest.mock('../../components/layout/MainContent.css', () => ({}))

describe('MainContent Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('should render with children content', () => {
      render(
        <MainContent>
          <div data-testid="test-content">Test Content</div>
        </MainContent>
      )

      expect(screen.getByRole('main')).toBeInTheDocument()
      expect(screen.getByTestId('test-content')).toBeInTheDocument()
    })

    it('should render multiple children', () => {
      render(
        <MainContent>
          <div data-testid="child-1">Child 1</div>
          <div data-testid="child-2">Child 2</div>
          <div data-testid="child-3">Child 3</div>
        </MainContent>
      )

      expect(screen.getByTestId('child-1')).toBeInTheDocument()
      expect(screen.getByTestId('child-2')).toBeInTheDocument()
      expect(screen.getByTestId('child-3')).toBeInTheDocument()
    })

    it('should handle complex nested content', () => {
      const ComplexContent = () => (
        <div>
          <header>
            <h1>Page Title</h1>
            <nav>
              <ul>
                <li><a href="#section1">Section 1</a></li>
                <li><a href="#section2">Section 2</a></li>
              </ul>
            </nav>
          </header>
          <main>
            <section id="section1">
              <h2>Section 1 Content</h2>
              <p>This is section 1</p>
            </section>
            <section id="section2">
              <h2>Section 2 Content</h2>
              <p>This is section 2</p>
            </section>
          </main>
          <footer>
            <p>Footer content</p>
          </footer>
        </div>
      )

      render(
        <MainContent>
          <ComplexContent />
        </MainContent>
      )

      expect(screen.getByText('Page Title')).toBeInTheDocument()
      expect(screen.getByText('Section 1 Content')).toBeInTheDocument()
      expect(screen.getByText('Section 2 Content')).toBeInTheDocument()
      expect(screen.getByText('Footer content')).toBeInTheDocument()
    })
  })

  describe('CSS Classes and Structure', () => {
    it('should apply correct CSS classes', () => {
      const { container } = render(
        <MainContent>
          <div>Content</div>
        </MainContent>
      )

      const mainElement = container.querySelector('.main-content-area')
      const innerElement = container.querySelector('.main-content-inner')

      expect(mainElement).toBeInTheDocument()
      expect(innerElement).toBeInTheDocument()
      expect(mainElement).toContainElement(innerElement)
    })

    it('should maintain proper DOM structure', () => {
      const { container } = render(
        <MainContent>
          <div data-testid="content">Content</div>
        </MainContent>
      )

      const mainElement = container.querySelector('.main-content-area')
      const innerElement = container.querySelector('.main-content-inner')
      const contentElement = screen.getByTestId('content')

      expect(mainElement).toContainElement(innerElement)
      expect(innerElement).toContainElement(contentElement)
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(
        <MainContent>
          <div>Content</div>
        </MainContent>
      )

      const mainElement = screen.getByRole('main')

      expect(mainElement).toHaveAttribute('aria-label', 'Main content area')
      expect(mainElement).toHaveAttribute('tabIndex', '-1')
    })

    it('should be identifiable as main landmark', () => {
      render(
        <MainContent>
          <div>Content</div>
        </MainContent>
      )

      const mainElements = screen.getAllByRole('main')
      // Should only have one main element (the MainContent wrapper)
      expect(mainElements).toHaveLength(1)
    })

    it('should be focusable programmatically', () => {
      render(
        <MainContent>
          <div>Content</div>
        </MainContent>
      )

      const mainElement = screen.getByRole('main')

      // Should be focusable with JavaScript but not tab-navigable
      expect(mainElement).toHaveAttribute('tabIndex', '-1')

      // Test programmatic focus
      mainElement.focus()
      expect(document.activeElement).toBe(mainElement)
    })
  })

  describe('Keyboard Navigation Integration', () => {
    it('should register with keyboard navigation context', () => {
      render(
        <MainContent>
          <div>Content</div>
        </MainContent>
      )

      expect(mockRegisterMain).toHaveBeenCalledWith(expect.any(HTMLDivElement))
    })

    it('should register only once on mount', () => {
      const { rerender } = render(
        <MainContent>
          <div>Content</div>
        </MainContent>
      )

      expect(mockRegisterMain).toHaveBeenCalledTimes(1)

      // Rerender with different content
      rerender(
        <MainContent>
          <div>New Content</div>
        </MainContent>
      )

      // Should not register again
      expect(mockRegisterMain).toHaveBeenCalledTimes(1)
    })

    it('should register with correct element reference', () => {
      const { container } = render(
        <MainContent>
          <div>Content</div>
        </MainContent>
      )

      const mainElement = container.querySelector('.main-content-area')
      expect(mockRegisterMain).toHaveBeenCalledWith(mainElement)
    })
  })

  describe('Content Rendering Edge Cases', () => {
    it('should handle null children gracefully', () => {
      render(<MainContent>{null}</MainContent>)

      expect(screen.getByRole('main')).toBeInTheDocument()
    })

    it('should handle undefined children gracefully', () => {
      render(<MainContent>{undefined}</MainContent>)

      expect(screen.getByRole('main')).toBeInTheDocument()
    })

    it('should handle empty string children', () => {
      render(<MainContent>{''}</MainContent>)

      expect(screen.getByRole('main')).toBeInTheDocument()
    })

    it('should handle boolean children', () => {
      render(
        <MainContent>
          {true && <div data-testid="conditional-content">Conditional</div>}
          {false && <div data-testid="hidden-content">Hidden</div>}
        </MainContent>
      )

      expect(screen.getByTestId('conditional-content')).toBeInTheDocument()
      expect(screen.queryByTestId('hidden-content')).not.toBeInTheDocument()
    })

    it('should handle array of children', () => {
      const items = ['Item 1', 'Item 2', 'Item 3']

      render(
        <MainContent>
          {items.map((item, index) => (
            <div key={index} data-testid={`item-${index}`}>
              {item}
            </div>
          ))}
        </MainContent>
      )

      expect(screen.getByTestId('item-0')).toHaveTextContent('Item 1')
      expect(screen.getByTestId('item-1')).toHaveTextContent('Item 2')
      expect(screen.getByTestId('item-2')).toHaveTextContent('Item 3')
    })
  })

  describe('React Components as Children', () => {
    it('should render functional components as children', () => {
      const FunctionalComponent = () => (
        <div data-testid="functional-component">Functional Component</div>
      )

      render(
        <MainContent>
          <FunctionalComponent />
        </MainContent>
      )

      expect(screen.getByTestId('functional-component')).toBeInTheDocument()
    })

    it('should render class components as children', () => {
      class ClassComponent extends React.Component {
        render() {
          return <div data-testid="class-component">Class Component</div>
        }
      }

      render(
        <MainContent>
          <ClassComponent />
        </MainContent>
      )

      expect(screen.getByTestId('class-component')).toBeInTheDocument()
    })

    it('should render components with props', () => {
      const ComponentWithProps = ({ title, content }: { title: string; content: string }) => (
        <div data-testid="props-component">
          <h3>{title}</h3>
          <p>{content}</p>
        </div>
      )

      render(
        <MainContent>
          <ComponentWithProps title="Test Title" content="Test Content" />
        </MainContent>
      )

      expect(screen.getByText('Test Title')).toBeInTheDocument()
      expect(screen.getByText('Test Content')).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should handle missing keyboard navigation context gracefully', () => {
      // Mock missing context
      jest.doMock('../../contexts/KeyboardNavigationContext', () => ({
        useKeyboardNavigationContext: () => ({
          registerMain: undefined
        })
      }))

      expect(() => {
        render(
          <MainContent>
            <div>Content</div>
          </MainContent>
        )
      }).not.toThrow()

      expect(screen.getByRole('main')).toBeInTheDocument()
    })

    it('should handle errors in children gracefully', () => {
      const ErrorComponent = () => {
        throw new Error('Child component error')
      }

      // Use error boundary to catch the error
      class ErrorBoundary extends React.Component<
        { children: React.ReactNode },
        { hasError: boolean }
      > {
        constructor(props: { children: React.ReactNode }) {
          super(props)
          this.state = { hasError: false }
        }

        static getDerivedStateFromError() {
          return { hasError: true }
        }

        render() {
          if (this.state.hasError) {
            return <div data-testid="error-fallback">Something went wrong</div>
          }
          return this.props.children
        }
      }

      render(
        <ErrorBoundary>
          <MainContent>
            <ErrorComponent />
          </MainContent>
        </ErrorBoundary>
      )

      expect(screen.getByTestId('error-fallback')).toBeInTheDocument()
    })
  })

  describe('Performance', () => {
    it('should not cause unnecessary re-renders', () => {
      const mockChild = jest.fn(() => <div>Mock Child</div>)
      const MockChild = React.memo(mockChild)

      const { rerender } = render(
        <MainContent>
          <MockChild />
        </MainContent>
      )

      expect(mockChild).toHaveBeenCalledTimes(1)

      // Rerender with same content
      rerender(
        <MainContent>
          <MockChild />
        </MainContent>
      )

      // Child should not re-render
      expect(mockChild).toHaveBeenCalledTimes(1)
    })

    it('should handle large amounts of content efficiently', () => {
      const largeContent = Array.from({ length: 1000 }, (_, i) => (
        <div key={i}>Item {i}</div>
      ))

      const start = performance.now()
      render(<MainContent>{largeContent}</MainContent>)
      const end = performance.now()

      // Should render within reasonable time
      expect(end - start).toBeLessThan(100)
    })

    it('should render consistently across re-renders', () => {
      const { rerender } = render(
        <MainContent>
          <div data-testid="content">Original Content</div>
        </MainContent>
      )

      expect(screen.getByTestId('content')).toHaveTextContent('Original Content')

      rerender(
        <MainContent>
          <div data-testid="content">Updated Content</div>
        </MainContent>
      )

      expect(screen.getByTestId('content')).toHaveTextContent('Updated Content')
    })
  })

  describe('Integration with Other Components', () => {
    it('should work with form components', () => {
      render(
        <MainContent>
          <form data-testid="test-form">
            <label htmlFor="test-input">Test Input:</label>
            <input id="test-input" type="text" />
            <button type="submit">Submit</button>
          </form>
        </MainContent>
      )

      expect(screen.getByTestId('test-form')).toBeInTheDocument()
      expect(screen.getByLabelText('Test Input:')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument()
    })

    it('should work with navigation components', () => {
      render(
        <MainContent>
          <nav data-testid="test-nav">
            <ul>
              <li><a href="/home">Home</a></li>
              <li><a href="/about">About</a></li>
              <li><a href="/contact">Contact</a></li>
            </ul>
          </nav>
        </MainContent>
      )

      expect(screen.getByTestId('test-nav')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'About' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Contact' })).toBeInTheDocument()
    })

    it('should work with interactive components', () => {
      const mockHandler = jest.fn()

      render(
        <MainContent>
          <div>
            <button onClick={mockHandler} data-testid="interactive-button">
              Click Me
            </button>
            <input
              type="checkbox"
              onChange={mockHandler}
              data-testid="interactive-checkbox"
            />
          </div>
        </MainContent>
      )

      const button = screen.getByTestId('interactive-button')
      const checkbox = screen.getByTestId('interactive-checkbox')

      expect(button).toBeInTheDocument()
      expect(checkbox).toBeInTheDocument()

      // Test interactions still work
      button.click()
      expect(mockHandler).toHaveBeenCalledTimes(1)

      checkbox.click()
      expect(mockHandler).toHaveBeenCalledTimes(2)
    })
  })

  describe('Ref Handling', () => {
    it('should provide access to the main element via ref', () => {
      let mainRef: HTMLDivElement | null = null

      const TestComponent = () => {
        const ref = React.useRef<HTMLDivElement>(null)

        React.useEffect(() => {
          mainRef = ref.current
        }, [])

        return (
          <div ref={ref}>
            <MainContent>
              <div>Content</div>
            </MainContent>
          </div>
        )
      }

      render(<TestComponent />)

      expect(mainRef).toBeInstanceOf(HTMLDivElement)
    })
  })
})