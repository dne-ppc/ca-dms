import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import DocumentEditor from './pages/DocumentEditor'
import Search from './pages/Search'
import NotificationCenter from './components/notifications/NotificationCenter'
import NotificationBell from './components/notifications/NotificationBell'
import { ThemeToggle } from './components/ui/ThemeToggle'
import './App.css'

function App() {
  const location = useLocation()

  return (
    <div className="app">
      <nav className="navbar">
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

      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/editor/:id?" element={<DocumentEditor />} />
          <Route path="/search" element={<Search />} />
          <Route path="/notifications" element={<NotificationCenter />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
