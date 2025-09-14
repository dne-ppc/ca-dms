import React from 'react'
import { ChevronDown } from 'lucide-react'

interface DocumentTypeSelectorProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

const documentTypes = [
  { value: 'governance', label: 'Governance Document' },
  { value: 'policy', label: 'Policy Document' },
  { value: 'meeting', label: 'Meeting Minutes' },
  { value: 'notice', label: 'Notice' },
  { value: 'form', label: 'Form' },
  { value: 'report', label: 'Report' },
  { value: 'memo', label: 'Memorandum' },
  { value: 'other', label: 'Other' }
]

export const DocumentTypeSelector: React.FC<DocumentTypeSelectorProps> = ({
  value,
  onChange,
  className = ''
}) => {
  const selectedType = documentTypes.find(type => type.value === value)

  return (
    <div className={`document-type-selector relative ${className}`}>
      <select
        data-testid="document-type-selector"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Document type"
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
        `}
      >
        {documentTypes.map(type => (
          <option key={type.value} value={type.value}>
            {type.label}
          </option>
        ))}
      </select>

      <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </div>
    </div>
  )
}