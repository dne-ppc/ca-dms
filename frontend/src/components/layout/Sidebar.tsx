import { useState, useEffect, useRef } from 'react'
import './Sidebar.css'
import { useKeyboardNavigationContext } from '../../contexts/KeyboardNavigationContext'

interface SidebarProps {
  children: React.ReactNode
  title?: string
  defaultCollapsed?: boolean
}

export function Sidebar({ children, title = "Controls", defaultCollapsed = false }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const { registerSidebar } = useKeyboardNavigationContext()

  // Register sidebar for keyboard navigation
  useEffect(() => {
    registerSidebar(sidebarRef.current)
  }, [])

  return (
    <>
      <div 
        ref={sidebarRef}
        className={`sidebar ${isCollapsed ? 'collapsed' : 'expanded'}`}
        role="complementary"
        aria-label={title}
      >
        <div className="sidebar-header">
          <h3 className="sidebar-title">{title}</h3>
          <button 
            className="sidebar-toggle"
            onClick={() => setIsCollapsed(!isCollapsed)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setIsCollapsed(!isCollapsed)
              }
            }}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? '▶' : '◀'}
          </button>
        </div>
        {!isCollapsed && (
          <div className="sidebar-content">
            {children}
          </div>
        )}
      </div>
      
      {/* Mobile overlay for open sidebar */}
      {!isCollapsed && (
        <div 
          className="sidebar-overlay"
          onClick={() => setIsCollapsed(true)}
        />
      )}
    </>
  )
}