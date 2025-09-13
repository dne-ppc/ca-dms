/**
 * IntroPage Component - Main Dashboard Page
 * Coordinates and displays all intro page dashboard components
 */
import React, { useState, useEffect } from 'react'
import { Alert, AlertDescription } from '../ui/alert'
import { Button } from '../ui/button'
import { Card, CardContent } from '../ui/card'
import { UserStatisticsCard } from './UserStatisticsCard'
import { SystemOverviewCard } from './SystemOverviewCard'
import { ActionableItemsCard } from './ActionableItemsCard'
import { ActivityFeedCard } from './ActivityFeedCard'
import { PersonalizationPanel } from './PersonalizationPanel'
import { introPageService, type TransformedIntroPageData } from '../../services/introPageService'

interface IntroPageProps {
  userId: string
}

export const IntroPage: React.FC<IntroPageProps> = ({ userId }) => {
  const [data, setData] = useState<TransformedIntroPageData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const result = await introPageService.getIntroPageData(userId)
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (userId) {
      fetchData()
    }
  }, [userId])

  const handlePersonalizationUpdate = async (updates: any) => {
    if (!userId) return

    try {
      const updatedPersonalization = await introPageService.updatePersonalization(userId, updates)

      if (data) {
        setData({
          ...data,
          personalization: updatedPersonalization
        })
      }
    } catch (err) {
      console.error('Failed to update personalization:', err)
    }
  }

  const handleActionableItemClick = (item: any) => {
    // Navigate to the appropriate page based on item type
    const itemRoutes: Record<string, string> = {
      document_approval: `/documents/${item.related_document || item.id}`,
      workflow_task: `/workflows/${item.id}`,
      notification: `/notifications/${item.id}`
    }

    const route = itemRoutes[item.type] || `/dashboard`
    window.location.pathname = route
  }

  const handleRetry = () => {
    fetchData()
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div
            role="progressbar"
            className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"
          />
          <p className="text-lg text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <Alert className="mb-4">
              <AlertDescription>
                <div className="font-semibold text-red-600 mb-2">Error</div>
                {error}
              </AlertDescription>
            </Alert>
            <Button onClick={handleRetry} className="w-full">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600">No data available</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome Back
          </h1>
          <p className="text-gray-600">
            Here's what's happening with your documents and workflows
          </p>
          <div className="text-sm text-gray-500 mt-1">
            Last updated: {data.lastUpdated.toLocaleString()}
          </div>
        </div>

        {/* Main Dashboard Grid */}
        <div
          data-testid="intro-page-container"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8"
        >
          {/* User Statistics */}
          <div className="lg:col-span-1">
            <UserStatisticsCard
              statistics={data.userStatistics}
              isLoading={false}
            />
          </div>

          {/* System Overview */}
          <div className="lg:col-span-1">
            <SystemOverviewCard
              overview={data.systemOverview}
              isLoading={false}
            />
          </div>

          {/* Actionable Items */}
          <div className="lg:col-span-1">
            <ActionableItemsCard
              actionableItems={data.actionableItems}
              isLoading={false}
              onItemClick={handleActionableItemClick}
            />
          </div>

          {/* Activity Feed */}
          <div className="lg:col-span-2">
            <ActivityFeedCard
              activityFeed={data.activityFeed}
              isLoading={false}
            />
          </div>

          {/* Personalization Panel */}
          <div className="lg:col-span-1">
            <PersonalizationPanel
              personalization={data.personalization}
              onUpdate={handlePersonalizationUpdate}
              isLoading={false}
            />
          </div>
        </div>

        {/* Performance Information */}
        {data.performanceMetrics && (
          <div className="mt-8 text-xs text-gray-400 text-center">
            <div>
              Request ID: {data.performanceMetrics.request_id} •
              Load time: {data.performanceMetrics.coordination_time_ms.toFixed(1)}ms •
              Cache hit rate: {data.performanceMetrics.cache_hit_rate.toFixed(1)}%
            </div>
            <div>
              Data sources: {data.performanceMetrics.data_sources.join(', ')}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}