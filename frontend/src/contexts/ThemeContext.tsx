import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

type Theme = 'light' | 'dark' | 'high-contrast' | 'system'
type ResolvedTheme = 'light' | 'dark' | 'high-contrast'

interface ThemeContextType {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

interface ThemeProviderProps {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('ca-dms-theme')
    return (stored as Theme) || 'system'
  })

  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light')

  useEffect(() => {
    const updateResolvedTheme = () => {
      let resolved: ResolvedTheme = 'light'
      
      if (theme === 'high-contrast') {
        resolved = 'high-contrast'
      } else if (theme === 'system') {
        // Check for high contrast preference first
        if (window.matchMedia('(prefers-contrast: high)').matches) {
          resolved = 'high-contrast'
        } else {
          resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
        }
      } else {
        resolved = theme as ResolvedTheme
      }
      
      setResolvedTheme(resolved)
      
      // Update document class and data attribute
      document.documentElement.className = resolved
      document.documentElement.setAttribute('data-theme', resolved)
    }

    updateResolvedTheme()

    // Listen for system theme changes
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const highContrastQuery = window.matchMedia('(prefers-contrast: high)')
    
    const handleChange = () => {
      if (theme === 'system') {
        updateResolvedTheme()
      }
    }

    darkModeQuery.addEventListener('change', handleChange)
    highContrastQuery.addEventListener('change', handleChange)
    
    return () => {
      darkModeQuery.removeEventListener('change', handleChange)
      highContrastQuery.removeEventListener('change', handleChange)
    }
  }, [theme])

  const handleSetTheme = (newTheme: Theme) => {
    setTheme(newTheme)
    localStorage.setItem('ca-dms-theme', newTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme: handleSetTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}