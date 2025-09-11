import { Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import DocumentEditor from './pages/DocumentEditor'
import './App.css'

function App() {
  return (
    <div className="app">
      <nav className="navbar">
        <h1>CA-DMS</h1>
      </nav>

      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/editor/:id?" element={<DocumentEditor />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
