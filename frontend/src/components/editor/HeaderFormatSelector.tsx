import React from 'react'
import { ChevronDown, Type } from 'lucide-react'

interface HeaderFormatSelectorProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

const headerFormats = [
  {
    value: 'normal',
    label: 'Normal Text',
    description: 'Regular paragraph text',
    fontSize: 'text-sm'
  },
  {
    value: 'h1',
    label: 'Heading 1',
    description: 'Main document title',
    fontSize: 'text-lg font-bold'
  },
  {
    value: 'h2',
    label: 'Heading 2',
    description: 'Section heading',
    fontSize: 'text-base font-semibold'
  },
  {
    value: 'h3',
    label: 'Heading 3',
    description: 'Subsection heading',
    fontSize: 'text-sm font-medium'
  }
]

export const HeaderFormatSelector: React.FC<HeaderFormatSelectorProps> = ({
  value,
  onChange,
  className = ''
}) => {
  const selectedFormat = headerFormats.find(format => format.value === value)

  return (
    <div className={`header-format-selector relative ${className}`}>
      <select
        data-testid="header-format-selector"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Header format"
        className={`
          appearance-none
          bg-white
          border border-gray-200
          rounded-md
          px-3 py-2
          pr-8
          text-sm
          font-medium
          text-gray-700
          hover:border-gray-300
          focus:outline-none
          focus:ring-2
          focus:ring-blue-500
          focus:border-transparent
          cursor-pointer
          transition-colors
          min-w-[140px]
        `}
      >
        {headerFormats.map(format => (
          <option key={format.value} value={format.value}>
            {format.label}
          </option>
        ))}
      </select>

      <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </div>

      {/* Format preview icon */}
      <div className="absolute inset-y-0 left-2 flex items-center pointer-events-none">
        <Type className="h-4 w-4 text-gray-500" />
      </div>
    </div>
  )
}