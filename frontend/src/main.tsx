import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import { KeyboardNavigationProvider } from './contexts/KeyboardNavigationContext'
import { AccessibilityProvider } from './contexts/AccessibilityContext'
import './index.css'
import './styles/accessibility.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AccessibilityProvider>
        <KeyboardNavigationProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </KeyboardNavigationProvider>
      </AccessibilityProvider>
    </ThemeProvider>
  </StrictMode>
)
