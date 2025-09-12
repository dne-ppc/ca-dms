import { useEffect, useRef } from 'react'
import './MainContent.css'
import { useKeyboardNavigationContext } from '../../contexts/KeyboardNavigationContext'

interface MainContentProps {
  children: React.ReactNode
}

export function MainContent({ children }: MainContentProps) {
  const mainRef = useRef<HTMLDivElement>(null)
  const { registerMain } = useKeyboardNavigationContext()

  // Register main content for keyboard navigation
  useEffect(() => {
    registerMain(mainRef.current)
  }, [])

  return (
    <div 
      ref={mainRef}
      className="main-content-area"
      role="main"
      aria-label="Main content area"
      tabIndex={-1}
    >
      <div className="main-content-inner">
        {children}
      </div>
    </div>
  )
}