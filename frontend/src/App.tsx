import { useEffect } from 'react'
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import DocumentEditor from './pages/DocumentEditor'
import Search from './pages/Search'
import NotificationCenter from './components/notifications/NotificationCenter'
import NotificationBell from './components/notifications/NotificationBell'
import { ThemeToggle } from './components/ui/ThemeToggle'
import { PWAStatus } from './components/PWAStatus'
import { MobileNavigation } from './components/layout/MobileNavigation'
import { NotificationPermissionPrompt } from './hooks/useNotifications'
import { usePWA } from './hooks/usePWA'
import { useOfflineStore } from './stores/offlineStore'
import './App.css'

function App() {
  const location = useLocation()
  const { isOffline } = usePWA()
  const setOfflineStatus = useOfflineStore(state => state.setOfflineStatus)

  // Update offline store when PWA hook detects offline status changes
  useEffect(() => {
    setOfflineStatus(isOffline)
  }, [isOffline, setOfflineStatus])

  return (
    <div className="app">
      {/* Desktop Navigation */}
      <nav className="navbar hidden md:block">
        <div className="nav-content">
          <Link to="/dashboard" className="nav-brand">
            <h1>CA-DMS</h1>
          </Link>
          <div className="nav-links">
            <Link 
              to="/dashboard" 
              className={location.pathname === '/dashboard' ? 'nav-link active' : 'nav-link'}
            >
              Dashboard
            </Link>
            <Link 
              to="/editor" 
              className={location.pathname.startsWith('/editor') ? 'nav-link active' : 'nav-link'}
            >
              New Document
            </Link>
            <Link 
              to="/search" 
              className={location.pathname === '/search' ? 'nav-link active' : 'nav-link'}
            >
              Advanced Search
            </Link>
            <NotificationBell />
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <MobileNavigation isAuthenticated={true} />

      {/* PWA Status Indicators */}
      <PWAStatus />

      <main className="main-content pb-16 md:pb-0">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/editor/:id?" element={<DocumentEditor />} />
          <Route path="/search" element={<Search />} />
          <Route path="/notifications" element={<NotificationCenter />} />
        </Routes>
      </main>

      {/* Offline Banner */}
      {isOffline && (
        <div className="fixed bottom-0 left-0 right-0 bg-amber-500 text-white px-4 py-2 text-center text-sm font-medium z-40 md:bottom-auto md:top-0">
          You're currently offline. Changes will sync when connection is restored.
        </div>
      )}
    </div>
  )
}

export default App
