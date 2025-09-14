import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock the API client
vi.mock('../api', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn()
  }
}))

import { reportingService } from '../reportingService'
import { apiClient } from '../api'

describe('Reporting Service - Task 5.2.2: TDD Green Phase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock URL.createObjectURL for browser APIs
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    global.URL.revokeObjectURL = vi.fn()
  })

  describe('TDD Green Phase - Service functionality', () => {
    it('should have reportingService defined with required methods', () => {
      expect(reportingService).toBeDefined()
      expect(typeof reportingService.getWorkflowAnalytics).toBe('function')
      expect(typeof reportingService.getApprovalRateAnalytics).toBe('function')
      expect(typeof reportingService.getTimeAnalytics).toBe('function')
      expect(typeof reportingService.generateReport).toBe('function')
    })

    it('should connect to workflow analytics API', async () => {
      const mockData = {
        total_workflows: 150,
        active_workflows: 25,
        completed_instances: 125,
        average_completion_time: 2.5,
        approval_rates: { approved: 85, rejected: 10, pending: 5 },
        bottleneck_steps: ['review', 'approval'],
        user_performance: {}
      }

      vi.mocked(apiClient.get).mockResolvedValue(mockData)

      const result = await reportingService.getWorkflowAnalytics()

      expect(apiClient.get).toHaveBeenCalledWith('/workflows/analytics')
      expect(result.total_workflows).toBe(150)
      expect(result.approval_rates.approved).toBe(85)
    })

    it('should handle approval rate analytics', async () => {
      const mockData = {
        overall_approval_rate: 0.85,
        rates_by_user: { user1: 0.9, user2: 0.8 },
        rates_by_document_type: { contract: 0.95, memo: 0.75 },
        trend_data: [{ date: '2024-01-01', rate: 0.85 }]
      }

      vi.mocked(apiClient.get).mockResolvedValue(mockData)

      const result = await reportingService.getApprovalRateAnalytics()

      expect(apiClient.get).toHaveBeenCalledWith('/workflows/monitoring/approval-rates')
      expect(result.overall_approval_rate).toBe(0.85)
      expect(result.rates_by_user.user1).toBe(0.9)
    })

    it('should handle time-based analytics', async () => {
      const mockData = {
        period_days: 30,
        processing_time_trends: { week1: 2.5, week2: 3.0 },
        completion_patterns: { morning: 40, afternoon: 60 },
        daily_metrics: [
          { date: '2024-01-01', avg_processing_time: 2.5, completions: 10 }
        ]
      }

      vi.mocked(apiClient.get).mockResolvedValue(mockData)

      const result = await reportingService.getTimeAnalytics(30)

      expect(apiClient.get).toHaveBeenCalledWith('/workflows/monitoring/time-analytics?days=30')
      expect(result.period_days).toBe(30)
      expect(result.daily_metrics).toHaveLength(1)
    })

    it('should handle document type analytics', async () => {
      const mockData = {
        document_type_counts: { contract: 25, memo: 15 },
        completion_rates_by_type: { contract: 0.95, memo: 0.85 },
        processing_time_by_type: { contract: 3.5, memo: 1.2 },
        approval_patterns_by_type: { contract: 0.9, memo: 0.8 }
      }

      vi.mocked(apiClient.get).mockResolvedValue(mockData)

      const result = await reportingService.getDocumentTypeAnalytics()

      expect(apiClient.get).toHaveBeenCalledWith('/workflows/monitoring/document-types')
      expect(result.document_type_counts.contract).toBe(25)
      expect(result.completion_rates_by_type.memo).toBe(0.85)
    })

    it('should generate workflow reports', async () => {
      const reportConfig = {
        report_type: 'comprehensive' as const,
        date_range: { start: '2024-01-01', end: '2024-01-31' },
        include_sections: ['performance', 'trends', 'bottlenecks'],
        format: 'json' as const
      }

      const mockData = {
        report_id: 'rpt_12345',
        status: 'completed' as const,
        data: { summary: 'test' },
        generated_at: '2024-01-31T12:00:00Z'
      }

      vi.mocked(apiClient.post).mockResolvedValue(mockData)

      const result = await reportingService.generateReport(reportConfig)

      expect(apiClient.post).toHaveBeenCalledWith('/workflows/reports/generate', reportConfig)
      expect(result.report_id).toBe('rpt_12345')
      expect(result.status).toBe('completed')
    })

    it('should handle export functionality for JSON format', async () => {
      const exportConfig = {
        data: { analytics: 'test_data', count: 42 },
        format: 'json' as const,
        filename: 'workflow_analytics.json'
      }

      const result = await reportingService.exportReport(exportConfig)

      expect(result.downloadUrl).toBe('blob:mock-url')
      expect(result.filename).toBe('workflow_analytics.json')
      expect(result.format).toBe('json')
      expect(global.URL.createObjectURL).toHaveBeenCalled()
    })

    it('should handle export functionality for CSV format', async () => {
      const exportConfig = {
        data: [{ name: 'test', value: 42 }, { name: 'test2', value: 84 }],
        format: 'csv' as const,
        filename: 'workflow_analytics.csv'
      }

      const result = await reportingService.exportReport(exportConfig)

      expect(result.downloadUrl).toBe('blob:mock-url')
      expect(result.filename).toBe('workflow_analytics.csv')
      expect(result.format).toBe('csv')
      expect(global.URL.createObjectURL).toHaveBeenCalled()
    })

    it('should handle user performance analytics with API endpoint', async () => {
      const mockData = {
        user_metrics: {
          user1: { completed_tasks: 15, average_processing_time: 2.5, approval_rate: 0.95 }
        },
        performance_rankings: [{ user_id: 'user1', score: 95, rank: 1 }],
        efficiency_scores: { user1: 0.95 }
      }

      vi.mocked(apiClient.get).mockResolvedValue(mockData)

      const result = await reportingService.getUserPerformanceAnalytics()

      expect(apiClient.get).toHaveBeenCalledWith('/workflows/monitoring/user-performance')
      expect(result.user_metrics.user1.completed_tasks).toBe(15)
      expect(result.performance_rankings).toHaveLength(1)
    })

    it('should handle user performance analytics fallback', async () => {
      // Clear cache first
      reportingService.clearCache()

      // First call fails, fallback to workflow analytics
      vi.mocked(apiClient.get)
        .mockRejectedValueOnce(new Error('Endpoint not found'))
        .mockResolvedValueOnce({
          total_workflows: 100,
          active_workflows: 20,
          completed_instances: 80,
          average_completion_time: 2.5,
          approval_rates: { approved: 85, rejected: 10, pending: 5 },
          bottleneck_steps: ['review'],
          user_performance: { user1: { tasks: 10 } }
        })

      const result = await reportingService.getUserPerformanceAnalytics()

      expect(result.user_metrics).toEqual({ user1: { tasks: 10 } })
      expect(result.performance_rankings).toEqual([])
    })

    it('should handle bottleneck analysis', async () => {
      // Clear cache to ensure fresh API call
      reportingService.clearCache()

      const workflowMockData = {
        total_workflows: 100,
        active_workflows: 20,
        completed_instances: 80,
        average_completion_time: 2.5,
        approval_rates: { approved: 85, rejected: 10, pending: 5 },
        bottleneck_steps: ['review', 'approval'],
        user_performance: {}
      }

      vi.mocked(apiClient.get).mockResolvedValue(workflowMockData)

      const result = await reportingService.getBottleneckAnalytics()

      expect(result.identified_bottlenecks).toHaveLength(2)
      expect(result.identified_bottlenecks[0].step).toBe('review')
      expect(result.identified_bottlenecks[1].step).toBe('approval')
      expect(result.identified_bottlenecks[0].severity).toBe('medium')
      expect(result.recommendations).toContain('Consider optimizing the review step')
    })

    it('should handle API errors gracefully', async () => {
      // Clear cache to ensure fresh API call
      reportingService.clearCache()

      vi.mocked(apiClient.get).mockRejectedValue(new Error('API Error: 500 Internal Server Error'))

      await expect(reportingService.getWorkflowAnalytics()).rejects.toThrow('Failed to fetch workflow analytics: API Error: 500 Internal Server Error')
    })

    it('should support caching for performance', async () => {
      // Clear cache and mocks to start fresh
      reportingService.clearCache()
      vi.clearAllMocks()

      const mockData = {
        total_workflows: 150,
        active_workflows: 25,
        completed_instances: 125,
        average_completion_time: 2.5,
        approval_rates: { approved: 85, rejected: 10, pending: 5 },
        bottleneck_steps: ['review'],
        user_performance: {}
      }

      vi.mocked(apiClient.get).mockResolvedValue(mockData)

      // First call
      const result1 = await reportingService.getWorkflowAnalytics()
      // Second call (should use cache)
      const result2 = await reportingService.getWorkflowAnalytics()

      // Should only call API once due to caching
      expect(apiClient.get).toHaveBeenCalledTimes(1)
      expect(result1).toEqual(result2)
    })

    it('should validate report configurations', async () => {
      const invalidConfig1 = {
        report_type: 'invalid_type' as any,
        date_range: { start: '2024-01-01', end: '2024-01-31' },
        include_sections: ['test'],
        format: 'json' as const
      }

      await expect(reportingService.generateReport(invalidConfig1)).rejects.toThrow('Invalid report configuration: report_type must be one of comprehensive, summary, custom')

      const invalidConfig2 = {
        report_type: 'comprehensive' as const,
        date_range: null as any,
        include_sections: ['test'],
        format: 'json' as const
      }

      await expect(reportingService.generateReport(invalidConfig2)).rejects.toThrow('Invalid report configuration: date_range with start and end dates is required')
    })

    it('should handle different supported export formats', async () => {
      const jsonConfig = {
        data: { test: 'data' },
        format: 'json' as const
      }

      const csvConfig = {
        data: [{ name: 'test', value: 1 }],
        format: 'csv' as const
      }

      const jsonResult = await reportingService.exportReport(jsonConfig)
      expect(jsonResult.format).toBe('json')

      const csvResult = await reportingService.exportReport(csvConfig)
      expect(csvResult.format).toBe('csv')
    })

    it('should throw error for unsupported export formats', async () => {
      const pdfConfig = {
        data: { test: 'data' },
        format: 'pdf' as const
      }

      await expect(reportingService.exportReport(pdfConfig)).rejects.toThrow('Export format pdf not yet implemented')
    })
  })
})

// These tests should ALL FAIL initially, driving the implementation