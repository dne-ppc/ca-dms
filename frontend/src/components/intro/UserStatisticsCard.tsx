/**
 * UserStatisticsCard Component
 * Displays user document statistics and recent documents
 */
import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'

interface UserStatistics {
  documentCount: number
  templateCount: number
  recentDocuments: Array<{
    id: string
    title: string
    updatedAt: Date
    status: string
  }>
  documentTypes: Record<string, number>
}

interface UserStatisticsCardProps {
  statistics: UserStatistics | null
  isLoading: boolean
}

const StatisticsSkeleton = () => (
  <div data-testid="statistics-skeleton" className="space-y-4">
    {[1, 2, 3, 4].map((i) => (
      <div
        key={i}
        data-testid="skeleton-line"
        className="h-4 bg-gray-200 rounded animate-pulse"
      />
    ))}
  </div>
)

const DocumentTypeChart = ({ documentTypes }: { documentTypes: Record<string, number> }) => {
  const total = Object.values(documentTypes).reduce((sum, count) => sum + count, 0)

  return (
    <div data-testid="document-type-chart" className="space-y-3">
      <h4 className="text-sm font-medium text-gray-700 mb-2">Document Types</h4>
      {Object.entries(documentTypes).map(([type, count]) => {
        const percentage = total > 0 ? (count / total) * 100 : 0
        const formattedType = type.replace(/_/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase())

        return (
          <div key={type} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{formattedType}: {count}</span>
              <span className="text-gray-500">{percentage.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export const UserStatisticsCard: React.FC<UserStatisticsCardProps> = ({
  statistics,
  isLoading
}) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>User Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <StatisticsSkeleton />
        </CardContent>
      </Card>
    )
  }

  if (!statistics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>User Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">No statistics available</p>
        </CardContent>
      </Card>
    )
  }

  const handleViewAllDocuments = () => {
    window.location.pathname = '/documents'
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          User Statistics
          <Button
            variant="outline"
            size="sm"
            onClick={handleViewAllDocuments}
          >
            View All Documents
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Statistics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {statistics.documentCount}
            </div>
            <div className="text-sm text-gray-600">Documents</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {statistics.templateCount}
            </div>
            <div className="text-sm text-gray-600">Templates</div>
          </div>
        </div>

        {/* Document Type Breakdown */}
        {Object.keys(statistics.documentTypes).length > 0 && (
          <DocumentTypeChart documentTypes={statistics.documentTypes} />
        )}

        {/* Recent Documents */}
        {statistics.recentDocuments.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Recent Documents</h4>
            <div className="space-y-2">
              {statistics.recentDocuments.slice(0, 3).map((doc) => (
                <div
                  key={doc.id}
                  className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => window.location.pathname = `/documents/${doc.id}`}
                >
                  <div className="font-medium text-sm text-gray-900 truncate">
                    {doc.title}
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-xs text-gray-500">
                      {doc.updatedAt.toLocaleDateString()}
                    </span>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${{
                        approved: 'bg-green-100 text-green-800',
                        pending: 'bg-yellow-100 text-yellow-800',
                        draft: 'bg-gray-100 text-gray-800'
                      }[doc.status] || 'bg-gray-100 text-gray-800'}`}
                    >
                      {doc.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}