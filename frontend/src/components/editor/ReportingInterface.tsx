import React, { useState, useEffect } from 'react'
import { X, Download, FileText, BarChart3, TrendingUp, Users, Clock, AlertTriangle } from 'lucide-react'
import { reportingService } from '../../services/reportingService'
import type {
  ReportConfig,
  GeneratedReport,
  ExportConfig,
  WorkflowAnalytics,
  ApprovalRateAnalytics,
  TimeAnalytics,
  DocumentTypeAnalytics,
  UserPerformanceAnalytics,
  BottleneckAnalytics
} from '../../services/reportingService'

export interface ReportingInterfaceProps {
  isOpen: boolean
  onClose: () => void
  className?: string
}

type ReportType =
  | 'workflow-analytics'
  | 'approval-rates'
  | 'bottlenecks'
  | 'user-performance'
  | 'time-analytics'
  | 'document-types'

interface ReportTypeConfig {
  id: ReportType
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}

const reportTypeConfigs: ReportTypeConfig[] = [
  {
    id: 'workflow-analytics',
    label: 'Workflow Analytics',
    description: 'Overview of workflow performance and completion rates',
    icon: BarChart3,
    color: 'text-blue-600'
  },
  {
    id: 'approval-rates',
    label: 'Approval Rates',
    description: 'Approval and rejection trends across documents',
    icon: TrendingUp,
    color: 'text-green-600'
  },
  {
    id: 'bottlenecks',
    label: 'Bottleneck Analysis',
    description: 'Identify workflow steps causing delays',
    icon: AlertTriangle,
    color: 'text-orange-600'
  },
  {
    id: 'user-performance',
    label: 'User Performance',
    description: 'Individual user metrics and efficiency scores',
    icon: Users,
    color: 'text-purple-600'
  },
  {
    id: 'time-analytics',
    label: 'Time Analytics',
    description: 'Processing time trends and completion patterns',
    icon: Clock,
    color: 'text-indigo-600'
  },
  {
    id: 'document-types',
    label: 'Document Types Report',
    description: 'Analysis by document type and category',
    icon: FileText,
    color: 'text-gray-600'
  }
]

const exportFormats = [
  { value: 'json', label: 'JSON Data' },
  { value: 'csv', label: 'CSV Spreadsheet' },
  { value: 'pdf', label: 'PDF Report' },
  { value: 'xlsx', label: 'Excel Workbook' }
] as const

export const ReportingInterface: React.FC<ReportingInterfaceProps> = ({
  isOpen,
  onClose,
  className = ''
}) => {
  const [selectedReportType, setSelectedReportType] = useState<ReportType>('workflow-analytics')
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    end: new Date().toISOString().split('T')[0] // today
  })
  const [exportFormat, setExportFormat] = useState<'json' | 'csv' | 'pdf' | 'xlsx'>('json')
  const [isLoading, setIsLoading] = useState(false)
  const [reportData, setReportData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  const generateReport = async () => {
    if (!selectedReportType || !dateRange.start || !dateRange.end) return

    setIsLoading(true)
    setError(null)

    try {
      // Get analytics data based on selected report type
      const data = await reportingService.getAnalyticsByType(selectedReportType)
      setReportData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report')
    } finally {
      setIsLoading(false)
    }
  }

  const exportReport = async () => {
    if (!reportData) return

    setIsLoading(true)
    setError(null)

    try {
      const exportConfig: ExportConfig = {
        data: reportData,
        format: exportFormat,
        filename: `${selectedReportType}-report-${dateRange.start}-to-${dateRange.end}.${exportFormat}`
      }

      const result = await reportingService.exportReport(exportConfig)

      // Create download link
      const link = document.createElement('a')
      link.href = result.downloadUrl
      link.download = result.filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Clean up blob URL
      setTimeout(() => {
        URL.revokeObjectURL(result.downloadUrl)
      }, 100)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export report')
    } finally {
      setIsLoading(false)
    }
  }

  const renderReportPreview = () => {
    if (!reportData) return null

    const selectedConfig = reportTypeConfigs.find(config => config.id === selectedReportType)
    if (!selectedConfig) return null

    return (
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          <selectedConfig.icon className={`h-5 w-5 ${selectedConfig.color}`} />
          <h3 className="font-medium text-gray-900">{selectedConfig.label} Preview</h3>
        </div>

        <div className="space-y-2 text-sm text-gray-600">
          {/* Workflow Analytics Preview */}
          {selectedReportType === 'workflow-analytics' && (
            <>
              <div>Total Workflows: <span className="font-medium">{reportData.total_workflows}</span></div>
              <div>Active Workflows: <span className="font-medium">{reportData.active_workflows}</span></div>
              <div>Completed: <span className="font-medium">{reportData.completed_instances}</span></div>
              <div>Avg Completion Time: <span className="font-medium">{reportData.average_completion_time} days</span></div>
              <div>Approval Rate: <span className="font-medium">{reportData.approval_rates?.approved}%</span></div>
            </>
          )}

          {/* Approval Rates Preview */}
          {selectedReportType === 'approval-rates' && (
            <>
              <div>Overall Approval Rate: <span className="font-medium">{(reportData.overall_approval_rate * 100).toFixed(1)}%</span></div>
              <div>Users Analyzed: <span className="font-medium">{Object.keys(reportData.rates_by_user || {}).length}</span></div>
              <div>Document Types: <span className="font-medium">{Object.keys(reportData.rates_by_document_type || {}).length}</span></div>
              <div>Trend Data Points: <span className="font-medium">{reportData.trend_data?.length || 0}</span></div>
            </>
          )}

          {/* Time Analytics Preview */}
          {selectedReportType === 'time-analytics' && (
            <>
              <div>Analysis Period: <span className="font-medium">{reportData.period_days} days</span></div>
              <div>Daily Metrics: <span className="font-medium">{reportData.daily_metrics?.length || 0} entries</span></div>
              <div>Processing Trends: <span className="font-medium">{Object.keys(reportData.processing_time_trends || {}).length} categories</span></div>
              <div>Completion Patterns: <span className="font-medium">{Object.keys(reportData.completion_patterns || {}).length} patterns</span></div>
            </>
          )}

          {/* Document Types Preview */}
          {selectedReportType === 'document-types' && (
            <>
              <div>Document Types: <span className="font-medium">{Object.keys(reportData.document_type_counts || {}).length}</span></div>
              <div>Total Documents: <span className="font-medium">{Object.values(reportData.document_type_counts || {}).reduce((a: number, b: any) => a + (Number(b) || 0), 0)}</span></div>
              <div>Completion Rates: <span className="font-medium">{Object.keys(reportData.completion_rates_by_type || {}).length} types</span></div>
            </>
          )}

          {/* User Performance Preview */}
          {selectedReportType === 'user-performance' && (
            <>
              <div>Users Analyzed: <span className="font-medium">{Object.keys(reportData.user_metrics || {}).length}</span></div>
              <div>Performance Rankings: <span className="font-medium">{reportData.performance_rankings?.length || 0}</span></div>
              <div>Efficiency Scores: <span className="font-medium">{Object.keys(reportData.efficiency_scores || {}).length}</span></div>
            </>
          )}

          {/* Bottleneck Analysis Preview */}
          {selectedReportType === 'bottlenecks' && (
            <>
              <div>Identified Bottlenecks: <span className="font-medium">{reportData.identified_bottlenecks?.length || 0}</span></div>
              <div>Steps Analyzed: <span className="font-medium">{Object.keys(reportData.step_performance || {}).length}</span></div>
              <div>Recommendations: <span className="font-medium">{reportData.recommendations?.length || 0}</span></div>
            </>
          )}
        </div>
      </div>
    )
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${className}`}>
        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Advanced Reporting</h2>
              <p className="text-sm text-gray-600 mt-1">Generate and export comprehensive workflow reports</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Close reporting interface"
            >
              <X className="h-5 w-5 text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
            {/* Report Type Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Report Type
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {reportTypeConfigs.map((config) => {
                  const Icon = config.icon
                  const isSelected = selectedReportType === config.id

                  return (
                    <button
                      key={config.id}
                      onClick={() => setSelectedReportType(config.id)}
                      className={`p-4 border rounded-lg text-left transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Icon className={`h-5 w-5 mt-0.5 ${config.color}`} />
                        <div>
                          <h3 className="font-medium text-gray-900 text-sm">{config.label}</h3>
                          <p className="text-xs text-gray-600 mt-1">{config.description}</p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Date Range */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date Range
              </label>
              <div className="flex gap-3">
                <div>
                  <label htmlFor="start-date" className="block text-xs text-gray-600 mb-1">Start Date</label>
                  <input
                    id="start-date"
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label htmlFor="end-date" className="block text-xs text-gray-600 mb-1">End Date</label>
                  <input
                    id="end-date"
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Export Format */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Export Format
              </label>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {exportFormats.map((format) => (
                  <option key={format.value} value={format.value}>
                    {format.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Report Preview */}
            {renderReportPreview()}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            >
              Cancel
            </button>

            <div className="flex gap-3">
              <button
                onClick={generateReport}
                disabled={isLoading || !selectedReportType}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Generating...' : 'Generate Report'}
              </button>

              <button
                onClick={exportReport}
                disabled={isLoading || !reportData}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                {isLoading ? 'Exporting...' : 'Export'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}