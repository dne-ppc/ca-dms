import { apiClient } from './api'

export interface WorkflowAnalytics {
  total_workflows: number
  active_workflows: number
  completed_instances: number
  average_completion_time: number
  approval_rates: {
    approved: number
    rejected: number
    pending: number
  }
  bottleneck_steps: string[]
  user_performance: Record<string, any>
}

export interface ApprovalRateAnalytics {
  overall_approval_rate: number
  rates_by_user: Record<string, number>
  rates_by_document_type: Record<string, number>
  trend_data: Array<{
    date: string
    rate: number
  }>
}

export interface TimeAnalytics {
  period_days: number
  processing_time_trends: Record<string, any>
  completion_patterns: Record<string, any>
  daily_metrics: Array<{
    date: string
    avg_processing_time: number
    completions: number
  }>
}

export interface DocumentTypeAnalytics {
  document_type_counts: Record<string, number>
  completion_rates_by_type: Record<string, number>
  processing_time_by_type: Record<string, number>
  approval_patterns_by_type: Record<string, number>
  detailed_analytics?: Record<string, any>
}

export interface UserPerformanceAnalytics {
  user_metrics: Record<string, {
    completed_tasks: number
    average_processing_time: number
    approval_rate: number
  }>
  performance_rankings: Array<{
    user_id: string
    score: number
    rank: number
  }>
  efficiency_scores: Record<string, number>
}

export interface BottleneckAnalytics {
  identified_bottlenecks: Array<{
    step: string
    severity: 'low' | 'medium' | 'high'
    impact: string
  }>
  step_performance: Record<string, {
    average_time: number
    success_rate: number
  }>
  recommendations: string[]
}

export interface ReportConfig {
  report_type: 'comprehensive' | 'summary' | 'custom'
  date_range: {
    start: string
    end: string
  }
  include_sections: string[]
  format: 'json' | 'csv' | 'pdf' | 'xlsx'
}

export interface GeneratedReport {
  report_id: string
  status: 'completed' | 'processing' | 'failed'
  data: Record<string, any>
  generated_at: string
  download_url?: string
}

export interface ExportConfig {
  data: Record<string, any>
  format: 'json' | 'csv' | 'pdf' | 'xlsx'
  filename?: string
}

export interface ExportResult {
  downloadUrl: string
  filename: string
  format: string
  size?: number
}

class ReportingService {
  private cache: Map<string, { data: any; timestamp: number }> = new Map()
  private cacheDuration = 5 * 60 * 1000 // 5 minutes

  /**
   * Get cached data if available and not expired
   */
  private getCachedData(key: string): any | null {
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      return cached.data
    }
    return null
  }

  /**
   * Store data in cache
   */
  private setCachedData(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() })
  }

  /**
   * Get workflow analytics data
   */
  async getWorkflowAnalytics(): Promise<WorkflowAnalytics> {
    const cacheKey = 'workflow-analytics'
    const cached = this.getCachedData(cacheKey)
    if (cached) return cached

    try {
      const response = await apiClient.get<WorkflowAnalytics>('/workflows/analytics')
      this.setCachedData(cacheKey, response)
      return response
    } catch (error) {
      throw new Error(`Failed to fetch workflow analytics: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get approval rate analytics
   */
  async getApprovalRateAnalytics(): Promise<ApprovalRateAnalytics> {
    const cacheKey = 'approval-rate-analytics'
    const cached = this.getCachedData(cacheKey)
    if (cached) return cached

    try {
      const response = await apiClient.get<ApprovalRateAnalytics>('/workflows/monitoring/approval-rates')
      this.setCachedData(cacheKey, response)
      return response
    } catch (error) {
      throw new Error(`Failed to fetch approval rate analytics: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get time-based analytics
   */
  async getTimeAnalytics(days: number = 30): Promise<TimeAnalytics> {
    const cacheKey = `time-analytics-${days}`
    const cached = this.getCachedData(cacheKey)
    if (cached) return cached

    try {
      const response = await apiClient.get<TimeAnalytics>(`/workflows/monitoring/time-analytics?days=${days}`)
      this.setCachedData(cacheKey, response)
      return response
    } catch (error) {
      throw new Error(`Failed to fetch time analytics: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get document type analytics
   */
  async getDocumentTypeAnalytics(): Promise<DocumentTypeAnalytics> {
    const cacheKey = 'document-type-analytics'
    const cached = this.getCachedData(cacheKey)
    if (cached) return cached

    try {
      const response = await apiClient.get<DocumentTypeAnalytics>('/workflows/monitoring/document-types')
      this.setCachedData(cacheKey, response)
      return response
    } catch (error) {
      throw new Error(`Failed to fetch document type analytics: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get user performance analytics
   */
  async getUserPerformanceAnalytics(): Promise<UserPerformanceAnalytics> {
    const cacheKey = 'user-performance-analytics'
    const cached = this.getCachedData(cacheKey)
    if (cached) return cached

    try {
      // This would be a new endpoint if needed
      const response = await apiClient.get<UserPerformanceAnalytics>('/workflows/monitoring/user-performance')
      this.setCachedData(cacheKey, response)
      return response
    } catch (error) {
      // Fallback to extracting from workflow analytics
      const workflowData = await this.getWorkflowAnalytics()
      const userData: UserPerformanceAnalytics = {
        user_metrics: workflowData.user_performance || {},
        performance_rankings: [],
        efficiency_scores: {}
      }
      this.setCachedData(cacheKey, userData)
      return userData
    }
  }

  /**
   * Get bottleneck analytics
   */
  async getBottleneckAnalytics(): Promise<BottleneckAnalytics> {
    const cacheKey = 'bottleneck-analytics'
    const cached = this.getCachedData(cacheKey)
    if (cached) return cached

    try {
      const workflowData = await this.getWorkflowAnalytics()
      const bottleneckData: BottleneckAnalytics = {
        identified_bottlenecks: workflowData.bottleneck_steps.map(step => ({
          step,
          severity: 'medium' as const,
          impact: `Step ${step} is causing delays`
        })),
        step_performance: {},
        recommendations: [`Consider optimizing the ${workflowData.bottleneck_steps[0]} step`]
      }
      this.setCachedData(cacheKey, bottleneckData)
      return bottleneckData
    } catch (error) {
      throw new Error(`Failed to fetch bottleneck analytics: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Generate comprehensive workflow report
   */
  async generateReport(config: ReportConfig): Promise<GeneratedReport> {
    this.validateReportConfig(config)

    try {
      const response = await apiClient.post<GeneratedReport>('/workflows/reports/generate', config)
      return response
    } catch (error) {
      throw new Error(`Failed to generate report: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Export report data in different formats
   */
  async exportReport(config: ExportConfig): Promise<ExportResult> {
    const { data, format, filename } = config

    try {
      // For JSON format, create blob and download URL
      if (format === 'json') {
        const jsonData = JSON.stringify(data, null, 2)
        const blob = new Blob([jsonData], { type: 'application/json' })
        const downloadUrl = URL.createObjectURL(blob)

        return {
          downloadUrl,
          filename: filename || `report_${Date.now()}.json`,
          format,
          size: blob.size
        }
      }

      // For CSV format, convert data to CSV
      if (format === 'csv') {
        const csvData = this.convertToCSV(data)
        const blob = new Blob([csvData], { type: 'text/csv' })
        const downloadUrl = URL.createObjectURL(blob)

        return {
          downloadUrl,
          filename: filename || `report_${Date.now()}.csv`,
          format,
          size: blob.size
        }
      }

      // For PDF and XLSX, we'd need to implement server-side generation or use libraries
      throw new Error(`Export format ${format} not yet implemented`)

    } catch (error) {
      throw new Error(`Failed to export report: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Validate report configuration
   */
  private validateReportConfig(config: ReportConfig): void {
    const validTypes = ['comprehensive', 'summary', 'custom']
    const validFormats = ['json', 'csv', 'pdf', 'xlsx']

    if (!validTypes.includes(config.report_type)) {
      throw new Error(`Invalid report configuration: report_type must be one of ${validTypes.join(', ')}`)
    }

    if (!validFormats.includes(config.format)) {
      throw new Error(`Invalid report configuration: format must be one of ${validFormats.join(', ')}`)
    }

    if (!config.date_range || !config.date_range.start || !config.date_range.end) {
      throw new Error('Invalid report configuration: date_range with start and end dates is required')
    }
  }

  /**
   * Convert data to CSV format
   */
  private convertToCSV(data: Record<string, any>): string {
    if (Array.isArray(data)) {
      if (data.length === 0) return ''

      const headers = Object.keys(data[0])
      const csvHeaders = headers.join(',')
      const csvRows = data.map(row =>
        headers.map(header => {
          const value = row[header]
          return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : String(value)
        }).join(',')
      )

      return [csvHeaders, ...csvRows].join('\n')
    } else {
      // Convert object to key-value pairs
      return Object.entries(data)
        .map(([key, value]) => `"${key}","${String(value).replace(/"/g, '""')}"`)
        .join('\n')
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Get analytics by report type (for button integration)
   */
  async getAnalyticsByType(reportType: string): Promise<any> {
    switch (reportType) {
      case 'workflow-analytics':
        return this.getWorkflowAnalytics()
      case 'approval-rates':
        return this.getApprovalRateAnalytics()
      case 'bottlenecks':
        return this.getBottleneckAnalytics()
      case 'user-performance':
        return this.getUserPerformanceAnalytics()
      case 'time-analytics':
        return this.getTimeAnalytics()
      case 'document-types':
        return this.getDocumentTypeAnalytics()
      default:
        throw new Error(`Unknown report type: ${reportType}`)
    }
  }
}

export const reportingService = new ReportingService()