import { useAccessibility } from '../../contexts/AccessibilityContext'
import './FontScaleToggle.css'

export function FontScaleToggle() {
  const { fontScale, setFontScale } = useAccessibility()

  const cycleFontScale = () => {
    switch (fontScale) {
      case 'small':
        setFontScale('normal')
        break
      case 'normal':
        setFontScale('large')
        break
      case 'large':
        setFontScale('extra-large')
        break
      case 'extra-large':
        setFontScale('small')
        break
    }
  }

  const getIcon = () => {
    switch (fontScale) {
      case 'small':
        return 'A-'
      case 'normal':
        return 'A'
      case 'large':
        return 'A+'
      case 'extra-large':
        return 'A++'
    }
  }

  const getLabel = () => {
    switch (fontScale) {
      case 'small':
        return 'Small Text'
      case 'normal':
        return 'Normal Text'
      case 'large':
        return 'Large Text'
      case 'extra-large':
        return 'Extra Large Text'
    }
  }

  const getDescription = () => {
    switch (fontScale) {
      case 'small':
        return 'Smaller font size for compact view'
      case 'normal':
        return 'Default font size'
      case 'large':
        return 'Larger font size for better readability'
      case 'extra-large':
        return 'Extra large font size for accessibility'
    }
  }

  return (
    <button 
      onClick={cycleFontScale}
      className="font-scale-toggle"
      title={`${getLabel()}: ${getDescription()}`}
      aria-label={`Change font size. Current: ${getLabel()}`}
    >
      <span className="font-scale-icon" aria-hidden="true">
        {getIcon()}
      </span>
      <span className="font-scale-label">
        {getLabel()}
      </span>
    </button>
  )
}