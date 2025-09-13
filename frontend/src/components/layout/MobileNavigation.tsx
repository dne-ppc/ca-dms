import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Menu,
  X,
  FileText,
  FolderOpen,
  Search,
  Settings,
  Bell,
  Home,
  Plus,
  User
} from 'lucide-react'

interface MobileNavigationProps {
  className?: string
  isAuthenticated?: boolean
}

export const MobileNavigation = ({ className = '', isAuthenticated = true }: MobileNavigationProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const location = useLocation()

  // Track screen size changes
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768) // md breakpoint
    }

    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)

    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  // Close menu when route changes
  useEffect(() => {
    setIsOpen(false)
  }, [location])

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.mobile-nav') && !target.closest('.mobile-nav-trigger')) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const navigationItems = [
    { path: '/', label: 'Dashboard', icon: Home },
    { path: '/documents', label: 'Documents', icon: FileText },
    { path: '/templates', label: 'Templates', icon: FolderOpen },
    { path: '/search', label: 'Search', icon: Search },
    { path: '/notifications', label: 'Notifications', icon: Bell },
    { path: '/settings', label: 'Settings', icon: Settings },
    { path: '/profile', label: 'Profile', icon: User }
  ]

  const isActivePath = (path: string) => {
    if (path === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(path)
  }

  // Don't render if not authenticated or not on mobile
  if (!isAuthenticated || !isMobile) {
    return null
  }

  return (
    <>
      {/* Mobile Header Bar */}
      <div className={`bg-white border-b border-gray-200 shadow-sm ${className}`}>
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="mobile-nav-trigger p-2 rounded-md hover:bg-gray-100 transition-colors"
            aria-label="Open navigation menu"
          >
            {isOpen ? (
              <X className="h-6 w-6 text-gray-700" />
            ) : (
              <Menu className="h-6 w-6 text-gray-700" />
            )}
          </button>

          <h1 className="text-lg font-semibold text-gray-900">
            CA-DMS
          </h1>

          <Link
            to="/editor"
            className="p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            aria-label="Create new document"
          >
            <Plus className="h-5 w-5" />
          </Link>
        </div>
      </div>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Slide-out Navigation Menu */}
      <nav
        className={`
          mobile-nav fixed left-0 top-0 h-full w-80 bg-white shadow-lg z-50 transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">CA-DMS</h2>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 rounded-md hover:bg-gray-100 transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="py-4">
          {navigationItems.map((item) => {
            const Icon = item.icon
            const isActive = isActivePath(item.path)
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  flex items-center px-6 py-3 text-base font-medium transition-colors
                  ${isActive 
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700' 
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
              >
                <Icon className="h-6 w-6 mr-3 flex-shrink-0" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <div className="text-sm text-gray-500 text-center">
            <div>Community Association</div>
            <div>Document Management System</div>
          </div>
        </div>
      </nav>
    </>
  )
}

// Touch-friendly mobile interactions hook
export const useMobileInteractions = () => {
  const [isMobile, setIsMobile] = useState(false)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > 50
    const isRightSwipe = distance < -50

    return { isLeftSwipe, isRightSwipe, distance }
  }

  return {
    isMobile,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd
  }
}