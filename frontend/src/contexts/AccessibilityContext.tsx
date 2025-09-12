import React, { createContext, useContext, useEffect, useState } from 'react'

type FontScale = 'small' | 'normal' | 'large' | 'extra-large'

interface AccessibilityContextType {
  fontScale: FontScale
  setFontScale: (scale: FontScale) => void
  reducedMotion: boolean
  highContrast: boolean
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined)

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext)
  if (context === undefined) {
    // Return safe defaults instead of throwing
    return {
      fontScale: 'normal' as const,
      setFontScale: () => {},
      reducedMotion: false,
      highContrast: false,
    }
  }
  return context
}

interface AccessibilityProviderProps {
  children: React.ReactNode
}

export const AccessibilityProvider: React.FC<AccessibilityProviderProps> = ({ children }) => {
  const [fontScale, setFontScale] = useState<FontScale>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('ca-dms-font-scale') as FontScale
      return stored || 'normal'
    }
    return 'normal'
  })

  const [reducedMotion, setReducedMotion] = useState(false)
  const [highContrast, setHighContrast] = useState(false)

  // Detect system preferences
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
      const highContrastQuery = window.matchMedia('(prefers-contrast: high)')

      setReducedMotion(reducedMotionQuery.matches)
      setHighContrast(highContrastQuery.matches)

      const handleReducedMotionChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
      const handleHighContrastChange = (e: MediaQueryListEvent) => setHighContrast(e.matches)

      reducedMotionQuery.addEventListener('change', handleReducedMotionChange)
      highContrastQuery.addEventListener('change', handleHighContrastChange)

      return () => {
        reducedMotionQuery.removeEventListener('change', handleReducedMotionChange)
        highContrastQuery.removeEventListener('change', handleHighContrastChange)
      }
    }
  }, [])

  // Apply font scale to document
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Remove existing font scale classes
      document.documentElement.classList.remove(
        'font-scale-small',
        'font-scale-normal', 
        'font-scale-large',
        'font-scale-extra-large'
      )
      
      // Add current font scale class
      document.documentElement.classList.add(`font-scale-${fontScale}`)
      
      // Save to localStorage
      localStorage.setItem('ca-dms-font-scale', fontScale)
    }
  }, [fontScale])

  const handleSetFontScale = (scale: FontScale) => {
    setFontScale(scale)
  }

  const value = {
    fontScale,
    setFontScale: handleSetFontScale,
    reducedMotion,
    highContrast,
  }

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  )
}