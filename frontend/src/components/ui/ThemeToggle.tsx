import { useTheme } from '../../contexts/ThemeContext'
import './ThemeToggle.css'

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme()

  const cycleTheme = () => {
    if (theme === 'light') {
      setTheme('dark')
    } else if (theme === 'dark') {
      setTheme('high-contrast')
    } else if (theme === 'high-contrast') {
      setTheme('system')
    } else {
      setTheme('light')
    }
  }

  const getIcon = () => {
    if (theme === 'high-contrast') {
      return '🔲'
    }
    if (theme === 'system') {
      return resolvedTheme === 'high-contrast' ? '🔲' : (resolvedTheme === 'dark' ? '🌙' : '☀️')
    }
    return theme === 'dark' ? '🌙' : '☀️'
  }

  const getLabel = () => {
    switch (theme) {
      case 'light':
        return 'Light'
      case 'dark':
        return 'Dark'
      case 'high-contrast':
        return 'High Contrast'
      case 'system':
        return 'System'
      default:
        return 'Theme'
    }
  }

  return (
    <button 
      onClick={cycleTheme}
      className="theme-toggle"
      title={`Current theme: ${getLabel()}`}
      aria-label={`Switch theme. Current theme: ${getLabel()}`}
    >
      <span className="theme-icon" role="img" aria-hidden="true">
        {getIcon()}
      </span>
      <span className="theme-label">
        {getLabel()}
      </span>
    </button>
  )
}