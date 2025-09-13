import React, { useState } from 'react'
import { BarChart3, ChevronDown } from 'lucide-react'

interface AdvancedReportingButtonProps {
  onReportClick?: (reportType: string) => void
  className?: string
}

const reportTypes = [
  { value: 'workflow-analytics', label: 'Workflow Analytics' },
  { value: 'approval-rates', label: 'Approval Rates' },
  { value: 'bottlenecks', label: 'Bottleneck Analysis' },
  { value: 'user-performance', label: 'User Performance' },
  { value: 'time-analytics', label: 'Time Analytics' },
  { value: 'document-types', label: 'Document Types Report' }
]

export const AdvancedReportingButton: React.FC<AdvancedReportingButtonProps> = ({
  onReportClick,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false)

  const handleReportSelect = (reportType: string) => {
    onReportClick?.(reportType)
    setIsOpen(false)
  }

  const handleMainClick = () => {
    if (onReportClick) {
      onReportClick('workflow-analytics')
    } else {
      // Fallback to opening dropdown
      setIsOpen(!isOpen)
    }
  }

  return (
    <div className={`advanced-reporting-button relative ${className}`}>
      <button
        data-testid="advanced-reporting-button"
        onClick={handleMainClick}
        className={`
          flex items-center gap-2
          px-3 py-2
          text-sm font-medium
          text-gray-700
          bg-white
          border border-gray-200
          rounded-md
          hover:bg-gray-50
          hover:border-gray-300
          focus:outline-none
          focus:ring-2
          focus:ring-blue-500
          focus:border-transparent
          transition-colors
        `}
      >
        <BarChart3 className="h-4 w-4" />
        <span>Reports</span>
        {reportTypes.length > 1 && (
          <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute right-0 top-full mt-1 z-20 min-w-[200px] bg-white border border-gray-200 rounded-md shadow-lg">
            <div className="py-1">
              {reportTypes.map(report => (
                <button
                  key={report.value}
                  onClick={() => handleReportSelect(report.value)}
                  className={`
                    w-full text-left
                    px-4 py-2
                    text-sm text-gray-700
                    hover:bg-gray-100
                    transition-colors
                  `}
                >
                  {report.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}